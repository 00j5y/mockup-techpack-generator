-- Constitue Studio : buckets Storage
-- Reference : .claude/docs/13-env-setup.md
--
-- Decision Phase 0 : deux buckets, decoupes par "qui doit pouvoir lire", pas par type de contenu.
--
--   product-assets  PUBLIC   Tout ce que le canvas et le rendu PDF doivent charger :
--                            flats, overlays, images BOM / packaging / artwork / extra, logos.
--                            Public parce que deux consommateurs l'exigent :
--                              1. l'export canvas Konva (stage.toDataURL) echoue si l'image de
--                                 fond vient d'une origine sans en-tete CORS approprie ;
--                              2. Puppeteer doit charger ces images au rendu du techpack.
--                            Des URLs signees seraient possibles mais ajoutent un point de
--                            defaillance silencieux sur les deux chemins critiques du projet.
--
--   product-outputs PRIVE    Livrables : visuels generes par IA et techpacks PDF.
--                            Aucun consommateur navigateur anonyme, acces par URL signee.

insert into storage.buckets (id, name, public)
values
  ('product-assets', 'product-assets', true),
  ('product-outputs', 'product-outputs', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- product-assets : lecture publique, ecriture authentifiee
-- ---------------------------------------------------------------------------

create policy "assets readable by anyone"
  on storage.objects for select
  using (bucket_id = 'product-assets');

create policy "assets writable by authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-assets');

create policy "assets updatable by authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-assets')
  with check (bucket_id = 'product-assets');

create policy "assets deletable by authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-assets');

-- ---------------------------------------------------------------------------
-- product-outputs : tout reserve aux utilisateurs authentifies
-- ---------------------------------------------------------------------------

create policy "outputs readable by authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-outputs');

create policy "outputs writable by authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-outputs');

create policy "outputs updatable by authenticated"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-outputs')
  with check (bucket_id = 'product-outputs');

create policy "outputs deletable by authenticated"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-outputs');
