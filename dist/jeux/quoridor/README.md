# Quoridor de Cépagrave

Jeu statique, sans serveur de jeu, sans dépendance réseau au lancement. Ouvrir
`http://127.0.0.1:8876/jeux/quoridor/` avec le serveur local habituel.

- `engine.js` : règles pures, deux ou quatre joueurs, sauts, murs, chemins et victoire.
- `ai.js` : évaluation des courses et barrières, recherche progressive MaxN (minimax à deux), huit niveaux. Les niveaux 3 à 8 prennent en charge les menaces immédiates ; les niveaux supérieurs cherchent plus loin avec un budget accru. La recherche reste heuristique, sans garantie de jeu optimal.
- `ai-worker.js` : calcul hors du fil de l’interface, annulé à l’ouverture des réglages, lors d’un retour en arrière ou du changement de partie.
- `app.js` : interface, configuration individuelle, glisser-déposer, clavier, animations et historique. Les réglages sont mémorisés localement ; les parties ne le sont pas.
- `style.css` : matériaux, couleurs des joueurs et mise en page adaptative.
- `assets/nut-steel.png` : écrou photographique avec transparence, y compris dans son trou central. Les finitions rouge, bleue, verte et jaune sont appliquées en CSS. Aucun numéro n’est superposé aux pions.
- `assets/maple-light.png` : texture photographique d’érable clair pour le fond, les cases et le cadre. Le noyer reste utilisé pour les barrières sombres. Ces deux images sont aplaties ; les cases, barrières, numéros gravés, commandes et couleurs restent des composants éditables.
- `assets/bolt-steel.png` : ancien visuel conservé, inutilisé dans la version actuelle.

Les textures et polices existantes de Quarto, le noyer du portail et le moteur de
sons de Quarto sont réutilisés par des chemins relatifs, sans modification de ces
originaux. Aucune image globale du plateau : cases, barrières, pions et textes
restent indépendants.

L’interface se joue sans boutons de mode ni points indicateurs. Une case accessible
peut être choisie directement. Prendre une barrière bloque les mouvements du pion ;
la reposer dans la réserve ou annuler le geste les réactive. « Tourner (R) »
fonctionne au toucher et à la souris ; tourner la réserve ne prend pas la barrière.
Les stocks sont représentés visuellement et le cadre jaune indique le joueur actif.
Sur petit écran, les fiches des joueurs restent au-dessus du plateau.

Règles de référence : https://export.gigamic.com/wp-content/uploads/2021/01/INS-RULES-QUORIDOR_10-2016.pdf
(le paragraphe allemand précise également le saut latéral lorsqu’un troisième
pion empêche le saut droit). À quatre, le cas exceptionnel d’un joueur sans aucun
coup légal passe automatiquement son tour ; cette convention est indiquée dans
les règles de l’adaptation.

Vérification depuis la racine du dépôt : `node --test tests/quoridor.test.cjs`.

`tests/quoridor-interactions.js` vérifie dans le contexte JavaScript de la page les
nouveaux gestes, l’absence de points et de compteurs, le retour en réserve et les
annulations. Les glissés et les rotations ont aussi été vérifiés avec de vrais
événements souris et tactiles dans Chrome, à 1440 px et 390 px.

## Images de la version claire

Créées avec l’outil ImageGen intégré, puis copiées dans les chemins ci-dessous.
Les originaux et la version précédente du jeu sont conservés séparément.

### `assets/nut-steel.png`

Use case: product-mockup. Asset type: one transparent top-view game pawn sprite. Primary request: ONE real chunky HEXAGONAL METAL NUT, NOT a bolt, NOT a bolt head, no screw, no washer. An industrial silver steel hex nut with a large central threaded THROUGH HOLE, clearly visible and occupying about 38 percent of the nut width. The very center of the hole is truly transparent alpha so the underlying game board will be visible; show a short dark threaded inner wall around that transparent aperture. View almost straight down at 82 degrees elevation, a small side face visible on the bottom to convey thickness. Product macro photograph, realistic brushed steel, soft top-left light, clear bevels, subtle machining marks, neutral silver not warm, no extreme glare. Centered on a square canvas, nut fills 88 percent of width and height, equal empty margins, tiny contact shadow only. Entire background genuinely transparent. No lettering, no numbers, no logos, no other objects, no floor. Crisp readable shape for display at 30-45 pixels.

### `assets/maple-light.png`

Use case: photorealistic-natural. Asset type: reusable light wood material texture for a board game UI. Primary request: orthographic flat close-up photograph of a single broad piece of pale natural maple wood, softly warm ivory and light honey, fine delicate horizontal wood grain and visible subtle natural fibers. Matte sanded finish, evenly diffuse lighting over the whole surface, no shadows, no vignette, no reflections, no objects, no typography. No plank seams, no join lines, no knots larger than tiny specks, no dark cracks or stains. Color stays light cream beige across the entire image, restrained contrast, realistic detailed wood, not papyrus, not paper, not a drawing. Fill the complete square canvas edge to edge with the light wood surface.

## Ancienne image du boulon (conservée)

Créée avec l’outil intégré ImageGen, puis copiée dans `assets/bolt-steel.png`.
L’original est conservé dans le dossier des images générées de Codex.

Prompt utilisé :

Use case: product-mockup. Asset type: a single transparent game pawn sprite for a photographic wood and metal board game. Primary request: ONE short chunky industrial hex-head steel bolt standing upright on its broad circular washer, viewed almost directly from above, camera at 80 degrees elevation, just enough side face visible to show thickness. Entire bolt fits within a centered circular footprint, fills 84 percent of a square image, with even margin all around. No protruding shaft or long screw visible. Real aged brushed silvery steel, machined chamfered hexagonal head, small tool scratches, slightly darkened edges, tactile realistic metal. Large smooth flat hex top face with no lettering or logo or number. Soft natural studio key light from upper left, nuanced bright steel reflections, no dramatic glare, only a tiny contact shadow under the washer, not a long directional cast shadow. Isolated cutout on a genuinely transparent background with preserved alpha, no scene, no background plate, no floor, no border, no text. This is an actual material sprite, not an illustration, cartoon or icon. Photorealistic product macro photography, crisp silhouette readable at 40px.
