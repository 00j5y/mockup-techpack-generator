# 03 - Modèle de données (Postgres)

Schéma de référence **métier**. L'implémentation fait autorité : le schéma vit dans `lib/db/schema.ts` (Drizzle), qui génère à la fois les migrations SQL de `drizzle/` et les types de `types/product.ts`.

Ce fichier explique le *pourquoi* de chaque table et de chaque contrainte. Le SQL ci-dessous est celui de la spec initiale, conservé pour la lecture : ne jamais l'appliquer à la main, toute évolution passe par `lib/db/schema.ts` puis `bun run db:generate`.

> **Le schéma initial ci-dessous est incomplet.** L'analyse du template Seaggs a révélé 8 manques. Ils sont détaillés en fin de fichier, section "Corrections issues du template". La migration de Phase 0 doit inclure le schéma de base **et** ces corrections.

## 3.1 `products`

```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  drop_number integer not null,
  style_name text not null,
  style_number text not null,
  category text not null check (category in ('shirt', 'pants', 'jacket', 'other')),
  description text,
  main_fabric text not null,           -- ex: "270 GSM yarn-dyed cotton interlock"
  fabric_color_hex text,               -- ex: "#3F3F41"
  fabric_gradient_enabled boolean default false,
  fabric_gradient_intensity text check (fabric_gradient_intensity in ('subtle','medium','strong')),
  size_range text[] default array['XS','S','M','L','XL','2XL'],
  designer text default 'Constitue',
  company text default 'Constitue',
  status text default 'draft' check (status in ('draft','sample','production','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 3.2 `product_flats` (flats techniques + photos d'inspo)

```sql
create table product_flats (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  type text not null check (type in ('flat_front', 'flat_back', 'flat_detail', 'inspo_reference')),
  storage_path text not null,          -- chemin relatif dans le stockage local
  label text,                          -- ex: "Manche détail" pour les flat_detail
  created_at timestamptz default now()
);
```

## 3.3 `measurement_points` (éditeur canvas)

```sql
create table measurement_points (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  flat_id uuid references product_flats(id) on delete cascade,
  point_label text not null,           -- "A", "B", "C"... auto-incrémenté, éditable
  measurement_name text not null,      -- "SHOULDER", "CHEST"...
  x_percent numeric not null,          -- position relative 0-100, JAMAIS de px
  y_percent numeric not null,
  end_x_percent numeric,               -- pour les lignes de cote à deux points
  end_y_percent numeric,
  sort_order integer default 0,
  created_at timestamptz default now()
);
```

Un point est **simple** si `end_x_percent`/`end_y_percent` sont `null`, **ligne de cote** sinon. Pas de colonne `type` redondante.

## 3.4 `measurement_values` (valeurs par taille)

```sql
create table measurement_values (
  id uuid primary key default gen_random_uuid(),
  measurement_point_id uuid references measurement_points(id) on delete cascade,
  size text not null,                  -- "XS", "S", "M"...
  value_inches numeric not null,
  unique(measurement_point_id, size)
);
```

## 3.5 `bom_items` (Bill of Materials, page 4)

```sql
create table bom_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  cell_label text not null,            -- "A" à "L", position dans la grille 4x3
  item_type text check (item_type in ('fabric_swatch','hardware','trim','other')),
  title text not null,
  description text,
  pantone_id text,
  image_storage_path text,             -- éléments illustrés (drawstring, zip custom...)
  measurement_note text,               -- ex: "1 inch"
  created_at timestamptz default now()
);
```

## 3.6 `callouts` (page 5, annotations numérotées)

```sql
create table callouts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  flat_id uuid references product_flats(id) on delete cascade,
  number integer not null,
  x_percent numeric not null,
  y_percent numeric not null,
  description text not null,
  created_at timestamptz default now()
);
```

## 3.7 `color_specs` (page 6)

```sql
create table color_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  number integer not null,
  name text not null,                  -- "White", "Black"...
  hex text,
  pantone_id text,
  created_at timestamptz default now()
);
```

## 3.8 `packaging_specs` (page 7)

```sql
create table packaging_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  type text check (type in ('neck_tag','hang_tag','packaging_bag','other')),
  title text not null,
  image_storage_path text,
  width_inches numeric,
  height_inches numeric,
  pantone_id text,
  notes text,
  created_at timestamptz default now()
);
```

## 3.9 `artwork_specs` (pages 8-9)

```sql
create table artwork_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  flat_id uuid references product_flats(id) on delete cascade,
  title text not null,                 -- ex: "Screenprinted logo"
  technique text,                      -- "screenprint", "applique", "embroidery"...
  pantone_id text,
  width_inches numeric,
  height_inches numeric,
  position_note text,
  created_at timestamptz default now()
);
```

## 3.10 `extra_references` (pages 10-12, libre)

```sql
create table extra_references (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  title text,
  instruction_text text,               -- ex: "Acid wash garment fabric. Make it look like this:"
  image_storage_path text,
  created_at timestamptz default now()
);
```

## 3.11 `generated_visuals` (historique génération IA)

```sql
create table generated_visuals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  prompt_used text not null,
  quality text check (quality in ('low','medium','high')),
  storage_path text not null,
  input_flat_ids uuid[],               -- flats utilisés en référence
  cost_usd numeric,
  created_at timestamptz default now()
);
```

`input_flat_ids` est un tableau d'uuid **sans contrainte de clé étrangère** : c'est volontaire. L'historique doit survivre à la suppression d'un flat.

## 3.12 `techpack_revisions` (page 1, historique)

```sql
create table techpack_revisions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  version integer not null,
  summary text,
  pdf_storage_path text,
  created_at timestamptz default now()
);
```

---

## À ajouter au schéma en Phase 0

Ces éléments ne sont pas dans la spec initiale mais sont nécessaires :

### Index sur les clés étrangères

Postgres n'indexe pas automatiquement les FK. Toutes les tables enfants sont requêtées par `product_id` :

```sql
create index on product_flats (product_id);
create index on measurement_points (product_id);
create index on measurement_points (flat_id);
create index on measurement_values (measurement_point_id);
create index on bom_items (product_id);
create index on callouts (product_id);
create index on color_specs (product_id);
create index on packaging_specs (product_id);
create index on artwork_specs (product_id);
create index on extra_references (product_id);
create index on generated_visuals (product_id);
create index on techpack_revisions (product_id);
-- FK ajoutees par les corrections issues du template
create index on color_specs (flat_id);
create index on artwork_specs (flat_id);
create index on artwork_pantones (artwork_spec_id);
```

### Trigger `updated_at`

`products.updated_at` a un `default now()` mais rien ne le met à jour. Avec l'auto-save, cette colonne doit être fiable :

```sql
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger products_updated_at
  before update on products
  for each row execute function set_updated_at();
