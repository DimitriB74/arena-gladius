// ============================================================================
//  ARENA GLADIUS — shared/data.js
//
//  TOUTES les données d'équilibrage du jeu sont ici : attributs, armes,
//  armures, combat en temps réel, arènes, économie, récompenses, bots.
//  Ce fichier est utilisé à la fois par le serveur et par le navigateur :
//  pour rééquilibrer le jeu, il suffit de modifier les valeurs ci-dessous.
//  Les formules qui utilisent ces valeurs sont dans shared/formulas.js.
// ============================================================================

export const JEU = {
  nom: 'ARENA GLADIUS',
  versionSauvegarde: 1,
};

// ----------------------------------------------------------------------------
//  Attributs du gladiateur
// ----------------------------------------------------------------------------
export const ATTRIBUTS = {
  force:     { nom: 'Force',     icone: '💪', description: 'Augmente les dégâts de tes attaques.' },
  agilite:   { nom: 'Agilité',   icone: '🎯', description: 'Attaques plus rapides (moins d’attente entre deux coups) et plus de critiques.' },
  defense:   { nom: 'Défense',   icone: '🛡️', description: 'Réduit les dégâts reçus et renforce ta garde.' },
  vitalite:  { nom: 'Vitalité',  icone: '❤️', description: 'Augmente les points de vie max.' },
  endurance: { nom: 'Endurance', icone: '⚡', description: 'Plus de stamina, qui remonte plus vite (esquives, attaques lourdes).' },
  vitesse:   { nom: 'Vitesse',   icone: '🪶', description: 'Course plus rapide et sauts plus hauts.' },
};

// Ordre d'affichage des attributs
export const ORDRE_ATTRIBUTS = ['force', 'agilite', 'defense', 'vitalite', 'endurance', 'vitesse'];

export const CREATION = {
  nomMin: 3,
  nomMax: 16,
  valeurDepart: 1,        // chaque attribut démarre à 1
  pointsARepartir: 10,    // points à répartir à la création
  valeurMaxAttribut: 100, // plafond de chaque attribut (longue progression)
  creditsDepart: 100,
  // (A) Le gladiateur démarre avec une dague offerte (valeur de reprise nulle)
  armeDepart: 'dague',
};

// ----------------------------------------------------------------------------
//  Apparence (skins) — tout est dessiné procéduralement sur canvas
// ----------------------------------------------------------------------------
export const SKINS = {
  peau: [
    { id: 'p1', nom: 'Porcelaine', couleur: '#f6d7bf' },
    { id: 'p2', nom: 'Pêche',      couleur: '#eab48f' },
    { id: 'p3', nom: 'Olive',      couleur: '#c89468' },
    { id: 'p4', nom: 'Cannelle',   couleur: '#a36c43' },
    { id: 'p5', nom: 'Cacao',      couleur: '#7a4a2c' },
    { id: 'p6', nom: 'Ébène',      couleur: '#4e2e1c' },
  ],
  coiffure: [
    { id: 'chauve',   nom: 'Crâne rasé' },
    { id: 'court',    nom: 'Cheveux courts' },
    { id: 'crete',    nom: 'Crête' },
    { id: 'queue',    nom: 'Queue de cheval' },
    { id: 'boucles',  nom: 'Boucles' },
    { id: 'barbe',    nom: 'Barbe de vétéran' },
  ],
  cheveux: [
    { id: 'c1', nom: 'Noir',     couleur: '#221a15' },
    { id: 'c2', nom: 'Châtain',  couleur: '#6b3f1f' },
    { id: 'c3', nom: 'Roux',     couleur: '#b24a1b' },
    { id: 'c4', nom: 'Blond',    couleur: '#e1b54f' },
    { id: 'c5', nom: 'Gris',     couleur: '#9a9a96' },
  ],
  tunique: [
    { id: 't1', nom: 'Pourpre impérial', couleur: '#8e1f2c' },
    { id: 't2', nom: 'Bleu d’Égée',      couleur: '#245a9c' },
    { id: 't3', nom: 'Vert d’olivier',   couleur: '#4f6e2a' },
    { id: 't4', nom: 'Safran',           couleur: '#d98f1e' },
    { id: 't5', nom: 'Violet de Tyr',    couleur: '#5e2d79' },
    { id: 't6', nom: 'Lin blanc',        couleur: '#e8dfc8' },
  ],
};

