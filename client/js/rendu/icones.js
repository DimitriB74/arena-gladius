// ============================================================================
//  ARENA GLADIUS — client/js/rendu/icones.js
//
//  Icônes des objets (armes et armures), dessinées sur canvas.
//  dessinerIcone(ctx, id, cx, cy, taille) : centre (cx, cy), taille en px.
// ============================================================================

import { ARMES, ARMURES, MATERIAUX } from '/shared/data.js';
import { dessinerArme } from './gladiateur.js';
import { ENCRE, forme, cercle, nuance } from './outils.js';

// Étendue horizontale de chaque arme dans son repère (voir dessinerArme)
const ETENDUE_ARMES = {
  poings: [-14, 14], dague: [-8, 28], glaive: [-14, 48], lance: [-30, 80], masse: [-8, 55],
  hache: [-10, 56], trident: [-30, 82], marteau: [-10, 64],
};

const PLUMET = '#b8323f';

function iconeArme(ctx, id) {
  if (id === 'poings') {
    cercle(ctx, 0, 0, 26, '#eab48f', 4);
    ctx.strokeStyle = ENCRE; ctx.lineWidth = 3;
    for (const dx of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(dx, -24); ctx.lineTo(dx, -8); ctx.stroke(); }
    return;
  }
  const [min, max] = ETENDUE_ARMES[id] || [-20, 40];
  const longueur = max - min;
  const echelle = 128 / longueur;
  ctx.rotate(-Math.PI / 4);
  ctx.scale(echelle, echelle);
  ctx.translate(-(min + max) / 2, 0);
  ctx.lineWidth = 3 / echelle;
  dessinerArme(ctx, id);
}

function iconeCasque(ctx, mat, palier) {
  if (palier >= 2) {
    // Plumet
    forme(ctx, PLUMET, () => {
      ctx.moveTo(-34, -18); ctx.quadraticCurveTo(-24, -58, 18, -52);
      ctx.quadraticCurveTo(34, -52, 26, -38); ctx.quadraticCurveTo(0, -46, -34, -18); ctx.closePath();
    });
  }
  forme(ctx, mat.couleur, () => {
    ctx.moveTo(-36, 30);
    ctx.quadraticCurveTo(-44, -36, 0, -38);
    ctx.quadraticCurveTo(44, -38, 38, 6);
    ctx.lineTo(14, 4);
    ctx.lineTo(10, 30);
    ctx.closePath();
  }, 4);
  ctx.strokeStyle = mat.reflet; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-22, -20); ctx.quadraticCurveTo(-6, -32, 12, -28); ctx.stroke();
  forme(ctx, nuance(mat.couleur, -0.15), () => ctx.rect(-4, -2, 44, 7), 3);
  if (palier >= 3) {
    ctx.fillStyle = ENCRE;
    for (const x of [-20, -8, 4]) { ctx.beginPath(); ctx.arc(x, -10, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
}

function iconePlastron(ctx, mat, palier) {
  forme(ctx, mat.couleur, () => {
    ctx.moveTo(-34, -34); ctx.quadraticCurveTo(0, -46, 34, -34);
    ctx.lineTo(30, 34); ctx.quadraticCurveTo(0, 44, -30, 34); ctx.closePath();
  }, 4);
  // Épaulettes
  forme(ctx, nuance(mat.couleur, -0.1), () => ctx.ellipse(-32, -30, 12, 9, -0.4, 0, Math.PI * 2), 3);
  forme(ctx, nuance(mat.couleur, -0.1), () => ctx.ellipse(32, -30, 12, 9, 0.4, 0, Math.PI * 2), 3);
  ctx.strokeStyle = nuance(mat.couleur, -0.28); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(-11, -14, 13, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(11, -14, 13, 0.2, Math.PI - 0.2); ctx.stroke();
  if (palier >= 2) { ctx.beginPath(); ctx.moveTo(-14, 16); ctx.lineTo(14, 16); ctx.moveTo(-12, 26); ctx.lineTo(12, 26); ctx.stroke(); }
  ctx.strokeStyle = mat.reflet; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-22, -32); ctx.quadraticCurveTo(-4, -38, 12, -36); ctx.stroke();
}

function iconeJambieres(ctx, mat) {
  for (const dx of [-17, 17]) {
    forme(ctx, mat.couleur, () => {
      ctx.moveTo(dx - 12, -38); ctx.quadraticCurveTo(dx, -44, dx + 12, -38);
      ctx.lineTo(dx + 10, 30); ctx.quadraticCurveTo(dx, 36, dx - 10, 30); ctx.closePath();
    }, 4);
    ctx.strokeStyle = mat.reflet; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(dx - 4, -30); ctx.lineTo(dx - 3, 22); ctx.stroke();
    ctx.strokeStyle = ENCRE; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(dx - 11, -18); ctx.lineTo(dx + 11, -18); ctx.stroke();
  }
}

function iconeBouclier(ctx, mat, palier) {
  const r = 38 + palier * 2;
  cercle(ctx, 0, 0, r, mat.couleur, 4);
  ctx.strokeStyle = nuance(mat.couleur, -0.2); ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, r - 9, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = mat.reflet; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r - 17, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
  cercle(ctx, 0, 0, 10 + palier * 2, nuance(mat.reflet, -0.05), 3);
}

/** Dessine l'icône d'un objet, centrée, dans un carré de `taille` px */
export function dessinerIcone(ctx, id, cx, cy, taille = 64) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(taille / 110, taille / 110);
  if (ARMES[id]) {
    iconeArme(ctx, id);
  } else if (ARMURES[id]) {
    const a = ARMURES[id];
    const mat = MATERIAUX[a.materiau];
    if (a.emplacement === 'casque') iconeCasque(ctx, mat, a.palier);
    else if (a.emplacement === 'plastron') iconePlastron(ctx, mat, a.palier);
    else if (a.emplacement === 'jambieres') iconeJambieres(ctx, mat);
    else iconeBouclier(ctx, mat, a.palier);
  }
  ctx.restore();
}

/** Dessine l'icône dans un petit <canvas> HTML (menus) */
export function iconeDansCanvas(canvas, id) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const taille = canvas.clientWidth || canvas.width;
  canvas.width = taille * dpr;
  canvas.height = taille * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, taille, taille);
  dessinerIcone(ctx, id, taille / 2, taille / 2, taille * 0.86);
}
