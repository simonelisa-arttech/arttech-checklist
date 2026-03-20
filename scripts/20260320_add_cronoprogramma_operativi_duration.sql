alter table if exists public.cronoprogramma_meta
  add column if not exists data_inizio date null,
  add column if not exists durata_giorni integer null;
