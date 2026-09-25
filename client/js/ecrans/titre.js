// ============================================================================
//  ARENA GLADIUS — écran titre
//  Fond : le Grand Colisée et deux gladiateurs qui échangent des coups.
// ============================================================================

import { $ } from '../ui.js';
import { allerA } from '../navigation.js';
import { lireSauvegarde } from '../sauvegarde.js';
import { definirPerso } from '../etat.js';
import { dessinerGladiateur } from '../rendu/gladiateur.js';
import { dessinerDecor, hauteurSol } from '../rendu/decor.js';

const DUELLISTES = [
  {
    skin: { peau: 'p3', coiffure: 'barbe', cheveux: 'c2', tunique: 't1' },
    equipement: { arme: { id: 'glaive' }, casque: { id: 'casque_bronze' }, plastron: { id: 'plastron_bronze' },
      jambieres: { id: 'jambieres_cuir' }, bouclier: { id: 'bouclier_bronze' } },
  },
  {
    skin: { peau: 'p5', coiffure: 'crete', cheveux: 'c1', tunique: 't2' },
    equipement: { arme: { id: 'trident' }, casque: null, plastron: { id: 'plastron_cuir' },
      jambieres: { id: 'jambieres_fer' }, bouclier: null },
  },
];

/** Fond partagé par l'écran titre, le Codex et la création */
export function dessinerFondColisee(ctx, w, h, t, { duellistes = true, assombrir = 0.45 } = {}) {
  dessinerDecor(ctx, 'colisee', w, h, t);
  if (duellistes) {
    const ys = hauteurSol(h);
    const echelle = Math.max(0.8, Math.min(1.8, h / 480));
    const ecart = Math.min(w * 0.22, 190 * echelle);
    const cycle = t % 6;
    DUELLISTES.forEach((g, i) => {
      const attaque = i === 0 ? cycle < 1 : cycle >= 3 && cycle < 4;
      const protege = i === 0 ? cycle >= 3 && cycle < 4 : cycle < 1;
      dessinerGladiateur(ctx, {
        x: w / 2 + (i === 0 ? -ecart : ecart), y: ys + 6, echelle, direction: i === 0 ? 1 : -1,
        skin: g.skin, equipement: g.equipement,
        pose: attaque ? 'attaque' : protege ? 'protege' : 'repos',
        avancement: attaque ? cycle % 3 : 0, temps: t + i * 0.7,
      });
    });
  }
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  g.addColorStop(0, `rgba(30,15,5,${assombrir})`);
  g.addColorStop(1, 'rgba(30,15,5,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * 0.6);
}

export const ecranTitre = {
  nom: 'titre',
  section: 'ecran-titre',
  hud: false,
  musique: 'titre',

  initialiser() {
    $('#btn-nouvelle').addEventListener('click', () => {
      if (lireSauvegarde() && !confirm('Un gladiateur existe déjà. Le remplacer par un nouveau ?\n(Pense à exporter ta sauvegarde avant !)')) return;
      allerA('creation');
    });
    $('#btn-continuer').addEventListener('click', () => {
      const perso = lireSauvegarde();
      if (!perso) return;
      definirPerso(perso, { sauver: false });
      allerA('village');
    });
  },

  entrer() {
    const perso = lireSauvegarde();
    const btn = $('#btn-continuer');
    btn.disabled = !perso;
    btn.textContent = perso ? `Continuer avec ${perso.nom}` : 'Continuer';
  },

  dessiner(ctx, w, h, t) {
    dessinerFondColisee(ctx, w, h, t);
  },
};
