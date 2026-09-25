// ============================================================================
//  ARENA GLADIUS — server/matchs.js
//
//  Un Match fait tourner un combat EN TEMPS RÉEL sur le serveur :
//  - simulation à 60 pas par seconde (shared/combat.js), le serveur fait autorité
//  - les navigateurs envoient seulement leurs touches (match:entrees), numérotées
//  - l'état est renvoyé 30 fois par seconde (match:state), avec le numéro de la
//    dernière entrée traitée : le navigateur s'en sert pour corriger sa prédiction
//  - les bots appuient sur leurs touches à chaque pas (server/ai.js)
//  - déconnexion : combat en pause, 30 s pour revenir, sinon défaite
//  - récompenses calculées à la fin (match:end)
// ============================================================================

import { COMBAT, TEMPS_REEL as T } from '../shared/data.js';
import { calculerRecompense } from '../shared/formulas.js';
import { creerMatch, etapeMatch, abandonner, dynamique, presentation } from '../shared/combat.js';
import { creerCerveau, entreeBot } from './ai.js';

const DT = 1 / T.frequence;
const PAS_PAR_ENVOI = Math.max(1, Math.round(T.frequence / T.envoisParSeconde));
const FILE_MAX = 6;             // au-delà, on rattrape le retard d'un navigateur
const ENTREES_PAR_MESSAGE = 12; // garde-fou contre les messages trop gros
const DUREE_APRES_KO = 1.6;     // on laisse la chute se jouer avant les résultats
const TOUCHES_TENUES = ['g', 'd', 'b', 'p'];
const TOUCHES_PRESSEES = ['saut', 'legere', 'lourde', 'esquive'];

const entreeRelachee = () => ({ g: false, d: false, b: false, p: false, saut: false, legere: false, lourde: false, esquive: false });

export class Match {
  /**
   * @param places  [{ joueur }, { joueur } | { ia: true, perso }]
   * @param difficulte difficulté du bot ('facile' | 'normal' | 'difficile')
   * @param surResultat(joueur, resultat) appelé pour chaque joueur humain à la fin
   * @param surFin(match)                  appelé une fois le match terminé
   */
  constructor({ id, places, arene, difficulte = 'normal', surResultat, surFin }) {
    this.id = id;
    this.modeIA = places.some((p) => p.ia);
    this.difficulte = this.modeIA ? difficulte : null;
    this.places = places.map((p) => ({
      joueur: p.joueur || null,
      ia: !!p.ia,
      perso: p.ia ? p.perso : p.joueur.perso,
      cerveau: p.ia ? creerCerveau(difficulte) : null,
      deconnecte: false,
      finAttente: null,
      file: [],                 // entrées reçues, pas encore jouées
      tenues: entreeRelachee(), // dernières touches tenues connues
      ack: 0,                   // numéro de la dernière entrée jouée
      dernierRecu: 0,
    }));
    this.surResultat = surResultat;
    this.surFin = surFin;
    this.etat = creerMatch(this.places.map((p) => p.perso), { arene, ia: this.places.map((p) => p.ia) });
    this.boucle = null;
    this.derniere = 0;
    this.accumulateur = 0;
    this.pasDepuisEnvoi = 0;
    this.pause = false;
    this.apresFin = 0;
    this.minuteursAttente = [null, null];
    this.termine = false;
  }

  // --------------------------------------------------------------------------
  //  Envois
  // --------------------------------------------------------------------------
  indexDe(joueur) {
    return this.places.findIndex((p) => p.joueur === joueur);
  }

  infosAttente() {
    const i = this.places.findIndex((p) => p.deconnecte);
    if (i < 0) return null;
    return { index: i, tempsRestant: Math.max(0, this.places[i].finAttente - Date.now()) };
  }

  paquetEtat(i, evenements = []) {
    const e = this.etat;
    return {
      idMatch: this.id,
      n: e.numero,
      phase: e.phase,
      decompte: Math.round(e.decompte * 100) / 100,
      tempsRestant: Math.round(e.tempsRestant * 100) / 100,
      ack: this.places[i]?.ack || 0,
      c: e.combattants.map(dynamique),
      ev: evenements,
      pause: this.pause,
      attente: this.infosAttente(),
      fini: e.fini,
      vainqueur: e.vainqueur,
      raison: e.raison,
    };
  }

  envoyerDepart(place, i) {
    place.joueur.socket?.emit('match:start', {
      idMatch: this.id,
      monIndex: i,
      mode: this.modeIA ? 'ia' : 'joueur',
      difficulte: this.difficulte,
      arene: this.etat.arene,
      presentations: this.etat.combattants.map(presentation),
      etat: this.paquetEtat(i),
    });
  }

  diffuser() {
    const evenements = this.etat.evenements.splice(0);
    this.places.forEach((p, i) => {
      if (p.joueur && !p.deconnecte) p.joueur.socket?.emit('match:state', this.paquetEtat(i, evenements));
    });
    this.pasDepuisEnvoi = 0;
  }

  // --------------------------------------------------------------------------
  //  Boucle de simulation
  // --------------------------------------------------------------------------
  demarrer() {
    this.places.forEach((p, i) => {
      if (!p.joueur) return;
      p.joueur.statut = 'combat';
      p.joueur.match = this;
      this.envoyerDepart(p, i);
    });
    this.derniere = performance.now();
    this.boucle = setInterval(() => this.tic(), 1000 / T.frequence);
  }

