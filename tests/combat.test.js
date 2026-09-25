// ============================================================================
//  ARENA GLADIUS — tests du moteur de combat en temps réel (shared/combat.js)
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPS_REEL as T, ARENES, ORDRE_ARENES } from '../shared/data.js';
import { terrainDe, supportSous } from '../shared/terrain.js';
import { attributsDeBase, nouveauPersonnage } from '../shared/validation.js';
import {
  creerMatch, etapeCombattant, etapeMatch, ENTREE_VIDE, dynamique, combattantDepuis, presentation, abandonner,
} from '../shared/combat.js';
import { dureePhase } from '../shared/formulas.js';

/** Nombre de pas que dure la préparation d'une attaque pour ce combattant */
const pasPreparation = (c, type) => Math.ceil(dureePhase(type, 'preparation', c.stats) * T.frequence);

const DT = 1 / T.frequence;

function perso(nom, ajouts = {}, equipement = {}) {
  const attributs = attributsDeBase();
  let reste = 10;
  for (const [a, n] of Object.entries(ajouts)) { attributs[a] += n; reste -= n; }
  attributs.vitalite += Math.max(0, reste);
  const p = nouveauPersonnage({ nom, skin: { peau: 'p1', coiffure: 'court', cheveux: 'c1', tunique: 't1' }, attributs });
  Object.assign(p.equipement, equipement);
  return p;
}

const entree = (e = {}) => ({ ...ENTREE_VIDE, ...e });
function pas(c, e, n = 1, terrain = terrainDe('colisee')) { for (let k = 0; k < n; k++) etapeCombattant(c, entree(e), DT, terrain); }
/** Match déjà lancé (décompte passé) */
function matchLance(a = perso('A'), b = perso('B'), arene = 'colisee') {
  const m = creerMatch([a, b], { arene });
  m.phase = 'combat';
  m.decompte = 0;
  return m;
}
function avancer(m, e0 = {}, e1 = {}, n = 1, alea = () => 0.5) {
  for (let k = 0; k < n; k++) etapeMatch(m, [entree(e0), entree(e1)], DT, alea);
}

test('création : positions de départ, face à face, stats temps réel', () => {
  const m = creerMatch([perso('A'), perso('B')], { arene: 'desert' });
  const [a, b] = m.combattants;
  assert.equal(m.arene, 'desert');
  assert.equal(m.phase, 'decompte');
  assert.deepEqual([a.x, b.x], terrainDe('desert').departs);
  assert.equal(a.dir, 1);
  assert.equal(b.dir, -1);
  assert.ok(a.stats.tr.vitesse > 0 && a.stats.tr.gardeMax > 0);
});

test('décompte : personne ne bouge, puis le combat commence', () => {
  const m = creerMatch([perso('A'), perso('B')]);
  const x0 = m.combattants[0].x;
  avancer(m, { d: true }, {}, Math.round(T.frequence * (T.decompte - 0.5)));
  assert.equal(m.combattants[0].x, x0);
  assert.equal(m.phase, 'decompte');
  avancer(m, { d: true }, {}, T.frequence);
  assert.equal(m.phase, 'combat');
  assert.ok(m.combattants[0].x > x0);
  assert.ok(m.evenements.some((e) => e.type === 'debut'));
});

test('déplacement : la Vitesse fait courir plus vite', () => {
  const lent = matchLance(perso('Lent', { vitesse: 0 })).combattants[0];
  const rapide = matchLance(perso('Rapide', { vitesse: 10 })).combattants[0];
  const x0 = lent.x;
  pas(lent, { d: true }, 30);
  pas(rapide, { d: true }, 30);
  assert.ok(rapide.x - x0 > (lent.x - x0) * 1.05, 'le rapide va plus loin');
  assert.equal(lent.dir, 1);
  pas(lent, { g: true }, 5);
  assert.equal(lent.dir, -1);
});

test('saut, double saut, retombée au sol', () => {
  const c = matchLance().combattants[0];
  c.x = 800;   // entre les deux plateformes
  pas(c, { saut: true });
  assert.equal(c.auSol, false);
  assert.equal(c.sauts, 1);
  pas(c, {}, 10);
  const hauteur1 = c.y;
  pas(c, { saut: true });
  assert.equal(c.sauts, 0);
  pas(c, {}, 8);
  assert.ok(c.y > hauteur1, 'le double saut fait monter plus haut');
  pas(c, { saut: true }, 1);
  assert.equal(c.sauts, 0, 'pas de triple saut');
  pas(c, {}, 200);
  assert.equal(c.auSol, true);
  assert.equal(c.y, 0);
  assert.equal(c.sauts, T.saut.sautsMax);
});

