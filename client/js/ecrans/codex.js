// ============================================================================
//  ARENA GLADIUS — Codex de l'arène
//  Tableaux générés depuis shared/data.js et shared/formulas.js :
//  pratique pour vérifier l'équilibrage sans lire le code.
// ============================================================================

import {
  ARMES, ARMURES, ORDRE_EMPLACEMENTS, ORDRE_MATERIAUX, EMPLACEMENTS, MATERIAUX, TEMPS_REEL,
  ARENES, ORDRE_ARENES, AMELIORATION, STATS,
} from '/shared/data.js';
import {
  statsArme, valeurArmure, totalInvesti, prixRevente, statsCombattant,
  reductionArmure, degatsCoup, dureePhase,
} from '/shared/formulas.js';
import { $ } from '../ui.js';
import { allerA } from '../navigation.js';
import { terrainDe } from '/shared/terrain.js';
import { dessinerDecor } from '../rendu/decor.js';
import { geometrie, dessinerTerrain, dessinerAvantPlan } from '../rendu/terrain.js';
import { dessinerFondColisee } from './titre.js';
import { AIDE_TOUCHES } from '../combat/controles.js';

const pct = (v) => `${Math.round(v * 100)} %`;

// Gladiateur « témoin » pour les exemples chiffrés
const TEMOIN_ATTR = { force: 3, agilite: 3, defense: 2, vitalite: 3, endurance: 3, vitesse: 2 };
const temoin = (arme, armures = {}) => statsCombattant({
  nom: 'Témoin', attributs: TEMOIN_ATTR, pointsGagnes: 0, equipement: { arme, ...armures },
});

