// ============================================================================
//  ARENA GLADIUS — client/js/musique.js
//
//  Musiques d'ambiance d'inspiration romaine, composées EN DIRECT par le code
//  (Web Audio, aucun fichier) :
//  - instruments synthétisés : lyre / cithare (cordes pincées), aulos (flûte
//    double à anche), cornu (trompe de bronze), tympanum (tambour grave),
//    tambourin, crotales (cymbalettes), enclume, bourdon, foule
//  - modes antiques (dorien, phrygien, mixolydien, éolien)
//  - chaque thème = tempo + mode + suite d'accords + pistes (arpèges, basse,
//    percussions, mélodie générée au hasard dans le mode à chaque phrase)
//
//  jouerTheme('village')  → fondu enchaîné vers ce thème
//  reglerVolumeMusique(0.6) → volume de 0 (coupée) à 1
//  Thèmes : titre, village, forge, boutique, colisee, combat, triomphe, lamento
// ============================================================================

import { contexteActif, surPremierGeste } from './audio.js';

const CLE_VOLUME = 'arena-gladius:volume-musique';
const VOLUME_GENERAL = 0.5;
const AVANCE = 0.15;          // on programme les notes 150 ms à l'avance
const PAS_PAR_MESURE = 16;    // doubles croches

const MODES = {
  dorien:     [0, 2, 3, 5, 7, 9, 10],
  phrygien:   [0, 1, 3, 5, 7, 8, 10],
  mixolydien: [0, 2, 4, 5, 7, 9, 10],
  eolien:     [0, 2, 3, 5, 7, 8, 10],
};

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// ----------------------------------------------------------------------------
//  Les thèmes (un par lieu)
//  accords : degré du mode joué à chaque mesure (en boucle)
//  pistes  : type 'arpege' (motif de degrés sur 16 pas, null = silence),
//            'percu' (motif texte : X = accent, x = coup, o = coup une fois sur deux),
//            'accord' (accord plaqué sur les pas marqués), 'melodie' (générée)
//  gain    : volume du thème (pour équilibrer thèmes calmes et thèmes rythmés)
// ----------------------------------------------------------------------------
const _ = null;
const THEMES = {
  // ---- Musiques de MENU : calmes et peu répétitives (on y reste longtemps) ----
  // Pas de percussion métallique (pas de « ding »), une nappe douce en fond,
  // une lyre qui improvise (notes au hasard dans l'accord) et une flûte rare.

  // Écran titre : solennel et apaisé, nappe grave, trompe lointaine
  titre: {
    bpm: 64, mode: 'dorien', racine: 50, accords: [0, 6, 5, 4, 0, 3, 6, 0], gain: 1.1,
    bourdon: 0.02,
    pistes: [
      { type: 'accord', instr: 'nappe', octave: 0, volume: 0.03, duree: 16, motif: 'X...............' },
      { type: 'arpege', instr: 'lyre', octave: 0, volume: 0.06, duree: 4, probabilite: 0.55, varier: true,
        motif: [0, _, _, _, 4, _, _, _, 2, _, _, _, 7, _, _, _] },
      { type: 'melodie', instr: 'cornu', octave: 0, volume: 0.03, repos: 0.55,
        rythmes: ['x...............', 'x.......x.......', 'x...........x...'] },
      { type: 'percu', instr: 'tympanum', volume: 0.1, motif: 'x...............', probabilite: 0.5 },
    ],
  },
  // Village : pastorale et tranquille
  village: {
    bpm: 76, mode: 'mixolydien', racine: 55, accords: [0, 3, 6, 0, 4, 3, 1, 4], gain: 1.3,
    pistes: [
      { type: 'accord', instr: 'nappe', octave: 0, volume: 0.025, duree: 16, motif: 'X...............' },
      { type: 'arpege', instr: 'lyre', octave: 0, volume: 0.055, duree: 3, probabilite: 0.5, varier: true,
        motif: [0, _, _, 4, _, _, 2, _, 7, _, _, 4, _, _, 2, _] },
      { type: 'arpege', instr: 'lyre', octave: -1, volume: 0.07, duree: 8, motif: [0, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _] },
      { type: 'melodie', instr: 'aulos', octave: 1, volume: 0.025, repos: 0.55,
        rythmes: ['x.......x...x...', 'x...x.......x...', 'x.....x.x.......', 'x...............'] },
      { type: 'percu', instr: 'tambourin', volume: 0.04, motif: 'x.......x.......', probabilite: 0.6 },
    ],
  },
  // Forge : chaude et grave, comme la lueur du foyer
  forge: {
    bpm: 70, mode: 'dorien', racine: 45, accords: [0, 0, 5, 6, 0, 3, 5, 4], gain: 1.2,
    bourdon: 0.03,
    pistes: [
      { type: 'accord', instr: 'nappe', octave: 0, volume: 0.025, duree: 16, motif: 'X...............' },
      { type: 'arpege', instr: 'lyre', octave: 0, volume: 0.055, duree: 4, probabilite: 0.5, varier: true,
        motif: [0, _, _, _, _, _, 4, _, _, _, 2, _, _, _, _, _] },
      { type: 'arpege', instr: 'lyre', octave: -1, volume: 0.08, duree: 8, motif: [0, _, _, _, _, _, _, _, 4, _, _, _, _, _, _, _] },
      { type: 'melodie', instr: 'aulos', octave: 1, volume: 0.022, repos: 0.6,
        rythmes: ['x.......x.......', 'x...........x...', 'x...............'] },
      { type: 'percu', instr: 'tympanum', volume: 0.08, motif: 'x.......x.......', probabilite: 0.5 },
    ],
  },
  // Armurerie : douce et élégante
  boutique: {
    bpm: 68, mode: 'mixolydien', racine: 53, accords: [0, 4, 3, 6, 0, 5, 3, 4], gain: 1.4,
    pistes: [
      { type: 'accord', instr: 'nappe', octave: 0, volume: 0.025, duree: 16, motif: 'X...............' },
      { type: 'arpege', instr: 'lyre', octave: 0, volume: 0.055, duree: 4, probabilite: 0.5, varier: true,
        motif: [0, _, _, 2, _, _, 4, _, _, _, 7, _, _, _, 4, _] },
      { type: 'melodie', instr: 'aulos', octave: 1, volume: 0.025, repos: 0.55,
        rythmes: ['x.......x...x...', 'x...............', 'x.....x.........'] },
    ],
  },
  // Entrée du Colisée : la foule gronde, tambours et trompes montent en tension
  colisee: {
    bpm: 108, mode: 'phrygien', racine: 52, accords: [0, 1, 0, 6],
    bourdon: 0.03, foule: 0.045,
    pistes: [
      { type: 'arpege', instr: 'lyre', octave: -1, volume: 0.1, duree: 2, motif: [0, _, 0, _, 7, _, 0, _, 0, _, 0, _, 7, _, 5, _] },
      { type: 'accord', instr: 'cornu', octave: 0, volume: 0.05, duree: 4, motif: 'X...........X...' },
      { type: 'percu', instr: 'tympanum', volume: 0.32, motif: 'X...x...X...x.x.' },
      { type: 'percu', instr: 'tambourin', volume: 0.08, motif: 'x.x.x.x.x.x.x.xx' },
      { type: 'percu', instr: 'crotales', volume: 0.03, motif: 'x.......x.......' },
    ],
  },
  // Combat : rapide et martial, ostinato grave, tambours de guerre, trompes
  combat: {
    bpm: 150, mode: 'phrygien', racine: 40, accords: [0, 0, 1, 0, 0, 0, 6, 5],
    bourdon: 0.025, foule: 0.03,
    pistes: [
      { type: 'arpege', instr: 'lyre', octave: 0, volume: 0.12, duree: 2, motif: [0, _, 0, _, 7, _, 0, _, 1, _, 0, _, 7, _, 3, _] },
      { type: 'accord', instr: 'cornu', octave: 1, volume: 0.05, duree: 3, motif: 'X.........X.....' },
      { type: 'melodie', instr: 'aulos', octave: 2, volume: 0.035, repos: 0.2,
        rythmes: ['x.x.x.x.x.x.x.x.', 'x..x..x.x.x.x...', 'xxx.x.x.xxx.x...', 'x.x.xxx.x...x.x.'] },
      { type: 'percu', instr: 'tympanum', volume: 0.38, motif: 'X..x..X.X..x..x.' },
      { type: 'percu', instr: 'tambourin', volume: 0.11, motif: '..x...x...x.x.xx' },
      { type: 'percu', instr: 'crotales', volume: 0.022, motif: 'x...x...x...x...' },
    ],
  },
  // Victoire : fanfare joyeuse et foule en liesse
  triomphe: {
    bpm: 116, mode: 'mixolydien', racine: 48, accords: [0, 3, 4, 0],
    foule: 0.05,
    pistes: [
      { type: 'arpege', instr: 'cornu', octave: 1, volume: 0.045, duree: 2, motif: [0, _, 2, _, 4, _, 7, _, 4, _, 7, _, 9, _, 7, _] },
      { type: 'arpege', instr: 'lyre', octave: -1, volume: 0.11, duree: 4, motif: [0, _, _, _, 4, _, _, _, 0, _, _, _, 4, _, _, _] },
      { type: 'percu', instr: 'tympanum', volume: 0.28, motif: 'X.......X...x...' },
      { type: 'percu', instr: 'tambourin', volume: 0.08, motif: 'x...x...x...x...' },
    ],
  },
  // Défaite : lamentation lente
  lamento: {
    bpm: 58, mode: 'eolien', racine: 45, accords: [0, 5, 3, 4], gain: 1.5,
    bourdon: 0.03,
    pistes: [
      { type: 'arpege', instr: 'lyre', octave: 0, volume: 0.08, duree: 6, motif: [0, _, _, _, 2, _, _, _, 4, _, _, _, 2, _, _, _] },
      { type: 'melodie', instr: 'aulos', octave: 1, volume: 0.035, repos: 0.3,
        rythmes: ['x.......x.......', 'x...........x...', 'x.....x.........'] },
    ],
  },
};

