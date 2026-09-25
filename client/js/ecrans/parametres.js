// ============================================================================
//  ARENA GLADIUS — paramètres du gladiateur
//  Répartition des points de compétence, stats détaillées,
//  export / import de la sauvegarde.
// ============================================================================

import { ORDRE_ATTRIBUTS, RECOMPENSES, TEMPS_REEL } from '/shared/data.js';
import {
  statsCombattant, niveauPersonnage, chanceCritique, reductionArmure, degatsBase,
  pointsInvestis, coutReinitialisation,
} from '/shared/formulas.js';
import { repartirPoints, appliquerRecompense, reinitialiserPoints } from '/shared/boutique.js';
import { $, rendreAttributs, notifier, prixHtml } from '../ui.js';
import { allerA } from '../navigation.js';
import { lirePerso, appliquer, definirPerso } from '../etat.js';
import { exporterCode, importerCode, effacerSauvegarde } from '../sauvegarde.js';
import { dessinerGladiateur } from '../rendu/gladiateur.js';
import { dessinerVillage, calculerVue } from '../rendu/village.js';

const MODE_TEST = new URLSearchParams(location.search).has('test');

let ajouts = {};   // points ajoutés mais pas encore validés

const pointsEnAttente = () => ORDRE_ATTRIBUTS.reduce((s, a) => s + (ajouts[a] || 0), 0);

function attributsAffiches(perso) {
  const v = {};
  for (const a of ORDRE_ATTRIBUTS) v[a] = perso.attributs[a] + (ajouts[a] || 0);
  return v;
}

