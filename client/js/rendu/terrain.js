// ============================================================================
//  ARENA GLADIUS — client/js/rendu/terrain.js
//
//  Dessin du terrain d'une arène (vue de côté), par-dessus son décor :
//  trous (gouffre, lave, crevasse), glace, objets de décor, blocs solides
//  (caisses, pierres, souches, rochers…), plateformes et murs.
//
//  geometrie(w, hDecor, bas, marge)        → passage unités de l'arène → pixels
//  dessinerTerrain(ctx, g, terrain, t)      → tout ce qui est derrière les combattants
//  dessinerAvantPlan(ctx, g, terrain, t)    → lave / obscurité où disparaissent ceux qui tombent
// ============================================================================

import { TEMPS_REEL as T } from '/shared/data.js';
import { supportSous } from '/shared/terrain.js';
import { hauteurSol } from './decor.js';
import { ENCRE, rectangle, cercle, forme, nuance } from './outils.js';

export const HAUTEUR_MONDE = 480;   // hauteur de l'arène à montrer au-dessus du sol

/**
 * @param w      largeur du dessin
 * @param hDecor hauteur du décor (le sol de l'arène est au niveau du sol du décor)
 * @param bas    bas du dessin (les trous descendent jusque-là)
 * @param marge  place laissée libre en haut (fiches des combattants)
 */
export function geometrie(w, hDecor, bas = hDecor, marge = 120) {
  const sol = hauteurSol(hDecor) + 4;
  const e = Math.max(0.05, Math.min(w / T.arene.largeur, (sol - marge) / HAUTEUR_MONDE));
  const ox = (w - T.arene.largeur * e) / 2;
  return { sol, e, ox, bas, px: (x) => ox + x * e, py: (y) => sol - y * e };
}

const trait = (g, n = 3) => Math.max(1.2, n * Math.min(1.1, g.e * 1.25));

// ----------------------------------------------------------------------------
//  Trous
// ----------------------------------------------------------------------------
const TROUS = {
  gouffre:  { haut: '#a86a36', bas: '#140a04', paroi: '#c99254', ombre: '26,13,5' },
  lave:     { haut: '#5a2418', bas: '#200806', paroi: '#3a2420', ombre: '40,8,4' },
  crevasse: { haut: '#9cc4e8', bas: '#0a1628', paroi: '#d8ecfa', ombre: '10,22,40' },
};

