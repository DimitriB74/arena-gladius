// ============================================================================
//  ARENA GLADIUS — client/js/rendu/combat.js
//
//  Dessin d'un combat en temps réel, vu de côté :
//  décor de l'arène, terrain (voir terrain.js), gladiateurs (poses selon ce
//  qu'ils font), signal des attaques lourdes, bulle de garde, étoiles quand on
//  est sonné, traînée de l'esquive, textes flottants et secousse à l'impact.
// ============================================================================

import { dureePhase } from '/shared/formulas.js';
import { terrainDe, supportSous } from '/shared/terrain.js';
import { dessinerDecor } from './decor.js';
import { geometrie, dessinerTerrain, dessinerAvantPlan } from './terrain.js';
import { dessinerGladiateur } from './gladiateur.js';
import { texteContour, ENCRE } from './outils.js';

// Le décor est dessiné un peu plus haut pour laisser la place aux commandes en bas
const RATIO_DECOR = 0.86;
const COULEUR_SOL = { colisee: '#e9c27a', desert: '#f0b867', foret: '#7a9b45', volcan: '#4b2d25', neige: '#f4f8fc' };
const TAILLE_GLADIATEUR = 1.12; // taille du dessin par rapport à son corps (150 unités)

/** Passage des coordonnées de l'arène (unités) aux pixels de l'écran */
export const geometrieCombat = (w, h) => geometrie(w, h * RATIO_DECOR, h);

// ----------------------------------------------------------------------------
//  Gladiateurs
// ----------------------------------------------------------------------------
/** Pose et avancement de l'animation selon l'état du combattant */
function poseDe(c) {
  if (c.etat === 'ko') return { pose: 'ko', av: 0 };
  if (c.etat === 'victoire') return { pose: 'victoire', av: 0 };
  if (c.etat === 'esquive') return { pose: 'esquive', av: 0 };
  if (c.etat === 'etourdi') return { pose: c.sonne ? 'etourdi' : 'touche', av: 0 };
  if (c.etat === 'attaque' && c.attaque) {
    const a = c.attaque;
    const d = (ph) => dureePhase(a.type, ph, c.stats);
    const r = (ph) => Math.min(1, Math.max(0, a.t / d(ph)));
    let av;
    if (a.phase === 'preparation') av = 0.35 * r('preparation');
    else if (a.phase === 'active') av = 0.35 + 0.3 * r('active');
    else av = 0.65 + 0.35 * r('recuperation');
    return { pose: 'attaque', av };
  }
  if (c.parade) return { pose: 'protege', av: 0 };
  if (!c.auSol) return { pose: c.vy > 0 ? 'saut' : 'chute', av: 0 };
  if (Math.abs(c.vx) > 40) return { pose: 'course', av: (c.x / 95) % 1 < 0 ? ((c.x / 95) % 1) + 1 : (c.x / 95) % 1 };
  return { pose: 'repos', av: 0 };
}

