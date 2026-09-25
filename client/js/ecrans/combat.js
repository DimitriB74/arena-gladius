// ============================================================================
//  ARENA GLADIUS — écran de combat
//
//  Le serveur fait autorité : ce module n'envoie que des intentions
//  (« je veux attaquer ») et affiche les états reçus (match:state) en
//  animant les événements un par un (déplacement, coup, raté...).
// ============================================================================

import { ACTIONS, ORDRE_ACTIONS, COMBAT, ARENES, DIFFICULTES } from '/shared/data.js';
import { chanceToucher, degatsEstimes, aPortee } from '/shared/formulas.js';
import { $, echapper, notifier, prixHtml } from '../ui.js';
import { allerA, ecranCourant } from '../navigation.js';
import { envoyer, surReseau, etatReseau } from '../reseau.js';
import { appliquerResultat } from '../recompenses.js';
import { jouerSon } from '../audio.js';
import { jouerTheme } from '../musique.js';
import { dessinerCombat } from '../rendu/combat.js';
import { dessinerGladiateur } from '../rendu/gladiateur.js';

const ICONES = {
  avancer: '➜', reculer: '➜', charger: '⇶', rapide: '🗡️', normale: '⚔️', puissante: '💥',
  proteger: '🛡️', reposer: '💤', provoquer: '😤',
};
const GROUPES = [
  { titre: 'Déplacement', actions: ['avancer', 'reculer', 'charger'] },
  { titre: 'Attaques', actions: ['rapide', 'normale', 'puissante'] },
  { titre: 'Tactique', actions: ['proteger', 'reposer', 'provoquer'] },
];

// ----------------------------------------------------------------------------
//  État de l'écran
// ----------------------------------------------------------------------------
let idMatch = null;
let monIndex = 0;
let mode = 'joueur';
let difficulte = null;
let etat = null;            // dernier état appliqué
let file = [];              // états reçus pas encore animés
let anim = null;            // animation en cours
let finTour = null;         // échéance locale du tour (ms)
let attente = null;         // { index, fin } si quelqu'un est déconnecté
let resultat = null;        // reçu avec match:end
let resultatAffiche = false;
let dernierTic = null;
let survolAction = null;
const vis = { arene: 'colisee', combattants: [], textes: [], secousse: null, tour: 0, monIndex: 0, fini: false, surbrillance: null };

const monTour = () => etat && !etat.fini && etat.tour === monIndex && !anim && file.length === 0 && !attente;

// ----------------------------------------------------------------------------
//  Fiches des combattants (barres PV / stamina / bouclier)
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
  etat.combattants.forEach((c, i) => {
    const fiche = $(`#fiche-${i}`);
    fiche.innerHTML = `
      <canvas class="portrait"></canvas>
      <div class="fiche-infos">
        <div class="fiche-nom">${echapper(c.nom)} <small>Niv. ${c.niveau}${c.ia ? ` · Bot ${(DIFFICULTES[difficulte] || DIFFICULTES.normal).nom.toLowerCase()} ${(DIFFICULTES[difficulte] || DIFFICULTES.normal).icone}` : ''}</small>${i === monIndex ? '<em class="badge-toi">TOI</em>' : ''}</div>
        <div class="barre pv" title="Points de vie"><i></i><span></span></div>
        <div class="barre stamina" title="Stamina"><i></i><span></span></div>
        <div class="barre bouclier" title="Bouclier"><i></i><span></span></div>
      </div>`;
    dessinerPortrait(fiche.querySelector('canvas'), c);
  });
}

function majBarre(el, valeur, max, prefixe) {
  el.querySelector('i').style.width = `${max > 0 ? (valeur / max) * 100 : 0}%`;
  el.querySelector('span').textContent = `${prefixe} ${Math.round(valeur)} / ${max}`;
}

