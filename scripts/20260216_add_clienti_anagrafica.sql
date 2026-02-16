create table if not exists public.clienti_anagrafica (
  id uuid primary key default gen_random_uuid(),
  denominazione text not null,
  denominazione_norm text not null,
  piva text null,
  codice_fiscale text null,
  codice_sdi text null,
  pec text null,
  email text null,
  telefono text null,
  indirizzo text null,
  comune text null,
  cap text null,
  provincia text null,
  paese text null,
  codice_interno text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clienti_anagrafica_piva_unique
  on public.clienti_anagrafica (piva)
  where piva is not null and piva <> '';

create unique index if not exists clienti_anagrafica_codice_fiscale_unique
  on public.clienti_anagrafica (codice_fiscale)
  where codice_fiscale is not null and codice_fiscale <> '';

create index if not exists clienti_anagrafica_denominazione_norm_idx
  on public.clienti_anagrafica (denominazione_norm);

alter table public.checklists
  add column if not exists cliente_id uuid references public.clienti_anagrafica(id);
