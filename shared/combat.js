// ============================================================================
//  ARENA GLADIUS — shared/combat.js
//
//  Moteur du combat EN TEMPS RÉEL (façon jeu de plateforme / versus).
//  Le terrain de chaque arène (blocs, plateformes, trous, glace) vient de
//  shared/terrain.js.
//  Utilisé par le serveur (qui fait autorité : c'est lui qui décide des coups)
//  ET par le navigateur (pour anticiper ses propres déplacements sans attendre
//  le réseau). Logique pure : pas de réseau, pas de minuteur, hasard injecté.
//
//  creerMatch(persos, options)                  → état d'un combat
//  etapeCombattant(c, entree, dt, terrain)      → mouvement, saut, esquive, attaque, parade
//  etapeMatch(etat, entrees, dt, alea)          → un pas complet (les deux + coups + chutes)
//  dynamique(c) / appliquerDynamique()          → ce qui change à chaque instant (réseau)
//
//  Une « entrée » décrit les touches d'un joueur pendant un pas :
//  { g, d, b, p : touches tenues (gauche, droite, bas, parade)
//    saut, legere, lourde, esquive : touches pressées pendant ce pas }
// ============================================================================

import { TEMPS_REEL as T, ARENES, ORDRE_ARENES } from './data.js';
import { statsCombattant, dureePhase, degatsCoup, chanceCritique } from './formulas.js';
import { terrainDe, surGlace } from './terrain.js';

export const ENTREE_VIDE = Object.freeze({ g: false, d: false, b: false, p: false, saut: false, legere: false, lourde: false, esquive: false });
const ACTIONS_PRESSEES = ['saut', 'legere', 'lourde', 'esquive'];
const TAMPON = 0.12;   // une touche pressée trop tôt est gardée 0,12 s
const EPS = 0.01;
const ADHERENCE_NORMALE = { acceleration: 1, freinage: 1 };

// ----------------------------------------------------------------------------
//  Création
// ----------------------------------------------------------------------------
export function creerCombattant(perso, index, { ia = false, x = terrainDe('colisee').departs[index] } = {}) {
  const stats = statsCombattant(perso);
  return {
    index,
    nom: perso.nom,
    skin: perso.skin,
    equipement: perso.equipement,
    niveau: stats.niveau,
    ia,
    stats,
    // État qui change à chaque instant (voir dynamique())
    x,
    y: 0,
    vx: 0,
    vy: 0,
    dir: index === 0 ? 1 : -1,
    auSol: true,
    sur: -1,                 // -1 = le sol ou un bloc, sinon l'indice de la plateforme
    sauts: T.saut.sautsMax,
    etat: 'libre',           // libre | attaque | esquive | etourdi | ko | victoire
    attaque: null,           // { type, phase, t, aTouche }
    recharges: { legere: 0, lourde: 0, esquive: 0 },
    esquiveT: 0,
    invincible: 0,
    etourdi: 0,
    sonne: false,            // étourdi « long » (parade parfaite subie, garde brisée)
    parade: false,
    paradeDepuis: 0,
    delaiStamina: 0,
    delaiGarde: 0,
    descente: 0,
    tampon: null,            // { action, ttl }
    pv: stats.pvMax,
    stamina: stats.staminaMax,
    garde: stats.tr.gardeMax,
    compteurs: { degats: 0, attaques: 0, touches: 0, critiques: 0, parfaites: 0 },
  };
}

export function creerMatch(persos, { arene = null, alea = Math.random, ia = [false, false] } = {}) {
  const idArene = ARENES[arene] ? arene : ORDRE_ARENES[Math.floor(alea() * ORDRE_ARENES.length)];
  const terrain = terrainDe(idArene);
  return {
    arene: idArene,
    phase: 'decompte',       // decompte | combat | fin
    decompte: T.decompte,
    tempsRestant: T.dureeMax,
    numero: 0,
    combattants: persos.map((p, i) => creerCombattant(p, i, { ia: ia[i], x: terrain.departs[i] })),
    evenements: [],
    fini: false,
    vainqueur: null,
    raison: null,
  };
}

