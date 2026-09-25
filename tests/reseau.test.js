// ============================================================================
//  ARENA GLADIUS — tests réseau (lobby, défis, combats en temps réel, déconnexions)
//  Un vrai serveur Socket.IO est lancé dans le test, avec de vrais clients qui
//  envoient leurs touches comme le ferait un navigateur.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connecter } from 'socket.io-client';
import { COMBAT, TEMPS_REEL as T } from '../shared/data.js';
import { attributsDeBase, nouveauPersonnage } from '../shared/validation.js';
import { Lobby } from '../server/lobby.js';

// Combats accélérés pour les tests : décompte court, coups qui font très mal
COMBAT.delaiReconnexion = 1;
T.decompte = 0.3;
T.attaques.legere.mult = 3;
T.attaques.lourde.mult = 6;

let serveur, url;

test.before(async () => {
  const http = createServer();
  const io = new Server(http);
  const lobby = new Lobby(io);
  io.on('connection', (s) => lobby.connexion(s));
  await new Promise((r) => http.listen(0, r));
  url = `http://localhost:${http.address().port}`;
  serveur = { http, io };
});

test.after(() => {
  serveur.io.close();
  serveur.http.close();
});

// ----------------------------------------------------------------------------
//  Outils
// ----------------------------------------------------------------------------
function perso(nom) {
  const attributs = attributsDeBase();
  attributs.force += 4; attributs.vitalite += 3; attributs.agilite += 3;
  return nouveauPersonnage({ nom, skin: { peau: 'p1', coiffure: 'court', cheveux: 'c1', tunique: 't1' }, attributs });
}

/** Attend un événement (avec un filtre facultatif) */
function attendre(socket, evenement, filtre = null, delai = 8000) {
  const accepte = filtre || (() => true);
  return new Promise((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new Error(`Délai dépassé pour ${evenement}`)), delai);
    const f = (d) => {
      if (!accepte(d)) return;
      clearTimeout(minuteur);
      socket.off(evenement, f);
      resoudre(d);
    };
    socket.on(evenement, f);
  });
}

async function client(nom, jeton = `jeton-${nom}-${Math.random().toString(36).slice(2)}`) {
  const s = connecter(url, { transports: ['websocket'], forceNew: true });
  await attendre(s, 'connect');
  const p = perso(nom);
  const accepte = attendre(s, 'player:accepted');
  s.emit('player:join', { jeton, perso: p });
  const infos = await accepte;
  return { s, id: infos.id, jeton, perso: p, infos };
}

/**
 * Joueur automatique : toutes les 16 ms, il avance vers l'adversaire et
 * frappe quand il est assez près, comme un navigateur qui enverrait ses touches.
 */
function jouerAutomatiquement(c) {
  let monIndex = null, etat = null, seq = 0;
  c.s.on('match:start', (p) => { monIndex = p.monIndex; etat = p.etat; });
  c.s.on('match:state', (p) => { etat = p; });
  const minuteur = setInterval(() => {
    if (monIndex == null || !etat || etat.fini) return;
    const moi = etat.c[monIndex], lui = etat.c[1 - monIndex];
    const dx = lui.x - moi.x;
    const pres = Math.abs(dx) < 110;
    seq += 1;
    c.s.emit('match:entrees', { e: [{ s: seq, g: !pres && dx < 0, d: !pres && dx > 0, legere: pres && seq % 3 === 0 }] });
  }, 16);
  c.arreter = () => clearInterval(minuteur);
  return c;
}

// ----------------------------------------------------------------------------
//  Tests
// ----------------------------------------------------------------------------
test('un gladiateur incohérent est refusé', async () => {
  const s = connecter(url, { transports: ['websocket'], forceNew: true });
  await attendre(s, 'connect');
  const p = perso('Tricheur');
  p.credits = 999999;
  const refus = attendre(s, 'player:refused');
  s.emit('player:join', { jeton: 'jeton-tricheur-123', perso: p });
  const r = await refus;
  assert.ok(r.erreurs.length > 0);
  s.close();
});

test('lobby, défi accepté et combat complet en temps réel entre deux joueurs', async () => {
  const a = await client('Achille');
  const b = await client('Brutus');
  const lobby = await attendre(a.s, 'lobby:update', (l) => l.some((j) => j.id === b.id));
  assert.equal(lobby.find((j) => j.id === b.id).nom, 'Brutus');

  jouerAutomatiquement(a);
  jouerAutomatiquement(b);
  const defi = attendre(b.s, 'challenge:incoming');
  a.s.emit('challenge:send', { cible: b.id, arene: 'colisee' });
  const d = await defi;
  assert.equal(d.de.nom, 'Achille');
  assert.equal(d.arene, 'colisee');

  const debutA = attendre(a.s, 'match:start');
  const debutB = attendre(b.s, 'match:start');
  b.s.emit('challenge:response', { idDefi: d.idDefi, accepte: true });
  const [ma, mb] = await Promise.all([debutA, debutB]);
  assert.equal(ma.monIndex, 0);
  assert.equal(mb.monIndex, 1);
  assert.equal(ma.arene, 'colisee');
  assert.equal(ma.mode, 'joueur');
  assert.equal(ma.presentations.length, 2);
  assert.ok(ma.presentations[0].stats.tr.vitesse > 0, 'les stats temps réel sont envoyées');

  // L'état arrive en continu, avec le numéro de la dernière entrée jouée
  const etat = await attendre(a.s, 'match:state', (p) => p.phase === 'combat' && p.ack > 0);
  assert.equal(etat.c.length, 2);

  const [fa, fb] = await Promise.all([attendre(a.s, 'match:end', null, 30000), attendre(b.s, 'match:end', null, 30000)]);
  a.arreter(); b.arreter();
  assert.notEqual(fa.victoire, fb.victoire, 'un seul vainqueur');
  const gagnant = fa.victoire ? fa : fb, perdant = fa.victoire ? fb : fa;
  assert.equal(gagnant.recompense.points, 3);
  assert.ok(gagnant.recompense.credits >= 100);
  assert.equal(perdant.recompense.points, 1);
  assert.equal(perdant.recompense.credits, 40);
  // Chacun sait contre qui il s'est battu (bouton « Revanche »)
  assert.equal(fa.adversaireId, b.id);
  assert.equal(fb.adversaireId, a.id);
  a.s.close();
  b.s.close();
});

