// ============================================================================
//  ARENA GLADIUS — client/js/audio.js
//  Petits effets sonores synthétisés avec Web Audio (aucun fichier externe).
//  jouerSon('coup' | 'critique' | 'rate' | 'bouclier' | 'pas' | 'repos' |
//           'piece' | 'clic' | 'victoire' | 'defaite' | 'foule' | 'tic' | 'defi' | 'gong')
// ============================================================================

const CLE_VOLUME = 'arena-gladius:volume-effets';
let ctx = null;
let busEffets = null;
// Volume des bruitages, de 0 (coupé) à 1 ; l'ancien réglage « muet » est repris
let volume = 0.8;
try {
  const v = localStorage.getItem(CLE_VOLUME);
  if (v !== null) volume = Math.max(0, Math.min(1, Number(v) || 0));
  else if (localStorage.getItem('arena-gladius:muet') === '1') volume = 0;
} catch { /* rien */ }

/** Contexte audio partagé (bruitages + musique), créé à la demande */
export function contexte() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Le contexte audio s'il existe déjà et joue (sans en créer un avant le premier clic) */
export const contexteActif = () => (ctx && ctx.state === 'running' ? ctx : null);

// Le navigateur n'autorise le son qu'après un premier clic ou une touche :
// on prévient alors ceux qui attendaient (la musique)
const attenteGeste = [];
export function surPremierGeste(fn) {
  if (ctx && ctx.state === 'running') fn();
  else attenteGeste.push(fn);
}
function premierGeste() {
  const c = contexte();
  if (!c) return;
  const prevenir = () => { while (attenteGeste.length) attenteGeste.shift()(); };
  if (c.state === 'running') prevenir();
  else c.resume().then(prevenir);
  removeEventListener('pointerdown', premierGeste);
  removeEventListener('keydown', premierGeste);
}
addEventListener('pointerdown', premierGeste);
addEventListener('keydown', premierGeste);

/** Sortie des bruitages (avec leur volume) */
function sortieEffets(c) {
  if (!busEffets) {
    busEffets = c.createGain();
    busEffets.connect(c.destination);
  }
  busEffets.gain.value = volume;
  return busEffets;
}

export const volumeEffets = () => volume;
export function reglerVolumeEffets(v) {
  volume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(CLE_VOLUME, String(volume)); } catch { /* rien */ }
  if (busEffets && ctx) busEffets.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
}

// ----------------------------------------------------------------------------
//  Briques de base
// ----------------------------------------------------------------------------
function note(c, { freq, fin = freq, duree = 0.2, type = 'sine', volume = 0.2, depart = 0 }) {
  const t = c.currentTime + depart;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, fin), t + duree);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g).connect(sortieEffets(c));
  o.start(t);
  o.stop(t + duree + 0.05);
}

function bruit(c, { duree = 0.2, volume = 0.3, filtre = 'lowpass', freq = 1200, fin = freq, q = 1, depart = 0, attaque = 0.005 }) {
  const t = c.currentTime + depart;
  const tampon = c.createBuffer(1, Math.ceil(c.sampleRate * duree), c.sampleRate);
  const donnees = tampon.getChannelData(0);
  for (let i = 0; i < donnees.length; i++) donnees[i] = Math.random() * 2 - 1;
  const source = c.createBufferSource();
  source.buffer = tampon;
  const f = c.createBiquadFilter();
  f.type = filtre;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, fin), t + duree);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  source.connect(f).connect(g).connect(sortieEffets(c));
  source.start(t);
}

// ----------------------------------------------------------------------------
//  Catalogue des sons
// ----------------------------------------------------------------------------
const SONS = {
  clic: (c) => note(c, { freq: 660, fin: 520, duree: 0.06, type: 'triangle', volume: 0.08 }),
  pas: (c) => bruit(c, { duree: 0.12, volume: 0.25, freq: 400, fin: 120 }),
  rate: (c) => bruit(c, { duree: 0.28, volume: 0.22, filtre: 'bandpass', freq: 600, fin: 2400, q: 2, attaque: 0.08 }),
  coup: (c) => {
    bruit(c, { duree: 0.18, volume: 0.45, freq: 1800, fin: 200 });
    note(c, { freq: 140, fin: 60, duree: 0.2, type: 'sine', volume: 0.4 });
  },
  critique: (c) => {
    SONS.coup(c);
    note(c, { freq: 1300, fin: 900, duree: 0.35, type: 'square', volume: 0.06, depart: 0.02 });
    bruit(c, { duree: 0.3, volume: 0.25, filtre: 'highpass', freq: 3000, depart: 0.03 });
  },
  bouclier: (c) => {
    note(c, { freq: 900, fin: 700, duree: 0.4, type: 'triangle', volume: 0.15 });
    note(c, { freq: 1350, fin: 1100, duree: 0.3, type: 'sine', volume: 0.08 });
  },
  repos: (c) => note(c, { freq: 300, fin: 450, duree: 0.5, type: 'sine', volume: 0.1 }),
  piece: (c) => {
    note(c, { freq: 1200, duree: 0.08, type: 'square', volume: 0.06 });
    note(c, { freq: 1800, duree: 0.25, type: 'square', volume: 0.06, depart: 0.07 });
  },
  tic: (c) => note(c, { freq: 1000, duree: 0.04, type: 'square', volume: 0.05 }),
  defi: (c) => {
    [392, 523, 659].forEach((f, i) => note(c, { freq: f, duree: 0.25, type: 'sawtooth', volume: 0.07, depart: i * 0.12 }));
  },
  gong: (c) => {
    note(c, { freq: 110, fin: 100, duree: 1.4, type: 'sine', volume: 0.35 });
    note(c, { freq: 223, fin: 210, duree: 1.0, type: 'triangle', volume: 0.1 });
  },
  foule: (c) => bruit(c, { duree: 1.6, volume: 0.18, filtre: 'bandpass', freq: 900, fin: 1300, q: 0.6, attaque: 0.4 }),
  victoire: (c) => {
    [523, 659, 784, 1047].forEach((f, i) => note(c, { freq: f, duree: 0.3 + (i === 3 ? 0.5 : 0), type: 'triangle', volume: 0.15, depart: i * 0.14 }));
    SONS.foule(c);
  },
  defaite: (c) => {
    [392, 330, 262].forEach((f, i) => note(c, { freq: f, fin: f * 0.97, duree: 0.45, type: 'triangle', volume: 0.13, depart: i * 0.25 }));
  },
};

export function jouerSon(nom) {
  if (volume <= 0 || !SONS[nom]) return;
  const c = contexte();
  if (!c) return;
  try { SONS[nom](c); } catch { /* le son n'est jamais bloquant */ }
}
