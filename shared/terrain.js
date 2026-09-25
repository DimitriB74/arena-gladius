// ============================================================================
//  ARENA GLADIUS — shared/terrain.js
//
//  Le terrain d'une arène, prêt pour la physique (serveur ET navigateur) :
//  - solides   : le sol (coupé par les trous) et les blocs (caisses, rochers…)
//  - plateformes traversables par-dessous
//  - trous (mortels), zones de glace, décors
//  Les données viennent de shared/data.js (ARENES[id].terrain).
//
//  terrainDe(idArene)                    → terrain (calculé une fois puis gardé)
//  trouSous(terrain, x)                  → le trou au-dessus duquel se trouve x (ou null)
//  supportSous(terrain, x, y)            → hauteur de ce qui est sous les pieds (ou null : le vide)
//  surGlace(terrain, x)                  → x est-il sur une zone de glace ?
// ============================================================================

import { TEMPS_REEL as T, ARENES } from './data.js';

const PROFONDEUR = 5000;          // le sol est un solide très épais
const DEPARTS_PAR_DEFAUT = [470, 1130];
const cache = new Map();

export function terrainDe(idArene) {
  const id = ARENES[idArene] ? idArene : 'colisee';
  if (cache.has(id)) return cache.get(id);

  const def = ARENES[id].terrain || {};
  const { murGauche, murDroit, largeur, limiteChute } = T.arene;
  const typeTrou = def.typeTrou || 'gouffre';
  const trous = (def.trous || [])
    .map((t) => ({ x1: t.x1, x2: t.x2, type: typeTrou }))
    .sort((a, b) => a.x1 - b.x1);

  // Le sol : des morceaux solides entre les trous
  const solides = [];
  let x = murGauche;
  for (const t of trous) {
    if (t.x1 > x) solides.push({ x1: x, x2: t.x1, y1: -PROFONDEUR, y2: 0, sol: true });
    x = Math.max(x, t.x2);
  }
  if (x < murDroit) solides.push({ x1: x, x2: murDroit, y1: -PROFONDEUR, y2: 0, sol: true });

  // Les blocs posés dessus
  const blocs = (def.blocs || []).map((b) => ({ x1: b.x1, x2: b.x2, y1: b.bas || 0, y2: b.haut, type: b.type || 'caisse' }));
  solides.push(...blocs);

  const terrain = {
    id,
    largeur, murGauche, murDroit, limiteChute,
    style: def.style || 'marbre',
    departs: def.departs || DEPARTS_PAR_DEFAUT,
    plateformes: (def.plateformes || []).map((p) => ({ ...p })),
    blocs,
    trous,
    typeTrou,
    glaces: (def.glaces || []).map((g) => ({ ...g })),
    decors: (def.decors || []).map((d) => ({ ...d })),
    solides,
  };
  cache.set(id, terrain);
  return terrain;
}

/** Le trou au-dessus duquel se trouve le point x (ou null) */
export function trouSous(terrain, x) {
  return terrain.trous.find((t) => x > t.x1 && x < t.x2) || null;
}

/**
 * Hauteur de l'appui le plus haut sous (x, y) : sol, dessus d'un bloc ou
 * plateforme. null s'il n'y a que le vide (au-dessus d'un trou).
 * `demi` : demi-largeur du corps (un corps tient debout s'il touche un appui).
 */
export function supportSous(terrain, x, y, demi = 0) {
  let meilleur = null;
  for (const s of terrain.solides) {
    if (x + demi <= s.x1 || x - demi >= s.x2) continue;
    if (s.y2 <= y + 0.5 && (meilleur === null || s.y2 > meilleur)) meilleur = s.y2;
  }
  for (const p of terrain.plateformes) {
    if (x < p.x1 || x > p.x2) continue;
    if (p.y <= y + 0.5 && (meilleur === null || p.y > meilleur)) meilleur = p.y;
  }
  return meilleur;
}

/** x est-il sur une zone de glace ? */
export function surGlace(terrain, x) {
  return terrain.glaces.some((g) => x >= g.x1 && x <= g.x2);
}
