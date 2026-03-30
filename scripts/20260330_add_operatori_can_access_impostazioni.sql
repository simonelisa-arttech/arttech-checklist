alter table public.operatori
add column if not exists can_access_impostazioni boolean not null default false;
