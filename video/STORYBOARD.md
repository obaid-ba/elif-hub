# ELIFE Hub — vidéo de démonstration : analyse, direction et storyboard

Statut : **proposition à valider avant production.** Rien n'est encore filmé ni monté.

---

## 1. Analyse des références

**Limite à connaître.** Je ne peux pas lire de vidéo YouTube : ni lecture, ni téléchargement. Pour chaque lien, j'ai consulté les seules données publiques accessibles : le titre et l'auteur (oEmbed YouTube) et l'**image de couverture** (une seule image). L'analyse ci-dessous porte donc sur la composition visuelle de cette image et sur les codes connus du genre « SaaS explainer ». **Je n'ai analysé ni le rythme réel, ni les transitions, ni le son de ces vidéos.** Pour une analyse du mouvement, il faudrait des extraits téléchargés légalement, ou vos notes avec des minutages.

| # | Vidéo | Ce que montre l'image de couverture | Technique à retenir |
|---|-------|-------------------------------------|---------------------|
| 1 | *Product Demo Video, Infinity* (What a Story) | L'application dans une fenêtre flottante aux coins arrondis, sur un dégradé doux violet-bleu. Des panneaux flous de chaque côté, de grandes icônes rondes et une main-curseur qui « appuie » | **Interface agrandie et isolée** : on recadre sur la vue utile, le reste passe au flou |
| 2 | *Meetris Scheduling App* (TriNet Studios) | Fond sombre, titre en deux lignes à gauche avec **un seul mot en couleur d'accent**. Des cartes de personnes qui sortent de l'interface, reliées par des traits ; la carte principale légèrement lumineuse | **Cartes d'annotation** qui sortent de l'interface pour expliquer un flux ; titre avec un mot-clé coloré |
| 3 | *Coinest Finance Management* (Reveal Motion) | Grand titre centré au-dessus du tableau de bord complet ; une couleur de marque (vert) déclinée partout | **Plan large du tableau de bord** sous un titre, cohérence chromatique stricte |
| 4 | *YC AI Startup Launch* (What a Story) | Dégradé bleu clair, badge en forme de pilule au-dessus du titre, application en perspective légère avec des tuiles flottantes | **Badge + titre + application en perspective** pour l'ouverture et la conclusion |
| 5 | *(à venir)* | | |

**Points communs, que l'on garde :**
- un seul message par plan ;
- un mot-clé en couleur d'accent ;
- l'application cadrée dans une fenêtre propre sur un fond calme ;
- des zooms vers la zone active ;
- des cartes d'annotation sobres ;
- une fin sur le logo.

**Ce que l'on évite :**
- les écrans recréés en motion design : **nous filmons la vraie application** ;
- les personnages illustrés ;
- les effets lumineux appuyés ;
- les transitions spectaculaires.

---

## 2. Analyse de l'application

- **Produit.** ELIFE Hub, la plateforme de pilotage du programme d'incubation ELIFE de la Fondation Tunisie pour le Développement : 6 centres, un PMO central, des chargés de programme et des bénéficiaires.
- **Problème.** Les données sont dispersées entre six centres, la consolidation se fait à la main, les intervenants et les rappels sont oubliés, le PMO a peu de visibilité, et les entrepreneurs restent passifs.
- **Public de la vidéo.** Le jury du hackathon, la FTD et ses partenaires (DRC, Danish-Arab Partnership Programme), les équipes des centres.
- **Fonctions les plus fortes**, toutes réelles et déjà testées :
  1. **« Aujourd'hui » du chargé** : tout ce qu'il a à faire, trié par urgence, à un clic ;
  2. **confirmation de l'intervenant** et alerte à J-3, **rappel J-1** tracé ;
  3. **clôture avec présences**, qui calcule le taux de présence et crée les rapports des bénéficiaires ;
  4. **espace bénéficiaire** : rapports et exercices transformés en actions, accès limité à son propre parcours ;
  5. **rapport d'activité pré-rempli**, soumis par le chargé puis validé et verrouillé par le PMO ;
  6. **tableau de bord PMO** : jauges, barres par centre, comparaison des centres où chaque chiffre est cliquable, alertes ;
  7. bonus : **import Excel** des candidats, avec les doublons et les erreurs signalés.
- **Identité à respecter** (`css/tokens.css`) :
  - accent indigo `#5645D4` ;
  - fond `#F7F7F5` et panneaux blancs ;
  - police Inter ;
  - logo en anneau ;
  - couleurs de statut (vert, orange, rouge) réservées aux statuts.

---

## 3. Direction créative : « Six centres, un seul fil »

- **Ambiance.** Claire, institutionnelle, chaleureuse. Fond `#F7F7F5` avec un halo indigo très léger. La fenêtre de l'application flotte avec une ombre douce.
- **Typographie.** Inter, avec des titres en 600 et un mot-clé en indigo (la technique de la référence 2). Les textes restent courts : 6 mots au maximum par écran.
- **Caméra.**
  - Les zooms sont des transformations CSS lentes (600 à 900 ms, avec un easing décéléré) vers la zone active ;
  - le reste de l'interface s'assombrit légèrement (technique de la référence 1) ;
  - jamais plus d'un mouvement à la fois.
