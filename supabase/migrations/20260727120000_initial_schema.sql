-- Constitue Studio : schema initial
-- Reference : .claude/docs/03-database.md (schema de base + les 8 corrections issues du template)
-- Les corrections sont integrees directement ici, pas en ALTER : c'est la migration initiale.

-- ---------------------------------------------------------------------------
-- Fonction utilitaire : maintien de updated_at
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  drop_number integer not null,
  style_name text not null,
  style_number text not null,
  category text not null check (category in ('shirt', 'pants', 'jacket', 'other')),
  description text,
  main_fabric text not null,              -- ex: "270 GSM yarn-dyed cotton interlock"
  fabric_color_hex text,                  -- ex: "#3F3F41"
  fabric_gradient_enabled boolean not null default false,
  fabric_gradient_intensity text check (fabric_gradient_intensity in ('subtle','medium','strong')),
  size_range text[] not null default array['XS','S','M','L','XL','2XL'],

  -- Taille de reference : pilote l'encadre rouge du header, la colonne remplie
  -- page 3 et les valeurs affichees sur les cotes page 2. Une seule source.
  -- Nullable en base pour permettre les brouillons, obligatoire dans le formulaire
  -- et bloquant pour la generation du techpack.
  sample_size text,

  designer text not null default 'Constitue',
  company text not null default 'Constitue',
  logo_storage_path text,                 -- slot logo du header, present sur les 12 pages
  status text not null default 'draft' check (status in ('draft','sample','production','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Rend structurellement impossible l'incoherence de l'exemple Seaggs
  -- (encadre rouge sur XL, colonne remplie sur L).
  constraint sample_size_in_range check (sample_size is null or sample_size = any(size_range))
);

create trigger products_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- product_flats : flats techniques et photos d'inspo
-- ---------------------------------------------------------------------------

create table product_flats (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  type text not null check (type in ('flat_front', 'flat_back', 'flat_detail', 'inspo_reference')),
  storage_path text not null,
  overlay_storage_path text,              -- export canvas (flat + annotations), ecrase a chaque export
  label text,                             -- ex: "Manche detail", obligatoire pour les flat_detail

  -- Placement des encarts de detail flottants sur la page 2 du techpack.
  -- Utilise uniquement pour type = 'flat_detail'.
  x_percent numeric,
  y_percent numeric,
  width_percent numeric,

  created_at timestamptz not null default now()
);

create index on product_flats (product_id);

-- ---------------------------------------------------------------------------
-- measurement_points : points et cotes poses sur un flat (page 2)
-- ---------------------------------------------------------------------------

-- Un point est SIMPLE si end_x_percent / end_y_percent sont null,
-- LIGNE DE COTE sinon. Pas de colonne type redondante.
create table measurement_points (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  flat_id uuid not null references product_flats(id) on delete cascade,
  point_label text not null,              -- "A", "B", "C"... auto-incremente, editable
  measurement_name text not null,         -- "SHOULDER", "CHEST"...
  x_percent numeric not null,             -- position relative 0-100, JAMAIS de px
  y_percent numeric not null,
  end_x_percent numeric,
  end_y_percent numeric,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index on measurement_points (product_id);
create index on measurement_points (flat_id);

-- ---------------------------------------------------------------------------
-- measurement_values : valeurs par taille (page 3)
-- ---------------------------------------------------------------------------

create table measurement_values (
  id uuid primary key default gen_random_uuid(),
  measurement_point_id uuid not null references measurement_points(id) on delete cascade,
  size text not null,                     -- "XS", "S", "M"...
  value_inches numeric not null,          -- toujours en pouces, jamais de conversion implicite
  unique (measurement_point_id, size)
);

create index on measurement_values (measurement_point_id);

-- ---------------------------------------------------------------------------
-- bom_items : grille 4x3, cellules A a L (page 4)
-- ---------------------------------------------------------------------------

create table bom_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  cell_label text not null check (cell_label in ('A','B','C','D','E','F','G','H','I','J','K','L')),
  item_type text check (item_type in ('fabric_swatch','hardware','trim','other')),
  title text not null,
  description text,
  pantone_id text,
  image_storage_path text,
  measurement_note text,                  -- rendu en cote rouge a cote de l'image, ex: "1 inch"
  created_at timestamptz not null default now(),
  unique (product_id, cell_label)
);

create index on bom_items (product_id);

-- ---------------------------------------------------------------------------
-- callouts : pins numerotes (page 5, 12 emplacements)
-- ---------------------------------------------------------------------------

create table callouts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  flat_id uuid references product_flats(id) on delete cascade,
  number integer not null check (number between 1 and 12),
  x_percent numeric not null,
  y_percent numeric not null,
  pin_direction text not null default 'left' check (pin_direction in ('left','right')),
  description text not null,
  created_at timestamptz not null default now(),
  unique (product_id, number)
);

create index on callouts (product_id);
create index on callouts (flat_id);