function majFiches(e, avecTour = false) {
  e.combattants.forEach((c, i) => {
    const fiche = $(`#fiche-${i}`);
    majBarre(fiche.querySelector('.pv'), c.pv, c.stats.pvMax, '❤');
    majBarre(fiche.querySelector('.stamina'), c.stamina, c.stats.staminaMax, '⚡');
    majBarre(fiche.querySelector('.bouclier'), c.bouclier, c.stats.bouclierMax, '◉');
    if (avecTour) fiche.classList.toggle('actif', !e.fini && e.tour === i);
    fiche.classList.toggle('critique', c.pv > 0 && c.pv < c.stats.pvMax * 0.25);
  });
}

// ----------------------------------------------------------------------------
//  Barre d'actions
// ----------------------------------------------------------------------------
function construireActions() {
  $('#combat-actions').innerHTML = GROUPES.map((g) => `
    <div class="groupe-actions">
      <span class="titre-groupe">${g.titre}</span>
      <div>${g.actions.map((id) => `
        <button class="action" data-action="${id}">
          <span class="action-icone">${ICONES[id]}</span>
          <span class="action-nom">${ACTIONS[id].nom}</span>
          <span class="action-cout">⚡<b></b></span>
          <kbd>${ACTIONS[id].touche}</kbd>
        </button>`).join('')}</div>
    </div>`).join('');
}

function majActions() {
  const possibles = etat?.possibles || {};
  const actif = monTour();
  document.querySelectorAll('#combat-actions .action').forEach((b) => {
    const id = b.dataset.action;
    const info = possibles[id];
    b.disabled = !actif || !info?.possible;
    b.querySelector('.action-cout b').textContent = info ? info.cout : ACTIONS[id].cout;
  });
  // Les flèches pointent vers l'adversaire (ou à l'opposé pour reculer)
  const versDroite = monIndex === 0;
  const av = document.querySelector('#combat-actions [data-action="avancer"] .action-icone');
  const re = document.querySelector('#combat-actions [data-action="reculer"] .action-icone');
  if (av) av.style.transform = versDroite ? 'none' : 'scaleX(-1)';
  if (re) re.style.transform = versDroite ? 'scaleX(-1)' : 'none';
  $('#combat-actions').classList.toggle('mon-tour', actif);
}

function texteInfobulle(id) {
  const a = ACTIONS[id];
  const info = etat?.possibles?.[id];
  const moi = etat.combattants[monIndex], lui = etat.combattants[1 - monIndex];
  let details = '';
  if (a.type === 'attaque' || a.type === 'charge') {
    const attaque = a.type === 'charge' ? a.attaque : id;
    const chance = chanceToucher(attaque, moi.stats, lui.stats);
    const degats = degatsEstimes(attaque, moi.stats, lui.stats, lui.protege);
    details = `<p class="chiffres">🎯 ${chance} % de toucher · ⚔ ≈ ${degats} dégâts${lui.protege ? ' (garde adverse)' : ''}</p>`;
  }
  const raison = info && !info.possible && etat.tour === monIndex ? `<p class="raison">⛔ ${echapper(info.raison)}</p>` : '';
  return `<strong>${a.nom}</strong> <span class="cout">⚡ ${info ? info.cout : a.cout}</span>
    <p>${echapper(a.description)}</p>${details}${raison}`;
}

function surbrillancePour(id) {
  if (!etat || !id) return null;
  const a = ACTIONS[id];
  const moi = etat.combattants[monIndex];
  if (a.type === 'attaque') {
    const cases = [];
    for (let c = 1; c <= COMBAT.nbCases; c++) if (aPortee(moi.stats.arme, Math.abs(c - moi.position))) cases.push(c);
    return { cases, couleur: 'rgba(200,40,30,0.35)' };
  }
  if (a.type === 'deplacement') {
    const sens = Math.sign(etat.combattants[1 - monIndex].position - moi.position) * a.pas;
    return { cases: [moi.position + sens], couleur: 'rgba(242,182,50,0.55)' };
  }
  return null;
}

