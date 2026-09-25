// ============================================================================
//  ARENA GLADIUS — tests du moteur de combat et de l'IA
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../shared/data.js';
import { attributsDeBase, nouveauPersonnage } from '../shared/validation.js';
import { creerCombat, actionsPossibles, jouerAction, abandonner, distance, vuePublique } from '../server/combat.js';
import { genererAdversaire, choisirAction } from '../server/ai.js';

function perso(nom, ajouts = {}, equipement = {}) {
  const attributs = attributsDeBase();
  let reste = 10;
  for (const [a, n] of Object.entries(ajouts)) { attributs[a] += n; reste -= n; }
  attributs.vitalite += Math.max(0, reste);
  const p = nouveauPersonnage({ nom, skin: { peau: 'p1', coiffure: 'court', cheveux: 'c1', tunique: 't1' }, attributs });
  Object.assign(p.equipement, equipement);
  return p;
}

// Générateur pseudo-aléatoire reproductible
function aleaFixe(graine = 1) {
  let s = graine;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

test('création : positions, ordre de jeu selon la Vitesse, arène valide', () => {
  const e = creerCombat([perso('Lent', { vitesse: 0 }), perso('Rapide', { vitesse: 5 })], { arene: 'neige' });
  assert.equal(e.arene, 'neige');
  assert.deepEqual(e.combattants.map((c) => c.position), COMBAT.caseDepart);
  assert.equal(e.tour, 1);
  assert.equal(distance(e), 7);
  assert.equal(e.combattants[0].pv, e.combattants[0].stats.pvMax);
});

test('actions possibles au départ : pas d’attaque hors de portée', () => {
  const e = creerCombat([perso('A', { vitesse: 5 }), perso('B')]);
  const p = actionsPossibles(e, 0);
  assert.equal(p.avancer.possible, true);
  assert.equal(p.rapide.possible, false);
  assert.equal(p.rapide.raison, 'Hors de portée');
  assert.equal(p.charger.possible, false);
  assert.equal(p.reculer.possible, true);
});

test('déplacements, charge et tour par tour', () => {
  const e = creerCombat([perso('A', { vitesse: 5 }), perso('B')], { alea: aleaFixe(3) });
  assert.equal(jouerAction(e, 1, 'avancer').ok, false, 'pas son tour');
  jouerAction(e, 0, 'avancer');          // A : 2 → 3
  jouerAction(e, 1, 'avancer');          // B : 9 → 8
  assert.equal(distance(e), 5);
  assert.equal(e.manche, 2);
  jouerAction(e, 0, 'avancer');          // A : 3 → 4, distance 4
  jouerAction(e, 1, 'avancer');          // B : 8 → 7, distance 3
  const r = jouerAction(e, 0, 'charger');
  assert.ok(r.ok);
  assert.equal(distance(e), 1);
  assert.equal(r.evenement.attaque, 'rapide');
  assert.equal(actionsPossibles(e, 1).avancer.possible, false);
});

test('reculer contre le mur est impossible', () => {
  const e = creerCombat([perso('A', { vitesse: 5 }), perso('B')]);
  jouerAction(e, 0, 'reculer');           // 2 → 1
  jouerAction(e, 1, 'reposer');
  assert.equal(actionsPossibles(e, 0).reculer.possible, false);
});

test('(C) se protéger et provoquer : pas deux tours de suite', () => {
  const e = creerCombat([perso('A', { vitesse: 5 }), perso('B')]);
  jouerAction(e, 0, 'proteger');
  jouerAction(e, 1, 'provoquer');
  assert.equal(actionsPossibles(e, 0).proteger.possible, false);
  assert.equal(actionsPossibles(e, 0).provoquer.possible, true);
  jouerAction(e, 0, 'reposer');
  assert.equal(actionsPossibles(e, 1).provoquer.possible, false);
});

test('stamina : impossible d’attaquer à sec, le repos recharge', () => {
  const e = creerCombat([perso('A', { vitesse: 5 }), perso('B')]);
  e.combattants[0].position = 5; e.combattants[1].position = 6;
  e.combattants[0].stamina = 3;
  assert.equal(actionsPossibles(e, 0).normale.possible, false);
  assert.equal(actionsPossibles(e, 0).normale.raison, 'Pas assez de stamina');
  jouerAction(e, 0, 'reposer');
  assert.ok(e.combattants[0].stamina > 3);
});

test('KO : le combat se termine', () => {
  const e = creerCombat([perso('A', { vitesse: 5, force: 5 }, { arme: { id: 'marteau', niveau: 5 } }), perso('B')]);
  e.combattants[0].position = 5; e.combattants[1].position = 6;
  e.combattants[1].pv = 1; e.combattants[1].bouclier = 0;
  const r = jouerAction(e, 0, 'normale', () => 0.01);
  assert.ok(r.evenement.ko);
  assert.equal(e.fini, true);
  assert.equal(e.vainqueur, 0);
  assert.equal(e.raison, 'ko');
  assert.equal(vuePublique(e).possibles, null);
});

test('(C) limite de manches : décision des juges', () => {
  const e = creerCombat([perso('A', { vitesse: 5 }), perso('B')]);
  e.combattants[1].pv -= 10;
  for (let m = 0; m < COMBAT.manchesMax; m++) {
    jouerAction(e, 0, 'reposer');
    if (!e.fini) jouerAction(e, 1, 'reposer');
  }
  assert.equal(e.fini, true);
  assert.equal(e.raison, 'juges');
  assert.equal(e.vainqueur, 0);
});

test('abandon', () => {
  const e = creerCombat([perso('A'), perso('B')]);
  abandonner(e, 0);
  assert.equal(e.vainqueur, 1);
  assert.equal(e.raison, 'abandon');
});

test('IA : adversaire généré proche du joueur (Normal)', () => {
  const joueur = perso('Joueur', { force: 4, agilite: 3, vitalite: 3 }, { plastron: { id: 'plastron_bronze', niveau: 1 } });
  for (let g = 1; g < 30; g++) {
    const ia = genererAdversaire(joueur, aleaFixe(g), 'normal');
    const total = Object.values(ia.attributs).reduce((s, v) => s + v, 0);
    assert.ok(total >= 13 && total <= 18, `total ${total}`);
    assert.ok(ia.equipement.arme, 'l’IA a une arme');
  }
});

test('bots : Facile plus faible, Difficile plus fort', () => {
  const joueur = perso('Joueur', { force: 4, agilite: 3, vitalite: 3 });
  joueur.attributs.force += 30; joueur.pointsGagnes = 30; joueur.stats.victoires = 10;
  joueur.equipement.plastron = { id: 'plastron_fer', niveau: 2 };
  const moyenne = (difficulte) => {
    let somme = 0;
    for (let g = 1; g <= 40; g++) {
      const ia = genererAdversaire(joueur, aleaFixe(g), difficulte);
      somme += Object.values(ia.attributs).reduce((s, v) => s + v, 0);
    }
    return somme / 40;
  };
  const [f, n, d] = ['facile', 'normal', 'difficile'].map(moyenne);
  assert.ok(f < n && n < d, `totaux moyens : ${f} / ${n} / ${d}`);
});

test('bots : le joueur gagne plus souvent en Facile qu’en Normal, et en Normal qu’en Difficile', () => {
  const taux = {};
  for (const difficulte of ['facile', 'normal', 'difficile']) {
    let gagne = 0, erreurs = 0;
    for (let g = 1; g <= 250; g++) {
      const alea = aleaFixe(g * 13 + 5);
      const joueur = perso('Joueur', { force: 3, vitalite: 3, agilite: 2, defense: 1, endurance: 1 });
      const bot = genererAdversaire(joueur, alea, difficulte);
      const e = creerCombat([joueur, bot], { alea });
      let securite = 0;
      while (!e.fini && securite++ < 200) {
        const id = choisirAction(e, e.tour, alea, e.tour === 0 ? 'normal' : difficulte);
        if (!jouerAction(e, e.tour, id, alea).ok) { erreurs += 1; jouerAction(e, e.tour, 'reposer', alea); }
      }
      if (e.vainqueur === 0) gagne += 1;
    }
    assert.equal(erreurs, 0, `le bot ${difficulte} a choisi une action impossible`);
    taux[difficulte] = gagne / 250;
  }
  console.log(`   → victoires du joueur : facile ${Math.round(taux.facile * 100)} %, normal ${Math.round(taux.normal * 100)} %, difficile ${Math.round(taux.difficile * 100)} %`);
  assert.ok(taux.facile > taux.normal && taux.normal > taux.difficile);
  assert.ok(taux.facile > 0.6, 'Facile doit rester facile');
});

// Simulation de nombreux combats IA contre IA : ils doivent tous se terminer
// et la durée moyenne doit rester raisonnable.
test('simulation : 300 combats IA contre IA', () => {
  let manches = 0, juges = 0, ko = 0, erreurs = 0;
  for (let g = 1; g <= 300; g++) {
    const alea = aleaFixe(g * 7);
    const base = perso(`Base${g}`, { force: 3, agilite: 2, defense: 2, endurance: 2, vitesse: 1 });
    const a = genererAdversaire(base, alea);
    const b = genererAdversaire(base, alea);
    const e = creerCombat([a, b], { alea });
    let securite = 0;
    while (!e.fini && securite++ < 200) {
      const id = choisirAction(e, e.tour, alea);
      if (!jouerAction(e, e.tour, id, alea).ok) { erreurs += 1; jouerAction(e, e.tour, 'reposer', alea); }
    }
    assert.ok(e.fini, 'le combat doit se terminer');
    manches += e.manche;
    if (e.raison === 'juges') juges += 1;
    if (e.raison === 'ko') ko += 1;
  }
  const moyenne = manches / 300;
  console.log(`   → durée moyenne : ${moyenne.toFixed(1)} manches, KO : ${ko}, décisions des juges : ${juges}`);
  assert.equal(erreurs, 0, 'l’IA ne doit jamais choisir une action impossible');
  assert.ok(moyenne > 5 && moyenne < 25, `durée moyenne ${moyenne}`);
  assert.ok(juges < 60, 'la plupart des combats doivent finir par KO');
});
