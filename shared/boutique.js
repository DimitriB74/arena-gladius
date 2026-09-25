// ============================================================================
//  ARENA GLADIUS — shared/boutique.js
//
//  Opérations qui modifient un personnage : acheter, améliorer, vendre,
//  répartir des points, recevoir une récompense.
//  Fonctions PURES : elles ne modifient jamais le personnage reçu, elles
//  renvoient { ok: true, perso: <copie modifiée>, ... } ou { ok: false, erreur }.
//  (Utilisables plus tard par le serveur si on veut des sauvegardes signées.)
// ============================================================================

import { ARMES, ARMURES, AMELIORATION, ORDRE_ATTRIBUTS, CREATION } from './data.js';
import { coutAmelioration, prixRevente, calculerRecompense } from './formulas.js';

const copie = (p) => JSON.parse(JSON.stringify(p));
const echec = (erreur) => ({ ok: false, erreur });

/** Emplacement où va un objet : 'arme' ou l'emplacement de l'armure */
export function emplacementDe(id) {
  if (ARMES[id]) return 'arme';
  if (ARMURES[id]) return ARMURES[id].emplacement;
  return null;
}

/**
 * Détail d'un achat : prix, reprise automatique de l'objet actuel, coût net.
 * Sert à l'affichage (boutique) et à l'achat lui-même.
 */
export function devisAchat(perso, id) {
  const base = ARMES[id] || ARMURES[id];
  const emplacement = emplacementDe(id);
  if (!base || !emplacement || base.vendable === false) return null;
  const actuel = perso.equipement[emplacement];
  const reprise = prixRevente(actuel);
  const net = Math.max(0, base.prix - reprise);
  return {
    id, emplacement, prix: base.prix, reprise, net,
    dejaEquipe: actuel?.id === id,
    abordable: perso.credits >= net,
  };
}

export function acheter(perso, id) {
  const devis = devisAchat(perso, id);
  if (!devis) return echec('Objet inconnu.');
  if (devis.dejaEquipe) return echec('Tu possèdes déjà cet objet.');
  if (!devis.abordable) return echec('Pas assez de crédits.');
  const p = copie(perso);
  p.credits -= devis.net;
  p.equipement[devis.emplacement] = { id, niveau: 0 };
  return { ok: true, perso: p, devis };
}

/** Détail de la prochaine amélioration de l'objet équipé sur cet emplacement */
export function devisAmelioration(perso, emplacement) {
  const objet = perso.equipement[emplacement];
  if (!objet) return null;
  const base = ARMES[objet.id] || ARMURES[objet.id];
  if (objet.niveau >= AMELIORATION.niveauMax) return { max: true, niveau: objet.niveau };
  const cout = coutAmelioration(base.prix, objet.niveau + 1);
  return { max: false, niveau: objet.niveau, niveauVise: objet.niveau + 1, cout, abordable: perso.credits >= cout };
}

export function ameliorer(perso, emplacement) {
  const devis = devisAmelioration(perso, emplacement);
  if (!devis) return echec('Aucun objet à améliorer.');
  if (devis.max) return echec('Niveau maximum atteint.');
  if (!devis.abordable) return echec('Pas assez de crédits.');
  const p = copie(perso);
  p.credits -= devis.cout;
  p.equipement[emplacement].niveau += 1;
  return { ok: true, perso: p, devis };
}

export function vendre(perso, emplacement) {
  const objet = perso.equipement[emplacement];
  if (!objet) return echec('Rien à vendre.');
  const montant = prixRevente(objet);
  if (montant <= 0) return echec('Cet objet n’a aucune valeur de revente.');
  const p = copie(perso);
  p.credits += montant;
  p.equipement[emplacement] = null;
  return { ok: true, perso: p, montant };
}

/**
 * Répartit des points de compétence libres.
 * @param ajouts ex. { force: 2, vitalite: 1 }
 */
export function repartirPoints(perso, ajouts) {
  let total = 0;
  for (const [attr, n] of Object.entries(ajouts)) {
    if (!ORDRE_ATTRIBUTS.includes(attr)) return echec(`Attribut inconnu : ${attr}.`);
    if (!Number.isInteger(n) || n < 0) return echec('Nombre de points invalide.');
    total += n;
  }
  if (total === 0) return echec('Aucun point à répartir.');
  if (total > perso.pointsLibres) return echec('Pas assez de points libres.');
  for (const [attr, n] of Object.entries(ajouts)) {
    if (perso.attributs[attr] + n > CREATION.valeurMaxAttribut) {
      return echec(`Un attribut ne peut pas dépasser ${CREATION.valeurMaxAttribut}.`);
    }
  }
  const p = copie(perso);
  for (const [attr, n] of Object.entries(ajouts)) p.attributs[attr] += n;
  p.pointsLibres -= total;
  return { ok: true, perso: p };
}

/**
 * Applique la récompense d'un combat (crédits, points, compteurs).
 * @param mode 'joueur' | 'ia'
 * @param difficulte difficulté du bot (combats 'ia')
 */
export function appliquerRecompense(perso, mode, victoire, ratioPv = 0, difficulte = 'normal') {
  const r = calculerRecompense(mode, victoire, ratioPv, difficulte);
  const p = copie(perso);
  p.credits += r.credits;
  p.pointsLibres += r.points;
  p.pointsGagnes += r.points;
  const compteur = (victoire ? 'victoires' : 'defaites') + (mode === 'ia' ? 'IA' : '');
  p.stats[compteur] += 1;
  return { ok: true, perso: p, recompense: r };
}
