// ============================================================================
//  ARENA GLADIUS — écran de combat (TEMPS RÉEL)
//
//  Le serveur fait autorité : le navigateur envoie seulement ses touches
//  (match:entrees) et affiche les états reçus (match:state). Pour que les
//  commandes répondent immédiatement, ton gladiateur est anticipé localement
//  (voir combat/session.js), l'adversaire est affiché de façon lissée.
// ============================================================================

import { TEMPS_REEL as T, ARENES, DIFFICULTES } from '/shared/data.js';
import { terrainDe } from '/shared/terrain.js';
import { $, echapper, notifier, prixHtml } from '../ui.js';
import { allerA, ecranCourant } from '../navigation.js';
import { envoyer, surReseau, etatReseau } from '../reseau.js';
import { appliquerResultat } from '../recompenses.js';
import { defier } from '../defis.js';
import { jouerSon } from '../audio.js';
import { jouerTheme } from '../musique.js';
import { dessinerCombat } from '../rendu/combat.js';
import { dessinerGladiateur } from '../rendu/gladiateur.js';
import { SessionCombat } from '../combat/session.js';
import { lireEntree, demarrerControles, arreterControles, AIDE_TOUCHES } from '../combat/controles.js';

// ----------------------------------------------------------------------------
//  État de l'écran
// ----------------------------------------------------------------------------
let session = null;
let resultat = null;        // reçu avec match:end
let resultatAffiche = false;
let dernierT = null;
let derniereMajHud = 0;
let dernierDecompte = null;
let finMessage = 0;          // heure à laquelle « Combat ! » disparaît
let moiAvant = null;         // pour les petits sons de tes propres gestes
const vis = { arene: 'colisee', combattants: [], monIndex: 0, textes: [], impacts: [], secousse: null };

// ----------------------------------------------------------------------------
//  Fiches des combattants (PV, stamina, garde)
// ----------------------------------------------------------------------------
function dessinerPortrait(canvas, c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const taille = 56;
  canvas.width = taille * dpr;
  canvas.height = taille * dpr;
  const p = canvas.getContext('2d');
  p.setTransform(dpr, 0, 0, dpr, 0, 0);
  p.clearRect(0, 0, taille, taille);
  dessinerGladiateur(p, {
    x: 24, y: 160, echelle: 1.22, direction: 1, skin: c.skin,
    equipement: { casque: c.equipement?.casque }, pose: 'repos', temps: 0,
  });
}

function construireFiches() {
  const d = DIFFICULTES[session.difficulte] || DIFFICULTES.normal;
  session.presentations.forEach((c, i) => {
    const fiche = $(`#fiche-${i}`);
    fiche.innerHTML = `
      <canvas class="portrait"></canvas>
      <div class="fiche-infos">
        <div class="fiche-nom">${echapper(c.nom)} <small>Niv. ${c.niveau}${c.ia ? ` · Bot ${d.nom.toLowerCase()} ${d.icone}` : ''}</small>${i === session.monIndex ? '<em class="badge-toi">TOI</em>' : ''}</div>
        <div class="barre pv" title="Points de vie"><i></i><span></span></div>
        <div class="barre stamina" title="Stamina : esquives et attaques lourdes"><i></i><span></span></div>
        <div class="barre garde" title="Garde : encaisse les coups quand tu pares"><i></i><span></span></div>
      </div>`;
    dessinerPortrait(fiche.querySelector('canvas'), c);
  });
}

function majBarre(el, valeur, max, prefixe) {
  el.querySelector('i').style.width = `${max > 0 ? Math.max(0, Math.min(1, valeur / max)) * 100 : 0}%`;
  el.querySelector('span').textContent = `${prefixe} ${Math.max(0, Math.round(valeur))} / ${Math.round(max)}`;
}

function majFiches() {
  const combattants = [0, 1].map((i) => (i === session.monIndex ? session.moi : session.adversaireActuel()));
  combattants.forEach((c, i) => {
    const fiche = $(`#fiche-${i}`);
    if (!fiche.firstElementChild) return;
    majBarre(fiche.querySelector('.pv'), c.pv, c.stats.pvMax, '❤');
    majBarre(fiche.querySelector('.stamina'), c.stamina, c.stats.staminaMax, '⚡');
    majBarre(fiche.querySelector('.garde'), c.garde, c.stats.tr.gardeMax, '🛡');
    fiche.classList.toggle('critique', c.pv > 0 && c.pv < c.stats.pvMax * 0.25);
    fiche.classList.toggle('sonne', c.etat === 'etourdi' && c.sonne);
  });
}

