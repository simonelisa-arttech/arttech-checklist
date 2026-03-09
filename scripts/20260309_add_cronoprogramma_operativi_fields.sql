alter table if exists public.cronoprogramma_meta
  add column if not exists personale_previsto text null,
  add column if not exists mezzi text null,
  add column if not exists descrizione_attivita text null,
  add column if not exists indirizzo text null,
  add column if not exists orario text null,
  add column if not exists referente_cliente_nome text null,
  add column if not exists referente_cliente_contatto text null,
  add column if not exists commerciale_art_tech_nome text null,
  add column if not exists commerciale_art_tech_contatto text null;
