# ELIFE Hub — prototype

Plateforme unifiée de pilotage du programme d'incubation ELIFE (6 centres + PMO).
HTML, CSS et JavaScript sans framework ni étape de build. Ouvrez `index.html` dans un navigateur (double-clic suffit).

## Démarrer la démo

1. Ouvrez `index.html`. Le profil « PMO central » s'affiche.
2. En bas de la barre latérale, **Profil de démonstration** permet de passer en « Chargé · Djerba » (ou un autre centre) ou en **Bénéficiaire** (Amira Ben Salem à Djerba, ou les bénéficiaires de Béja et de Tozeur).
3. Le bouton ↺ à côté réinitialise les données d'exemple.

Les saisies sont conservées dans le navigateur (localStorage, clé `elife-hub:v5`). Les sauvegardes `elife-hub:v3` et `elife-hub:v4` sont migrées automatiquement (rôle bénéficiaire et rapports, puis salles, créneaux et logistique) ; si la migration échoue, les données d'exemple sont restaurées. Sans stockage disponible, l'application fonctionne en mémoire.

## Scénario du PRD (5 minutes)

| # | Profil | Action |
|---|--------|--------|
| 1 | Chargé · Djerba | Aujourd'hui → « Clôturer » l'atelier pitch, cocher les présences |
| 2 | | Accepter l'invitation « Noter une leçon apprise » (brouillon) |
| 3 | | Touche **S** → saisir une séance pour l'entrepreneur à risque |
| 4 | | Entrepreneurs → Amira Ben Salem → Changer d'étape → Incubation |
| 5 | | Rapport mensuel → Soumettre |
| 6 | PMO | Pilotage → À valider → Examiner → Valider et verrouiller (le bandeau passe à 3 centres validés sur 6) |
| 7 | | Alertes → activité non clôturée au Kef → Connaissances : la leçon de Béja sur la présence |

## Défi 1 — Un nouvel acteur : le bénéficiaire

L'entrepreneur en incubation n'est plus seulement une fiche gérée par le chargé du centre : il a son propre profil (`beneficiaire`), rattaché à **une seule** fiche entrepreneur, et son propre espace. Il voit ses activités et remet un rapport pour chacune ; le chargé définit ce rapport et le relit ; le PMO fixe un modèle par programme.

### Ce que voit chaque rôle

| Rôle | Menu | Rapports bénéficiaires |
|------|------|------------------------|
| Bénéficiaire | Mon espace · Mes activités · Mes rapports · Mon parcours | Remplit, enregistre un brouillon, envoie, corrige, demande une correction |
| Chargé | inchangé | Définit le rapport d'une activité de son centre (section « Rapport demandé » du tiroir), relit : **Valider** / **Renvoyer** (motif obligatoire) |
| PMO | inchangé | Définit le **modèle par défaut d'un programme** (tiroir du programme) ; lecture seule de la file de relecture |

Le bénéficiaire ne voit jamais d'autres bénéficiaires, d'autres centres, d'indicateurs, d'alertes ni le journal. Toute tentative (fiche d'un autre entrepreneur, page ou action hors de son menu, via l'interface ou la console) est **refusée et inscrite au journal** (action « Accès refusé », même mécanisme que EC-12). Les contrôles sont faits à trois niveaux : routage (`app.js`), ouverture des volets (`EH.openDrawer`) et actions du store (`EH.act.*`).

### Nouvelles entités (`seed.js`, `store.js`)

- **Utilisateur** `{ role: 'beneficiaire', entrepreneurId, centre }` ; la fiche entrepreneur porte `portal: true` quand son espace est activé.
- **ReportingRequirement** `{ id, scope: programme|activity, programmeId, activityId, version, format, fields[], dueDays, mandatory, feedbackVisible }`. Les enregistrements sont immuables : une modification crée la version n + 1 (clé = portée + cible).
  - Formats : Compte rendu libre · Formulaire structuré (1 à 8 questions texte / nombre / choix / note 1-5, obligatoires ou non) · Livrable fichier/lien · Présence seule.
  - Héritage : l'activité utilise sa propre exigence si elle en a une, sinon le modèle de son programme ; le chargé peut aussi choisir « Aucun rapport » ou revenir à « Hériter du programme ». Une activité sans exigence est autorisée et l'interface le dit explicitement.
