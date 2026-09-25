// ============================================================================
//  ARENA GLADIUS — tests des formules et de la validation
//  Lancement : npm test
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { ARMES, ARMURES, CREATION } from '../shared/data.js';
import {
  statsCombattant, degatsCoup, reductionArmure, dureePhase,
  totalInvesti, prixRevente, coutAmelioration, calculerRecompense, niveauPersonnage,
} from '../shared/formulas.js';
import { nouveauPersonnage, validerPersonnage, attributsDeBase } from '../shared/validation.js';

const perso = (attributs, equipement = {}) => ({ nom: 'Test', attributs, pointsGagnes: 0, equipement });
const ATTR = { force: 3, agilite: 3, defense: 2, vitalite: 3, endurance: 3, vitesse: 2 };

test('stats de base', () => {
  const s = statsCombattant(perso(ATTR, { bouclier: { id: 'bouclier_cuir', niveau: 0 } }));
  assert.equal(s.pvMax, 74);
  assert.equal(s.staminaMax, 45);
  assert.equal(s.bouclierMax, 14);
  assert.equal(s.arme.id, 'poings');
});

test('améliorations : +12 % par niveau et coût croissant', () => {
  assert.equal(coutAmelioration(100, 1), 50);
  assert.equal(coutAmelioration(100, 5), 250);
  const o = { id: 'glaive', niveau: 2 };
  assert.equal(totalInvesti(o), 140 + 70 + 140);
  assert.equal(prixRevente(o), 175);
  assert.equal(prixRevente({ id: 'dague', niveau: 0, offert: true }), 0);
});

test('(B) l’armure en % : l’attaque légère garde de l’intérêt même contre une armure lourde', () => {
  const att = statsCombattant(perso({ ...ATTR, force: 5 }, { arme: { id: 'hache', niveau: 0 } }));
  const def = statsCombattant(perso({ ...ATTR, defense: 6 }, {
    casque: { id: 'casque_acier', niveau: 0 }, plastron: { id: 'plastron_acier', niveau: 0 },
    jambieres: { id: 'jambieres_fer', niveau: 0 },
  }));
  const legere = degatsCoup('legere', att, def), lourde = degatsCoup('lourde', att, def);
  assert.ok(legere >= 2, `attaque légère trop faible : ${legere}`);
  assert.ok(lourde / legere < 4.5, 'écart légère / lourde trop grand');
  assert.ok(reductionArmure(def) <= 0.75);
});

test('dégâts : hasard ±10 % et critique ×1,5', () => {
  const a = statsCombattant(perso(ATTR, { arme: { id: 'glaive' } }));
  const bas = degatsCoup('lourde', a, a, { alea: () => 0 });
  const haut = degatsCoup('lourde', a, a, { alea: () => 0.999 });
  const crit = degatsCoup('lourde', a, a, { critique: true });
  const normal = degatsCoup('lourde', a, a);
  assert.ok(bas <= normal && normal <= haut);
  assert.ok(crit > normal);
});

test('temps réel : la Vitesse fait courir et sauter, l’Agilité et l’arme accélèrent les coups', () => {
  const lent = statsCombattant(perso({ ...ATTR, vitesse: 1 }));
  const rapide = statsCombattant(perso({ ...ATTR, vitesse: 40 }));
  assert.ok(rapide.tr.vitesse > lent.tr.vitesse);
  assert.ok(rapide.tr.impulsionSaut > lent.tr.impulsionSaut);
  const maladroit = statsCombattant(perso({ ...ATTR, agilite: 1 }, { arme: { id: 'marteau' } }));
  const vif = statsCombattant(perso({ ...ATTR, agilite: 30 }, { arme: { id: 'dague' } }));
  assert.ok(vif.tr.cadence > maladroit.tr.cadence);
  assert.ok(dureePhase('legere', 'preparation', vif) < dureePhase('legere', 'preparation', maladroit));
  assert.equal(maladroit.tr.coutLourde, Math.round(22 * 1.5), 'le marteau rend l’attaque lourde plus coûteuse');
  const lance = statsCombattant(perso(ATTR, { arme: { id: 'lance' } }));
  assert.ok(lance.tr.allonge > lent.tr.allonge, 'la lance frappe de plus loin');
});

