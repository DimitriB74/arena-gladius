// ============================================================================
//  ARENA GLADIUS — client/js/rendu/boutique.js
//
//  Intérieur des boutiques : le marchand derrière son comptoir, les objets
//  exposés au mur et le gladiateur du joueur qui essaie l'objet survolé.
//  Espace virtuel 1000 × 900, cadré dans la zone laissée libre par le menu.
// ============================================================================

import { ARMES, ORDRE_EMPLACEMENTS, ORDRE_MATERIAUX } from '/shared/data.js';
import { ENCRE, forme, cercle, rectangle, bulle, graine } from './outils.js';
import { dessinerGladiateur, dessinerArme } from './gladiateur.js';
import { dessinerIcone } from './icones.js';

const L = 1000, H = 900;

export const MARCHANDS = {
  forgeron: {
    nom: 'Hectorius',
    skin: { peau: 'p4', coiffure: 'barbe', cheveux: 'c1', tunique: 't4' },
    equipement: { arme: { id: 'marteau' }, plastron: { id: 'plastron_cuir' } },
  },
  armurier: {
    nom: 'Livia',
    skin: { peau: 'p2', coiffure: 'queue', cheveux: 'c3', tunique: 't5' },
    equipement: { plastron: { id: 'plastron_bronze' }, casque: null, bouclier: { id: 'bouclier_fer' } },
  },
};

// Position des objets exposés au mur (pour les mettre en valeur au survol)
const ARMES_EXPOSEES = Object.keys(ARMES).filter((id) => id !== 'poings');
function positionArmeMur(i) {
  return [360 + i * 88, 290];
}
function positionArmureMur(emplacement, materiau) {
  const col = ORDRE_MATERIAUX.indexOf(materiau);
  const lig = ORDRE_EMPLACEMENTS.indexOf(emplacement);
  return [380 + col * 150, 185 + lig * 100];
}

function vueBoutique(largeurZone, h) {
  const s = Math.min(h / H, largeurZone / 760);
  return { s, ox: (largeurZone - L * s) / 2, oy: h - H * s };
}

// ----------------------------------------------------------------------------
//  Décors
// ----------------------------------------------------------------------------
function plancher(ctx, xmin, xmax) {
  ctx.fillStyle = '#7a4d2a';
  ctx.fillRect(xmin, 700, xmax - xmin, 500);
  ctx.strokeStyle = 'rgba(40,20,5,0.45)'; ctx.lineWidth = 3;
  for (let y = 700; y < 1200; y += 34) { ctx.beginPath(); ctx.moveTo(xmin, y); ctx.lineTo(xmax, y); ctx.stroke(); }
  const r = graine(9);
  for (let y = 700; y < 1200; y += 34) {
    for (let x = xmin + r() * 200; x < xmax; x += 180 + r() * 120) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 34); ctx.stroke(); }
  }
  ctx.fillStyle = ENCRE; ctx.fillRect(xmin, 697, xmax - xmin, 4);
}