function rendreStats(perso) {
  const attr = attributsAffiches(perso);
  const s = statsCombattant({ ...perso, attributs: attr });
  const base = degatsBase(s);
  const tr = s.tr;
  const pourcent = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)} %`;
  const fr = (v) => String(v).replace('.', ',');   // 8.5 → 8,5
  const hauteurSaut = Math.round((tr.impulsionSaut ** 2) / (2 * TEMPS_REEL.physique.gravite));
  const lignes = [
    ['❤️ Points de vie', s.pvMax],
    ['⚔ Attaque légère', `≈ ${Math.round(base * TEMPS_REEL.attaques.legere.mult)} dégâts`],
    ['💥 Attaque lourde', `≈ ${Math.round(base * TEMPS_REEL.attaques.lourde.mult)} dégâts (${tr.coutLourde} stamina)`],
    ['⏱ Vitesse d’attaque', pourcent(tr.cadence - 1)],
    ['🎯 Critique', `${fr(chanceCritique(s))} % (dégâts ×1,5)`],
    ['↔ Allonge', `${s.arme.allonge >= 2 ? 'longue' : 'courte'} (${s.arme.nom}${s.arme.niveau ? ` +${s.arme.niveau}` : ''})`],
    ['🏃 Course', pourcent(tr.vitesse / TEMPS_REEL.deplacement.vitesseBase - 1)],
    ['🦘 Hauteur de saut', `${hauteurSaut} (double saut en plus)`],
    ['⚡ Stamina', `${s.staminaMax}, remonte de ${fr(tr.regenStamina)}/s`],
    ['🛡 Garde', `${tr.gardeMax} (bouclier + Défense)`],
    ['🪖 Armure', `${fr(s.armure)} → −${Math.round(reductionArmure(s) * 100)} % de dégâts`],
  ];
  $('#param-stats').innerHTML = lignes.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
}

function rendrePoints() {
  const perso = lirePerso();
  const restants = perso.pointsLibres - pointsEnAttente();
  $('#param-points-libres').textContent = restants;
  $('#param-points').classList.toggle('a-repartir', perso.pointsLibres > 0);
  const minimums = { ...perso.attributs };
  rendreAttributs($('#param-attributs'), {
    valeurs: attributsAffiches(perso),
    minimums,
    restants,
    surChangement(attr, delta) {
      ajouts[attr] = (ajouts[attr] || 0) + delta;
      rendrePoints();
    },
  });
  const enAttente = pointsEnAttente() > 0;
  $('#param-valider').disabled = !enAttente;
  $('#param-annuler').disabled = !enAttente;
  $('#param-aide-points').textContent = perso.pointsLibres > 0
    ? 'Clique sur + pour placer tes points, puis valide. Tu pourras tout redistribuer plus tard contre des crédits.'
    : `Gagne des combats pour obtenir des points : ${RECOMPENSES.joueur.victoire.points} par victoire contre un ami, ${RECOMPENSES.joueur.defaite.points} par défaite, ${RECOMPENSES.ia.normal.victoire.points} ou ${RECOMPENSES.ia.difficile.victoire.points} par victoire contre un bot.`;
  rendreStats(perso);
  rendreReinitialisation(perso, enAttente);
}

/** Bouton « Réinitialiser mes points » : prix proportionnel aux points investis */
function rendreReinitialisation(perso, enAttente) {
  const n = pointsInvestis(perso.attributs);
  const cout = coutReinitialisation(perso.attributs);
  const bouton = $('#param-reinitialiser');
  const info = $('#param-reinitialiser-info');
  bouton.innerHTML = n > 0 ? `↺ Réinitialiser mes points ${prixHtml(cout)}` : '↺ Réinitialiser mes points';
  bouton.disabled = n <= 0 || enAttente;
  bouton.toggleAttribute('data-pauvre', n > 0 && perso.credits < cout);
  if (n <= 0) info.textContent = 'Aucun point placé pour l’instant.';
  else if (enAttente) info.textContent = 'Valide ou annule ta répartition en cours d’abord.';
  else if (perso.credits < cout) info.textContent = `Rend tes ${n} points placés. Il te manque ${cout - perso.credits} crédits.`;
  else info.textContent = `Rend tes ${n} points placés : tous tes attributs reviennent à 1.`;
}

function rendreFiche() {
  const perso = lirePerso();
  const s = perso.stats;
  $('#param-nom').textContent = perso.nom;
  $('#param-niveau').textContent = `Niveau ${niveauPersonnage(perso.pointsGagnes)}`;
  $('#param-record').innerHTML = `
    <div><b>${s.victoires}</b><small>victoires</small></div>
    <div><b>${s.defaites}</b><small>défaites</small></div>
    <div><b>${s.victoiresIA}/${s.victoiresIA + s.defaitesIA}</b><small>contre les bots</small></div>`;
}

export const ecranParametres = {
  nom: 'parametres',
  section: 'ecran-parametres',
  hud: true,
  maison: true,
  musique: 'village',

  initialiser() {
    $('#param-valider').addEventListener('click', () => {
      const aAjouter = Object.fromEntries(Object.entries(ajouts).filter(([, n]) => n > 0));
      const r = appliquer(repartirPoints(lirePerso(), aAjouter));
      if (r.ok) {
        notifier('Points de compétence attribués !', 'succes');
        ajouts = {};
      } else notifier(r.erreur, 'erreur');
      rendrePoints();
      rendreFiche();
    });
    $('#param-annuler').addEventListener('click', () => { ajouts = {}; rendrePoints(); });

    $('#param-reinitialiser').addEventListener('click', () => {
      const perso = lirePerso();
      const n = pointsInvestis(perso.attributs);
      const cout = coutReinitialisation(perso.attributs);
      if (perso.credits < cout) { notifier(`Il faut ${cout} crédits pour réinitialiser tes points.`, 'erreur'); return; }
      if (!confirm(`Réinitialiser tes points pour ${cout} crédits ?\n\nTes ${n} points placés te seront rendus : tous tes attributs reviendront à 1 et tu pourras les répartir à nouveau.`)) return;
      const r = appliquer(reinitialiserPoints(perso));
      if (r.ok) notifier(`${r.points} points rendus contre ${r.cout} crédits. À toi de les répartir !`, 'succes');
      else notifier(r.erreur, 'erreur');
      ajouts = {};
      rendreFiche();
      rendrePoints();
    });

    $('#param-exporter').addEventListener('click', () => {
      const zone = $('#param-code-export');
      zone.value = exporterCode(lirePerso());
      zone.hidden = false;
      zone.select();
      navigator.clipboard?.writeText(zone.value).then(
        () => notifier('Code copié dans le presse-papiers. Garde-le précieusement !', 'succes'),
        () => notifier('Copie le code affiché (Ctrl+C).', 'info'),
      );
    });
    $('#param-importer').addEventListener('click', () => {
      const r = importerCode($('#param-code-import').value);
      if (!r.ok) { notifier(r.erreur, 'erreur'); return; }
      if (!confirm(`Charger le gladiateur « ${r.perso.nom} » ? Le gladiateur actuel sera remplacé.`)) return;
      definirPerso(r.perso);
      $('#param-code-import').value = '';
      ajouts = {};
      notifier(`${r.perso.nom} est de retour !`, 'succes');
      rendreFiche();
      rendrePoints();
    });
    $('#param-supprimer').addEventListener('click', () => {
      if (!confirm('Supprimer définitivement ce gladiateur ?\n(Exporte ta sauvegarde avant si tu veux le garder.)')) return;
      effacerSauvegarde();
      definirPerso(null, { sauver: false });
      allerA('titre');
    });

    // Mode test (?test dans l'adresse) : simuler des combats pour essayer la progression
    if (MODE_TEST) {
      $('#param-test').hidden = false;
      $('#param-test').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-victoire]');
        if (!b) return;
        const r = appliquer(appliquerRecompense(lirePerso(), 'joueur', b.dataset.victoire === '1', 0.5));
        notifier(`Test : +${r.recompense.credits} crédits, +${r.recompense.points} point(s).`, 'info');
        rendreFiche();
        rendrePoints();
      });
    }
  },

  entrer() {
    ajouts = {};
    $('#param-code-export').hidden = true;
    rendreFiche();
    rendrePoints();
  },

  dessiner(ctx, w, h, t) {
    const perso = lirePerso();
    if (!perso) return;
    dessinerVillage(ctx, calculerVue(w, h), t, { perso, niveau: niveauPersonnage(perso.pointsGagnes) });
    ctx.fillStyle = 'rgba(30,15,5,0.55)';
    ctx.fillRect(0, 0, w, h);

    // Portrait en pied
    const c = $('#param-canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = c.clientWidth, ch = c.clientHeight;
    if (!cw) return;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    const p = c.getContext('2d');
    p.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = p.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, '#f6dca0'); g.addColorStop(1, '#e9c27a');
    p.fillStyle = g; p.fillRect(0, 0, cw, ch);
    p.fillStyle = '#d9ae62'; p.fillRect(0, ch * 0.86, cw, ch);
    dessinerGladiateur(p, {
      x: cw / 2 - 8, y: ch * 0.9, echelle: Math.min(cw / 150, ch / 165), direction: 1,
      skin: perso.skin, equipement: perso.equipement, pose: pointsEnAttente() > 0 ? 'victoire' : 'repos', temps: t,
    });
  },
};