  tic() {
    const maintenant = performance.now();
    this.accumulateur += Math.min(0.1, (maintenant - this.derniere) / 1000);
    this.derniere = maintenant;
    while (this.accumulateur >= DT && !this.termine) {
      this.accumulateur -= DT;
      this.pas();
    }
  }

  /** Prochaine entrée d'un joueur humain (dans l'ordre où il les a envoyées) */
  prochaineEntree(place) {
    // Trop d'avance accumulée (réseau saccadé) : on fusionne pour rattraper
    while (place.file.length > FILE_MAX) {
      const retiree = place.file.shift();
      for (const k of TOUCHES_PRESSEES) if (retiree[k]) place.file[0][k] = true;
    }
    const e = place.file.shift();
    if (!e) return { ...place.tenues, saut: false, legere: false, lourde: false, esquive: false };
    place.ack = e.s;
    for (const k of TOUCHES_TENUES) place.tenues[k] = e[k];
    return e;
  }

  pas() {
    if (this.pause) return;
    const entrees = this.places.map((p, i) => (p.ia ? entreeBot(p.cerveau, this.etat, i, DT) : this.prochaineEntree(p)));
    etapeMatch(this.etat, entrees, DT);
    this.pasDepuisEnvoi += 1;
    if (this.etat.evenements.some((ev) => ev.type === 'fin')) this.diffuser();
    else if (this.pasDepuisEnvoi >= PAS_PAR_ENVOI) this.diffuser();
    if (this.etat.fini) {
      this.apresFin += DT;
      if (this.apresFin >= DUREE_APRES_KO) this.finir();
    }
  }

  // --------------------------------------------------------------------------
  //  Ce qu'envoient les navigateurs
  // --------------------------------------------------------------------------
  /** Touches d'un joueur : { e: [{ s, g, d, b, p, saut, legere, lourde, esquive }, ...] } */
  recevoirEntrees(joueur, lot) {
    const i = this.indexDe(joueur);
    if (i < 0 || this.termine || !lot || !Array.isArray(lot.e)) return;
    const place = this.places[i];
    for (const brute of lot.e.slice(0, ENTREES_PAR_MESSAGE)) {
      const s = Number(brute?.s);
      if (!Number.isInteger(s) || s <= place.dernierRecu) continue;
      place.dernierRecu = s;
      const e = { s };
      for (const k of [...TOUCHES_TENUES, ...TOUCHES_PRESSEES]) e[k] = brute[k] === true || brute[k] === 1;
      place.file.push(e);
    }
  }

  abandon(joueur, raison = 'abandon') {
    const i = this.indexDe(joueur);
    if (i < 0 || this.termine || this.etat.fini) return;
    abandonner(this.etat, i, raison);
    this.pause = false;
    this.diffuser();
    this.finir();
  }

  // --------------------------------------------------------------------------
  //  Déconnexion / reconnexion
  // --------------------------------------------------------------------------
  deconnexion(joueur) {
    const i = this.indexDe(joueur);
    if (i < 0 || this.termine) return;
    const place = this.places[i];
    place.deconnecte = true;
    place.finAttente = Date.now() + COMBAT.delaiReconnexion * 1000;
    place.file = [];
    place.tenues = entreeRelachee();
    this.pause = true;
    clearTimeout(this.minuteursAttente[i]);
    this.minuteursAttente[i] = setTimeout(() => this.abandon(joueur, 'deconnexion'), COMBAT.delaiReconnexion * 1000);
    this.diffuser();
  }

  reconnexion(joueur) {
    const i = this.indexDe(joueur);
    if (i < 0 || this.termine) return;
    const place = this.places[i];
    place.deconnecte = false;
    place.finAttente = null;
    place.file = [];
    place.dernierRecu = 0;
    place.ack = 0;
    clearTimeout(this.minuteursAttente[i]);
    this.minuteursAttente[i] = null;
    if (!this.places.some((p) => p.deconnecte)) {
      this.pause = false;
      // Petit décompte avant de reprendre, pour que chacun se remette en place
      if (this.etat.phase === 'combat') {
        this.etat.phase = 'decompte';
        this.etat.decompte = T.decompte;
      }
      this.derniere = performance.now();
    }
    this.envoyerDepart(place, i);
    this.diffuser();
  }

  // --------------------------------------------------------------------------
  //  Fin et récompenses
  // --------------------------------------------------------------------------
  finir() {
    if (this.termine) return;
    this.termine = true;
    clearInterval(this.boucle);
    this.minuteursAttente.forEach(clearTimeout);
    const mode = this.modeIA ? 'ia' : 'joueur';
    this.places.forEach((p, i) => {
      if (!p.joueur) return;
      const c = this.etat.combattants[i];
      const victoire = this.etat.vainqueur === i;
      const ratioPv = c.pv / c.stats.pvMax;
      const resultat = {
        idMatch: this.id,
        monIndex: i,
        mode,
        difficulte: this.difficulte,
        victoire,
        ratioPv,
        raison: this.etat.raison,
        adversaire: this.etat.combattants[1 - i].nom,
        adversaireId: this.places[1 - i].joueur?.id || null,   // pour proposer une revanche
        recompense: calculerRecompense(mode, victoire, ratioPv, this.difficulte),
        compteurs: c.compteurs,
      };
      p.joueur.statut = 'libre';
      p.joueur.match = null;
      this.surResultat?.(p.joueur, resultat);
    });
    this.surFin?.(this);
  }
}
