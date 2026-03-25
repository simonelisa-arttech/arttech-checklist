alter table if exists public.cronoprogramma_meta
  add column if not exists personale_ids uuid[] null;

create index if not exists cronoprogramma_meta_personale_ids_gin
  on public.cronoprogramma_meta
  using gin (personale_ids);
