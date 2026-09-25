// ============================================================================
//  ARENA GLADIUS — client/js/defis.js
//
//  - liste des gladiateurs en ligne (village et Colisée) avec bouton « Défier »
//  - fenêtre « X te défie ! » avec Accepter / Refuser
//  - bandeau « défi envoyé, en attente… » avec Annuler
//  - résultats de combats remis au retour (après une déconnexion)
// ============================================================================

import { ARENES } from '/shared/data.js';
import { $, echapper, notifier } from './ui.js';
import { envoyer, surReseau, etatReseau, reseauDisponible } from './reseau.js';
import { appliquerResultat } from './recompenses.js';
import { lirePerso } from './etat.js';
import { jouerSon } from './audio.js';
import { dessinerGladiateur } from './rendu/gladiateur.js';

let defiRecu = null;      // { idDefi, de, arene, fin }
let defiEnvoye = null;    // { idDefi, fin }
let minuteurRecu = null;
const listes = new Set(); // conteneurs de listes de joueurs à tenir à jour

// ----------------------------------------------------------------------------
//  Liste des joueurs en ligne
// ----------------------------------------------------------------------------
function portrait(canvas, j) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = 40 * dpr;
  canvas.height = 40 * dpr;
  const p = canvas.getContext('2d');
  p.setTransform(dpr, 0, 0, dpr, 0, 0);
  dessinerGladiateur(p, {
    x: 17, y: 118, echelle: 0.88, direction: 1, skin: j.skin,
    equipement: { casque: j.equipement?.casque }, pose: 'repos', temps: 0,
  });
}

function rendreListe(conteneur) {
  const joueurs = etatReseau.joueurs;
  let html;
  if (!reseauDisponible() || !etatReseau.connecte) {
    html = '<p class="vide">Serveur injoignable pour le moment…</p>';
  } else if (!etatReseau.accepte) {
    html = '<p class="vide">Ton gladiateur n’a pas été accepté par le serveur (sauvegarde incohérente).</p>';
  } else if (!joueurs.length) {
    html = `<p class="vide">Personne d’autre en ligne pour l’instant.<br>
      <small>Envoie l’adresse du jeu à tes amis, ou ouvre un 2e onglet avec <code>?profil=2</code> pour tester.</small></p>`;
  } else {
    html = joueurs.map((j) => {
      const occupe = j.statut !== 'libre';
      const attente = defiEnvoye?.cible === j.id;
      return `
        <div class="joueur-en-ligne">
          <canvas data-portrait="${j.id}"></canvas>
          <div class="joueur-infos"><b>${echapper(j.nom)}</b><small>Niv. ${j.niveau}${occupe ? ' · <span class="occupe">en combat</span>' : ''}</small></div>
          <button class="btn petit btn-or" data-defier="${j.id}" ${occupe || defiEnvoye ? 'disabled' : ''}>
            ${attente ? '⏳' : '⚔ Défier'}
          </button>
        </div>`;
    }).join('');
  }
  conteneur.innerHTML = html;
  conteneur.querySelectorAll('canvas[data-portrait]').forEach((c) => {
    const j = joueurs.find((x) => x.id === c.dataset.portrait);
    if (j) portrait(c, j);
  });
  conteneur.onclick = (e) => {
    const b = e.target.closest('button[data-defier]');
    if (b && !b.disabled) defier(b.dataset.defier, conteneur.dataset.arene || null);
  };
}

/** Tient à jour une liste de joueurs dans ce conteneur (arene = arène tirée, facultatif) */
export function brancherListe(conteneur, arene = null) {
  if (arene) conteneur.dataset.arene = arene; else delete conteneur.dataset.arene;
  listes.add(conteneur);
  rendreListe(conteneur);
}

function rafraichirListes() {
  listes.forEach((c) => { if (c.isConnected) rendreListe(c); });
  const compte = $('#village-nb-joueurs');
  if (compte) compte.textContent = etatReseau.joueurs.length;
}

// ----------------------------------------------------------------------------
//  Défis envoyés
// ----------------------------------------------------------------------------
export function defier(idCible, arene = null) {
  if (!lirePerso()) return;
  if (!envoyer('challenge:send', { cible: idCible, arene })) {
    notifier('Serveur injoignable.', 'erreur');
    return;
  }
  defiEnvoye = { idDefi: null, cible: idCible, fin: null };
  rafraichirListes();
}