test('plateformes : on atterrit dessus, on en descend avec « bas »', () => {
  const c = matchLance().combattants[0];
  const p = terrainDe('colisee').plateformes[0];
  c.x = (p.x1 + p.x2) / 2;
  pas(c, { saut: true });
  pas(c, {}, 12);
  pas(c, { saut: true });
  pas(c, {}, 120);
  assert.equal(c.sur, 0, 'posé sur la plateforme');
  assert.equal(c.y, p.y);
  pas(c, { b: true });
  pas(c, {}, 120);
  assert.equal(c.y, 0, 'redescendu au sol');
});

test('murs : impossible de sortir de l’arène', () => {
  const foret = terrainDe('foret');
  const c = matchLance(undefined, undefined, 'foret').combattants[0];
  c.x = 150;   // entre le mur et la première souche
  pas(c, { g: true }, 400, foret);
  assert.equal(c.x, T.arene.murGauche + T.corps.largeur / 2);
});

// ----------------------------------------------------------------------------
//  Terrains des arènes : blocs, trous, glace
// ----------------------------------------------------------------------------
test('blocs : on bute contre, on tient debout dessus, on ne les traverse pas', () => {
  const desert = terrainDe('desert');
  const pierre = desert.blocs.find((b) => b.x1 === 760);
  const c = matchLance(undefined, undefined, 'desert').combattants[0];
  pas(c, { d: true }, 120, desert);
  assert.equal(c.x, pierre.x1 - T.corps.largeur / 2, 'arrêté par le bloc');
  assert.equal(c.y, 0);
  // Tombé dessus : il y tient debout, et « bas » ne le fait pas passer au travers
  c.x = 800; c.y = 200; c.vy = 0; c.auSol = false;
  pas(c, {}, 60, desert);
  assert.equal(c.auSol, true);
  assert.equal(c.y, pierre.y2);
  assert.equal(c.sur, -1);
  pas(c, { b: true }, 30, desert);
  assert.equal(c.y, pierre.y2);
});

test('trous : y tomber, c’est la défaite (raison « chute »)', () => {
  const m = matchLance(undefined, undefined, 'volcan');
  const [a] = m.combattants;
  avancer(m, { d: true }, {}, 240);   // a court tout droit dans la lave
  assert.equal(m.fini, true);
  assert.equal(m.raison, 'chute');
  assert.equal(m.vainqueur, 1);
  assert.equal(a.pv, 0);
  assert.ok(m.evenements.some((e) => e.type === 'chute' && e.cible === 0 && e.trou === 'lave'));
});

test('trous : un double saut permet de remonter sur le bord', () => {
  const volcan = terrainDe('volcan');
  const trou = volcan.trous[0];
  const c = matchLance(undefined, undefined, 'volcan').combattants[0];
  let n = 0;
  while (c.y >= -40 && n++ < 200) pas(c, { d: true }, 1, volcan);   // il marche dans le trou…
  assert.ok(c.y < -40 && c.x > trou.x1, 'il est tombé');
  assert.equal(c.sauts, 1, 'tombé d’un bord : il lui reste le double saut');
  pas(c, { g: true, saut: true }, 1, volcan);                        // … et se rattrape
  pas(c, { g: true }, 90, volcan);
  assert.equal(c.auSol, true);
  assert.equal(c.y, 0);
  assert.ok(c.x < trou.x1 + T.corps.largeur / 2);
});

test('esquive au sol : on reste au sol et on garde son double saut', () => {
  const c = matchLance().combattants[0];
  pas(c, { d: true, esquive: true });
  pas(c, {}, 3);
  assert.equal(c.etat, 'esquive');
  assert.equal(c.auSol, true);
  assert.equal(c.sauts, T.saut.sautsMax);
});

