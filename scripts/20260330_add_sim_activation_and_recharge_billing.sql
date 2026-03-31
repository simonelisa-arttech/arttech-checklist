alter table public.sim_cards
add column if not exists data_attivazione date null;

alter table public.sim_recharges
add column if not exists billing_status text null;
