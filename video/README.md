# Vidéo de démonstration ELIFE Hub

Une vidéo de démonstration d'environ 98 s, en 1920 × 1080 et à 60 i/s, **tournée dans la vraie application** : chaque clic et chaque saisie s'y exécutent réellement. Le rendu est reproductible : relancer la commande produit la même vidéo, ce qui permet de la régénérer quand l'application évolue.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `STORYBOARD.md` | Analyse des références, direction créative, storyboard et décisions |
| `stage.html` · `stage.css` | Scène de 1920 × 1080 : l'application dans une fenêtre (iframe), plus les couches caméra, curseur, titres, cartes d'annotation et transitions |
| `timeline.js` | Le moteur (tout est fonction du temps t) et le **scénario** des 12 plans. C'est ici qu'on modifie un texte, un minutage ou une action |
| `audio.js` | Bande son **originale**, synthétisée hors ligne avec Web Audio : nappe, arpège, basse, clics et souffles de transition. Aucun échantillon extérieur |
| `render.mjs` | Rendu image par image avec Playwright, encodage, puis mixage du son |
| `out/` | Sorties générées (non versionnées) : vidéo, bande son, images de contrôle, minutages |

## Commandes

```bash
node video/render.mjs                         # vidéo complète
node video/render.mjs --stills 3,27,50,85     # images de contrôle → video/out/stills/
node video/render.mjs --fps 30 --to 40        # brouillon rapide (30 i/s, 40 premières secondes)
node video/render.mjs --audio-only            # bande son seule → video/out/soundtrack.wav
```

- **Avec ffmpeg installé** (`sudo apt install ffmpeg`) : `video/out/elife-hub-demo.mp4`, en H.264 avec la bande son AAC à 192 kb/s. C'est le livrable final, pour les présentations, le web et les réseaux sociaux.
- **Sans ffmpeg** : `video/out/elife-hub-demo-preview.webm`, en VP8 et sans son (le seul format que permet le ffmpeg fourni avec Playwright), ainsi que `video/out/soundtrack.wav` à part.

Aperçu en temps réel dans un navigateur : servez la racine du dépôt (par exemple `python3 -m http.server 8765`), puis ouvrez `http://localhost:8765/video/stage.html?play=1`. Le paramètre `&t=50` démarre à 50 s.

## Comment ça marche

- Le temps vidéo pilote tout. `renderFrame(i)` déclenche dans l'ordre les actions dont l'heure est passée (clics, saisies, changements de profil), puis calcule la caméra, le curseur, les titres et les cartes pour t = i / 60.
- Les minuteries de l'application (`setTimeout`, par exemple la durée d'un message de confirmation) suivent l'horloge de la vidéo. Les transitions CSS de l'application sont ralenties à la vitesse de capture : un tiroir s'ouvre aussi vite dans la vidéo que dans la réalité.
- Au démarrage, les données de démonstration de l'application sont réinitialisées. Toutes les personnes sont fictives, et la mention « Données de démonstration » reste à l'écran.
- La caméra est une simple transformation CSS (translation et échelle) de la fenêtre. Quand on zoome, la vue reste à l'intérieur du cadre de l'application.

## Modifier la vidéo

- **Un texte** : chercher `caption(` ou `card(` dans `timeline.js`.
- **Un minutage** : les nombres sont des secondes. Décaler une scène, c'est décaler ses appels `camTo` / `cursorTo` / `click` / `caption`.
- **Une nouvelle action** : `click(t, () => élément)` clique réellement dans l'application ; `type(t0, t1, () => champ, 'texte')` tape au clavier.
- Après une modification, vérifier avec `--stills` avant de relancer le rendu complet.