test('glace : on glisse bien plus loin avant de s’arrêter', () => {
  const neige = terrainDe('neige');
  const glissade = (x) => {
    const c = matchLance(undefined, undefined, 'neige').combattants[0];
    c.x = x;
    pas(c, { d: true }, 20, neige);
    const x0 = c.x;
    pas(c, {}, 90, neige);
    return c.x - x0;
  };
  const surLaGlace = glissade(525), surLaNeige = glissade(260);
  assert.ok(surLaGlace > surLaNeige * 3, `${surLaGlace} contre ${surLaNeige}`);
});

test('arènes : départs sur la terre ferme, terrains symétriques donc équitables', () => {
  const miroir = (a, b) => Math.abs(a - (T.arene.largeur - b)) < 1e-9;
  for (const id of ORDRE_ARENES) {
    const t = terrainDe(id);
    assert.ok(ARENES[id].particularites, `${id} : particularités décrites`);
    assert.ok(miroir(t.departs[0], t.departs[1]), `${id} : départs symétriques`);
    for (const x of t.departs) {
      assert.equal(supportSous(t, x, 0, T.corps.largeur / 2), 0, `${id} : départ en ${x} sur le sol`);
      assert.ok(!t.blocs.some((b) => x + T.corps.largeur / 2 > b.x1 && x - T.corps.largeur / 2 < b.x2 && b.y1 < T.corps.hauteur), `${id} : départ hors des blocs`);
    }
    for (const liste of [t.blocs, t.plateformes, t.trous, t.glaces]) {
      for (const o of liste) {
        assert.ok(o.x1 >= T.arene.murGauche && o.x2 <= T.arene.murDroit, `${id} : ${JSON.stringify(o)} dans l’arène`);
        assert.ok(liste.some((p) => miroir(p.x1, o.x2) && miroir(p.x2, o.x1) && p.y === o.y && p.y1 === o.y1 && p.y2 === o.y2),
          `${id} : ${JSON.stringify(o)} a son symétrique`);
      }
    }
  }
});

test('esquive : rapide, invincible, coûte de la stamina, puis recharge', () => {
  const c = matchLance().combattants[0];
  const x0 = c.x, s0 = c.stamina;
  pas(c, { d: true, esquive: true });
  assert.equal(c.etat, 'esquive');
  assert.ok(c.invincible > 0);
  assert.equal(c.stamina, s0 - T.esquive.cout);
  pas(c, {}, 12);
  assert.equal(c.etat, 'libre');
  assert.ok(c.x - x0 > 120);
  pas(c, { esquive: true });
  assert.equal(c.etat, 'libre', 'encore en recharge');
});

test('attaque légère : touche à portée, dégâts, étourdissement et recul', () => {
  const m = matchLance();
  const [a, b] = m.combattants;
  b.x = a.x + 80; b.dir = -1;
  const pv0 = b.pv;
  avancer(m, { legere: true }, {});
  assert.equal(a.etat, 'attaque');
  avancer(m, {}, {}, 12);
  assert.ok(b.pv < pv0, 'b a perdu des PV');
  assert.equal(b.etat, 'etourdi');
  assert.ok(b.x > a.x + 80, 'b est repoussé');
  assert.ok(m.evenements.some((e) => e.type === 'coup' && e.cible === 1));
  assert.equal(a.compteurs.touches, 1);
});

test('attaque hors de portée : ne touche pas', () => {
  const m = matchLance();
  const [a, b] = m.combattants;
  b.x = a.x + 400;
  const pv0 = b.pv;
  avancer(m, { legere: true }, {}, 30);
  assert.equal(b.pv, pv0);
});

test('attaque lourde : plus lente, plus forte, coûte de la stamina', () => {
  const m1 = matchLance(); const m2 = matchLance();
  for (const m of [m1, m2]) { m.combattants[1].x = m.combattants[0].x + 90; }
  avancer(m1, { legere: true }, {}, 1);   // une seule pression
  avancer(m1, {}, {}, 40);
  avancer(m2, { lourde: true }, {}, 1);
  avancer(m2, {}, {}, 60);
  const perteLegere = m1.combattants[1].stats.pvMax - m1.combattants[1].pv;
  const perteLourde = m2.combattants[1].stats.pvMax - m2.combattants[1].pv;
  assert.ok(perteLourde > perteLegere * 2, `${perteLourde} contre ${perteLegere}`);
  assert.ok(m2.combattants[0].stamina < m2.combattants[0].stats.staminaMax);
});

