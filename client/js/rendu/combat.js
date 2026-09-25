// ============================================================================
//  ARENA GLADIUS — client/js/rendu/combat.js
//
//  Dessin d'un combat : décor de l'arène, piste de 10 cases, gladiateurs
//  (avec leurs poses animées), bulle de garde, chiffres flottants,
//  secousse de l'écran à l'impact.
// ============================================================================

import { COMBAT } from '/shared/data.js';
import { dessinerDecor, hauteurSol } from './decor.js';
import { dessinerGladiateur } from './gladiateur.js';
import { texteContour, ENCRE } from './outils.js';

// Pendant un combat, le décor est dessiné un peu plus haut pour laisser la place
// à la barre d'actions en bas de l'écran ; on prolonge le sol jusqu'en bas.
const RATIO_DECOR = 0.84;
const COULEUR_SOL = { colisee: '#e9c27a', desert: '#f0b867', foret: '#7a9b45', volcan: '#4b2d25', neige: '#f4f8fc' };

/** Géométrie de la piste pour un écran w × h */
export function geometriePiste(w, h) {
  const sol = hauteurSol(h * RATIO_DECOR) + 6;
  const marge = Math.max(30, w * 0.07);
  const largeurCase = (w - 2 * marge) / COMBAT.nbCases;
  const echelle = Math.max(0.6, Math.min(largeurCase / 70, h / 400, 1.9));
  return { sol, marge, largeurCase, echelle, xCase: (c) => marge + (c - 0.5) * largeurCase };
}

function dessinerPiste(ctx, g, surbrillance) {
  for (let c = 1; c <= COMBAT.nbCases; c++) {
    const x = g.xCase(c);
    const eclaire = surbrillance?.cases?.includes(c);
    ctx.fillStyle = eclaire ? surbrillance.couleur : 'rgba(43,26,14,0.13)';
    ctx.beginPath();
    ctx.ellipse(x, g.sol + 10, g.largeurCase * 0.4, 7 * g.echelle, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Petits piquets aux deux extrémités
  for (const x of [g.marge - 8, g.marge + g.largeurCase * COMBAT.nbCases + 8]) {
    ctx.fillStyle = ENCRE;
    ctx.fillRect(x - 3, g.sol - 26 * g.echelle, 6, 30 * g.echelle);
    ctx.fillStyle = '#b8323f';
    ctx.fillRect(x - 3, g.sol - 26 * g.echelle, 16, 10 * g.echelle);
  }
}

function bulleGarde(ctx, x, y, echelle, direction, t) {
  const pulse = 1 + Math.sin(t * 5) * 0.04;
  ctx.save();
  ctx.translate(x + direction * 18 * echelle, y - 70 * echelle);
  ctx.scale(pulse, pulse);
  const g = ctx.createRadialGradient(0, 0, 20 * echelle, 0, 0, 78 * echelle);
  g.addColorStop(0, 'rgba(120,190,255,0)');
  g.addColorStop(0.8, 'rgba(120,190,255,0.28)');
  g.addColorStop(1, 'rgba(160,215,255,0.7)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 58 * echelle, 82 * echelle, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function etoileImpact(ctx, x, y, taille, progression, couleur) {
  const a = 1 - progression;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.rotate(progression * 0.6);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? taille * 0.4 : taille * (1 + progression * 0.5);
    const ang = (i / 16) * Math.PI * 2;
    ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
  }
  ctx.closePath();
  ctx.fillStyle = couleur;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ENCRE;
  ctx.stroke();
  ctx.restore();
}

/**
 * @param vis {
 *   arene, tour, monIndex, fini,
 *   combattants: [{ skin, equipement, x, pose, avancement, protege, decalage, impact }],
 *   textes: [{ texte, x (case), dy, couleur, taille, debut }],
 *   secousse: { amplitude, debut }, surbrillance: { cases, couleur }
 * }
 */
export function dessinerCombat(ctx, w, h, t, vis) {
  const g = geometriePiste(w, h);
  const maintenant = performance.now();

  ctx.save();
  // Secousse de l'écran
  if (vis.secousse) {
    const age = (maintenant - vis.secousse.debut) / 1000;
    if (age < 0.35) {
      const amp = vis.secousse.amplitude * (1 - age / 0.35);
      ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
    }
  }

  const hDecor = Math.round(h * RATIO_DECOR);
  ctx.fillStyle = COULEUR_SOL[vis.arene] || COULEUR_SOL.colisee;
  ctx.fillRect(-20, hDecor - 2, w + 40, h - hDecor + 40);
  dessinerDecor(ctx, vis.arene, w, hDecor, t);
  dessinerPiste(ctx, g, vis.surbrillance);

  vis.combattants.forEach((c, i) => {
    const direction = i === 0 ? 1 : -1;
    const x = g.xCase(c.x + (c.decalage || 0));
    // Marqueur de tour : flèche dorée au-dessus du gladiateur actif
    if (!vis.fini && vis.tour === i) {
      const y = g.sol - 185 * g.echelle + Math.sin(t * 5) * 5;
      ctx.fillStyle = '#f2b632';
      ctx.strokeStyle = ENCRE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 14); ctx.lineTo(x + 12, y - 14); ctx.lineTo(x, y + 2); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    // Étiquette « TOI »
    if (i === vis.monIndex) {
      texteContour(ctx, 'TOI', x, g.sol + 34 * g.echelle, { taille: Math.round(15 * g.echelle), couleur: '#f2b632', epaisseur: 4 });
    }
    dessinerGladiateur(ctx, {
      x, y: g.sol, echelle: g.echelle, direction,
      skin: c.skin, equipement: c.equipement, pose: c.pose, avancement: c.avancement, temps: t + i * 0.8,
    });
    if (c.protege && c.pose !== 'ko') bulleGarde(ctx, x, g.sol, g.echelle, direction, t);
    if (c.impact) {
      const p = (maintenant - c.impact.debut) / 350;
      if (p < 1) etoileImpact(ctx, x, g.sol - 75 * g.echelle, 26 * g.echelle, p, c.impact.couleur);
    }
  });

  // Textes flottants (dégâts, « Raté ! », etc.)
  vis.textes = vis.textes.filter((tx) => maintenant - tx.debut < 1400);
  for (const tx of vis.textes) {
    const p = (maintenant - tx.debut) / 1400;
    const x = g.xCase(tx.x);
    const y = g.sol - (150 + (tx.dy || 0)) * g.echelle - p * 60;
    const apparition = Math.min(1, p * 8);
    ctx.save();
    ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
    ctx.translate(x, y);
    ctx.scale(0.6 + apparition * 0.4, 0.6 + apparition * 0.4);
    texteContour(ctx, tx.texte, 0, 0, {
      taille: Math.round((tx.taille || 30) * Math.min(1.3, g.echelle)), couleur: tx.couleur || '#fff', epaisseur: 6,
    });
    ctx.restore();
  }
  ctx.restore();
}
