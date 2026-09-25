// ============================================================================
//  ARENA GLADIUS — server/ai.js
//
//  Bots (adversaires contrôlés par l'ordinateur), 3 difficultés :
//  - genererAdversaire(perso, alea, difficulte) : un gladiateur adapté au
//    joueur (plus faible en Facile, plus fort en Difficile)
//  - choisirAction(etat, i, alea, difficulte)   : décide de l'action à jouer
//
//  Les réglages de chaque difficulté sont dans shared/data.js (DIFFICULTES).
// ============================================================================

import {
  IA, DIFFICULTES, SKINS, ORDRE_ATTRIBUTS, CREATION, ARMES, ARMURES, ORDRE_EMPLACEMENTS, ORDRE_MATERIAUX,
  JEU, AMELIORATION, ACTIONS,
} from '../shared/data.js';
import {
  totalPointsAttributs, valeurEquipement, chanceToucher, degatsEstimes, coutAmelioration, coutAction,
  aPortee, regenParTour,
} from '../shared/formulas.js';
import { actionsPossibles, distance } from './combat.js';

const auHasard = (liste, alea) => liste[Math.floor(alea() * liste.length)];
const reglages = (difficulte) => DIFFICULTES[difficulte] || DIFFICULTES.normal;

// Styles de combat : poids de chaque attribut et armes préférées
const STYLES = {
  brute:     { poids: { force: 4, vitalite: 3, defense: 1, endurance: 1.5, agilite: 1, vitesse: 0.5 }, armes: ['marteau', 'hache', 'masse', 'glaive'] },
  agile:     { poids: { agilite: 4, vitesse: 3, force: 2, endurance: 1, vitalite: 1, defense: 0.5 }, armes: ['trident', 'lance', 'glaive', 'dague'] },
  tank:      { poids: { defense: 3, vitalite: 4, endurance: 2, force: 2, agilite: 0.5, vitesse: 0.5 }, armes: ['masse', 'glaive', 'hache', 'dague'] },
  equilibre: { poids: { force: 2, agilite: 2, defense: 2, vitalite: 2, endurance: 1.5, vitesse: 1.5 }, armes: ['glaive', 'trident', 'masse', 'lance'] },
};

function tirerPondere(poids, alea) {
  const total = Object.values(poids).reduce((s, v) => s + v, 0);
  let r = alea() * total;
  for (const [cle, v] of Object.entries(poids)) {
    r -= v;
    if (r <= 0) return cle;
  }
  return Object.keys(poids)[0];
}

// ----------------------------------------------------------------------------
//  Génération du bot
// ----------------------------------------------------------------------------
export function genererAdversaire(perso, alea = Math.random, difficulte = 'normal') {
  const d = reglages(difficulte);
  const styleId = auHasard(Object.keys(STYLES), alea);
  const style = STYLES[styleId];

  // Attributs : total du joueur × la difficulté (± un peu de hasard)
  const base = ORDRE_ATTRIBUTS.length * CREATION.valeurDepart;
  const minimumJoueur = base + CREATION.pointsARepartir;
  const minimum = base + 6;   // un bot Facile peut être sous le niveau 1
  const ecart = Math.round((alea() * 2 - 1) * IA.ecartPoints);
  const total = Math.max(minimum, Math.round(totalPointsAttributs(perso.attributs) * d.multPoints) + ecart);
  const attributs = {};
  for (const a of ORDRE_ATTRIBUTS) attributs[a] = CREATION.valeurDepart;
  for (let n = 0; n < total - base; n++) {
    let a = tirerPondere(style.poids, alea);
    if (attributs[a] >= CREATION.valeurMaxAttribut) a = ORDRE_ATTRIBUTS.find((x) => attributs[x] < CREATION.valeurMaxAttribut);
    attributs[a] += 1;
  }

  // Équipement : budget proportionnel à la valeur de l'équipement du joueur
  let budget = Math.round(valeurEquipement(perso.equipement) * d.multEquipement
    * (1 + (alea() * 2 - 1) * IA.ecartValeurEquipement));
  const equipement = { arme: null, casque: null, plastron: null, jambieres: null, bouclier: null };

  // Arme : la meilleure arme préférée qui tient dans ~45 % du budget (au pire une dague)
  const armesPossibles = style.armes.filter((id) => ARMES[id].prix <= Math.max(ARMES.dague.prix, budget * 0.45));
  const idArme = armesPossibles.sort((x, y) => ARMES[y].prix - ARMES[x].prix)[0] || 'dague';
  equipement.arme = { id: idArme, niveau: 0 };
  budget -= ARMES[idArme].prix;

  // Armures : on remplit les emplacements dans un ordre aléatoire
  const emplacements = [...ORDRE_EMPLACEMENTS].sort(() => alea() - 0.5);
  emplacements.forEach((emp, k) => {
    const part = budget / (emplacements.length - k);
    const materiau = [...ORDRE_MATERIAUX].reverse().find((m) => ARMURES[`${emp}_${m}`].prix <= part * 1.3);
    if (materiau && ARMURES[`${emp}_${materiau}`].prix <= budget) {
      equipement[emp] = { id: `${emp}_${materiau}`, niveau: 0 };
      budget -= ARMURES[`${emp}_${materiau}`].prix;
    }
  });

  // Le reste du budget part en améliorations
  const objets = Object.values(equipement).filter(Boolean);
  for (let essais = 0; essais < 30 && objets.length; essais++) {
    const o = auHasard(objets, alea);
    const prix = (ARMES[o.id] || ARMURES[o.id]).prix;
    const cout = coutAmelioration(prix, o.niveau + 1);
    if (o.niveau < AMELIORATION.niveauMax && cout <= budget) {
      o.niveau += 1;
      budget -= cout;
    }
  }

  return {
    version: JEU.versionSauvegarde,
    nom: auHasard(IA.noms, alea),
    skin: {
      peau: auHasard(SKINS.peau, alea).id,
      coiffure: auHasard(SKINS.coiffure, alea).id,
      cheveux: auHasard(SKINS.cheveux, alea).id,
      tunique: auHasard(SKINS.tunique, alea).id,
    },
    attributs,
    pointsLibres: 0,
    pointsGagnes: Math.max(0, total - minimumJoueur),
    credits: 0,
    equipement,
    style: styleId,
    difficulte,
  };
}

