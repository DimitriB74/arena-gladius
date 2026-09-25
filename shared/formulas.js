// ============================================================================
//  ARENA GLADIUS — shared/formulas.js
//
//  Toutes les formules du jeu (stats, combat en temps réel, dégâts, économie...).
//  Fonctions PURES : elles ne modifient rien et ne tirent jamais de hasard
//  elles-mêmes — quand il faut de l'aléatoire, on leur passe une fonction
//  `alea` (par défaut Math.random), ce qui permet de les tester facilement.
//  Utilisé par le serveur (qui fait autorité) et par le client (affichage).
// ============================================================================

import {
  ARMES, ARMURES, AMELIORATION, COMMERCE, STATS, TEMPS_REEL,
  PROGRESSION, RECOMPENSES, ORDRE_ATTRIBUTS, CREATION,
} from './data.js';

// ----------------------------------------------------------------------------
//  Petits outils
// ----------------------------------------------------------------------------
export const borner = (v, min, max) => Math.max(min, Math.min(max, v));
export const arrondi1 = (v) => Math.round(v * 10) / 10;

// ----------------------------------------------------------------------------
//  Objets : catalogue, améliorations, prix
//  Un objet possédé a la forme { id, niveau, offert? }
// ----------------------------------------------------------------------------
export function catalogue(id) {
  return ARMES[id] || ARMURES[id] || null;
}

/** Multiplicateur des stats d'un objet selon son niveau d'amélioration (+0 à +5) */
export function multAmelioration(niveau = 0) {
  return 1 + AMELIORATION.bonusParNiveau * niveau;
}

/** Coût pour passer un objet au niveau `niveauVise` */
export function coutAmelioration(prixBase, niveauVise) {
  return Math.round(prixBase * AMELIORATION.coutFacteur * niveauVise);
}

/** Total dépensé dans un objet (achat + toutes ses améliorations) */
export function totalInvesti(objet) {
  if (!objet) return 0;
  const base = catalogue(objet.id);
  if (!base) return 0;
  let total = objet.offert ? 0 : base.prix;
  for (let n = 1; n <= (objet.niveau || 0); n++) total += coutAmelioration(base.prix, n);
  return total;
}

/** Valeur « marchande » d'un objet (comme s'il avait été acheté), pour l'IA */
export function valeurObjet(objet) {
  if (!objet) return 0;
  return totalInvesti({ ...objet, offert: false });
}

/** Prix de revente : 50 % du total investi */
export function prixRevente(objet) {
  if (!objet) return 0;
  const base = catalogue(objet.id);
  if (!base || base.vendable === false) return 0;
  return Math.floor(totalInvesti(objet) * COMMERCE.tauxRevente);
}

// ----------------------------------------------------------------------------
//  Stats des objets équipés
// ----------------------------------------------------------------------------
/** Stats effectives de l'arme (poings si aucune arme) */
export function statsArme(objet) {
  const id = objet && ARMES[objet.id] ? objet.id : 'poings';
  const base = ARMES[id];
  const niveau = id === 'poings' ? 0 : (objet.niveau || 0);
  return {
    id,
    nom: base.nom,
    niveau,
    degats: arrondi1(base.degats * multAmelioration(niveau)),
    cadence: base.cadence,
    allonge: base.allonge,
    ignoreArmure: base.ignoreArmure,
    coutStamina: base.coutStamina,
  };
}

/** Valeur effective d'une pièce d'armure (armure ou points de bouclier) */
export function valeurArmure(objet) {
  if (!objet || !ARMURES[objet.id]) return 0;
  return arrondi1(ARMURES[objet.id].valeur * multAmelioration(objet.niveau || 0));
}

/** Armure totale portée (casque + plastron + jambières) */
export function armureTotale(equipement = {}) {
  return arrondi1(
    valeurArmure(equipement.casque) + valeurArmure(equipement.plastron) + valeurArmure(equipement.jambieres),
  );
}

// ----------------------------------------------------------------------------
//  Stats du gladiateur
// ----------------------------------------------------------------------------
export const pvMax = (attr) => STATS.pvBase + attr.vitalite * STATS.pvParVitalite;
export const staminaMax = (attr) => STATS.staminaBase + attr.endurance * STATS.staminaParEndurance;
export const bouclierMax = (attr, equipement = {}) =>
  Math.round(valeurArmure(equipement.bouclier) + attr.defense * STATS.bouclierParDefense);

export function totalPointsAttributs(attr) {
  return ORDRE_ATTRIBUTS.reduce((s, a) => s + (attr[a] || 0), 0);
}

/** Points placés dans les attributs (au-delà de la valeur de départ de chacun) */
export function pointsInvestis(attr) {
  return totalPointsAttributs(attr) - ORDRE_ATTRIBUTS.length * CREATION.valeurDepart;
}

/** Prix d'une réinitialisation des points de compétence (0 s'il n'y a rien à rendre) */
export function coutReinitialisation(attr) {
  const n = pointsInvestis(attr);
  if (n <= 0) return 0;
  const { coutParPoint, coutMinimum } = PROGRESSION.reinitialisation;
  return Math.max(coutMinimum, n * coutParPoint);
}

