// ============================================================================
//  ARENA GLADIUS — shared/formulas.js
//
//  Toutes les formules du jeu (stats, précision, dégâts, économie...).
//  Fonctions PURES : elles ne modifient rien et ne tirent jamais de hasard
//  elles-mêmes — quand il faut de l'aléatoire, on leur passe une fonction
//  `alea` (par défaut Math.random), ce qui permet de les tester facilement.
//  Utilisé par le serveur (qui fait autorité) et par le client (affichage).
// ============================================================================

import {
  ARMES, ARMURES, AMELIORATION, COMMERCE, STATS, ACTIONS,
  PROGRESSION, RECOMPENSES, ORDRE_ATTRIBUTS,
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
    precision: base.precision,
    porteeMin: base.porteeMin,
    porteeMax: base.porteeMax,
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
  return {
    nom: perso.nom,
    attributs: { ...attr },
    niveau: niveauPersonnage(perso.pointsGagnes),
    pvMax: pvMax(attr),
    staminaMax: staminaMax(attr),
    bouclierMax: bouclierMax(attr, equip),
    armure: armureTotale(equip),
    arme: statsArme(equip.arme),
  };
}

// ----------------------------------------------------------------------------
//  Combat : précision, critiques, dégâts
//  `att` et `def` sont des objets renvoyés par statsCombattant()
// ----------------------------------------------------------------------------
/** Portée : l'arme peut-elle frapper à cette distance ? */
export function aPortee(arme, distance) {
  return distance >= arme.porteeMin && distance <= arme.porteeMax;
}

/** (D) Esquive due à la Vitesse : seulement si le défenseur est plus rapide (en %) */
export function esquiveVitesse(att, def) {
  const ecart = def.attributs.vitesse - att.attributs.vitesse;
  return borner(ecart * STATS.vitesseVersEsquive, 0, STATS.esquiveVitesseMax);
}

/** Chance de toucher (en %) pour une attaque donnée */
export function chanceToucher(actionId, att, def) {
  const action = ACTIONS[actionId];
  const chance = action.precision
    + att.arme.precision
    + (att.attributs.agilite - def.attributs.agilite) * STATS.agiliteVersPrecision
    - esquiveVitesse(att, def);
  return borner(Math.round(chance), STATS.precisionMin, STATS.precisionMax);
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

/** Dégâts moyens (sans aléa ni critique) — pour l'affichage et l'IA */
export function degatsEstimes(actionId, att, def, protege = false) {
  const action = ACTIONS[actionId];
  const brut = degatsBase(att) * action.mult;
  let d = brut * (1 - reductionArmure(def, att.arme.ignoreArmure));
  if (protege) d *= 1 - ACTIONS.proteger.reduction;
  return Math.max(STATS.degatsMin, Math.round(d));
}

/**
 * Tire une attaque complète : touche ? critique ? dégâts ?
 * Renvoie { touche, critique, degats, chance }
 */
export function tirerAttaque(actionId, att, def, { protege = false, alea = Math.random } = {}) {
  const chance = chanceToucher(actionId, att, def);
  if (alea() * 100 >= chance) return { touche: false, critique: false, degats: 0, chance };

  const action = ACTIONS[actionId];
  const variation = STATS.aleaMin + alea() * (STATS.aleaMax - STATS.aleaMin);
  let d = degatsBase(att) * action.mult * variation;
  const critique = alea() * 100 < chanceCritique(att);
  if (critique) d *= STATS.multCritique;
  d *= 1 - reductionArmure(def, att.arme.ignoreArmure);
  if (protege) d *= 1 - ACTIONS.proteger.reduction;
  return { touche: true, critique, degats: Math.max(STATS.degatsMin, Math.round(d)), chance };
}

/** Les dégâts touchent d'abord le bouclier, puis les PV */
export function appliquerDegats(degats, bouclier, pv) {
  const absorbe = Math.min(bouclier, degats);
  return { bouclier: bouclier - absorbe, pv: Math.max(0, pv - (degats - absorbe)), absorbe };
}

// ----------------------------------------------------------------------------
//  Coûts et récupération de stamina
// ----------------------------------------------------------------------------
/** Coût en stamina d'une action pour ce combattant (Vitesse, arme) */
export function coutAction(actionId, att) {
  const action = ACTIONS[actionId];
  if (action.type === 'deplacement' || action.type === 'charge') {
    // (D) La Vitesse rend les déplacements moins chers
    const reduc = Math.max(
      STATS.coutDeplacementPlancher,
      1 - (att.attributs.vitesse - 1) * STATS.vitesseReductionDeplacement,
    );
    let cout = Math.round(action.cout * reduc);
    if (action.type === 'charge') cout = Math.round(cout + ACTIONS[action.attaque].cout * (att.arme.coutStamina - 1));
    return Math.max(1, cout);
  }
  if (action.type === 'attaque') return Math.round(action.cout * att.arme.coutStamina);
  return action.cout;
}

/** Stamina regagnée au début de chaque tour du combattant */
export function regenParTour() {
  return STATS.regenStaminaParTour;
}

/** Stamina regagnée avec « Se reposer » */
export function recuperationRepos(att) {
  return Math.round(att.staminaMax * ACTIONS.reposer.recuperation);
}

/** Points de bouclier rechargés avec « Se protéger » */
export function rechargeBouclier(att) {
  return Math.round(att.bouclierMax * ACTIONS.proteger.rechargeBouclier);
}

/** (E) Chance de réussite de « Provoquer » (en %) */
export function chanceProvocation(att, def) {
  const p = ACTIONS.provoquer;
  return borner(p.chanceBase + (att.attributs.agilite - def.attributs.agilite) * p.chanceParAgilite,
    p.chanceMin, p.chanceMax);
}

/** Ordre de jeu : la plus grande Vitesse commence, égalité = hasard. Renvoie 0 ou 1 */
export function premierJoueur(a, b, alea = Math.random) {
  if (a.attributs.vitesse !== b.attributs.vitesse) return a.attributs.vitesse > b.attributs.vitesse ? 0 : 1;
  return alea() < 0.5 ? 0 : 1;
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
