// ============================================================================
//  ARENA GLADIUS — client/js/rendu/gladiateur.js
//
//  Dessin procédural d'un gladiateur (style cartoon, contours épais).
//  Aucune image externe : tout est fait avec des formes simples sur canvas.
//
//  dessinerGladiateur(ctx, options) — options :
//    x, y        : position des pieds (au sol)
//    echelle     : 1 = environ 130 px de haut
//    direction   : 1 = regarde à droite, -1 = regarde à gauche
//    skin        : { peau, coiffure, cheveux, tunique } (ids de SKINS)
//    equipement  : { arme, casque, plastron, jambieres, bouclier } (objets {id, niveau})
//    pose        : 'repos' | 'marche' | 'attaque' | 'protege' | 'ko' | 'victoire'
//    avancement  : 0 → 1, progression de l'animation de la pose
//    temps       : secondes écoulées (respiration, cape qui flotte)
// ============================================================================

import { SKINS, ARMURES, MATERIAUX } from '/shared/data.js';
import { ENCRE, nuance, membre, forme, cercle } from './outils.js';

export { nuance };

const CUIR_SANDALE = '#5a3317';

export const couleurSkin = (cat, id) => (SKINS[cat].find((o) => o.id === id) || SKINS[cat][0]).couleur;

function materiauDe(objet) {
  const a = objet && ARMURES[objet.id];
  return a ? MATERIAUX[a.materiau] : null;
}

const polaire = (x, y, angle, longueur) => [x + Math.cos(angle) * longueur, y + Math.sin(angle) * longueur];

// ----------------------------------------------------------------------------
//  Armes (dessinées dans le repère de la main, lame vers +x)
// ----------------------------------------------------------------------------
export function dessinerArme(ctx, idArme) {
  const metal = '#d9dee4', manche = '#7a4a22', ombre = '#9aa3ad';
  switch (idArme) {
    case 'dague':
      forme(ctx, manche, () => ctx.rect(-6, -3, 10, 6));
      forme(ctx, '#c9a042', () => ctx.rect(3, -7, 4, 14));
      forme(ctx, metal, () => { ctx.moveTo(7, -4); ctx.lineTo(28, 0); ctx.lineTo(7, 4); ctx.closePath(); });
      break;
    case 'glaive':
      forme(ctx, manche, () => ctx.rect(-8, -3.5, 13, 7));
      cercle(ctx, -10, 0, 4, '#c9a042', 2.5);
      forme(ctx, '#c9a042', () => ctx.rect(4, -9, 5, 18));
      forme(ctx, metal, () => {
        ctx.moveTo(9, -5); ctx.lineTo(40, -5); ctx.lineTo(48, 0); ctx.lineTo(40, 5); ctx.lineTo(9, 5); ctx.closePath();
      });
      ctx.strokeStyle = ombre; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(42, 0); ctx.stroke();
      break;
    case 'lance':
      forme(ctx, manche, () => ctx.rect(-30, -3, 92, 6));
      forme(ctx, metal, () => { ctx.moveTo(60, -7); ctx.lineTo(80, 0); ctx.lineTo(60, 7); ctx.lineTo(56, 0); ctx.closePath(); });
      break;
    case 'masse':
      forme(ctx, manche, () => ctx.rect(-8, -3.5, 40, 7));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        forme(ctx, ombre, () => {
          ctx.moveTo(38 + Math.cos(a - 0.35) * 9, Math.sin(a - 0.35) * 9);
          ctx.lineTo(38 + Math.cos(a) * 17, Math.sin(a) * 17);
          ctx.lineTo(38 + Math.cos(a + 0.35) * 9, Math.sin(a + 0.35) * 9);
        }, 2.5);
      }
      cercle(ctx, 38, 0, 11, '#8d949c');
      break;
    case 'hache':
      forme(ctx, manche, () => ctx.rect(-10, -3.5, 56, 7));
      forme(ctx, metal, () => {
        ctx.moveTo(34, -4); ctx.quadraticCurveTo(40, -24, 56, -26);
        ctx.quadraticCurveTo(50, 0, 56, 22); ctx.quadraticCurveTo(40, 20, 34, 4); ctx.closePath();
      });
      break;
    case 'trident':
      forme(ctx, manche, () => ctx.rect(-30, -3, 84, 6));
      forme(ctx, metal, () => ctx.rect(50, -14, 6, 28));
      for (const dy of [-12, 0, 12]) {
        forme(ctx, metal, () => { ctx.moveTo(54, dy - 3); ctx.lineTo(dy === 0 ? 82 : 76, dy); ctx.lineTo(54, dy + 3); ctx.closePath(); }, 2.5);
      }
      break;
    case 'marteau':
      forme(ctx, manche, () => ctx.rect(-10, -4, 62, 8));
      forme(ctx, '#8d949c', () => ctx.roundRect(42, -20, 22, 40, 4));
      forme(ctx, '#b9c0c7', () => ctx.rect(46, -16, 5, 32), 2);
      break;
    default: // poings : rien
      break;
  }
}

