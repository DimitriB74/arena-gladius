// ============================================================================
//  ARENA GLADIUS — client/js/recompenses.js
//  Applique au gladiateur la récompense d'un combat envoyée par le serveur,
//  une seule fois par combat (même si le résultat arrive deux fois).
// ============================================================================

import { appliquerRecompense } from '/shared/boutique.js';
import { lirePerso, appliquer } from './etat.js';

export function appliquerResultat(resultat) {
  const perso = lirePerso();
  if (!perso || !resultat?.idMatch) return null;
  const deja = perso.matchsRecompenses || [];
  if (deja.includes(resultat.idMatch)) return null;
  const r = appliquerRecompense(perso, resultat.mode, resultat.victoire, resultat.ratioPv, resultat.difficulte || 'normal');
  if (!r.ok) return null;
  r.perso.matchsRecompenses = [...deja, resultat.idMatch].slice(-30);
  appliquer(r);
  return r.recompense;
}
