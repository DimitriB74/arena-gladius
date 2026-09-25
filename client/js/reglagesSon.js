// ============================================================================
//  ARENA GLADIUS — client/js/reglagesSon.js
//  Petit panneau « Son » avec deux curseurs de volume (musique, bruitages).
//  Il s'ouvre depuis n'importe quel bouton qui a la classe .bouton-son
//  (barre du haut, écran titre, combat). Les réglages sont mémorisés.
// ============================================================================

import { $, $$ } from './ui.js';
import { volumeEffets, reglerVolumeEffets, jouerSon } from './audio.js';
import { volumeMusique, reglerVolumeMusique } from './musique.js';

const panneau = () => $('#panneau-son');

/** Icône des boutons selon les volumes */
function icone() {
  const total = volumeMusique() + volumeEffets();
  if (total <= 0) return '🔇';
  if (total < 0.6) return '🔈';
  return '🔊';
}

function majBoutons() {
  $$('.bouton-son').forEach((b) => {
    const texte = b.dataset.texte ? ` ${b.dataset.texte}` : '';
    b.textContent = `${icone()}${texte}`;
  });
}

function majCurseurs() {
  for (const [id, valeur] of [['volume-musique', volumeMusique()], ['volume-effets', volumeEffets()]]) {
    const pourcent = Math.round(valeur * 100);
    $(`#${id}`).value = pourcent;
    $(`#${id}`).style.setProperty('--rempli', `${pourcent}%`);
    $(`#${id}-valeur`).textContent = pourcent ? `${pourcent} %` : 'coupé';
  }
}

function ouvrir(bouton) {
  const p = panneau();
  majCurseurs();
  p.hidden = false;
  // Placé juste sous (ou au-dessus de) le bouton qui l'a ouvert
  const r = bouton.getBoundingClientRect();
  const largeur = p.offsetWidth;
  p.style.left = `${Math.max(8, Math.min(innerWidth - largeur - 8, r.left + r.width / 2 - largeur / 2))}px`;
  if (r.top > innerHeight / 2) {
    p.style.top = '';
    p.style.bottom = `${innerHeight - r.top + 8}px`;
  } else {
    p.style.bottom = '';
    p.style.top = `${r.bottom + 8}px`;
  }
}

const fermer = () => { panneau().hidden = true; };

export function initialiserReglagesSon() {
  document.addEventListener('click', (e) => {
    const bouton = e.target.closest('.bouton-son');
    if (bouton) {
      if (panneau().hidden) ouvrir(bouton); else fermer();
      return;
    }
    if (!e.target.closest('#panneau-son')) fermer();
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(); });
  addEventListener('resize', fermer);

  $('#volume-musique').addEventListener('input', (e) => {
    reglerVolumeMusique(Number(e.target.value) / 100);
    majCurseurs();
    majBoutons();
  });
  const effets = $('#volume-effets');
  effets.addEventListener('input', (e) => {
    reglerVolumeEffets(Number(e.target.value) / 100);
    majCurseurs();
    majBoutons();
  });
  // Petit son d'essai quand on lâche le curseur des bruitages
  effets.addEventListener('change', () => jouerSon('coup'));

  majBoutons();
}