// ----------------------------------------------------------------------------
//  Petits outils
// ----------------------------------------------------------------------------
const approcher = (v, cible, pas) => (v < cible ? Math.min(cible, v + pas) : Math.max(cible, v - pas));
const peutAgir = (c) => c.etat === 'libre';

/** Zone du corps (pour recevoir les coups) */
export function boiteCorps(c) {
  const l = T.corps.largeur / 2;
  return { x1: c.x - l, x2: c.x + l, y1: c.y, y2: c.y + T.corps.hauteur };
}

/** Zone de frappe d'une attaque (devant le combattant) */
export function boiteFrappe(c) {
  const a = T.attaques[c.attaque.type];
  const longueur = c.stats.tr.allonge * a.allonge;
  const depart = 12;
  const x1 = c.dir > 0 ? c.x + depart : c.x - depart - longueur;
  return { x1, x2: x1 + longueur, y1: c.y + 25, y2: c.y + 140 };
}

const chevauche = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

// ----------------------------------------------------------------------------
//  Un pas pour un combattant (sans l'adversaire) : chronos, stamina, garde,
//  déplacements, saut, esquive, déroulé des attaques, puis le terrain (murs,
//  blocs solides, plateformes, trous, glace).
//  Déterministe : le navigateur peut rejouer exactement ce que fait le serveur.
// ----------------------------------------------------------------------------
export function etapeCombattant(c, entree, dt, terrain = terrainDe('colisee')) {
  const tr = c.stats.tr;
  const e = entree || ENTREE_VIDE;

  // Chronos
  for (const k of Object.keys(c.recharges)) c.recharges[k] = Math.max(0, c.recharges[k] - dt);
  c.invincible = Math.max(0, c.invincible - dt);
  c.delaiStamina = Math.max(0, c.delaiStamina - dt);
  c.delaiGarde = Math.max(0, c.delaiGarde - dt);
  c.descente = Math.max(0, c.descente - dt);

  // Stamina et garde remontent avec le temps
  if (c.delaiStamina <= 0) c.stamina = Math.min(c.stats.staminaMax, c.stamina + tr.regenStamina * dt);
  if (!c.parade && c.delaiGarde <= 0) c.garde = Math.min(tr.gardeMax, c.garde + T.parade.regenGarde * dt);

  // Plus de commandes une fois KO, vainqueur, ou tombé trop bas dans un trou
  const actif = c.etat !== 'ko' && c.etat !== 'victoire' && c.y > terrain.limiteChute;

  // Étourdi : aucune commande jusqu'à la fin de l'étourdissement
  if (c.etat === 'etourdi') {
    c.etourdi -= dt;
    if (c.etourdi <= 0) { c.etourdi = 0; c.etat = 'libre'; }
  }

  // Touches pressées → petite mémoire tampon (pour ne pas « rater » une touche)
  if (actif) {
    for (const a of ACTIONS_PRESSEES) if (e[a]) c.tampon = { action: a, ttl: TAMPON };
  }
  if (c.tampon) {
    c.tampon.ttl -= dt;
    if (c.tampon.ttl <= 0) c.tampon = null;
  }

  // Parade : tenir la touche, au sol ou en l'air, quand on est libre
  const paradeAvant = c.parade;
  c.parade = actif && e.p && c.etat === 'libre';
  if (c.parade) c.paradeDepuis = paradeAvant ? c.paradeDepuis + dt : 0;
  if (c.parade) c.delaiGarde = T.parade.delaiRegenGarde;

  // Esquive en cours
  if (c.etat === 'esquive') {
    c.esquiveT -= dt;
    c.vx = c.dir * T.esquive.vitesse;
    c.vy = 0;
    if (c.esquiveT <= 0) { c.etat = 'libre'; c.vx *= 0.35; }
  }

  // Attaque en cours : préparation → active → récupération
  if (c.etat === 'attaque') {
    const a = c.attaque;
    a.t += dt;
    if (a.phase === 'preparation' && a.t >= dureePhase(a.type, 'preparation', c.stats)) {
      a.t -= dureePhase(a.type, 'preparation', c.stats);
      a.phase = 'active';
      if (a.type === 'lourde' && c.auSol) c.vx = c.dir * 260;   // petite fente vers l'avant
    }
    if (a.phase === 'active' && a.t >= dureePhase(a.type, 'active', c.stats)) {
      a.t -= dureePhase(a.type, 'active', c.stats);
      a.phase = 'recuperation';
    }
    if (a.phase === 'recuperation' && a.t >= dureePhase(a.type, 'recuperation', c.stats)) {
      c.recharges[a.type] = dureePhase(a.type, 'recharge', c.stats);
      c.attaque = null;
      c.etat = 'libre';
    }
  }

  // Action mémorisée, si elle est possible maintenant
  if (peutAgir(c) && c.tampon) {
    const action = c.tampon.action;
    let fait = false;
    if (action === 'saut' && c.sauts > 0) {
      const premier = c.auSol || c.sauts === T.saut.sautsMax;
      c.vy = tr.impulsionSaut * (premier ? 1 : T.saut.doubleSaut);
      c.sauts -= 1;
      c.auSol = false;
      c.sur = -1;
      fait = true;
    } else if ((action === 'legere' || action === 'lourde') && c.recharges[action] <= 0) {
      const cout = action === 'lourde' ? tr.coutLourde : T.attaques.legere.cout;
      if (c.stamina >= cout) {
        c.stamina -= cout;
        if (cout > 0) c.delaiStamina = T.stamina.delaiRegen;
        c.etat = 'attaque';
        c.attaque = { type: action, phase: 'preparation', t: 0, aTouche: false };
        c.parade = false;
        c.compteurs.attaques += 1;
        fait = true;
      }
    } else if (action === 'esquive' && c.recharges.esquive <= 0 && c.stamina >= T.esquive.cout) {
      const sens = (e.d ? 1 : 0) - (e.g ? 1 : 0);
      if (sens) c.dir = sens;
      c.stamina -= T.esquive.cout;
      c.delaiStamina = T.stamina.delaiRegen;
      c.etat = 'esquive';
      c.esquiveT = T.esquive.duree;
      c.invincible = T.esquive.invincibilite;
      c.recharges.esquive = T.esquive.recharge;
      c.parade = false;
      c.vx = c.dir * T.esquive.vitesse;
      c.vy = 0;
      fait = true;
    }
    if (fait) c.tampon = null;
  }

  // Déplacement horizontal (sur la glace, on accélère et on freine mal)
  const sens = actif ? (e.d ? 1 : 0) - (e.g ? 1 : 0) : 0;
  const controle = c.auSol ? 1 : T.physique.controleAir;
  const adherence = c.auSol && c.sur < 0 && c.y <= 0.5 && surGlace(terrain, c.x) ? T.physique.glace : ADHERENCE_NORMALE;
  if (c.etat === 'libre') {
    if (sens) c.dir = sens;
    const vmax = tr.vitesse * (c.parade ? T.parade.ralentissement : 1);
    if (sens) c.vx = approcher(c.vx, sens * vmax, T.physique.acceleration * controle * adherence.acceleration * dt);
    else c.vx = approcher(c.vx, 0, T.physique.freinage * (c.auSol ? adherence.freinage : 0.25) * dt);
  } else if (c.etat === 'attaque' || c.etat === 'etourdi' || !actif) {
    c.vx = approcher(c.vx, 0, T.physique.freinage * (c.auSol ? 0.9 * adherence.freinage : 0.2) * dt);
  }

  // Descendre d'une plateforme
  if (actif && e.b && c.auSol && c.sur >= 0 && c.etat === 'libre') {
    c.descente = 0.25;
    c.auSol = false;
    c.sur = -1;
    c.y -= 2;
  }

  // Gravité (sauf pendant l'esquive)
  if (c.etat !== 'esquive') c.vy = Math.max(-T.physique.chuteMax, c.vy - T.physique.gravite * dt);

  deplacer(c, dt, terrain);
}