```

### RLS : sans objet depuis la sortie de Supabase

La spec initiale imposait la RLS parce qu'une base Supabase est jointe directement par le navigateur avec une clé publique : sans RLS, tout est lisible par n'importe qui.

Ce n'est plus le modèle. Postgres n'est jamais joint depuis le navigateur : il n'écoute que sur le réseau Docker, et seul le serveur Next.js s'y connecte. La surface d'attaque est l'application, pas la base.

**La conséquence est déplacée, pas supprimée** : la protection repose désormais entièrement sur l'application, qui n'a pas d'auth pour l'instant. Tant que ça tourne en local, sans conséquence. Avant tout déploiement public, il faut une auth : voir le bloquant dans `PROGRESS.md`.

### Champ overlay de mesures

Tranché : une colonne `overlay_storage_path text` sur `product_flats`, un overlay par flat, écrasé à chaque export. Pas d'historique des exports. Voir la correction 7 ci-dessous.

---

## Corrections issues du template

Manques constatés en confrontant le schéma au template Seaggs et à l'exemple rempli. Tous sont à intégrer dans la migration de Phase 0. Références de page : voir `15-template-seaggs.md`.

### 1. `products` : logo et taille de référence

```sql
alter table products
  add column logo_storage_path text,                     -- slot logo du header, present sur les 12 pages
  add column sample_sizes text[] not null default '{}';  -- tailles d'echantillon (encadrees en rouge + colonnes remplies page 3)
```

Le header du template a un **slot logo** de 72 x 70 pt à gauche, rempli sur les 12 pages de l'exemple. Sans ce champ, le header est incomplet sur toutes les pages.

`sample_sizes` pilote trois choses à la fois : les encadrés rouges du `SIZE RANGE:` dans le header (un par taille), les colonnes remplies de la page 3, et les valeurs affichées sur les cotes de la page 2 (portées par la première taille dans l'ordre canonique, voir `primarySampleSize()` dans `types/product.ts`). Un tableau plutôt qu'une valeur unique : on peut vouloir produire un sample en M et un en L. Le CHECK `products_sample_sizes_in_range` (`sample_sizes <@ size_range`, inclusion d'ensemble) garde l'incohérence de l'exemple Seaggs structurellement impossible. Tableau vide autorisé, c'est l'état brouillon : seule la génération du techpack exige au moins une taille.

### 2. `color_specs` : position des pins

La page 6 pose des **pins numérotés sur un flat**, en plus de la légende. Le schéma initial n'a aucune position.

```sql
alter table color_specs
  add column flat_id uuid references product_flats(id) on delete set null,
  add column x_percent numeric,
  add column y_percent numeric,
  add column pin_direction text check (pin_direction in ('left','right')) default 'left';