// ----------------------------------------------------------------------------
//  Tête : visage, coiffure, casque
// ----------------------------------------------------------------------------
function dessinerCheveuxArriere(ctx, coiffure, couleur, avecCasque) {
  if (coiffure === 'queue') {
    forme(ctx, couleur, () => {
      ctx.moveTo(-14, -118); ctx.quadraticCurveTo(-34, -112, -30, -88);
      ctx.quadraticCurveTo(-22, -100, -12, -104); ctx.closePath();
    });
  }
  if (coiffure === 'boucles' && !avecCasque) {
    for (const [dx, dy] of [[-16, -104], [-14, -94]]) cercle(ctx, dx, dy, 7, couleur, 2.5);
  }
}

function dessinerTete(ctx, skin, casque) {
  const peau = couleurSkin('peau', skin.peau);
  const cheveux = couleurSkin('cheveux', skin.cheveux);
  const tunique = couleurSkin('tunique', skin.tunique);
  const mat = materiauDe(casque);
  const cx = 2, cy = -108, r = 19;

  dessinerCheveuxArriere(ctx, skin.coiffure, cheveux, !!mat);

  // Cou + tête
  membre(ctx, [[0, -92], [1, -98]], peau, 12);
  cercle(ctx, cx, cy, r, peau);
  // Oreille
  cercle(ctx, -4, -106, 5, nuance(peau, -0.06), 2.5);

  // Barbe (sous le casque aussi)
  if (skin.coiffure === 'barbe') {
    forme(ctx, cheveux, () => {
      ctx.moveTo(-2, -104); ctx.quadraticCurveTo(0, -84, 14, -88);
      ctx.quadraticCurveTo(22, -92, 21, -100); ctx.quadraticCurveTo(12, -96, 6, -98); ctx.closePath();
    });
  }

  // Visage
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(12, -110, 4.2, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = ENCRE;
  ctx.beginPath(); ctx.arc(14, -109.5, 2.2, 0, Math.PI * 2); ctx.fill();
  // Sourcil déterminé
  ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(7, -118); ctx.lineTo(18, -115); ctx.stroke();
  // Nez
  forme(ctx, peau, () => { ctx.moveTo(18, -110); ctx.lineTo(25, -102); ctx.lineTo(18, -101); }, 2.5);
  // Bouche
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(12, -96); ctx.lineTo(18, -97); ctx.stroke();

  if (mat) {
    dessinerCasque(ctx, mat, casque, tunique);
    return;
  }

  // Coiffures sans casque
  switch (skin.coiffure) {
    case 'chauve':
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.ellipse(-2, -121, 6, 3, -0.4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'crete':
      forme(ctx, cheveux, () => {
        ctx.moveTo(-14, -116);
        for (let i = 0; i < 5; i++) {
          const a = Math.PI * (1.05 + i * 0.2);
          const [px, py] = polaire(cx, cy, a + 0.1, r + 13);
          const [bx, by] = polaire(cx, cy, a + 0.2, r - 1);
          ctx.lineTo(px, py); ctx.lineTo(bx, by);
        }
        ctx.lineTo(10, -124); ctx.closePath();
      });
      break;
    case 'boucles':
      for (const [dx, dy] of [[-12, -120], [-4, -126], [6, -127], [-16, -110]]) cercle(ctx, dx, dy, 7, cheveux, 2.5);
      break;
    default: // court, queue, barbe : calotte de cheveux
      forme(ctx, cheveux, () => {
        ctx.moveTo(-15, -100);
        ctx.quadraticCurveTo(-22, -126, 2, -128);
        ctx.quadraticCurveTo(20, -128, 20, -116);
        ctx.quadraticCurveTo(6, -120, -2, -114);
        ctx.quadraticCurveTo(-6, -106, -8, -100);
        ctx.closePath();
      });
  }
}

function dessinerCasque(ctx, mat, casque, tunique) {
  const palier = ARMURES[casque.id].palier;
  // Calotte
  forme(ctx, mat.couleur, () => {
    ctx.moveTo(-18, -102);
    ctx.quadraticCurveTo(-22, -130, 2, -131);
    ctx.quadraticCurveTo(24, -131, 23, -112);
    ctx.lineTo(8, -114);
    ctx.lineTo(4, -104);
    ctx.lineTo(-6, -98);
    ctx.closePath();
  });
  // Reflet
  ctx.strokeStyle = mat.reflet; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, -122); ctx.quadraticCurveTo(0, -128, 10, -126); ctx.stroke();
  // Bord frontal
  membre(ctx, [[-2, -115], [23, -113]], nuance(mat.couleur, -0.12), 3);
  // Couvre-joue (bronze et plus)
  if (palier >= 2) {
    forme(ctx, nuance(mat.couleur, -0.05), () => {
      ctx.moveTo(4, -112); ctx.lineTo(12, -112); ctx.lineTo(10, -96); ctx.lineTo(2, -98); ctx.closePath();
    }, 2.5);
  }
  // Cimier en plumes, couleur de la tunique (bronze et plus)
  if (palier >= 2) {
    const hauteur = palier >= 3 ? 20 : 15;
    forme(ctx, tunique, () => {
      ctx.moveTo(-16, -120);
      ctx.quadraticCurveTo(-12, -131 - hauteur, 12, -130 - hauteur * 0.7);
      ctx.quadraticCurveTo(20, -134, 14, -128);
      ctx.quadraticCurveTo(0, -132, -16, -120);
      ctx.closePath();
    });
    ctx.strokeStyle = nuance(tunique, -0.25); ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(-10 + i * 5, -128 - i); ctx.lineTo(-8 + i * 5, -136 - hauteur * 0.5); ctx.stroke();
    }
  }
  // Rivets (fer et acier)
  if (palier >= 3) {
    ctx.fillStyle = ENCRE;
    for (const x of [-12, -4, 4, 12]) { ctx.beginPath(); ctx.arc(x, -118 + Math.abs(x) * 0.2, 1.4, 0, Math.PI * 2); ctx.fill(); }
  }
}

