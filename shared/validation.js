// ============================================================================
//  ARENA GLADIUS — shared/validation.js
//
//  Modèle du personnage (création) et vérification de cohérence.
//  Le serveur appelle validerPersonnage() avant chaque combat : la sauvegarde
//  vit dans le navigateur, on vérifie donc qu'elle reste plausible.
//  (I) C'est un garde-fou contre les sauvegardes abîmées et la triche
//  grossière, pas une vraie sécurité (suffisant pour jouer entre amis).
// ============================================================================

import {
  JEU, CREATION, SKINS, ORDRE_ATTRIBUTS, ARMES, ARMURES, ORDRE_EMPLACEMENTS,
  AMELIORATION, RECOMPENSES,
} from './data.js';
import { totalPointsAttributs, valeurEquipement } from './formulas.js';

const EMPLACEMENTS_EQUIPEMENT = ['arme', ...ORDRE_EMPLACEMENTS];

/** Nettoie un nom saisi : espaces superflus, caractères de contrôle */
export function nettoyerNom(nom) {
  return String(nom ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
}

/** Renvoie un message d'erreur, ou null si le nom est valide */
export function erreurNom(nom) {
  const n = nettoyerNom(nom);
  if (n.length < CREATION.nomMin) return `Le nom doit faire au moins ${CREATION.nomMin} caractères.`;
  if (n.length > CREATION.nomMax) return `Le nom doit faire au plus ${CREATION.nomMax} caractères.`;
  return null;
}

/** Attributs de départ (tous à 1) */
export function attributsDeBase() {
  const a = {};
  for (const id of ORDRE_ATTRIBUTS) a[id] = CREATION.valeurDepart;
  return a;
}

/** Fabrique un nouveau personnage à partir des choix de l'écran de création */
export function nouveauPersonnage({ nom, skin, attributs }) {
  return {
    version: JEU.versionSauvegarde,
    nom: nettoyerNom(nom),
    skin: { ...skin },
    attributs: { ...attributs },
    pointsLibres: 0,
    pointsGagnes: 0,
    credits: CREATION.creditsDepart,
    equipement: {
      arme: { id: CREATION.armeDepart, niveau: 0, offert: true },
      casque: null, plastron: null, jambieres: null, bouclier: null,
    },
    stats: { victoires: 0, defaites: 0, victoiresIA: 0, defaitesIA: 0 },
    creeLe: Date.now(),
  };
}

const estEntier = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** Plus grande récompense possible contre un bot, toutes difficultés confondues */
function maxBot(issue, valeur) {
  return Math.max(...Object.values(RECOMPENSES.ia).map((b) => valeur(b[issue])));
}

/**
 * Vérifie qu'un personnage est cohérent.
 * Renvoie { ok: boolean, erreurs: string[] }
 */
export function validerPersonnage(p) {
  const erreurs = [];
  if (!p || typeof p !== 'object') return { ok: false, erreurs: ['Personnage absent.'] };

  const eNom = erreurNom(p.nom);
  if (eNom) erreurs.push(eNom);

  // Apparence
  const skin = p.skin || {};
  for (const cat of ['peau', 'coiffure', 'cheveux', 'tunique']) {
    if (!SKINS[cat].some((o) => o.id === skin[cat])) erreurs.push(`Apparence invalide (${cat}).`);
  }

  // Compteurs de combats
  const s = p.stats || {};
  for (const c of ['victoires', 'defaites', 'victoiresIA', 'defaitesIA']) {
    if (!estEntier(s[c], 0, 1e6)) erreurs.push(`Compteur de combats invalide (${c}).`);
  }

  // Attributs et points
  const attr = p.attributs || {};
  for (const a of ORDRE_ATTRIBUTS) {
    if (!estEntier(attr[a], CREATION.valeurDepart, CREATION.valeurMaxAttribut)) {
      erreurs.push(`Attribut invalide : ${a}.`);
    }
  }
  if (!estEntier(p.pointsLibres, 0, 1e6)) erreurs.push('Points libres invalides.');
  if (!estEntier(p.pointsGagnes, 0, 1e6)) erreurs.push('Points gagnés invalides.');
  if (erreurs.length === 0) {
    const attendu = ORDRE_ATTRIBUTS.length * CREATION.valeurDepart + CREATION.pointsARepartir + p.pointsGagnes;
    if (totalPointsAttributs(attr) + p.pointsLibres !== attendu) {
      erreurs.push('Le total des points d’attributs ne correspond pas.');
    }
    // Points gagnés possibles au maximum vu le nombre de combats
    const maxPoints =
      s.victoires * RECOMPENSES.joueur.victoire.points + s.defaites * RECOMPENSES.joueur.defaite.points +
      s.victoiresIA * maxBot('victoire', (r) => r.points) + s.defaitesIA * maxBot('defaite', (r) => r.points);
    if (p.pointsGagnes > maxPoints) erreurs.push('Trop de points gagnés pour le nombre de combats.');
  }

  // Équipement
  const equip = p.equipement || {};
  for (const slot of EMPLACEMENTS_EQUIPEMENT) {
    const o = equip[slot];
    if (o == null) continue;
    const base = slot === 'arme' ? ARMES[o.id] : ARMURES[o.id];
    if (!base || (slot !== 'arme' && base.emplacement !== slot) || o.id === 'poings') {
      erreurs.push(`Objet inconnu sur l’emplacement ${slot}.`);
      continue;
    }
    if (!estEntier(o.niveau, 0, AMELIORATION.niveauMax)) erreurs.push(`Niveau d’amélioration invalide (${slot}).`);
    if (o.offert && o.id !== CREATION.armeDepart) erreurs.push('Objet offert invalide.');
  }

  // Crédits + valeur de l'équipement ≤ tout ce qui a pu être gagné
  if (!estEntier(p.credits, 0, 1e9)) erreurs.push('Crédits invalides.');
  else if (erreurs.length === 0) {
    const gainMax = (r) => r.credits + r.bonusPvMax;
    const richesseMax = CREATION.creditsDepart + ARMES[CREATION.armeDepart].prix
      + s.victoires * gainMax(RECOMPENSES.joueur.victoire) + s.defaites * gainMax(RECOMPENSES.joueur.defaite)
      + s.victoiresIA * maxBot('victoire', gainMax) + s.defaitesIA * maxBot('defaite', gainMax);
    if (p.credits + valeurEquipement(equip) > richesseMax) erreurs.push('Fortune impossible pour le nombre de combats.');
  }

  return { ok: erreurs.length === 0, erreurs };
}
