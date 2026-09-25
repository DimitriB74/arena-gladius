// ============================================================================
//  ARENA GLADIUS — tests réseau (lobby, défis, combats, déconnexions)
//  Un vrai serveur Socket.IO est lancé dans le test, avec de vrais clients.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connecter } from 'socket.io-client';
import { IA, COMBAT } from '../shared/data.js';
import { attributsDeBase, nouveauPersonnage } from '../shared/validation.js';
import { Lobby } from '../server/lobby.js';

// Combats accélérés pour les tests
IA.delaiReflexion = [0.01, 0.02];
COMBAT.delaiReconnexion = 1;

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

/** Joue automatiquement : attaque si possible, sinon avance, sinon se repose */
function jouerAutomatiquement(c) {
  let monIndex = null;
  const jouer = (paquet) => {
    const e = paquet.etat;
    if (e.fini || e.tour !== monIndex || !e.possibles) return;
    const choix = ['normale', 'rapide', 'charger', 'avancer', 'reposer'].find((id) => e.possibles[id]?.possible);
    c.s.emit('match:action', { action: choix });
  };
  c.s.on('match:start', (p) => { monIndex = p.monIndex; setTimeout(() => jouer(p), 1600); });
  c.s.on('match:state', jouer);
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

test('lobby, défi accepté et combat complet entre deux joueurs', async () => {
  const a = await client('Achille');
  const b = await client('Brutus');
  const lobby = await attendre(a.s, 'lobby:update', (l) => l.some((j) => j.id === b.id));
  assert.equal(lobby.find((j) => j.id === b.id).nom, 'Brutus');

  jouerAutomatiquement(a);
  jouerAutomatiquement(b);
  const defi = attendre(b.s, 'challenge:incoming');
  a.s.emit('challenge:send', { cible: b.id, arene: 'volcan' });
  const d = await defi;
  assert.equal(d.de.nom, 'Achille');
  assert.equal(d.arene, 'volcan');

  const debutA = attendre(a.s, 'match:start');
  const debutB = attendre(b.s, 'match:start');
  b.s.emit('challenge:response', { idDefi: d.idDefi, accepte: true });
  const [ma, mb] = await Promise.all([debutA, debutB]);
  assert.equal(ma.monIndex, 0);
  assert.equal(mb.monIndex, 1);
  assert.equal(ma.etat.arene, 'volcan');
  assert.equal(ma.mode, 'joueur');

  const [fa, fb] = await Promise.all([attendre(a.s, 'match:end', null, 60000), attendre(b.s, 'match:end', null, 60000)].map((p) => p));
  assert.notEqual(fa.victoire, fb.victoire, 'un seul vainqueur');
  const gagnant = fa.victoire ? fa : fb, perdant = fa.victoire ? fb : fa;
  assert.equal(gagnant.recompense.points, 3);
  assert.ok(gagnant.recompense.credits >= 100);
  assert.equal(perdant.recompense.points, 1);
  assert.equal(perdant.recompense.credits, 40);
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

test('combat contre un bot Difficile jusqu’au bout', async () => {
  const a = await client('Octavia');
  jouerAutomatiquement(a);
  const debut = attendre(a.s, 'match:start');
  a.s.emit('match:training', { arene: 'neige', difficulte: 'difficile' });
  const m = await debut;
  assert.equal(m.mode, 'ia');
  assert.equal(m.difficulte, 'difficile');
  assert.equal(m.etat.combattants[1].ia, true);
  const fin = await attendre(a.s, 'match:end', null, 60000);
  assert.equal(fin.mode, 'ia');
  assert.equal(fin.difficulte, 'difficile');
  assert.equal(fin.recompense.points, fin.victoire ? 2 : 0);
  a.s.close();
});

test('difficulté inconnue : on retombe sur Normal', async () => {
  const a = await client('Flavia');
  const debut = attendre(a.s, 'match:start');
  a.s.emit('match:training', { difficulte: 'impossible' });
  const m = await debut;
  assert.equal(m.difficulte, 'normal');
  a.s.emit('match:forfeit');
  await attendre(a.s, 'match:end');
  a.s.close();
});

test('déconnexion : retour à temps, puis défaite par abandon et résultat remis au retour', async () => {
  const a = await client('Titus');
  const b = await client('Varro');
  const defi = attendre(b.s, 'challenge:incoming');
  a.s.emit('challenge:send', { cible: b.id });
  const d = await defi;
  const debutA = attendre(a.s, 'match:start');
  b.s.emit('challenge:response', { idDefi: d.idDefi, accepte: true });
  const m = await debutA;

  // Varro se déconnecte puis revient avec le même jeton : il retrouve son combat
  const attente = attendre(a.s, 'match:state', (p) => p.attente?.index === 1);
  b.s.close();
  await attente;
  const b2 = connecter(url, { transports: ['websocket'], forceNew: true });
  await attendre(b2, 'connect');
  const reprise = attendre(b2, 'match:start');
  b2.emit('player:join', { jeton: b.jeton, perso: b.perso });
  const r = await reprise;
  assert.equal(r.idMatch, m.idMatch);
  assert.equal(r.monIndex, 1);

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

test('actions refusées : hors tour et action impossible', async () => {
  const a = await client('Nerva');
  const debut = attendre(a.s, 'match:start');
  a.s.emit('match:training', {});
  const m = await debut;
  await new Promise((r) => setTimeout(r, 1700));
  const e = m.etat;
  if (e.tour === 0) {
    const erreur = attendre(a.s, 'match:error');
    a.s.emit('match:action', { action: 'puissante' }); // hors de portée au départ
    const err = await erreur;
    assert.match(err.message, /portée/);
  }
  a.s.emit('match:forfeit');
  const fin = await attendre(a.s, 'match:end');
  assert.equal(fin.raison, 'abandon');
  assert.equal(fin.victoire, false);
  a.s.close();
});