// ----------------------------------------------------------------------------
//  Corps
// ----------------------------------------------------------------------------
function dessinerJambe(ctx, hanche, angle, peau, jambieres) {
  const genou = [hanche[0] + Math.sin(angle) * 22, hanche[1] + Math.cos(angle) * 22];
  const pied = [genou[0] + Math.sin(angle * 0.6) * 22, Math.min(-3, genou[1] + 22)];
  membre(ctx, [hanche, genou], peau, 11);
  const mat = materiauDe(jambieres);
  membre(ctx, [genou, pied], mat ? mat.couleur : peau, mat ? 12 : 10);
  if (mat) {
    ctx.strokeStyle = mat.reflet; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(genou[0] + 3, genou[1] + 3); ctx.lineTo(pied[0] + 3, pied[1] - 6); ctx.stroke();
  } else {
    // Lanières de sandales
    ctx.strokeStyle = CUIR_SANDALE; ctx.lineWidth = 2.5;
    for (const t of [0.45, 0.7]) {
      const x = genou[0] + (pied[0] - genou[0]) * t, y = genou[1] + (pied[1] - genou[1]) * t;
      ctx.beginPath(); ctx.moveTo(x - 6, y - 1); ctx.lineTo(x + 6, y + 2); ctx.stroke();
    }
  }
  // Sandale
  forme(ctx, CUIR_SANDALE, () => ctx.ellipse(pied[0] + 5, pied[1] + 1, 11, 4.5, 0, 0, Math.PI * 2), 2.5);
}