/**
 * Mouvement et collisions : d'abord à l'horizontale (murs, côtés des blocs et
 * des bords de trous), puis à la verticale (sol, dessus des blocs, plafond,
 * plateformes traversables).
 */
function deplacer(c, dt, terrain) {
  const demi = T.corps.largeur / 2;
  const H = T.corps.hauteur;
  const etaitAuSol = c.auSol;

  // Horizontal
  const xAvant = c.x;
  c.x += c.vx * dt;
  const xMin = terrain.murGauche + demi, xMax = terrain.murDroit - demi;
  if (c.x < xMin) { c.x = xMin; c.vx = Math.max(0, c.vx); }
  if (c.x > xMax) { c.x = xMax; c.vx = Math.min(0, c.vx); }
  for (const s of terrain.solides) {
    if (c.y >= s.y2 - EPS || c.y + H <= s.y1 + EPS) continue;   // pas à sa hauteur
    if (c.x + demi <= s.x1 || c.x - demi >= s.x2) continue;
    if (xAvant + demi <= s.x1 + EPS) { c.x = s.x1 - demi; c.vx = Math.min(0, c.vx); }
    else if (xAvant - demi >= s.x2 - EPS) { c.x = s.x2 + demi; c.vx = Math.max(0, c.vx); }
    else {
      // Coincé dedans (ne devrait pas arriver) : on sort par le côté le plus proche
      const gauche = s.x1 - demi, droite = s.x2 + demi;
      c.x = gauche >= xMin && (droite > xMax || c.x - gauche < droite - c.x) ? gauche : droite;
    }
  }

  // Vertical
  const yAvant = c.y;
  c.y += c.vy * dt;
  c.auSol = false;
  for (const s of terrain.solides) {
    if (c.x + demi <= s.x1 + EPS || c.x - demi >= s.x2 - EPS) continue;
    if (c.y > s.y2 + EPS || c.y + H <= s.y1) continue;
    if (yAvant >= s.y2 - EPS && c.vy <= 0) {
      c.y = s.y2;                              // posé dessus (ou qui glisse dessus, pendant l'esquive)
      c.vy = 0;
      c.auSol = true;
      c.sur = -1;
    } else if (c.y < s.y2 && yAvant + H <= s.y1 + EPS) {
      c.y = s.y1 - H;                          // la tête cogne dessous
      c.vy = Math.min(0, c.vy);
    }
  }
  if (!c.auSol && c.vy <= 0 && c.descente <= 0) {
    terrain.plateformes.forEach((p, i) => {
      if (!c.auSol && c.x >= p.x1 && c.x <= p.x2 && yAvant >= p.y - EPS && c.y <= p.y) {
        c.y = p.y;
        c.vy = 0;
        c.auSol = true;
        c.sur = i;
      }
    });
  }

  // Dans un trou, la chute continue hors de l'écran (c'est le serveur qui déclare la mort)
  const fond = terrain.limiteChute - 400;
  if (c.y < fond) { c.y = fond; c.vy = 0; }

  if (c.auSol) c.sauts = T.saut.sautsMax;
  else if (etaitAuSol && c.sauts === T.saut.sautsMax && c.vy <= 0) c.sauts = T.saut.sautsMax - 1; // tombé d'un bord
}

