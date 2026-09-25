// ============================================================================
//  ARENA GLADIUS — server/matchs.js
//
//  Un Match relie le moteur de combat (combat.js) au réseau :
//  - envoie l'état complet après chaque action (match:state)
//  - minuteur de 20 s par tour : à expiration, « Se reposer » est joué
//  - fait jouer l'IA (entraînement)
//  - gère les déconnexions : 30 s pour revenir, sinon défaite
//  - calcule les récompenses à la fin (match:end)
// ============================================================================

import { COMBAT, IA } from '../shared/data.js';
import { calculerRecompense } from '../shared/formulas.js';
import { creerCombat, jouerAction, abandonner, vuePublique } from './combat.js';
import { choisirAction } from './ai.js';

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
      deconnecte: false,
      finAttente: null,
    }));
    this.surResultat = surResultat;
    this.surFin = surFin;
    this.etat = creerCombat(this.places.map((p) => p.perso), { arene, ia: this.places.map((p) => p.ia) });
    this.minuteurTour = null;
    this.finTour = null;
    this.tempsRestantPause = null;
    this.minuteurIA = null;
    this.minuteursAttente = [null, null];
    this.termine = false;
  }

  // --------------------------------------------------------------------------
  //  Envois
  // --------------------------------------------------------------------------
  indexDe(joueur) {
    return this.places.findIndex((p) => p.joueur === joueur);
  }

  tempsRestant() {
    if (this.tempsRestantPause != null) return this.tempsRestantPause;
    return this.finTour ? Math.max(0, this.finTour - Date.now()) : null;
  }

  infosAttente() {
    const i = this.places.findIndex((p) => p.deconnecte);
    if (i < 0) return null;
    return { index: i, tempsRestant: Math.max(0, this.places[i].finAttente - Date.now()) };
  }

  paquetEtat(evenement = null) {
    return {
      idMatch: this.id,
      etat: vuePublique(this.etat),
      evenement,
      tempsRestant: this.tempsRestant(),
      attente: this.infosAttente(),
    };
  }

  envoyerDemarrage(place, index) {
    place.joueur.socket?.emit('match:start', {
      ...this.paquetEtat(), monIndex: index, mode: this.modeIA ? 'ia' : 'joueur', difficulte: this.difficulte,
    });
  }

  diffuser(evenement = null) {
    const paquet = this.paquetEtat(evenement);
    for (const p of this.places) if (p.joueur && !p.deconnecte) p.joueur.socket?.emit('match:state', paquet);
  }

  // --------------------------------------------------------------------------
  //  Déroulement
  // --------------------------------------------------------------------------
  demarrer() {
    this.places.forEach((p, i) => {
      if (!p.joueur) return;
      p.joueur.statut = 'combat';
      p.joueur.match = this;
      this.envoyerDemarrage(p, i);
    });
    // Petit délai pour laisser les navigateurs afficher l'arène
    setTimeout(() => this.programmerTour(), 1500);
  }

  arreterMinuteurs() {
    clearTimeout(this.minuteurTour);
    clearTimeout(this.minuteurIA);
    this.minuteurTour = null;
    this.minuteurIA = null;
  }

  programmerTour(dureeMs = COMBAT.dureeTour * 1000) {
    this.arreterMinuteurs();
    if (this.termine || this.etat.fini) return;
    const place = this.places[this.etat.tour];
    if (place.ia) {
      const [min, max] = IA.delaiReflexion;
      const delai = (min + Math.random() * (max - min)) * 1000;
      this.finTour = null;
      this.minuteurIA = setTimeout(() => {
        this.minuteurIA = null;
        // L'IA attend si son adversaire humain est déconnecté (elle rejouera à son retour)
        if (this.places.some((p) => p.deconnecte)) return;
        this.appliquer(this.etat.tour, choisirAction(this.etat, this.etat.tour, Math.random, this.difficulte));
      }, delai);
      return;
    }
    if (place.deconnecte) {
      // En pause : on reprendra quand il reviendra
      this.tempsRestantPause = dureeMs;
      this.finTour = null;
      return;
    }
    this.tempsRestantPause = null;
    this.finTour = Date.now() + dureeMs;
    const index = this.etat.tour;
    this.minuteurTour = setTimeout(() => this.appliquer(index, COMBAT.actionParDefaut, true), dureeMs);
  }

  appliquer(index, actionId, auto = false) {
    if (this.termine || this.etat.fini || this.etat.tour !== index) return { ok: false, erreur: 'Ce n’est pas ton tour.' };
    const r = jouerAction(this.etat, index, actionId);
    if (!r.ok) return r;
    if (auto) r.evenement.auto = true;
    if (this.etat.fini) {
      this.arreterMinuteurs();
      this.finTour = null;
      this.diffuser(r.evenement);
      this.finir();
    } else {
      this.programmerTour();
      this.diffuser(r.evenement);
    }
    return r;
  }

  /** Action demandée par un navigateur */
  action(joueur, actionId) {
    const i = this.indexDe(joueur);
    if (i < 0) return;
    if (typeof actionId !== 'string') return;
    const r = this.appliquer(i, actionId);
    if (!r.ok) joueur.socket?.emit('match:error', { message: r.erreur });
  }

  abandon(joueur, raison = 'abandon') {
    const i = this.indexDe(joueur);
    if (i < 0 || this.termine) return;
    abandonner(this.etat, i, raison);
    this.arreterMinuteurs();
    this.finTour = null;
    this.diffuser({ type: 'fin', acteur: i, action: raison });
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
    // Si c'était son tour, on met le minuteur en pause
    if (this.etat.tour === i && this.minuteurTour) {
      this.tempsRestantPause = Math.max(3000, this.finTour - Date.now());
      clearTimeout(this.minuteurTour);
      this.minuteurTour = null;
      this.finTour = null;
    }
    clearTimeout(this.minuteursAttente[i]);
    this.minuteursAttente[i] = setTimeout(() => this.abandon(joueur, 'deconnexion'), COMBAT.delaiReconnexion * 1000);
    this.diffuser({ type: 'attente', acteur: i });
  }

  reconnexion(joueur) {
    const i = this.indexDe(joueur);
    if (i < 0 || this.termine) return;
    const place = this.places[i];
    place.deconnecte = false;
    place.finAttente = null;
    clearTimeout(this.minuteursAttente[i]);
    this.minuteursAttente[i] = null;
    this.envoyerDemarrage(place, i);
    if (this.etat.tour === i && !this.minuteurTour) this.programmerTour(this.tempsRestantPause ?? COMBAT.dureeTour * 1000);
    else if (this.places[this.etat.tour].ia && !this.minuteurIA) this.programmerTour();
    this.diffuser({ type: 'retour', acteur: i });
  }

  // --------------------------------------------------------------------------
  //  Fin et récompenses
  // --------------------------------------------------------------------------
  finir() {
    if (this.termine) return;
    this.termine = true;
    this.arreterMinuteurs();
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