function bulleGarde(ctx, x, y, e, dir, force) {
  ctx.save();
  ctx.translate(x + dir * 22 * e, y - 80 * e);
  const g = ctx.createRadialGradient(0, 0, 20 * e, 0, 0, 90 * e);
  g.addColorStop(0, 'rgba(120,190,255,0)');
  g.addColorStop(0.75, `rgba(120,190,255,${0.15 + 0.2 * force})`);
  g.addColorStop(1, `rgba(170,220,255,${0.4 + 0.4 * force})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 62 * e, 95 * e, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function etoiles(ctx, x, y, e, t) {
  for (let k = 0; k < 3; k++) {
    const a = t * 5 + (k * Math.PI * 2) / 3;
    const sx = x + Math.cos(a) * 28 * e, sy = y + Math.sin(a) * 8 * e;
    ctx.fillStyle = '#ffd766';
    ctx.strokeStyle = ENCRE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 ? 4 : 9) * e;
      const b = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(sx + Math.cos(b) * r, sy + Math.sin(b) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** Signal d'attaque lourde : un éclat rouge au-dessus de la tête pendant la préparation */
function signalLourde(ctx, x, y, e, t) {
  const p = 0.6 + Math.sin(t * 30) * 0.4;
  ctx.save();
  ctx.globalAlpha = p;
  texteContour(ctx, '!', x, y, { taille: Math.round(34 * e), couleur: '#ff4a3a', epaisseur: 5 });
  ctx.restore();
}

function dessinerCombattant(ctx, g, terrain, c, t, estMoi) {
  const x = g.px(c.x), y = g.py(c.y);
  const echelle = g.e * TAILLE_GLADIATEUR;
  const { pose, av } = poseDe(c);

  // Ombre sur ce qui est dessous (même en l'air ; pas d'ombre au-dessus du vide)
  const appui = supportSous(terrain, c.x, c.y);
  if (appui !== null) {
    const hauteur = Math.max(0, c.y - appui);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.08, 0.25 - hauteur / 1500)})`;
    ctx.beginPath();
    ctx.ellipse(x, g.py(appui), 32 * echelle * (1 - Math.min(0.5, hauteur / 800)), 6 * echelle, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Traînée de l'esquive
  if (c.etat === 'esquive') {
    for (let k = 1; k <= 3; k++) {
      ctx.save();
      ctx.globalAlpha = 0.18 / k;
      dessinerGladiateur(ctx, {
        x: x - c.dir * k * 26 * g.e, y, echelle, direction: c.dir,
        skin: c.skin, equipement: c.equipement, pose, avancement: av, temps: t,
      });
      ctx.restore();
    }
  }

  // Clignotement pendant l'invincibilité
  ctx.save();
  if (c.invincible > 0 && c.etat !== 'esquive') ctx.globalAlpha = 0.55 + Math.sin(t * 40) * 0.3;
  dessinerGladiateur(ctx, {
    x, y, echelle, direction: c.dir, skin: c.skin, equipement: c.equipement, pose, avancement: av, temps: t + c.index,
  });
  ctx.restore();

  if (c.parade) bulleGarde(ctx, x, y, echelle, c.dir, c.garde / Math.max(1, c.stats.tr.gardeMax));
  if (c.etat === 'etourdi' && c.sonne) etoiles(ctx, x, y - 150 * echelle, echelle, t);
  if (c.etat === 'attaque' && c.attaque?.type === 'lourde' && c.attaque.phase === 'preparation') {
    signalLourde(ctx, x, y - 170 * echelle, echelle, t);
  }
  // « TOI » sous ton gladiateur
  if (estMoi && c.etat !== 'ko') {
    texteContour(ctx, '▲ TOI', x, g.py(c.y) + 22 * echelle, { taille: Math.round(13 * Math.max(1, echelle)), couleur: '#f2b632', epaisseur: 4 });
  }
}

// ----------------------------------------------------------------------------
//  Effets
// ----------------------------------------------------------------------------
function etoileImpact(ctx, x, y, taille, progression, couleur) {
  ctx.save();
  ctx.globalAlpha = 1 - progression;
  ctx.translate(x, y);
  ctx.rotate(progression * 0.6);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? taille * 0.4 : taille * (1 + progression * 0.6);
    const a = (i / 16) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
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
 * @param vis { arene, combattants: [c0, c1] (déjà prêts à dessiner), monIndex,
 *              textes: [{texte, x, y, couleur, taille, debut}], impacts: [{x, y, couleur, debut}],
 *              secousse: { amplitude, debut } }
 */
export function dessinerCombat(ctx, w, h, t, vis) {
  const g = geometrieCombat(w, h);
  const terrain = terrainDe(vis.arene);
  const maintenant = performance.now();
  ctx.save();
  if (vis.secousse) {
    const age = (maintenant - vis.secousse.debut) / 1000;
    if (age < 0.3) {
      const amp = vis.secousse.amplitude * (1 - age / 0.3);
      ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
    }
  }

  const hDecor = Math.round(h * RATIO_DECOR);
  ctx.fillStyle = COULEUR_SOL[vis.arene] || COULEUR_SOL.colisee;
  ctx.fillRect(-20, hDecor - 2, w + 40, h - hDecor + 40);
  dessinerDecor(ctx, vis.arene, w, hDecor, t);
  dessinerTerrain(ctx, g, terrain, t);

  // L'adversaire d'abord, ton gladiateur par-dessus
  const ordre = [1 - vis.monIndex, vis.monIndex];
  for (const i of ordre) {
    const c = vis.combattants[i];
    if (c) dessinerCombattant(ctx, g, terrain, c, t, i === vis.monIndex);
  }
  // Ceux qui tombent disparaissent dans la lave ou dans le noir
  dessinerAvantPlan(ctx, g, terrain, t);

  // Impacts
  vis.impacts = vis.impacts.filter((im) => maintenant - im.debut < 300);
  for (const im of vis.impacts) {
    etoileImpact(ctx, g.px(im.x), g.py(im.y), 26 * g.e * TAILLE_GLADIATEUR, (maintenant - im.debut) / 300, im.couleur);
  }

  // Textes flottants
  vis.textes = vis.textes.filter((tx) => maintenant - tx.debut < 1200);
  for (const tx of vis.textes) {
    const p = (maintenant - tx.debut) / 1200;
    const apparition = Math.min(1, p * 8);
    ctx.save();
    ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
    ctx.translate(g.px(tx.x), g.py(tx.y) - 30 - p * 60);
    ctx.scale(0.6 + apparition * 0.4, 0.6 + apparition * 0.4);
    texteContour(ctx, tx.texte, 0, 0, {
      taille: Math.round((tx.taille || 30) * Math.max(0.8, Math.min(1.4, g.e * 1.6))), couleur: tx.couleur || '#fff', epaisseur: 6,
    });
    ctx.restore();
  }
  ctx.restore();
}