// ----------------------------------------------------------------------------
//  Rappel des touches et recharges
// ----------------------------------------------------------------------------
function construireCommandes() {
  $('#combat-commandes').innerHTML = AIDE_TOUCHES.map((a) => `
    <span class="commande"><kbd>${a.touches}</kbd>${a.alt ? `<small>${a.alt}</small>` : ''} ${a.action}</span>`).join('');
  $('#combat-recharges').innerHTML = [
    ['legere', '🗡️', 'Légère'],
    ['lourde', '💥', 'Lourde'],
    ['esquive', '💨', 'Esquive'],
  ].map(([id, icone, nom]) => `<div class="recharge" data-recharge="${id}" title="${nom}"><i></i><span>${icone}</span><small>${nom}</small></div>`).join('');
}

function majRecharges() {
  const c = session.moi;
  const infos = {
    legere: { reste: c.recharges.legere, total: 0.2, cout: 0 },
    lourde: { reste: c.recharges.lourde, total: T.attaques.lourde.recharge / c.stats.tr.cadence, cout: c.stats.tr.coutLourde },
    esquive: { reste: c.recharges.esquive, total: T.esquive.recharge, cout: T.esquive.cout },
  };
  for (const [id, v] of Object.entries(infos)) {
    const el = document.querySelector(`[data-recharge="${id}"]`);
    if (!el) continue;
    const pret = v.reste <= 0 && c.stamina >= v.cout;
    el.classList.toggle('pret', pret);
    el.classList.toggle('fatigue', v.reste <= 0 && c.stamina < v.cout);
    el.querySelector('i').style.height = `${v.reste > 0 ? Math.min(1, v.reste / Math.max(0.01, v.total)) * 100 : 0}%`;
  }
}

// ----------------------------------------------------------------------------
//  Chrono, décompte, pause
// ----------------------------------------------------------------------------
function majCentre() {
  const e = session.dernier;
  const s = Math.ceil(e.tempsRestant);
  const chrono = $('#combat-chrono');
  chrono.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  chrono.classList.toggle('urgent', e.phase === 'combat' && s <= 15);

  // Décompte « 3, 2, 1 » puis « Combat ! » pendant un instant
  const d = $('#combat-decompte');
  const afficher = (texteDecompte) => {
    d.textContent = texteDecompte;
    d.hidden = false;
    d.classList.remove('anime'); void d.offsetWidth; d.classList.add('anime');
  };
  if (e.phase === 'decompte' && !e.pause) {
    const n = Math.max(1, Math.ceil(e.decompte));
    if (n !== dernierDecompte) { dernierDecompte = n; afficher(n); jouerSon('tic'); }
  } else if (e.phase === 'combat' && dernierDecompte !== null) {
    dernierDecompte = null;
    finMessage = performance.now() + 900;
    afficher('Combat !');
  } else if (e.pause || performance.now() > finMessage) {
    d.hidden = true;
  }

  const bandeau = $('#combat-attente');
  if (!etatReseau.connecte) {
    bandeau.hidden = false;
    bandeau.textContent = 'Connexion au serveur perdue… reconnexion en cours';
  } else if (e.pause && e.attente) {
    bandeau.hidden = false;
    const nom = session.presentations[e.attente.index].nom;
    const reste = Math.ceil(e.attente.tempsRestant / 1000);
    bandeau.textContent = e.attente.index === session.monIndex
      ? 'Reconnexion…'
      : `${nom} s’est déconnecté. Combat en pause : victoire automatique dans ${reste} s s’il ne revient pas.`;
  } else {
    bandeau.hidden = true;
  }
}

// ----------------------------------------------------------------------------
//  Événements envoyés par le serveur : textes, impacts, sons
// ----------------------------------------------------------------------------
function texte(txt, x, y, couleur, taille = 30) {
  vis.textes.push({ texte: txt, x, y, couleur, taille, debut: performance.now() });
}

