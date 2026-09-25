// ============================================================================
//  ARENA GLADIUS — client/js/combat/session.js
//
//  Le combat vu du navigateur, en temps réel.
//
//  - PRÉDICTION : ton gladiateur réagit tout de suite à tes touches, avec les
//    mêmes règles que le serveur (shared/combat.js), sans attendre le réseau.
//  - CORRECTION : quand l'état du serveur arrive, on repart de sa version
//    (c'est lui qui a raison) et on rejoue les touches qu'il n'a pas encore
//    traitées. Un petit écart restant est rattrapé en douceur à l'affichage.
//  - INTERPOLATION : l'adversaire est affiché avec 0,1 s de retard, en glissant
//    entre deux états reçus : son mouvement reste fluide malgré le réseau.
// ============================================================================

import { TEMPS_REEL as T } from '/shared/data.js';
import {
  etapeCombattant, combattantDepuis, appliquerDynamique, ENTREE_VIDE,
} from '/shared/combat.js';
import { terrainDe } from '/shared/terrain.js';

const DT = 1 / T.frequence;
const TOUCHES = ['g', 'd', 'b', 'p', 'saut', 'legere', 'lourde', 'esquive'];

export class SessionCombat {
  /** @param depart paquet match:start */
  constructor(depart) {
    this.idMatch = depart.idMatch;
    this.monIndex = depart.monIndex;
    this.mode = depart.mode;
    this.difficulte = depart.difficulte;
    this.arene = depart.arene;
    this.terrain = terrainDe(depart.arene);
    this.presentations = depart.presentations;
    this.dernier = depart.etat;
    this.moi = combattantDepuis(this.presentations[this.monIndex], depart.etat.c[this.monIndex]);
    this.historique = [{ t: performance.now(), etat: depart.etat }];
    this.enAttente = [];            // touches envoyées, pas encore traitées par le serveur
    this.seq = 0;
    this.accumulateur = 0;
    this.correction = { x: 0, y: 0 };
  }

  get phase() { return this.dernier.phase; }
  get enPause() { return !!this.dernier.pause; }

  /** Nouvel état du serveur */
  recevoir(etat) {
    if (etat.idMatch !== this.idMatch) return;
    this.dernier = etat;
    this.historique.push({ t: performance.now(), etat });
    while (this.historique.length > 2 && performance.now() - this.historique[1].t > 1000) this.historique.shift();

    // On repart de la version du serveur, puis on rejoue ce qu'il n'a pas encore vu
    const avant = { x: this.moi.x, y: this.moi.y };
    appliquerDynamique(this.moi, etat.c[this.monIndex]);
    this.enAttente = this.enAttente.filter((e) => e.s > etat.ack);
    const enCombat = etat.phase === 'combat' && !etat.pause;
    for (const e of this.enAttente) etapeCombattant(this.moi, enCombat ? e : ENTREE_VIDE, DT, this.terrain);

    // Petit écart : on le lisse à l'affichage ; grand écart : on se recale d'un coup
    const ex = avant.x - this.moi.x, ey = avant.y - this.moi.y;
    if (Math.hypot(ex, ey) < 90) {
      this.correction.x += ex;
      this.correction.y += ey;
    } else {
      this.correction.x = 0;
      this.correction.y = 0;
    }
  }

  /**
   * Fait avancer ta prédiction au rythme de la simulation (60 pas/s) et
   * renvoie les touches à envoyer au serveur.
   */
  avancer(dtReel, lireEntree) {
    this.accumulateur = Math.min(0.25, this.accumulateur + dtReel);
    const lot = [];
    const enCombat = this.phase === 'combat' && !this.enPause && !this.dernier.fini;
    while (this.accumulateur >= DT) {
      this.accumulateur -= DT;
      const e = lireEntree();
      if (!this.enPause && !this.dernier.fini) {
        e.s = ++this.seq;
        this.enAttente.push(e);
        const envoi = { s: e.s };
        for (const k of TOUCHES) if (e[k]) envoi[k] = 1;
        lot.push(envoi);
      }
      etapeCombattant(this.moi, enCombat ? e : ENTREE_VIDE, DT, this.terrain);
    }
    // Garde-fou : si le serveur ne répond plus, on ne garde pas des milliers de touches
    if (this.enAttente.length > 240) this.enAttente.splice(0, this.enAttente.length - 240);
    // L'écart de correction fond en ~0,1 s
    const f = Math.exp(-dtReel * 14);
    this.correction.x *= f;
    this.correction.y *= f;
    return lot;
  }

  /** Ton gladiateur tel qu'il doit être dessiné */
  moiAffiche() {
    return { ...this.moi, x: this.moi.x + this.correction.x, y: this.moi.y + this.correction.y };
  }

  /** L'adversaire, affiché légèrement dans le passé et interpolé */
  adversaireAffiche(maintenant = performance.now()) {
    const i = 1 - this.monIndex;
    const cible = maintenant - T.interpolation * 1000;
    const h = this.historique;
    let a = h[0], b = h[h.length - 1];
    for (let k = h.length - 1; k >= 0; k--) {
      if (h[k].t <= cible) { a = h[k]; b = h[Math.min(k + 1, h.length - 1)]; break; }
    }
    const ca = a.etat.c[i], cb = b.etat.c[i];
    const duree = b.t - a.t;
    const r = duree > 0 ? Math.max(0, Math.min(1, (cible - a.t) / duree)) : 1;
    const base = r < 0.5 ? ca : cb;
    const ecoule = Math.max(0, (cible - (r < 0.5 ? a.t : b.t)) / 1000);
    return {
      ...this.presentations[i],
      ...base,
      x: ca.x + (cb.x - ca.x) * r,
      y: ca.y + (cb.y - ca.y) * r,
      // Avance l'animation d'attaque entre deux états reçus
      attaque: base.attaque ? { ...base.attaque, t: base.attaque.t + ecoule } : null,
    };
  }

  /** Infos de l'adversaire pour les barres (état le plus récent) */
  adversaireActuel() {
    return { ...this.presentations[1 - this.monIndex], ...this.dernier.c[1 - this.monIndex] };
  }
}