// ----------------------------------------------------------------------------
//  Les coups (côté serveur uniquement : c'est lui qui décide)
// ----------------------------------------------------------------------------
function noter(etat, ev) {
  etat.evenements.push(ev);
}

/** Cherche les coups qui touchent pendant ce pas, puis les applique */
function resoudreCoups(etat, alea) {
  const touches = [];
  for (const att of etat.combattants) {
    if (att.etat !== 'attaque' || att.attaque.phase !== 'active' || att.attaque.aTouche) continue;
    const def = etat.combattants[1 - att.index];
    if (def.etat === 'ko') continue;
    if (!chevauche(boiteFrappe(att), boiteCorps(def))) continue;
    att.attaque.aTouche = true;
    touches.push([att, def, att.attaque.type]);
  }
  for (const [att, def, type] of touches) appliquerCoup(etat, att, def, type, alea);
}

function appliquerCoup(etat, att, def, type, alea) {
  const a = T.attaques[type];
  const ev = { type: 'coup', attaque: type, auteur: att.index, cible: def.index, x: def.x, y: def.y + 90 };

  // Esquive (invincibilité)
  if (def.invincible > 0) {
    noter(etat, { ...ev, type: 'esquive' });
    return;
  }

  // Parade de face
  const deFace = def.parade && def.dir === -att.dir;
  if (deFace && def.paradeDepuis <= T.parade.fenetreParfaite) {
    att.etat = 'etourdi';
    att.etourdi = T.parade.etourdissementParfait;
    att.sonne = true;
    att.attaque = null;
    att.vx = -att.dir * 200;
    def.compteurs.parfaites += 1;
    noter(etat, { ...ev, type: 'parfaite' });
    return;
  }

  const critique = !deFace && alea() * 100 < chanceCritique(att.stats);
  const degats = degatsCoup(type, att.stats, def.stats, { alea, critique });

  if (deFace) {
    // La garde encaisse l'essentiel ; si elle cède, garde brisée
    const bloque = Math.round(degats * T.parade.reductionDegats);
    const passe = degats - bloque;
    def.garde -= bloque;
    def.pv = Math.max(0, def.pv - passe);
    def.vx = att.dir * 140;
    att.compteurs.degats += passe;
    if (def.garde <= 0) {
      def.garde = 0;
      def.parade = false;
      def.etat = 'etourdi';
      def.etourdi = T.parade.etourdissementBrise;
      def.sonne = true;
      def.attaque = null;
      noter(etat, { ...ev, type: 'brise', degats: passe });
    } else {
      noter(etat, { ...ev, type: 'bloque', degats: passe, bloque });
    }
  } else {
    def.pv = Math.max(0, def.pv - degats);
    def.vx = att.dir * a.recul;
    if (a.reculHaut) { def.vy = a.reculHaut; def.auSol = false; def.sur = -1; }
    def.etat = 'etourdi';
    def.etourdi = a.etourdissement;
    def.sonne = false;
    def.attaque = null;
    def.parade = false;
    att.compteurs.touches += 1;
    att.compteurs.degats += degats;
    if (critique) att.compteurs.critiques += 1;
    noter(etat, { ...ev, degats, critique });
  }

  if (def.pv <= 0) terminer(etat, att.index, 'ko');
}

