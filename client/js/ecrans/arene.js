// ============================================================================
//  ARENA GLADIUS — entrée du Colisée
//  L'arène est tirée au sort (roulette animée), sans bonus ni pénalité.
//  Ensuite : combat contre un bot (3 difficultés), ou défi lancé à un ami en ligne.
// ============================================================================

import { ARENES, ORDRE_ARENES, DIFFICULTES, ORDRE_DIFFICULTES, RECOMPENSES } from '/shared/data.js';
import { $, notifier, prixHtml } from '../ui.js';
import { envoyer, etatReseau } from '../reseau.js';
import { brancherListe } from '../defis.js';
import { jouerSon } from '../audio.js';
import { lirePerso } from '../etat.js';
import { dessinerDecor, hauteurSol } from '../rendu/decor.js';
import { dessinerGladiateur } from '../rendu/gladiateur.js';

let etapes = [];        // [{ arene, fin }] : arène affichée jusqu'au temps `fin`
let debut = null;
let revele = false;
let areneChoisie = 'colisee';
const CLE_DIFFICULTE = 'arena-gladius:difficulte';

function derniereDifficulte() {
  try { return localStorage.getItem(CLE_DIFFICULTE) || 'normal'; } catch { return 'normal'; }
}

/** Les 3 cartes de difficulté du bot, avec leurs récompenses */
function rendreDifficultes() {
  const derniere = derniereDifficulte();
  $('#arene-difficultes').innerHTML = ORDRE_DIFFICULTES.map((id) => {
    const d = DIFFICULTES[id];
    const v = RECOMPENSES.ia[id].victoire;
    return `
      <button class="carte-difficulte ${id} ${id === derniere ? 'derniere' : ''}" data-difficulte="${id}">
        <span class="icone-difficulte">${d.icone}</span>
        <b>${d.nom}</b>
        <small>${d.description}</small>
        <span class="gain-difficulte">Victoire : ${prixHtml(v.credits)} + ${v.points} pt${v.points > 1 ? 's' : ''}</span>
      </button>`;
  }).join('');
}

function lancerContreBot(difficulte) {
  if (!etatReseau.connecte) { notifier('Serveur injoignable : impossible de lancer le combat.', 'erreur'); return; }
  if (!etatReseau.accepte) { notifier('Le serveur n’a pas accepté ton gladiateur.', 'erreur'); return; }
  try { localStorage.setItem(CLE_DIFFICULTE, difficulte); } catch { /* rien */ }
  document.querySelectorAll('#arene-difficultes button').forEach((b) => { b.disabled = true; });
  envoyer('match:training', { arene: areneChoisie, difficulte });
}

/** Prépare la roulette : des arènes qui défilent de plus en plus lentement */
function preparerTirage() {
  areneChoisie = ORDRE_ARENES[Math.floor(Math.random() * ORDRE_ARENES.length)];
  etapes = [];
  let temps = 0, intervalle = 0.07, precedente = null;
  while (temps < 1.6) {
    let a;
    do { a = ORDRE_ARENES[Math.floor(Math.random() * ORDRE_ARENES.length)]; } while (a === precedente);
    temps += intervalle;
    intervalle *= 1.2;
    etapes.push({ arene: a, fin: temps });
    precedente = a;
  }
  if (precedente === areneChoisie) etapes.pop();
  etapes.push({ arene: areneChoisie, fin: Infinity });
}

function reveler() {
  revele = true;
  const a = ARENES[areneChoisie];
  $('#arene-nom').textContent = a.nom;
  $('#arene-description').textContent = a.description;
  $('#panneau-arene').classList.add('revele');
  $('#arene-ia').disabled = false;
  $('#arene-ami').disabled = false;
  jouerSon('gong');
}

export const areneTiree = () => areneChoisie;

export const ecranArene = {
  nom: 'arene',
  section: 'ecran-arene',
  hud: true,
  maison: true,
  musique: 'colisee',

  initialiser() {
    // « Combattre un bot » ouvre le choix de la difficulté
    $('#arene-ia').addEventListener('click', () => {
      const choix = $('#arene-difficultes');
      choix.hidden = !choix.hidden;
      $('#arene-joueurs').hidden = true;
      if (!choix.hidden) rendreDifficultes();
    });
    $('#arene-difficultes').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-difficulte]');
      if (b && !b.disabled) lancerContreBot(b.dataset.difficulte);
    });
    $('#arene-ami').addEventListener('click', () => {
      const liste = $('#arene-joueurs');
      liste.hidden = !liste.hidden;
      $('#arene-difficultes').hidden = true;
      if (!liste.hidden) brancherListe(liste, areneChoisie);
    });
  },

  entrer() {
    $('#arene-ia').disabled = true;
    $('#arene-ami').disabled = true;
    $('#arene-joueurs').hidden = true;
    $('#arene-difficultes').hidden = true;
    preparerTirage();
    debut = null;
    revele = false;
    $('#arene-nom').textContent = 'Tirage au sort…';
    $('#arene-description').textContent = 'Le maître des jeux choisit le lieu du combat.';
    $('#panneau-arene').classList.remove('revele');
  },

  dessiner(ctx, w, h, t) {
    if (debut === null) debut = t;
    const ecoule = t - debut;
    const etape = etapes.find((e) => ecoule < e.fin) || etapes[etapes.length - 1];
    if (!revele && etape.fin === Infinity) reveler();
    if (!revele) $('#arene-nom').textContent = ARENES[etape.arene].nom;

    dessinerDecor(ctx, etape.arene, w, h, t);

    const perso = lirePerso();
    if (perso) {
      const echelle = Math.max(0.9, Math.min(2, h / 430));
      dessinerGladiateur(ctx, {
        x: Math.max(90, w * 0.2), y: hauteurSol(h) + 8, echelle, direction: 1, skin: perso.skin, equipement: perso.equipement,
        pose: revele ? 'victoire' : 'repos', temps: t,
      });
    }

    // Flash au moment où l'arène est révélée
    if (revele) {
      const depuis = ecoule - etapes[etapes.length - 2].fin;
      if (depuis < 0.4) {
        ctx.fillStyle = `rgba(255,245,210,${0.6 * (1 - depuis / 0.4)})`;
        ctx.fillRect(0, 0, w, h);
      }
    }
  },
};
