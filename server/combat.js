// ============================================================================
//  ARENA GLADIUS — server/combat.js
//
//  Moteur de combat au tour par tour. Logique PURE et testable :
//  pas de réseau ici, pas de minuteur. Le hasard vient d'une fonction `alea`
//  passée en paramètre (Math.random par défaut).
//
//  creerCombat(persos, options)        → état du combat
//  actionsPossibles(etat, i)           → ce que le combattant i peut faire
//  jouerAction(etat, i, actionId)      → applique l'action (modifie l'état)
//  abandonner(etat, i, raison)         → fin du combat
//  vuePublique(etat)                   → copie de l'état envoyée aux navigateurs
// ============================================================================

import { ACTIONS, ORDRE_ACTIONS, COMBAT, ARENES, ORDRE_ARENES } from '../shared/data.js';
import {
  statsCombattant, aPortee, coutAction, tirerAttaque, appliquerDegats, regenParTour,
  recuperationRepos, rechargeBouclier, chanceProvocation, premierJoueur,
} from '../shared/formulas.js';

const TAILLE_JOURNAL = 40;

// ----------------------------------------------------------------------------
//  Création
// ----------------------------------------------------------------------------
export function creerCombat(persos, { arene = null, alea = Math.random, ia = [false, false] } = {}) {
  const combattants = persos.map((p, i) => {
    const stats = statsCombattant(p);
    return {
      nom: p.nom,
      skin: p.skin,
      equipement: p.equipement,
      niveau: stats.niveau,
      stats,
      pv: stats.pvMax,
      stamina: stats.staminaMax,
      bouclier: stats.bouclierMax,
      position: COMBAT.caseDepart[i],
      protege: false,
      derniere: null,
      ia: !!ia[i],
      compteurs: { degats: 0, attaques: 0, touches: 0, critiques: 0 },
    };
  });
  const idArene = ARENES[arene] ? arene : ORDRE_ARENES[Math.floor(alea() * ORDRE_ARENES.length)];
  const premier = premierJoueur(combattants[0].stats, combattants[1].stats, alea);
  const etat = {
    arene: idArene,
    manche: 1,
    tour: premier,
    premier,
    numeroAction: 0,
    combattants,
    journal: [],
    fini: false,
    vainqueur: null,
    raison: null,
  };
  noter(etat, `Le combat commence : ${ARENES[idArene].nom} !`, 'info');
  noter(etat, `${combattants[premier].nom} est plus rapide et frappe en premier.`, 'info');
  return etat;
}

// ----------------------------------------------------------------------------
//  Outils
// ----------------------------------------------------------------------------
function noter(etat, texte, type = 'info', acteur = null) {
  etat.journal.push({ texte, type, acteur });
  if (etat.journal.length > TAILLE_JOURNAL) etat.journal.shift();
}

export const distance = (etat) => Math.abs(etat.combattants[0].position - etat.combattants[1].position);

/** Sens de marche vers l'adversaire : +1 (vers la droite) ou −1 */
function sensVersAdversaire(etat, i) {
  return Math.sign(etat.combattants[1 - i].position - etat.combattants[i].position) || (i === 0 ? 1 : -1);
}

// ----------------------------------------------------------------------------
//  Actions possibles
// ----------------------------------------------------------------------------
/** Renvoie { actionId: { possible, raison, cout } } pour le combattant i */
export function actionsPossibles(etat, i) {
  const c = etat.combattants[i];
  const d = distance(etat);
  const sens = sensVersAdversaire(etat, i);
  const resultat = {};
  for (const id of ORDRE_ACTIONS) {
    const a = ACTIONS[id];
    const cout = coutAction(id, c.stats);
    let raison = null;
    switch (a.type) {
      case 'deplacement': {
        if (id === 'avancer' && d <= 1) raison = 'Déjà au contact';
        if (id === 'reculer') {
          const cible = c.position - sens;
          if (cible < 1 || cible > COMBAT.nbCases) raison = 'Dos au mur';
        }
        break;
      }
      case 'charge':
        if (d < a.distanceMin || d > a.distanceMax) raison = `Adversaire à ${a.distanceMin} ou ${a.distanceMax} cases seulement`;
        break;
      case 'attaque':
        if (!aPortee(c.stats.arme, d)) raison = 'Hors de portée';
        break;
      case 'protection':
      case 'provocation':
        if (a.pasDeuxFoisDeSuite && c.derniere === id) raison = 'Pas deux tours de suite';
        break;
      default:
        break;
    }
    if (!raison && c.stamina < cout) raison = 'Pas assez de stamina';
    resultat[id] = { possible: !raison, raison, cout };
  }
  return resultat;
}