const ONGLETS = {
  armes: {
    titre: 'Armes',
    rendu() {
      const lignes = Object.entries(ARMES).map(([id, a]) => {
        const s0 = statsArme({ id, niveau: 0 }), s5 = statsArme({ id, niveau: AMELIORATION.niveauMax });
        return `<tr><td>${a.nom}</td><td><span class="palier">${a.palier}</span></td><td>${a.prix}</td>
          <td>${s0.degats} → ${s5.degats}</td><td>${a.cadence > 0 ? '+' : ''}${a.cadence} %</td>
          <td>${a.allonge >= 2 ? 'longue' : 'courte'}</td>
          <td style="text-align:left">${a.particularite}</td></tr>`;
      }).join('');
      return `<p class="note">Dégâts de base à +0 → +${AMELIORATION.niveauMax}. La Force ajoute ${STATS.forceVersDegats} dégâts par point.</p>
        <table class="tableau"><tr><th>Arme</th><th>Palier</th><th>Prix</th><th>Dégâts</th><th>Vitesse</th><th>Allonge</th><th>Particularité</th></tr>${lignes}</table>`;
    },
  },
  armures: {
    titre: 'Armures',
    rendu() {
      const tetes = ORDRE_MATERIAUX.map((m) => `<th>${MATERIAUX[m].nom}</th>`).join('');
      const lignes = ORDRE_EMPLACEMENTS.map((e) => {
        const cases = ORDRE_MATERIAUX.map((m) => {
          const a = ARMURES[`${e}_${m}`];
          return `<td>${a.valeur} → ${valeurArmure({ id: `${e}_${m}`, niveau: 5 })}<br><small>${a.prix} cr.</small></td>`;
        }).join('');
        return `<tr><td>${EMPLACEMENTS[e].nom}<br><small>${EMPLACEMENTS[e].stat === 'bouclier' ? 'points de bouclier' : 'armure'}</small></td>${cases}</tr>`;
      }).join('');
      const exemples = ORDRE_MATERIAUX.map((m) => {
        const tenue = (n) => ({ casque: { id: `casque_${m}`, niveau: n }, plastron: { id: `plastron_${m}`, niveau: n }, jambieres: { id: `jambieres_${m}`, niveau: n } });
        const t0 = temoin(null, tenue(0)), t5 = temoin(null, tenue(5));
        return `<tr><td>Tenue complète en ${MATERIAUX[m].nom.toLowerCase()}</td><td>${t0.armure} → ${t5.armure}</td><td>${pct(reductionArmure(t0))} → ${pct(reductionArmure(t5))}</td></tr>`;
      }).join('');
      const obj = { id: 'plastron_fer', niveau: 3 };
      return `<p class="note">Valeur à +0 → +5 et prix d'achat. Améliorer au niveau N coûte prix × 0,5 × N.
        Exemple : un plastron en fer +3 a coûté ${totalInvesti(obj)} crédits au total et se revend ${prixRevente(obj)}.</p>
        <table class="tableau"><tr><th>Emplacement</th>${tetes}</tr>${lignes}</table>
        <p class="note" style="margin-top:14px">Réduction des dégâts = A / (A + ${STATS.armureConstante}), avec A = armure + Défense (plafond ${STATS.reductionMax * 100} %). Témoin avec Défense 2 :</p>
        <table class="tableau"><tr><th>Tenue</th><th>Armure</th><th>Réduction</th></tr>${exemples}</table>`;
    },
  },
  combat: {
    titre: 'Combat',
    rendu() {
      const R = TEMPS_REEL;
      const commandes = AIDE_TOUCHES.map((a) => `<tr><td>${a.action}</td><td>${a.touches}${a.alt ? ` ou ${a.alt}` : ''}</td></tr>`).join('');
      const glaive = temoin({ id: 'glaive', niveau: 0 });
      const cible = temoin({ id: 'glaive', niveau: 0 }, { plastron: { id: 'plastron_cuir', niveau: 0 } });
      const ms = (type, ph) => Math.round(dureePhase(type, ph, glaive) * 1000);
      const attaques = ['legere', 'lourde'].map((t) => `<tr><td>${R.attaques[t].nom}</td>
        <td>${ms(t, 'preparation')} ms</td><td>${ms(t, 'active') + ms(t, 'recuperation')} ms</td>
        <td>${t === 'lourde' ? glaive.tr.coutLourde : 0}</td><td>~${degatsCoup(t, glaive, cible)}</td></tr>`).join('');
      return `<p class="note">Le combat se joue en temps réel. On gagne quand les PV adverses tombent à 0
        ou quand l’adversaire tombe dans un trou (voir les arènes) ; après ${R.dureeMax / 60} minutes, au plus haut % de PV restants.</p>
        <table class="tableau"><tr><th>Commande</th><th>Touches (AZERTY)</th></tr>${commandes}</table>
        <p class="note" style="margin-top:14px">Attaques d’un témoin (Agilité 3, épée courte) contre le même témoin en plastron de cuir.
          La <b>préparation</b> est le moment où l’adversaire peut réagir.</p>
        <table class="tableau"><tr><th>Attaque</th><th>Préparation</th><th>Coup + récupération</th><th>Stamina</th><th>Dégâts</th></tr>${attaques}</table>
        <p class="note" style="margin-top:14px">
          <b>Parer</b> (maintenir) : les coups reçus de face vident la <b>garde</b> au lieu des PV (${Math.round(R.parade.reductionDegats * 100)} % arrêtés).
          Garde vide : garde brisée, tu es sonné. Parade levée au tout dernier moment (${Math.round(R.parade.fenetreParfaite * 1000)} ms) :
          <b>parade parfaite</b>, c’est l’attaquant qui est sonné.<br>
          <b>Esquive</b> : un dash rapide, invincible pendant ${Math.round(R.esquive.invincibilite * 1000)} ms, pour ${R.esquive.cout} stamina.<br>
          <b>Stamina</b> : se vide avec les esquives et les attaques lourdes, puis remonte toute seule.</p>`;
    },
  },
  arenes: {
    titre: 'Arènes',
    rendu() {
      return `<p class="note">L’arène est tirée au sort à chaque entrée au Colisée. Aucun bonus de stats : seul le terrain change
        (blocs sur lesquels monter, plateformes, et parfois des trous mortels ou de la glace). Chaque arène est symétrique, donc équitable.</p>
        <div class="grille-arenes">${ORDRE_ARENES.map((id) => `
        <div class="carte-arene"><canvas data-arene="${id}" width="520" height="240"></canvas>
          <h3>${ARENES[id].nom}</h3><p>${ARENES[id].description}</p>
          <p class="particularites ${terrainDe(id).trous.length ? 'danger' : ''}">${ARENES[id].particularites}</p></div>`).join('')}</div>`;
    },
    apres() {
      document.querySelectorAll('canvas[data-arene]').forEach((c) => {
        const ctx = c.getContext('2d');
        const terrain = terrainDe(c.dataset.arene);
        const g = geometrie(c.width, c.height, c.height, 8);
        dessinerDecor(ctx, c.dataset.arene, c.width, c.height, 2);
        dessinerTerrain(ctx, g, terrain, 2);
        dessinerAvantPlan(ctx, g, terrain, 2);
      });
    },
  },
};

let ongletActif = 'armes';

function afficherOnglet(id) {
  ongletActif = id;
  $('#onglets-codex').innerHTML = Object.entries(ONGLETS)
    .map(([k, o]) => `<button data-onglet="${k}" class="${k === id ? 'actif' : ''}">${o.titre}</button>`).join('');
  $('#contenu-codex').innerHTML = ONGLETS[id].rendu();
  ONGLETS[id].apres?.();
}

export const ecranCodex = {
  nom: 'codex',
  section: 'ecran-codex',
  hud: false,
  musique: 'titre',

  initialiser() {
    $('#onglets-codex').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-onglet]');
      if (b) afficherOnglet(b.dataset.onglet);
    });
    $('#btn-codex').addEventListener('click', () => allerA('codex'));
    $('#btn-retour-codex').addEventListener('click', () => allerA('titre'));
  },

  entrer() {
    afficherOnglet(ongletActif);
  },

  dessiner(ctx, w, h, t) {
    dessinerFondColisee(ctx, w, h, t, { duellistes: false, assombrir: 0.6 });
  },
};
