// ============================================================================
//  ARENA GLADIUS — boutiques (Forgeron = armes, Armurier = armures)
//
//  À gauche : l'intérieur de la boutique dessiné sur canvas (marchand,
//  objets exposés, ton gladiateur qui essaie l'objet survolé).
//  À droite : le menu avec les objets, leurs stats et leurs prix.
// ============================================================================

import { ARMES, ARMURES, EMPLACEMENTS, ORDRE_EMPLACEMENTS, AMELIORATION, MATERIAUX } from '/shared/data.js';
import { statsArme, valeurArmure, prixRevente, arrondi1 } from '/shared/formulas.js';
import { devisAchat, devisAmelioration, acheter, ameliorer, vendre, emplacementDe } from '/shared/boutique.js';
import { $, $$, echapper, prixHtml, notifier } from '../ui.js';
import { lirePerso, appliquer } from '../etat.js';
import { dessinerBoutique, MARCHANDS } from '../rendu/boutique.js';
import { jouerSon } from '../audio.js';
import { iconeDansCanvas } from '../rendu/icones.js';

const REPLIQUES = {
  forgeron: {
    accueil: [
      'Bienvenue à la forge ! Tout ce qui coupe, frappe ou transperce est ici.',
      'Ah, un gladiateur ! Viens voir mes lames, elles sortent à peine du feu.',
      'Entre, entre ! Mais ne touche pas l’enclume, elle est brûlante.',
    ],
    achat: [
      'Excellent choix ! Elle te servira bien dans l’arène.',
      'Marché conclu ! Frappe fort et pense à moi.',
      'Belle arme, beau guerrier. Va faire trembler la foule !',
    ],
    amelioration: ['Quelques coups de marteau… et voilà, plus redoutable que jamais !', 'Je l’ai affûtée comme pour un empereur.'],
    vente: ['Hmm… je t’en donne ça. C’est mon dernier prix.', 'Je la remettrai en état pour un autre.'],
    pauvre: ['Pas assez de crédits, l’ami. Reviens après quelques victoires !', 'Ma forge n’accepte pas les promesses, seulement les crédits.'],
    max: ['Je ne peux pas faire mieux : c’est déjà un chef-d’œuvre.'],
    cadeau: ['Cette dague était un cadeau de bienvenue : je ne la reprends pas !'],
  },
  armurier: {
    accueil: [
      'Bienvenue chez Livia ! Une bonne armure, c’est la moitié d’une victoire.',
      'Tu as l’air bien peu protégé… On va arranger ça.',
      'Casques, cuirasses, boucliers : tout est fait main, ici.',
    ],
    achat: [
      'Elle te va à merveille ! Les coups vont rebondir.',
      'Parfait. Prends-en soin, elle te le rendra.',
      'Te voilà mieux protégé que la moitié de l’arène !',
    ],
    amelioration: ['Quelques rivets de plus et c’est encore plus solide.', 'Renforcée ! Elle encaissera bien mieux les coups.'],
    vente: ['Je te la reprends, elle servira à un débutant.', 'Un peu cabossée… voilà ton dû.'],
    pauvre: ['Désolée, ce n’est pas assez. Reviens quand ta bourse sera plus lourde.', 'Il te manque quelques crédits, champion.'],
    max: ['Impossible de faire mieux : c’est le meilleur de mon savoir-faire.'],
    cadeau: ['Je ne reprends pas ça.'],
  },
};

const auHasard = (liste) => liste[Math.floor(Math.random() * liste.length)];

// État de l'écran
let type = 'forgeron';
let onglet = 'casque';
let survolId = null;
let texteBulle = '';
let animation = null;        // { pose, debut }
let confirmation = null;     // { action, cle, fin }
let dernierT = 0;

const emplacementsVisibles = () => (type === 'forgeron' ? ['arme'] : [onglet]);

function dire(categorie) {
  texteBulle = auHasard(REPLIQUES[type][categorie]);
}