function dessinerTorse(ctx, skin, plastron) {
  const peau = couleurSkin('peau', skin.peau);
  const tunique = couleurSkin('tunique', skin.tunique);
  const mat = materiauDe(plastron);

  // Buste (peau) puis tunique
  forme(ctx, peau, () => ctx.roundRect(-17, -92, 34, 44, 12));
  forme(ctx, tunique, () => {
    ctx.moveTo(-17, -80); ctx.lineTo(-4, -92); ctx.lineTo(17, -86);
    ctx.lineTo(18, -52); ctx.lineTo(-18, -52); ctx.closePath();
  });
  // Jupe à lanières (ptéryges)
  for (let i = 0; i < 5; i++) {
    const x = -18 + i * 7.5;
    forme(ctx, i % 2 ? nuance(tunique, -0.12) : tunique, () => ctx.roundRect(x, -54, 8, 22, 3), 2.5);
  }
  // Cuirasse
  if (mat) {
    forme(ctx, mat.couleur, () => {
      ctx.moveTo(-16, -88); ctx.quadraticCurveTo(0, -94, 17, -86);
      ctx.lineTo(18, -56); ctx.quadraticCurveTo(0, -50, -17, -56); ctx.closePath();
    });
    ctx.strokeStyle = nuance(mat.couleur, -0.25); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-4, -80, 8, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(10, -80, 7, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.strokeStyle = mat.reflet; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-10, -86); ctx.quadraticCurveTo(-2, -89, 6, -88); ctx.stroke();
  }
  // Ceinture
  forme(ctx, '#6b3d1a', () => ctx.rect(-19, -58, 38, 7), 2.5);
  forme(ctx, '#e0b341', () => ctx.rect(-3, -59, 7, 9), 2);
}

function dessinerBouclier(ctx, x, y, bouclier) {
  const mat = materiauDe(bouclier);
  if (!mat) return false;
  const palier = ARMURES[bouclier.id].palier;
  const r = 17 + palier * 2;
  cercle(ctx, x, y, r, mat.couleur, 3.5);
  ctx.strokeStyle = nuance(mat.couleur, -0.2); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r - 5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = mat.reflet; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r - 9, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
  cercle(ctx, x, y, 5 + palier, nuance(mat.reflet, -0.05), 2.5); // umbo central
  return true;
}

// ----------------------------------------------------------------------------
//  Poses : angles des membres selon l'animation
// ----------------------------------------------------------------------------
function calculerPose(pose, av, temps) {
  const souffle = Math.sin(temps * 2.4) * 1.5;
  const p = {
    corpsY: souffle, inclinaison: 0,
    jambeAvant: 0.28, jambeArriere: -0.22,
    brasArme: -0.9, coudeArme: -0.6,   // arme levée devant
    angleArme: -1.2,
    mainBouclier: [22, -66],
  };
  if (pose === 'marche') {
    const s = Math.sin(av * Math.PI * 2);
    p.jambeAvant = 0.45 * s; p.jambeArriere = -0.45 * s;
    p.corpsY = -Math.abs(s) * 3;
  } else if (pose === 'attaque') {
    // Armer (0 → 0,35) puis frapper (0,35 → 1)
    const armer = Math.min(1, av / 0.35);
    const frappe = av < 0.35 ? 0 : Math.min(1, (av - 0.35) / 0.3);
    p.brasArme = -0.9 - armer * 1.6 + frappe * 2.6;
    p.coudeArme = -0.6 + frappe * 0.5;
    p.angleArme = p.brasArme + p.coudeArme - 0.2;
    p.inclinaison = -0.08 * armer + 0.2 * frappe;
    p.jambeAvant = 0.28 + 0.2 * frappe;
  } else if (pose === 'protege') {
    p.mainBouclier = [28, -82];
    p.inclinaison = -0.06;
    p.brasArme = -0.3; p.coudeArme = -1.4; p.angleArme = -1.8;
  } else if (pose === 'victoire') {
    p.brasArme = -2.2 + Math.sin(temps * 6) * 0.1; p.coudeArme = -0.3; p.angleArme = -1.6;
  } else if (pose === 'course') {
    // Course : grandes enjambées, buste penché vers l'avant
    const s = Math.sin(av * Math.PI * 2);
    p.jambeAvant = 0.75 * s; p.jambeArriere = -0.75 * s;
    p.corpsY = -Math.abs(s) * 5;
    p.inclinaison = 0.14;
    p.brasArme = -0.6 - s * 0.35;
  } else if (pose === 'saut') {
    // Genoux repliés, arme levée
    p.jambeAvant = 1.05; p.jambeArriere = 0.35;
    p.brasArme = -1.7; p.coudeArme = -0.4; p.angleArme = -1.9;
    p.mainBouclier = [24, -76];
    p.corpsY = 0;
  } else if (pose === 'chute') {
    p.jambeAvant = 0.5; p.jambeArriere = -0.45;
    p.brasArme = -1.25; p.coudeArme = -0.2; p.angleArme = -1.1;
    p.corpsY = 0;
  } else if (pose === 'esquive') {
    // Plongeon vers l'avant, jambes tendues
    p.inclinaison = 0.5;
    p.jambeAvant = 0.85; p.jambeArriere = -0.95;
    p.brasArme = -0.2; p.coudeArme = -0.2; p.angleArme = -0.3;
    p.corpsY = 10;
  } else if (pose === 'touche') {
    // Coup reçu : buste rejeté en arrière
    p.inclinaison = -0.32;
    p.brasArme = 0.25; p.coudeArme = -0.3; p.angleArme = 0.4;
    p.jambeAvant = 0.45; p.jambeArriere = -0.1;
  } else if (pose === 'etourdi') {
    // Sonné : il titube
    p.inclinaison = Math.sin(temps * 7) * 0.16 - 0.08;
    p.brasArme = 0.35; p.coudeArme = 0.1; p.angleArme = 0.9;
    p.mainBouclier = [16, -56];
  }
  return p;
}

