// ============================================================================
//  ARENA GLADIUS — client/js/rendu/village.js
//
//  Le village vu de côté : le Colisée au fond, la forge à gauche,
//  l'armurerie à droite, le gladiateur du joueur dans la rue.
//  Tout est dessiné dans un espace virtuel de 1600 × 900, mis à l'échelle
//  de l'écran par calculerVue(). Les zones cliquables sont dans ZONES.
// ============================================================================

import { ENCRE, forme, cercle, rectangle, nuance, texteContour, graine } from './outils.js';
import { dessinerGladiateur, dessinerArme } from './gladiateur.js';
import { dessinerIcone } from './icones.js';

export const LARGEUR = 1600;
export const HAUTEUR = 900;
const SOL = 790;          // bas des façades
const HORIZON = 600;

// Zones cliquables (coordonnées virtuelles), testées dans cet ordre
export const ZONES = [
  { id: 'forgeron', x: 90, y: 330, l: 440, h: 500, titre: 'Forgeron', sousTitre: 'Armes' },
  { id: 'armurier', x: 1080, y: 360, l: 440, h: 470, titre: 'Armurier', sousTitre: 'Armures' },
  { id: 'colisee', x: 500, y: 230, l: 600, h: 500, titre: 'Colisée', sousTitre: 'Combats' },
];

/** Échelle et décalage pour afficher la scène virtuelle dans w × h */
export function calculerVue(w, h) {
  const s = Math.min(h / HAUTEUR, w / 1150);
  return { s, ox: (w - LARGEUR * s) / 2, oy: h - HAUTEUR * s, w, h };
}

/** Convertit une position écran en position virtuelle */
export function versVirtuel(vue, x, y) {
  return [(x - vue.ox) / vue.s, (y - vue.oy) / vue.s];
}

export function zoneSous(vue, x, y) {
  const [vx, vy] = versVirtuel(vue, x, y);
  return ZONES.find((z) => vx >= z.x && vx <= z.x + z.l && vy >= z.y && vy <= z.y + z.h) || null;
}

// ----------------------------------------------------------------------------
//  Halo doré autour de l'élément survolé
// ----------------------------------------------------------------------------
function halo(ctx, actif, fn) {
  if (!actif) { fn(); return; }
  ctx.save();
  ctx.shadowColor = 'rgba(255, 214, 90, 0.95)';
  ctx.shadowBlur = 28;
  fn();
  ctx.restore();
}

