alter table public.aziende_documenti
add column if not exists data_emissione date null;

alter table public.aziende_documenti
add column if not exists scadenza_override_manuale boolean not null default false;

alter table public.personale_documenti
add column if not exists scadenza_override_manuale boolean not null default false;
