// ============================================================================
//  ARENA GLADIUS — client/js/reseau.js
//
//  Connexion Socket.IO (même origine que la page, aucune URL codée en dur).
//  - rejoint le lobby dès qu'un gladiateur est chargé, et le met à jour
//    à chaque changement (achat, points...)
//  - garde la liste des joueurs en ligne
//  - relaie les événements du serveur aux écrans
// ============================================================================

import { lirePerso, surChangement } from './etat.js';
import { nomProfil } from './sauvegarde.js';

// Jeton secret de ce navigateur (un par profil). Il sert à retrouver son combat
// après un rechargement ou une fermeture d'onglet, et à recevoir les récompenses
// d'un combat terminé pendant son absence. Il n'est jamais montré aux autres joueurs.
function lireJeton() {
  const cle = `arena-gladius:jeton${nomProfil() ? `:${nomProfil()}` : ''}`;
  try {
    let j = localStorage.getItem(cle);
    if (!j) {
      j = Array.from(crypto.getRandomValues(new Uint8Array(16)), (o) => o.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(cle, j);
    }
    return j;
  } catch {
    return `tmp${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

const jeton = lireJeton();
const socket = window.io ? window.io() : null;
const auditeurs = new Map();

export const etatReseau = {
  connecte: false,
  accepte: false,     // le serveur a validé notre gladiateur
  monId: null,        // identifiant public dans le lobby
  joueurs: [],        // liste des joueurs en ligne (sans nous)
  connectes: 0,       // nombre de navigateurs ouverts
};

function prevenir(evenement, donnees) {
  (auditeurs.get(evenement) || []).forEach((f) => f(donnees));
}

/** S'abonne à un événement (serveur ou interne : 'reseau:changement') */
export function surReseau(evenement, fn) {
  if (!auditeurs.has(evenement)) auditeurs.set(evenement, []);
  auditeurs.get(evenement).push(fn);
}

// Outil de test : ?latence=120 dans l'adresse simule un réseau lent (120 ms aller-retour)
const LATENCE = Math.min(1000, Math.max(0, Number(new URLSearchParams(location.search).get('latence')) || 0));
const retarder = (fn) => (LATENCE ? setTimeout(fn, LATENCE / 2) : fn());

export function envoyer(evenement, donnees = {}) {
  if (!socket || !socket.connected) return false;
  retarder(() => socket.emit(evenement, donnees));
  return true;
}

let minuteurJoin = null;
function rejoindre() {
  clearTimeout(minuteurJoin);
  minuteurJoin = setTimeout(() => {
    const perso = lirePerso();
    if (perso) envoyer('player:join', { jeton, perso });
  }, 150);
}

if (socket) {
  socket.on('connect', () => {
    etatReseau.connecte = true;
    rejoindre();
    prevenir('reseau:changement');
  });
  socket.on('disconnect', () => {
    etatReseau.connecte = false;
    etatReseau.accepte = false;
    prevenir('reseau:changement');
  });
  socket.on('serveur:info', ({ connectes }) => {
    etatReseau.connectes = connectes;
    prevenir('reseau:changement');
  });
  socket.on('player:accepted', (d) => {
    etatReseau.accepte = true;
    etatReseau.monId = d.id;
    prevenir('reseau:changement');
    prevenir('player:accepted', d);
  });
  socket.on('player:refused', (d) => {
    etatReseau.accepte = false;
    prevenir('reseau:changement');
    prevenir('player:refused', d);
  });
  socket.on('lobby:update', (liste) => {
    etatReseau.joueurs = liste.filter((j) => j.id !== etatReseau.monId);
    prevenir('lobby:update', etatReseau.joueurs);
  });
  for (const ev of ['challenge:incoming', 'challenge:result', 'match:start', 'match:state', 'match:error', 'match:end', 'session:remplacee']) {
    socket.on(ev, (d) => retarder(() => prevenir(ev, d)));
  }
}

// Chaque changement du gladiateur est envoyé au serveur (sauf s'il est effacé)
surChangement((perso) => {
  if (perso) rejoindre();
  else etatReseau.accepte = false;
});

export const reseauDisponible = () => !!socket;