// ----------------------------------------------------------------------------
//  Fonction principale
// ----------------------------------------------------------------------------
export function dessinerGladiateur(ctx, {
  x = 0, y = 0, echelle = 1, direction = 1,
  skin, equipement = {}, pose = 'repos', avancement = 0, temps = 0,
} = {}) {
  const peau = couleurSkin('peau', skin.peau);
  const tunique = couleurSkin('tunique', skin.tunique);
  const p = calculerPose(pose, avancement, temps);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(echelle * direction, echelle);

  // Ombre au sol
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 0, 30, 6, 0, 0, Math.PI * 2); ctx.fill();

  if (pose === 'ko') {
    ctx.translate(-10, -14);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(0, 40);
  }

  ctx.translate(0, p.corpsY);
  ctx.rotate(p.inclinaison);

  // Cape qui flotte derrière
  const flotte = Math.sin(temps * 3) * 4;
  forme(ctx, nuance(tunique, -0.18), () => {
    ctx.moveTo(-8, -90);
    ctx.quadraticCurveTo(-34 + flotte, -60, -36 + flotte * 1.5, -26);
    ctx.lineTo(-22 + flotte, -30);
    ctx.lineTo(-14 + flotte * 0.5, -24);
    ctx.quadraticCurveTo(-14, -60, 4, -88);
    ctx.closePath();
  });

  // Jambe arrière, bras armé (derrière le corps)
  dessinerJambe(ctx, [-6, -46], p.jambeArriere, nuance(peau, -0.08), equipement.jambieres);

  const epauleArme = [-8, -84];
  const coude = polaire(epauleArme[0], epauleArme[1], p.brasArme + Math.PI / 2, 18);
  const main = polaire(coude[0], coude[1], p.brasArme + p.coudeArme + Math.PI / 2, 17);
  membre(ctx, [epauleArme, coude, main], nuance(peau, -0.08), 10);
  ctx.save();
  ctx.translate(main[0], main[1]);
  ctx.rotate(p.angleArme);
  dessinerArme(ctx, equipement.arme?.id);
  ctx.restore();
  cercle(ctx, main[0], main[1], 6, nuance(peau, -0.08), 2.5);

  // Jambe avant, torse, tête
  dessinerJambe(ctx, [6, -46], p.jambeAvant, peau, equipement.jambieres);
  dessinerTorse(ctx, skin, equipement.plastron);
  dessinerTete(ctx, skin, equipement.casque);

  // Bras avant + bouclier
  const epaule = [8, -84];
  const mb = p.mainBouclier;
  const coudeAvant = [(epaule[0] + mb[0]) / 2 - 2, (epaule[1] + mb[1]) / 2 + 6];
  membre(ctx, [epaule, coudeAvant, mb], peau, 10);
  if (!dessinerBouclier(ctx, mb[0] + 4, mb[1], equipement.bouclier)) cercle(ctx, mb[0], mb[1], 6, peau, 2.5);

  ctx.restore();
}
