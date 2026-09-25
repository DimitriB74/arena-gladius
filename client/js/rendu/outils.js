// ============================================================================
//  ARENA GLADIUS — client/js/rendu/outils.js
//  Primitives de dessin « cartoon » partagées (contours épais couleur encre).
// ============================================================================

export const ENCRE = '#2b1a0e';

/** Éclaircit (+) ou assombrit (−) une couleur hexadécimale */
export function nuance(hex, delta) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + delta * 255)));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Remplit un tracé puis le contourne à l'encre */
export function forme(ctx, couleur, trace, epaisseur = 3) {
  ctx.beginPath();
  trace();
  ctx.fillStyle = couleur;
  ctx.fill();
  if (epaisseur > 0) {
    ctx.lineWidth = epaisseur;
    ctx.strokeStyle = ENCRE;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export function cercle(ctx, x, y, r, couleur, epaisseur = 3) {
  forme(ctx, couleur, () => ctx.arc(x, y, r, 0, Math.PI * 2), epaisseur);
}

export function rectangle(ctx, x, y, l, h, couleur, epaisseur = 3, rayon = 0) {
  forme(ctx, couleur, () => (rayon ? ctx.roundRect(x, y, l, h, rayon) : ctx.rect(x, y, l, h)), epaisseur);
}

/** Membre épais : un trait d'encre puis un trait de couleur par-dessus */
export function membre(ctx, points, couleur, largeur) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [c, l] of [[ENCRE, largeur + 5], [couleur, largeur]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = l;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }
}

/** Texte avec contour épais (style titre de jeu) */
export function texteContour(ctx, texte, x, y, {
  taille = 24, police = 'Cinzel', graisse = 800, couleur = '#f2b632', contour = ENCRE,
  epaisseur = 5, alignement = 'center', base = 'middle',
} = {}) {
  ctx.font = `${graisse} ${taille}px ${police}, Georgia, serif`;
  ctx.textAlign = alignement;
  ctx.textBaseline = base;
  ctx.lineJoin = 'round';
  if (epaisseur > 0) {
    ctx.lineWidth = epaisseur;
    ctx.strokeStyle = contour;
    ctx.strokeText(texte, x, y);
  }
  ctx.fillStyle = couleur;
  ctx.fillText(texte, x, y);
}

/** Découpe un texte en lignes qui tiennent dans `largeur` (police déjà réglée) */
export function decouperLignes(ctx, texte, largeur) {
  const lignes = [];
  let ligne = '';
  for (const mot of texte.split(' ')) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ctx.measureText(essai).width > largeur && ligne) {
      lignes.push(ligne);
      ligne = mot;
    } else ligne = essai;
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

/** Bulle de dialogue (x, y = pointe de la queue) */
export function bulle(ctx, texte, x, y, { largeur = 320, cote = 'bas', taille = 20 } = {}) {
  ctx.font = `700 ${taille}px 'Alegreya Sans', 'Segoe UI', sans-serif`;
  const lignes = decouperLignes(ctx, texte, largeur - 36);
  const hauteur = lignes.length * taille * 1.25 + 26;
  const bx = x - largeur * 0.3;
  const by = cote === 'bas' ? y - 22 - hauteur : y + 22;
  forme(ctx, '#fffaf0', () => {
    ctx.roundRect(bx, by, largeur, hauteur, 16);
    if (cote === 'bas') {
      ctx.moveTo(x - 12, by + hauteur - 1); ctx.lineTo(x, y); ctx.lineTo(x + 12, by + hauteur - 1);
    }
  }, 4);
  // Efface le contour entre la bulle et sa queue
  ctx.fillStyle = '#fffaf0';
  if (cote === 'bas') ctx.fillRect(x - 9, by + hauteur - 4, 18, 6);
  ctx.fillStyle = ENCRE;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lignes.forEach((l, i) => ctx.fillText(l, bx + 18, by + 13 + i * taille * 1.25));
}

/** Petit générateur pseudo-aléatoire stable (décors identiques d'une image à l'autre) */
export function graine(n) {
  let s = n;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