// ----------------------------------------------------------------------------
//  Ciel, nuages, oiseaux, collines
// ----------------------------------------------------------------------------
function dessinerCiel(ctx, vue, t, xmin, xmax) {
  // Dégradé sur tout l'écran (repère écran)
  ctx.save();
  ctx.setTransform(ctx.getTransform().a / vue.s, 0, 0, ctx.getTransform().d / vue.s, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, vue.oy + HORIZON * vue.s);
  g.addColorStop(0, '#6fb5e6');
  g.addColorStop(0.65, '#bfe0f0');
  g.addColorStop(1, '#fbe3b0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vue.w, vue.h);
  ctx.restore();

  // Soleil
  const soleil = ctx.createRadialGradient(1320, 150, 20, 1320, 150, 190);
  soleil.addColorStop(0, 'rgba(255,248,210,0.95)');
  soleil.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = soleil;
  ctx.beginPath(); ctx.arc(1320, 150, 190, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff6d0';
  ctx.beginPath(); ctx.arc(1320, 150, 48, 0, Math.PI * 2); ctx.fill();

  // Nuages qui dérivent
  const largeurBoucle = xmax - xmin + 400;
  [[0, 120, 1], [520, 70, 0.8], [1050, 170, 1.2], [1500, 95, 0.9]].forEach(([x0, y, e], i) => {
    const x = xmin - 200 + ((x0 + t * (8 + i * 3)) % largeurBoucle);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    for (const [dx, dy, r] of [[0, 0, 34], [36, -14, 42], [80, 0, 32], [40, 10, 34]]) {
      ctx.moveTo(x + dx * e + r * e, y + dy * e);
      ctx.arc(x + dx * e, y + dy * e, r * e, 0, Math.PI * 2);
    }
    ctx.fill();
  });

  // Oiseaux
  ctx.strokeStyle = 'rgba(43,26,14,0.7)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = xmin + ((t * 40 + i * 170) % (xmax - xmin + 200)) - 100;
    const y = 200 + i * 22 + Math.sin(t * 2 + i) * 8;
    const b = Math.sin(t * 9 + i * 2) * 5;
    ctx.beginPath(); ctx.moveTo(x - 9, y - b); ctx.quadraticCurveTo(x - 4, y - 4, x, y); ctx.quadraticCurveTo(x + 4, y - 4, x + 9, y - b); ctx.stroke();
  }
}

function dessinerCollines(ctx, xmin, xmax) {
  for (const [couleur, base, amp, freq, ph] of [
    ['#b7c78c', 560, 30, 380, 0.5], ['#9db46c', 600, 22, 260, 2],
  ]) {
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(xmin, 760);
    for (let x = xmin; x <= xmax + 20; x += 20) ctx.lineTo(x, base - Math.sin(x / freq + ph) * amp - Math.sin(x / (freq * 0.37)) * amp * 0.3);
    ctx.lineTo(xmax, 760);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = nuance(couleur, -0.3); ctx.lineWidth = 2.5; ctx.stroke();
  }
  // Cyprès et pins parasols sur les collines
  const r = graine(21);
  for (let x = Math.floor(xmin / 90) * 90; x < xmax; x += 90) {
    const px = x + r() * 50;
    if (px > 470 && px < 1130) continue; // pas devant le Colisée
    const base = 606 - Math.sin(px / 260 + 2) * 22;
    const h = 60 + r() * 50;
    forme(ctx, '#3f6a34', () => ctx.ellipse(px, base - h / 2, 11, h / 2, 0, 0, Math.PI * 2), 2.5);
  }
}

// ----------------------------------------------------------------------------
//  Le Colisée
// ----------------------------------------------------------------------------
const COL = { x0: 500, x1: 1100, base: 690 };
const ETAGES = [
  { y: 575, h: 115, arches: 9, ouverture: 0.62 },
  { y: 465, h: 110, arches: 9, ouverture: 0.6 },
  { y: 360, h: 105, arches: 9, ouverture: 0.58 },
];
const ATTIQUE = { y: 290, h: 70 };

function silhouetteColisee(ctx) {
  // Contour complet, avec la partie effondrée à droite
  ctx.moveTo(COL.x0, COL.base);
  ctx.lineTo(COL.x0, ATTIQUE.y + 14);
  ctx.quadraticCurveTo(COL.x0 + 4, ATTIQUE.y, COL.x0 + 30, ATTIQUE.y);
  ctx.lineTo(950, ATTIQUE.y);
  ctx.lineTo(962, ATTIQUE.y + 22);
  ctx.lineTo(985, ATTIQUE.y + 18);
  ctx.lineTo(1000, ATTIQUE.y + 52);
  ctx.lineTo(1025, ATTIQUE.y + 60);
  ctx.lineTo(1040, 380);
  ctx.lineTo(1066, 372);
  ctx.lineTo(1080, 420);
  ctx.lineTo(COL.x1, 430);
  ctx.lineTo(COL.x1, COL.base);
  ctx.closePath();
}

function dessinerColisee(ctx, t, survol) {
  // Corps (halo si survolé)
  halo(ctx, survol, () => forme(ctx, '#d9b988', () => silhouetteColisee(ctx), 4));

  ctx.save();
  ctx.beginPath();
  silhouetteColisee(ctx);
  ctx.clip();

  // Ombrage cylindrique : bords plus sombres
  const ombre = ctx.createLinearGradient(COL.x0, 0, COL.x1, 0);
  ombre.addColorStop(0, 'rgba(90,50,20,0.38)');
  ombre.addColorStop(0.3, 'rgba(90,50,20,0)');
  ombre.addColorStop(0.72, 'rgba(90,50,20,0)');
  ombre.addColorStop(1, 'rgba(90,50,20,0.42)');

  // Attique : pilastres et petites fenêtres carrées
  ctx.fillStyle = '#e2c697';
  ctx.fillRect(COL.x0, ATTIQUE.y, COL.x1 - COL.x0, ATTIQUE.h);
  for (let i = 0; i < 18; i++) {
    const x = COL.x0 + 12 + i * 33;
    ctx.fillStyle = nuance('#e2c697', -0.08);
    ctx.fillRect(x, ATTIQUE.y + 6, 8, ATTIQUE.h - 6);
    if (i % 2 === 0) rectangle(ctx, x + 14, ATTIQUE.y + 22, 14, 18, '#5b3b22', 2);
  }

  // Étages d'arcades
  ETAGES.forEach((e, n) => {
    ctx.fillStyle = n === 0 ? '#cfa872' : n === 1 ? '#d6b27d' : '#dcbb87';
    ctx.fillRect(COL.x0, e.y, COL.x1 - COL.x0, e.h);
    const pas = (COL.x1 - COL.x0) / e.arches;
    for (let k = 0; k < e.arches; k++) {
      const cx = COL.x0 + pas * (k + 0.5);
      const lo = pas * e.ouverture;
      const haut = e.y + 18;
      const bas = e.y + e.h;
      // Arche : intérieur sombre avec un dégradé
      const g = ctx.createLinearGradient(0, haut, 0, bas);
      g.addColorStop(0, '#3a2414');
      g.addColorStop(1, '#6b4526');
      forme(ctx, g, () => {
        ctx.moveTo(cx - lo / 2, bas);
        ctx.lineTo(cx - lo / 2, haut + lo / 2);
        ctx.arc(cx, haut + lo / 2, lo / 2, Math.PI, 0);
        ctx.lineTo(cx + lo / 2, bas);
      }, 2.5);
      // Colonnes engagées entre les arches
      ctx.fillStyle = 'rgba(255,240,210,0.35)';
      ctx.fillRect(COL.x0 + pas * k - 5, e.y + 6, 10, e.h - 6);
      // Clé de voûte
      ctx.fillStyle = nuance('#d6b27d', -0.12);
      ctx.fillRect(cx - 4, haut - 8, 8, 10);
    }
    // Corniche
    ctx.fillStyle = '#f0dcb4';
    ctx.fillRect(COL.x0, e.y - 4, COL.x1 - COL.x0, 9);
    ctx.fillStyle = ENCRE;
    ctx.fillRect(COL.x0, e.y + 5, COL.x1 - COL.x0, 2.5);
    ctx.fillRect(COL.x0, e.y - 5, COL.x1 - COL.x0, 2);
  });

  ctx.fillStyle = ombre;
  ctx.fillRect(COL.x0, ATTIQUE.y, COL.x1 - COL.x0, COL.base - ATTIQUE.y);

  // Pierres éboulées visibles sur la partie cassée
  ctx.fillStyle = 'rgba(120,80,40,0.35)';
  for (const [x, y] of [[972, 300], [1010, 352], [1055, 388], [1086, 432]]) ctx.fillRect(x, y, 14, 7);
  ctx.restore();

  // Contour final par-dessus
  ctx.beginPath(); silhouetteColisee(ctx);
  ctx.lineWidth = 4; ctx.strokeStyle = ENCRE; ctx.stroke();

  // Mâts et oriflammes
  for (const [i, x] of [560, 660, 760, 860].entries()) {
    ctx.strokeStyle = ENCRE; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, ATTIQUE.y); ctx.lineTo(x, ATTIQUE.y - 70); ctx.stroke();
    const onde = Math.sin(t * 4 + i) * 6;
    forme(ctx, i % 2 ? '#f2b632' : '#b8323f', () => {
      ctx.moveTo(x + 2, ATTIQUE.y - 68);
      ctx.quadraticCurveTo(x + 22, ATTIQUE.y - 70 + onde, x + 44, ATTIQUE.y - 62 + onde);
      ctx.lineTo(x + 32, ATTIQUE.y - 54 + onde * 0.6);
      ctx.lineTo(x + 44, ATTIQUE.y - 44 + onde);
      ctx.quadraticCurveTo(x + 22, ATTIQUE.y - 50 + onde, x + 2, ATTIQUE.y - 46);
      ctx.closePath();
    }, 2.5);
  }
}

