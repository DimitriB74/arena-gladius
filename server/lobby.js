// ============================================================================
//  ARENA GLADIUS — server/lobby.js
//
//  Joueurs connectés, défis entre amis, lancement des matchs.
//
//  Événements reçus du navigateur :
//    player:join        { jeton, perso }     rejoindre / mettre à jour son gladiateur
//    challenge:send     { cible, arene }     défier un joueur
//    challenge:response { idDefi, accepte }  répondre à un défi
//    challenge:cancel   { idDefi }           annuler son défi
//    match:training     { arene, difficulte } combat contre un bot (facile / normal / difficile)
///    match:entrees      { e: [...] }         touches pressées pendant un combat (temps réel)
//    match:forfeit                           abandonner
//
//  Événements envoyés :
//    player:accepted, player:refused, lobby:update, challenge:incoming,
//    challenge:result, match:start, match:state, match:error, match:end
// ============================================================================

import { ARENES, DIFFICULTES } from '../shared/data.js';
import { niveauPersonnage } from '../shared/formulas.js';
import { validerPersonnage } from '../shared/validation.js';
import { Match } from './matchs.js';
import { genererAdversaire } from './ai.js';

const DUREE_DEFI = 20000;                 // un défi expire après 20 s
const DUREE_RESULTATS = 10 * 60 * 1000;   // résultats gardés 10 min pour un joueur parti

let compteur = 0;
// Identifiants uniques même après un redémarrage du serveur (horodatage + compteur)
const nouvelId = (prefixe) => `${prefixe}${Date.now().toString(36)}${(++compteur).toString(36)}`;

export class Lobby {
  constructor(io) {
    this.io = io;
    this.joueurs = new Map();       // jeton → joueur
    this.defis = new Map();         // idDefi → défi
    this.matchs = new Map();        // idMatch → Match
    this.resultats = new Map();     // jeton → [résultats non remis]
  }

  // --------------------------------------------------------------------------
  //  Liste des joueurs
  // --------------------------------------------------------------------------
  listePublique() {
    return [...this.joueurs.values()]
      .filter((j) => j.socket)
      .map((j) => ({
        id: j.id,
        nom: j.perso.nom,
        niveau: niveauPersonnage(j.perso.pointsGagnes),
        skin: j.perso.skin,
        equipement: j.perso.equipement,
        statut: j.statut,
      }));
  }

  diffuserLobby() {
    this.io.emit('lobby:update', this.listePublique());
  }

  parId(id) {
    return [...this.joueurs.values()].find((j) => j.id === id) || null;
  }

  // --------------------------------------------------------------------------
  //  Connexion d'un navigateur
  // --------------------------------------------------------------------------
  connexion(socket) {
    let joueur = null;
    const ecouter = (evenement, fn) => socket.on(evenement, (donnees) => {
      try { fn(donnees || {}); } catch (e) { console.error(`Erreur sur ${evenement} :`, e); }
    });

    ecouter('player:join', ({ jeton, perso }) => {
      if (typeof jeton !== 'string' || jeton.length < 8 || jeton.length > 64) return;
      const v = validerPersonnage(perso);
      if (!v.ok) {
        socket.emit('player:refused', { erreurs: v.erreurs });
        return;
      }
      joueur = this.rejoindre(socket, jeton, perso);
    });

    // Seul l'onglet le plus récent d'un joueur peut agir
    const actif = () => joueur && joueur.socket === socket;
    ecouter('challenge:send', ({ cible, arene }) => actif() && this.envoyerDefi(joueur, cible, arene));
    ecouter('challenge:response', ({ idDefi, accepte }) => actif() && this.repondreDefi(joueur, idDefi, !!accepte));
    ecouter('challenge:cancel', ({ idDefi }) => actif() && this.annulerDefi(joueur, idDefi));
    ecouter('match:training', ({ arene, difficulte }) => actif() && this.lancerEntrainement(joueur, arene, difficulte));
    ecouter('match:entrees', (lot) => actif() && joueur.match?.recevoirEntrees(joueur, lot));
    ecouter('match:forfeit', () => actif() && joueur.match?.abandon(joueur, 'abandon'));

    socket.on('disconnect', () => {
      if (joueur && joueur.socket === socket) this.depart(joueur);
    });
  }

  rejoindre(socket, jeton, perso) {
    let joueur = this.joueurs.get(jeton);
    if (joueur) {
      // Même jeton : mise à jour du gladiateur, ou retour après une déconnexion
      if (joueur.socket && joueur.socket !== socket) joueur.socket.emit('session:remplacee');
      const revient = joueur.socket !== socket;
      joueur.socket = socket;
      if (joueur.statut !== 'combat') joueur.perso = perso;
      if (revient && joueur.match) joueur.match.reconnexion(joueur);
    } else {
      joueur = { id: nouvelId('g'), jeton, socket, perso, statut: 'libre', match: null };
      this.joueurs.set(jeton, joueur);
    }
    // Résultats de combats terminés pendant son absence
    const enAttente = this.resultats.get(jeton) || [];
    this.resultats.delete(jeton);
    socket.emit('player:accepted', { id: joueur.id, resultats: enAttente });
    this.diffuserLobby();
    return joueur;
  }