/** (G) Niveau du gladiateur d'après ses points de capacité gagnés */
export function niveauPersonnage(pointsGagnes = 0) {
  return 1 + Math.floor(pointsGagnes / PROGRESSION.pointsParNiveau);
}

/** Valeur marchande de tout l'équipement */
export function valeurEquipement(equipement = {}) {
  return Object.values(equipement).reduce((s, o) => s + valeurObjet(o), 0);
}

/** Toutes les stats utiles au combat, calculées depuis un personnage */
export function statsCombattant(perso) {
  const attr = perso.attributs;
  const equip = perso.equipement || {};
  const s = {
    nom: perso.nom,
    attributs: { ...attr },
    niveau: niveauPersonnage(perso.pointsGagnes),
    pvMax: pvMax(attr),
    staminaMax: staminaMax(attr),
    bouclierMax: bouclierMax(attr, equip),
    armure: armureTotale(equip),
    arme: statsArme(equip.arme),
  };
  s.tr = statsTempsReel(s);
  return s;
}

// ----------------------------------------------------------------------------
//  Combat en temps réel : ce que les attributs changent
// ----------------------------------------------------------------------------
/**
 * Vitesse → course et saut ; Agilité + arme → cadence des attaques ;
 * Endurance → stamina qui remonte ; Défense + bouclier → garde.
 */
export function statsTempsReel(s) {
  const { deplacement, saut, cadence, stamina, parade, attaques, allonges } = TEMPS_REEL;
  const a = s.attributs;
  const multCourse = Math.min(deplacement.multMax, 1 + a.vitesse * deplacement.parPointVitesse);
  const multSaut = Math.min(saut.multMax, 1 + a.vitesse * saut.parPointVitesse);
  const multCadence = borner(
    (1 + a.agilite * cadence.parPointAgilite) * (1 + (s.arme.cadence || 0) / 100),
    cadence.multMin, cadence.multMax,
  );
  return {
    vitesse: Math.round(deplacement.vitesseBase * multCourse),
    impulsionSaut: Math.round(saut.impulsionBase * multSaut),
    cadence: arrondi1(multCadence * 100) / 100,
    allonge: allonges[s.arme.allonge] || allonges[1],
    regenStamina: arrondi1(stamina.regenBase + a.endurance * stamina.regenParEndurance),
    gardeMax: Math.round(parade.gardeBase + s.bouclierMax * parade.gardeParBouclier),
    coutLourde: Math.round(attaques.lourde.cout * s.arme.coutStamina),
  };
}

/** Durée (s) d'une phase d'attaque, raccourcie par la cadence */
export function dureePhase(typeAttaque, phase, att) {
  return TEMPS_REEL.attaques[typeAttaque][phase] / att.tr.cadence;
}

/** Chance de coup critique (en %) */
export function chanceCritique(att) {
  return arrondi1(Math.min(STATS.critiqueMax, STATS.critiqueBase + att.attributs.agilite * STATS.critiqueParAgilite));
}

/** (B) Réduction des dégâts due à l'armure, en fraction (0 à 0,75) */
export function reductionArmure(def, ignoreArmure = 0) {
  const a = (def.armure + def.attributs.defense) * (1 - ignoreArmure);
  return Math.min(STATS.reductionMax, a / (a + STATS.armureConstante));
}

/** Dégâts de base d'un coup normal : arme + Force × 3 */
export function degatsBase(att) {
  return arrondi1(att.arme.degats + att.attributs.force * STATS.forceVersDegats);
}

/**
 * Dégâts d'une attaque ('legere' | 'lourde') de `att` sur `def`.
 * options : alea (hasard ±10 %), critique (×1,5), pare (garde levée)
 */
export function degatsCoup(typeAttaque, att, def, { alea = null, critique = false } = {}) {
  const variation = alea ? STATS.aleaMin + alea() * (STATS.aleaMax - STATS.aleaMin) : 1;
  let d = degatsBase(att) * TEMPS_REEL.attaques[typeAttaque].mult * variation;
  if (critique) d *= STATS.multCritique;
  d *= 1 - reductionArmure(def, att.arme.ignoreArmure);
  return Math.max(STATS.degatsMin, Math.round(d));
}

// ----------------------------------------------------------------------------
//  Récompenses
// ----------------------------------------------------------------------------
/**
 * @param mode 'joueur' | 'ia'
 * @param victoire boolean
 * @param ratioPv PV restants / PV max du joueur (0 à 1)
 * @param difficulte 'facile' | 'normal' | 'difficile' (combats contre un bot)
 */
export function calculerRecompense(mode, victoire, ratioPv = 0, difficulte = 'normal') {
  const bareme = mode === 'ia' ? (RECOMPENSES.ia[difficulte] || RECOMPENSES.ia.normal) : RECOMPENSES.joueur;
  const r = bareme[victoire ? 'victoire' : 'defaite'];
  const bonus = Math.round(r.bonusPvMax * borner(ratioPv, 0, 1));
  return { credits: r.credits + bonus, bonus, points: r.points };
}