// ----------------------------------------------------------------------------
//  Armes
//  degats      : dégâts de base (avant Force et multiplicateur d'attaque)
//  cadence     : vitesse d'attaque en % (+20 = coups 20 % plus rapides)
//  allonge     : 1 = courte portée, 2 = longue portée (voir TEMPS_REEL.allonges)
//  ignoreArmure : part de l'armure adverse ignorée (0,3 = 30 %)
//  coutStamina : multiplicateur du coût en stamina de l'attaque lourde
//  palier      : 0 = de base, 1 à 3 = gamme de prix
// ----------------------------------------------------------------------------
export const ARMES = {
  poings: {
    nom: 'Poings nus', palier: 0, prix: 0, vendable: false,
    degats: 2, cadence: 25, allonge: 1, ignoreArmure: 0, coutStamina: 1,
    particularite: 'Toujours disponibles quand aucune arme n’est équipée. Très rapides.',
  },
  dague: {
    nom: 'Dague', palier: 1, prix: 60,
    degats: 5, cadence: 20, allonge: 1, ignoreArmure: 0, coutStamina: 1,
    particularite: 'Frappe très vite (+20 % de vitesse d’attaque).',
  },
  glaive: {
    nom: 'Épée courte', palier: 1, prix: 140,
    degats: 8, cadence: 5, allonge: 1, ignoreArmure: 0, coutStamina: 1,
    particularite: 'Équilibrée, sans faiblesse.',
  },
  lance: {
    nom: 'Lance', palier: 1, prix: 170,
    degats: 7, cadence: 0, allonge: 2, ignoreArmure: 0, coutStamina: 1,
    particularite: 'Longue portée : frappe de plus loin.',
  },
  masse: {
    nom: 'Masse', palier: 2, prix: 320,
    degats: 10, cadence: -5, allonge: 1, ignoreArmure: 0.3, coutStamina: 1,
    particularite: 'Ignore 30 % de l’armure adverse.',
  },
  hache: {
    nom: 'Hache', palier: 2, prix: 340,
    degats: 13, cadence: -12, allonge: 1, ignoreArmure: 0, coutStamina: 1,
    particularite: 'Gros dégâts, mais coups un peu plus lents (−12 %).',
  },
  trident: {
    nom: 'Trident', palier: 3, prix: 650,
    degats: 12, cadence: 0, allonge: 2, ignoreArmure: 0.1, coutStamina: 1,
    particularite: 'Longue portée, ignore 10 % de l’armure.',
  },
  marteau: {
    nom: 'Marteau de guerre', palier: 3, prix: 700,
    degats: 19, cadence: -25, allonge: 1, ignoreArmure: 0.15, coutStamina: 1.5,
    particularite: 'Dégâts énormes, mais lent (−25 %) et attaque lourde plus coûteuse.',
  },
};

// ----------------------------------------------------------------------------
//  Armures — 4 emplacements, 4 matériaux
//  Casque, plastron et jambières donnent de l'ARMURE (réduction en %).
//  Le bouclier renforce la GARDE (la parade), voir TEMPS_REEL.parade.
// ----------------------------------------------------------------------------
export const EMPLACEMENTS = {
  casque:    { nom: 'Casque',    stat: 'armure' },
  plastron:  { nom: 'Plastron',  stat: 'armure' },
  jambieres: { nom: 'Jambières', stat: 'armure' },
  bouclier:  { nom: 'Bouclier',  stat: 'bouclier' },
};
export const ORDRE_EMPLACEMENTS = ['casque', 'plastron', 'jambieres', 'bouclier'];

export const MATERIAUX = {
  cuir:   { nom: 'Cuir',   couleur: '#8a5a32', reflet: '#b27a4a' },
  bronze: { nom: 'Bronze', couleur: '#b0762b', reflet: '#e3aa55' },
  fer:    { nom: 'Fer',    couleur: '#7d848c', reflet: '#b9c0c7' },
  acier:  { nom: 'Acier',  couleur: '#aab6c4', reflet: '#eef4fb' },
};
export const ORDRE_MATERIAUX = ['cuir', 'bronze', 'fer', 'acier'];