function jouer(id) {
  if (!monTour()) return;
  const info = etat.possibles?.[id];
  if (!info?.possible) {
    if (info?.raison) notifier(info.raison, 'erreur');
    return;
  }
  jouerSon('clic');
  envoyer('match:action', { action: id });
  // On bloque les boutons en attendant la réponse du serveur
  document.querySelectorAll('#combat-actions .action').forEach((b) => { b.disabled = true; });
  $('#combat-actions').classList.remove('mon-tour');
}

// ----------------------------------------------------------------------------
//  Journal et bandeau de tour
// ----------------------------------------------------------------------------
function majJournal(e) {
  const j = $('#combat-journal');
  j.innerHTML = e.journal.slice(-14).map((l) => {
    const camp = l.acteur == null ? '' : l.acteur === monIndex ? 'moi' : 'lui';
    return `<p class="${l.type} ${camp}">${echapper(l.texte)}</p>`;
  }).join('');
  j.scrollTop = j.scrollHeight;
}

function majBandeau() {
  const b = $('#combat-tour');
  if (!etat) return;
  if (etat.fini) {
    b.textContent = etat.vainqueur === monIndex ? 'Victoire !' : 'Défaite…';
    b.className = 'bandeau-tour fin';
  } else if (attente) {
    b.textContent = 'En attente…';
    b.className = 'bandeau-tour';
  } else if (etat.tour === monIndex) {
    b.textContent = 'À toi de jouer !';
    b.className = 'bandeau-tour moi';
  } else {
    b.textContent = `Tour de ${etat.combattants[etat.tour].nom}…`;
    b.className = 'bandeau-tour';
  }
  $('#combat-manche').textContent = `Manche ${etat.manche} / ${COMBAT.manchesMax}`;
}

function majAttente(a) {
  attente = a ? { index: a.index, fin: performance.now() + a.tempsRestant } : null;
  $('#combat-attente').hidden = !attente;
}

// ----------------------------------------------------------------------------
//  Application des états et animations
// ----------------------------------------------------------------------------
function poseAuRepos(c, i, e) {
  if (e.fini) return e.vainqueur === i ? 'victoire' : 'ko';
  return c.protege ? 'protege' : 'repos';
}

function appliquerEtat(paquet) {
  etat = paquet.etat;
  vis.arene = etat.arene;
  vis.tour = etat.tour;
  vis.fini = etat.fini;
  etat.combattants.forEach((c, i) => {
    const v = vis.combattants[i];
    v.x = c.position;
    v.protege = c.protege;
    v.pose = poseAuRepos(c, i, etat);
    v.avancement = 0;
    v.decalage = 0;
  });
  if (paquet.tempsRestant != null) finTour = performance.now() + paquet.tempsRestant;
  else if (etat.fini) finTour = null;
  majAttente(paquet.attente);
  majFiches(etat, true);
  majJournal(etat);
  majBandeau();
  majActions();
  if (etat.tour === monIndex && !etat.fini && !attente) jouerSon('tic');
  if (etat.fini) setTimeout(afficherResultat, 1400);
}

const DUREES = { deplacement: 450, charge: 1000, attaque: 750, protection: 600, repos: 650, provocation: 800 };

function demarrerAnimation(paquet) {
  const ev = paquet.evenement;
  anim = { paquet, ev, debut: performance.now(), duree: DUREES[ev.type] || 500, impact: false };
  majActions();
  if (ev.type === 'deplacement' || ev.type === 'charge') jouerSon('pas');
  if (ev.auto) ajouterTexte(ev.acteur, '⏳ Temps écoulé', '#f3e2bb', 22, 40);
}

function ajouterTexte(index, texte, couleur, taille = 30, dy = 0) {
  const v = vis.combattants[index];
  vis.textes.push({ texte, x: v.x, dy, couleur, taille, debut: performance.now() });
}

