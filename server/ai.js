// ============================================================================
//  ARENA GLADIUS — server/ai.js
//
//  Bots (adversaires contrôlés par l'ordinateur), 3 difficultés :
//  - genererAdversaire(perso, alea, difficulte) : un gladiateur adapté au
//    joueur (plus faible en Facile, plus fort en Difficile)
//  - creerCerveau(difficulte) + entreeBot(...)   : à chaque pas du combat en
//    temps réel, décide des touches sur lesquelles le bot appuie
//
//  Les réglages de chaque difficulté sont dans shared/data.js (DIFFICULTES).
// ============================================================================

import {
  IA, DIFFICULTES, SKINS, ORDRE_ATTRIBUTS, CREATION, ARMES, ARMURES, ORDRE_EMPLACEMENTS, ORDRE_MATERIAUX,
  JEU, AMELIORATION, TEMPS_REEL as T,
} from '../shared/data.js';
import {
  totalPointsAttributs, valeurEquipement, coutAmelioration, dureePhase,
} from '../shared/formulas.js';
import { terrainDe, trouSous, supportSous, surGlace } from '../shared/terrain.js';

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
//  Cerveau du bot en temps réel
//  À chaque pas du serveur, le bot « appuie » sur des touches, comme un joueur.
//  Il voit ce que fait l'adversaire avec un temps de réaction (selon la
//  difficulté), pare ou esquive les coups qui arrivent, attaque à portée,
//  punit quand l'adversaire est sonné, et le suit sur les plateformes.
//  Il connaît le terrain : il saute les obstacles et les trous, freine avant
//  le vide, remonte s'il y tombe, et cherche à y pousser son adversaire.
// ----------------------------------------------------------------------------
const MARGE_PORTEE = 40;   // la zone de frappe part un peu devant le corps
const DEMI = T.corps.largeur / 2;
const MARGE_BORD = 12;     // le bot veut au moins 12 unités de pied sur le bord

/** Distance à partir de laquelle une attaque de `c` peut toucher */
function portee(c, type = 'legere') {
  return c.stats.tr.allonge * T.attaques[type].allonge + MARGE_PORTEE;
}

/** Y a-t-il (vraiment) quelque chose sous les pieds en x (à la hauteur y), ou le vide ? */
const vide = (terrain, x, y) => supportSous(terrain, x, y + 0.5, DEMI - MARGE_BORD) === null;

/** Distance avant le vide en avançant dans le sens `sens` (Infinity si rien jusqu'à `max`) */
function distanceDuVide(terrain, c, sens, max) {
  for (let d = 0; d <= max; d += 8) {
    const x = c.x + sens * d;
    if (x < terrain.murGauche + DEMI || x > terrain.murDroit - DEMI) return Infinity;
    if (vide(terrain, x, c.y)) return d;
  }
  return Infinity;
}

/** Le bloc qui barre la route juste devant (plus haut que les pieds) */
function blocDevant(terrain, c, sens, distance) {
  return terrain.blocs.find((b) => {
    if (b.y2 <= c.y + 1 || b.y1 >= c.y + T.corps.hauteur) return false;
    const d = ((sens > 0 ? b.x1 - DEMI : b.x2 + DEMI) - c.x) * sens;
    return d >= -1 && d <= distance;
  }) || null;
}

/** Distance d'arrêt au sol (en appuyant dans l'autre sens), glace comprise */
function distanceArret(terrain, c) {
  const glisse = c.sur < 0 && surGlace(terrain, c.x);
  const frein = T.physique.acceleration * (glisse ? T.physique.glace.acceleration : 1);
  return (c.vx * c.vx) / (2 * frein);
}

/**
 * Tombé (ou en train de sauter) au-dessus d'un trou : viser le bord, sauter
 * en retombant, esquiver vers le bord en dernier recours.
 */