```

`pin_direction` : dans l'exemple, l'orientation de la pointe du pin varie selon le placement. `set null` plutôt que `cascade` : supprimer un flat ne doit pas effacer une couleur, juste son ancrage.

### 3. `callouts` : orientation du pin

```sql
alter table callouts
  add column pin_direction text check (pin_direction in ('left','right')) default 'left';
```

### 4. `artwork_specs` : plusieurs Pantone par élément

L'exemple montre un artwork avec **3 Pantone** (`421 C`, `536 C`, `7544 C`). Le champ `pantone_id` singulier ne suffit pas. Table enfant plutôt que tableau, pour garder l'ordre d'affichage et le hex de chaque swatch :

```sql
create table artwork_pantones (
  id uuid primary key default gen_random_uuid(),
  artwork_spec_id uuid references artwork_specs(id) on delete cascade,
  pantone_id text not null,
  hex text,                            -- alimente le petit carre de couleur en legende
  sort_order integer default 0
);
create index on artwork_pantones (artwork_spec_id);
```

`artwork_specs.pantone_id` est conservé pour les cas mono-Pantone, ou supprimé au profit de la table enfant. Trancher en Phase 0 : **une seule source** pour éviter d'avoir à décider à l'affichage lequel des deux gagne.

### 5. `artwork_specs` : position et fond de prévisualisation

```sql
alter table artwork_specs
  add column x_percent numeric,
  add column y_percent numeric,
  add column width_percent numeric,
  add column background_hex text;      -- fond noir pour les impressions blanches
```

Sans `background_hex`, un artwork blanc est invisible sur le fond blanc de la page. L'exemple place systématiquement les impressions blanches sur un rectangle noir.

### 6. `packaging_specs` et `extra_references` : position

Les pages 7, 10, 11 et 12 sont des **canvas libres**, sans grille. Les blocs de l'exemple ne sont ni alignés ni de taille égale.

```sql
alter table packaging_specs
  add column x_percent numeric,
  add column y_percent numeric,
  add column width_percent numeric,
  add column dimension_orientation text check (dimension_orientation in ('horizontal','vertical')) default 'horizontal';

alter table extra_references
  add column x_percent numeric,
  add column y_percent numeric,
  add column width_percent numeric;
```

Ces colonnes sont **requises** : le canvas libre a été retenu pour ces pages le 2026-07-27. Voir `06-module-formulaires.md`.

### 7. `product_flats` : encarts de détail positionnés

La page 2 porte le flat front, le flat back, **et des encarts de détail flottants** placés librement par-dessus (dans l'exemple, un détail de capuche centré en haut, portant les cotes J et K).

```sql
alter table product_flats
  add column overlay_storage_path text, -- export canvas (flat + annotations), voir section overlay
  add column x_percent numeric,         -- pour les flat_detail uniquement
  add column y_percent numeric,
  add column width_percent numeric;
```

`overlay_storage_path` répond aussi à la question laissée ouverte en section "Champ overlay de mesures" ci-dessus : **c'est cette option qui est retenue**, une colonne sur `product_flats`, un overlay par flat, écrasé à chaque export.

### 8. `techpack_revisions` : colonnes du tableau page 1

Le tableau de révisions a 4 colonnes : `HISTORY:`, `PAGES:`, `DATE SUBMITTED:`, `SUMMARY:`.

```sql
alter table techpack_revisions
  add column history_label text,        -- colonne HISTORY: (ex "REV 2")
  add column pages_affected text;       -- colonne PAGES: (ex "2, 3, 6")
```

`DATE SUBMITTED:` est dérivé de `created_at`, formaté à l'américaine (`October 17th, 2023`). Le tableau affiche les **4 dernières révisions** seulement, c'est le nombre de lignes du template.

---

## Duplication de produit (préparé, pas construit en V1)

La duplication n'est pas une feature V1 mais le schéma ne doit pas la rendre difficile. Contraintes à respecter :

1. **Aucune contrainte `unique` globale** sur `style_number`, `style_name` ou `drop_number`. Un doublon temporaire doit être possible.
2. Toutes les tables enfants pointent vers `products.id` : une duplication = insert du produit + insert des enfants avec le nouveau `product_id`.
3. **Attention aux FK vers `product_flats`** : `measurement_points`, `callouts`, `artwork_specs` et `color_specs` référencent un `flat_id`. Dupliquer un produit implique de dupliquer les flats **puis** de remapper les `flat_id` des enfants. Garder une table de correspondance `ancien_id → nouveau_id` pendant l'opération.
5. `artwork_pantones` est un petit-enfant (`products` → `artwork_specs` → `artwork_pantones`) : la duplication doit descendre à deux niveaux, pas un.
4. Ne jamais introduire de champ calculé dénormalisé qui devrait être recalculé à la duplication.
