// ============================================================================
//  ARENA GLADIUS — shared/data.js
//
//  TOUTES les données d'équilibrage du jeu sont ici : attributs, armes,
//  armures, actions de combat, arènes, économie, récompenses, IA.
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
  force:     { nom: 'Force',     icone: '💪', description: 'Augmente les dégâts infligés.' },
  agilite:   { nom: 'Agilité',   icone: '🎯', description: 'Augmente la précision, l’esquive et les chances de critique.' },
  defense:   { nom: 'Défense',   icone: '🛡️', description: 'Réduit les dégâts reçus et augmente le bouclier max.' },
  vitalite:  { nom: 'Vitalité',  icone: '❤️', description: 'Augmente les points de vie max.' },
  endurance: { nom: 'Endurance', icone: '⚡', description: 'Augmente la stamina max.' },
  vitesse:   { nom: 'Vitesse',   icone: '🪶', description: 'Joue en premier, esquive les adversaires plus lents, se déplace pour moins cher.' },
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
//  precision   : bonus de précision en points de % (ex. 15 = +15 %)
//  porteeMin/Max : distance (en cases) à laquelle l'arme peut frapper
//  ignoreArmure : part de l'armure adverse ignorée (0,3 = 30 %)
//  coutStamina : multiplicateur du coût en stamina des attaques
//  palier      : 0 = de base, 1 à 3 = gamme de prix
// ----------------------------------------------------------------------------
export const ARMES = {
  poings: {
    nom: 'Poings nus', palier: 0, prix: 0, vendable: false,
    degats: 2, precision: 5, porteeMin: 1, porteeMax: 1, ignoreArmure: 0, coutStamina: 1,
    particularite: 'Toujours disponibles quand aucune arme n’est équipée.',
  },
  dague: {
    nom: 'Dague', palier: 1, prix: 60,
    degats: 5, precision: 15, porteeMin: 1, porteeMax: 1, ignoreArmure: 0, coutStamina: 1,
    particularite: '+15 % de précision.',
  },
  glaive: {
    nom: 'Épée courte', palier: 1, prix: 140,
    degats: 8, precision: 5, porteeMin: 1, porteeMax: 1, ignoreArmure: 0, coutStamina: 1,
    particularite: 'Équilibrée, sans faiblesse.',
  },
  lance: {
    nom: 'Lance', palier: 1, prix: 170,
    degats: 7, precision: 0, porteeMin: 1, porteeMax: 2, ignoreArmure: 0, coutStamina: 1,
    particularite: 'Frappe à 1 ou 2 cases.',
  },
  masse: {
    nom: 'Masse', palier: 2, prix: 320,
    degats: 10, precision: 0, porteeMin: 1, porteeMax: 1, ignoreArmure: 0.3, coutStamina: 1,
    particularite: 'Ignore 30 % de l’armure adverse.',
  },
  hache: {
    nom: 'Hache', palier: 2, prix: 340,
    degats: 13, precision: -10, porteeMin: 1, porteeMax: 1, ignoreArmure: 0, coutStamina: 1,
    particularite: 'Gros dégâts, −10 % de précision.',
  },
  trident: {
    nom: 'Trident', palier: 3, prix: 650,
    degats: 12, precision: 5, porteeMin: 1, porteeMax: 2, ignoreArmure: 0.1, coutStamina: 1,
    particularite: 'Portée 2 cases, ignore 10 % de l’armure.',
  },
  marteau: {
    nom: 'Marteau de guerre', palier: 3, prix: 700,
    degats: 19, precision: -5, porteeMin: 1, porteeMax: 1, ignoreArmure: 0.15, coutStamina: 1.5,
    particularite: 'Dégâts énormes, attaques 50 % plus coûteuses en stamina.',
  },
};

// ----------------------------------------------------------------------------
//  Armures — 4 emplacements, 4 matériaux
//  Casque, plastron et jambières donnent de l'ARMURE (réduction en %).
//  Le bouclier donne des POINTS DE BOUCLIER (absorbent les dégâts avant les PV).
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
  regenStaminaParTour: 5,           // gagnée au début de CHAQUE tour du combattant
  bouclierParDefense: 2,

  forceVersDegats: 3,               // dégâts = arme + Force × 3
  agiliteVersPrecision: 2,          // ±2 % de précision par point d'écart d'Agilité
  vitesseVersEsquive: 1.5,          // (D) +1,5 % d'esquive par point de Vitesse d'avance sur l'attaquant...
  esquiveVitesseMax: 25,            //     ...plafonnée à 25 %
  precisionMin: 10, precisionMax: 95,

  critiqueBase: 5, critiqueParAgilite: 0.5, critiqueMax: 50, multCritique: 1.5,
  aleaMin: 0.9, aleaMax: 1.1,

  // (B) Réduction d'armure en POURCENTAGE : A / (A + constante), plafonnée
  //     A = armure totale + Défense
  armureConstante: 50,
  reductionMax: 0.75,
  degatsMin: 1,

  // (D) Chaque point de Vitesse au-delà de 1 réduit le coût des déplacements
  //     et de la charge de 10 %, sans descendre sous 40 % du coût de base
  vitesseReductionDeplacement: 0.10,
  coutDeplacementPlancher: 0.4,
};