function survivre(terrain, moi, e) {
  const trou = trouSous(terrain, moi.x);
  if (!trou) return false;
  // Au-delà de ces points, les pieds reposent bien sur le sol
  const bordG = trou.x1 + DEMI - MARGE_BORD, bordD = trou.x2 - DEMI + MARGE_BORD;
  let sens;
  if (moi.sauts > 0 && Math.abs(moi.vx) > 150) sens = Math.sign(moi.vx);   // on continue la traversée
  else sens = moi.x - bordG < bordD - moi.x ? -1 : 1;                      // sinon, le bord le plus proche
  e.g = sens < 0;
  e.d = sens > 0;
  e.b = false;
  e.p = false;
  if (moi.vy < -50 && moi.y < 60 && moi.sauts > 0) e.saut = true;
  else if (moi.sauts === 0 && moi.vy < 0 && moi.y > -5 && moi.recharges.esquive <= 0
    && moi.stamina >= T.esquive.cout && Math.abs((sens > 0 ? bordD : bordG) - moi.x) < 170) e.esquive = true;
  return true;
}

/**
 * Garde-fou avant chaque déplacement au sol : ne pas marcher dans le vide.
 * Si l'adversaire est de l'autre côté, on saute par-dessus ; sinon on freine.
 * Et on saute les obstacles (blocs) qui barrent la route.
 */
function securiser(terrain, moi, lui, e, veutAvancer) {
  const sens = (e.d ? 1 : 0) - (e.g ? 1 : 0);
  if (!sens) {
    // Même sans avancer, on peut glisser (glace, recul) vers le vide
    const glisse = Math.sign(moi.vx);
    if (moi.auSol && glisse && distanceDuVide(terrain, moi, glisse, distanceArret(terrain, moi) + 20) < Infinity) {
      e.g = glisse > 0;
      e.d = glisse < 0;
    }
    return;
  }
  if (moi.auSol) {
    const arret = sens === Math.sign(moi.vx) ? distanceArret(terrain, moi) : 0;
    const d = distanceDuVide(terrain, moi, sens, arret + 30);
    if (d < Infinity) {
      const trou = trouSous(terrain, moi.x + sens * (d + DEMI + 8));
      const auDela = trou && (sens > 0 ? lui.x > trou.x2 : lui.x < trou.x1);
      if (veutAvancer && auDela) {
        if (d < 45 + arret * 0.3) e.saut = true;          // traverser d'un saut
      } else {
        // Freiner (contre-braquer si on glisse vers le bord)
        e.g = false;
        e.d = false;
        if (Math.sign(moi.vx) === sens && Math.abs(moi.vx) > 30) { if (sens > 0) e.g = true; else e.d = true; }
        return;
      }
    }
    if (blocDevant(terrain, moi, sens, 35)) e.saut = true;
    return;
  }
  // En l'air : ne pas s'aventurer au-dessus du vide sans saut en réserve pour traverser
  const devant = moi.x + sens * 50;
  if (vide(terrain, devant, moi.y)) {
    const trou = trouSous(terrain, devant);
    const auDela = trou && (sens > 0 ? lui.x > trou.x2 : lui.x < trou.x1);
    if (!(veutAvancer && auDela && moi.sauts > 0)) {
      e.g = false;
      e.d = false;
      return;
    }
  }
  if (moi.vy < 0 && moi.sauts > 0 && blocDevant(terrain, moi, sens, 60)) e.saut = true;   // double saut pour passer l'obstacle
}

export function creerCerveau(difficulte = 'normal', alea = Math.random) {
  return {
    d: reglages(difficulte),
    alea,
    tenues: { g: false, d: false, b: false, p: false },
    pause: 0,               // hésitation en cours (s)
    attaqueVue: null,       // attaque adverse en cours d'observation
    vueDepuis: 0,
    reponse: null,          // 'parade' | 'parfaite' | 'esquive' | 'rien'
    prochaineDecision: 0,
    envie: 'approcher',     // approcher | attendre | reculer
  };
}

