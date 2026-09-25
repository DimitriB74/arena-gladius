// ============================================================================
//  ARENA GLADIUS — client/js/sauvegarde.js
//
//  Sauvegarde du gladiateur dans le navigateur (localStorage) et
//  export / import sous forme de code texte à copier-coller.
// ============================================================================

import { JEU } from '/shared/data.js';
import { validerPersonnage } from '/shared/validation.js';

// ?profil=2 dans l'adresse = une autre sauvegarde (pratique pour tester le 1v1 à deux onglets)
const PROFIL = (new URLSearchParams(location.search).get('profil') || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
const CLE = `arena-gladius:sauvegarde${PROFIL ? `:${PROFIL}` : ''}`;
export const nomProfil = () => PROFIL;
const PREFIXE = 'AG1';

export function lireSauvegarde() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const perso = JSON.parse(brut);
    return validerPersonnage(perso).ok ? perso : null;
  } catch {
    return null;
  }
}

export function ecrireSauvegarde(perso) {
  try {
    localStorage.setItem(CLE, JSON.stringify(perso));
    return true;
  } catch {
    return false;
  }
}

export function effacerSauvegarde() {
  try { localStorage.removeItem(CLE); } catch { /* rien */ }
}

// ----------------------------------------------------------------------------
//  Code d'export : AG1.<données en base64>.<somme de contrôle>
//  La somme de contrôle sert seulement à repérer un code mal copié.
// ----------------------------------------------------------------------------
function sommeControle(texte) {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h * 33) ^ texte.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function versBase64(texte) {
  const octets = new TextEncoder().encode(texte);
  let binaire = '';
  octets.forEach((o) => { binaire += String.fromCharCode(o); });
  return btoa(binaire);
}

function depuisBase64(b64) {
  const binaire = atob(b64);
  const octets = Uint8Array.from(binaire, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(octets);
}

export function exporterCode(perso) {
  const donnees = versBase64(JSON.stringify(perso));
  return `${PREFIXE}.${donnees}.${sommeControle(donnees)}`;
}

/** Renvoie { ok: true, perso } ou { ok: false, erreur } */
export function importerCode(code) {
  const morceaux = String(code || '').trim().replace(/\s+/g, '').split('.');
  if (morceaux.length !== 3 || morceaux[0] !== PREFIXE) {
    return { ok: false, erreur: 'Ce n’est pas un code de sauvegarde Arena Gladius.' };
  }
  const [, donnees, somme] = morceaux;
  if (sommeControle(donnees) !== somme) {
    return { ok: false, erreur: 'Le code est incomplet ou a été modifié (vérifie le copier-coller).' };
  }
  let perso;
  try {
    perso = JSON.parse(depuisBase64(donnees));
  } catch {
    return { ok: false, erreur: 'Le code est illisible.' };
  }
  if (perso.version !== JEU.versionSauvegarde) {
    return { ok: false, erreur: 'Cette sauvegarde vient d’une autre version du jeu.' };
  }
  const v = validerPersonnage(perso);
  if (!v.ok) return { ok: false, erreur: `Sauvegarde refusée : ${v.erreurs[0]}` };
  return { ok: true, perso };
}
