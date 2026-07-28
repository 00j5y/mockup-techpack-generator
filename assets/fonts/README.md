# assets/fonts

Polices locales du techpack. **Le contenu de ce dossier n'est pas versionne**, seuls
ce `README.md` et le `.gitkeep` le sont (exceptions declarees dans `.gitignore`).

Raison : les fichiers de police sont des binaires lourds sans rapport avec le code,
et la licence Adobe de Myriad Pro ne couvre pas sa redistribution.

## Fichier attendu

| Nom exact | Role | Statut |
|---|---|---|
| `MyriadPro-Bold.ttf` | Myriad Pro Bold, la vraie police du template Seaggs | requis pour la fidelite, optionnel pour faire tourner l'app |
| `MyriadPro-Regular.ttf` | Myriad Pro Regular | pas encore disponible, voir plus bas |

Le nom du fichier est un contrat : il apparait dans le `src` du `@font-face` de
`app/globals.css`. Renommer le fichier sans mettre le CSS a jour donne un 404
silencieux et un repli sur Source Sans 3.

## Ou retrouver le fichier sur le Mac de Jay

Il est installe dans la bibliotheque de polices de l'utilisateur :

```sh
cp "$HOME/Library/Fonts/Myriad Pro Bold.ttf" assets/fonts/MyriadPro-Bold.ttf
```

Le fichier est un sfnt `OTTO` a table `CFF` : un OpenType authentique
(839 glyphes, version 2.007) simplement renomme en `.ttf`, pas une conversion
degradee. D'ou le `format('opentype')` dans le `@font-face`.

A ne pas confondre avec le cache Adobe Fonts,
`~/Library/Application Support/Adobe/CoreSync/plugins/livetype/.r/`, qui ne
contient que des fichiers caches a noms obfusques et dont le contenu peut etre
reorganise par une mise a jour Creative Cloud.

## Comment le fichier arrive jusqu'a Chromium

Chromium tourne dans le conteneur Debian et ne voit pas les polices installees sur
macOS. Sans mecanisme dedie, le navigateur de Jay afficherait Myriad Pro et le PDF
sortirait en Source Sans 3, ce qui rendrait faux l'avertissement de debordement de
colonne du header, mesure avec la police du navigateur.

1. `docker-compose.yml` monte `./assets/fonts` en lecture seule sur
   `/app/assets/fonts` et renseigne `FONTS_DIR`.
2. `app/api/fonts/[...path]/route.ts` sert le dossier a la meme origine que
   l'application.
3. Le `@font-face` de `app/globals.css` declare la famille `Myriad Pro` en
   graisse 700 sur cette route.

`FONTS_DIR` est configurable (voir `.env.example`). Vide ou non renseignee, la
racine tombe sur `./assets/fonts`.

## Detecter si la police est reellement chargee

Le nom de famille `Myriad Pro` et la graisse `700` sont un contrat avec le bandeau
d'avertissement de l'interface. Mais attention au piege, mesure au navigateur :

**`document.fonts.check('700 10pt "Myriad Pro"')` renvoie `true` meme quand la
route repond 404.** La specification CSS Font Loading fait renvoyer `true` des
qu'aucune face correspondante n'est encore en attente : une face en echec compte
comme terminee. Le test ne distingue donc pas les deux cas.

Le signal fiable est le **statut de la `FontFace`** : `'loaded'` si le fichier est
la, `'error'` s'il manque. Verifie avec Puppeteer dans les deux configurations :

```ts
await document.fonts.ready;
let status: string = 'absent';
document.fonts.forEach((face) => {
  if (face.family.replace(/['"]/g, '') === 'Myriad Pro') status = face.status;
});
const fidele = status === 'loaded';
```

Pas besoin de forcer `document.fonts.load()` : le `body` porte deja
`font-family: 'Myriad Pro', ...`, donc le navigateur telecharge la police de
lui-meme et le statut est definitif des `document.fonts.ready`.

Autre piege pour plus tard : `check('400 10pt "Myriad Pro"')` renvoie aussi `true`
alors qu'aucun Regular n'est declare, la correspondance CSS retombant sur la face
700. Un test de presence du Regular devra passer par le statut de sa `FontFace`.

## Si le fichier est absent

Cas nominal sur un clone frais, rien ne casse :

- `bun run build` passe. On n'utilise volontairement pas `next/font/local`, qui
  exigerait le fichier au build.
- La route repond `404`.
- Le navigateur retombe sur Source Sans 3 grace a `font-display: swap`.
- Le bandeau d'avertissement de l'interface previent que le rendu n'est pas fidele.

## Le jour ou Jay obtient le Regular

1. Deposer le fichier ici sous le nom `MyriadPro-Regular.ttf`.
2. Ajouter un second bloc `@font-face` dans `app/globals.css`, meme famille
   `Myriad Pro`, `font-weight: 400`.
3. Verifier que le bandeau d'avertissement teste aussi la graisse 400
   (`document.fonts.check('400 10pt "Myriad Pro"')`).
4. Revoir les ajustements de corps et de `letter-spacing` poses pour compenser
   l'ecart de metriques avec Source Sans 3 : ils n'ont plus lieu d'etre une fois
   les deux graisses en Myriad Pro.
