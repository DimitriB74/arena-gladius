// ============================================================================
//  ARENA GLADIUS — client/js/combat/controles.js
//
//  Lecture des commandes pendant un combat en temps réel : clavier, souris
//  et manette. On lit la position PHYSIQUE des touches (event.code), donc
//  ZQSD en AZERTY et WASD en QWERTY marchent sans rien régler.
//
//  lireEntree() → { g, d, b, p, saut, legere, lourde, esquive }
//    g, d, b, p          : touches tenues (gauche, droite, bas, parade)
//    saut, legere, ...   : touches pressées depuis la lecture précédente
// ============================================================================

// Touches physiques (nom QWERTY de la touche → même place sur un clavier AZERTY).
// Tout est groupé autour de ZQSD : la main gauche fait tout, la droite peut
// rester sur la souris.
export const TOUCHES = {
  g: ['KeyA', 'ArrowLeft'],               // Q en AZERTY
  d: ['KeyD', 'ArrowRight'],
  b: ['KeyS', 'ArrowDown'],
  p: ['KeyQ'],                            // A en AZERTY : parer (maintenir)
  saut: ['KeyW', 'ArrowUp', 'Space'],     // Z en AZERTY
  legere: ['KeyE'],
  lourde: ['KeyR'],
  esquive: ['ShiftLeft', 'ShiftRight'],
};

// Libellés affichés au joueur (clavier AZERTY d'abord, puisque le jeu est en français)
export const AIDE_TOUCHES = [
  { action: 'Se déplacer', touches: 'Q D', alt: '← →' },
  { action: 'Sauter (×2)', touches: 'Z', alt: 'Espace' },
  { action: 'Descendre', touches: 'S', alt: '↓' },
  { action: 'Attaque légère', touches: 'E', alt: 'clic gauche' },
  { action: 'Attaque lourde', touches: 'R', alt: 'clic droit' },
  { action: 'Parer (maintenir)', touches: 'A', alt: '' },
  { action: 'Esquive', touches: 'Maj', alt: '' },
];

const CODES = new Map();
for (const [action, codes] of Object.entries(TOUCHES)) for (const c of codes) CODES.set(c, action);

const tenues = new Set();                 // actions dont une touche est enfoncée
const pressees = new Set();               // actions pressées depuis la dernière lecture
let actif = false;
let manettePrecedente = {};

function surTouche(e) {
  if (!actif) return;
  const action = CODES.get(e.code);
  if (!action) return;
  if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
  e.preventDefault();
  if (e.type === 'keydown') {
    if (!e.repeat) pressees.add(action);
    tenues.add(`${action}:${e.code}`);
  } else {
    tenues.delete(`${action}:${e.code}`);
  }
}

const tenue = (action) => [...tenues].some((t) => t.startsWith(`${action}:`));

function surSouris(e) {
  if (!actif || e.target?.id !== 'scene') return;
  if (e.button === 0) pressees.add('legere');
  if (e.button === 2) pressees.add('lourde');
}

function toutRelacher() {
  tenues.clear();
  pressees.clear();
}

/** Manette standard : A saut, B esquive, X légère, Y lourde, gâchettes / RB parade */
function lireManette() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const pad = pads[0];
  if (!pad) return null;
  const bouton = (i) => !!pad.buttons[i]?.pressed;
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  const etat = {
    g: ax < -0.4 || bouton(14),
    d: ax > 0.4 || bouton(15),
    b: ay > 0.6 || bouton(13),
    p: bouton(4) || bouton(5) || bouton(6) || bouton(7),
    saut: bouton(0) || bouton(12),
    esquive: bouton(1),
    legere: bouton(2),
    lourde: bouton(3),
  };
  // Pour les actions « pressées », on ne garde que le moment où le bouton s'enfonce
  const fronts = {};
  for (const k of ['saut', 'esquive', 'legere', 'lourde']) {
    fronts[k] = etat[k] && !manettePrecedente[k];
  }
  manettePrecedente = etat;
  return { ...etat, ...fronts };
}

export function lireEntree() {
  const e = {
    g: tenue('g'),
    d: tenue('d'),
    b: tenue('b'),
    p: tenue('p'),
    saut: pressees.has('saut'),
    legere: pressees.has('legere'),
    lourde: pressees.has('lourde'),
    esquive: pressees.has('esquive'),
  };
  pressees.clear();
  const m = lireManette();
  if (m) for (const k of Object.keys(e)) e[k] = e[k] || m[k];
  // Gauche + droite ensemble : on ne bouge pas
  if (e.g && e.d) { e.g = false; e.d = false; }
  return e;
}

export function demarrerControles() {
  actif = true;
  toutRelacher();
}

export function arreterControles() {
  actif = false;
  toutRelacher();
}

addEventListener('keydown', surTouche);
addEventListener('keyup', surTouche);
addEventListener('mousedown', surSouris);
addEventListener('blur', toutRelacher);
// Pas de menu contextuel sur l'arène (clic droit = attaque lourde)
addEventListener('contextmenu', (e) => { if (actif && e.target?.id === 'scene') e.preventDefault(); });
