# Vidéos de démonstration ELIFE Hub

Trois versions, **tournées dans la vraie application** : chaque clic et chaque saisie s'exécutent réellement. Le rendu est reproductible : relancer la commande produit la même vidéo.

| Version | Contenu | Fichiers |
|---------|---------|----------|
| **v3 « pitch »** (actuelle) | ≈ 2 min 57 s. Même scénario que la v2, **sans titres ni musique**, ralenti à **40 s par défi** pour que le présentateur parle par-dessus. Notes : `PITCH-v3.md` | `stage.html`, `stage.css`, `timeline.js` (`SHOW`, `SECTION_SECONDS`) |
| **v2** (figée) | ≈ 2 min. Une section par défi (1, 2, 4, 8) avec titres, bandeaux « Résultat » et musique. Voir `PLAN-v2.md` | `v2/` |
| **v1** (figée) | ≈ 98 s. Parcours continu chargé → bénéficiaire → PMO | `v1/` |

## Fichiers

| Fichier | Rôle |
|---------|------|
| `PLAN-v2.md` | Plan de la v2 et corrections issues de la critique |
| `STORYBOARD.md` | Analyse des références et direction créative (v1) |
| `VOICEOVER-v2.md` | Script de voix off minuté pour la v2 |
| `stage.html` · `stage.css` | Scène de 1920 × 1080 : l'application dans une fenêtre, plus la caméra, le curseur, les titres, la barre de workflow, les cartes et les bandeaux |
| `timeline.js` | Le moteur et le **scénario** (v3 : même scénario que la v2, avec ralenti et options `SHOW`). `TEAM` (en haut du fichier) contient les noms de l'équipe affichés en conclusion |
| `audio.js` | Bande son **originale**, synthétisée avec Web Audio (aucun échantillon extérieur) |
| `render.mjs` | Rendu image par image avec Playwright, encodage H.264 + AAC (ffmpeg), sous-titres et voix off |
| `out/` | Sorties générées, non versionnées |

## Commandes

```bash
node video/render.mjs                        # v3 pitch → out/elife-hub-demo-v3.mp4 (+ .srt aide-mémoire, non incrusté)
node video/render.mjs --version v2           # v2 → out/elife-hub-demo-v2.mp4
node video/render.mjs --version v1           # v1 → out/elife-hub-demo-v1.mp4
node video/render.mjs --stills 9,22,63       # images de contrôle → out/stills/
node video/render.mjs --version v2 --remux   # ajoute video/voice-v2.wav sous la musique de la v2, sans refaire le rendu
```

Pour un aperçu en temps réel, servez la racine du dépôt (`python3 -m http.server 8765`), puis ouvrez `http://localhost:8765/video/stage.html?play=1` (ajoutez `&t=40` pour démarrer à 40 s).

## Comment ça marche

- **Le temps vidéo pilote tout.** `renderFrame(i)` déclenche dans l'ordre les actions réelles dont l'heure est passée, puis calcule la caméra, le curseur et les incrustations pour t = i / 60.
- **L'horloge de l'application est figée** au 19 novembre 2026 à 10 h 15 et avance avec la vidéo. Les horodatages et la durée des messages sont donc naturels. Les transitions CSS sont ralenties à la vitesse de capture.
- **Les données de démonstration sont remises à zéro au démarrage.** Toutes les personnes sont fictives, et la mention reste à l'écran.
- **La carte « Alertes : N → M » est calculée en direct.** Elle montre l'effet réel des actions faites dans la vidéo.