// ----------------------------------------------------------------------------
//  Résolution
// ----------------------------------------------------------------------------
const NOMS_ATTAQUES = { rapide: 'une attaque rapide', normale: 'une attaque', puissante: 'une attaque puissante' };

function resoudreAttaque(etat, i, attaqueId, alea, ev) {
  const att = etat.combattants[i];
  const def = etat.combattants[1 - i];
  const r = tirerAttaque(attaqueId, att.stats, def.stats, { protege: def.protege, alea });
  att.compteurs.attaques += 1;
  ev.attaque = attaqueId;
  ev.chance = r.chance;
  ev.touche = r.touche;
  ev.critique = r.critique;
  if (!r.touche) {
    noter(etat, `${att.nom} tente ${NOMS_ATTAQUES[attaqueId]}… ${def.nom} esquive !`, 'rate', i);
    return;
  }
  const res = appliquerDegats(r.degats, def.bouclier, def.pv);
  def.bouclier = res.bouclier;
  def.pv = res.pv;
  att.compteurs.touches += 1;
  att.compteurs.degats += r.degats;
  if (r.critique) att.compteurs.critiques += 1;
  ev.degats = r.degats;
  ev.absorbe = res.absorbe;
  ev.protege = def.protege;
  const details = [];
  if (res.absorbe) details.push(`${res.absorbe} absorbés par le bouclier`);
  if (def.protege) details.push('coup amorti par la garde');
  noter(
    etat,
    `${r.critique ? 'CRITIQUE ! ' : ''}${att.nom} réussit ${NOMS_ATTAQUES[attaqueId]} : ${r.degats} dégâts${details.length ? ` (${details.join(', ')})` : ''}.`,
    r.critique ? 'critique' : 'coup',
    i,
  );
}

function debutTour(etat) {
  const c = etat.combattants[etat.tour];
  c.protege = false; // la garde dure jusqu'au début de son propre tour
  c.stamina = Math.min(c.stats.staminaMax, c.stamina + regenParTour());
}

function terminer(etat, vainqueur, raison) {
  etat.fini = true;
  etat.vainqueur = vainqueur;
  etat.raison = raison;
  const g = etat.combattants[vainqueur], p = etat.combattants[1 - vainqueur];
  const textes = {
    ko: `${p.nom} s’effondre dans le sable ! ${g.nom} remporte le combat !`,
    juges: `Temps écoulé ! Les juges donnent la victoire à ${g.nom}.`,
    abandon: `${p.nom} abandonne. ${g.nom} remporte le combat !`,
    deconnexion: `${p.nom} a quitté l’arène. ${g.nom} remporte le combat !`,
  };
  noter(etat, textes[raison] || `${g.nom} remporte le combat !`, 'fin', vainqueur);
}

/** (C) Après la dernière manche, les juges regardent le % de PV restants */
function decisionDesJuges(etat, alea) {
  const [a, b] = etat.combattants;
  const ra = a.pv / a.stats.pvMax, rb = b.pv / b.stats.pvMax;
  let gagnant;
  if (Math.abs(ra - rb) > 1e-9) gagnant = ra > rb ? 0 : 1;
  else if (a.compteurs.degats !== b.compteurs.degats) gagnant = a.compteurs.degats > b.compteurs.degats ? 0 : 1;
  else gagnant = alea() < 0.5 ? 0 : 1;
  terminer(etat, gagnant, 'juges');
}

