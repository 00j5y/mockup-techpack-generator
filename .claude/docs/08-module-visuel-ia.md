# 08 - Module 5 : Génération de visuel photoréaliste (Phase 5)

Route : `/products/[id]/visual`

## À récupérer auprès de Jay avant de coder

La spec renvoie aux prompts rédigés manuellement lors des échanges précédents comme référence de formulation. **Ces prompts ne sont pas dans le repo.** Demander à Jay 2 ou 3 exemples de prompts qui ont donné de bons résultats, et les archiver dans `.claude/docs/prompts-reference/` avant d'écrire `buildImagePrompt.ts`.

Sans ces exemples, on va réinventer une formulation moins bonne que celle déjà validée en pratique.

## Flux

1. L'utilisateur sélectionne les flats à utiliser en référence (front, back, éventuellement une inspo)
2. Bouton "Construire le prompt" → appel à `lib/prompt/buildImagePrompt.ts`
3. **Le prompt généré est affiché dans un textarea éditable.** Aucun envoi automatique.
4. L'utilisateur choisit la qualité (`low` pour itérer, `high` pour le rendu final), voit le **coût estimé**, puis lance
5. Appel API avec le prompt + les images de référence
6. Résultat stocké dans `generated_visuals` (prompt utilisé, qualité, coût, flats d'entrée), affiché dans une galerie
7. Deux boutons : "Régénérer" (même prompt) et "Nouvelle variante" (retour à l'édition du prompt)

## Construction du prompt

`lib/prompt/buildImagePrompt.ts` est une **fonction pure** : données produit en entrée, string en sortie. Pas de réseau, pas de Supabase. Testable unitairement, sans coût.

Structure du prompt, dans cet ordre (toujours en **anglais**) :

1. **Contexte photo studio** : type de prise de vue, éclairage, fond, cadrage
2. **Tissu** : `main_fabric` + description qualitative de la couleur dérivée de `fabric_color_hex`
3. **Dégradé** : formulation adaptée à `fabric_gradient_intensity` si `fabric_gradient_enabled`
4. **Détails de construction** : dérivés du BOM et des callouts (hardware, coutures, cordons, zips)
5. **Style et rendu final**

### Conversion hex → description qualitative

Un modèle d'image ne comprend pas `#3F3F41`. Il faut une description textuelle : `"dark charcoal grey with a slight cool undertone"`.

Implémentation : conversion hex → HSL, puis classification (teinte / saturation / luminosité) vers un vocabulaire contrôlé. Fonction séparée et testée, par exemple `lib/prompt/describeColor.ts`. Toujours mentionner **aussi le code hex** dans le prompt en complément de la description : certains modèles l'exploitent.

### Formulation du dégradé

Trois niveaux, trois formulations distinctes à calibrer avec les prompts de référence de Jay :

| Intensité | Direction de formulation |
|---|---|
| `subtle` | variation à peine perceptible, effet de lumière naturelle |
| `medium` | dégradé visible mais doux, sans rupture franche |
| `strong` | dégradé marqué, contraste net entre les zones |

### Sources de détails

Le prompt doit exploiter les données déjà saisies, pas demander une nouvelle saisie :

- `bom_items` de type `hardware` / `trim` → mentions de boutons, zips, cordons, avec leur finition
- `callouts` → détails de construction annotés
- `artwork_specs` → placement et technique des éléments graphiques
- `extra_references` → traitements spéciaux (acid wash, délavage, distress zones)

## Appel API

`lib/openai/generateImage.ts` reçoit un prompt **déjà construit** et des images de référence. Il ne fabrique aucun texte.

`lib/openai/config.ts` centralise :
- l'identifiant du modèle
- la table de tarification par niveau de qualité
- les paramètres par défaut (taille, format)

### À vérifier avant de coder (obligatoire)

L'identifiant exact du modèle, les valeurs acceptées pour la qualité, le format d'entrée multi-image et **la tarification réelle** doivent être confirmés contre la documentation OpenAI officielle au début de la Phase 5. Ne pas se fier à une valeur mémorisée : c'est de l'argent réel et une API qui évolue.

## Gestion des coûts

- **Coût estimé affiché avant chaque génération**, basé sur la qualité choisie et le nombre d'images d'entrée
- **Coût réel loggé après génération** dans `generated_visuals.cost_usd`
- Suivi cumulé visible : total par produit, et total global
- La qualité `low` est le défaut de l'UI : on itère en low, on finalise en high

## Garde-fous (règles dures)

1. **Aucun appel payant sans que le prompt ait été affiché à l'utilisateur.** Pas de "génération rapide" qui court-circuite l'étape de review.
2. **Une génération à la fois.** Pas de génération de variantes en parallèle en V1 (hors scope explicite).
3. Le bouton de génération est désactivé pendant un appel en cours, avec état de chargement clair.
4. La clé API vit **uniquement côté serveur** (`OPENAI_API_KEY`, sans préfixe `NEXT_PUBLIC_`). L'appel part d'une route API, jamais du navigateur.

## Definition of done Phase 5

- [ ] Je sélectionne mes flats et je clique "Construire le prompt"
- [ ] Le prompt s'affiche en anglais, structuré, et je peux le modifier avant envoi
- [ ] `buildImagePrompt` est couvert par des tests unitaires, sans appel réseau
- [ ] La description de couleur produite est cohérente pour plusieurs hex testés
- [ ] Le coût estimé s'affiche avant génération et correspond à la tarification vérifiée
- [ ] La génération produit une image stockée, visible dans la galerie avec son prompt
- [ ] Le coût réel est enregistré et le cumul par produit est affichable
- [ ] Aucun chemin de code ne peut déclencher une génération sans review du prompt
- [ ] La clé API n'apparaît jamais dans le bundle client