// id d'une armure = `${emplacement}_${materiau}` (ex. "casque_fer")
const VALEURS_ARMURES = {
  //            valeur par matériau (cuir, bronze, fer, acier)   prix par matériau
  casque:    { valeurs: [2, 4, 6, 9],     prix: [40, 120, 280, 550] },
  plastron:  { valeurs: [4, 7, 11, 16],   prix: [70, 200, 450, 900] },
  jambieres: { valeurs: [2, 4, 6, 9],     prix: [40, 120, 280, 550] },
  bouclier:  { valeurs: [10, 18, 28, 40], prix: [50, 150, 350, 700] },
};

export const ARMURES = {};
for (const emplacement of ORDRE_EMPLACEMENTS) {
  ORDRE_MATERIAUX.forEach((materiau, i) => {
    ARMURES[`${emplacement}_${materiau}`] = {
      nom: `${EMPLACEMENTS[emplacement].nom} en ${MATERIAUX[materiau].nom.toLowerCase()}`,
      emplacement,
      materiau,
      palier: i + 1,
      prix: VALEURS_ARMURES[emplacement].prix[i],
      valeur: VALEURS_ARMURES[emplacement].valeurs[i],
    };
  });
}

// ----------------------------------------------------------------------------
//  Améliorations et commerce
// ----------------------------------------------------------------------------
export const AMELIORATION = {
  niveauMax: 5,
  bonusParNiveau: 0.12,     // +12 % sur les stats de l'objet par niveau
  coutFacteur: 0.5,         // coût = prix de base × 0,5 × niveau visé
};

export const COMMERCE = {
  // (H) Revente à 50 % du TOTAL investi (achat + améliorations)
  tauxRevente: 0.5,
  // Acheter un objet sur un emplacement occupé revend automatiquement l'ancien
  repriseAutomatique: true,
};

// ----------------------------------------------------------------------------
//  Statistiques dérivées (utilisées par shared/formulas.js)
// ----------------------------------------------------------------------------
export const STATS = {
  pvBase: 50, pvParVitalite: 8,
  staminaBase: 30, staminaParEndurance: 5,
  bouclierParDefense: 2,

  forceVersDegats: 3,               // dégâts = arme + Force × 3

  critiqueBase: 5, critiqueParAgilite: 0.5, critiqueMax: 50, multCritique: 1.5,
  aleaMin: 0.9, aleaMax: 1.1,

  // (B) Réduction d'armure en POURCENTAGE : A / (A + constante), plafonnée
  //     A = armure totale + Défense
  armureConstante: 50,
  reductionMax: 0.75,
  degatsMin: 1,
};