function interieurForge(ctx, t, xmin, xmax, survolId) {
  // Mur de pierre sombre
  ctx.fillStyle = '#5b4535';
  ctx.fillRect(xmin, -400, xmax - xmin, 1100);
  ctx.strokeStyle = 'rgba(20,10,5,0.45)'; ctx.lineWidth = 2.5;
  let n = 0;
  for (let y = -400; y < 700; y += 40, n++) {
    ctx.beginPath(); ctx.moveTo(xmin, y); ctx.lineTo(xmax, y);
    for (let x = Math.floor(xmin / 80) * 80 + (n % 2) * 40; x < xmax; x += 80) { ctx.moveTo(x, y); ctx.lineTo(x, y + 40); }
    ctx.stroke();
  }
  // Poutres
  for (const y of [40, 470]) rectangle(ctx, xmin, y, xmax - xmin, 26, '#4a2d18', 3);

  // Foyer de la forge à gauche
  const lueur = 0.8 + Math.sin(t * 11) * 0.1 + Math.sin(t * 6.1) * 0.08;
  const halo = ctx.createRadialGradient(120, 560, 20, 120, 520, 520);
  halo.addColorStop(0, `rgba(255,150,60,${0.55 * lueur})`);
  halo.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = halo; ctx.fillRect(xmin, -400, 900, 1100);
  forme(ctx, '#7c3a22', () => { ctx.moveTo(10, 700); ctx.lineTo(10, 480); ctx.lineTo(60, 360); ctx.lineTo(180, 360); ctx.lineTo(230, 480); ctx.lineTo(230, 700); ctx.closePath(); }, 4);
  forme(ctx, '#1d0e06', () => { ctx.moveTo(45, 700); ctx.lineTo(45, 590); ctx.arc(120, 590, 75, Math.PI, 0); ctx.lineTo(195, 700); ctx.closePath(); }, 4);
  // Flammes
  for (let i = 0; i < 5; i++) {
    const x = 70 + i * 25, h = 60 + Math.sin(t * 9 + i * 1.7) * 18 + (i % 2) * 20;
    const g = ctx.createLinearGradient(0, 690 - h, 0, 690);
    g.addColorStop(0, 'rgba(255,230,120,0.9)');
    g.addColorStop(1, 'rgba(230,80,20,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 16, 692); ctx.quadraticCurveTo(x - 10, 690 - h * 0.6, x, 690 - h); ctx.quadraticCurveTo(x + 10, 690 - h * 0.6, x + 16, 692); ctx.fill();
  }
  // Soufflet
  forme(ctx, '#6b3d1a', () => { ctx.moveTo(235, 640); ctx.lineTo(300, 610); ctx.lineTo(300, 680); ctx.closePath(); }, 3);

  // Râtelier d'armes au mur
  rectangle(ctx, 310, 150, ARMES_EXPOSEES.length * 88 + 20, 290, '#6b4526', 4, 6);
  rectangle(ctx, 322, 162, ARMES_EXPOSEES.length * 88 - 4, 266, '#8a5a32', 2, 4);
  ARMES_EXPOSEES.forEach((id, i) => {
    const [x, y] = positionArmeMur(i);
    if (survolId === id) {
      const g = ctx.createRadialGradient(x, y, 10, x, y, 90);
      g.addColorStop(0, 'rgba(255,220,110,0.85)');
      g.addColorStop(1, 'rgba(255,220,110,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 90, y - 150, 180, 300);
    }
    cercle(ctx, x, 180, 6, '#c9a042', 2.5);  // cheville
    ctx.save();
    ctx.translate(x, 400);
    ctx.rotate(-Math.PI / 2);
    const longueur = { lance: 0.8, trident: 0.8 }[id] || 1.1;
    ctx.scale(longueur * 2, longueur * 2);
    dessinerArme(ctx, id);
    ctx.restore();
  });
}

function interieurArmurerie(ctx, t, xmin, xmax, survolId) {
  // Mur enduit + soubassement
  ctx.fillStyle = '#e3cda3';
  ctx.fillRect(xmin, -400, xmax - xmin, 1100);
  ctx.fillStyle = '#c9ad85';
  ctx.fillRect(xmin, 600, xmax - xmin, 100);
  ctx.fillStyle = ENCRE; ctx.fillRect(xmin, 598, xmax - xmin, 3);
  // Frise
  ctx.fillStyle = '#8e1f2c'; ctx.fillRect(xmin, 40, xmax - xmin, 18);
  ctx.strokeStyle = '#f2b632'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = Math.floor(xmin / 30) * 30; x < xmax; x += 30) { ctx.moveTo(x, 54); ctx.lineTo(x, 44); ctx.lineTo(x + 15, 44); ctx.lineTo(x + 15, 50); }
  ctx.stroke();
  // Fenêtre avec lumière
  rectangle(ctx, 60, 150, 170, 220, '#9ed0ea', 4, 80);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#fff6d0';
  ctx.beginPath(); ctx.moveTo(60, 370); ctx.lineTo(230, 370); ctx.lineTo(420, 700); ctx.lineTo(160, 700); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(145, 150); ctx.lineTo(145, 370); ctx.moveTo(60, 260); ctx.lineTo(230, 260); ctx.stroke();

  // Étagères : une rangée par emplacement, une colonne par matériau
  for (const emplacement of ORDRE_EMPLACEMENTS) {
    const [, y] = positionArmureMur(emplacement, 'cuir');
    rectangle(ctx, 300, y + 42, 620, 12, '#7a4a22', 3, 2);
    for (const materiau of ORDRE_MATERIAUX) {
      const id = `${emplacement}_${materiau}`;
      const [x, yy] = positionArmureMur(emplacement, materiau);
      if (survolId === id) {
        const g = ctx.createRadialGradient(x, yy, 8, x, yy, 70);
        g.addColorStop(0, 'rgba(255,220,110,0.9)');
        g.addColorStop(1, 'rgba(255,220,110,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 70, yy - 70, 140, 140);
      }
      dessinerIcone(ctx, id, x, yy, 78);
    }
  }
}

function comptoir(ctx, x0, x1, haut) {
  rectangle(ctx, x0, haut + 24, x1 - x0, 700 - haut + 60, '#8a5a32', 4);
  ctx.strokeStyle = 'rgba(40,20,5,0.4)'; ctx.lineWidth = 3;
  for (let x = x0 + 60; x < x1; x += 60) { ctx.beginPath(); ctx.moveTo(x, haut + 30); ctx.lineTo(x, 760); ctx.stroke(); }
  rectangle(ctx, x0 - 16, haut, x1 - x0 + 32, 28, '#a86d3c', 4, 4);
}

// ----------------------------------------------------------------------------
//  Fonction principale
//  options : type ('forgeron' | 'armurier'), largeurZone (px), perso,
//            essai (équipement à essayer), survolId, bulle (texte),
//            marchand : { pose, avancement }, etincelles (0 → 1 ou null)
// ----------------------------------------------------------------------------
export function dessinerBoutique(ctx, w, h, t, o) {
  const vue = vueBoutique(o.largeurZone, h);
  ctx.save();
  ctx.translate(vue.ox, vue.oy);
  ctx.scale(vue.s, vue.s);
  const xmin = -vue.ox / vue.s - 10;
  const xmax = (w - vue.ox) / vue.s + 10;

  if (o.type === 'forgeron') interieurForge(ctx, t, xmin, xmax, o.survolId);
  else interieurArmurerie(ctx, t, xmin, xmax, o.survolId);
  plancher(ctx, xmin, xmax);

  // Marchand derrière le comptoir
  const m = MARCHANDS[o.type];
  dessinerGladiateur(ctx, {
    x: 330, y: 705, echelle: 2.2, direction: 1, skin: m.skin, equipement: m.equipement,
    pose: o.marchand?.pose || 'repos', avancement: o.marchand?.avancement || 0, temps: t,
  });
  comptoir(ctx, 110, 560, 600);
  // Objets posés sur le comptoir
  if (o.type === 'forgeron') {
    forme(ctx, '#4d545c', () => ctx.roundRect(440, 572, 90, 30, 6), 3);
  } else {
    dessinerIcone(ctx, 'casque_cuir', 480, 570, 60);
  }
  // Étincelles quand le marchand frappe
  if (o.etincelles != null) {
    const p = o.etincelles;
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i - 5.5) * 0.28;
      ctx.fillStyle = `rgba(255,${200 + (i % 3) * 20},80,${1 - p})`;
      ctx.beginPath();
      ctx.arc(480 + Math.cos(a) * p * 120, 590 + Math.sin(a) * p * 110 + p * p * 70, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Nom du marchand
  ctx.font = "800 20px Cinzel, Georgia, serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  rectangle(ctx, 250, 650, 170, 34, '#f3e2bb', 3, 6);
  ctx.fillStyle = ENCRE; ctx.fillText(m.nom, 335, 668);

  // Le joueur, qui essaie l'objet survolé
  if (o.perso) {
    dessinerGladiateur(ctx, {
      x: 800, y: 880, echelle: 2.0, direction: -1, skin: o.perso.skin,
      equipement: o.essai || o.perso.equipement, pose: 'repos', temps: t + 0.5,
    });
    if (o.essai) {
      rectangle(ctx, 700, 552, 200, 34, 'rgba(43,26,14,0.8)', 0, 17);
      ctx.fillStyle = '#f3e2bb';
      ctx.font = "700 19px 'Alegreya Sans', sans-serif";
      ctx.fillText('Essayage…', 800, 570);
    }
  }

  // Bulle de dialogue du marchand
  if (o.bulle) bulle(ctx, o.bulle, 380, 380, { largeur: 420, taille: 24 });

  ctx.restore();
}

