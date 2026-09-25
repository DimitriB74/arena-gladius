// ============================================================================
//  ARENA GLADIUS — client/js/rendu/decor.js
//
//  Décors des 5 arènes, dessinés procéduralement (vue de côté).
//  dessinerDecor(ctx, idArene, largeur, hauteur, temps)
//  Le sol commence à hauteurSol(hauteur) : les combattants s'y tiennent.
// ============================================================================

const ENCRE = '#2b1a0e';

export const hauteurSol = (h) => Math.round(h * 0.8);

// Générateur pseudo-aléatoire stable (même décor à chaque image)
function graine(n) {
  let s = n;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function ciel(ctx, w, h, haut, bas) {
  const g = ctx.createLinearGradient(0, 0, 0, hauteurSol(h));
  g.addColorStop(0, haut);
  g.addColorStop(1, bas);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function sol(ctx, w, h, couleur, bord, grains) {
  const y = hauteurSol(h);
  ctx.fillStyle = couleur;
  ctx.fillRect(0, y, w, h - y);
  ctx.fillStyle = bord;
  ctx.fillRect(0, y, w, Math.max(4, h * 0.012));
  ctx.fillStyle = ENCRE;
  ctx.fillRect(0, y - 2, w, 3);
  const r = graine(7);
  ctx.fillStyle = grains;
  for (let i = 0; i < w / 6; i++) {
    ctx.beginPath();
    ctx.ellipse(r() * w, y + 10 + r() * (h - y - 12), 1 + r() * 3, 1 + r() * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function soleil(ctx, x, y, r, couleur, halo) {
  const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 3);
  g.addColorStop(0, halo);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = couleur;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// ----------------------------------------------------------------------------
//  Colisée : gradins en arcades, foule, velum
// ----------------------------------------------------------------------------
function colisee(ctx, w, h, t) {
  ciel(ctx, w, h, '#6fb7e8', '#f6dca0');
  soleil(ctx, w * 0.82, h * 0.13, h * 0.05, '#fff4c9', 'rgba(255,240,180,0.55)');
  const ys = hauteurSol(h);

  // Mur de l'amphithéâtre : 3 étages d'arcades
  const etages = [
    { y: h * 0.18, hauteur: h * 0.17, couleur: '#d9b47a' },
    { y: h * 0.35, hauteur: h * 0.2, couleur: '#cfa56a' },
    { y: h * 0.55, hauteur: ys - h * 0.55, couleur: '#c2955b' },
  ];
  const r = graine(3);
  etages.forEach((e, i) => {
    ctx.fillStyle = e.couleur;
    ctx.fillRect(0, e.y, w, e.hauteur);
    ctx.fillStyle = ENCRE;
    ctx.fillRect(0, e.y - 2, w, 4);
    const largeurArche = Math.max(46, h * 0.1);
    const n = Math.ceil(w / largeurArche) + 1;
    for (let k = 0; k < n; k++) {
      const x = k * largeurArche + (i % 2) * largeurArche * 0.5 - largeurArche * 0.5;
      const lw = largeurArche * 0.58, lh = e.hauteur * 0.72;
      const ax = x + (largeurArche - lw) / 2, ay = e.y + e.hauteur - lh;
      // Arche sombre + spectateurs dedans
      ctx.fillStyle = '#5b3b22';
      ctx.beginPath();
      ctx.moveTo(ax, e.y + e.hauteur);
      ctx.lineTo(ax, ay + lw / 2);
      ctx.arc(ax + lw / 2, ay + lw / 2, lw / 2, Math.PI, 0);
      ctx.lineTo(ax + lw, e.y + e.hauteur);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ENCRE; ctx.lineWidth = 2.5; ctx.stroke();
      if (i < 2) {
        // Petites têtes qui s'agitent
        for (let s = 0; s < 3; s++) {
          const sx = ax + lw * (0.22 + s * 0.28);
          const sy = e.y + e.hauteur - 6 - Math.abs(Math.sin(t * 5 + k * 1.7 + s * 2.1 + i)) * 4;
          ctx.fillStyle = ['#e8b48c', '#b07a4c', '#7b4c2c', '#f0c9a2'][Math.floor(r() * 4)];
          ctx.beginPath(); ctx.arc(sx, sy, Math.max(3, lw * 0.11), 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  });

  // Velum (toiles tendues en haut)
  const couleursVelum = ['#b8323f', '#f0e2c0'];
  const nv = Math.ceil(w / 90);
  for (let k = 0; k < nv; k++) {
    const x0 = k * 90, onde = Math.sin(t * 1.5 + k) * 3;
    ctx.fillStyle = couleursVelum[k % 2];
    ctx.beginPath();
    ctx.moveTo(x0, 0); ctx.lineTo(x0 + 90, 0);
    ctx.quadraticCurveTo(x0 + 45, h * 0.1 + onde, x0, h * 0.06);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ENCRE; ctx.lineWidth = 2; ctx.stroke();
  }

  // Muret de l'arène avec bannières
  ctx.fillStyle = '#8f5a2d';
  ctx.fillRect(0, ys - h * 0.05, w, h * 0.05);
  ctx.fillStyle = ENCRE;
  ctx.fillRect(0, ys - h * 0.05 - 2, w, 3);
  for (let x = 40; x < w; x += 220) {
    ctx.fillStyle = '#8e1f2c';
    ctx.beginPath();
    ctx.moveTo(x, h * 0.35); ctx.lineTo(x + 34, h * 0.35); ctx.lineTo(x + 34, h * 0.5);
    ctx.lineTo(x + 17, h * 0.46); ctx.lineTo(x, h * 0.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ENCRE; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#f2b632';
    ctx.beginPath(); ctx.arc(x + 17, h * 0.405, 6, 0, Math.PI * 2); ctx.fill();
  }

  sol(ctx, w, h, '#e9c27a', '#f6d99a', 'rgba(150,100,40,0.35)');
}

// ----------------------------------------------------------------------------
//  Désert : dunes, falaises, palmiers, chaleur
// ----------------------------------------------------------------------------
function desert(ctx, w, h, t) {
  ciel(ctx, w, h, '#f4a64a', '#fde5a6');
  soleil(ctx, w * 0.25, h * 0.2, h * 0.07, '#fff3b0', 'rgba(255,220,120,0.6)');
  const ys = hauteurSol(h);
  // Mesas lointaines
  ctx.fillStyle = '#c9734a';
  ctx.beginPath(); ctx.moveTo(0, ys);
  ctx.lineTo(0, h * 0.5); ctx.lineTo(w * 0.12, h * 0.5); ctx.lineTo(w * 0.16, h * 0.58);
  ctx.lineTo(w * 0.55, h * 0.58); ctx.lineTo(w * 0.6, h * 0.44); ctx.lineTo(w * 0.78, h * 0.44);
  ctx.lineTo(w * 0.84, h * 0.6); ctx.lineTo(w, h * 0.6); ctx.lineTo(w, ys); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 3; ctx.stroke();
  // Dunes
  for (const [couleur, base, amp, ph] of [['#e9a95b', 0.66, 0.05, 0], ['#f2bf72', 0.72, 0.04, 2]]) {
    ctx.fillStyle = couleur;
    ctx.beginPath(); ctx.moveTo(0, ys);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * base + Math.sin(x / (w * 0.15) + ph) * h * amp);
    ctx.lineTo(w, ys); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ENCRE; ctx.lineWidth = 2.5; ctx.stroke();
  }
  // Palmiers
  for (const px of [w * 0.08, w * 0.9]) {
    ctx.strokeStyle = ENCRE; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, ys); ctx.quadraticCurveTo(px + 10, h * 0.55, px - 5, h * 0.4); ctx.stroke();
    ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 7; ctx.stroke();
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI + f * (Math.PI / 4) + Math.sin(t * 1.3 + f) * 0.05;
      ctx.fillStyle = '#4f7d2a';
      ctx.beginPath();
      ctx.moveTo(px - 5, h * 0.4);
      ctx.quadraticCurveTo(px - 5 + Math.cos(a - 0.3) * 40, h * 0.4 + Math.sin(a - 0.3) * 40, px - 5 + Math.cos(a) * 60, h * 0.4 + Math.sin(a) * 40 + 16);
      ctx.quadraticCurveTo(px - 5 + Math.cos(a + 0.3) * 30, h * 0.4 + Math.sin(a + 0.3) * 20, px - 5, h * 0.4);
      ctx.fill(); ctx.strokeStyle = ENCRE; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  sol(ctx, w, h, '#f0b867', '#fbd28a', 'rgba(170,100,30,0.35)');
}

// ----------------------------------------------------------------------------
//  Forêt : clairière, arbres, rayons de lumière
// ----------------------------------------------------------------------------
function foret(ctx, w, h, t) {
  ciel(ctx, w, h, '#9fd3c7', '#e7f0c3');
  const ys = hauteurSol(h);
  const r = graine(11);
  for (const [couleur, taille, base] of [['#5f8a46', 0.9, 0.62], ['#3f6b31', 1.2, 0.7]]) {
    for (let i = 0; i < w / (80 * taille); i++) {
      const x = i * 80 * taille + r() * 40;
      const hh = h * (0.25 + r() * 0.2) * taille;
      ctx.fillStyle = '#5b3b22';
      ctx.fillRect(x - 5 * taille, h * base - hh * 0.3, 10 * taille, ys - (h * base - hh * 0.3));
      ctx.fillStyle = couleur;
      ctx.beginPath(); ctx.arc(x, h * base - hh * 0.5, hh * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ENCRE; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }
  // Rayons de lumière
  ctx.save();
  ctx.globalAlpha = 0.18 + Math.sin(t * 0.8) * 0.05;
  ctx.fillStyle = '#fff8c8';
  for (let i = 0; i < 4; i++) {
    const x = w * (0.15 + i * 0.22);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 140, ys); ctx.lineTo(x + 60, ys); ctx.fill();
  }
  ctx.restore();
  // Colonnes de pierre moussues (sanctuaire)
  for (const cx of [w * 0.04, w * 0.96]) {
    ctx.fillStyle = '#b8b2a0';
    ctx.fillRect(cx - 18, h * 0.3, 36, ys - h * 0.3);
    ctx.strokeStyle = ENCRE; ctx.lineWidth = 3; ctx.strokeRect(cx - 18, h * 0.3, 36, ys - h * 0.3);
    ctx.fillStyle = '#6f9a40'; ctx.fillRect(cx - 20, h * 0.3, 40, 10);
  }
  sol(ctx, w, h, '#7a9b45', '#96b85a', 'rgba(40,70,20,0.35)');
}

// ----------------------------------------------------------------------------
//  Volcan : ciel rougeoyant, cratère, lave, braises
// ----------------------------------------------------------------------------
function volcan(ctx, w, h, t) {
  ciel(ctx, w, h, '#2a1418', '#b3432a');
  const ys = hauteurSol(h);
  // Volcan au loin
  ctx.fillStyle = '#3a2420';
  ctx.beginPath(); ctx.moveTo(w * 0.2, ys); ctx.lineTo(w * 0.44, h * 0.25); ctx.lineTo(w * 0.56, h * 0.25);
  ctx.lineTo(w * 0.85, ys); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = ENCRE; ctx.lineWidth = 3; ctx.stroke();
  // Coulée de lave
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath(); ctx.moveTo(w * 0.47, h * 0.25); ctx.quadraticCurveTo(w * 0.44, h * 0.45, w * 0.5, ys * 0.95);
  ctx.lineTo(w * 0.53, ys * 0.95); ctx.quadraticCurveTo(w * 0.5, h * 0.45, w * 0.53, h * 0.25); ctx.fill();
  // Fumée
  for (let i = 0; i < 5; i++) {
    const p = (t * 0.15 + i / 5) % 1;
    ctx.fillStyle = `rgba(60,40,40,${0.5 * (1 - p)})`;
    ctx.beginPath(); ctx.arc(w * 0.5 + Math.sin(p * 6 + i) * 20, h * 0.25 - p * h * 0.22, 14 + p * 30, 0, Math.PI * 2); ctx.fill();
  }
  // Roches
  ctx.fillStyle = '#4a2c24';
  for (const [x, lw, hh] of [[0, w * 0.18, 0.5], [w * 0.84, w * 0.16, 0.45]]) {
    ctx.beginPath(); ctx.moveTo(x, ys); ctx.lineTo(x + lw * 0.2, h * hh); ctx.lineTo(x + lw * 0.7, h * (hh + 0.06)); ctx.lineTo(x + lw, ys); ctx.fill();
    ctx.stroke();
  }
  // Braises qui montent
  for (let i = 0; i < 24; i++) {
    const p = (t * 0.2 + i * 0.137) % 1;
    ctx.fillStyle = `rgba(255,${150 + (i % 3) * 30},60,${1 - p})`;
    ctx.beginPath(); ctx.arc((i * 97) % w + Math.sin(t + i) * 10, ys - p * ys, 2, 0, Math.PI * 2); ctx.fill();
  }
  sol(ctx, w, h, '#4b2d25', '#ff7a1a', 'rgba(255,120,40,0.4)');
}

// ----------------------------------------------------------------------------
//  Neige : montagnes, sapins, flocons
// ----------------------------------------------------------------------------
function neige(ctx, w, h, t) {
  ciel(ctx, w, h, '#7d9cc4', '#e3edf7');
  const ys = hauteurSol(h);
  for (const [couleur, base, pics] of [['#9fb3cc', 0.62, 5], ['#c3d2e4', 0.7, 7]]) {
    ctx.fillStyle = couleur;
    ctx.beginPath(); ctx.moveTo(0, ys);
    for (let i = 0; i <= pics; i++) {
      const x = (i / pics) * w;
      ctx.lineTo(x - w / pics / 2, h * (base - 0.25 + ((i * 37) % 10) / 60));
      ctx.lineTo(x, h * base);
    }
    ctx.lineTo(w, ys); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ENCRE; ctx.lineWidth = 2.5; ctx.stroke();
  }
  // Sapins
  for (const x of [w * 0.06, w * 0.14, w * 0.88, w * 0.95]) {
    for (let e = 0; e < 3; e++) {
      ctx.fillStyle = '#2f5a3f';
      ctx.beginPath();
      ctx.moveTo(x, ys - 110 + e * 25); ctx.lineTo(x - 30 + e * 3, ys - 60 + e * 25); ctx.lineTo(x + 30 - e * 3, ys - 60 + e * 25); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = ENCRE; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }
  sol(ctx, w, h, '#f4f8fc', '#ffffff', 'rgba(140,170,210,0.4)');
  // Flocons
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 60; i++) {
    const y = ((t * (20 + (i % 5) * 8) + i * 53) % (h + 20)) - 10;
    const x = (i * 73 + Math.sin(t + i) * 15) % w;
    ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
}

const DECORS = { colisee, desert, foret, volcan, neige };

export function dessinerDecor(ctx, idArene, largeur, hauteur, temps = 0) {
  (DECORS[idArene] || colisee)(ctx, largeur, hauteur, temps);
}
