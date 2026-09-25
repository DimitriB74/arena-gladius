// ============================================================================
//  ARENA GLADIUS — client/js/etat.js
//
//  Le gladiateur en cours. Chaque modification est sauvegardée
//  automatiquement et signalée aux abonnés (HUD, écrans...).
// ============================================================================

import { ecrireSauvegarde } from './sauvegarde.js';

let perso = null;
const abonnes = new Set();

export const lirePerso = () => perso;

export function definirPerso(nouveau, { sauver = true } = {}) {
  const ancien = perso;
  perso = nouveau;
  if (sauver && perso) ecrireSauvegarde(perso);
  abonnes.forEach((f) => f(perso, ancien));
}

/** S'abonne aux changements ; renvoie une fonction de désabonnement */
export function surChangement(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/**
 * Applique le résultat d'une opération de shared/boutique.js :
 * si elle a réussi, le nouveau personnage devient l'état courant.
 */
export function appliquer(resultat) {
  if (resultat.ok) definirPerso(resultat.perso);
  return resultat;
}
