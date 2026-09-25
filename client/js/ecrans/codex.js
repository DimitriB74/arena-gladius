// ============================================================================
//  ARENA GLADIUS — Codex de l'arène
//  Tableaux générés depuis shared/data.js et shared/formulas.js :
//  pratique pour vérifier l'équilibrage sans lire le code.
// ============================================================================

import {
  ARMES, ARMURES, ORDRE_EMPLACEMENTS, ORDRE_MATERIAUX, EMPLACEMENTS, MATERIAUX, ACTIONS, ORDRE_ACTIONS,
  ARENES, ORDRE_ARENES, AMELIORATION, STATS,
} from '/shared/data.js';
import {
  statsArme, valeurArmure, totalInvesti, prixRevente, statsCombattant,
  chanceToucher, degatsEstimes, reductionArmure, coutAction,
} from '/shared/formulas.js';
import { $ } from '../ui.js';
import { allerA } from '../navigation.js';
import { dessinerDecor } from '../rendu/decor.js';
import { dessinerFondColisee } from './titre.js';

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
          <td>${s0.degats} → ${s5.degats}</td><td>${a.precision > 0 ? '+' : ''}${a.precision} %</td>
          <td>${a.porteeMin === a.porteeMax ? a.porteeMax : `${a.porteeMin}-${a.porteeMax}`}</td>
          <td style="text-align:left">${a.particularite}</td></tr>`;
      }).join('');
      return `<p class="note">Dégâts de base à +0 → +${AMELIORATION.niveauMax}. La Force ajoute ${STATS.forceVersDegats} dégâts par point.</p>
        <table class="tableau"><tr><th>Arme</th><th>Palier</th><th>Prix</th><th>Dégâts</th><th>Précision</th><th>Portée</th><th>Particularité</th></tr>${lignes}</table>`;
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
  actions: {
    titre: 'Actions',
    rendu() {
      const glaive = temoin({ id: 'glaive', niveau: 0 });
      const cible = temoin({ id: 'glaive', niveau: 0 }, { plastron: { id: 'plastron_cuir', niveau: 0 } });
      const lignes = ORDRE_ACTIONS.map((id) => {
        const a = ACTIONS[id];
        const detail = a.type === 'attaque'
          ? `${chanceToucher(id, glaive, cible)} % pour ~${degatsEstimes(id, glaive, cible)} dégâts` : '—';
        return `<tr><td>${a.nom}</td><td>${coutAction(id, glaive)}</td><td style="text-align:left">${a.description}</td><td>${detail}</td></tr>`;
      }).join('');
      return `<p class="note">Coûts et exemple pour un témoin (Force 3, Agilité 3, Vitesse 2, épée courte) contre le même témoin en plastron de cuir.</p>
        <table class="tableau"><tr><th>Action</th><th>Stamina</th><th>Effet</th><th>Exemple</th></tr>${lignes}</table>`;
    },
  },
  arenes: {
    titre: 'Arènes',
    rendu() {
      return `<p class="note">L’arène est tirée au sort à chaque entrée au Colisée. Elle ne change que le décor.</p>
        <div class="grille-arenes">${ORDRE_ARENES.map((id) => `
        <div class="carte-arene"><canvas data-arene="${id}" width="520" height="240"></canvas>
          <h3>${ARENES[id].nom}</h3><p>${ARENES[id].description}</p></div>`).join('')}</div>`;
    },
    apres() {
      document.querySelectorAll('canvas[data-arene]').forEach((c) => {
        dessinerDecor(c.getContext('2d'), c.dataset.arene, c.width, c.height, 2);
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