function jouerAnimation() {
  animation = { pose: type === 'forgeron' ? 'attaque' : 'victoire', debut: dernierT };
}

// ----------------------------------------------------------------------------
//  Textes des stats
// ----------------------------------------------------------------------------
function statsObjet(id, niveau = 0) {
  if (ARMES[id]) {
    const s = statsArme({ id, niveau });
    const portee = s.porteeMin === s.porteeMax ? `${s.porteeMax} case` : `${s.porteeMin}-${s.porteeMax} cases`;
    return { valeur: s.degats, texte: `⚔ ${s.degats} dégâts · 🎯 ${s.precision > 0 ? '+' : ''}${s.precision} % · ↔ ${portee}` };
  }
  const a = ARMURES[id];
  const v = valeurArmure({ id, niveau });
  return { valeur: v, texte: a.emplacement === 'bouclier' ? `◉ ${v} points de bouclier` : `🛡 ${v} d’armure` };
}

function ecart(nouveau, actuel) {
  const d = arrondi1(nouveau - actuel);
  if (d === 0) return '';
  return `<span class="ecart ${d > 0 ? 'plus' : 'moins'}">${d > 0 ? '▲ +' : '▼ '}${d}</span>`;
}

const nomObjet = (id) => (ARMES[id] || ARMURES[id]).nom;
const etiquetteNiveau = (n) => (n > 0 ? ` <span class="niveau">+${n}</span>` : '');

// ----------------------------------------------------------------------------
//  Rendu du menu
// ----------------------------------------------------------------------------
function texteBouton(action, cle, texte, texteConfirmation) {
  return confirmation && confirmation.action === action && confirmation.cle === cle ? texteConfirmation : texte;
}

function rendreEquipe(perso) {
  const blocs = emplacementsVisibles().map((emp) => {
    const objet = perso.equipement[emp];
    const titre = { arme: 'Ton arme', casque: 'Ton casque', plastron: 'Ton plastron', jambieres: 'Tes jambières', bouclier: 'Ton bouclier' }[emp];
    if (!objet) {
      const vide = emp === 'arme' ? 'Tu te bats à mains nues (poings).' : 'Emplacement vide : rien ne te protège ici.';
      return `<div class="equipe vide"><h3>${titre}</h3><p>${vide}</p></div>`;
    }
    const s = statsObjet(objet.id, objet.niveau);
    const devis = devisAmelioration(perso, emp);
    const revente = prixRevente(objet);
    let amelioration;
    if (devis.max) {
      amelioration = `<button class="btn petit" disabled>Niveau max (+${AMELIORATION.niveauMax})</button>`;
    } else {
      const suivant = statsObjet(objet.id, devis.niveauVise);
      amelioration = `
        <button class="btn petit btn-or" data-action="ameliorer" data-emp="${emp}" ${devis.abordable ? '' : 'data-pauvre="1"'}>
          Améliorer → +${devis.niveauVise} ${prixHtml(devis.cout)}
        </button>
        <small>${s.valeur} → ${suivant.valeur}</small>`;
    }
    const vente = revente > 0
      ? `<button class="btn petit" data-action="vendre" data-emp="${emp}">${texteBouton('vendre', emp, `Vendre ${prixHtml(`+${revente}`)}`, 'Confirmer la vente ?')}</button>`
      : `<button class="btn petit" disabled title="Objet offert : aucune valeur de revente">Invendable</button>`;
    return `
      <div class="equipe">
        <h3>${titre}</h3>
        <div class="equipe-ligne">
          <canvas class="icone grande" data-icone="${objet.id}"></canvas>
          <div>
            <h4>${nomObjet(objet.id)}${etiquetteNiveau(objet.niveau)}</h4>
            <p class="objet-stats">${s.texte}</p>
          </div>
        </div>
        <div class="equipe-actions">${amelioration}${vente}</div>
      </div>`;
  });
  $('#boutique-equipe').innerHTML = blocs.join('');
}