  depart(joueur) {
    joueur.socket = null;
    for (const d of [...this.defis.values()]) {
      if (d.de === joueur || d.a === joueur) this.fermerDefi(d, 'annule', `${joueur.perso.nom} s’est déconnecté.`);
    }
    if (joueur.match) {
      joueur.match.deconnexion(joueur);       // 30 s pour revenir
    } else {
      this.joueurs.delete(joueur.jeton);
    }
    this.diffuserLobby();
  }

  // --------------------------------------------------------------------------
  //  Défis
  // --------------------------------------------------------------------------
  envoyerDefi(joueur, idCible, arene) {
    const cible = this.parId(idCible);
    const refuser = (message) => joueur.socket?.emit('challenge:result', { statut: 'indisponible', message });
    if (!cible || !cible.socket) return refuser('Ce gladiateur n’est plus en ligne.');
    if (cible === joueur) return refuser('Tu ne peux pas te défier toi-même !');
    if (joueur.statut !== 'libre') return refuser('Tu es déjà en combat.');
    if (cible.statut !== 'libre') return refuser(`${cible.perso.nom} est déjà en combat.`);
    for (const d of this.defis.values()) {
      if (d.de === joueur) return refuser('Tu as déjà un défi en attente.');
      if (d.a === cible || d.de === cible) return refuser(`${cible.perso.nom} a déjà un défi en cours.`);
    }
    const defi = {
      id: nouvelId('d'),
      de: joueur,
      a: cible,
      arene: ARENES[arene] ? arene : null,
    };
    defi.minuteur = setTimeout(() => this.fermerDefi(defi, 'expire', 'Le défi a expiré.'), DUREE_DEFI);
    this.defis.set(defi.id, defi);
    const deQui = { id: joueur.id, nom: joueur.perso.nom, niveau: niveauPersonnage(joueur.perso.pointsGagnes) };
    cible.socket.emit('challenge:incoming', { idDefi: defi.id, de: deQui, arene: defi.arene, duree: DUREE_DEFI });
    joueur.socket.emit('challenge:result', { idDefi: defi.id, statut: 'envoye', message: `Défi envoyé à ${cible.perso.nom}…`, duree: DUREE_DEFI });
  }

  fermerDefi(defi, statut, message) {
    if (!this.defis.has(defi.id)) return;
    clearTimeout(defi.minuteur);
    this.defis.delete(defi.id);
    defi.de.socket?.emit('challenge:result', { idDefi: defi.id, statut, message });
    defi.a.socket?.emit('challenge:result', { idDefi: defi.id, statut, message });
  }

  annulerDefi(joueur, idDefi) {
    const defi = this.defis.get(idDefi);
    if (defi && defi.de === joueur) this.fermerDefi(defi, 'annule', `${joueur.perso.nom} a annulé le défi.`);
  }

  repondreDefi(joueur, idDefi, accepte) {
    const defi = this.defis.get(idDefi);
    if (!defi || defi.a !== joueur) return;
    if (!accepte) {
      this.fermerDefi(defi, 'refuse', `${joueur.perso.nom} a refusé le défi.`);
      return;
    }
    if (!defi.de.socket || defi.de.statut !== 'libre' || joueur.statut !== 'libre') {
      this.fermerDefi(defi, 'annule', 'Le combat ne peut plus avoir lieu.');
      return;
    }
    clearTimeout(defi.minuteur);
    this.defis.delete(defi.id);
    this.creerMatch([{ joueur: defi.de }, { joueur }], defi.arene);
  }

  // --------------------------------------------------------------------------
  //  Matchs
  // --------------------------------------------------------------------------
  lancerEntrainement(joueur, arene, difficulte) {
    if (joueur.statut !== 'libre') return;
    const niveau = DIFFICULTES[difficulte] ? difficulte : 'normal';
    for (const d of [...this.defis.values()]) {
      if (d.de === joueur || d.a === joueur) this.fermerDefi(d, 'annule', 'Le défi a été annulé.');
    }
    const adversaire = genererAdversaire(joueur.perso, Math.random, niveau);
    this.creerMatch([{ joueur }, { ia: true, perso: adversaire }], arene, niveau);
  }

  creerMatch(places, arene, difficulte = 'normal') {
    const match = new Match({
      id: nouvelId('m'),
      places,
      arene: ARENES[arene] ? arene : null,
      difficulte,
      surResultat: (joueur, resultat) => this.remettreResultat(joueur, resultat),
      surFin: (m) => {
        this.matchs.delete(m.id);
        this.diffuserLobby();
      },
    });
    this.matchs.set(match.id, match);
    match.demarrer();
    this.diffuserLobby();
    return match;
  }

  remettreResultat(joueur, resultat) {
    if (joueur.socket) {
      joueur.socket.emit('match:end', resultat);
      return;
    }
    // Joueur parti : on garde son résultat pour son retour, puis on l'oublie
    const liste = this.resultats.get(joueur.jeton) || [];
    liste.push(resultat);
    this.resultats.set(joueur.jeton, liste);
    this.joueurs.delete(joueur.jeton);
    // unref : ce minuteur de nettoyage n'empêche pas le serveur de s'arrêter
    setTimeout(() => this.resultats.delete(joueur.jeton), DUREE_RESULTATS).unref?.();
  }
}