function terminer(etat, vainqueur, raison) {
  if (etat.fini) return;
  etat.fini = true;
  etat.phase = 'fin';
  etat.vainqueur = vainqueur;
  etat.raison = raison;
  const g = etat.combattants[vainqueur], p = etat.combattants[1 - vainqueur];
  p.etat = 'ko';
  p.attaque = null;
  p.parade = false;
  g.etat = 'victoire';
  g.attaque = null;
  g.parade = false;
  noter(etat, { type: 'fin', vainqueur, raison });
}

/** À la fin du temps, les juges regardent le % de PV restants */
function decisionDesJuges(etat, alea) {
  const [a, b] = etat.combattants;
  const ra = a.pv / a.stats.pvMax, rb = b.pv / b.stats.pvMax;
  let gagnant;
  if (Math.abs(ra - rb) > 1e-9) gagnant = ra > rb ? 0 : 1;
  else if (a.compteurs.degats !== b.compteurs.degats) gagnant = a.compteurs.degats > b.compteurs.degats ? 0 : 1;
  else gagnant = alea() < 0.5 ? 0 : 1;
  terminer(etat, gagnant, 'juges');
}

/** Tombé trop bas dans un trou (gouffre, lave, crevasse) : c'est la mort */
function verifierChutes(etat, terrain) {
  const tombes = etat.combattants.filter((c) => c.y < terrain.limiteChute);
  if (!tombes.length) return;
  const c = tombes.sort((a, b) => a.y - b.y)[0];   // les deux à la fois : le plus bas perd
  c.pv = 0;
  noter(etat, { type: 'chute', cible: c.index, x: c.x, trou: terrain.typeTrou });
  terminer(etat, 1 - c.index, 'chute');
}