test('parade : la garde encaisse ; parade parfaite : l’attaquant est sonné', () => {
  // Parade tenue depuis longtemps : la garde baisse, peu de PV perdus
  const m = matchLance();
  const [a, b] = m.combattants;
  b.x = a.x + 80;
  avancer(m, {}, { p: true }, 20);
  const garde0 = b.garde, pv0 = b.pv;
  avancer(m, { lourde: true }, { p: true }, 50);
  assert.ok(b.garde < garde0, 'la garde a encaissé');
  assert.ok(pv0 - b.pv < 5, 'peu de dégâts passent');
  assert.ok(m.evenements.some((e) => e.type === 'bloque' || e.type === 'brise'));

  // Parade levée juste avant l'impact : parfaite
  const m2 = matchLance();
  const [a2, b2] = m2.combattants;
  b2.x = a2.x + 80;
  avancer(m2, { lourde: true }, {}, 1);           // la lourde se prépare…
  avancer(m2, {}, {}, pasPreparation(a2, 'lourde') - 5);
  avancer(m2, {}, { p: true }, 10);               // … parade levée au dernier moment
  assert.equal(a2.etat, 'etourdi');
  assert.ok(m2.evenements.some((e) => e.type === 'parfaite'));
  assert.equal(b2.pv, b2.stats.pvMax);
});

test('garde brisée quand elle tombe à zéro', () => {
  const m = matchLance(perso('Fort', { force: 10 }, { arme: { id: 'marteau', niveau: 5 } }));
  const [a, b] = m.combattants;
  b.x = a.x + 80;
  b.garde = 5;
  avancer(m, {}, { p: true }, 20);
  avancer(m, { lourde: true }, { p: true }, 50);
  assert.ok(m.evenements.some((e) => e.type === 'brise'));
});

test('esquive au bon moment : l’attaque passe au travers', () => {
  const m = matchLance();
  const [a, b] = m.combattants;
  b.x = a.x + 80;
  avancer(m, { lourde: true }, {}, 1);
  avancer(m, {}, {}, pasPreparation(a, 'lourde') - 4);
  avancer(m, {}, { esquive: true }, 1);
  avancer(m, {}, {}, 20);
  assert.equal(b.pv, b.stats.pvMax);
});

test('KO : le combat se termine', () => {
  const m = matchLance();
  const [a, b] = m.combattants;
  b.x = a.x + 80;
  b.pv = 1;
  avancer(m, { legere: true }, {}, 20);
  assert.equal(m.fini, true);
  assert.equal(m.vainqueur, 0);
  assert.equal(m.raison, 'ko');
  assert.equal(b.etat, 'ko');
});

test('fin du temps : décision des juges au % de PV', () => {
  const m = matchLance();
  m.tempsRestant = 0.05;
  m.combattants[0].pv -= 10;
  avancer(m, {}, {}, 10);
  assert.equal(m.fini, true);
  assert.equal(m.raison, 'juges');
  assert.equal(m.vainqueur, 1);
});

test('abandon', () => {
  const m = matchLance();
  abandonner(m, 0);
  assert.equal(m.vainqueur, 1);
  assert.equal(m.raison, 'abandon');
});

test('prédiction : rejouer les mêmes entrées depuis un état envoyé donne le même résultat', () => {
  // Ce que fait le navigateur : il reçoit l'état du serveur puis rejoue ses entrées
  // (sur un sol normal, et sur la glace au bord de la crevasse)
  for (const [arene, x] of [['colisee', null], ['neige', 560]]) {
    const terrain = terrainDe(arene);
    const moi = matchLance(undefined, undefined, arene).combattants[0];
    if (x) moi.x = x;
    const suite = [{ d: true }, { d: true, saut: true }, { d: true }, {}, { legere: true }, {}, { g: true, esquive: true }, {}, {}, { p: true }];
    for (let k = 0; k < 20; k++) etapeCombattant(moi, entree({ d: true }), DT, terrain);
    const copie = combattantDepuis(presentation(moi), dynamique(moi));
    for (let k = 0; k < 60; k++) {
      const e = entree(suite[k % suite.length]);
      etapeCombattant(moi, e, DT, terrain);
      etapeCombattant(copie, e, DT, terrain);
    }
    assert.ok(Math.abs(moi.x - copie.x) < 0.5, `${arene} : ${moi.x} / ${copie.x}`);
    assert.ok(Math.abs(moi.y - copie.y) < 0.5);
    assert.equal(moi.etat, copie.etat);
  }
});

