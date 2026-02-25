alter table if exists public.saas_interventi
  add column if not exists data_tassativa date null;

create index if not exists saas_interventi_data_tassativa_idx
  on public.saas_interventi (data_tassativa);