/** Abandon ou déconnexion définitive du combattant i */
export function abandonner(etat, i, raison = 'abandon') {
  terminer(etat, 1 - i, raison);
}

// ----------------------------------------------------------------------------
//  Un pas du match complet (serveur)
// ----------------------------------------------------------------------------
export function etapeMatch(etat, entrees, dt, alea = Math.random) {
  etat.numero += 1;
  const terrain = terrainDe(etat.arene);
  const enCombat = etat.phase === 'combat';
  etat.combattants.forEach((c, i) => etapeCombattant(c, enCombat ? entrees[i] : ENTREE_VIDE, dt, terrain));

  if (etat.phase === 'decompte') {
    etat.decompte -= dt;
    if (etat.decompte <= 0) {
      etat.decompte = 0;
      etat.phase = 'combat';
      noter(etat, { type: 'debut' });
    }
    return;
  }
  if (etat.phase !== 'combat') return;

  verifierChutes(etat, terrain);
  if (etat.fini) return;
  resoudreCoups(etat, alea);
  if (etat.fini) return;
  etat.tempsRestant -= dt;
  if (etat.tempsRestant <= 0) {
    etat.tempsRestant = 0;
    decisionDesJuges(etat, alea);
  }
}

// ----------------------------------------------------------------------------
//  Réseau : état « dynamique » d'un combattant (ce qui bouge), et infos fixes
// ----------------------------------------------------------------------------
const arrondir = (v, p = 10) => Math.round(v * p) / p;

export function dynamique(c) {
  return {
    x: arrondir(c.x), y: arrondir(c.y), vx: arrondir(c.vx), vy: arrondir(c.vy),
    dir: c.dir, auSol: c.auSol, sur: c.sur, sauts: c.sauts, etat: c.etat,
    attaque: c.attaque ? { ...c.attaque, t: arrondir(c.attaque.t, 1000) } : null,
    recharges: {
      legere: arrondir(c.recharges.legere, 1000),
      lourde: arrondir(c.recharges.lourde, 1000),
      esquive: arrondir(c.recharges.esquive, 1000),
    },
    esquiveT: arrondir(c.esquiveT, 1000), invincible: arrondir(c.invincible, 1000),
    etourdi: arrondir(c.etourdi, 1000), sonne: c.sonne, parade: c.parade, paradeDepuis: arrondir(c.paradeDepuis, 1000),
    delaiStamina: arrondir(c.delaiStamina, 1000), delaiGarde: arrondir(c.delaiGarde, 1000),
    descente: arrondir(c.descente, 1000), tampon: c.tampon ? { ...c.tampon } : null,
    pv: c.pv, stamina: arrondir(c.stamina), garde: arrondir(c.garde),
    compteurs: { ...c.compteurs },
  };
}

export function appliquerDynamique(c, d) {
  Object.assign(c, d, {
    attaque: d.attaque ? { ...d.attaque } : null,
    recharges: { ...d.recharges },
    tampon: d.tampon ? { ...d.tampon } : null,
    compteurs: { ...d.compteurs },
  });
}

/** Infos fixes envoyées une fois au début du combat */
export function presentation(c) {
  return { index: c.index, nom: c.nom, skin: c.skin, equipement: c.equipement, niveau: c.niveau, ia: c.ia, stats: c.stats };
}

/** Recrée un combattant côté navigateur à partir de sa présentation + état */
export function combattantDepuis(pres, dyn) {
  const c = {
    ...pres,
    x: 0, y: 0, vx: 0, vy: 0, dir: 1, auSol: true, sur: -1, sauts: T.saut.sautsMax, etat: 'libre', attaque: null,
    recharges: { legere: 0, lourde: 0, esquive: 0 }, esquiveT: 0, invincible: 0, etourdi: 0, sonne: false, parade: false,
    paradeDepuis: 0, delaiStamina: 0, delaiGarde: 0, descente: 0, tampon: null, pv: 0, stamina: 0, garde: 0,
    compteurs: { degats: 0, attaques: 0, touches: 0, critiques: 0, parfaites: 0 },
  };
  appliquerDynamique(c, dyn);
  return c;
}
