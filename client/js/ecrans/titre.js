// ============================================================================
//  ARENA GLADIUS — écran titre
//  Fond : le Grand Colisée et deux gladiateurs qui échangent des coups.
// ============================================================================

import { niveauPersonnage } from '/shared/formulas.js';
import { $, echapper, notifier } from '../ui.js';
import { allerA } from '../navigation.js';
import { lireSauvegarde, importerCode } from '../sauvegarde.js';
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

// ----------------------------------------------------------------------------
//  Import d'une sauvegarde directement depuis l'accueil
// ----------------------------------------------------------------------------
let persoImporte = null;

function portraitImport(canvas, perso) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = 56 * dpr;
  canvas.height = 56 * dpr;
  const p = canvas.getContext('2d');
  p.setTransform(dpr, 0, 0, dpr, 0, 0);
  dessinerGladiateur(p, {
    x: 24, y: 160, echelle: 1.22, direction: 1, skin: perso.skin,
    equipement: { casque: perso.equipement.casque }, pose: 'repos', temps: 0,
  });
}

/** Vérifie le code à chaque frappe et montre le gladiateur trouvé */
function verifierCode() {
  const texte = $('#import-code').value.trim();
  const apercu = $('#import-apercu');
  const erreur = $('#import-erreur');
  persoImporte = null;
  apercu.hidden = true;
  erreur.textContent = '';
  if (texte) {
    const r = importerCode(texte);
    if (r.ok) {
      persoImporte = r.perso;
      const s = r.perso.stats;
      apercu.innerHTML = `<canvas></canvas><div><b>${echapper(r.perso.nom)}</b>
        <small>Niveau ${niveauPersonnage(r.perso.pointsGagnes)} · ${r.perso.credits} crédits ·
        ${s.victoires + s.victoiresIA} victoire${s.victoires + s.victoiresIA > 1 ? 's' : ''}</small></div>`;
      portraitImport(apercu.querySelector('canvas'), r.perso);
      apercu.hidden = false;
    } else {
      erreur.textContent = r.erreur;
    }
  }
  $('#import-valider').disabled = !persoImporte;
}

function ouvrirImport() {
  $('#import-code').value = '';
  verifierCode();
  $('#modal-import').hidden = false;
  setTimeout(() => $('#import-code').focus(), 50);
}

const fermerImport = () => { $('#modal-import').hidden = true; };

function validerImport() {
  if (!persoImporte) return;
  const actuel = lireSauvegarde();
  if (actuel) {
    const message = actuel.nom === persoImporte.nom
      ? `Remplacer ta sauvegarde actuelle de « ${actuel.nom} » par celle que tu importes ?\n(Si le code est plus ancien, tu perdras les progrès faits depuis.)`
      : `Ton gladiateur actuel, « ${actuel.nom} », sera remplacé par « ${persoImporte.nom} ».\n(Pense à exporter ${actuel.nom} avant si tu veux le garder.)`;
    if (!confirm(`${message}\n\nContinuer ?`)) return;
  }
  definirPerso(persoImporte);
  fermerImport();
  allerA('village');
  notifier(`${persoImporte.nom} est de retour dans l’arène !`, 'succes');
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
    $('#btn-importer').addEventListener('click', ouvrirImport);
    $('#import-code').addEventListener('input', verifierCode);
    $('#import-annuler').addEventListener('click', fermerImport);
    $('#import-valider').addEventListener('click', validerImport);
    $('#modal-import').addEventListener('click', (e) => { if (e.target.id === 'modal-import') fermerImport(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal-import').hidden) fermerImport(); });
    $('#btn-continuer').addEventListener('click', () => {
      const perso = lireSauvegarde();
      if (!perso) return;
      definirPerso(perso, { sauver: false });
      allerA('village');
    });
  },

  entrer() {
    // S'il y a une sauvegarde, « Continuer » passe en premier ; sinon les deux
    // choix de départ (nouveau / importer) sont mis en avant, au même niveau
    const perso = lireSauvegarde();
    const btn = $('#btn-continuer');
    btn.hidden = !perso;
    btn.textContent = perso ? `▶ Continuer avec ${perso.nom}` : '';
    for (const id of ['#btn-nouvelle', '#btn-importer']) $(id).classList.toggle('btn-or', !perso);
  },

  sortir() {
    fermerImport();
  },

  dessiner(ctx, w, h, t) {
    dessinerFondColisee(ctx, w, h, t);
  },
};