// ----------------------------------------------------------------------------
//  Maisons du second plan et rempart avec la porte de l'arène
// ----------------------------------------------------------------------------
function maison(ctx, x, base, l, h, mur, toit) {
  rectangle(ctx, x, base - h, l, h, mur, 3);
  forme(ctx, toit, () => {
    ctx.moveTo(x - 10, base - h + 2); ctx.lineTo(x + l / 2, base - h - l * 0.28); ctx.lineTo(x + l + 10, base - h + 2); ctx.closePath();
  }, 3);
  for (let i = 0; i < Math.floor(l / 45); i++) {
    rectangle(ctx, x + 14 + i * 45, base - h + 22, 18, 22, '#5b3b22', 2.5);
  }
}

function dessinerSecondPlan(ctx, xmin, xmax) {
  // Maisons derrière les boutiques (se prolongent hors écran)
  const r = graine(5);
  for (let x = Math.floor(xmin / 150) * 150 - 150; x < xmax + 150; x += 150) {
    if (x > 420 && x < 1100) continue;
    maison(ctx, x + 10, 720, 110 + r() * 30, 120 + r() * 50, r() > 0.5 ? '#f1e4c8' : '#e8d3ab', r() > 0.5 ? '#c0603a' : '#a94f2e');
  }
  maison(ctx, 440, 720, 120, 110, '#efe0c0', '#b9542f');
  maison(ctx, 1040, 720, 120, 120, '#e8d3ab', '#c0603a');

  // Rempart bas devant le Colisée, avec la porte
  const haut = 640, bas = 725;
  forme(ctx, '#c7aa7c', () => {
    ctx.moveTo(470, bas); ctx.lineTo(470, haut); ctx.lineTo(1130, haut); ctx.lineTo(1130, bas);
    ctx.lineTo(850, bas); ctx.lineTo(850, 680); ctx.arc(800, 680, 50, 0, Math.PI, true); ctx.lineTo(750, bas); ctx.closePath();
  }, 3);
  // Créneaux
  for (let x = 470; x < 1130; x += 30) rectangle(ctx, x, haut - 14, 18, 14, '#c7aa7c', 2.5);
  // Blocs de pierre
  ctx.strokeStyle = 'rgba(80,50,20,0.35)'; ctx.lineWidth = 1.5;
  for (let y = haut + 20; y < bas; y += 20) {
    ctx.beginPath(); ctx.moveTo(470, y); ctx.lineTo(748, y); ctx.moveTo(852, y); ctx.lineTo(1130, y); ctx.stroke();
  }
}