/** Moment de l'impact : chiffres, sons, secousse, barres mises à jour */
function impact(anim) {
  const { ev, paquet } = anim;
  const cible = 1 - ev.acteur;
  const vCible = vis.combattants[cible];
  if (ev.type === 'attaque' || ev.type === 'charge') {
    if (ev.touche) {
      ajouterTexte(cible, `-${ev.degats}`, ev.critique ? '#ffcf3a' : '#ff5a4a', ev.critique ? 46 : 36);
      if (ev.critique) ajouterTexte(cible, 'CRITIQUE !', '#ffcf3a', 26, 48);
      if (ev.absorbe) ajouterTexte(cible, `◉ ${ev.absorbe} absorbés`, '#8fd0ff', 18, -34);
      vCible.impact = { debut: performance.now(), couleur: ev.critique ? '#ffcf3a' : '#fff4d6' };
      vis.secousse = { amplitude: ev.critique ? 14 : 6, debut: performance.now() };
      jouerSon(ev.critique ? 'critique' : 'coup');
      if (ev.ko) setTimeout(() => jouerSon('foule'), 250);
    } else {
      ajouterTexte(cible, 'Raté !', '#ffffff', 32);
      vCible.esquive = performance.now();
      jouerSon('rate');
    }
  } else if (ev.type === 'protection') {
    ajouterTexte(ev.acteur, ev.bouclier ? `◉ +${ev.bouclier}` : 'En garde !', '#8fd0ff', 30);
    jouerSon('bouclier');
  } else if (ev.type === 'repos') {
    ajouterTexte(ev.acteur, `⚡ +${ev.stamina}`, '#ffd766', 30);
    jouerSon('repos');
  } else if (ev.type === 'provocation') {
    ajouterTexte(ev.acteur, 'Provocation !', '#f3e2bb', 24, 30);
    ajouterTexte(cible, ev.reussi ? `⚡ -${ev.perte}` : 'Ignorée', ev.reussi ? '#ffd766' : '#dddddd', 28);
  }
  majFiches(paquet.etat);
}

/** Avance l'animation en cours (appelé à chaque image) */
function animer() {
  if (!anim) return;
  const p = Math.min(1, (performance.now() - anim.debut) / anim.duree);
  const { ev } = anim;
  const v = vis.combattants[ev.acteur];

  if (ev.type === 'deplacement') {
    v.x = ev.de + (ev.vers - ev.de) * p;
    v.pose = 'marche';
    v.avancement = (p * 2) % 1;
    if (p >= 0.5 && !anim.impact) { anim.impact = true; majFiches(anim.paquet.etat); }
  } else if (ev.type === 'charge') {
    const pm = Math.min(1, p / 0.35);
    v.x = ev.de + (ev.vers - ev.de) * pm;
    if (p < 0.35) { v.pose = 'marche'; v.avancement = (pm * 3) % 1; } else { v.pose = 'attaque'; v.avancement = (p - 0.35) / 0.65; }
    if (p >= 0.75 && !anim.impact) { anim.impact = true; impact(anim); }
  } else if (ev.type === 'attaque') {
    v.pose = 'attaque';
    v.avancement = p;
    if (p >= 0.55 && !anim.impact) { anim.impact = true; impact(anim); }
  } else if (ev.type === 'protection') {
    v.pose = 'protege';
    v.protege = p > 0.3;
    if (p >= 0.3 && !anim.impact) { anim.impact = true; impact(anim); }
  } else if (ev.type === 'repos') {
    v.pose = 'repos';
    if (p >= 0.2 && !anim.impact) { anim.impact = true; impact(anim); }
  } else if (ev.type === 'provocation') {
    v.pose = 'victoire';
    if (p >= 0.3 && !anim.impact) { anim.impact = true; impact(anim); }
  }

  // Petit pas de côté quand on esquive
  vis.combattants.forEach((c, i) => {
    if (!c.esquive) return;
    const pe = (performance.now() - c.esquive) / 400;
    c.decalage = pe < 1 ? Math.sin(pe * Math.PI) * 0.25 * (i === 0 ? -1 : 1) : 0;
    if (pe >= 1) c.esquive = null;
  });

  if (p >= 1) {
    if (!anim.impact) impact(anim);
    const paquet = anim.paquet;
    anim = null;
    appliquerEtat(paquet);
    traiterSuivant();
  }
}

