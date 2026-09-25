// ============================================================================
//  ARENA GLADIUS — création du gladiateur
//  Nom, apparence (aperçu en direct) et répartition des 10 points.
// ============================================================================

import { SKINS, CREATION, ORDRE_ATTRIBUTS } from '/shared/data.js';
import { statsCombattant, chanceCritique, degatsBase } from '/shared/formulas.js';
import { attributsDeBase, erreurNom, nouveauPersonnage } from '/shared/validation.js';
import { $, echapper, rendreAttributs, notifier } from '../ui.js';
import { allerA } from '../navigation.js';
import { definirPerso } from '../etat.js';
import { dessinerGladiateur } from '../rendu/gladiateur.js';
import { dessinerFondColisee } from './titre.js';

const CATEGORIES = [
  { id: 'peau', nom: 'Peau' },
  { id: 'coiffure', nom: 'Coiffure' },
  { id: 'cheveux', nom: 'Cheveux' },
  { id: 'tunique', nom: 'Tunique et cape' },
];

const hasard = (liste) => liste[Math.floor(Math.random() * liste.length)].id;

let skin, attributs, nomSaisi, nomTouche;

const pointsRestants = () =>
  CREATION.pointsARepartir - ORDRE_ATTRIBUTS.reduce((s, a) => s + attributs[a] - CREATION.valeurDepart, 0);

const equipementDepart = () => ({ arme: { id: CREATION.armeDepart, niveau: 0 } });

function rendreSkins() {
  $('#choix-skin').innerHTML = CATEGORIES.map((c) => {
    const options = SKINS[c.id].map((o) => {
      const choisi = skin[c.id] === o.id ? 'choisi' : '';
      return o.couleur
        ? `<button class="pastille-couleur ${choisi}" data-cat="${c.id}" data-id="${o.id}" style="--c:${o.couleur}" title="${echapper(o.nom)}" aria-label="${echapper(o.nom)}"></button>`
        : `<button class="pilule ${choisi}" data-cat="${c.id}" data-id="${o.id}">${echapper(o.nom)}</button>`;
    }).join('');
    return `<div class="ligne-skin"><span>${c.nom}</span><div class="options-skin">${options}</div></div>`;
  }).join('');
}

function rendreStats() {
  const s = statsCombattant({ nom: '', attributs, pointsGagnes: 0, equipement: equipementDepart() });
  const degats = Math.round(degatsBase(s));
  $('#creation-stats').innerHTML = `
    <div><b>${s.pvMax}</b><small>PV</small></div>
    <div><b>${s.staminaMax}</b><small>Stamina</small></div>
    <div><b>${s.bouclierMax}</b><small>Bouclier</small></div>
    <div><b>${degats}</b><small>Dégâts (dague)</small></div>
    <div><b>${chanceCritique(s)} %</b><small>Critique</small></div>`;
}

function rendreAttributsCreation() {
  const restants = pointsRestants();
  $('#creation-points').textContent = restants;
  $('#creation-points').parentElement.classList.toggle('termine', restants === 0);
  rendreAttributs($('#creation-attributs'), {
    valeurs: attributs,
    minimums: attributsDeBase(),
    restants,
    surChangement(attr, delta) {
      attributs[attr] += delta;
      rendreAttributsCreation();
    },
  });
  rendreStats();
  verifier();
}

function verifier() {
  const erreur = erreurNom(nomSaisi);
  $('#creation-erreur-nom').textContent = nomTouche && erreur ? erreur : '';
  const restants = pointsRestants();
  const bouton = $('#creation-valider');
  bouton.disabled = !!erreur || restants !== 0;
  bouton.title = erreur || (restants ? `Il reste ${restants} point(s) à répartir.` : '');
}

export const ecranCreation = {
  nom: 'creation',
  section: 'ecran-creation',
  hud: false,
  musique: 'titre',

  initialiser() {
    $('#creation-nom').setAttribute('maxlength', CREATION.nomMax);
    $('#creation-nom').addEventListener('input', (e) => { nomSaisi = e.target.value; nomTouche = true; verifier(); });
    $('#choix-skin').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cat]');
      if (!b) return;
      skin[b.dataset.cat] = b.dataset.id;
      rendreSkins();
    });
    $('#creation-hasard').addEventListener('click', () => {
      for (const c of CATEGORIES) skin[c.id] = hasard(SKINS[c.id]);
      rendreSkins();
    });
    $('#creation-reset').addEventListener('click', () => { attributs = attributsDeBase(); rendreAttributsCreation(); });
    $('#creation-retour').addEventListener('click', () => allerA('titre'));
    $('#creation-valider').addEventListener('click', () => {
      if (erreurNom(nomSaisi) || pointsRestants() !== 0) return;
      const perso = nouveauPersonnage({ nom: nomSaisi, skin, attributs });
      definirPerso(perso);
      allerA('village');
      notifier(`Bienvenue en ville, ${perso.nom} ! La forge t'offre une dague.`, 'succes');
    });
  },

  entrer() {
    skin = { peau: hasard(SKINS.peau), coiffure: hasard(SKINS.coiffure), cheveux: hasard(SKINS.cheveux), tunique: hasard(SKINS.tunique) };
    attributs = attributsDeBase();
    nomSaisi = '';
    nomTouche = false;
    $('#creation-nom').value = '';
    rendreSkins();
    rendreAttributsCreation();
    setTimeout(() => $('#creation-nom').focus(), 300);
  },

  dessiner(ctx, w, h, t) {
    dessinerFondColisee(ctx, w, h, t, { duellistes: false, assombrir: 0.6 });

    // Aperçu du gladiateur
    const c = $('#creation-canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = c.clientWidth, ch = c.clientHeight;
    if (!cw) return;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    const p = c.getContext('2d');
    p.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = p.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, '#f6dca0'); g.addColorStop(1, '#e9c27a');
    p.fillStyle = g; p.fillRect(0, 0, cw, ch);
    p.fillStyle = '#d9ae62'; p.fillRect(0, ch * 0.84, cw, ch);
    // Petite démonstration : un coup toutes les 4 secondes
    const cycle = t % 4;
    dessinerGladiateur(p, {
      x: cw / 2 - 10, y: ch * 0.88, echelle: Math.min(cw / 150, ch / 170), direction: 1,
      skin, equipement: equipementDepart(),
      pose: cycle > 3 ? 'attaque' : 'repos', avancement: cycle > 3 ? cycle - 3 : 0, temps: t,
    });
  },
};