function idsEnVente() {
  if (type === 'forgeron') {
    return Object.keys(ARMES).filter((id) => ARMES[id].vendable !== false).sort((a, b) => ARMES[a].prix - ARMES[b].prix);
  }
  return Object.keys(ARMURES).filter((id) => ARMURES[id].emplacement === onglet);
}

function rendreListe(perso) {
  const cartes = idsEnVente().map((id) => {
    const base = ARMES[id] || ARMURES[id];
    const emp = emplacementDe(id);
    const actuel = perso.equipement[emp];
    const devis = devisAchat(perso, id);
    const s = statsObjet(id);
    const sActuel = actuel ? statsObjet(actuel.id, actuel.niveau) : (emp === 'arme' ? statsObjet('poings') : { valeur: 0 });
    const materiau = ARMURES[id] ? MATERIAUX[ARMURES[id].materiau].nom : null;

    let achat;
    if (devis.dejaEquipe) {
      achat = `<span class="badge-equipe">Équipé${actuel.niveau ? ` +${actuel.niveau}` : ''}</span>`;
    } else {
      const libelle = devis.abordable ? 'Acheter' : 'Trop cher';
      achat = `
        ${prixHtml(base.prix)}
        <button class="btn petit ${devis.abordable ? 'btn-or' : ''}" data-action="acheter" data-id="${id}" ${devis.abordable ? '' : 'data-pauvre="1"'}>
          ${texteBouton('acheter', id, libelle, `Payer ${devis.net} ?`)}
        </button>
        ${devis.reprise > 0 ? `<small>Reprise de l’ancien : −${devis.reprise}</small>` : ''}`;
    }
    return `
      <article class="objet ${devis.dejaEquipe ? 'equipe-actuel' : ''} ${devis.abordable || devis.dejaEquipe ? '' : 'trop-cher'}" data-id="${id}">
        <canvas class="icone" data-icone="${id}"></canvas>
        <div class="objet-infos">
          <h4>${echapper(base.nom)} <span class="palier" title="Palier">${'★'.repeat(base.palier)}</span></h4>
          <p class="objet-stats">${s.texte} ${devis.dejaEquipe ? '' : ecart(s.valeur, sActuel.valeur)}</p>
          <p class="objet-note">${base.particularite || (materiau ? `Matériau : ${materiau}` : '')}</p>
        </div>
        <div class="objet-achat">${achat}</div>
      </article>`;
  });
  $('#boutique-liste').innerHTML = cartes.join('');
}

function rendreOnglets(perso) {
  const nav = $('#boutique-onglets');
  if (type === 'forgeron') { nav.hidden = true; return; }
  nav.hidden = false;
  nav.innerHTML = ORDRE_EMPLACEMENTS.map((e) => {
    const porte = perso.equipement[e];
    return `<button data-onglet="${e}" class="${e === onglet ? 'actif' : ''}">${EMPLACEMENTS[e].nom}${porte ? ' ✓' : ''}</button>`;
  }).join('');
}

function rendre() {
  const perso = lirePerso();
  if (!perso) return;
  rendreOnglets(perso);
  rendreEquipe(perso);
  rendreListe(perso);
  $$('#ecran-boutique canvas[data-icone]').forEach((c) => iconeDansCanvas(c, c.dataset.icone));
}

// ----------------------------------------------------------------------------
//  Actions
// ----------------------------------------------------------------------------
function demanderConfirmation(action, cle) {
  if (confirmation && confirmation.action === action && confirmation.cle === cle && performance.now() < confirmation.fin) {
    confirmation = null;
    return true;
  }
  confirmation = { action, cle, fin: performance.now() + 3500 };
  rendre();
  setTimeout(() => { if (confirmation && performance.now() >= confirmation.fin) { confirmation = null; rendre(); } }, 3600);
  return false;
}