// ----------------------------------------------------------------------------
//  Instruments (chacun joue une note sur `sortie` au temps t)
// ----------------------------------------------------------------------------
let tamponBruit = null;
function bruitBlanc(c) {
  if (!tamponBruit) {
    tamponBruit = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = tamponBruit.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = tamponBruit;
  return s;
}

function gainEnveloppe(c, t, volume, attaque, tenue, relache) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + attaque);
  if (tenue > attaque) g.gain.setValueAtTime(volume, t + tenue);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(tenue, attaque) + relache);
  return g;
}

const INSTRUMENTS = {
  // Lyre / cithare : corde pincée (triangle + harmoniques, filtre qui se referme)
  lyre(c, sortie, t, f, duree, volume) {
    const fin = Math.max(0.9, duree * 1.4);
    const g = gainEnveloppe(c, t, volume, 0.004, 0.004, fin);
    const filtre = c.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.setValueAtTime(Math.min(9000, f * 9), t);
    filtre.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.6), t + fin);
    filtre.connect(g).connect(sortie);
    for (const [mult, part, type] of [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine']]) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = type;
      o.frequency.value = f * mult;
      og.gain.value = part;
      o.connect(og).connect(filtre);
      o.start(t);
      o.stop(t + fin + 0.05);
    }
  },

  // Aulos : double anche nasillarde avec vibrato
  aulos(c, sortie, t, f, duree, volume) {
    const tenue = Math.max(0.08, duree - 0.04);
    const g = gainEnveloppe(c, t, volume, 0.04, tenue, 0.09);
    const filtre = c.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.value = Math.min(4200, Math.max(1400, f * 4));
    filtre.Q.value = 3;
    filtre.connect(g).connect(sortie);
    const vibrato = c.createOscillator();
    const profondeur = c.createGain();
    vibrato.frequency.value = 5.5;
    profondeur.gain.setValueAtTime(0, t);
    profondeur.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.25, tenue));
    vibrato.connect(profondeur);
    for (const [type, mult, part] of [['sawtooth', 1, 0.7], ['square', 1.004, 0.3]]) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = type;
      o.frequency.value = f * mult;
      og.gain.value = part;
      profondeur.connect(o.frequency);
      o.connect(og).connect(filtre);
      o.start(t);
      o.stop(t + tenue + 0.15);
    }
    vibrato.start(t);
    vibrato.stop(t + tenue + 0.15);
  },

  // Cornu / buccina : trompe de bronze (attaque cuivrée, légère glissade)
  cornu(c, sortie, t, f, duree, volume) {
    const tenue = Math.max(0.1, duree - 0.05);
    const g = gainEnveloppe(c, t, volume, 0.03, tenue, 0.14);
    const filtre = c.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.setValueAtTime(300, t);
    filtre.frequency.exponentialRampToValueAtTime(Math.min(3500, f * 6), t + 0.07);
    filtre.frequency.exponentialRampToValueAtTime(Math.min(2500, f * 3), t + tenue);
    filtre.connect(g).connect(sortie);
    for (const [mult, part] of [[1, 0.8], [0.5, 0.25]]) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = 'sawtooth';
      o.frequency.value = f * mult;
      o.detune.setValueAtTime(-40, t);
      o.detune.linearRampToValueAtTime(0, t + 0.06);
      og.gain.value = part;
      o.connect(og).connect(filtre);
      o.start(t);
      o.stop(t + tenue + 0.2);
    }
  },

  // Nappe : accord tenu très doux (attaque et extinction lentes), pour les menus
  nappe(c, sortie, t, f, duree, volume) {
    const tenue = Math.max(0.8, duree);
    const g = gainEnveloppe(c, t, volume, 0.9, tenue, 1.6);
    const filtre = c.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.value = Math.min(1400, f * 3);
    filtre.connect(g).connect(sortie);
    for (const [type, desaccord, part] of [['triangle', -6, 0.6], ['triangle', 6, 0.6], ['sawtooth', 0, 0.15]]) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = desaccord;
      og.gain.value = part;
      o.connect(og).connect(filtre);
      o.start(t);
      o.stop(t + tenue + 1.7);
    }
  },

  // Tympanum : grand tambour grave
  tympanum(c, sortie, t, volume) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.3);
    const g = gainEnveloppe(c, t, volume, 0.003, 0.003, 0.45);
    o.connect(g).connect(sortie);
    o.start(t);
    o.stop(t + 0.5);
    const b = bruitBlanc(c);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 350;
    const gb = gainEnveloppe(c, t, volume * 0.5, 0.002, 0.002, 0.08);
    b.connect(f).connect(gb).connect(sortie);
    b.start(t, Math.random() * 1.5, 0.12);
  },

  // Tambourin (tambour sur cadre)
  tambourin(c, sortie, t, volume) {
    const b = bruitBlanc(c);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 1;
    const g = gainEnveloppe(c, t, volume, 0.002, 0.002, 0.11);
    b.connect(f).connect(g).connect(sortie);
    b.start(t, Math.random() * 1.5, 0.15);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(230, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.12);
    const go = gainEnveloppe(c, t, volume * 0.4, 0.002, 0.002, 0.13);
    o.connect(go).connect(sortie);
    o.start(t);
    o.stop(t + 0.16);
  },

  // Crotales : petites cymbales de doigts (métal qui tinte)
  crotales(c, sortie, t, volume) {
    for (const [f, part] of [[2637, 1], [3959, 0.6], [5311, 0.35]]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const g = gainEnveloppe(c, t, volume * part, 0.002, 0.002, 0.9);
      o.connect(g).connect(sortie);
      o.start(t);
      o.stop(t + 0.95);
    }
  },

  // Enclume : coup de marteau métallique (thème de la forge)
  enclume(c, sortie, t, volume) {
    for (const [f, part, duree] of [[1480, 1, 0.5], [2380, 0.7, 0.35], [3810, 0.4, 0.25]]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const g = gainEnveloppe(c, t, volume * part, 0.001, 0.001, duree);
      o.connect(g).connect(sortie);
      o.start(t);
      o.stop(t + duree + 0.05);
    }
    const b = bruitBlanc(c);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 3000;
    const gb = gainEnveloppe(c, t, volume * 0.8, 0.001, 0.001, 0.04);
    b.connect(f).connect(gb).connect(sortie);
    b.start(t, Math.random() * 1.5, 0.06);
  },
};

