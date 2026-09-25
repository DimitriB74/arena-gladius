// ============================================================================
//  ARENA GLADIUS — client/js/hud.js
//
//  Barre du haut : bouton Village (maison), portrait + nom + niveau,
//  crédits, bouton Paramètres (avec le nombre de points à répartir).
// ============================================================================

import { niveauPersonnage } from '/shared/formulas.js';
import { $ } from './ui.js';
import { lirePerso, surChangement } from './etat.js';
import { allerA, ecranCourant, surNavigation } from './navigation.js';
import { dessinerGladiateur } from './rendu/gladiateur.js';


const hud = $('#hud');
const portrait = $('#hud-portrait');

function dessinerPortrait(perso) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const taille = 52;
  portrait.width = taille * dpr;
  portrait.height = taille * dpr;
  const ctx = portrait.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, taille, taille);
  // On cadre la tête du gladiateur
  dessinerGladiateur(ctx, {
    x: 22, y: 150, echelle: 1.15, direction: 1, skin: perso.skin,
    equipement: { casque: perso.equipement.casque }, pose: 'repos', temps: 0,
  });
}

let creditsAffiches = null;

function animerCredits(avant, apres) {
  const el = $('#hud-credits');
  const diff = apres - avant;
  const bulle = document.createElement('span');
  bulle.className = `credits-diff ${diff > 0 ? 'gain' : 'perte'}`;
  bulle.textContent = diff > 0 ? `+${diff}` : `${diff}`;
  el.parentElement.appendChild(bulle);
  setTimeout(() => bulle.remove(), 1200);
}

export function mettreAJourHud() {
  const perso = lirePerso();
  const ecran = ecranCourant();
  const visible = !!(perso && ecran?.hud);
  hud.hidden = !visible;
  if (!visible) return;

  $('#hud-nom').textContent = perso.nom;
  $('#hud-niveau').textContent = `Niveau ${niveauPersonnage(perso.pointsGagnes)}`;
  if (creditsAffiches !== null && creditsAffiches !== perso.credits) animerCredits(creditsAffiches, perso.credits);
  creditsAffiches = perso.credits;
  $('#hud-credits').textContent = perso.credits;

  const pastille = $('#hud-points');
  pastille.hidden = perso.pointsLibres <= 0;
  pastille.textContent = perso.pointsLibres;

  $('#hud-maison').disabled = !ecran.maison;
  $('#hud-parametres').classList.toggle('actif', ecran.nom === 'parametres');
  dessinerPortrait(perso);
}

export function initialiserHud() {
  $('#hud-maison').addEventListener('click', () => allerA('village'));
  $('#hud-parametres').addEventListener('click', () => {
    allerA(ecranCourant()?.nom === 'parametres' ? 'village' : 'parametres');
  });
  surChangement(mettreAJourHud);
  surNavigation(mettreAJourHud);
}