function passerTour(etat, alea) {
  // Une manche = chaque combattant a joué une fois
  if (etat.tour !== etat.premier) {
    etat.manche += 1;
    if (etat.manche > COMBAT.manchesMax) {
      etat.manche = COMBAT.manchesMax;
      decisionDesJuges(etat, alea);
      return;
    }
  }
  etat.tour = 1 - etat.tour;
  debutTour(etat);
}

/**
 * Joue l'action `actionId` pour le combattant i.
 * Renvoie { ok: true, evenement } ou { ok: false, erreur }.
 */
export function jouerAction(etat, i, actionId, alea = Math.random) {
  if (etat.fini) return { ok: false, erreur: 'Le combat est terminé.' };
  if (etat.tour !== i) return { ok: false, erreur: 'Ce n’est pas ton tour.' };
  const action = ACTIONS[actionId];
  if (!action) return { ok: false, erreur: 'Action inconnue.' };
  const possible = actionsPossibles(etat, i)[actionId];
  if (!possible.possible) return { ok: false, erreur: possible.raison };

  const c = etat.combattants[i];
  const adv = etat.combattants[1 - i];
  const sens = sensVersAdversaire(etat, i);
  c.stamina -= possible.cout;
  etat.numeroAction += 1;
  const ev = { numero: etat.numeroAction, acteur: i, action: actionId, type: action.type, cout: possible.cout };

  switch (action.type) {
    case 'deplacement': {
      ev.de = c.position;
      c.position += action.pas * sens;
      ev.vers = c.position;
      noter(etat, `${c.nom} ${actionId === 'avancer' ? 'avance' : 'recule'}.`, 'info', i);
      break;
    }
    case 'charge': {
      ev.de = c.position;
      c.position = adv.position - sens;
      ev.vers = c.position;
      noter(etat, `${c.nom} charge !`, 'info', i);
      resoudreAttaque(etat, i, action.attaque, alea, ev);
      break;
    }
    case 'attaque':
      resoudreAttaque(etat, i, actionId, alea, ev);
      break;
    case 'protection': {
      c.protege = true;
      const gain = Math.min(rechargeBouclier(c.stats), c.stats.bouclierMax - c.bouclier);
      c.bouclier += gain;
      ev.bouclier = gain;
      noter(etat, `${c.nom} se met en garde${gain ? ` (+${gain} bouclier)` : ''}.`, 'info', i);
      break;
    }
    case 'repos': {
      const gain = Math.min(recuperationRepos(c.stats), c.stats.staminaMax - c.stamina);
      c.stamina += gain;
      ev.stamina = gain;
      noter(etat, `${c.nom} reprend son souffle (+${gain} stamina).`, 'info', i);
      break;
    }
    case 'provocation': {
      const chance = chanceProvocation(c.stats, adv.stats);
      ev.reussi = alea() * 100 < chance;
      if (ev.reussi) {
        const perte = Math.min(action.perteStamina, adv.stamina);
        adv.stamina -= perte;
        ev.perte = perte;
        noter(etat, `${c.nom} nargue ${adv.nom}, qui perd ${perte} stamina de rage !`, 'info', i);
      } else {
        noter(etat, `${c.nom} provoque ${adv.nom}… qui ne se laisse pas impressionner.`, 'info', i);
      }
      break;
    }
    default:
      break;
  }
  c.derniere = actionId;

  if (adv.pv <= 0) {
    ev.ko = true;
    terminer(etat, i, 'ko');
  } else {
    passerTour(etat, alea);
  }
  return { ok: true, evenement: ev };
}

/** Abandon ou déconnexion définitive du combattant i */
export function abandonner(etat, i, raison = 'abandon') {
  if (etat.fini) return;
  terminer(etat, 1 - i, raison);
}

/** Copie de l'état pour les navigateurs (avec les actions possibles du joueur actif) */
export function vuePublique(etat) {
  return {
    ...etat,
    distance: distance(etat),
    possibles: etat.fini ? null : actionsPossibles(etat, etat.tour),
  };
}
