alter table public.notification_rules
  add column if not exists send_on_create boolean not null default false;