// ----------------------------------------------------------------------------
//  Combat en TEMPS RÉEL (façon jeu de plateforme / versus)
//  Unités : 1 unité ≈ 1 pixel d'une arène de 1600 de large ; temps en secondes.
//  Le serveur simule le combat `frequence` fois par seconde et fait autorité ;
//  le navigateur utilise les mêmes règles pour anticiper ses propres gestes.
// ----------------------------------------------------------------------------
export const TEMPS_REEL = {
  frequence: 60,              // pas de simulation par seconde
  envoisParSeconde: 30,       // états envoyés aux navigateurs par seconde
  dureeMax: 120,              // secondes ; ensuite les juges tranchent (% de PV)
  decompte: 3,                // secondes de « 3, 2, 1, Combat ! »
  interpolation: 0.1,         // retard d'affichage de l'adversaire (fluidité)

  // Dimensions communes à toutes les arènes. Le terrain de chacune (obstacles,
  // plateformes, trous, glace) est décrit plus bas, dans ARENES.
  arene: {
    largeur: 1600,
    murGauche: 70,
    murDroit: 1530,
    limiteChute: -300,        // tomber plus bas que ça dans un trou = mort
  },
  corps: { largeur: 56, hauteur: 150 },

  physique: {
    gravite: 2300,
    chuteMax: 1400,
    acceleration: 4200,       // mise en vitesse au sol
    freinage: 3600,           // arrêt au sol quand on lâche la direction
    controleAir: 0.65,        // part du contrôle gardée en l'air
    // Sur la glace : on accélère moins vite et on glisse longtemps
    glace: { acceleration: 0.3, freinage: 0.12 },
  },
  // Vitesse : course et saut
  deplacement: { vitesseBase: 300, parPointVitesse: 0.012, multMax: 1.9 },
  saut: { impulsionBase: 850, parPointVitesse: 0.004, multMax: 1.35, sautsMax: 2, doubleSaut: 0.9 },

  // Esquive (dash) : courte, rapide, invincible, coûte de la stamina
  esquive: { vitesse: 950, duree: 0.17, invincibilite: 0.22, cout: 20, recharge: 0.5 },

  // Attaques. Durées en secondes pour une cadence normale (divisées par la cadence).
  //   preparation : avant que le coup parte (l'adversaire peut réagir)
  //   active      : le coup peut toucher
  //   recuperation: on ne peut rien faire juste après
  //   recharge    : attente avant de pouvoir refaire CETTE attaque
  attaques: {
    legere: {
      nom: 'Attaque légère', preparation: 0.07, active: 0.1, recuperation: 0.16, recharge: 0.1,
      mult: 0.16, cout: 0, allonge: 1, recul: 260, reculHaut: 60, etourdissement: 0.22,
    },
    lourde: {
      nom: 'Attaque lourde', preparation: 0.32, active: 0.12, recuperation: 0.34, recharge: 0.45,
      mult: 0.52, cout: 22, allonge: 1.15, recul: 620, reculHaut: 330, etourdissement: 0.5,
    },
  },
  // Longueur de la zone de frappe selon l'allonge de l'arme (1 = courte, 2 = longue)
  allonges: { 1: 95, 2: 155 },
  // Agilité et arme accélèrent les attaques : cadence = (1 + Agilité × 1,2 %) × (1 + bonus d'arme)
  cadence: { parPointAgilite: 0.012, multMax: 1.8, multMin: 0.6 },

  // Stamina : se consomme (esquive, attaque lourde) et remonte avec le temps
  stamina: { regenBase: 14, regenParEndurance: 0.6, delaiRegen: 0.6 },

  // Parade : maintenir la touche. Les coups reçus de face vident la GARDE au lieu
  // des PV ; garde vide = garde brisée (sonné). Une parade lancée au tout dernier
  // moment est PARFAITE : l'attaquant est sonné.
  parade: {
    reductionDegats: 0.85,     // part des dégâts arrêtée
    ralentissement: 0.3,       // vitesse de déplacement gardée en parant
    gardeBase: 30,             // garde = 30 + 1,5 × bouclier (objet + Défense × 2)
    gardeParBouclier: 1.5,
    regenGarde: 14,            // par seconde, quand on ne pare pas
    delaiRegenGarde: 1.0,
    etourdissementBrise: 1.1,
    fenetreParfaite: 0.14,
    etourdissementParfait: 0.75,
  },
};

// ----------------------------------------------------------------------------
//  Règles communes des combats
// ----------------------------------------------------------------------------
export const COMBAT = {
  delaiReconnexion: 30,      // secondes pour revenir après une déconnexion
};

