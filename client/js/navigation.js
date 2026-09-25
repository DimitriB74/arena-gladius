// ============================================================================
//  ARENA GLADIUS — client/js/navigation.js
//
//  Gestion des écrans. Chaque écran est un objet :
//  {
//    nom, section (id HTML), hud (bool), maison (bool : bouton Village actif),
//    entrer(params), sortir(),
//    dessiner(ctx, w, h, t)     → dessine le fond (canvas plein écran)
//    survol(x, y), clic(x, y)   → souris sur le canvas (facultatif)
//  }
// ============================================================================

const ecrans = {};
let courant = null;
let enTransition = false;
const abonnes = new Set();

export function enregistrerEcran(ecran) {
  ecrans[ecran.nom] = ecran;
}

export const ecranCourant = () => courant;

export function surNavigation(f) {
  abonnes.add(f);
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Change d'écran avec un fondu au noir */
export async function allerA(nom, params = {}, { fondu = true } = {}) {
  const suivant = ecrans[nom];
  if (!suivant || enTransition) return;
  enTransition = true;
  const voile = document.getElementById('voile');
  if (fondu && courant) {
    voile.classList.add('actif');
    await attendre(220);
  }
  courant?.sortir?.();
  document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('actif', e.id === suivant.section));
  courant = suivant;
  suivant.entrer?.(params);
  abonnes.forEach((f) => f(suivant));
  voile.classList.remove('actif');
  enTransition = false;
}