// ----------------------------------------------------------------------------
//  Bots en temps réel
// ----------------------------------------------------------------------------
import { genererAdversaire, creerCerveau, entreeBot } from '../server/ai.js';

function aleaFixe(graine = 1) {
  let s = graine;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/**
 * Combat complet entre deux cerveaux de bot ; renvoie le match terminé.
 * `chutesSansCoup` : chutes mortelles sans avoir été touché dans la seconde et demie d'avant
 */
function combatDeBots(pA, pB, difA, difB, graine, arene = null) {
  const alea = aleaFixe(graine);
  const m = creerMatch([pA, pB], { alea, arene });
  const cerveaux = [creerCerveau(difA, alea), creerCerveau(difB, alea)];
  const dernierCoup = [-999, -999];
  m.chutesSansCoup = 0;
  let n = 0;
  while (!m.fini && n++ < (T.decompte + T.dureeMax + 1) * T.frequence) {
    etapeMatch(m, [0, 1].map((i) => entreeBot(cerveaux[i], m, i, DT)), DT, alea);
    for (const ev of m.evenements) {
      if (['coup', 'bloque', 'brise', 'parfaite'].includes(ev.type)) dernierCoup[ev.type === 'parfaite' ? ev.auteur : ev.cible] = n;
      if (ev.type === 'chute' && n - dernierCoup[ev.cible] > 1.5 * T.frequence) m.chutesSansCoup += 1;
    }
    m.evenements.length = 0;
  }
  return m;
}

test('bots : les combats se terminent, en général avant la fin du temps et en moins d’une minute', () => {
  let avantLaFin = 0, duree = 0;
  for (let g = 1; g <= 30; g++) {
    const base = perso('Base', { force: 3, vitalite: 3, agilite: 2, defense: 2 });
    const bot = genererAdversaire(base, aleaFixe(g), 'normal');
    const m = combatDeBots(base, bot, 'normal', 'normal', g * 11);
    assert.equal(m.fini, true);
    if (m.raison === 'ko' || m.raison === 'chute') avantLaFin += 1;
    duree += T.dureeMax - m.tempsRestant;
  }
  console.log(`   → durée moyenne ${(duree / 30).toFixed(0)} s, KO ou chute ${avantLaFin}/30`);
  assert.ok(avantLaFin >= 25, 'la plupart des combats finissent par KO ou chute');
  assert.ok(duree / 30 > 10 && duree / 30 < 60, `durée moyenne ${duree / 30}`);
});

test('bots : sur chaque arène, ils suivent l’adversaire sans se jeter dans le vide', () => {
  for (const arene of ORDRE_ARENES) {
    let sansCoup = 0, finis = 0;
    for (let g = 1; g <= 8; g++) {
      const base = perso('Base', { force: 3, vitalite: 3, agilite: 2, defense: 2 });
      const bot = genererAdversaire(base, aleaFixe(g + 40), 'normal');
      const m = combatDeBots(base, bot, 'normal', 'difficile', g * 17 + 1, arene);
      if (m.raison === 'ko' || m.raison === 'chute') finis += 1;
      sansCoup += m.chutesSansCoup;
    }
    assert.ok(finis >= 6, `${arene} : les bots se rencontrent et se battent (${finis}/8)`);
    assert.ok(sansCoup <= 1, `${arene} : ${sansCoup} chute(s) sans avoir été touché`);
  }
});

test('bots : à gladiateurs identiques, le cerveau Difficile bat le Facile', () => {
  let victoires = 0;
  for (let g = 1; g <= 30; g++) {
    const p = perso('Miroir', { force: 3, vitalite: 3, agilite: 2, defense: 2 });
    const m = combatDeBots(p, JSON.parse(JSON.stringify(p)), 'difficile', 'facile', g * 7 + 3);
    if (m.vainqueur === 0) victoires += 1;
  }
  console.log(`   → Difficile bat Facile ${victoires}/30`);
  assert.ok(victoires >= 20);
});