test('temps réel : Endurance → stamina qui remonte plus vite, Défense et bouclier → garde', () => {
  const mou = statsCombattant(perso({ ...ATTR, endurance: 1 }));
  const endurant = statsCombattant(perso({ ...ATTR, endurance: 20 }));
  assert.ok(endurant.tr.regenStamina > mou.tr.regenStamina);
  assert.ok(endurant.staminaMax > mou.staminaMax);
  const nu = statsCombattant(perso(ATTR));
  const garde = statsCombattant(perso({ ...ATTR, defense: 10 }, { bouclier: { id: 'bouclier_fer', niveau: 2 } }));
  assert.ok(garde.tr.gardeMax > nu.tr.gardeMax);
});

test('récompenses et niveau', () => {
  assert.deepEqual(calculerRecompense('joueur', true, 0.5), { credits: 125, bonus: 25, points: 3 });
  assert.deepEqual(calculerRecompense('ia', false, 1), { credits: 20, bonus: 0, points: 0 });
  assert.deepEqual(calculerRecompense('ia', true, 0, 'facile'), { credits: 30, bonus: 0, points: 1 });
  assert.deepEqual(calculerRecompense('ia', true, 1, 'difficile'), { credits: 120, bonus: 40, points: 2 });
  assert.equal(niveauPersonnage(0), 1);
  assert.equal(niveauPersonnage(7), 3);
});


// ----------------------------------------------------------------------------
//  Validation du personnage
// ----------------------------------------------------------------------------
function persoValide() {
  const attributs = attributsDeBase();
  attributs.force += 4; attributs.vitalite += 3; attributs.agilite += 3;
  return nouveauPersonnage({
    nom: '  Maximus  ', skin: { peau: 'p2', coiffure: 'court', cheveux: 'c1', tunique: 't1' }, attributs,
  });
}

test('un nouveau personnage est valide', () => {
  const p = persoValide();
  assert.equal(p.nom, 'Maximus');
  assert.equal(p.credits, CREATION.creditsDepart);
  assert.deepEqual(validerPersonnage(p), { ok: true, erreurs: [] });
});

test('la validation détecte les sauvegardes incohérentes', () => {
  const trop = persoValide(); trop.attributs.force += 5;
  assert.equal(validerPersonnage(trop).ok, false);

  const riche = persoValide(); riche.credits = 99999;
  assert.equal(validerPersonnage(riche).ok, false);

  const surAmeliore = persoValide(); surAmeliore.equipement.arme.niveau = 9;
  assert.equal(validerPersonnage(surAmeliore).ok, false);

  const inconnu = persoValide(); inconnu.equipement.casque = { id: 'plastron_fer', niveau: 0 };
  assert.equal(validerPersonnage(inconnu).ok, false);

  // Un vétéran de 10 victoires peut légitimement avoir 30 points et de l'équipement
  const veteran = persoValide();
  veteran.stats.victoires = 10;
  veteran.pointsGagnes = 30; veteran.pointsLibres = 30;
  veteran.credits = 500;
  veteran.equipement.plastron = { id: 'plastron_fer', niveau: 1 };
  assert.deepEqual(validerPersonnage(veteran), { ok: true, erreurs: [] });
});

test('toutes les armures et armes sont complètes', () => {
  assert.equal(Object.keys(ARMURES).length, 16);
  for (const a of Object.values(ARMES)) {
    for (const champ of ['degats', 'cadence', 'allonge', 'ignoreArmure', 'coutStamina', 'prix']) {
      assert.equal(typeof a[champ], 'number', `${a.nom}.${champ}`);
    }
  }
});
