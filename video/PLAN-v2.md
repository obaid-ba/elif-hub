# Vidéo v2 — plan de production (révisé après critique)

**Objectif.** Une vidéo claire et professionnelle (≈ 2 min) qui présente **4 défis du hackathon : 1, 2, 4 et 8**, chacun dans sa propre section. Chaque section explique le problème et la réponse d'ELIFE Hub, puis **montre le workflow réel dans l'application, étape par étape**.

**Montage.** Celui de la v1 est conservé : scène, halos, typographie, curseur, cartes d'annotation, titres en bas à gauche, transition violette au changement de rôle, bande son synthétisée. La v1 est figée dans `video/v1/` et sa vidéo conservée sous `out/elife-hub-demo-v1.mp4`.

## 1. Structure

| Partie | Temps | Contenu |
|--------|-------|---------|
| Ouverture | 0:00–0:03,6 | Logo (style v1) |
| Sommaire | 0:03,4–0:07,2 | « 6 centres, 1 PMO, des bénéficiaires. **4 défis traités en profondeur.** » Tuiles 1 · 2 · 4 · 8 |
| Défi 1 | 0:07–0:37 | Carte de section de 3,6 s, puis le workflow réel |
| Défi 2 | 0:37–1:06 | Carte, puis le workflow |
| Défi 4 | 1:06–1:30 | Carte, puis le workflow |
| Défi 8 | 1:30–1:51 | Carte, puis le workflow |
| Récapitulatif et « Sous le capot » | 1:51–1:56 | Les 4 défis cochés, puis sans serveur · droits par rôle · 150 tests |
| Conclusion | 1:56–2:01 | Logo, équipe, mention du hackathon, note discrète « Coordination, partenaires et connaissances sont aussi dans la plateforme » |

## 2. Gabarit de chaque section

- **Carte de section** en plein écran : pastille « Défi N », titre, **problème en 10 mots au plus**, **réponse en 3 mots-clés**, aperçu des étapes du workflow.
- **Barre de workflow** en haut au centre pendant la démo. Elle porte le libellé du défi à gauche, puis les étapes : l'étape en cours est en indigo, celles déjà faites sont cochées. Elle remplace la pastille de chapitre séparée, pour éviter l'encombrement.
- **Démonstration réelle** : zoom d'au moins 1,4 dès que le texte compte, plan large de 1,5 s au plus, anneau sur le bouton cliqué.
- **Une seule carte d'annotation par étape** au maximum, des titres d'une ligne, et jamais de carte par-dessus la zone des titres.
- **Bandeau « Résultat »** de 2 s en fin de section.

## 3. Workflows démontrés (actions réelles)

**Défi 1 — Programmes et activités** · `Planifier → Confirmer → Rappeler → Clôturer`
- *Planifier* : Activités → Planifier une activité. On saisit le titre, le programme et le type, puis le 24 nov. à 16 h 30 dans la Salle de formation → **conflit détecté** → l'heure passe à 10 h 00 → activité enregistrée.
- *Confirmer* : Aujourd'hui → « Faire confirmer Mehdi Rekik » → **Confirmé**.
- *Rappeler* : **Envoyer un rappel** → « Envoyé le… ». La carte précise « e-mail simulé dans le prototype ».
- *Clôturer* : « Atelier pitch » → deux absents décochés → taux de présence calculé.
- Résultat : « Chaque activité suivie de la planification à la clôture. »

**Défi 2 — Parcours entrepreneur** · `Candidature → Sélection → Accompagnement → Espace bénéficiaire`
- *Candidature* : Entrepreneurs → Importer (Excel) → **vrai import** de `tests/fixtures/candidats.xlsx` : 2 lignes à insérer, 2 doublons ignorés, 3 erreurs → Insérer.
- *Sélection* : fiche d'un candidat → Parcours de sélection (entretien 3/5, comité favorable).
- *Accompagnement* : recherche « Amira » → sa fiche (étapes, exercices).
- *Espace bénéficiaire* : transition violette vers Amira → elle envoie son rapport → elle tape une adresse interdite → **refus enregistré**.
- Résultat : « Le parcours complet, de la candidature à la sortie. »

**Défi 4 — Centralisation et reporting** · `Pré-remplir → Soumettre → Valider → Consolider`
- *Pré-remplir* : le rapport d'activité, déjà rempli depuis la fiche.
- *Soumettre* : difficultés et besoins d'appui, puis Soumettre.
- *Valider* : transition violette vers le PMO → À valider → **Valider et verrouiller**.
- *Consolider* : page Rapports → **Copier l'export CSV** (vrai clic, confirmation à l'écran).
- Résultat : « Une seule source de vérité, plus de consolidation manuelle. »

**Défi 8 — Pilotage et décision** · `Mesurer → Comparer → Alerter → Agir`
- *Mesurer* : indicateurs, puis la jauge Présence.
- *Comparer* : tableau de comparaison des centres.
- *Alerter* : panneau Alertes, avec une **carte de cause à effet calculée en direct** : « Alertes : N au début de la démo → M maintenant ».
- *Agir* : clic sur « 1 à clôturer » du Kef → la liste filtrée s'ouvre.
- Résultat : « Le PMO voit tout et agit au bon endroit. »

## 4. Corrections issues de la critique

| Faiblesse | Correction |
|-----------|------------|
| « Planifier » ne planifiait rien | Vraie planification, avec un conflit détecté puis corrigé |
| « Candidature » n'était qu'un bouton | Vrai import du fichier Excel d'exemple |
| Le projet d'Amira était incohérent | Données d'exemple alignées sur son vrai projet, le sirop de dattes |
| Les horaires étaient étranges (02:43) | Horloge de l'application figée au 19 nov., 10 h 15, pendant le rendu |
| Un rappel simulé était présenté comme réel | Mention « e-mail simulé dans le prototype » |
| Trop de temps hors produit, trop de texte | Cartes de 3,6 s avec 10 mots au plus ; récapitulatif et « Sous le capot » fusionnés |
| Trop de couches de texte | Pastille de chapitre fondue dans la barre de workflow, une carte par étape au maximum |
| La numérotation 1 · 2 · 4 · 8 pouvait surprendre | « 4 défis traités en profondeur », plus une note en conclusion |
| Aucun lien visible entre les défis | Carte de cause à effet sur les alertes, calculée en direct |
| « Consolider » était passif | Clic réel sur l'export CSV |
| Lisibilité et collaboration | Zoom d'au moins 1,4 ; équipe configurable (`TEAM` dans `timeline.js`) |

## 5. Garantie de génération

- Données de démonstration remises à zéro au démarrage ; ordre des sections fixe : la clôture du défi 1 crée le rapport d'Amira utilisé au défi 2.
- Images de contrôle (`--stills`) à plusieurs instants par section avant le rendu complet.
- Rendu à 60 i/s en H.264 + AAC, contrôle du fichier, puis planche à une image par seconde.
- L'application et ses 150 tests restent verts (les données d'exemple ont été retouchées pour Amira : tests relancés).

## 6. Livrables

`out/elife-hub-demo-v2.mp4` · `out/elife-hub-demo-v2.srt` · `VOICEOVER-v2.md` (voix off ajoutée avec `--remux` sans refaire le rendu) · `out/elife-hub-demo-v1.mp4` conservée.