function plaqueColisee(ctx, survol, t) {
  const saut = survol ? Math.abs(Math.sin(t * 6)) * -6 : 0;
  ctx.save();
  ctx.translate(0, saut);
  halo(ctx, survol, () => rectangle(ctx, 705, 588, 190, 58, '#8e1f2c', 4, 8));
  ctx.strokeStyle = '#f2b632'; ctx.lineWidth = 2;
  ctx.strokeRect(712, 595, 176, 44);
  texteContour(ctx, 'COLISÉE', 800, 611, { taille: 26, epaisseur: 5 });
  texteContour(ctx, 'Combats', 800, 633, { taille: 14, couleur: '#f3e2bb', epaisseur: 3.5, police: 'Cinzel', graisse: 600 });
  ctx.restore();
}

// ----------------------------------------------------------------------------
//  Rue pavée
// ----------------------------------------------------------------------------
function dessinerRue(ctx, xmin, xmax) {
  // Trottoir
  ctx.fillStyle = '#d7c19a';
  ctx.fillRect(xmin, 720, xmax - xmin, SOL - 720 + 20);
  // Allée vers la porte de l'arène
  ctx.fillStyle = '#e4cfa6';
  ctx.beginPath(); ctx.moveTo(752, 725); ctx.lineTo(848, 725); ctx.lineTo(900, 812); ctx.lineTo(700, 812); ctx.closePath(); ctx.fill();
  // Chaussée
  ctx.fillStyle = '#b89f7a';
  ctx.fillRect(xmin, 810, xmax - xmin, HAUTEUR - 810 + 400);
  ctx.fillStyle = ENCRE;
  ctx.fillRect(xmin, 808, xmax - xmin, 3);
  ctx.fillRect(xmin, 721, xmax - xmin, 2.5);
  // Pavés
  ctx.strokeStyle = 'rgba(70,45,20,0.45)';
  ctx.lineWidth = 2;
  let rangee = 0;
  for (let y = 822; y < HAUTEUR + 20; y += 22, rangee++) {
    const decal = (rangee % 2) * 24;
    ctx.beginPath();
    ctx.moveTo(xmin, y); ctx.lineTo(xmax, y);
    for (let x = Math.floor(xmin / 48) * 48 + decal; x < xmax; x += 48) { ctx.moveTo(x, y - 22); ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

// ----------------------------------------------------------------------------
//  Enseigne en bois accrochée aux façades
// ----------------------------------------------------------------------------
function enseigne(ctx, cx, y, titre, sousTitre, icone, survol, t) {
  const saut = survol ? Math.abs(Math.sin(t * 6)) * -6 : 0;
  ctx.save();
  ctx.translate(0, saut);
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 60, y - 20); ctx.lineTo(cx - 50, y); ctx.moveTo(cx + 60, y - 20); ctx.lineTo(cx + 50, y); ctx.stroke();
  halo(ctx, survol, () => rectangle(ctx, cx - 120, y, 240, 66, '#7a4a22', 4, 8));
  rectangle(ctx, cx - 112, y + 7, 224, 52, '#9a6232', 2, 5);
  dessinerIcone(ctx, icone, cx - 84, y + 33, 40);
  texteContour(ctx, titre, cx + 20, y + 26, { taille: 21, epaisseur: 5 });
  texteContour(ctx, sousTitre, cx + 20, y + 47, { taille: 14, couleur: '#f3e2bb', epaisseur: 3.5, graisse: 600 });
  ctx.restore();
}

function bulleEntrer(ctx, cx, y) {
  rectangle(ctx, cx - 58, y, 116, 32, '#f2b632', 3, 16);
  texteContour(ctx, 'Entrer ➜', cx, y + 17, { taille: 16, couleur: ENCRE, epaisseur: 0 });
}

// ----------------------------------------------------------------------------
//  La forge (à gauche)
// ----------------------------------------------------------------------------
const FORGERON_PNJ = {
  skin: { peau: 'p4', coiffure: 'barbe', cheveux: 'c1', tunique: 't4' },
  equipement: { arme: { id: 'marteau' }, plastron: { id: 'plastron_cuir' } },
};

function murDePierre(ctx, x, y, l, h, couleur) {
  rectangle(ctx, x, y, l, h, couleur, 4);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, l, h); ctx.clip();
  ctx.strokeStyle = 'rgba(70,45,20,0.4)'; ctx.lineWidth = 2;
  let n = 0;
  for (let yy = y + 26; yy < y + h; yy += 26, n++) {
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + l, yy);
    for (let xx = x + (n % 2) * 30; xx < x + l; xx += 60) { ctx.moveTo(xx, yy - 26); ctx.lineTo(xx, yy); }
    ctx.stroke();
  }
  ctx.restore();
}