function traiterSuivant() {
  while (!anim && file.length) {
    const paquet = file.shift();
    const ev = paquet.evenement;
    if (ev && DUREES[ev.type]) demarrerAnimation(paquet);
    else {
      if (ev?.type === 'attente') notifier(`${paquet.etat.combattants[ev.acteur].nom} s’est déconnecté…`, 'info');
      if (ev?.type === 'retour') notifier(`${paquet.etat.combattants[ev.acteur].nom} est de retour !`, 'succes');
      appliquerEtat(paquet);
    }
  }
}

function recevoirEtat(paquet) {
  if (paquet.idMatch !== idMatch) return;
  file.push(paquet);
  if (document.hidden) toutAppliquer();
  else traiterSuivant();
}

/**
 * Termine tout de suite les animations en attente. Utile quand l'onglet est
 * en arrière-plan : le navigateur n'y dessine plus rien, les animations
 * resteraient bloquées et le joueur ne pourrait plus jouer à son retour.
 */
function toutAppliquer() {
  if (anim) {
    if (!anim.impact) majFiches(anim.paquet.etat);
    file.unshift(anim.paquet);
    anim = null;
  }
  const dernier = file.pop();
  file = [];
  vis.textes = [];
  if (dernier) appliquerEtat(dernier);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) toutAppliquer(); });
// Filet de sécurité : si une animation dure anormalement longtemps, on la termine
setInterval(() => {
  if (anim && performance.now() - anim.debut > anim.duree + 1200) toutAppliquer();
}, 400);

// ----------------------------------------------------------------------------
//  Fin du combat
// ----------------------------------------------------------------------------
const RAISONS = {
  ko: (v) => (v ? 'Ton adversaire mord la poussière !' : 'Tu t’effondres dans le sable…'),
  juges: (v) => (v ? 'Les juges te déclarent vainqueur.' : 'Les juges donnent la victoire à ton adversaire.'),
  abandon: (v) => (v ? 'Ton adversaire a abandonné.' : 'Tu as abandonné le combat.'),
  deconnexion: (v) => (v ? 'Ton adversaire a quitté l’arène.' : 'Tu as été déconnecté trop longtemps.'),
};