-- ---------------------------------------------------------------------------
-- color_specs : pins + legende (page 6, 6 emplacements)
-- ---------------------------------------------------------------------------

-- flat_id en `set null` et non `cascade` : supprimer un flat ne doit pas effacer
-- une couleur, seulement son ancrage visuel.
create table color_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  flat_id uuid references product_flats(id) on delete set null,
  number integer not null check (number between 1 and 6),
  name text not null,                     -- "White", "Black"...
  hex text,                               -- alimente le carre de couleur en legende
  pantone_id text,                        -- affiche en priorite sur name s'il existe
  x_percent numeric,
  y_percent numeric,
  pin_direction text not null default 'left' check (pin_direction in ('left','right')),
  created_at timestamptz not null default now(),
  unique (product_id, number)
);

create index on color_specs (product_id);
create index on color_specs (flat_id);

-- ---------------------------------------------------------------------------
-- packaging_specs : canvas libre (page 7)
-- ---------------------------------------------------------------------------

create table packaging_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  type text check (type in ('neck_tag','hang_tag','packaging_bag','other')),
  title text not null,
  image_storage_path text,
  width_inches numeric,
  height_inches numeric,
  pantone_id text,
  pantone_hex text,                       -- carre de couleur a cote du libelle Pantone
  notes text,
  x_percent numeric,
  y_percent numeric,
  width_percent numeric,
  dimension_orientation text not null default 'horizontal'
    check (dimension_orientation in ('horizontal','vertical')),
  created_at timestamptz not null default now()
);

create index on packaging_specs (product_id);

-- ---------------------------------------------------------------------------
-- artwork_specs : canvas libre (pages 8-9)
-- ---------------------------------------------------------------------------

-- Pas de colonne pantone_id ici : les Pantone vivent dans artwork_pantones,
-- y compris quand il n'y en a qu'un. Une seule source, pas d'arbitrage a l'affichage.
create table artwork_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  flat_id uuid references product_flats(id) on delete set null,
  page integer not null default 8 check (page in (8, 9)),
  title text not null,                    -- ex: "Screenprinted logo"
  technique text,                         -- "screenprint", "applique", "embroidery"...
  width_inches numeric,
  height_inches numeric,
  position_note text,
  background_hex text,                    -- fond noir pour rendre visible une impression blanche
  x_percent numeric,
  y_percent numeric,
  width_percent numeric,
  created_at timestamptz not null default now()
);

create index on artwork_specs (product_id);
create index on artwork_specs (flat_id);

create table artwork_pantones (
  id uuid primary key default gen_random_uuid(),
  artwork_spec_id uuid not null references artwork_specs(id) on delete cascade,
  pantone_id text not null,
  hex text,                               -- alimente le petit carre de couleur en legende
  sort_order integer not null default 0
);

create index on artwork_pantones (artwork_spec_id);

-- ---------------------------------------------------------------------------
-- extra_references : canvas libre (pages 10-12, une par page)
-- ---------------------------------------------------------------------------

create table extra_references (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  page integer not null default 10 check (page in (10, 11, 12)),
  title text,
  instruction_text text,                  -- ex: "Acid wash garment fabric. Make it look like this:"
  image_storage_path text,
  x_percent numeric,
  y_percent numeric,
  width_percent numeric,
  created_at timestamptz not null default now(),
  unique (product_id, page)
);

create index on extra_references (product_id);

-- ---------------------------------------------------------------------------
-- generated_visuals : historique des generations IA
-- ---------------------------------------------------------------------------

-- input_flat_ids est un tableau d'uuid SANS contrainte de cle etrangere :
-- l'historique doit survivre a la suppression d'un flat.
create table generated_visuals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  prompt_used text not null,
  quality text check (quality in ('low','medium','high')),
  storage_path text not null,
  input_flat_ids uuid[],
  cost_usd numeric,
  created_at timestamptz not null default now()
);

create index on generated_visuals (product_id);

-- ---------------------------------------------------------------------------
-- techpack_revisions : tableau REVISION HISTORY (page 1, 4 lignes affichees)
-- ---------------------------------------------------------------------------

create table techpack_revisions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  version integer not null,
  history_label text,                     -- colonne HISTORY:, ex "REV 2"
  pages_affected text,                    -- colonne PAGES:, ex "2, 3, 6"
  summary text,                           -- colonne SUMMARY:
  pdf_storage_path text,
  created_at timestamptz not null default now(),  -- alimente la colonne DATE SUBMITTED:
  unique (product_id, version)
);

create index on techpack_revisions (product_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Mono-utilisateur, mais RLS activee partout : une table Supabase sans RLS est
-- lisible par quiconque dispose de la cle anon, qui est publique par nature.
do $$
declare t text;
begin
  foreach t in array array[
    'products', 'product_flats', 'measurement_points', 'measurement_values',
    'bom_items', 'callouts', 'color_specs', 'packaging_specs',
    'artwork_specs', 'artwork_pantones', 'extra_references',
    'generated_visuals', 'techpack_revisions'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "authenticated full access" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