function toit(ctx, x0, x1, bas, haut, retrait) {
  forme(ctx, '#b9542f', () => {
    ctx.moveTo(x0, bas); ctx.lineTo(x1, bas); ctx.lineTo(x1 - retrait, haut); ctx.lineTo(x0 + retrait, haut); ctx.closePath();
  }, 4);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x0, bas); ctx.lineTo(x1, bas); ctx.lineTo(x1 - retrait, haut); ctx.lineTo(x0 + retrait, haut); ctx.clip();
  ctx.strokeStyle = 'rgba(80,20,5,0.45)'; ctx.lineWidth = 3;
  for (let x = x0; x < x1; x += 22) { ctx.beginPath(); ctx.moveTo(x, bas); ctx.lineTo(x + (x - (x0 + x1) / 2) * -0.1, haut); ctx.stroke(); }
  for (let y = haut + 22; y < bas; y += 22) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  ctx.restore();
  rectangle(ctx, x0 - 6, bas - 4, x1 - x0 + 12, 12, '#9c4424', 3, 3);
}

function dessinerForge(ctx, t, survol) {
  halo(ctx, survol, () => murDePierre(ctx, 120, 480, 360, SOL - 480, '#c9ad85'));

  // Cheminée + fumée
  rectangle(ctx, 380, 330, 52, 90, '#8c4a2c', 4);
  rectangle(ctx, 372, 322, 68, 14, '#6e3a22', 3);
  for (let i = 0; i < 6; i++) {
    const p = (t * 0.25 + i / 6) % 1;
    ctx.fillStyle = `rgba(110,100,95,${0.55 * (1 - p)})`;
    ctx.beginPath(); ctx.arc(406 + Math.sin(p * 5 + i) * 14 + p * 40, 312 - p * 170, 12 + p * 26, 0, Math.PI * 2); ctx.fill();
  }
  toit(ctx, 95, 505, 486, 392, 50);

  // Grande porte en arc avec la lueur du foyer
  const lueur = 0.75 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
  forme(ctx, '#2a160c', () => {
    ctx.moveTo(165, SOL); ctx.lineTo(165, 680); ctx.arc(250, 680, 85, Math.PI, 0); ctx.lineTo(335, SOL); ctx.closePath();
  }, 4);
  const feu = ctx.createRadialGradient(250, 760, 10, 250, 740, 120);
  feu.addColorStop(0, `rgba(255,190,80,${lueur})`);
  feu.addColorStop(0.5, `rgba(230,90,30,${lueur * 0.55})`);
  feu.addColorStop(1, 'rgba(120,30,10,0)');
  ctx.save();
  ctx.beginPath(); ctx.moveTo(167, SOL); ctx.lineTo(167, 680); ctx.arc(250, 680, 83, Math.PI, 0); ctx.lineTo(333, SOL); ctx.clip();
  ctx.fillStyle = feu; ctx.fillRect(160, 590, 180, 210);
  // Outils suspendus
  ctx.strokeStyle = '#140a04'; ctx.lineWidth = 4;
  for (const x of [205, 235, 290]) { ctx.beginPath(); ctx.moveTo(x, 640); ctx.lineTo(x, 690); ctx.stroke(); }
  ctx.fillStyle = '#140a04'; ctx.fillRect(282, 686, 18, 10); ctx.fillRect(228, 686, 14, 16);
  ctx.restore();
  // Voussoirs
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 3;
  for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += Math.PI / 7) {
    ctx.beginPath();
    ctx.moveTo(250 + Math.cos(a) * 85, 680 + Math.sin(a) * 85);
    ctx.lineTo(250 + Math.cos(a) * 103, 680 + Math.sin(a) * 103);
    ctx.stroke();
  }

  // Fenêtre avec volets
  rectangle(ctx, 385, 570, 64, 60, '#3a2414', 3);
  ctx.fillStyle = `rgba(255,170,70,${lueur * 0.5})`; ctx.fillRect(388, 573, 58, 54);
  rectangle(ctx, 365, 566, 22, 68, '#4f7d2a', 3);
  rectangle(ctx, 447, 566, 22, 68, '#4f7d2a', 3);

  // Tonneau d'armes
  forme(ctx, '#8a5a32', () => ctx.roundRect(120, 732, 46, 58, 8), 3);
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 3;
  for (const y of [746, 776]) { ctx.beginPath(); ctx.moveTo(120, y); ctx.lineTo(166, y); ctx.stroke(); }
  for (const [x, a, id] of [[132, -1.9, 'glaive'], [150, -1.3, 'lance'], [142, -1.6, 'hache']]) {
    ctx.save(); ctx.translate(x, 736); ctx.rotate(a); ctx.scale(0.6, 0.6); ctx.translate(-10, 0);
    dessinerArme(ctx, id);
    ctx.restore();
  }

  enseigne(ctx, 250, 506, 'FORGERON', 'Armes', 'glaive', survol, t);
}

