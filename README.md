# PK Keyword Highlighter 🖍️

Un userscript qui surligne des mots-clés et barre ceux que vous excluez, avec plusieurs styles visuels.

---

A userscript that highlights keywords and strikes through excluded phrases, with multiple visual styles.

## Francais 🇫🇷

### Fonctionnalites ✨
- Surlignage automatique des mots-cles.
- Exclusion de termes/phrases avec barre rouge.
- Styles visuels: Normal, Bold, Origami, Candy, Sticker.
- Parametres par site (stockage local).

### Installation ⚙️
1. Installez un gestionnaire de userscripts (Tampermonkey, Violentmonkey).
2. Ajoutez le script `keyword-highlighter.user.js`.
3. Ouvrez Gmail et cliquez sur le bouton **HL**.

### Utilisation 🧭
- **Highlight**: liste de mots/phrases a surligner (separes par des virgules).
- **Exclude**: liste de mots/phrases a barrer (separes par des virgules).
- **Style**: choix du rendu visuel.
- Cliquez **Save** pour appliquer.

### Exemples ✅
- Highlight: `manager`
- Exclude: `business manager, product manager`

Resultat: les phrases entieres sont barrees, mais `manager` reste surligne ailleurs.

### Notes techniques 🧩
- Les exclusions sont appliquees avant le highlight.
- Les phrases multi-mots acceptent les espaces classiques et certains espaces speciaux.
- Le script ignore les champs de saisie et le panneau UI.

### FAQ 🧯
- Le mot est encore surligne dans une phrase exclue: verifiez que la phrase exacte est dans **Exclude** et sans fautes.
- La phrase exclue ne match pas: certaines mises en page cassent la phrase en plusieurs balises; essayez d'exclure les mots individuellement.
- Le style ne change pas: cliquez **Save** puis rechargez la page.

### Fichiers 📁
- `keyword-highlighter.user.js`: userscript principal.
- `CHANGELOG.md`: historique des versions.

### Licence 📜
MIT (voir `keyword-highlighter.user.js` pour les details).

## English 🇬🇧

### Features ✨
- Automatic keyword highlighting.
- Phrase exclusion with red strike-through.
- Visual styles: Normal, Bold, Origami, Candy, Sticker.
- Per-site settings (local storage).

### Installation ⚙️
1. Install a userscript manager (Tampermonkey, Violentmonkey).
2. Add `keyword-highlighter.user.js`.
3. Open Gmail and click the **HL** button.

### Usage 🧭
- **Highlight**: list of words/phrases to highlight (comma-separated).
- **Exclude**: list of words/phrases to strike (comma-separated).
- **Style**: choose the visual rendering.
- Click **Save** to apply.

### Examples ✅
- Highlight: `manager`
- Exclude: `business manager, product manager`

Result: full phrases are struck through, but `manager` is still highlighted elsewhere.

### Technical Notes 🧩
- Exclusions are applied before highlights.
- Multi-word phrases match regular and some special spaces.
- Inputs and the UI panel are ignored.

### FAQ 🧯
- A word is still highlighted inside an excluded phrase: make sure the exact phrase is in **Exclude** without typos.
- The excluded phrase does not match: some layouts split phrases into multiple DOM nodes; try excluding individual words.
- Style does not change: click **Save** then reload the page.

### Files 📁
- `keyword-highlighter.user.js`: main userscript.
- `CHANGELOG.md`: version history.

### License 📜
MIT (see `keyword-highlighter.user.js` for details).