/** Renvoie l'entrée (touches) du bot pour ce pas de simulation */
export function entreeBot(cerveau, etat, i, dt) {
  const { d, alea } = cerveau;
  const moi = etat.combattants[i];
  const lui = etat.combattants[1 - i];
  const e = { ...cerveau.tenues, saut: false, legere: false, lourde: false, esquive: false };
  const relacher = () => { e.g = false; e.d = false; e.b = false; e.p = false; };

  if (etat.phase !== 'combat' || moi.etat === 'ko' || moi.etat === 'victoire') {
    relacher();
    cerveau.tenues = { g: false, d: false, b: false, p: false };
    return e;
  }

  const dx = lui.x - moi.x;
  const adx = Math.abs(dx);
  const versLui = Math.sign(dx) || moi.dir;
  const dy = lui.y - moi.y;
  const terrain = terrainDe(etat.arene);

  // --- 0. Au-dessus du vide : se sauver avant tout --------------------------
  if (!moi.auSol && vide(terrain, moi.x, moi.y) && survivre(terrain, moi, e)) {
    cerveau.tenues = { g: e.g, d: e.d, b: false, p: false };
    return e;
  }

  // --- 1. Réagir à une attaque adverse, après le temps de réaction ---------
  const menace = lui.etat === 'attaque' && lui.attaque.phase === 'preparation' ? lui.attaque : null;
  if (menace && cerveau.attaqueVue !== menace) {
    cerveau.attaqueVue = menace;
    cerveau.vueDepuis = 0;
    cerveau.reponse = null;
  }
  if (!menace && lui.etat !== 'attaque') cerveau.attaqueVue = null;
  if (cerveau.attaqueVue) cerveau.vueDepuis += dt;

  const aPorteeDeLui = adx <= portee(lui, cerveau.attaqueVue?.type || 'legere') + 25 && Math.abs(dy) < 120;
  if (cerveau.attaqueVue && cerveau.vueDepuis >= d.reaction && aPorteeDeLui && !cerveau.reponse) {
    const lourde = cerveau.attaqueVue.type === 'lourde';
    const r = alea();
    if (lourde && r < d.esquive && moi.stamina >= T.esquive.cout && moi.recharges.esquive <= 0) cerveau.reponse = 'esquive';
    else if (alea() < d.parade) cerveau.reponse = alea() < d.paradeParfaite ? 'parfaite' : 'parade';
    else cerveau.reponse = 'rien';
  }

  // Exécuter la réponse choisie
  if (cerveau.reponse && cerveau.attaqueVue && moi.etat === 'libre') {
    if (cerveau.reponse === 'esquive') {
      // Esquive à travers ou loin de l'adversaire… mais jamais vers le vide
      let sens = versLui < 0 ? 1 : alea() < 0.5 ? -1 : 1;
      const sure = (s) => !vide(terrain, moi.x + s * 185, moi.y);
      if (!sure(sens)) sens = -sens;
      if (sure(sens)) {
        e.g = sens < 0;
        e.d = sens > 0;
        e.esquive = true;
        cerveau.reponse = 'rien';
        cerveau.tenues = { g: false, d: false, b: false, p: false };
        return e;
      }
      cerveau.reponse = 'parade';
    }
    if (cerveau.reponse === 'parade' || cerveau.reponse === 'parfaite') {
      const a = cerveau.attaqueVue;
      const reste = dureePhase(a.type, 'preparation', lui.stats) - a.t;
      // Parade parfaite : lever la garde au tout dernier moment
      const lever = cerveau.reponse === 'parade' || reste <= T.parade.fenetreParfaite * 0.7;
      relacher();
      e.p = lever;
      // Se tourner vers l'attaquant pour parer de face
      if (moi.dir !== versLui) { if (versLui > 0) e.d = true; else e.g = true; }
      cerveau.tenues = { ...cerveau.tenues, g: e.g, d: e.d, p: e.p, b: false };
      return e;
    }
  }
  // Garder la parade tant que le coup adverse n'est pas fini
  if ((cerveau.reponse === 'parade' || cerveau.reponse === 'parfaite') && lui.etat === 'attaque') {
    e.p = true;
    return e;
  }
  e.p = false;
  cerveau.tenues.p = false;

  // --- 2. Hésitations (surtout en Facile) ----------------------------------
  cerveau.pause -= dt;
  if (cerveau.pause > 0) {
    relacher();
    securiser(terrain, moi, lui, e, false);   // même distrait, il ne glisse pas dans le vide
    cerveau.tenues = { g: e.g, d: e.d, b: false, p: false };
    return e;
  }

  // --- 3. Décisions régulières ----------------------------------------------
  cerveau.prochaineDecision -= dt;
  if (cerveau.prochaineDecision <= 0) {
    cerveau.prochaineDecision = d.reaction * (0.6 + alea() * 0.8);
    if (alea() < d.hesitation) {
      cerveau.pause = 0.2 + alea() * 0.5;
      relacher();
      cerveau.tenues = { g: false, d: false, b: false, p: false };
      return e;
    }
    const fatigue = moi.stamina < moi.stats.staminaMax * 0.25;
    cerveau.envie = fatigue && adx < 300 ? 'reculer' : alea() < d.agressivite ? 'approcher' : 'attendre';
  }

  // --- 4. Attaquer si c'est possible ----------------------------------------
  const memeHauteur = Math.abs(dy) < 90;
  const vulnerable = lui.etat === 'etourdi' || (lui.etat === 'attaque' && lui.attaque.phase === 'recuperation');
  const peutLourde = moi.recharges.lourde <= 0 && moi.stamina >= moi.stats.tr.coutLourde;
  // Pas d'attaque en l'air près du vide : on ne pourrait plus se diriger en retombant
  const enLAirPresDuVide = !moi.auSol
    && (vide(terrain, moi.x, moi.y) || distanceDuVide(terrain, moi, Math.sign(moi.vx) || moi.dir, 120) < Infinity);
  if (moi.etat === 'libre' && memeHauteur && !enLAirPresDuVide) {
    // L'adversaire a le vide dans le dos : une attaque lourde peut l'y envoyer
    const videDerriere = distanceDuVide(terrain, lui, versLui, 200) < Infinity;
    // La fente de l'attaque lourde fait glisser (surtout sur la glace) : pas vers le vide
    const glissade = moi.sur < 0 && surGlace(terrain, moi.x) ? 110 : 25;
    const fenteSure = moi.auSol && distanceDuVide(terrain, moi, versLui, glissade) === Infinity;
    const aPorteeLourde = adx <= portee(moi, 'lourde') && peutLourde && fenteSure;
    const aPorteeLegere = adx <= portee(moi, 'legere') && moi.recharges.legere <= 0;
    const envieLourde = vulnerable ? d.lourde * 3 : d.lourde * (videDerriere ? 0.5 : 0.08);
    if (aPorteeLourde && alea() < envieLourde) {
      if (moi.dir !== versLui) { relacher(); if (versLui > 0) e.d = true; else e.g = true; }
      e.lourde = true;
      return e;
    }
    if (aPorteeLegere && (vulnerable || alea() < d.agressivite * 0.25)) {
      if (moi.dir !== versLui) { relacher(); if (versLui > 0) e.d = true; else e.g = true; }
      e.legere = true;
      return e;
    }
  }

  // --- 5. Se déplacer ------------------------------------------------------
  relacher();
  const loin = adx > portee(moi, 'legere') - 10;
  if (cerveau.envie === 'reculer') {
    if (versLui > 0) e.g = true; else e.d = true;
  } else if (cerveau.envie === 'approcher' && loin) {
    if (versLui > 0) e.d = true; else e.g = true;
  } else if (moi.dir !== versLui) {
    if (versLui > 0) e.d = true; else e.g = true;   // au moins lui faire face
  }
  securiser(terrain, moi, lui, e, cerveau.envie === 'approcher');

  // Suivre l'adversaire en hauteur : sauter vers une plateforme, ou en descendre
  // (jamais à travers une plateforme qui surplombe le vide)
  if (dy > 80 && adx < 260 && moi.etat === 'libre') {
    if (moi.auSol) e.saut = true;
    else if (moi.vy < 0 && moi.sauts > 0) e.saut = true;
  } else if (dy < -80 && moi.sur >= 0 && adx < 400 && !vide(terrain, moi.x, moi.y - 1)) {
    e.b = true;
  }

  cerveau.tenues = { g: e.g, d: e.d, b: e.b, p: false };
  return e;
}