// ----------------------------------------------------------------------------
//  Mélodies générées : une phrase de 4 mesures (A A' B A'') dans le mode
// ----------------------------------------------------------------------------
function graine(n) {
  let s = n % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function genererPhrase(piste, numero) {
  const r = graine(numero * 7919 + 13);
  const choisir = (liste) => liste[Math.floor(r() * liste.length)];
  const mesure = (rythme, depart) => {
    const notes = [];
    let degre = depart;
    const debuts = [...rythme].map((ch, i) => (ch === 'x' ? i : -1)).filter((i) => i >= 0);
    debuts.forEach((pas, k) => {
      const suivant = debuts[k + 1] ?? PAS_PAR_MESURE;
      if (k > 0) degre = Math.max(-2, Math.min(9, degre + choisir([-2, -1, -1, 1, 1, 2, 0, 3, -3])));
      // Les temps forts retombent sur une note de l'accord
      if (pas % 8 === 0) degre = [0, 2, 4, 7].reduce((a, b) => (Math.abs(b - degre) < Math.abs(a - degre) ? b : a));
      notes.push({ pas, degre, duree: suivant - pas });
    });
    return notes;
  };
  const rythmeA = choisir(piste.rythmes);
  const a = mesure(rythmeA, choisir([0, 2, 4]));
  const a2 = a.map((n, i) => (i === a.length - 1 ? { ...n, degre: n.degre + choisir([-1, 1, 2]) } : n));
  const b = mesure(choisir(piste.rythmes), choisir([2, 4, 7]));
  const fin = a.map((n, i) => (i === a.length - 1 ? { ...n, degre: 0, duree: PAS_PAR_MESURE - n.pas } : n));
  // Silences occasionnels pour laisser respirer
  return [a, a2, b, fin].map((m) => (r() < (piste.repos || 0) ? [] : m));
}

// ----------------------------------------------------------------------------
//  Lecture d'un thème
// ----------------------------------------------------------------------------
class Lecture {
  constructor(c, bus, id) {
    this.c = c;
    this.id = id;
    this.theme = THEMES[id];
    this.sortie = c.createGain();
    this.sortie.gain.setValueAtTime(0.0001, c.currentTime);
    this.sortie.gain.exponentialRampToValueAtTime(this.theme.gain || 1, c.currentTime + 1.2);
    this.sortie.connect(bus);
    this.dureePas = 60 / this.theme.bpm / 4;
    this.prochain = c.currentTime + 0.1;
    this.pas = 0;
    this.phrases = {};
    this.sources = [];
    this.demarrerNappes();
  }

  // Bourdon (quinte tenue) et rumeur de la foule, en continu
  demarrerNappes() {
    const { c, theme } = this;
    if (theme.bourdon) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 520;
      const g = c.createGain();
      g.gain.value = theme.bourdon;
      f.connect(g).connect(this.sortie);
      for (const intervalle of [0, 7, 12]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(theme.racine - 12 + intervalle);
        o.detune.value = (Math.random() - 0.5) * 8;
        o.connect(f);
        o.start();
        this.sources.push(o);
      }
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 0.15;
      lg.gain.value = 180;
      lfo.connect(lg).connect(f.frequency);
      lfo.start();
      this.sources.push(lfo);
    }
    if (theme.foule) {
      const b = bruitBlanc(c);
      b.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 850;
      f.Q.value = 0.7;
      const g = c.createGain();
      g.gain.value = theme.foule;
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 0.23;
      lg.gain.value = theme.foule * 0.5;
      lfo.connect(lg).connect(g.gain);
      b.connect(f).connect(g).connect(this.sortie);
      b.start();
      lfo.start();
      this.sources.push(b, lfo);
    }
  }

  note(midi, t, instr, duree, volume) {
    INSTRUMENTS[instr](this.c, this.sortie, t, hz(midi), duree, volume);
  }

  /** Hauteur MIDI d'un degré du mode, à partir du degré de l'accord */
  hauteur(degreAccord, degre, octave) {
    const mode = MODES[this.theme.mode];
    const d = degreAccord + degre;
    const oct = Math.floor(d / 7);
    return this.theme.racine + 12 * (octave + oct) + mode[((d % 7) + 7) % 7];
  }

  jouerPas(pas, t) {
    const { theme } = this;
    const numMesure = Math.floor(pas / PAS_PAR_MESURE);
    const p = pas % PAS_PAR_MESURE;
    const accord = theme.accords[numMesure % theme.accords.length];
    const d = this.dureePas;
    theme.pistes.forEach((piste, k) => {
      switch (piste.type) {
        case 'arpege': {
          let degre = piste.motif[p];
          if (degre == null) break;
          // probabilite : certaines notes sautent ; varier : la lyre « improvise »
          // une autre note de l'accord, pour ne pas répéter la même boucle
          if (piste.probabilite != null && Math.random() > piste.probabilite) break;
          if (piste.varier && Math.random() < 0.4) degre = [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)];
          const nuance = piste.varier ? 0.7 + Math.random() * 0.3 : 1;
          this.note(this.hauteur(accord, degre, piste.octave), t, piste.instr, piste.duree * d, piste.volume * nuance);
          break;
        }
        case 'accord': {
          const c = piste.motif[p];
          if (c === 'X' || c === 'x') {
            for (const degre of [0, 2, 4]) this.note(this.hauteur(accord, degre, piste.octave), t, piste.instr, piste.duree * d, piste.volume * (c === 'X' ? 1 : 0.7));
          }
          break;
        }
        case 'percu': {
          const c = piste.motif[p];
          let joue = c === 'X' || c === 'x' || (c === 'o' && Math.random() < 0.5);
          if (joue && piste.probabilite != null && Math.random() > piste.probabilite) joue = false;
          if (joue) INSTRUMENTS[piste.instr](this.c, this.sortie, t, piste.volume * (c === 'X' ? 1.25 : 1));
          break;
        }
        case 'melodie': {
          const numPhrase = Math.floor(numMesure / 4);
          const cle = `${k}:${numPhrase}`;
          if (!this.phrases[cle]) {
            this.phrases = { [cle]: genererPhrase(piste, numPhrase * 31 + k + this.id.length) };
          }
          const notes = this.phrases[cle][numMesure % 4];
          for (const n of notes) {
            if (n.pas === p) this.note(this.hauteur(accord, n.degre, piste.octave), t, piste.instr, n.duree * d, piste.volume);
          }
          break;
        }
        default:
          break;
      }
    });
  }

  /** Programme les notes des prochaines ~150 ms */
  planifier() {
    const limite = this.c.currentTime + AVANCE;
    // Si l'onglet a été mis en pause, on repart d'ici sans rattraper le retard
    if (this.prochain < this.c.currentTime - 0.5) this.prochain = this.c.currentTime + 0.05;
    while (this.prochain < limite) {
      this.jouerPas(this.pas, this.prochain);
      this.pas += 1;
      this.prochain += this.dureePas;
    }
  }

  arreter(fondu = 1.2) {
    const t = this.c.currentTime;
    this.sortie.gain.cancelScheduledValues(t);
    this.sortie.gain.setValueAtTime(Math.max(0.0001, this.sortie.gain.value), t);
    this.sortie.gain.exponentialRampToValueAtTime(0.0001, t + fondu);
    setTimeout(() => {
      this.sources.forEach((s) => { try { s.stop(); } catch { /* déjà arrêtée */ } });
      this.sortie.disconnect();
    }, (fondu + 0.3) * 1000);
  }
}

