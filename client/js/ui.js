// ============================================================================
//  ARENA GLADIUS — client/js/ui.js
//  Petits outils d'interface : sélection, création d'éléments, notifications,
//  liste d'attributs avec boutons +/−.
// ============================================================================

import { ATTRIBUTS, ORDRE_ATTRIBUTS, CREATION } from '/shared/data.js';

export const $ = (sel, racine = document) => racine.querySelector(sel);
export const $$ = (sel, racine = document) => [...racine.querySelectorAll(sel)];

/** Échappe un texte pour l'insérer dans du HTML */
export function echapper(texte) {
  return String(texte).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Pièce de monnaie + montant */
export const prixHtml = (montant) => `<span class="prix"><i class="piece"></i>${montant}</span>`;

/** Notification temporaire en haut de l'écran */
export function notifier(texte, type = 'info') {
  const zone = $('#notifications');
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = texte;
  zone.appendChild(n);
  setTimeout(() => n.classList.add('sortie'), 2600);
  setTimeout(() => n.remove(), 3000);
}

/**
 * Liste d'attributs avec boutons +/−.
 * @param conteneur élément HTML
 * @param options.valeurs   valeurs actuelles (affichées)
 * @param options.minimums  valeur minimale de chaque attribut (on ne descend pas en dessous)
 * @param options.restants  points encore disponibles
 * @param options.surChangement(attr, delta) appelé au clic sur + ou −
 */
export function rendreAttributs(conteneur, { valeurs, minimums, restants, surChangement }) {
  const max = CREATION.valeurMaxAttribut;
  conteneur.innerHTML = ORDRE_ATTRIBUTS.map((a) => {
    const info = ATTRIBUTS[a];
    const ajoute = valeurs[a] - minimums[a];
    const plein = valeurs[a] >= max;
    // Jauge proportionnelle : 10 points = 10 % de la jauge, 100 points = jauge pleine
    const largeur = (valeurs[a] / max) * 100;
    return `
      <div class="attribut" title="${echapper(info.description)} (maximum ${max})">
        <span class="attribut-icone">${info.icone}</span>
        <span class="attribut-nom">${info.nom}<small>${info.description}</small></span>
        <button class="rond" data-attr="${a}" data-delta="-1" ${ajoute <= 0 ? 'disabled' : ''} aria-label="Retirer un point en ${info.nom}">−</button>
        <span class="attribut-valeur ${ajoute > 0 ? 'modifie' : ''}">${valeurs[a]}<small>/${max}</small></span>
        <button class="rond" data-attr="${a}" data-delta="1" ${restants <= 0 || plein ? 'disabled' : ''} aria-label="Ajouter un point en ${info.nom}">+</button>
        <span class="attribut-barre"><i style="width:${largeur}%"></i></span>
      </div>`;
  }).join('');
  conteneur.onclick = (e) => {
    const b = e.target.closest('button[data-attr]');
    if (b && !b.disabled) surChangement(b.dataset.attr, Number(b.dataset.delta));
  };
}