// L'enclume et le forgeron qui martèle (dessinés devant la façade)
function dessinerForgeron(ctx, t) {
  const cycle = (t % 1.6) / 1.6;
  // Enclume
  forme(ctx, '#4d545c', () => {
    ctx.moveTo(360, 752); ctx.lineTo(430, 752); ctx.quadraticCurveTo(446, 756, 450, 764);
    ctx.lineTo(420, 766); ctx.lineTo(414, 780); ctx.lineTo(426, 800); ctx.lineTo(364, 800);
    ctx.lineTo(376, 780); ctx.lineTo(370, 766); ctx.quadraticCurveTo(350, 762, 360, 752); ctx.closePath();
  }, 3);
  // Épée rougeoyante sur l'enclume
  ctx.fillStyle = '#ff9a3c'; ctx.fillRect(372, 746, 50, 6);
  // Étincelles au moment de l'impact
  if (cycle > 0.55 && cycle < 0.8) {
    const p = (cycle - 0.55) / 0.25;
    ctx.fillStyle = `rgba(255,220,90,${1 - p})`;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * 0.35;
      ctx.beginPath(); ctx.arc(405 + Math.cos(a) * p * 50, 746 + Math.sin(a) * p * 40 + p * p * 30, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  dessinerGladiateur(ctx, {
    x: 470, y: 805, echelle: 1.05, direction: -1, ...FORGERON_PNJ,
    pose: 'attaque', avancement: cycle, temps: t,
  });
}

// ----------------------------------------------------------------------------
//  L'armurerie (à droite)
// ----------------------------------------------------------------------------
const ARMURIERE_PNJ = {
  skin: { peau: 'p2', coiffure: 'queue', cheveux: 'c3', tunique: 't5' },
  equipement: { plastron: { id: 'plastron_bronze' }, bouclier: { id: 'bouclier_fer' } },
};

function colonne(ctx, x, haut, bas) {
  rectangle(ctx, x - 13, haut + 14, 26, bas - haut - 14, '#f4ead6', 3);
  ctx.strokeStyle = 'rgba(120,90,50,0.45)'; ctx.lineWidth = 2;
  for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x + dx, haut + 18); ctx.lineTo(x + dx, bas - 4); ctx.stroke(); }
  rectangle(ctx, x - 20, haut, 40, 14, '#f4ead6', 3, 3);
  rectangle(ctx, x - 18, bas - 10, 36, 10, '#f4ead6', 3);
}