// ----------------------------------------------------------------------------
//  Arènes : tirées au hasard quand on entre au Colisée.
//  Aucun bonus de stats : seul le TERRAIN change (même terrain pour les deux
//  combattants, et chaque arène est symétrique, donc équitable).
//
//  terrain :
//    departs     : position de départ des deux combattants (x)
//    blocs       : objets SOLIDES (caisses, rochers…) : on monte dessus, on ne
//                  les traverse pas. { x1, x2, haut, bas (0 par défaut), type }
//    plateformes : on les traverse par-dessous, on en descend avec « bas ». { x1, x2, y }
//    trous       : pas de sol entre x1 et x2 : y tomber = MORT (défaite immédiate)
//    typeTrou    : 'gouffre' | 'lave' | 'crevasse' (aspect et message)
//    glaces      : sol glissant entre x1 et x2
//    decors      : objets pour le décor seulement (on passe devant). { x, type }
//    style       : aspect des plateformes ('marbre', 'gres', 'bois', 'basalte', 'glace')
//  Hauteurs utiles : un saut monte d'environ 155, un double saut d'environ 280
//  (plus avec de la Vitesse). Le monde affiché fait 480 de haut.
// ----------------------------------------------------------------------------
export const ARENES = {
  colisee: {
    nom: 'Grand Colisée',
    description: 'Dix mille spectateurs, du sable chaud et pas de pitié.',
    particularites: 'Caisses d’armes et gradins de marbre. Pas de piège : l’arène des duels réguliers.',
    terrain: {
      style: 'marbre',
      departs: [470, 1130],
      blocs: [
        { x1: 70, x2: 170, haut: 80, type: 'caisse' },
        { x1: 84, x2: 156, bas: 80, haut: 140, type: 'caisse' },
        { x1: 1430, x2: 1530, haut: 80, type: 'caisse' },
        { x1: 1444, x2: 1516, bas: 80, haut: 140, type: 'caisse' },
      ],
      plateformes: [
        { x1: 330, x2: 650, y: 200 },
        { x1: 950, x2: 1270, y: 200 },
        { x1: 700, x2: 900, y: 300 },
      ],
      decors: [{ x: 250, type: 'ratelier' }, { x: 1350, type: 'ratelier' }, { x: 800, type: 'amphores' }],
    },
  },
  desert: {
    nom: 'Arène du Désert',
    description: 'Un temple ensablé, écrasé de soleil, dont le sol s’est effondré.',
    particularites: '⚠ Deux gouffres sans fond près des murs : un coup lourd peut t’y précipiter.',
    terrain: {
      style: 'gres',
      departs: [560, 1040],
      typeTrou: 'gouffre',
      trous: [{ x1: 250, x2: 410 }, { x1: 1190, x2: 1350 }],
      blocs: [
        { x1: 100, x2: 175, haut: 110, type: 'pierre' },
        { x1: 1425, x2: 1500, haut: 110, type: 'pierre' },
        { x1: 760, x2: 840, haut: 60, type: 'pierre' },
      ],
      plateformes: [
        { x1: 220, x2: 440, y: 190 },
        { x1: 1160, x2: 1380, y: 190 },
        { x1: 650, x2: 950, y: 250 },
      ],
      decors: [{ x: 520, type: 'amphores' }, { x: 1080, type: 'amphores' }],
    },
  },
  foret: {
    nom: 'Clairière Sacrée',
    description: 'Un vieux sanctuaire oublié au cœur de la forêt.',
    particularites: 'Souches, tronc couché et passerelles suspendues : l’arène la plus verticale.',
    terrain: {
      style: 'bois',
      departs: [500, 1100],
      blocs: [
        { x1: 250, x2: 330, haut: 65, type: 'souche' },
        { x1: 1270, x2: 1350, haut: 65, type: 'souche' },
        { x1: 710, x2: 890, haut: 45, type: 'tronc' },
      ],
      plateformes: [
        { x1: 120, x2: 400, y: 190 },
        { x1: 1200, x2: 1480, y: 190 },
        { x1: 520, x2: 700, y: 250 },
        { x1: 900, x2: 1080, y: 250 },
        { x1: 700, x2: 900, y: 340 },
      ],
      decors: [{ x: 420, type: 'buisson' }, { x: 1180, type: 'buisson' }, { x: 640, type: 'buisson' }],
    },
  },
  volcan: {
    nom: 'Cratère Ardent',
    description: 'On se bat ici au pied d’un volcan qui gronde.',
    particularites: '⚠ Deux bassins de lave entre les combattants : y tomber, c’est la mort.',
    terrain: {
      style: 'basalte',
      departs: [300, 1300],
      typeTrou: 'lave',
      trous: [{ x1: 470, x2: 640 }, { x1: 960, x2: 1130 }],
      blocs: [
        { x1: 120, x2: 210, haut: 90, type: 'basalte' },
        { x1: 1390, x2: 1480, haut: 90, type: 'basalte' },
      ],
      plateformes: [
        { x1: 430, x2: 680, y: 210 },
        { x1: 920, x2: 1170, y: 210 },
        { x1: 720, x2: 880, y: 320 },
      ],
      decors: [{ x: 700, type: 'brasero' }, { x: 900, type: 'brasero' }],
    },
  },
  neige: {
    nom: 'Col Enneigé',
    description: 'Un combat dans le froid, au sommet des montagnes.',
    particularites: '⚠ Une crevasse au centre, bordée de glace glissante : freine à temps !',
    terrain: {
      style: 'glace',
      departs: [420, 1180],
      typeTrou: 'crevasse',
      trous: [{ x1: 735, x2: 865 }],
      glaces: [{ x1: 520, x2: 735 }, { x1: 865, x2: 1080 }],
      blocs: [
        { x1: 150, x2: 240, haut: 75, type: 'roc' },
        { x1: 1360, x2: 1450, haut: 75, type: 'roc' },
      ],
      plateformes: [
        { x1: 290, x2: 560, y: 200 },
        { x1: 1040, x2: 1310, y: 200 },
        { x1: 690, x2: 910, y: 290 },
      ],
      decors: [{ x: 110, type: 'brasero' }, { x: 1490, type: 'brasero' }],
    },
  },
};
export const ORDRE_ARENES = ['colisee', 'desert', 'foret', 'volcan', 'neige'];