function surClic(e) {
  const b = e.target.closest('button[data-action]');
  if (!b || b.disabled) return;
  const perso = lirePerso();
  const { action } = b.dataset;

  if (b.dataset.pauvre) { dire('pauvre'); return; }

  if (action === 'acheter') {
    if (!demanderConfirmation('acheter', b.dataset.id)) return;
    const r = appliquer(acheter(perso, b.dataset.id));
    if (r.ok) {
      dire('achat');
      jouerAnimation();
      jouerSon('piece');
      notifier(`Achat : ${nomObjet(b.dataset.id)}${r.devis.reprise ? ` (ancien objet repris ${r.devis.reprise})` : ''} !`, 'succes');
    } else notifier(r.erreur, 'erreur');
  } else if (action === 'ameliorer') {
    const r = appliquer(ameliorer(perso, b.dataset.emp));
    if (r.ok) {
      dire('amelioration');
      jouerAnimation();
      setTimeout(() => jouerSon('bouclier'), 450);
    } else {
      dire(r.erreur.includes('maximum') ? 'max' : 'pauvre');
    }
  } else if (action === 'vendre') {
    if (!demanderConfirmation('vendre', b.dataset.emp)) return;
    const r = appliquer(vendre(perso, b.dataset.emp));
    if (r.ok) { dire('vente'); jouerSon('piece'); notifier(`Vendu pour ${r.montant} crédits.`, 'info'); } else dire('cadeau');
  }
  confirmation = null;
  rendre();
}

function surSurvol(e) {
  const carte = e.target.closest('.objet[data-id]');
  survolId = carte ? carte.dataset.id : null;
}

export const ecranBoutique = {
  nom: 'boutique',
  section: 'ecran-boutique',
  hud: true,
  maison: true,
  musique: () => (type === 'forgeron' ? 'forge' : 'boutique'),

  initialiser() {
    const panneau = $('#ecran-boutique .panneau-boutique');
    panneau.addEventListener('click', surClic);
    panneau.addEventListener('mouseover', surSurvol);
    panneau.addEventListener('mouseleave', () => { survolId = null; });
    $('#boutique-onglets').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-onglet]');
      if (!b) return;
      onglet = b.dataset.onglet;
      confirmation = null;
      rendre();
    });
  },

  entrer({ type: t = 'forgeron' } = {}) {
    type = t;
    survolId = null;
    confirmation = null;
    animation = null;
    const m = MARCHANDS[type];
    $('#boutique-titre').textContent = type === 'forgeron' ? 'La Forge' : 'L’Armurerie';
    $('#boutique-sous-titre').textContent = type === 'forgeron'
      ? `${m.nom}, maître forgeron — armes` : `${m.nom}, armurière — casques, cuirasses, jambières et boucliers`;
    $('#ecran-boutique').dataset.type = type;
    dire('accueil');
    rendre();
  },

  dessiner(ctx, w, h, t) {
    dernierT = t;
    const perso = lirePerso();
    const panneau = $('#ecran-boutique .panneau-boutique');
    const gauche = panneau.getBoundingClientRect().left;
    const largeurZone = gauche > w * 0.35 ? gauche : w;

    // Essayage : on équipe virtuellement l'objet survolé
    let essai = null;
    if (survolId && perso) {
      const emp = emplacementDe(survolId);
      if (perso.equipement[emp]?.id !== survolId) essai = { ...perso.equipement, [emp]: { id: survolId, niveau: 0 } };
    }

    let marchand = null, etincelles = null;
    if (animation) {
      const av = (t - animation.debut) / 0.9;
      if (av >= 1) animation = null;
      else {
        marchand = { pose: animation.pose, avancement: av };
        if (av > 0.5) etincelles = (av - 0.5) / 0.5;
      }
    }
    dessinerBoutique(ctx, w, h, t, { type, largeurZone, perso, essai, survolId, bulle: texteBulle, marchand, etincelles });
  },
};
