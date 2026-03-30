create table if not exists public.document_catalog (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  target text not null check (target in ('PERSONALE', 'AZIENDA', 'ENTRAMBI')),
  categoria text null,
  has_scadenza boolean not null default true,
  validita_mesi integer null,
  required_default boolean not null default false,
  attivo boolean not null default true,
  sort_order integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.document_catalog (
  nome,
  target,
  categoria,
  has_scadenza,
  validita_mesi,
  required_default,
  attivo,
  sort_order
)
values
  ('Visita medica', 'PERSONALE', 'DOCUMENTO_PERSONALE', true, null, true, true, 10),
  ('Formazione generale', 'PERSONALE', 'CORSO_PERSONALE', false, null, true, true, 20),
  ('Formazione specifica', 'PERSONALE', 'CORSO_PERSONALE', true, null, true, true, 30),
  ('Lavori in quota', 'PERSONALE', 'ABILITAZIONE_PERSONALE', true, null, false, true, 40),
  ('Primo soccorso', 'PERSONALE', 'CORSO_PERSONALE', true, null, false, true, 50),
  ('Antincendio', 'PERSONALE', 'CORSO_PERSONALE', true, null, false, true, 60),
  ('Patente / patentini', 'PERSONALE', 'ABILITAZIONE_PERSONALE', true, null, false, true, 70),
  ('DURC', 'AZIENDA', 'DOCUMENTO_AZIENDA', true, null, true, true, 110),
  ('Visura camerale', 'AZIENDA', 'DOCUMENTO_AZIENDA', true, null, true, true, 120),
  ('DVR', 'AZIENDA', 'DOCUMENTO_AZIENDA', true, null, false, true, 130),
  ('POS', 'AZIENDA', 'DOCUMENTO_AZIENDA', true, null, false, true, 140),
  ('Assicurazione / documento impresa', 'AZIENDA', 'DOCUMENTO_AZIENDA', true, null, false, true, 150);
