-- Separate impianto identity from extra items and support serial device metadata.

alter table public.checklists
  add column if not exists impianto_codice text null,
  add column if not exists impianto_descrizione text null;

alter table public.asset_serials
  add column if not exists device_code text null,
  add column if not exists device_descrizione text null;