// ----------------------------------------------------------------------------
//  Outils d'analyse
// ----------------------------------------------------------------------------
/** Attaques jouables par `att` contre `def` à la distance donnée, avec la stamina donnée */
function attaquesPossibles(att, def, d, stamina, protegeAdverse) {
  return ['rapide', 'normale', 'puissante']
    .filter((id) => aPortee(att.stats.arme, d) && stamina >= coutAction(id, att.stats))
    .map((id) => {
      const chance = chanceToucher(id, att.stats, def.stats) / 100;
      const degats = degatsEstimes(id, att.stats, def.stats, protegeAdverse);
      return { id, chance, degats, espere: chance * degats, cout: coutAction(id, att.stats) };
    });
}

/**
 * Ce que l'adversaire pourra nous infliger à son prochain tour si la distance
 * reste `d` (pire cas : sa meilleure attaque qui touche, charge comprise).
 */
function menaceAdverse(moi, lui, d, jeMeProtege) {
  const staminaSuivante = Math.min(lui.stats.staminaMax, lui.stamina + regenParTour());
  let pire = 0;
  for (const a of attaquesPossibles(lui, moi, d, staminaSuivante, jeMeProtege)) pire = Math.max(pire, a.degats);
  const charge = ACTIONS.charger;
  if (d >= charge.distanceMin && d <= charge.distanceMax && staminaSuivante >= coutAction('charger', lui.stats)) {
    pire = Math.max(pire, degatsEstimes('rapide', lui.stats, moi.stats, jeMeProtege));
  }
  return pire;
}

// ----------------------------------------------------------------------------
//  Tactique « simple » (Facile et Normal)
// ----------------------------------------------------------------------------
function tactiqueSimple(etat, i, alea, avecCoupDeGrace) {
  const moi = etat.combattants[i];
  const lui = etat.combattants[1 - i];
  const possibles = actionsPossibles(etat, i);
  const ok = (id) => possibles[id]?.possible;
  const d = distance(etat);
  const aPorteeAdverse = aPortee(lui.stats.arme, d);
  const attaques = attaquesPossibles(moi, lui, d, moi.stamina, lui.protege);

  // Coup de grâce
  if (avecCoupDeGrace) {
    const fatales = attaques.filter((a) => a.degats >= lui.pv + lui.bouclier).sort((a, b) => b.chance - a.chance);
    if (fatales.length && fatales[0].chance >= 0.45) return fatales[0].id;
  }

  // À portée : on frappe
  if (attaques.length) {
    if (moi.pv < moi.stats.pvMax * 0.3 && ok('proteger') && alea() < 0.25) return 'proteger';
    const reserve = moi.stamina - Math.max(...attaques.map((a) => a.cout));
    attaques.sort((a, b) => b.espere - a.espere);
    let choix = attaques[0];
    if (attaques.length > 1 && reserve < 5 && alea() < 0.5) choix = attaques.find((a) => a.id === 'rapide') || choix;
    return choix.id;
  }

  // À portée mais sans stamina
  if (aPortee(moi.stats.arme, d)) {
    if (aPorteeAdverse && ok('proteger') && alea() < 0.5) return 'proteger';
    return 'reposer';
  }

  // Hors de portée : on s'approche
  if (ok('charger') && moi.stamina - possibles.charger.cout >= 5 && alea() < 0.7) return 'charger';
  if (moi.stamina < 12 && !aPorteeAdverse) return 'reposer';
  if (ok('provoquer') && lui.stamina > 20 && alea() < 0.12) return 'provoquer';
  if (ok('avancer')) return 'avancer';
  return 'reposer';
}

