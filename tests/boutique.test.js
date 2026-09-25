// ============================================================================
//  ARENA GLADIUS — tests des opérations de boutique et de progression
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { nouveauPersonnage, validerPersonnage, attributsDeBase } from '../shared/validation.js';
import {
  acheter, devisAchat, ameliorer, vendre, repartirPoints, appliquerRecompense,
} from '../shared/boutique.js';

function perso() {
  const attributs = attributsDeBase();
  attributs.force += 5; attributs.vitalite += 5;
  return nouveauPersonnage({ nom: 'Spartacus', skin: { peau: 'p1', coiffure: 'crete', cheveux: 'c3', tunique: 't2' }, attributs });
}

test('achat simple d’une armure', () => {
  const p = perso();
  const r = acheter(p, 'casque_cuir');
  assert.ok(r.ok);
  assert.equal(r.perso.credits, 60);
  assert.deepEqual(r.perso.equipement.casque, { id: 'casque_cuir', niveau: 0 });
  assert.equal(p.credits, 100, 'le personnage d’origine ne doit pas changer');
  assert.ok(validerPersonnage(r.perso).ok);
});

test('achat refusé si trop cher ou déjà possédé', () => {
  const p = perso();
  assert.equal(acheter(p, 'marteau').ok, false);
  assert.equal(acheter(p, 'dague').ok, false);
  assert.equal(acheter(p, 'inconnu').ok, false);
  assert.equal(acheter(p, 'poings').ok, false);
});

test('reprise automatique de l’ancien objet (50 % du total investi)', () => {
  let p = perso();
  p.credits = 1000;
  p = acheter(p, 'glaive').perso;               // 1000 - 140 (dague offerte : reprise 0)
  assert.equal(p.credits, 860);
  p = ameliorer(p, 'arme').perso;               // +1 : 70
  assert.equal(p.credits, 790);
  const devis = devisAchat(p, 'hache');         // investi 210 → reprise 105
  assert.equal(devis.reprise, 105);
  assert.equal(devis.net, 340 - 105);
  p = acheter(p, 'hache').perso;
  assert.equal(p.credits, 790 - 235);
  assert.deepEqual(p.equipement.arme, { id: 'hache', niveau: 0 });
});

test('amélioration jusqu’à +5 puis blocage', () => {
  let p = perso();
  p.credits = 10000;
  p = acheter(p, 'bouclier_cuir').perso;
  for (let i = 1; i <= 5; i++) {
    const r = ameliorer(p, 'bouclier');
    assert.ok(r.ok, `niveau ${i}`);
    p = r.perso;
  }
  assert.equal(p.equipement.bouclier.niveau, 5);
  assert.equal(ameliorer(p, 'bouclier').ok, false);
});

test('vente : la dague offerte ne se revend pas', () => {
  let p = perso();
  assert.equal(vendre(p, 'arme').ok, false);
  p = acheter(p, 'jambieres_cuir').perso;
  const r = vendre(p, 'jambieres');
  assert.ok(r.ok);
  assert.equal(r.montant, 20);
  assert.equal(r.perso.equipement.jambieres, null);
});

test('récompense puis répartition des points', () => {
  let p = perso();
  p = appliquerRecompense(p, 'joueur', true, 1).perso;
  assert.equal(p.credits, 250);
  assert.equal(p.pointsLibres, 3);
  assert.equal(p.stats.victoires, 1);
  assert.equal(repartirPoints(p, { force: 4 }).ok, false);
  assert.equal(repartirPoints(p, { magie: 1 }).ok, false);
  const r = repartirPoints(p, { force: 2, vitesse: 1 });
  assert.ok(r.ok);
  assert.equal(r.perso.attributs.force, 8);
  assert.equal(r.perso.pointsLibres, 0);
  assert.ok(validerPersonnage(r.perso).ok);
});

test('un attribut ne dépasse jamais 100', () => {
  let p = perso();
  p.pointsLibres = 200; p.pointsGagnes = 200; p.stats.victoires = 100;
  assert.equal(repartirPoints(p, { force: 100 }).ok, false);
  const r = repartirPoints(p, { force: 94 });
  assert.ok(r.ok);
  assert.equal(r.perso.attributs.force, 100);
  assert.equal(repartirPoints(r.perso, { force: 1 }).ok, false);
});