- **BeneficiaryReport** `{ id, activityId, entrepreneurId, requirementId, requirementVersion, answers, status, submittedAt, firstSubmittedAt, reviewedBy, reviewedAt, reviewComment, version }`. Chaque rapport reste attaché à la version de l'exigence à laquelle il répond ; modifier l'exigence ne détruit rien.
- **BeneficiaryCorrection** : demande de correction sur un rapport validé.

### Le flux

```
À faire ──> Brouillon ──> Soumis ──> Validé
                 ^           │
                 └─ À corriger ◄┘   (renvoi du chargé, motif obligatoire)
```

- Un rapport est **attendu** quand l'activité est réalisée, que le bénéficiaire en faisait partie (présences cochées à la clôture) et qu'une exigence existe. La clôture de l'activité par le chargé crée donc la tâche.
- **Brouillon** : chaque frappe est conservée dans le navigateur (même mécanisme que la séance, clé locale par rapport) et restaurée à la réouverture ; « Enregistrer le brouillon » l'écrit dans le store.
- **Envoyer** : valide les champs obligatoires, horodate, verrouille la modification jusqu'à la relecture.
- **Valider** : lecture seule. Un changement passe par « Demander une correction » (le chargé accepte → le rapport redevient « À corriger », ou refuse), comme pour le rapport mensuel.
- **En retard** : échéance (date de l'activité + `dueDays`) dépassée et statut « À faire » ou « Brouillon ». Les rapports en retard alimentent la liste des alertes (centre, élément, jours de retard, lien) et la page « Aujourd'hui » du chargé.
- **Verrou optimiste** : chaque rapport a un champ `version` ; une action sur une version périmée est refusée avec un message clair. Les exigences ont le même contrôle (`baseVersion`).
- **Journal** : chaque changement d'état écrit une entrée (qui, quoi, quand, avant → après).

### Suivi individualisé

- Fiche entrepreneur (vue chargé / PMO) : bloc « Rapports » (une ligne par rapport : statut, échéance, version) et taux de remise du bénéficiaire.
- Deux indicateurs ajoutés, avec formule en info-bulle, « Validé » ou « Provisoire », « Pas de donnée » plutôt que 0 :
  - **Remise des rapports** = rapports obligatoires remis à temps ÷ rapports dus ;
  - **Engagement des bénéficiaires** = (présences + rapports remis à temps) ÷ (activités réalisées attendues + rapports dus).
- Ils passent par un seul calcul (`EH.q.beneficiaryStats`) utilisé par la fiche, le rapport mensuel, le tableau de bord, l'export CSV et les instantanés de validation : les chiffres concordent partout.
- Plusieurs programmes à la fois : « Mon espace » regroupe les tâches par programme, chacune avec son échéance et son format de rapport.

### Hypothèses

1. Les rapports sont attendus des entrepreneurs dont l'**espace bénéficiaire est activé** (`portal`). Dans les données d'exemple : 3 bénéficiaires (Djerba, Béja, Tozeur). Les autres centres affichent « Pas de donnée » pour les deux nouveaux indicateurs. Il n'y a pas d'écran d'activation (hors périmètre du prototype).
2. Un bénéficiaire participe aux activités de sa cohorte, dans son centre, tous programmes confondus ; le rapport n'est attendu que s'il a été **présent** à une activité réalisée.
3. Un rapport **facultatif** (non obligatoire) n'est jamais « en retard » et n'entre ni au numérateur ni au dénominateur des indicateurs.
4. Un rapport est « remis à temps » si son **premier envoi** a lieu au plus tard à la date d'échéance ; un renvoi après correction ne change pas ce jugement.
5. « Livrable fichier/lien » : sans serveur, le prototype demande un **lien** (http/https) et une note, pas un téléversement de fichier.
6. « Présence seule » : le bénéficiaire confirme sa présence en un geste ; le chargé la valide comme un autre rapport.
7. Un rapport en brouillon ou à faire suit la dernière version de l'exigence tant qu'il n'a pas été enregistré ; ensuite il reste attaché à la version choisie. Les rapports soumis ou validés gardent toujours leur version.
8. La relecture d'un rapport bénéficiaire reste possible dans une période mensuelle déjà validée ; les indicateurs « Validé » de cette période restent figés (instantané du rapport mensuel).
9. Le jour de démonstration est fixé au 19 novembre 2026 (`EH.TODAY`).

### Scénario de démonstration (bénéficiaire)

| # | Profil | Action |
|---|--------|--------|
| 1 | PMO | Programmes → Business Plan Bootcamp → **Modifier le modèle de rapport** : passer en « Formulaire structuré », 3 questions, échéance 3 jours |
| 2 | Chargé · Djerba | Activités → « Atelier pitch » (17 nov.) → **Modifier** : dans « Rapport demandé », personnaliser (exigence propre, v1) |
| 3 | | **Clôturer** l'activité avec Amira Ben Salem présente → elle reçoit la tâche |
| 4 | Bénéficiaire · Amira | Mon espace → la tâche apparaît sous « Business Plan Bootcamp » → **Remplir** → saisir, recharger la page, rouvrir : le brouillon est restauré → **Envoyer le rapport** |
| 5 | Chargé · Djerba | Aujourd'hui → « 1 rapport bénéficiaire à valider » → **Renvoyer** avec un motif |
| 6 | Bénéficiaire · Amira | Mon espace → « À corriger » avec le motif → corriger → **Envoyer le rapport** |
| 7 | Chargé · Djerba | **Valider** → la fiche d'Amira et le rapport mensuel montrent le nouveau taux de remise |
| 8 | PMO | Pilotage : les deux nouveaux indicateurs de la période sont à jour. Alertes → filtre « Rapport bénéficiaire en retard » : le cas d'Amira (Coaching collectif, 29 oct.) et celui du bénéficiaire de Béja |

### Vérification automatique

`tests/e2e.mjs` (Playwright + Chromium) couvre : les permissions et leur journalisation, le flux complet ci-dessus, la persistance après rechargement, la cohérence des indicateurs entre fiche, rapport mensuel et tableau de bord, le verrou optimiste, et la mise en page à 390 / 820 / 1440 px sans défilement horizontal. Lancement : `node tests/e2e.mjs` (voir l'en-tête du fichier pour les chemins de Playwright et de Chromium).

## Fusion avec le Product Backlog final

Le backlog final (26 PBI, après l'entretien client) est intégré par phases au prototype. Décisions retenues sur les conflits : statut « Confirmée » ajouté sans retirer les statuts existants ; une activité sans intervenant reste possible (« Intervenant à trouver ») ; valideur des rapports d'activité configurable par programme (PMO par défaut) ; documents stockés dans le navigateur et liens ; rôle Intervenant en lecture seule ; un seul script de démonstration.

| Bloc | Ce qui est livré |
|---|---|
| Données (PBI-25) | Créneau (heure + durée), salle, staff, budget, équipements, programme du jour, supports, lien en ligne, contact, participant 1-1 ; salles par centre ; historique des séances depuis juin |
| Planification (PBI-04 à 07) | Types « Atelier en ligne » et « Session 1-1 », cohorte obligatoire ; vues Liste, Semaine, Mois ; conflits de salle, d'intervenant et de staff avertis avant l'enregistrement ; fiche d'activité complète |
| Intervenant (PBI-10) | Proposé → **Confirmé** ou **Refusé** depuis la fiche ; un refus repasse l'activité en « Intervenant à trouver » (motif conservé) ; non confirmé à J-3 → alerte chargé et PMO ; chaque changement journalisé |
| Rappel (PBI-08) | « Envoyer le rappel J-1 » aux participants de la cohorte et à l'intervenant, simulé et tracé sur l'activité (date, destinataires) ; refusé pour une activité annulée ; point « Aujourd'hui » la veille |
| Présence (PBI-13) | Clôture avec la cohorte pré-cochée, taux de présence sur la fiche, la liste, le rapport mensuel et le tableau de bord |
| Sélection (PBI-23) | Candidature → **Entretien** (date, note sur 5, commentaire) → **Avis du comité** (favorable / réservé / défavorable, note, commentaire) → décision ; visible dans « Parcours de sélection » et la chronologie |
| Rapport d'activité (PBI-19/20) | Pré-rempli depuis la fiche (présents, taux, intervenant, budget, rapports bénéficiaires) ; le chargé ajoute difficultés et besoins d'appui, enregistre ou soumet ; le PMO valide (chiffres figés, verrouillé) ou renvoie avec motif ; attendu sous 7 jours pour les activités réalisées depuis le 1er novembre 2026 |
| Pilotage (PBI-21/22) | Comparaison des centres : activités par état, exécution, présence, couverture, rapports d'activité à valider / en retard ; chaque chiffre ouvre la liste filtrée ; jauge « Présence » ; alertes « Intervenant non confirmé (J-3) » et « Rapport d'activité en retard » |
| Démo (PBI-26) | Script de 5 minutes dans [DEMO.md](DEMO.md) |

Prochaines étapes envisagées : envoi réel des rappels et résumé quotidien par e-mail (n8n), confirmation de venue des participants et consentement (PBI-14, 15), onglet Documents et bibliothèque de modèles (PBI-16 à 18), comptes rendus de réunion dont les décisions deviennent des tâches.

Cas de démonstration déjà présents (PBI-25) : conflit de salle à Djerba le 24 novembre (« Atelier étude de marché » 16 h et « Atelier marketing digital » 17 h, même salle) et intervenant non confirmé à Tozeur (« Formation comptabilité de base », 21 novembre).

## Évolutions : graphiques PMO, remarques, import Excel, suivi d'incubation

| Rôle | Où | Ce qui change |
|------|----|---------------|
| PMO | Pilotage | Panneau **Taux en graphiques** : une jauge circulaire par taux (exécution, couverture, abandon, remise, engagement) qui sert aussi de sélecteur, un graphique en barres par centre (ligne pointillée = valeur du programme) et la courbe des six derniers mois. Les tuiles d'indicateurs et le tableau de comparaison ont une barre de progression colorée (vert ≥ 80 %, orange ≥ 60 %, rouge en dessous ; inversé pour l'abandon : ≤ 10 % / ≤ 20 %). |
| PMO | Menu | Le **Journal d'audit** n'est plus une page. Les actions restent enregistrées en interne (historique d'un rapport, « Accès refusé »). |
| PMO et chargé | Rapport mensuel | Section **Remarques** : fil d'échange entre le PMO (tiroir du rapport) et le chargé (page « Rapport mensuel »). Une remarque ne change pas les chiffres : elle reste possible sur un rapport validé et verrouillé. |
| Chargé | Inscrire un candidat | Deux onglets : **Saisie manuelle** (inchangée) et **Importer un fichier Excel** (.xlsx ou .csv). Modèle Excel téléchargeable. Chaque ligne reçoit un verdict avant insertion : *À insérer*, *Ignoré · doublon* (déjà inscrit dans le centre, dans un autre centre, ou doublon d'une ligne précédente du fichier) ou *Erreur* avec le champ fautif (prénom, nom ou idée manquants, ni téléphone ni e-mail, e-mail ou téléphone invalide, date de naissance future ou illisible, secteur ou source hors liste). Seules les lignes valides sont insérées ; l'import est journalisé avec ses compteurs. Réimporter le fichier corrigé ignore les lignes déjà insérées. |
| Chargé | Aujourd'hui | Section **Incubation** à trois vues : **Phases** (pré-incubation, incubation, suivi : jours passés dans la phase contre la durée prévue de `REF.phaseTargets`, livrables, exercices), **Exercices** (donner un exercice à un ou plusieurs bénéficiaires, relire, valider ou renvoyer avec motif) et **Bailleurs de fonds** (financeurs du centre, programmes financés et projets liés, avec type et montant ; « Lier un financement »). Les exercices rendus et en retard remontent dans « À faire aujourd'hui » (filtre « Incubation »). |
| Bénéficiaire | Mon espace, Mon parcours | Chaque exercice devient une **action** « Faire l'exercice » ; il le rend en ligne (texte + lien facultatif). Un exercice d'un autre bénéficiaire est refusé et journalisé. |

Nouvelles données (`seed.js` → `EH.seedIncubation`, ajoutées automatiquement aux sauvegardes existantes) : `exercises` `{ entrepreneurId, title, instructions, due, status: todo|submitted|returned|validated, answer, link, version }` et `fundings` `{ partner, entrepreneurId, kind, amount, date }` ; `reports[].remarks[]`. La lecture des fichiers Excel se fait sans bibliothèque (`js/core/xlsx.js` : zip + XML, décompression native du navigateur).

## Architecture

```
index.html              coquille + ordre de chargement
css/
  tokens.css            couleurs, typo, espacements, rayons (une seule source)
  base.css              reset, typographie, utilitaires
  layout.css            barre latérale, barre du haut, grilles, responsive
  components.css        boutons, badges, tableaux, formulaires, tiroirs, modales, toasts…
  benef.css             ajustements mobiles de l'espace bénéficiaire
js/
  core/util.js          dates, formats, normalisation, distance de Levenshtein
  core/icons.js         icônes SVG et logo
  core/xlsx.js          lecture .xlsx / .csv et écriture du modèle .xlsx, sans dépendance
  data/reference.js     listes de référence et formules des KPI (configuration, NFR-10)
  data/seed.js          données de démonstration (personnes fictives)
  core/selectors.js     calculs purs : KPI, alertes, rapport, contrôles qualité
  core/store.js         données, session, rôles et droits, journal, toutes les règles métier (EH.act.*)
  ui/components.js      composants de présentation (aucun accès aux données)
  app.js                routage (#page), rendu, tiroirs, modales, toasts, événements délégués
  pages/*.js            une page par fichier + ses tiroirs, formulaires et actions
  pages/requirement.js  section « Rapport demandé » partagée (tiroir d'activité, modèle de programme)
  pages/mon-espace.js   espace bénéficiaire : Mon espace et Mon parcours
  pages/mes-rapports.js espace bénéficiaire : Mes activités, Mes rapports et formulaire de rapport
  pages/incubation.js   section Incubation du chargé (phases, exercices, bailleurs) et volets associés
tests/e2e.mjs           vérification Playwright (hors application)
tests/fixtures/         fichier Excel d'exemple pour l'import (doublons et erreurs inclus)
```

Règles :
- Les pages ne modifient jamais les données : elles appellent `EH.act.*`, qui valide, journalise et sauvegarde.
- Les KPI, le rapport et les alertes viennent des mêmes sélecteurs : les totaux concordent partout.
- Un seul gestionnaire d'événements par type (`data-action`, `data-form`, `data-filter`).
- Scripts classiques (pas de modules ES) pour fonctionner aussi en `file://`.

## Couverture du backlog

Toutes les stories MUST du PRD sont jouables (PBI-01 à 08, 12 à 16, 19 à 22, 27, 29, 30, 33, 35, 38 à 40), ainsi que plusieurs SHOULD : calendrier (09), livrables (18), contrôle qualité (23), export CSV (24), journal (26, tenu en interne, sans page dédiée), doublon partenaire (28), fiche partenaire (31), invitation après activité (34), validation des connaissances (36), révision (37), définition des KPI (42).

Non couverts : tendances mensuelles (PBI-41), indicateurs par programme dans le rapport (PBI-10), ressources d'activité (PBI-11), import CSV (PBI-25), partenariat inactif configurable (PBI-32, fixé à 6 mois), e-mail matinal (PBI-43), synthèse IA (PBI-44), connexion réelle et contrôle des droits côté serveur (NFR-01, NFR-02).