function traiterEvenements(evenements) {
  const moi = session.monIndex;
  for (const ev of evenements) {
    switch (ev.type) {
      case 'debut':
        jouerSon('gong');
        break;
      case 'coup': {
        const lourde = ev.attaque === 'lourde';
        texte(`-${ev.degats}`, ev.x, ev.y + 40, ev.critique ? '#ffcf3a' : ev.cible === moi ? '#ff5a4a' : '#ffffff', ev.critique ? 44 : lourde ? 38 : 30);
        if (ev.critique) texte('CRITIQUE !', ev.x, ev.y + 85, '#ffcf3a', 24);
        vis.impacts.push({ x: ev.x, y: ev.y, couleur: ev.critique ? '#ffcf3a' : '#fff4d6', debut: performance.now() });
        vis.secousse = { amplitude: (lourde ? 12 : 5) + (ev.critique ? 6 : 0), debut: performance.now() };
        jouerSon(ev.critique ? 'critique' : 'coup');
        break;
      }
      case 'bloque':
        texte(ev.degats ? `Paré ! -${ev.degats}` : 'Paré !', ev.x, ev.y + 40, '#8fd0ff', 26);
        vis.impacts.push({ x: ev.x, y: ev.y, couleur: '#bfe3ff', debut: performance.now() });
        jouerSon('bouclier');
        break;
      case 'brise':
        texte('Garde brisée !', ev.x, ev.y + 50, '#ff8a4a', 30);
        vis.secousse = { amplitude: 10, debut: performance.now() };
        jouerSon('critique');
        break;
      case 'parfaite':
        texte('Parade parfaite !', ev.x, ev.y + 50, '#ffcf3a', 30);
        vis.impacts.push({ x: ev.x, y: ev.y, couleur: '#ffe79a', debut: performance.now() });
        jouerSon('bouclier');
        setTimeout(() => jouerSon('piece'), 90);
        break;
      case 'esquive':
        texte('Esquivé !', ev.x, ev.y + 40, '#ffffff', 26);
        jouerSon('rate');
        break;
      case 'chute':
        texte(CHUTES[ev.trou]?.cri || CHUTES.gouffre.cri, ev.x, 150, ev.trou === 'lave' ? '#ffb13a' : '#ff5a4a', 44);
        vis.secousse = { amplitude: 14, debut: performance.now() };
        jouerSon(ev.trou === 'lave' ? 'lave' : 'chute');
        break;
      case 'fin':
        if (ev.raison === 'ko') texte('K.O. !', T.arene.largeur / 2, 330, '#ff5a4a', 64);
        jouerSon('foule');
        break;
      default:
        break;
    }
  }
}

/** Petits sons de tes propres gestes, joués tout de suite (sans attendre le serveur) */
function sonsLocaux(c) {
  if (moiAvant) {
    if (c.etat === 'attaque' && moiAvant.etat !== 'attaque') jouerSon('rate');
    if (c.etat === 'esquive' && moiAvant.etat !== 'esquive') jouerSon('rate');
    if (c.sauts < moiAvant.sauts && !c.auSol) jouerSon('pas');
    if (c.auSol && !moiAvant.auSol) jouerSon('pas');
  }
  moiAvant = { etat: c.etat, sauts: c.sauts, auSol: c.auSol };
}

// ----------------------------------------------------------------------------
//  Réception des états du serveur
// ----------------------------------------------------------------------------
function recevoirEtat(etat) {
  if (!session || etat.idMatch !== session.idMatch) return;
  session.recevoir(etat);
  if (etat.ev?.length) traiterEvenements(etat.ev);
}

// ----------------------------------------------------------------------------
//  Fin du combat
// ----------------------------------------------------------------------------
// Tomber dans un trou : message selon le genre de trou
const CHUTES = {
  gouffre:  { cri: 'Chute mortelle !', gagne: 'Ton adversaire a disparu dans le gouffre !', perdu: 'Tu es tombé dans le gouffre…' },
  lave:     { cri: 'Englouti par la lave !', gagne: 'Ton adversaire a plongé dans la lave !', perdu: 'Tu as plongé dans la lave…' },
  crevasse: { cri: 'Avalé par la crevasse !', gagne: 'Ton adversaire a glissé dans la crevasse !', perdu: 'Tu as glissé dans la crevasse…' },
};