// ----------------------------------------------------------------------------
//  Progression et récompenses
// ----------------------------------------------------------------------------
export const PROGRESSION = {
  // (G) Niveau = 1 + points de capacité gagnés ÷ 3 (arrondi vers le bas)
  pointsParNiveau: 3,
  // Réinitialisation des points de compétence (menu ⚙ Paramètres) :
  // coût = points investis × coutParPoint, avec un minimum
  reinitialisation: { coutParPoint: 5, coutMinimum: 25 },
};

export const RECOMPENSES = {
  // (F) Bonus selon les PV restants : jusqu'à bonusPvMax crédits (au prorata)
  joueur: {
    victoire: { credits: 100, points: 3, bonusPvMax: 50 },
    defaite:  { credits: 40,  points: 1, bonusPvMax: 0 },
  },
  // Combats contre un bot : selon la difficulté choisie
  ia: {
    facile: {
      victoire: { credits: 30, points: 1, bonusPvMax: 15 },
      defaite:  { credits: 10, points: 0, bonusPvMax: 0 },
    },
    normal: {
      victoire: { credits: 50, points: 1, bonusPvMax: 25 },
      defaite:  { credits: 20, points: 0, bonusPvMax: 0 },
    },
    difficile: {
      victoire: { credits: 80, points: 2, bonusPvMax: 40 },
      defaite:  { credits: 30, points: 0, bonusPvMax: 0 },
    },
  },
};

// ----------------------------------------------------------------------------
//  Bots (adversaires contrôlés par l'ordinateur) et leurs 3 difficultés
//  multPoints     : total de points d'attributs du bot par rapport au joueur
//  multEquipement : valeur de l'équipement du bot par rapport à celui du joueur
//  Comportement en temps réel :
//  reaction       : temps (s) avant de réagir à ce que fait l'adversaire
//  parade         : chance de parer une attaque qu'il voit venir
//  paradeParfaite : chance que cette parade tombe pile au bon moment
//  esquive        : chance d'esquiver (dash) une attaque lourde qui arrive
//  agressivite    : envie d'attaquer plutôt que d'attendre
//  lourde         : part d'attaques lourdes
//  hesitation     : part de moments où il hésite ou se trompe
// ----------------------------------------------------------------------------
export const DIFFICULTES = {
  facile: {
    nom: 'Facile', icone: '🌿', titre: 'la Recrue',
    description: 'Un débutant maladroit, un peu plus faible que toi. Idéal pour s’entraîner.',
    multPoints: 0.85, multEquipement: 0.65,
    reaction: 0.4, parade: 0.12, paradeParfaite: 0, esquive: 0.05, agressivite: 0.55, lourde: 0.15, hesitation: 0.35,
  },
  normal: {
    nom: 'Normal', icone: '⚔️', titre: 'le Gladiateur',
    description: 'Un adversaire de ton niveau qui sait se battre.',
    multPoints: 0.95, multEquipement: 0.9,
    reaction: 0.25, parade: 0.4, paradeParfaite: 0.08, esquive: 0.2, agressivite: 0.75, lourde: 0.25, hesitation: 0.12,
  },
  difficile: {
    nom: 'Difficile', icone: '🔥', titre: 'le Champion',
    description: 'Un champion rusé et un peu plus fort que toi : il anticipe tes coups.',
    multPoints: 1.05, multEquipement: 1.05,
    reaction: 0.15, parade: 0.65, paradeParfaite: 0.3, esquive: 0.4, agressivite: 0.85, lourde: 0.3, hesitation: 0.03,
  },
};
export const ORDRE_DIFFICULTES = ['facile', 'normal', 'difficile'];

export const IA = {
  ecartPoints: 2,             // variation aléatoire du total de points du bot (±2)
  ecartValeurEquipement: 0.2, // variation aléatoire de la valeur d'équipement (±20 %)
  noms: ['Brutus Ferox', 'Cassia la Vive', 'Draco Minor', 'Octavia Leonis', 'Varro le Taciturne',
         'Lupa Sanguina', 'Titus Malleus', 'Nerva l’Ancien', 'Flavia Tempestas', 'Quintus Umbra',
         'Aurelia Fulgur', 'Maximus Ursus'],
};