function mannequin(ctx, x, sol) {
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, sol); ctx.lineTo(x, sol - 120); ctx.moveTo(x - 24, sol); ctx.lineTo(x + 24, sol); ctx.stroke();
  ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x, sol); ctx.lineTo(x, sol - 120); ctx.moveTo(x - 24, sol); ctx.lineTo(x + 24, sol); ctx.stroke();
  cercle(ctx, x, sol - 132, 14, '#b27a4a', 3);
  dessinerIcone(ctx, 'plastron_bronze', x, sol - 88, 62);
  dessinerIcone(ctx, 'casque_fer', x + 2, sol - 140, 44);
  dessinerIcone(ctx, 'bouclier_bronze', x + 34, sol - 30, 52);
}

function dessinerArmurerie(ctx, t, survol) {
  halo(ctx, survol, () => rectangle(ctx, 1120, 480, 360, SOL - 480, '#efe0c2', 4));
  // Soubassement en pierre
  rectangle(ctx, 1120, 752, 360, 38, '#c9ad85', 3);
  toit(ctx, 1095, 1505, 486, 396, 50);

  // Petite fenêtre haute
  rectangle(ctx, 1150, 520, 52, 52, '#3a2414', 3);
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(1176, 520); ctx.lineTo(1176, 572); ctx.moveTo(1150, 546); ctx.lineTo(1202, 546); ctx.stroke();
  rectangle(ctx, 1144, 572, 64, 12, '#a94f2e', 3);
  // Fleurs au balcon
  for (const x of [1156, 1172, 1190]) cercle(ctx, x, 566, 6, x % 2 ? '#e04a5a' : '#f2b632', 2);

  // Porte avec lueur chaude
  forme(ctx, '#2a160c', () => ctx.rect(1245, 640, 110, SOL - 640), 4);
  const g = ctx.createLinearGradient(0, 640, 0, SOL);
  g.addColorStop(0, 'rgba(255,200,120,0.1)');
  g.addColorStop(1, 'rgba(255,190,110,0.5)');
  ctx.fillStyle = g; ctx.fillRect(1248, 643, 104, SOL - 646);
  // Boucliers accrochés dans l'entrée
  dessinerIcone(ctx, 'bouclier_acier', 1300, 700, 54);

  colonne(ctx, 1222, 600, SOL);
  colonne(ctx, 1378, 600, SOL);

  // Auvent rayé
  const n = 8, x0 = 1190, x1 = 1410, largeur = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    forme(ctx, i % 2 ? '#f3e2bb' : '#b8323f', () => {
      ctx.moveTo(x0 + i * largeur + 8, 580); ctx.lineTo(x0 + (i + 1) * largeur + 8, 580);
      ctx.lineTo(x0 + (i + 1) * largeur, 614); ctx.arc(x0 + (i + 0.5) * largeur, 614, largeur / 2, 0, Math.PI);
      ctx.closePath();
    }, 2.5);
  }

  mannequin(ctx, 1150, SOL + 10);
  // Amphores
  for (const [x, c] of [[1460, '#c0603a'], [1488, '#a94f2e']]) {
    forme(ctx, c, () => {
      ctx.moveTo(x - 6, SOL - 50); ctx.lineTo(x + 6, SOL - 50); ctx.quadraticCurveTo(x + 22, SOL - 30, x + 6, SOL); ctx.lineTo(x - 6, SOL);
      ctx.quadraticCurveTo(x - 22, SOL - 30, x - 6, SOL - 50); ctx.closePath();
    }, 3);
  }

  enseigne(ctx, 1300, 506, 'ARMURIER', 'Armures', 'casque_bronze', survol, t);
}

