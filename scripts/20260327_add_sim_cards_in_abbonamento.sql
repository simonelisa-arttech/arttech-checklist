alter table public.sim_cards
  add column if not exists in_abbonamento boolean not null default false;
