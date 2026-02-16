-- add attivo flag for clienti_anagrafica (soft delete)
alter table public.clienti_anagrafica
  add column if not exists attivo boolean not null default true;

create index if not exists clienti_anagrafica_attivo_idx
  on public.clienti_anagrafica (attivo);