// ----------------------------------------------------------------------------
//  Actions de combat
//  type : 'deplacement' | 'attaque' | 'charge' | 'protection' | 'repos' | 'provocation'
//  (C) (E) Certaines actions ne peuvent pas être jouées deux tours de suite
// ----------------------------------------------------------------------------
export const ACTIONS = {
  avancer:   { nom: 'Avancer',  type: 'deplacement', cout: 3, pas: +1, touche: 'Z',
               description: 'Avance d’une case vers l’adversaire.' },
  reculer:   { nom: 'Reculer',  type: 'deplacement', cout: 3, pas: -1, touche: 'S',
               description: 'Recule d’une case.' },
  charger:   { nom: 'Charger',  type: 'charge', cout: 15, distanceMin: 2, distanceMax: 3,
               attaque: 'rapide', touche: 'C',
               description: 'Fonce au contact (adversaire à 2 ou 3 cases) et enchaîne une attaque rapide.' },
  rapide:    { nom: 'Attaque rapide',    type: 'attaque', cout: 5,  mult: 0.6, precision: 85, touche: '1',
               description: 'Peu de dégâts mais touche souvent.' },
  normale:   { nom: 'Attaque normale',   type: 'attaque', cout: 10, mult: 1.0, precision: 70, touche: '2',
               description: 'Coup équilibré.' },
  puissante: { nom: 'Attaque puissante', type: 'attaque', cout: 20, mult: 1.8, precision: 45, touche: '3',
               description: 'Dégâts énormes, souvent esquivée.' },
  proteger:  { nom: 'Se protéger', type: 'protection', cout: 0, reduction: 0.5, rechargeBouclier: 0.2,
               pasDeuxFoisDeSuite: true, touche: 'P',
               description: '−50 % de dégâts jusqu’à ton prochain tour et recharge 20 % du bouclier. Pas deux tours de suite.' },
  reposer:   { nom: 'Se reposer', type: 'repos', cout: 0, recuperation: 0.4, touche: 'R',
               description: 'Récupère 40 % de la stamina max.' },
  provoquer: { nom: 'Provoquer', type: 'provocation', cout: 3, perteStamina: 10,
               chanceBase: 50, chanceParAgilite: 4, chanceMin: 20, chanceMax: 85,
               pasDeuxFoisDeSuite: true, touche: 'T',
               description: 'L’adversaire perd 10 stamina (réussite selon l’Agilité). Pas deux tours de suite.' },
};
export const ORDRE_ACTIONS = ['avancer', 'reculer', 'charger', 'rapide', 'normale', 'puissante', 'proteger', 'reposer', 'provoquer'];

// ----------------------------------------------------------------------------
//  Règles du combat
// ----------------------------------------------------------------------------
export const COMBAT = {
  nbCases: 10,
  caseDepart: [2, 9],        // cases numérotées de 1 à 10
  dureeTour: 20,             // secondes ; à expiration « Se reposer » est joué
  actionParDefaut: 'reposer',
  // (C) Limite de manches : ensuite les juges tranchent au % de PV restants
  manchesMax: 30,
  delaiReconnexion: 30,      // secondes pour revenir après une déconnexion
};

// ----------------------------------------------------------------------------
//  Arènes : tirées au hasard quand on entre au Colisée.
//  Purement visuelles : aucun bonus ni pénalité.
// ----------------------------------------------------------------------------
export const ARENES = {
  colisee: { nom: 'Grand Colisée',    description: 'Dix mille spectateurs, du sable chaud et pas de pitié.' },
  desert:  { nom: 'Arène du Désert',  description: 'Des dunes à perte de vue et un soleil qui ne pardonne pas.' },
  foret:   { nom: 'Clairière Sacrée', description: 'Un vieux sanctuaire oublié au cœur de la forêt.' },
  volcan:  { nom: 'Cratère Ardent',   description: 'On se bat ici au pied d’un volcan qui gronde.' },
  neige:   { nom: 'Col Enneigé',      description: 'Un combat dans le froid, au sommet des montagnes.' },
};
export const ORDRE_ARENES = ['colisee', 'desert', 'foret', 'volcan', 'neige'];

// ----------------------------------------------------------------------------
//  Progression et récompenses
// ----------------------------------------------------------------------------
export const PROGRESSION = {
  // (G) Niveau = 1 + points de capacité gagnés ÷ 3 (arrondi vers le bas)
  pointsParNiveau: 3,
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
//  hasard         : part des tours où le bot joue une action au hasard
//  tactique       : 'simple' (réfléchit) ou 'avancee' (anticipe, garde, distance)
// ----------------------------------------------------------------------------
export const DIFFICULTES = {
  facile: {
    nom: 'Facile', icone: '🌿', titre: 'la Recrue',
    description: 'Un débutant maladroit, un peu plus faible que toi. Idéal pour s’entraîner.',
    multPoints: 0.85, multEquipement: 0.65, hasard: 0.45, tactique: 'simple',
  },
  normal: {
    nom: 'Normal', icone: '⚔️', titre: 'le Gladiateur',
    description: 'Un adversaire de ton niveau qui sait se battre.',
    multPoints: 0.97, multEquipement: 0.9, hasard: 0.12, tactique: 'simple',
  },
  difficile: {
    nom: 'Difficile', icone: '🔥', titre: 'le Champion',
    description: 'Un champion rusé et un peu plus fort que toi : il anticipe tes coups.',
    multPoints: 1.08, multEquipement: 1.1, hasard: 0.02, tactique: 'avancee',
  },
};
export const ORDRE_DIFFICULTES = ['facile', 'normal', 'difficile'];

export const IA = {
  ecartPoints: 2,             // variation aléatoire du total de points du bot (±2)
  ecartValeurEquipement: 0.2, // variation aléatoire de la valeur d'équipement (±20 %)
  delaiReflexion: [0.8, 1.6], // secondes avant que l'IA joue (pour le rythme)
  noms: ['Brutus Ferox', 'Cassia la Vive', 'Draco Minor', 'Octavia Leonis', 'Varro le Taciturne',
         'Lupa Sanguina', 'Titus Malleus', 'Nerva l’Ancien', 'Flavia Tempestas', 'Quintus Umbra',
         'Aurelia Fulgur', 'Maximus Ursus'],
};
