# 02 - Architecture et arborescence

## Arborescence cible

```
constitue-studio/
├── app/
│   ├── (dashboard)/
│   │   ├── products/
│   │   │   ├── page.tsx                  # liste des produits
│   │   │   ├── new/page.tsx              # création produit
│   │   │   └── [id]/
│   │   │       ├── page.tsx              # vue d'ensemble + complétion par section
│   │   │       ├── measurements/page.tsx # éditeur canvas
│   │   │       ├── bom/page.tsx          # bill of materials
│   │   │       ├── colors/page.tsx       # Pantone / hex
│   │   │       ├── packaging/page.tsx    # labels / tags / packaging
│   │   │       ├── artwork/page.tsx      # callouts / artwork
│   │   │       ├── visual/page.tsx       # génération image IA
│   │   │       └── techpack/page.tsx     # preview + export PDF
│   ├── api/
│   │   ├── products/
│   │   ├── measurements/
│   │   ├── generate-image/
│   │   ├── generate-techpack/
│   │   └── upload/
│   └── layout.tsx
├── components/
│   ├── canvas/
│   │   ├── AnnotatedCanvas.tsx           # primitive reutilisable (6 pages du techpack)
│   │   ├── MeasurementEditor.tsx         # specialisation mesures
│   │   ├── MeasurementPoint.tsx
│   │   ├── MeasurementLine.tsx           # cote rouge a embouts perpendiculaires
│   │   ├── annotations/                  # types d'annotation interchangeables
│   │   │   ├── DimensionLine.tsx
│   │   │   ├── Pin.tsx                   # pastille numerotee (callouts, colors)
│   │   │   ├── ImageBlock.tsx            # bloc image libre (packaging, artwork, extra)
│   │   │   └── TextBlock.tsx
│   │   └── CanvasToolbar.tsx
│   ├── techpack/
│   │   ├── templates/                    # un composant par page de techpack
│   │   │   ├── CoverPage.tsx
│   │   │   ├── MeasurementsMockupPage.tsx
│   │   │   ├── MeasurementsSpecPage.tsx
│   │   │   ├── BOMPage.tsx
│   │   │   ├── CalloutsPage.tsx
│   │   │   ├── ColorsPage.tsx
│   │   │   ├── PackagingPage.tsx
│   │   │   ├── ArtworkPage.tsx
│   │   │   └── ExtraPage.tsx
│   │   ├── headerLayout.ts               # geometrie du header : LA source unique
│   │   ├── TechpackHeader.tsx            # rendu print (pur, Puppeteer + preview)
│   │   └── TechpackHeaderEditor.tsx      # rendu edition (client, champs + drop logo)
│   ├── forms/
│   └── ui/
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # client navigateur (anon key)
│   │   └── server.ts                     # client serveur (service_role)
│   ├── openai/
│   │   ├── config.ts                     # id du modèle + table de tarification
│   │   └── generateImage.ts              # appel API pur
│   ├── pdf/
│   │   └── renderTechpack.ts             # orchestration Puppeteer
│   └── prompt/
│       └── buildImagePrompt.ts           # construction du prompt IA (testable, pur)
└── types/
    └── product.ts                        # types partagés
```

## Frontières de responsabilité

Ces séparations ne sont pas cosmétiques, elles sont testables :

| Module | Ne doit PAS |
|---|---|
| `lib/prompt/buildImagePrompt.ts` | Faire d'appel réseau. Fonction pure : données produit en entrée, string en sortie. |
| `lib/openai/generateImage.ts` | Construire du texte de prompt. Reçoit un prompt déjà formé. |
| `components/techpack/templates/*` | Aller chercher des données. Reçoit tout en props. |
| `components/canvas/*` | Écrire en base directement. Remonte les événements au parent. |
| `lib/pdf/renderTechpack.ts` | Contenir du HTML de mise en page. Orchestre Puppeteer uniquement. |
| `components/canvas/AnnotatedCanvas.tsx` | Connaître la notion de mesure, de taille ou de POI. C'est une primitive générique réutilisée par 6 pages. |

Ce découpage permet de tester la construction du prompt sans dépenser d'argent, et de rendre les pages de techpack en preview navigateur sans lancer Puppeteer.

## Le header : une géométrie, deux rendus

Le bloc header sert deux usages contradictoires : il est **rendu dans le PDF** (composant pur, aucune interactivité, passé à Puppeteer) et il est **la surface de saisie** des champs produit (champs de texte, zone de drop du logo, donc Client Component).

Ne pas résoudre ça avec un `mode: 'print' | 'edit'` sur un composant unique : le composant deviendrait client, et le chemin de rendu PDF traînerait de l'hydratation React et des balises `<input>` dont il n'a aucun besoin.

Résolution :

| Fichier | Rôle | Contient |
|---|---|---|
| `headerLayout.ts` | **La géométrie, définie une seule fois** | Coordonnées et largeurs des 3 colonnes, du slot logo, des libellés |
| `TechpackHeader.tsx` | Rendu print | Composant pur, texte, pas de `'use client'` |
| `TechpackHeaderEditor.tsx` | Rendu édition | Client Component, champs de saisie et zone de drop, positionnés depuis `headerLayout` |

La règle dure "le header n'existe qu'à un seul endroit" porte sur **la géométrie et les données**, pas sur le nombre de fichiers. Deux renderers qui lisent la même constante ne dupliquent rien. Deux fichiers avec des coordonnées copiées-collées, si.

Test de non-régression du principe : changer la largeur de la colonne 2 dans `headerLayout.ts` doit déplacer le texte dans le PDF **et** redimensionner le champ de saisie, sans toucher à autre chose.

## Server Components vs Client Components

- Pages de listing et de détail : **Server Components** par défaut, fetch Supabase côté serveur.
- Formulaires avec auto-save : Client Components (`'use client'`), appel aux routes API.
- Éditeur canvas : Client Component, chargé en `dynamic(..., { ssr: false })`.
- Pages de techpack (`components/techpack/templates/*`) : composants purs sans `'use client'`, rendus côté serveur pour Puppeteer **et** réutilisés en preview navigateur.

## Réutilisation de la preview techpack

Le même composant de page sert deux usages :

1. `/products/[id]/techpack` affiche la preview HTML dans le navigateur
2. `/api/generate-techpack` rend ces mêmes composants en HTML complet que Puppeteer transforme en PDF

Corollaire : **le CSS de mise en page doit fonctionner à l'identique dans les deux contextes**. Utiliser des unités absolues (mm, pt) pour les dimensions de page, et une classe `print`/`page` partagée. Pas de styles conditionnels du type "si on est dans Puppeteer alors...".
