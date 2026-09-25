// ============================================================================
//  ARENA GLADIUS — le village (écran principal)
//  Clic sur la forge → Forgeron, sur l'armurerie → Armurier,
//  sur le Colisée → arène tirée au sort.
// ============================================================================

import { niveauPersonnage } from '/shared/formulas.js';
import { $ } from '../ui.js';
import { brancherListe } from '../defis.js';
import { allerA } from '../navigation.js';
import { lirePerso } from '../etat.js';
import { dessinerVillage, calculerVue, zoneSous } from '../rendu/village.js';

let vue = null;
let survolId = null;

function entrerDans(id) {
  if (id === 'colisee') allerA('arene');
  else if (id === 'forgeron' || id === 'armurier') allerA('boutique', { type: id });
}

export const ecranVillage = {
  nom: 'village',
  section: 'ecran-village',
  hud: true,
  maison: false,
  musique: 'village',

  initialiser() {
    $('#village-aide').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-lieu]');
      if (b) entrerDans(b.dataset.lieu);
    });
    // Panneau des joueurs en ligne : repliable
    $('#village-lobby-titre').addEventListener('click', () => $('#village-lobby').classList.toggle('replie'));
  },

  entrer() {
    survolId = null;
    brancherListe($('#village-joueurs'));
  },

  sortir() {
    document.body.style.cursor = '';
  },

  dessiner(ctx, w, h, t) {
    vue = calculerVue(w, h);
    const perso = lirePerso();
    dessinerVillage(ctx, vue, t, { perso, niveau: niveauPersonnage(perso?.pointsGagnes), survolId });
  },

  survol(x, y) {
    if (!vue) return;
    survolId = zoneSous(vue, x, y)?.id || null;
    document.body.style.cursor = survolId ? 'pointer' : '';
  },

  clic(x, y) {
    if (!vue) return;
    const zone = zoneSous(vue, x, y);
    if (zone) entrerDans(zone.id);
  },
};