function majBandeauEnvoye() {
  const b = $('#defi-envoye');
  if (!defiEnvoye?.idDefi) { b.hidden = true; return; }
  b.hidden = false;
  const reste = Math.max(0, Math.ceil((defiEnvoye.fin - Date.now()) / 1000));
  b.querySelector('span').textContent = `${defiEnvoye.message} (${reste} s)`;
}

// ----------------------------------------------------------------------------
//  Défi reçu
// ----------------------------------------------------------------------------
function fermerDefiRecu() {
  defiRecu = null;
  clearInterval(minuteurRecu);
  $('#modal-defi').hidden = true;
}

function afficherDefiRecu(d) {
  defiRecu = { ...d, fin: Date.now() + d.duree };
  const lieu = d.arene ? ` dans l’<b>${echapper(ARENES[d.arene].nom)}</b>` : '';
  $('#modal-defi-texte').innerHTML = `<b>${echapper(d.de.nom)}</b> (niveau ${d.de.niveau}) te provoque en duel${lieu} !`;
  $('#modal-defi').hidden = false;
  jouerSon('defi');
  clearInterval(minuteurRecu);
  const maj = () => {
    const reste = Math.max(0, defiRecu.fin - Date.now());
    $('#modal-defi-barre').style.width = `${(reste / d.duree) * 100}%`;
    if (reste <= 0) fermerDefiRecu();
  };
  maj();
  minuteurRecu = setInterval(maj, 200);
}

// ----------------------------------------------------------------------------
//  Branchements
// ----------------------------------------------------------------------------
export function initialiserDefis() {
  surReseau('lobby:update', rafraichirListes);
  surReseau('reseau:changement', rafraichirListes);

  surReseau('challenge:incoming', afficherDefiRecu);
  surReseau('challenge:result', (r) => {
    if (r.statut === 'envoye') {
      defiEnvoye = { ...defiEnvoye, idDefi: r.idDefi, fin: Date.now() + r.duree, message: r.message };
    } else {
      if (defiRecu && defiRecu.idDefi === r.idDefi) fermerDefiRecu();
      if (defiEnvoye && (defiEnvoye.idDefi === r.idDefi || !defiEnvoye.idDefi)) defiEnvoye = null;
      notifier(r.message, r.statut === 'indisponible' ? 'erreur' : 'info');
    }
    majBandeauEnvoye();
    rafraichirListes();
  });
  surReseau('match:start', () => {
    fermerDefiRecu();
    defiEnvoye = null;
    majBandeauEnvoye();
  });

  $('#modal-defi-accepter').addEventListener('click', () => {
    if (defiRecu) envoyer('challenge:response', { idDefi: defiRecu.idDefi, accepte: true });
    fermerDefiRecu();
  });
  $('#modal-defi-refuser').addEventListener('click', () => {
    if (defiRecu) envoyer('challenge:response', { idDefi: defiRecu.idDefi, accepte: false });
    fermerDefiRecu();
  });
  $('#defi-envoye-annuler').addEventListener('click', () => {
    if (defiEnvoye?.idDefi) envoyer('challenge:cancel', { idDefi: defiEnvoye.idDefi });
  });
  setInterval(majBandeauEnvoye, 500);

  // Combats terminés pendant une absence : on applique les récompenses au retour
  surReseau('player:accepted', ({ resultats }) => {
    for (const r of resultats || []) {
      const gain = appliquerResultat(r);
      if (gain) notifier(`Combat contre ${r.adversaire} : ${r.victoire ? 'victoire' : 'défaite'} (+${gain.credits} crédits, +${gain.points} pt).`, 'info');
    }
  });
  surReseau('player:refused', ({ erreurs }) => {
    notifier(`Le serveur refuse ce gladiateur : ${erreurs[0]}`, 'erreur');
  });
  surReseau('session:remplacee', () => {
    notifier('Ce gladiateur vient d’être ouvert dans un autre onglet : celui-ci ne peut plus combattre.', 'erreur');
  });
}
