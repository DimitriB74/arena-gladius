// ============================================================================
//  ARENA GLADIUS — client/js/main.js
//
//  Point d'entrée du navigateur :
//  - un canvas plein écran (#scene) sur lequel l'écran courant dessine son fond
//  - les écrans HTML (menus, panneaux) par-dessus
//  - la souris sur le canvas est transmise à l'écran courant (village cliquable)
//  - connexion Socket.IO (reseau.js) : lobby, défis, combats
// ============================================================================

import { $ } from './ui.js';
import { enregistrerEcran, allerA, ecranCourant, surNavigation } from './navigation.js';
import { jouerTheme } from './musique.js';
import { initialiserReglagesSon } from './reglagesSon.js';
import { initialiserHud } from './hud.js';
import { lireSauvegarde, nomProfil } from './sauvegarde.js';
import { definirPerso, surChangement } from './etat.js';
import { ecranTitre } from './ecrans/titre.js';
import { ecranCodex } from './ecrans/codex.js';
import { ecranCreation } from './ecrans/creation.js';
import { ecranVillage } from './ecrans/village.js';
import { ecranBoutique } from './ecrans/boutique.js';
import { ecranArene } from './ecrans/arene.js';
import { ecranParametres } from './ecrans/parametres.js';
import { ecranCombat, sessionCourante } from './ecrans/combat.js';
import { etatReseau, surReseau, reseauDisponible } from './reseau.js';
import { initialiserDefis } from './defis.js';

// ----------------------------------------------------------------------------
//  Canvas plein écran
// ----------------------------------------------------------------------------
const scene = $('#scene');
const ctx = scene.getContext('2d');
let largeur = 0, hauteur = 0, dpr = 1;

function redimensionner() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  largeur = innerWidth;
  hauteur = innerHeight;
  scene.width = Math.round(largeur * dpr);
  scene.height = Math.round(hauteur * dpr);
}
addEventListener('resize', redimensionner);
redimensionner();

const debut = performance.now();
function boucle(maintenant) {
  const t = (maintenant - debut) / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ecran = ecranCourant();
  if (ecran?.dessiner) ecran.dessiner(ctx, largeur, hauteur, t);
  requestAnimationFrame(boucle);
}

// Souris / toucher sur le canvas
scene.addEventListener('pointermove', (e) => ecranCourant()?.survol?.(e.clientX, e.clientY));
scene.addEventListener('pointerleave', () => ecranCourant()?.survol?.(-1, -1));
scene.addEventListener('click', (e) => ecranCourant()?.clic?.(e.clientX, e.clientY));

// ----------------------------------------------------------------------------
//  Écrans
// ----------------------------------------------------------------------------
const ECRANS = [ecranTitre, ecranCodex, ecranCreation, ecranVillage, ecranBoutique, ecranArene, ecranParametres, ecranCombat];
for (const e of ECRANS) {
  enregistrerEcran(e);
  e.initialiser?.();
}
initialiserHud();
initialiserDefis();

// ----------------------------------------------------------------------------
//  Musique : chaque écran a son thème (voir musique.js)
// ----------------------------------------------------------------------------
surNavigation((ecran) => jouerTheme(typeof ecran.musique === 'function' ? ecran.musique() : ecran.musique));
initialiserReglagesSon();

// ----------------------------------------------------------------------------
//  État de la connexion (écran titre)
// ----------------------------------------------------------------------------
function majStatut() {
  const statut = $('#statut-serveur');
  if (!reseauDisponible()) {
    statut.className = 'statut-serveur ko';
    statut.textContent = 'Socket.IO introuvable (lance le jeu avec npm start)';
  } else if (!etatReseau.connecte) {
    statut.className = 'statut-serveur ko';
    statut.textContent = 'Connexion au serveur…';
  } else {
    const n = etatReseau.connectes;
    statut.className = 'statut-serveur ok';
    statut.textContent = `Connecté au serveur — ${n} navigateur${n > 1 ? 's' : ''} en ligne`;
  }
}
surReseau('reseau:changement', majStatut);
majStatut();

// ----------------------------------------------------------------------------
//  Démarrage (on attend les polices pour que les textes du canvas soient beaux)
// ----------------------------------------------------------------------------
// Après un rechargement de la page (F5) pendant une partie, on reprend directement
// au village : si un combat était en cours, le serveur nous y renvoie aussitôt.
const CLE_EN_JEU = `arena-gladius:en-jeu${nomProfil() ? `:${nomProfil()}` : ''}`;
surChangement((perso) => {
  try {
    if (perso) sessionStorage.setItem(CLE_EN_JEU, '1'); else sessionStorage.removeItem(CLE_EN_JEU);
  } catch { /* rien */ }
});
if (nomProfil()) $('#titre-profil').textContent = `Profil de test : « ${nomProfil()} »`;

Promise.race([
  Promise.all(['800 20px Cinzel', '700 20px "Alegreya Sans"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 1500)),
]).finally(() => {
  let enJeu = false;
  try { enJeu = sessionStorage.getItem(CLE_EN_JEU) === '1'; } catch { /* rien */ }
  const sauvegarde = enJeu ? lireSauvegarde() : null;
  if (sauvegarde) {
    definirPerso(sauvegarde, { sauver: false });
    allerA('village', {}, { fondu: false });
  } else {
    allerA('titre', {}, { fondu: false });
  }
  requestAnimationFrame(boucle);
});

// Pour déboguer depuis la console du navigateur
window.arena = { allerA, lireSauvegarde, session: sessionCourante };