const RAISONS = {
  ko: (v) => (v ? 'Ton adversaire mord la poussière !' : 'Tu t’effondres dans le sable…'),
  chute: (v) => {
    const c = CHUTES[terrainDe(session?.arene).typeTrou] || CHUTES.gouffre;
    return v ? c.gagne : c.perdu;
  },
  juges: (v) => (v ? 'Temps écoulé : les juges te déclarent vainqueur.' : 'Temps écoulé : les juges donnent la victoire à ton adversaire.'),
  abandon: (v) => (v ? 'Ton adversaire a abandonné.' : 'Tu as abandonné le combat.'),
  deconnexion: (v) => (v ? 'Ton adversaire a quitté l’arène.' : 'Tu as été déconnecté trop longtemps.'),
};

function recevoirFin(r) {
  if (!session || r.idMatch !== session.idMatch) return;
  resultat = r;
  resultat.gain = appliquerResultat(r); // sauvegarde immédiate de la récompense
  arreterControles();
  setTimeout(afficherResultat, 700);
}

function afficherResultat() {
  if (!resultat || resultatAffiche || ecranCourant()?.nom !== 'combat') return;
  resultatAffiche = true;
  const r = resultat;
  const gain = r.recompense;
  jouerSon(r.victoire ? 'victoire' : 'defaite');
  jouerTheme(r.victoire ? 'triomphe' : 'lamento');
  const c = r.compteurs;
  const precision = c.attaques ? Math.round((c.touches / c.attaques) * 100) : 0;
  $('#combat-resultat').innerHTML = `
    <div class="parchemin resultat-carte ${r.victoire ? 'gagne' : 'perdu'}">
      <h2>${r.victoire ? 'Victoire !' : 'Défaite'}</h2>
      <p class="raison-fin">${RAISONS[r.raison]?.(r.victoire) || ''}</p>
      <p class="contre">contre ${echapper(r.adversaire)}${r.mode === 'ia' ? ` (bot ${(DIFFICULTES[r.difficulte] || DIFFICULTES.normal).nom.toLowerCase()})` : ''}</p>
      <div class="gains">
        <div>${prixHtml(`+${gain.credits}`)}<small>crédits${gain.bonus ? ` (dont ${gain.bonus} de bonus PV)` : ''}</small></div>
        <div><b>+${gain.points}</b><small>point${gain.points > 1 ? 's' : ''} de compétence</small></div>
      </div>
      <div class="stats-fin">
        <span>⚔ ${c.degats} dégâts infligés</span>
        <span>🎯 ${c.touches}/${c.attaques} coups portés (${precision} %)</span>
        <span>💥 ${c.critiques} critique${c.critiques > 1 ? 's' : ''}</span>
        <span>🛡 ${c.parfaites} parade${c.parfaites > 1 ? 's' : ''} parfaite${c.parfaites > 1 ? 's' : ''}</span>
      </div>
      <div class="rangee-boutons">
        ${boutonRejouer(r)}
        ${gain.points > 0 ? '<button class="btn" id="resultat-points">⚙ Répartir mes points</button>' : ''}
        <button class="btn" id="resultat-village">🏠 Village</button>
      </div>
    </div>`;
  $('#combat-resultat').hidden = false;
  $('#resultat-village').onclick = () => allerA('village');
  const bp = $('#resultat-points');
  if (bp) bp.onclick = () => allerA('parametres');
  const br = $('#resultat-rejouer');
  if (br) br.onclick = () => rejouer(r, br);
}

// ----------------------------------------------------------------------------
//  Rejouer sans repasser par le village
//  - contre un bot : nouveau combat tout de suite, même difficulté, arène au hasard
//  - contre un ami : on lui propose une revanche (il doit accepter)
// ----------------------------------------------------------------------------
function boutonRejouer(r) {
  if (r.mode === 'ia') {
    const d = DIFFICULTES[r.difficulte] || DIFFICULTES.normal;
    return `<button class="btn btn-or" id="resultat-rejouer">🔁 Rejouer <small>(bot ${d.nom.toLowerCase()} ${d.icone})</small></button>`;
  }
  return r.adversaireId ? '<button class="btn btn-or" id="resultat-rejouer">⚔ Revanche</button>' : '';
}