// ----------------------------------------------------------------------------
//  Tactique « avancée » (Difficile)
// ----------------------------------------------------------------------------
function tactiqueAvancee(etat, i, alea) {
  const moi = etat.combattants[i];
  const lui = etat.combattants[1 - i];
  const possibles = actionsPossibles(etat, i);
  const ok = (id) => possibles[id]?.possible;
  const d = distance(etat);
  const pvEffectifs = moi.pv + moi.bouclier;
  const attaques = attaquesPossibles(moi, lui, d, moi.stamina, lui.protege);

  // 1. Coup de grâce, même risqué
  const fatales = attaques.filter((a) => a.degats >= lui.pv + lui.bouclier).sort((a, b) => b.chance - a.chance);
  if (fatales.length && fatales[0].chance >= 0.35) return fatales[0].id;

  // 2. Danger de mort au prochain tour adverse : garde, ou recul hors de portée
  const menace = menaceAdverse(moi, lui, d, false);
  if (menace >= pvEffectifs) {
    if (ok('proteger')) return 'proteger';
    if (ok('reculer') && menaceAdverse(moi, lui, d + 1, false) < pvEffectifs) return 'reculer';
  }

  // 3. À portée
  if (attaques.length) {
    // L'adversaire est en garde : inutile de gaspiller une grosse attaque
    if (lui.protege) {
      if (moi.stamina < moi.stats.staminaMax * 0.6) return 'reposer';
      const rapide = attaques.find((a) => a.id === 'rapide');
      if (rapide) return 'rapide';
    }
    // Gros coup adverse en préparation et nous déjà amochés : se protéger d'abord
    if (menace >= pvEffectifs * 0.45 && ok('proteger') && moi.derniere !== 'proteger' && alea() < 0.5) return 'proteger';
    // Meilleure attaque « rentable » : la puissante seulement si elle vaut vraiment le coup
    attaques.sort((a, b) => b.espere - a.espere);
    let choix = attaques[0];
    const normale = attaques.find((a) => a.id === 'normale');
    if (choix.id === 'puissante' && normale && choix.espere < normale.espere * 1.15) choix = normale;
    // Garder de quoi frapper au tour suivant
    if (moi.stamina - choix.cout + regenParTour() < coutAction('rapide', moi.stats) && attaques.length > 1) {
      choix = attaques.find((a) => a.id === 'rapide') || choix;
    }
    return choix.id;
  }

  // 4. À portée mais à court de stamina
  if (aPortee(moi.stats.arme, d)) {
    if (aPortee(lui.stats.arme, d) && ok('proteger')) return 'proteger';
    if (ok('provoquer') && lui.stamina >= 15 && moi.stamina >= possibles.provoquer.cout + 5) return 'provoquer';
    return 'reposer';
  }

  // 5. Hors de portée
  if (ok('charger') && moi.stamina - possibles.charger.cout >= coutAction('rapide', moi.stats)) return 'charger';
  // Ne pas entrer au contact sans frapper : l'adversaire frapperait le premier
  const apresPas = d - 1;
  const onSeraitAPortee = aPortee(moi.stats.arme, apresPas);
  const ilFrapperait = menaceAdverse(moi, lui, apresPas, false) > 0;
  if (!onSeraitAPortee && ilFrapperait && etat.manche < 12 && moi.stamina < moi.stats.staminaMax) {
    if (ok('provoquer') && lui.stamina >= 15 && alea() < 0.4) return 'provoquer';
    return 'reposer';
  }
  // Recharger avant d'engager le combat
  if (moi.stamina < moi.stats.staminaMax * 0.5 && !aPortee(lui.stats.arme, d)) return 'reposer';
  if (ok('avancer')) return 'avancer';
  return 'reposer';
}

// ----------------------------------------------------------------------------
//  Choix de l'action
// ----------------------------------------------------------------------------
export function choisirAction(etat, i, alea = Math.random, difficulte = 'normal') {
  const d = reglages(difficulte);
  const possibles = actionsPossibles(etat, i);
  const jouables = Object.keys(possibles).filter((id) => possibles[id].possible);

  // Une part de hasard (surtout en Facile) : le bot « se trompe »
  if (alea() < d.hasard && jouables.length) {
    const sansRecul = jouables.filter((id) => id !== 'reculer');
    return auHasard(sansRecul.length ? sansRecul : jouables, alea);
  }
  if (d.tactique === 'avancee') return tactiqueAvancee(etat, i, alea);
  return tactiqueSimple(etat, i, alea, difficulte !== 'facile');
}