function dessinerArmuriere(ctx, t) {
  dessinerGladiateur(ctx, {
    x: 1430, y: 812, echelle: 1.05, direction: -1, ...ARMURIERE_PNJ, pose: 'repos', temps: t + 1.3,
  });
}

// ----------------------------------------------------------------------------
//  Le joueur dans la rue, avec son nom
// ----------------------------------------------------------------------------
function dessinerJoueur(ctx, perso, niveau, t) {
  const x = 1000, y = 855;
  dessinerGladiateur(ctx, {
    x, y, echelle: 1.3, direction: -1, skin: perso.skin, equipement: perso.equipement, pose: 'repos', temps: t,
  });
  const texte = `${perso.nom} · Niv. ${niveau}`;
  ctx.font = "800 18px Cinzel, Georgia, serif";
  const l = ctx.measureText(texte).width + 28;
  rectangle(ctx, x - l / 2, y - 222, l, 32, 'rgba(43,26,14,0.82)', 0, 16);
  texteContour(ctx, texte, x, y - 205, { taille: 18, couleur: '#f3e2bb', epaisseur: 0 });
}


// ----------------------------------------------------------------------------
//  Fonction principale
// ----------------------------------------------------------------------------
/**
 * @param survolId 'forgeron' | 'armurier' | 'colisee' | null
 */
export function dessinerVillage(ctx, vue, t, { perso, niveau = 1, survolId = null } = {}) {
  ctx.save();
  ctx.translate(vue.ox, vue.oy);
  ctx.scale(vue.s, vue.s);
  const xmin = -vue.ox / vue.s - 10;
  const xmax = (vue.w - vue.ox) / vue.s + 10;

  dessinerCiel(ctx, vue, t, xmin, xmax);
  dessinerCollines(ctx, xmin, xmax);
  dessinerColisee(ctx, t, survolId === 'colisee');
  dessinerSecondPlan(ctx, xmin, xmax);
  dessinerRue(ctx, xmin, xmax);
  plaqueColisee(ctx, survolId === 'colisee', t);
  dessinerForge(ctx, t, survolId === 'forgeron');
  dessinerArmurerie(ctx, t, survolId === 'armurier');
  dessinerForgeron(ctx, t);
  dessinerArmuriere(ctx, t);
  if (perso) dessinerJoueur(ctx, perso, niveau, t);

  // Bulle « Entrer » sous l'enseigne survolée
  if (survolId === 'forgeron') bulleEntrer(ctx, 250, 440);
  if (survolId === 'armurier') bulleEntrer(ctx, 1300, 440);
  if (survolId === 'colisee') bulleEntrer(ctx, 800, 540);

  ctx.restore();
}
