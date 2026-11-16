# CéPAGRAVE

Publication : https://cpasgrave.github.io/
Dépôt du portail : https://github.com/Cpasgrave/cpasgrave.github.io

GitHub Pages publie le dossier `dist/` à chaque envoi sur `main`, via
`.github/workflows/deploy.yml`. L’archive originale dans `sources/` reste locale.
Les originaux et les sources séparées des deux jeux sont conservés dans leurs
dossiers de travail, comme indiqué ci-dessous.

Lancer `../Jouer.cmd`, puis ouvrir `http://127.0.0.1:8876/` dans le profil Chrome Cepagrave. Garder la fenêtre du serveur ouverte pendant les parties. Les deux jeux améliorés fonctionnent avec leurs ressources locales. Le serveur HTTP permet à Onitama de charger ses modules et aux deux IA de calculer en arrière-plan.

- `dist/index.html` : titres, descriptions et liens des projets. Pour ajouter un projet, dupliquer un élément `<li>` dans la liste et donner des identifiants uniques à ses textes.
- `dist/style.css` : couleurs, mise en page et adaptation aux petits écrans.
- `dist/assets/` : pictogrammes des jeux en SVG éditable et [avatar GitHub](https://github.com/Cpasgrave) en JPEG original, sans calques. Le cadrage circulaire est appliqué par le CSS.

Les sources modifiables d’Onitama se trouvent dans `../onitama-web/src/`. Depuis `../onitama-web/`, `npm run build -- --base=./` produit `dist/`, à recopier dans `dist/jeux/onitama/` du portail. Les fichiers générés d’Onitama sont compilés.

Les sources modifiables de Quarto se trouvent dans `../quarto-web/`. Le portail en contient une copie dans `dist/jeux/quarto/`, avec un lien de retour supplémentaire. Ses images restent des bitmaps, tandis que les règles, l’IA, les textes et l’interface sont éditables séparément. L’archive d’origine est conservée dans `sources/`.

Chaque jeu propose huit niveaux. Dans Onitama, le réglage est au-dessus du plateau. Dans Quarto, ouvrir « Réglages ». Les niveaux 1 et 2 comportent des erreurs volontaires. À partir du niveau 3, les gains immédiats et les menaces au coup suivant sont vérifiés. Les niveaux supérieurs augmentent la profondeur et le budget de recherche.

Quarto : les glissements et les poses ont des sons générés à chaque geste dans
`dist/jeux/quarto/wood-sound.js`. Leur volume se règle dans « Réglages ».

Quoridor : `dist/jeux/quoridor/` contient les sources éditables du troisième jeu.
Il propose deux ou quatre places, chacune humaine ou contrôlée par une IA de
niveau 1 à 8. Le calcul se fait dans un Worker, les coups s’animent et les pièces
se déplacent à la souris, au toucher ou au clavier. Les réglages peuvent changer
en cours de partie ; « Revenir à mon tour » annule aussi les réponses des IA.
Les détails des sources, la référence des règles et les prompts des images de
l’écrou et du bois clair figurent dans `dist/jeux/quoridor/README.md`.

Tests des règles et de l’IA : `node --test tests/quoridor.test.cjs`.
