alter table public.operatori
  add column if not exists riceve_notifiche boolean not null default true;

update public.operatori
set riceve_notifiche = true
where riceve_notifiche is null;
