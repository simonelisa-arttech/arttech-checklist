-- Add impianto_indirizzo to checklists
alter table public.checklists
  add column if not exists impianto_indirizzo text;

-- Optional index for search
create index if not exists checklists_impianto_indirizzo_idx
  on public.checklists (impianto_indirizzo);