function dessinerTrou(ctx, g, trou, t) {
  const s = TROUS[trou.type] || TROUS.gouffre;
  const x1 = g.px(trou.x1), x2 = g.px(trou.x2);
  const haut = g.sol - 7, bas = g.bas + 10;

  // Intérieur
  const grad = ctx.createLinearGradient(0, haut, 0, Math.min(bas, haut + 300 * g.e));
  grad.addColorStop(0, s.haut);
  grad.addColorStop(1, s.bas);
  ctx.fillStyle = grad;
  ctx.fillRect(x1, haut, x2 - x1, bas - haut);

  // Parois rocheuses irrégulières de chaque côté
  const ep = 14 * g.e;
  for (const [x, cote] of [[x1, 1], [x2, -1]]) {
    ctx.fillStyle = s.paroi;
    ctx.beginPath();
    ctx.moveTo(x, haut);
    for (let k = 0; k <= 8; k++) {
      const y = haut + ((bas - haut) * k) / 8;
      ctx.lineTo(x + cote * ep * (0.5 + ((k * 37) % 7) / 10), y);
    }
    ctx.lineTo(x, bas);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = ENCRE;
  ctx.lineWidth = trait(g);
  ctx.beginPath();
  ctx.moveTo(x1, haut); ctx.lineTo(x1, bas);
  ctx.moveTo(x2, haut); ctx.lineTo(x2, bas);
  ctx.stroke();

  if (trou.type === 'gouffre') {
    // Filets de sable qui glissent dans le vide
    ctx.fillStyle = 'rgba(240,190,110,0.8)';
    for (const [x, cote] of [[x1, 1], [x2, -1]]) {
      for (let k = 0; k < 7; k++) {
        const p = (t * 0.6 + k / 7) % 1;
        ctx.beginPath();
        ctx.arc(x + cote * (3 + (k % 3) * 3) * g.e, haut + p * 220 * g.e, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (trou.type === 'crevasse') {
    // Stalactites de glace sous les bords
    ctx.fillStyle = '#eef8ff';
    ctx.strokeStyle = ENCRE;
    ctx.lineWidth = trait(g, 1.5);
    for (const [x, cote] of [[x1, 1], [x2, -1]]) {
      for (let k = 0; k < 3; k++) {
        const bx = x + cote * (4 + k * 13) * g.e;
        const long = (24 + ((k * 17) % 20)) * g.e;
        ctx.beginPath();
        ctx.moveTo(bx - 5 * g.e, haut + 4);
        ctx.lineTo(bx + 5 * g.e, haut + 4);
        ctx.lineTo(bx, haut + 4 + long);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  } else if (trou.type === 'lave') {
    // Lueur de la lave qui monte au-dessus du trou
    const lueur = ctx.createLinearGradient(0, haut - 90 * g.e, 0, haut + 10);
    lueur.addColorStop(0, 'rgba(255,120,30,0)');
    lueur.addColorStop(1, `rgba(255,120,30,${0.35 + Math.sin(t * 2.3) * 0.08})`);
    ctx.fillStyle = lueur;
    ctx.fillRect(x1, haut - 90 * g.e, x2 - x1, 100 * g.e);
  }
}

/** Par-dessus les combattants : ceux qui tombent disparaissent dans la lave ou le noir */
export function dessinerAvantPlan(ctx, g, terrain, t) {
  for (const trou of terrain.trous) {
    const s = TROUS[trou.type] || TROUS.gouffre;
    const x1 = g.px(trou.x1) + 1, x2 = g.px(trou.x2) - 1;
    const bas = g.bas + 10;
    if (trou.type === 'lave') {
      const yl = g.py(-60);
      ctx.beginPath();
      ctx.moveTo(x1, bas);
      for (let x = x1; x <= x2 + 0.1; x += 6) ctx.lineTo(Math.min(x, x2), yl + Math.sin(x * 0.07 + t * 3) * 3 * g.e);
      ctx.lineTo(x2, bas);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, yl, 0, yl + 120 * g.e);
      grad.addColorStop(0, '#ffe066');
      grad.addColorStop(0.35, '#ff8a1a');
      grad.addColorStop(1, '#b8260c');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = ENCRE;
      ctx.lineWidth = trait(g, 2.5);
      ctx.stroke();
      // Bulles
      for (let k = 0; k < 5; k++) {
        const p = (t * 0.7 + k * 0.29) % 1;
        const bx = x1 + ((k * 0.23 + 0.1) % 1) * (x2 - x1);
        ctx.fillStyle = `rgba(255,236,150,${1 - p})`;
        ctx.beginPath();
        ctx.arc(bx, yl + 12 * g.e - p * 10 * g.e, (2 + p * 5) * g.e, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const y0 = g.py(-30);
      const grad = ctx.createLinearGradient(0, y0, 0, g.py(-220));
      grad.addColorStop(0, `rgba(${s.ombre},0)`);
      grad.addColorStop(1, `rgba(${s.ombre},1)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x1, y0, x2 - x1, bas - y0);
    }
  }
}

// ----------------------------------------------------------------------------
//  Glace
// ----------------------------------------------------------------------------
function dessinerGlace(ctx, g, z, t) {
  const x1 = g.px(z.x1), x2 = g.px(z.x2), y = g.sol - 7;
  const h = Math.max(6, 16 * g.e);
  // Reflet bleuté sur la neige autour de la plaque
  ctx.fillStyle = 'rgba(90,170,230,0.18)';
  ctx.fillRect(x1, y + h, x2 - x1, 26 * g.e);
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#c4ecff');
  grad.addColorStop(0.5, '#86c9f0');
  grad.addColorStop(1, '#4f9fd6');
  rectangle(ctx, x1, y, x2 - x1, h, grad, trait(g, 2), 3);
  // Reflets qui brillent
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = trait(g, 1.5);
  for (let x = x1 + 14 * g.e; x < x2 - 10 * g.e; x += 46 * g.e) {
    const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + x * 0.05));
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.75);
    ctx.lineTo(x + 9 * g.e, y + h * 0.25);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ----------------------------------------------------------------------------
//  Objets de décor (on passe devant)
// ----------------------------------------------------------------------------
function flamme(ctx, x, y, taille, t, graine = 0) {
  const f = 1 + Math.sin(t * 11 + graine) * 0.15;
  const grad = ctx.createRadialGradient(x, y, 1, x, y, taille * f);
  grad.addColorStop(0, 'rgba(255,235,130,0.95)');
  grad.addColorStop(1, 'rgba(255,110,30,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, taille * f, 0, Math.PI * 2);
  ctx.fill();
}

const DECORS = {
  ratelier(ctx, g, x, y, t) {
    const e = g.e;
    // Trois lances appuyées et un bouclier rond
    for (let k = 0; k < 3; k++) {
      const bx = x + (k - 1) * 22 * e;
      ctx.strokeStyle = ENCRE;
      ctx.lineWidth = trait(g, 4);
      ctx.beginPath(); ctx.moveTo(bx - 8 * e, y); ctx.lineTo(bx + 4 * e, y - 130 * e); ctx.stroke();
      ctx.strokeStyle = '#8a5a32';
      ctx.lineWidth = trait(g, 2);
      ctx.stroke();
      forme(ctx, '#c9ccd2', () => {
        ctx.moveTo(bx + 4 * e, y - 150 * e);
        ctx.lineTo(bx - 2 * e, y - 128 * e);
        ctx.lineTo(bx + 10 * e, y - 128 * e);
        ctx.closePath();
      }, trait(g, 1.5));
    }
    // Support en bois
    rectangle(ctx, x - 44 * e, y - 70 * e, 88 * e, 9 * e, '#8a5a32', trait(g, 2));
    rectangle(ctx, x - 40 * e, y - 70 * e, 8 * e, 70 * e, '#7a4a22', trait(g, 2));
    rectangle(ctx, x + 32 * e, y - 70 * e, 8 * e, 70 * e, '#7a4a22', trait(g, 2));
    cercle(ctx, x + 50 * e, y - 30 * e, 28 * e, '#b8323f', trait(g, 2.5));
    cercle(ctx, x + 50 * e, y - 30 * e, 8 * e, '#f2b632', trait(g, 1.5));
  },
  amphores(ctx, g, x, y) {
    const e = g.e;
    [[-26, 1, '#b5562e'], [0, 1.2, '#c8693a'], [26, 0.9, '#a64a26']].forEach(([dx, k, c]) => {
      const cx = x + dx * e, hh = 58 * k * e;
      forme(ctx, c, () => {
        ctx.moveTo(cx - 6 * e, y - hh);
        ctx.quadraticCurveTo(cx - 22 * k * e, y - hh * 0.6, cx - 5 * e, y);
        ctx.lineTo(cx + 5 * e, y);
        ctx.quadraticCurveTo(cx + 22 * k * e, y - hh * 0.6, cx + 6 * e, y - hh);
        ctx.closePath();
      }, trait(g, 2));
      rectangle(ctx, cx - 7 * e, y - hh - 8 * e, 14 * e, 8 * e, nuance(c, -0.08), trait(g, 1.5));
      ctx.strokeStyle = 'rgba(43,26,14,0.35)';
      ctx.lineWidth = trait(g, 1.5);
      ctx.beginPath(); ctx.moveTo(cx - 12 * k * e, y - hh * 0.55); ctx.lineTo(cx + 12 * k * e, y - hh * 0.55); ctx.stroke();
    });
  },
  brasero(ctx, g, x, y, t) {
    const e = g.e;
    ctx.strokeStyle = ENCRE;
    ctx.lineWidth = trait(g, 3);
    for (const dx of [-14, 0, 14]) { ctx.beginPath(); ctx.moveTo(x + dx * e, y); ctx.lineTo(x, y - 60 * e); ctx.stroke(); }
    forme(ctx, '#6b4a2a', () => {
      ctx.moveTo(x - 26 * e, y - 72 * e);
      ctx.lineTo(x + 26 * e, y - 72 * e);
      ctx.lineTo(x + 16 * e, y - 56 * e);
      ctx.lineTo(x - 16 * e, y - 56 * e);
      ctx.closePath();
    }, trait(g, 2));
    flamme(ctx, x, y - 88 * e, 30 * e, t, x);
  },
  buisson(ctx, g, x, y) {
    const e = g.e;
    [[-24, 18, 22], [22, 16, 20], [0, 30, 28]].forEach(([dx, dy, r]) => cercle(ctx, x + dx * e, y - dy * e, r * e, '#4f7d2a', trait(g, 2)));
    ctx.fillStyle = '#b8323f';
    for (const [dx, dy] of [[-10, 30], [12, 22], [4, 44]]) {
      ctx.beginPath(); ctx.arc(x + dx * e, y - dy * e, 3 * e, 0, Math.PI * 2); ctx.fill();
    }
  },
};

// ----------------------------------------------------------------------------
//  Blocs solides
// ----------------------------------------------------------------------------
function polygone(ctx, couleur, points, epaisseur) {
  forme(ctx, couleur, () => {
    ctx.moveTo(points[0][0], points[0][1]);
    for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
  }, epaisseur);
}

const BLOCS = {
  caisse(ctx, g, x, y, l, h) {
    rectangle(ctx, x, y, l, h, '#b5773a', trait(g), 3);
    const m = 6 * g.e;
    ctx.strokeStyle = '#7a4a22';
    ctx.lineWidth = trait(g, 2);
    ctx.strokeRect(x + m, y + m, l - 2 * m, h - 2 * m);
    // Planches et croisillon
    ctx.beginPath();
    ctx.moveTo(x + m, y + h / 2); ctx.lineTo(x + l - m, y + h / 2);
    ctx.moveTo(x + m, y + h - m); ctx.lineTo(x + l - m, y + m);
    ctx.stroke();
    ctx.fillStyle = ENCRE;
    for (const [px, py] of [[x + m, y + m], [x + l - m, y + m], [x + m, y + h - m], [x + l - m, y + h - m]]) {
      ctx.beginPath(); ctx.arc(px, py, 1.8 * g.e + 0.6, 0, Math.PI * 2); ctx.fill();
    }
  },
  pierre(ctx, g, x, y, l, h) {
    // Bloc de grès ébréché, en assises de pierres
    polygone(ctx, '#d6a866', [
      [x, y + h], [x, y + 8 * g.e], [x + l * 0.3, y], [x + l * 0.45, y + 6 * g.e], [x + l * 0.7, y + 2 * g.e], [x + l, y + 10 * g.e], [x + l, y + h],
    ], trait(g));
    ctx.strokeStyle = 'rgba(120,70,30,0.45)';
    ctx.lineWidth = trait(g, 1.5);
    const assise = 24 * g.e;
    let rang = 0;
    for (let yy = y + h - assise; yy > y + 10 * g.e; yy -= assise, rang++) {
      ctx.beginPath(); ctx.moveTo(x + 2, yy); ctx.lineTo(x + l - 2, yy); ctx.stroke();
      for (let xx = x + (rang % 2 ? l * 0.25 : l * 0.5); xx < x + l - 4; xx += l * 0.5) {
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + assise); ctx.stroke();
      }
    }
  },
  souche(ctx, g, x, y, l, h) {
    const e = g.e;
    // Racines
    polygone(ctx, '#6b4020', [[x - 10 * e, y + h], [x + 8 * e, y + h * 0.55], [x + 16 * e, y + h]], trait(g, 2));
    polygone(ctx, '#6b4020', [[x + l + 10 * e, y + h], [x + l - 8 * e, y + h * 0.55], [x + l - 16 * e, y + h]], trait(g, 2));
    rectangle(ctx, x, y + 6 * e, l, h - 6 * e, '#7a4d2a', trait(g));
    ctx.strokeStyle = 'rgba(43,26,14,0.4)';
    ctx.lineWidth = trait(g, 1.5);
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + (l * k) / 4, y + 14 * e); ctx.lineTo(x + (l * k) / 4 + 3 * e, y + h - 4); ctx.stroke(); }
    // Dessus coupé, avec ses cernes
    forme(ctx, '#d8ab72', () => ctx.ellipse(x + l / 2, y + 6 * e, l / 2, 8 * e, 0, 0, Math.PI * 2), trait(g, 2));
    ctx.strokeStyle = 'rgba(122,77,42,0.6)';
    ctx.beginPath(); ctx.ellipse(x + l / 2, y + 6 * e, l / 4, 4 * e, 0, 0, Math.PI * 2); ctx.stroke();
    // Mousse
    ctx.fillStyle = '#6f9a40';
    for (const dx of [0.15, 0.55, 0.85]) { ctx.beginPath(); ctx.arc(x + l * dx, y + h - 2, 6 * e, Math.PI, 0); ctx.fill(); }
  },
  tronc(ctx, g, x, y, l, h) {
    const e = g.e;
    rectangle(ctx, x, y, l, h, '#8a5a32', trait(g), h / 2);
    ctx.strokeStyle = 'rgba(43,26,14,0.35)';
    ctx.lineWidth = trait(g, 1.5);
    for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + h / 2, y + (h * k) / 3); ctx.lineTo(x + l - h / 2, y + (h * k) / 3 + 2 * e); ctx.stroke(); }
    // Bout coupé
    forme(ctx, '#d8ab72', () => ctx.ellipse(x + h * 0.35, y + h / 2, h * 0.32, h / 2 - 1, 0, 0, Math.PI * 2), trait(g, 2));
    ctx.strokeStyle = 'rgba(122,77,42,0.6)';
    ctx.beginPath(); ctx.ellipse(x + h * 0.35, y + h / 2, h * 0.15, h / 4, 0, 0, Math.PI * 2); ctx.stroke();
    // Une petite branche et des feuilles
    ctx.strokeStyle = ENCRE;
    ctx.lineWidth = trait(g, 3);
    ctx.beginPath(); ctx.moveTo(x + l * 0.7, y + 2); ctx.lineTo(x + l * 0.78, y - 16 * e); ctx.stroke();
    cercle(ctx, x + l * 0.8, y - 20 * e, 8 * e, '#5f8a46', trait(g, 1.5));
  },
  basalte(ctx, g, x, y, l, h, t) {
    polygone(ctx, '#3b2a26', [
      [x, y + h], [x + l * 0.06, y + h * 0.3], [x + l * 0.3, y], [x + l * 0.75, y + 4 * g.e], [x + l * 0.95, y + h * 0.35], [x + l, y + h],
    ], trait(g));
    // Fissures incandescentes
    ctx.strokeStyle = `rgba(255,${120 + Math.round(Math.sin(t * 2.5) * 40)},40,0.9)`;
    ctx.lineWidth = trait(g, 2);
    ctx.beginPath();
    ctx.moveTo(x + l * 0.3, y + h * 0.2); ctx.lineTo(x + l * 0.42, y + h * 0.5); ctx.lineTo(x + l * 0.35, y + h * 0.85);
    ctx.moveTo(x + l * 0.7, y + h * 0.3); ctx.lineTo(x + l * 0.62, y + h * 0.6);
    ctx.stroke();
  },
  roc(ctx, g, x, y, l, h) {
    polygone(ctx, '#8d97a3', [
      [x, y + h], [x + l * 0.04, y + h * 0.35], [x + l * 0.35, y], [x + l * 0.7, y + 3 * g.e], [x + l, y + h * 0.4], [x + l, y + h],
    ], trait(g));
    ctx.strokeStyle = 'rgba(43,26,14,0.3)';
    ctx.lineWidth = trait(g, 1.5);
    ctx.beginPath(); ctx.moveTo(x + l * 0.35, y + 4); ctx.lineTo(x + l * 0.5, y + h - 4); ctx.stroke();
    // Calotte de neige
    forme(ctx, '#ffffff', () => {
      ctx.moveTo(x + l * 0.02, y + h * 0.38);
      ctx.lineTo(x + l * 0.35, y - 3 * g.e);
      ctx.lineTo(x + l * 0.7, y);
      ctx.lineTo(x + l * 0.99, y + h * 0.42);
      ctx.quadraticCurveTo(x + l * 0.8, y + h * 0.3, x + l * 0.6, y + h * 0.4);
      ctx.quadraticCurveTo(x + l * 0.3, y + h * 0.25, x + l * 0.02, y + h * 0.38);
    }, trait(g, 2));
  },
};

function dessinerBloc(ctx, g, b, t) {
  const x = g.px(b.x1), y = g.py(b.y2);
  const l = (b.x2 - b.x1) * g.e, h = (b.y2 - b.y1) * g.e;
  (BLOCS[b.type] || BLOCS.caisse)(ctx, g, x, y, l, h, t);
}

// ----------------------------------------------------------------------------
//  Plateformes
// ----------------------------------------------------------------------------
const PLATEFORMES = {
  marbre:  { dalle: '#f1ebdd', pilier: '#e8e1d2', motif: '#b8323f' },
  gres:    { dalle: '#e2b878', pilier: '#d9a864', motif: '#a8743a' },
  basalte: { dalle: '#4a3530', pilier: '#3a2824', motif: '#ff8a2a' },
  glace:   { dalle: '#dff1fb', pilier: '#9aa6b3', motif: '#ffffff' },
  bois:    { dalle: '#a8703a', pilier: '#6b4a2a', motif: '#7a4a22' },
};

function dessinerPlateforme(ctx, g, terrain, p, t) {
  const s = PLATEFORMES[terrain.style] || PLATEFORMES.marbre;
  const x1 = g.px(p.x1), x2 = g.px(p.x2), y = g.py(p.y);
  const epaisseur = 20 * g.e;

  if (terrain.style === 'bois') {
    // Passerelle suspendue : cordes jusqu'aux branches, en haut
    ctx.strokeStyle = s.pilier;
    ctx.lineWidth = trait(g, 2.5);
    for (const x of [x1 + 8 * g.e, x2 - 8 * g.e]) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(t * 0.8 + x) * 2, 0); ctx.stroke();
    }
    rectangle(ctx, x1, y - 4 * g.e, x2 - x1, 16 * g.e, s.dalle, trait(g), 3);
    ctx.strokeStyle = s.motif;
    ctx.lineWidth = trait(g, 1.5);
    for (let x = x1 + 22 * g.e; x < x2 - 8; x += 22 * g.e) { ctx.beginPath(); ctx.moveTo(x, y - 3 * g.e); ctx.lineTo(x, y + 11 * g.e); ctx.stroke(); }
    // Feuillage accroché
    for (const x of [x1 + 4 * g.e, x2 - 4 * g.e]) cercle(ctx, x, y + 12 * g.e, 9 * g.e, '#5f8a46', trait(g, 1.5));
    return;
  }

  // Piliers jusqu'à ce qui est dessous (le sol, un bloc… ou le fond d'un trou)
  for (const cx of [p.x1 + (p.x2 - p.x1) * 0.18, p.x2 - (p.x2 - p.x1) * 0.18]) {
    const appui = supportSous(terrain, cx, p.y - 1);
    const bas = appui === null ? g.bas + 10 : g.py(appui);
    const X = g.px(cx), l = 18 * g.e;
    ctx.fillStyle = s.pilier;
    ctx.fillRect(X - l / 2, y, l, bas - y);
    ctx.strokeStyle = ENCRE;
    ctx.lineWidth = trait(g, 2.5);
    ctx.strokeRect(X - l / 2, y, l, bas - y);
    ctx.strokeStyle = 'rgba(60,40,20,0.3)';
    ctx.lineWidth = trait(g, 1.5);
    for (const dx of [-l / 4, l / 4]) { ctx.beginPath(); ctx.moveTo(X + dx, y + 8); ctx.lineTo(X + dx, bas - 4); ctx.stroke(); }
  }

  // Dalle
  rectangle(ctx, x1, y - 4 * g.e, x2 - x1, epaisseur, s.dalle, trait(g), 4);
  ctx.fillStyle = 'rgba(60,40,20,0.2)';
  ctx.fillRect(x1 + 3, y + 10 * g.e, x2 - x1 - 6, 5 * g.e);
  if (terrain.style === 'glace') {
    // Stalactites sous la corniche
    ctx.fillStyle = '#eef8ff';
    ctx.strokeStyle = ENCRE;
    ctx.lineWidth = trait(g, 1.2);
    for (let x = x1 + 12 * g.e; x < x2 - 8 * g.e; x += 26 * g.e) {
      const long = (10 + ((x * 7) % 12)) * g.e;
      ctx.beginPath();
      ctx.moveTo(x - 4 * g.e, y + 15 * g.e); ctx.lineTo(x + 4 * g.e, y + 15 * g.e); ctx.lineTo(x, y + 15 * g.e + long);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x1 + 2, y - 4 * g.e, x2 - x1 - 4, 5 * g.e);
  } else if (terrain.style === 'basalte') {
    ctx.strokeStyle = `rgba(255,${130 + Math.round(Math.sin(t * 2) * 40)},40,0.85)`;
    ctx.lineWidth = trait(g, 1.8);
    for (let x = x1 + 20 * g.e; x < x2 - 20 * g.e; x += 48 * g.e) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8 * g.e, y + 8 * g.e); ctx.lineTo(x + 3 * g.e, y + 14 * g.e); ctx.stroke();
    }
  } else {
    ctx.fillStyle = s.motif;
    for (let x = x1 + 14 * g.e; x < x2 - 10 * g.e; x += 34 * g.e) ctx.fillRect(x, y + 2 * g.e, 12 * g.e, 4 * g.e);
  }
}

// ----------------------------------------------------------------------------
//  Murs de l'arène (avec une torche)
// ----------------------------------------------------------------------------
function dessinerMurs(ctx, g, terrain, t) {
  for (const [x, cote] of [[terrain.murGauche, -1], [terrain.murDroit, 1]]) {
    const X = g.px(x);
    const largeur = 26 * g.e;
    const x0 = cote < 0 ? X - largeur : X;
    const haut = g.py(300);
    ctx.fillStyle = '#9c7a4f';
    ctx.fillRect(x0, haut, largeur, g.sol - haut + 2);
    ctx.strokeStyle = ENCRE;
    ctx.lineWidth = trait(g);
    ctx.strokeRect(x0, haut, largeur, g.sol - haut + 2);
    ctx.strokeStyle = 'rgba(43,26,14,0.35)';
    ctx.lineWidth = trait(g, 1.5);
    for (let y = 0; y < 300; y += 36) {
      ctx.beginPath(); ctx.moveTo(x0, g.py(y)); ctx.lineTo(x0 + largeur, g.py(y)); ctx.stroke();
    }
    const tx = x0 + largeur / 2;
    ctx.fillStyle = '#6b3d1a';
    ctx.fillRect(tx - 3 * g.e, haut - 22 * g.e, 6 * g.e, 22 * g.e);
    flamme(ctx, tx, haut - 30 * g.e, 22 * g.e, t, x);
  }
}

/** Tout le terrain derrière les combattants */
export function dessinerTerrain(ctx, g, terrain, t) {
  for (const trou of terrain.trous) dessinerTrou(ctx, g, trou, t);
  for (const z of terrain.glaces) dessinerGlace(ctx, g, z, t);
  for (const d of terrain.decors) DECORS[d.type]?.(ctx, g, g.px(d.x), g.sol, t);
  for (const p of terrain.plateformes) dessinerPlateforme(ctx, g, terrain, p, t);
  for (const b of terrain.blocs) dessinerBloc(ctx, g, b, t);
  dessinerMurs(ctx, g, terrain, t);
}