// ----------------------------------------------------------------------------
//  Pilotage
// ----------------------------------------------------------------------------
let bus = null;
let lecture = null;
let themeVoulu = null;
let minuteur = null;
// Volume de la musique, de 0 (coupée) à 1 ; l'ancien réglage « musique coupée » est repris
let volume = 0.6;
try {
  const v = localStorage.getItem(CLE_VOLUME);
  if (v !== null) volume = Math.max(0, Math.min(1, Number(v) || 0));
  else if (localStorage.getItem('arena-gladius:musique-muette') === '1') volume = 0;
} catch { /* rien */ }

function preparerBus(c) {
  if (bus) return bus;
  const compresseur = c.createDynamicsCompressor();
  compresseur.threshold.value = -18;
  compresseur.ratio.value = 4;
  bus = c.createGain();
  bus.gain.value = VOLUME_GENERAL * volume;
  bus.connect(compresseur).connect(c.destination);
  return bus;
}

function boucle() {
  if (lecture && !document.hidden) lecture.planifier();
}

function lancer() {
  const c = contexteActif();
  if (!c || volume <= 0 || !themeVoulu || document.hidden) return;
  if (lecture?.id === themeVoulu) return;
  lecture?.arreter();
  lecture = new Lecture(c, preparerBus(c), themeVoulu);
  if (!minuteur) minuteur = setInterval(boucle, 40);
}