function recevoirFin(r) {
  if (r.idMatch !== idMatch) return;
  resultat = r;
  resultat.gain = appliquerResultat(r); // sauvegarde immédiate de la récompense
  if (etat?.fini && !anim && file.length === 0) setTimeout(afficherResultat, 1400);
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
      </div>
      <div class="rangee-boutons">
        ${gain.points > 0 ? '<button class="btn" id="resultat-points">⚙ Répartir mes points</button>' : ''}
        <button class="btn btn-or" id="resultat-village">🏠 Retour au village</button>
      </div>
    </div>`;
  $('#combat-resultat').hidden = false;
  $('#resultat-village').onclick = () => allerA('village');
  const bp = $('#resultat-points');
  if (bp) bp.onclick = () => allerA('parametres');
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
    construireActions();
    const barre = $('#combat-actions');
    barre.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-action]');
      if (b) jouer(b.dataset.action);
    });
    const bulle = $('#combat-infobulle');
    barre.addEventListener('mouseover', (e) => {
      const b = e.target.closest('button[data-action]');
      if (!b || !etat) return;
      survolAction = b.dataset.action;
      bulle.innerHTML = texteInfobulle(survolAction);
      bulle.hidden = false;
      const r = b.getBoundingClientRect();
      bulle.style.left = `${Math.max(8, Math.min(innerWidth - 300, r.left + r.width / 2 - 140))}px`;
      bulle.style.bottom = `${innerHeight - r.top + 10}px`;
    });
    barre.addEventListener('mouseleave', () => { bulle.hidden = true; survolAction = null; });

    addEventListener('keydown', (e) => {
      if (ecranCourant()?.nom !== 'combat' || e.repeat || e.target.tagName === 'INPUT') return;
      const touche = e.key.toUpperCase();
      let id = ORDRE_ACTIONS.find((a) => ACTIONS[a].touche === touche);
      if (e.key === 'ArrowRight') id = monIndex === 0 ? 'avancer' : 'reculer';
      if (e.key === 'ArrowLeft') id = monIndex === 0 ? 'reculer' : 'avancer';
      if (id) { e.preventDefault(); jouer(id); }
    });

    $('#combat-abandon').addEventListener('click', () => {
      if (etat?.fini) return;
      if (confirm('Abandonner ce combat ? Il comptera comme une défaite.')) envoyer('match:forfeit');
    });

    surReseau('match:state', recevoirEtat);
    surReseau('match:end', recevoirFin);
    surReseau('match:error', ({ message }) => { notifier(message, 'erreur'); majActions(); });
    // Démarrage (ou reprise après une reconnexion) : on y va, où que l'on soit
    surReseau('match:start', (paquet) => allerA('combat', paquet, { fondu: ecranCourant()?.nom !== 'combat' }));
  },

  entrer(paquet) {
    const reprise = paquet.idMatch === idMatch;
    idMatch = paquet.idMatch;
    monIndex = paquet.monIndex;
    mode = paquet.mode;
    difficulte = paquet.difficulte || null;
    file = [];
    anim = null;
    if (!reprise) {
      resultat = null;
      resultatAffiche = false;
      vis.textes = [];
    }
    vis.monIndex = monIndex;
    vis.combattants = paquet.etat.combattants.map((c) => ({
      skin: c.skin, equipement: c.equipement, x: c.position, pose: 'repos', avancement: 0, protege: false, decalage: 0,
    }));
    etat = paquet.etat;
    $('#combat-resultat').hidden = true;
    $('#combat-arene').textContent = ARENES[etat.arene].nom;
    construireFiches();
    appliquerEtat(paquet);
    if (!reprise) {
      const [a, b] = etat.combattants;
      const intro = $('#combat-intro');
      intro.innerHTML = `<span>${echapper(a.nom)}</span><b>VS</b><span>${echapper(b.nom)}</span>`;
      intro.classList.remove('visible');
      void intro.offsetWidth;
      intro.classList.add('visible');
      jouerSon('gong');
    }
  },

  sortir() {
    $('#combat-infobulle').hidden = true;
  },

  dessiner(ctx, w, h, t) {
    if (!etat) return;
    animer();
    vis.surbrillance = monTour() ? surbrillancePour(survolAction) : null;
    dessinerCombat(ctx, w, h, t, vis);

    // Minuteur du tour
    const m = $('#combat-minuteur');
    if (finTour && !etat.fini && !attente) {
      const reste = Math.max(0, (finTour - performance.now()) / 1000);
      const s = Math.ceil(reste);
      m.hidden = false;
      m.style.setProperty('--p', `${(reste / COMBAT.dureeTour) * 360}deg`);
      m.querySelector('span').textContent = s;
      m.classList.toggle('urgent', s <= 5);
      if (s <= 5 && s > 0 && s !== dernierTic && etat.tour === monIndex) { dernierTic = s; jouerSon('tic'); }
    } else {
      m.hidden = true;
    }
    if (attente) {
      const reste = Math.max(0, Math.ceil((attente.fin - performance.now()) / 1000));
      const nom = etat.combattants[attente.index].nom;
      $('#combat-attente').textContent = attente.index === monIndex
        ? 'Connexion perdue… reconnexion en cours'
        : `${nom} s’est déconnecté. Victoire automatique dans ${reste} s s’il ne revient pas.`;
    }
    if (!etatReseau.connecte) {
      $('#combat-attente').hidden = false;
      $('#combat-attente').textContent = 'Connexion au serveur perdue… reconnexion en cours';
    } else if (!attente) {
      $('#combat-attente').hidden = true;
    }
  },
};

export const combatEnCours = () => !!(idMatch && etat && !etat.fini);