- **Curseur.** Un curseur dessiné et lissé, avec un léger halo au clic. Les clics déclenchent de **vraies actions** dans l'application.
- **Cartes d'annotation** (technique de la référence 2). Petites cartes blanches avec un pictogramme de l'application, qui sortent de l'élément concerné : « Alerte J-3 », « Tracé sur l'activité », « Chiffres figés ».
- **Fil conducteur visuel.** L'anneau du logo réapparaît comme transition entre deux rôles : Chargé → Bénéficiaire → PMO.
- **Rythme.** Environ 90 s, avec une scène toutes les 8 à 12 s.
- **Langue.** Français. Sous-titres anglais possibles en option.

---

## 4. Storyboard (environ 90 s)

| # | Temps | Plan | Texte à l'écran | Interaction réelle |
|---|-------|------|-----------------|--------------------|
| 1 | 0:00–0:05 | **Ouverture** : l'anneau du logo se dessine, puis « ELIFE Hub » | ELIFE **Hub** | aucune |
| 2 | 0:05–0:12 | **Problème** : six pastilles de centres dispersées (Béja, Siliana, Le Kef, Djerba, Tozeur, Sidi Bouzid) qui ne communiquent pas | Six centres. Des fichiers **partout**. | aucune (titrage) |
| 3 | 0:12–0:18 | **Introduction** : les pastilles convergent vers la fenêtre de l'application (plan large de « Pilotage ») | Une plateforme. **Un seul fil.** | aucune |
| 4 | 0:18–0:28 | **Chargé · Aujourd'hui** : zoom sur la liste des points à traiter | Chaque matin, l'**essentiel** | défilement de la liste |
| 5 | 0:28–0:38 | Fiche « Atelier financement participatif » : carte « Non confirmé à J-2 », clic sur **Confirmé** | Intervenant **confirmé** en un clic | vrai clic |
| 6 | 0:38–0:45 | Clic sur **Envoyer le rappel J-1** : la ligne « Envoyé le… » apparaît | Rappel **tracé** | vrai clic |
| 7 | 0:45–0:53 | Clôture de « Atelier pitch » : on coche les présences, puis Clôturer | Présence **calculée** | vrais clics |
| 8 | 0:53–1:03 | **Transition par l'anneau → Amira (bénéficiaire)**. « Mon espace » : on remplit le rapport, puis Envoyer | Le bénéficiaire devient **acteur** | vraie saisie |
| 9 | 1:03–1:11 | **Retour au chargé** : rapport d'activité pré-rempli, zoom sur les chiffres, puis Soumettre | **Rien** à ressaisir | vraie saisie |
| 10 | 1:11–1:21 | **Transition → PMO**. À valider → Valider et verrouiller, puis les jauges et la comparaison des centres | Le PMO **voit tout**, en direct | vrais clics |
| 11 | 1:21–1:27 | **Bénéfices** : trois cartes successives | Moins de saisie · Plus de visibilité · Données fiables | aucune |
| 12 | 1:27–1:32 | **Conclusion** : logo et signature | ELIFE Hub · Fondation Tunisie pour le Développement | aucune |

Toutes les données affichées sont les **données de démonstration** de l'application. Les personnes sont fictives et un petit mention « Données de démonstration » reste en bas à droite pendant toute la vidéo.

---

## 5. Méthode de production prévue (reproductible)

1. **`video/stage.html`** : une scène de 1920 × 1080 qui affiche la **vraie application** dans une fenêtre, avec les couches caméra, curseur, titres et cartes d'annotation.
2. **`video/scenario.mjs`** : un script Playwright qui joue le scénario dans l'application (vrais clics, vraies saisies) selon une ligne de temps.
3. **Capture image par image à 60 i/s** : le temps est contrôlé, donc le rendu est fluide et identique d'une exécution à l'autre. Le PNG est sans perte.
4. **Encodage MP4 H.264** avec ffmpeg, puis mixage de la musique et des sons.
5. Tout est versionné dans `video/` : on peut régénérer la vidéo après une évolution de l'application.

---

## 6. Décisions à prendre avant la production

| Sujet | Situation sur ce poste | Proposition |
|-------|------------------------|-------------|
| **Encodage MP4 / H.264** | **ffmpeg n'est pas installé.** Celui fourni avec Playwright ne sait produire que du WebM VP8 | Installer ffmpeg (`sudo apt install ffmpeg`), sinon livraison en WebM |
| **Narration** | Aucun moteur de synthèse vocale sur le poste | Une vidéo **sans voix, portée par les textes à l'écran**, qui marche aussi en muet sur les réseaux sociaux. Ou bien vous enregistrez la voix sur le script que je fournis |
| **Musique** | Je ne peux pas fournir de musique sous licence | Vous fournissez un morceau libre de droits (par exemple la bibliothèque audio de YouTube) ; je le cale sur le montage |
| **Sons** | Des sons simples (clic, apparition) peuvent être synthétisés, donc originaux | Sons synthétisés très discrets |
| **5e référence** | Pas encore reçue | J'intègre son analyse dès réception, avant de tourner |