function rejouer(r, bouton) {
  if (!etatReseau.connecte) { notifier('Serveur injoignable : impossible de relancer un combat.', 'erreur'); return; }
  bouton.disabled = true;
  if (r.mode === 'ia') {
    bouton.textContent = 'Préparation du combat…';
    envoyer('match:training', { difficulte: r.difficulte || 'normal' });
  } else {
    bouton.textContent = '⏳ Revanche proposée…';
    defier(r.adversaireId);
  }
}

// ----------------------------------------------------------------------------
//  L'écran
// ----------------------------------------------------------------------------
export const ecranCombat = {
  nom: 'combat',
  section: 'ecran-combat',
  hud: false,
  musique: () => (resultatAffiche && resultat ? (resultat.victoire ? 'triomphe' : 'lamento') : 'combat'),

  initialiser() {
    construireCommandes();

    addEventListener('keydown', (e) => {
      if (ecranCourant()?.nom !== 'combat' || e.repeat) return;
      // Écran de résultat : Entrée = Rejouer
      if (!$('#combat-resultat').hidden) {
        const br = $('#resultat-rejouer');
        if (e.key === 'Enter' && br && !br.disabled) { e.preventDefault(); br.click(); }
      }
    });

    $('#combat-abandon').addEventListener('click', () => {
      if (!session || session.dernier.fini) return;
      if (confirm('Abandonner ce combat ? Il comptera comme une défaite.')) envoyer('match:forfeit');
    });

    // Onglet caché : on relâche toutes les touches côté serveur
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && session && ecranCourant()?.nom === 'combat') {
        session.seq += 1;
        envoyer('match:entrees', { e: [{ s: session.seq }] });
      }
    });

    surReseau('match:state', recevoirEtat);
    surReseau('match:end', recevoirFin);
    // Revanche refusée ou expirée : le bouton redevient cliquable
    surReseau('challenge:result', (d) => {
      const br = $('#resultat-rejouer');
      if (d.statut !== 'envoye' && br && br.disabled && resultat?.mode !== 'ia') {
        br.disabled = false;
        br.textContent = '⚔ Revanche';
      }
    });
    // Démarrage (ou reprise après une reconnexion) : on y va, où que l'on soit
    surReseau('match:start', (paquet) => allerA('combat', paquet, { fondu: ecranCourant()?.nom !== 'combat' }));
  },

  entrer(paquet) {
    const reprise = session && paquet.idMatch === session.idMatch;
    session = new SessionCombat(paquet);
    if (!reprise) {
      resultat = null;
      resultatAffiche = false;
      vis.textes = [];
      vis.impacts = [];
    }
    vis.arene = session.arene;
    vis.monIndex = session.monIndex;
    dernierT = null;
    dernierDecompte = null;
    moiAvant = null;
    $('#combat-resultat').hidden = !resultatAffiche;
    $('#combat-arene').textContent = ARENES[session.arene].nom;
    construireFiches();
    majFiches();
    majCentre();
    demarrerControles();
  },

  sortir() {
    arreterControles();
  },

  dessiner(ctx, w, h, t) {
    if (!session) return;
    const maintenant = performance.now();
    const dt = dernierT === null ? 0 : Math.min(0.1, (maintenant - dernierT) / 1000);
    dernierT = maintenant;

    // Tes touches → prédiction locale + envoi au serveur
    if (!resultat) {
      const lot = session.avancer(dt, lireEntree);
      if (lot.length) envoyer('match:entrees', { e: lot });
    }

    const moi = session.moiAffiche();
    sonsLocaux(moi);
    vis.combattants[session.monIndex] = moi;
    vis.combattants[1 - session.monIndex] = session.adversaireAffiche(maintenant);
    dessinerCombat(ctx, w, h, t, vis);

    // Barres et chrono ~15 fois par seconde (inutile de toucher la page à chaque image)
    if (maintenant - derniereMajHud > 66) {
      derniereMajHud = maintenant;
      majFiches();
      majRecharges();
      majCentre();
    }
  },
};

export const combatEnCours = () => !!(session && !session.dernier.fini);
/** Pour déboguer depuis la console : la session de combat en cours */
export const sessionCourante = () => session;
