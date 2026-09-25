# ⚔ ARENA GLADIUS

Combats de gladiateurs **1v1 en temps réel**, jouables dans le navigateur avec tes amis.
Crée ton gladiateur, équipe-le chez le forgeron et l'armurière, puis entre au Colisée :
affronte un bot (3 niveaux de difficulté) ou défie un ami en ligne.

Tout est original et créé par le code : dessins sur canvas, bruitages et **musiques d'ambiance
d'inspiration romaine** composées en direct (Web Audio). Aucune image, aucun fichier son.

---

## Sommaire

1. [Lancer le jeu sur ton ordinateur](#1-lancer-le-jeu-sur-ton-ordinateur)
2. [Tester le 1v1 tout seul (deux onglets)](#2-tester-le-1v1-tout-seul-deux-onglets)
3. [Mettre le projet sur GitHub (sans Git)](#3-mettre-le-projet-sur-github-sans-git)
4. [Mettre le jeu en ligne sur Render](#4-mettre-le-jeu-en-ligne-sur-render)
5. [Comment jouer](#5-comment-jouer)
6. [Rééquilibrer le jeu](#6-rééquilibrer-le-jeu)
7. [Organisation du code](#7-organisation-du-code)

---

## 1. Lancer le jeu sur ton ordinateur

Il faut **Node.js 18 ou plus récent**. Sur un PC où tu ne peux rien installer, la version
« portable » (fichier `.zip` sur nodejs.org) fonctionne très bien.

Ouvre un terminal **dans le dossier du projet** (`arena-gladius`), puis :

```bash
npm install
npm start
```

Le terminal affiche `ARENA GLADIUS est en ligne : http://localhost:3000`.
Ouvre cette adresse dans ton navigateur.

> Avec Node portable, si la commande `npm` est introuvable, indique le chemin complet,
> par exemple : `D:\Code\Claude\_node\node-v24.21.0-win-x64\npm.cmd install`
> puis `...\npm.cmd start`.

Pour lancer les tests automatiques (formules, boutique, combats, IA, réseau) :

```bash
npm test
```

## 2. Tester le 1v1 tout seul (deux onglets)

Deux onglets du même navigateur partagent la même sauvegarde. Pour avoir **deux gladiateurs
différents**, ajoute `?profil=2` à l'adresse du deuxième onglet :

- onglet 1 : `http://localhost:3000`
- onglet 2 : `http://localhost:3000/?profil=2`

Crée un gladiateur dans chaque onglet. Dans le village, le panneau **« Gladiateurs en ligne »**
(en haut à droite) affiche l'autre joueur : clique sur **⚔ Défier**, puis accepte le défi dans
l'autre onglet.

**Mode test** : ajoute `?test` à l'adresse (ex. `http://localhost:3000/?test`). Dans
⚙ Paramètres, des boutons « Simuler une victoire / défaite » donnent des crédits et des points
pour essayer la boutique et la progression sans combattre.

## 3. Mettre le projet sur GitHub (sans Git)

Tout se fait depuis le site de GitHub, sans rien installer.

1. Connecte-toi sur <https://github.com> et clique sur **New** (nouveau dépôt).
2. Nom : `arena-gladius`, visibilité **Public** (ou Private), puis **Create repository**.
3. Sur la page du dépôt vide, clique sur **uploading an existing file**.
4. Ouvre le dossier `arena-gladius` sur ton ordinateur et **glisse-dépose tout son contenu**
   dans la page : les dossiers `client`, `server`, `shared`, `tests` et les fichiers
   `package.json`, `package-lock.json`, `README.md`, `.gitignore`.
   ⚠ **Ne mets pas le dossier `node_modules`** : il est très lourd et Render le recrée tout seul.
5. En bas de la page, clique sur **Commit changes**.

Pour mettre à jour le jeu plus tard : dans le dépôt, **Add file → Upload files**, dépose les
fichiers modifiés (en gardant les mêmes dossiers), puis **Commit changes**.

## 4. Mettre le jeu en ligne sur Render

1. Crée un compte sur <https://render.com> (le plus simple : **Sign in with GitHub**).
2. **New → Web Service**, puis choisis ton dépôt `arena-gladius`
   (autorise Render à lire tes dépôts GitHub si c'est demandé).
3. Réglages :
   | Champ | Valeur |
   |---|---|
   | Language / Runtime | **Node** |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
4. Clique sur **Deploy Web Service**. Après 1 à 3 minutes, Render affiche
   « Your service is live » et une adresse du type `https://arena-gladius-xxxx.onrender.com`.
5. Envoie cette adresse à tes amis : c'est le jeu !

Bon à savoir :

- Le serveur écoute automatiquement le port fourni par Render (`process.env.PORT`), et le
  navigateur se connecte au serveur à la même adresse : il n'y a rien à configurer.
- L'offre gratuite **met le serveur en veille après 15 minutes sans visite**. Le premier
  chargement suivant prend alors 30 à 60 secondes : c'est normal.
- Quand tu mets à jour le dépôt GitHub, Render redéploie tout seul (les combats en cours
  à ce moment-là sont perdus, mais les gladiateurs sont sauvegardés dans les navigateurs).
- Pour vérifier que le serveur tourne : `https://ton-adresse.onrender.com/sante`.

## 5. Comment jouer

### Création et village
- Choisis un nom, une apparence et répartis **10 points** entre les 6 attributs.
- Au village : clique sur la **forge** (armes), l'**armurerie** (armures) ou le **Colisée**
  (combats). Le bouton **🏠 Village** te ramène toujours au village, **⚙ Paramètres** sert à
  répartir tes points de compétence et à sauvegarder.

### Attributs (maximum 100 chacun)
| Attribut | Effet en combat |
|---|---|
| 💪 Force | dégâts de tes attaques (+3 de base par point) |
| 🎯 Agilité | vitesse d'attaque (+1,2 % par point) et coups critiques |
| 🛡 Défense | réduit les dégâts reçus et renforce ta garde |
| ❤ Vitalité | +8 PV |
| ⚡ Endurance | plus de stamina, qui remonte plus vite |
| 🪶 Vitesse | course plus rapide et sauts plus hauts |

Les armes ont aussi leur caractère : la dague frappe vite, la lance et le trident frappent
de loin, le marteau frappe très fort mais lentement.

### Combat (en temps réel)
Deux gladiateurs s'affrontent dans l'arène tirée au sort. On gagne quand les PV de
l'adversaire tombent à 0, ou s'il **tombe dans un trou** (voir « Les arènes » plus bas).
Après **2 minutes**, les juges donnent la victoire au plus haut % de PV restants.

| Commande | Clavier AZERTY (QWERTY) | Manette |
|---|---|---|
| Se déplacer | Q / D ou ← → (A / D) | stick ou croix |
| Sauter, double saut | Z ou Espace (W) | A |
| Descendre d'une plateforme | S ou ↓ | bas |
| Attaque légère | E ou clic gauche | X |
| Attaque lourde | R ou clic droit | Y |
| Parer (maintenir) | A (Q) | gâchettes |
| Esquive (dash) | Maj | B |

- **Attaque légère** : rapide, peu de dégâts. **Attaque lourde** : se prépare plus longtemps
  (un **!** rouge prévient l'adversaire), fait très mal et coûte de la stamina.
- **Parer** : les coups reçus de face vident ta **garde** (barre bleue) au lieu de tes PV.
  Garde vide = **garde brisée**, tu es sonné. Si tu lèves la garde **au tout dernier
  moment**, c'est une **parade parfaite** : c'est l'attaquant qui est sonné.
- **Esquive** : un dash rapide pendant lequel on est invincible. Coûte de la stamina.
- **Stamina** (barre jaune) : se vide avec les esquives et les attaques lourdes, puis
  remonte toute seule.
- Abandonner compte comme une défaite. Si un joueur se déconnecte, le combat se met en
  **pause** : il a **30 secondes** pour revenir.

### Les arènes
L'arène est tirée au sort à chaque entrée au Colisée. Aucun bonus de stats : c'est le
**terrain** qui change. Chaque arène est symétrique, donc équitable.

| Arène | Terrain |
|---|---|
| Grand Colisée | caisses d'armes, trois gradins de marbre ; aucun piège |
| Arène du Désert | ruines de grès à escalader, **deux gouffres sans fond** près des murs |
| Clairière Sacrée | souches, tronc couché, passerelles suspendues : la plus verticale |
| Cratère Ardent | rochers de basalte, **deux bassins de lave** entre les combattants |
| Col Enneigé | rochers, **une crevasse** au centre, bordée de **glace glissante** |

- **Blocs** (caisses, pierres, souches, rochers) : solides, on monte dessus en sautant.
- **Plateformes** : on les traverse par-dessous et on en descend avec **S** / ↓.
- **Trous** (gouffre, lave, crevasse) : y tomber, c'est **perdu**. Quand on tombe d'un bord,
  il reste le double saut pour se rattraper. Une esquive lancée près du bord passe
  au-dessus, et une attaque lourde près du bord peut y envoyer l'adversaire.
- **Glace** : on accélère et on freine mal, même quand on est repoussé par un coup.

### Jouer en solo : les bots
Au Colisée, **🤖 Combattre un bot** propose 3 difficultés. Le bot est créé à ta mesure
(il suit ta progression), puis :

| Difficulté | Force du bot | Façon de jouer |
|---|---|---|
| 🌿 Facile | ~15 % de points et ~35 % d'équipement en moins | lent à réagir, pare rarement, hésite souvent |
| ⚔️ Normal | proche de toi | pare ou esquive une partie de tes coups, attaque à portée |
| 🔥 Difficile | ~5 % de points et d'équipement en plus | réagit vite, pare (souvent parfaitement), esquive tes attaques lourdes, punit tes erreurs |


### Récompenses
| | Crédits | Points de compétence |
|---|---|---|
| Victoire contre un ami | 100 + jusqu'à 50 de bonus selon tes PV restants | 3 |
| Défaite contre un ami | 40 | 1 |
| Victoire contre un bot Facile | 30 + jusqu'à 15 de bonus | 1 |
| Victoire contre un bot Normal | 50 + jusqu'à 25 de bonus | 1 |
| Victoire contre un bot Difficile | 80 + jusqu'à 40 de bonus | **2** |
| Défaite contre un bot | 10 / 20 / 30 (selon la difficulté) | 0 |

### Musique et sons
Chaque lieu a sa musique, composée en direct par le jeu dans des modes antiques, avec des
imitations d'instruments de l'époque : lyre et cithare, aulos (flûte double), cornu (trompe
de bronze), tympanum (tambour), crotales (cymbalettes).

| Lieu | Ambiance |
|---|---|
| Écran titre, village, forge, armurerie | calmes : nappe douce, lyre qui improvise, flûte discrète (on y reste longtemps) |
| Colisée | la foule gronde, les tambours montent |
| Combat | rapide et martiale (150 battements par minute) |
| Victoire / Défaite | fanfare / complainte |

La musique démarre au premier clic : les navigateurs l'imposent. Le bouton **🔊** (barre du haut,
écran titre, combat) ouvre les **réglages du son** : un curseur pour la musique et un pour
les bruitages. À 0, le son est coupé. Les réglages sont mémorisés.
Les thèmes se modifient dans `client/js/musique.js` (tempo, mode, instruments, rythmes).

### Sauvegarde
Ton gladiateur est sauvegardé automatiquement **dans ton navigateur**. Pour ne pas le perdre
(ou jouer sur un autre ordinateur) : ⚙ Paramètres → **Exporter** copie un code de sauvegarde ;
colle-le dans **Importer** sur l'autre ordinateur.

## 6. Rééquilibrer le jeu

Toutes les valeurs sont dans **`shared/data.js`** (armes, armures, prix, combat, terrains des
arènes, récompenses, difficultés des bots…) et toutes les formules dans **`shared/formulas.js`**. Ces fichiers servent
à la fois au serveur et au navigateur : une modification s'applique partout.

Le **📜 Codex de l'arène** (écran titre) affiche les tableaux calculés à partir de ces fichiers :
pratique pour vérifier un réglage. Pense à relancer `npm test` après un changement.

## 7. Organisation du code

```
server/
  index.js      Express + Socket.IO : sert le jeu et gère les connexions
  lobby.js      joueurs connectés, défis, lancement des combats
  matchs.js     un combat en réseau : simulation 60 fois/s, bots, déconnexions, récompenses
  ai.js         bots : génération (3 difficultés) et cerveau en temps réel
shared/
  data.js       toutes les données d'équilibrage
  formulas.js   toutes les formules
  boutique.js   achat, amélioration, revente, points, récompenses
  validation.js création du gladiateur et vérification des sauvegardes
  combat.js     moteur du combat en temps réel (serveur ET navigateur)
  terrain.js    terrain des arènes : blocs, plateformes, trous, glace
client/
  index.html, css/
  js/main.js         démarrage, boucle d'affichage
  js/ecrans/         titre, création, village, boutique, arène, combat, paramètres, codex
  js/rendu/          dessins canvas (gladiateur, village, boutiques, décors, terrains, combat)
  js/reseau.js       connexion au serveur
  js/combat/         commandes (clavier, manette) et anticipation des mouvements
  js/defis.js        joueurs en ligne et défis
tests/          tests automatiques (npm test)
```

Le serveur **fait autorité** sur les combats : il simule le combat 60 fois par seconde et
décide de chaque coup. Le navigateur n'envoie que les touches pressées. Pour que les
commandes répondent tout de suite malgré le délai du réseau, il **anticipe** les mouvements
de ton gladiateur avec les mêmes règles que le serveur, puis se recale en douceur ; l'adversaire
est affiché de façon lissée. Pour tester en local comme sur un vrai serveur, ajoute
`?latence=120` à l'adresse (120 ms de délai simulé).

**Hors périmètre de la v1** (le code est prévu pour les ajouter plus tard) : 2v2, comptes avec
mot de passe, base de données, classement, chat.