function couper(fondu = 1.2) {
  lecture?.arreter(fondu);
  lecture = null;
}

/** Change de musique (fondu enchaîné). null = silence */
export function jouerTheme(id) {
  themeVoulu = THEMES[id] ? id : null;
  if (!themeVoulu) { couper(); return; }
  lancer();
}

export const volumeMusique = () => volume;

/** Règle le volume de la musique (0 à 1). À 0, la musique s'arrête complètement. */
export function reglerVolumeMusique(v) {
  volume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(CLE_VOLUME, String(volume)); } catch { /* rien */ }
  const c = contexteActif();
  if (bus && c) bus.gain.setTargetAtTime(VOLUME_GENERAL * volume, c.currentTime, 0.05);
  if (volume <= 0) couper(0.4); else lancer();
}

/** Pour la console : quel thème joue en ce moment ? */
export const etatMusique = () => ({ joue: lecture?.id || null, voulu: themeVoulu, volume, pas: lecture?.pas || 0 });

// La musique démarre au premier clic (règle des navigateurs)
surPremierGeste(lancer);

// Onglet caché : on se tait ; au retour, on reprend
document.addEventListener('visibilitychange', () => {
  if (document.hidden) couper(0.3);
  else lancer();
});

export const THEMES_DISPONIBLES = Object.keys(THEMES);

/**
 * Outil de vérification : « enregistre » un thème hors ligne (sans le jouer)
 * et renvoie son niveau sonore. Utilisable depuis la console du navigateur.
 */
export async function analyserTheme(id, secondes = 8) {
  const taux = 22050;
  const c = new OfflineAudioContext(1, taux * secondes, taux);
  const sortieBus = c.createGain();
  sortieBus.gain.value = VOLUME_GENERAL;
  sortieBus.connect(c.destination);
  const l = new Lecture(c, sortieBus, id);
  for (; 0.1 + l.pas * l.dureePas < secondes - 0.5; l.pas++) l.jouerPas(l.pas, 0.1 + l.pas * l.dureePas);
  const rendu = await c.startRendering();
  const d = rendu.getChannelData(0);
  let pic = 0, somme = 0;
  for (let i = taux; i < d.length; i++) { pic = Math.max(pic, Math.abs(d[i])); somme += d[i] * d[i]; }
  return { theme: id, pic: +pic.toFixed(3), rms: +Math.sqrt(somme / (d.length - taux)).toFixed(4), notes: l.pas };
}
