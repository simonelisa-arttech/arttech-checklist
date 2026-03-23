create table if not exists public.aziende (
  id uuid primary key default gen_random_uuid(),
  ragione_sociale text not null,
  partita_iva text null,
  tipo text not null check (tipo in ('INTERNA', 'ESTERNA')),
  attiva boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.personale (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cognome text not null,
  azienda_id uuid null references public.aziende(id) on delete set null,
  tipo text not null check (tipo in ('INTERNO', 'ESTERNO')),
  telefono text null,
  email text null,
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.personale_documenti (
  id uuid primary key default gen_random_uuid(),
  personale_id uuid not null references public.personale(id) on delete cascade,
  tipo_documento text not null,
  data_rilascio date null,
  data_scadenza date null,
  note text null,
  file_url text null
);

create table if not exists public.aziende_documenti (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  tipo_documento text not null,
  data_scadenza date null,
  note text null,
  file_url text null
);

create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  codice text not null,
  nome text not null
);

create index if not exists idx_aziende_tipo on public.aziende(tipo);
create index if not exists idx_personale_azienda_id on public.personale(azienda_id);
create index if not exists idx_personale_tipo on public.personale(tipo);
create index if not exists idx_personale_documenti_personale_id on public.personale_documenti(personale_id);
create index if not exists idx_personale_documenti_scadenza on public.personale_documenti(data_scadenza);
create index if not exists idx_aziende_documenti_azienda_id on public.aziende_documenti(azienda_id);
create index if not exists idx_aziende_documenti_scadenza on public.aziende_documenti(data_scadenza);
create unique index if not exists idx_document_types_codice_uniq on public.document_types(codice);