test('défi refusé', async () => {
  const a = await client('Cassia');
  const b = await client('Draco');
  const defi = attendre(b.s, 'challenge:incoming');
  a.s.emit('challenge:send', { cible: b.id });
  const d = await defi;
  const resultat = attendre(a.s, 'challenge:result', (r) => r.statut === 'refuse');
  b.s.emit('challenge:response', { idDefi: d.idDefi, accepte: false });
  const r = await resultat;
  assert.match(r.message, /refusé/);
  a.s.close();
  b.s.close();
});

test('combat contre un bot Difficile jusqu’au bout, puis « Rejouer »', async () => {
  const a = jouerAutomatiquement(await client('Octavia'));
  const debut = attendre(a.s, 'match:start');
  a.s.emit('match:training', { arene: 'neige', difficulte: 'difficile' });
  const m = await debut;
  assert.equal(m.mode, 'ia');
  assert.equal(m.difficulte, 'difficile');
  assert.equal(m.presentations[1].ia, true);
  const fin = await attendre(a.s, 'match:end', null, 30000);
  assert.equal(fin.mode, 'ia');
  assert.equal(fin.difficulte, 'difficile');
  assert.equal(fin.recompense.points, fin.victoire ? 2 : 0);
  assert.equal(fin.adversaireId, null, 'pas de revanche contre un bot : on rejoue');

  // « Rejouer » : un nouveau combat démarre aussitôt, même difficulté
  const reprise = attendre(a.s, 'match:start', (p) => p.idMatch !== m.idMatch);
  a.s.emit('match:training', { difficulte: 'difficile' });
  const m2 = await reprise;
  assert.equal(m2.difficulte, 'difficile');
  a.s.emit('match:forfeit');
  await attendre(a.s, 'match:end', (r) => r.idMatch === m2.idMatch);
  a.arreter();
  a.s.close();
});

test('difficulté inconnue : on retombe sur Normal', async () => {
  const a = await client('Flavia');
  const debut = attendre(a.s, 'match:start');
  a.s.emit('match:training', { difficulte: 'impossible' });
  const m = await debut;
  assert.equal(m.difficulte, 'normal');
  a.s.emit('match:forfeit');
  const fin = await attendre(a.s, 'match:end');
  assert.equal(fin.raison, 'abandon');
  assert.equal(fin.victoire, false);
  a.s.close();
});

test('entrées invalides ignorées, le combat continue', async () => {
  const a = await client('Nerva');
  const debut = attendre(a.s, 'match:start');
  a.s.emit('match:training', { difficulte: 'facile' });
  await debut;
  a.s.emit('match:entrees', null);
  a.s.emit('match:entrees', { e: 'n’importe quoi' });
  a.s.emit('match:entrees', { e: [{ s: 'x', d: true }, { s: 1, d: 'oui' }, null] });
  const etat = await attendre(a.s, 'match:state', (p) => p.phase === 'combat');
  assert.equal(etat.fini, false);
  a.s.emit('match:forfeit');
  await attendre(a.s, 'match:end');
  a.s.close();
});

test('déconnexion : pause, retour à temps, puis défaite et résultat remis au retour', async () => {
  const a = await client('Titus');
  const b = await client('Varro');
  const defi = attendre(b.s, 'challenge:incoming');
  a.s.emit('challenge:send', { cible: b.id });
  const d = await defi;
  const debutA = attendre(a.s, 'match:start');
  b.s.emit('challenge:response', { idDefi: d.idDefi, accepte: true });
  const m = await debutA;

  // Varro se déconnecte : le combat est en pause, puis il revient avec le même jeton
  const attente = attendre(a.s, 'match:state', (p) => p.attente?.index === 1 && p.pause);
  b.s.close();
  await attente;
  const b2 = connecter(url, { transports: ['websocket'], forceNew: true });
  await attendre(b2, 'connect');
  const reprise = attendre(b2, 'match:start');
  b2.emit('player:join', { jeton: b.jeton, perso: b.perso });
  const r = await reprise;
  assert.equal(r.idMatch, m.idMatch);
  assert.equal(r.monIndex, 1);
  const repris = await attendre(a.s, 'match:state', (p) => !p.pause && !p.attente);
  assert.equal(repris.pause, false);

  // Il repart pour de bon : au bout du délai, Titus gagne
  b2.close();
  const fin = await attendre(a.s, 'match:end', null, 5000);
  assert.equal(fin.victoire, true);
  assert.equal(fin.raison, 'deconnexion');

  // Quand Varro revient plus tard, il reçoit sa défaite
  const b3 = connecter(url, { transports: ['websocket'], forceNew: true });
  await attendre(b3, 'connect');
  const accueil = attendre(b3, 'player:accepted');
  b3.emit('player:join', { jeton: b.jeton, perso: b.perso });
  const acc = await accueil;
  assert.equal(acc.resultats.length, 1);
  assert.equal(acc.resultats[0].victoire, false);
  assert.equal(acc.resultats[0].recompense.points, 1);
  a.s.close();
  b3.close();
});
