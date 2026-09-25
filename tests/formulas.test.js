// ============================================================================
//  ARENA GLADIUS — tests des formules et de la validation
//  Lancement : npm test
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { ARMES, ARMURES, CREATION } from '../shared/data.js';
import {
  statsCombattant, tirerAttaque, degatsEstimes, reductionArmure, appliquerDegats, coutAction,
  totalInvesti, prixRevente, coutAmelioration, chanceToucher, calculerRecompense, niveauPersonnage,
  premierJoueur,
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

test('(B) l’armure en % garde l’intérêt de l’attaque rapide', () => {
  const att = statsCombattant(perso({ ...ATTR, force: 5 }, { arme: { id: 'hache', niveau: 0 } }));
  const def = statsCombattant(perso({ ...ATTR, defense: 6 }, {
    casque: { id: 'casque_acier', niveau: 0 }, plastron: { id: 'plastron_acier', niveau: 0 },
    jambieres: { id: 'jambieres_fer', niveau: 0 },
  }));
  const rapide = degatsEstimes('rapide', att, def), puissante = degatsEstimes('puissante', att, def);
  assert.ok(rapide >= 5, `attaque rapide trop faible : ${rapide}`);
  assert.ok(puissante / rapide < 3.5, 'écart rapide / puissante trop grand');
  assert.ok(reductionArmure(def) <= 0.75);
});

test('les dégâts touchent le bouclier puis les PV', () => {
  assert.deepEqual(appliquerDegats(10, 4, 50), { bouclier: 0, pv: 44, absorbe: 4 });
  assert.deepEqual(appliquerDegats(3, 4, 50), { bouclier: 1, pv: 50, absorbe: 3 });
});

test('précision bornée entre 10 et 95 %', () => {
  const fort = statsCombattant(perso({ ...ATTR, agilite: 40 }, { arme: { id: 'dague' } }));
  const faible = statsCombattant(perso({ ...ATTR, agilite: 1 }, { arme: { id: 'hache' } }));
  assert.equal(chanceToucher('rapide', fort, faible), 95);
  assert.equal(chanceToucher('puissante', faible, fort), 10);
});

test('tirage d’attaque déterministe avec un aléa fixé', () => {
  const a = statsCombattant(perso(ATTR, { arme: { id: 'glaive' } }));
  const rate = tirerAttaque('normale', a, a, { alea: () => 0.99 });
  assert.equal(rate.touche, false);
  const touche = tirerAttaque('normale', a, a, { alea: () => 0.0 });
  assert.equal(touche.touche, true);
  assert.equal(touche.critique, true);
});

test('(D) la Vitesse réduit le coût des déplacements, le marteau alourdit les attaques', () => {
  const lent = statsCombattant(perso({ ...ATTR, vitesse: 1 }));
  const rapide = statsCombattant(perso({ ...ATTR, vitesse: 7 }));
  assert.equal(coutAction('avancer', lent), 3);
  assert.ok(coutAction('avancer', rapide) < 3);
  assert.ok(coutAction('charger', rapide) < coutAction('charger', lent));
  const marteau = statsCombattant(perso(ATTR, { arme: { id: 'marteau' } }));
  assert.equal(coutAction('normale', marteau), 15);
});

test('récompenses et niveau', () => {
  assert.deepEqual(calculerRecompense('joueur', true, 0.5), { credits: 125, bonus: 25, points: 3 });
  assert.deepEqual(calculerRecompense('ia', false, 1), { credits: 20, bonus: 0, points: 0 });
  assert.deepEqual(calculerRecompense('ia', true, 0, 'facile'), { credits: 30, bonus: 0, points: 1 });
  assert.deepEqual(calculerRecompense('ia', true, 1, 'difficile'), { credits: 120, bonus: 40, points: 2 });
  assert.equal(niveauPersonnage(0), 1);
  assert.equal(niveauPersonnage(7), 3);
});

test('premier joueur : la Vitesse décide', () => {
  const a = { attributs: { vitesse: 3 } }, b = { attributs: { vitesse: 5 } };
  assert.equal(premierJoueur(a, b), 1);
  assert.equal(premierJoueur(a, a, () => 0.1), 0);
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
    for (const champ of ['degats', 'precision', 'porteeMin', 'porteeMax', 'ignoreArmure', 'coutStamina', 'prix']) {
      assert.equal(typeof a[champ], 'number', `${a.nom}.${champ}`);
    }
  }
});
