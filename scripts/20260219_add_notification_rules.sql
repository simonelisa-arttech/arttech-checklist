create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  mode text not null default 'AUTOMATICA' check (mode in ('AUTOMATICA', 'MANUALE')),
  task_title text not null,
  target text not null check (target in ('MAGAZZINO', 'TECNICO_SW')),
  recipients jsonb not null default '[]'::jsonb,
  frequency text not null default 'DAILY',
  send_time time not null default '07:30:00',
  timezone text not null default 'Europe/Rome',
  stop_statuses text[] not null default array['OK', 'NON_NECESSARIO']::text[],
  only_future boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_rules_task_target_uniq
on public.notification_rules (task_title, target);

create or replace function public.set_notification_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_notification_rules_updated_at on public.notification_rules;
create trigger trg_notification_rules_updated_at
before update on public.notification_rules
for each row
execute function public.set_notification_rules_updated_at();

with role_recipients as (
  select
    ruolo,
    coalesce(
      jsonb_agg(distinct lower(trim(email))) filter (where email is not null and trim(email) <> ''),
      '[]'::jsonb
    ) as recipients
  from public.operatori
  where attivo = true
    and ruolo in ('MAGAZZINO', 'TECNICO_SW')
  group by ruolo
)
insert into public.notification_rules (
  enabled,
  mode,
  task_title,
  target,
  recipients,
  frequency,
  send_time,
  timezone,
  stop_statuses,
  only_future
)
values
(
  true,
  'AUTOMATICA',
  'Preparazione / riserva disponibilità / ordine merce',
  'MAGAZZINO',
  coalesce((select recipients from role_recipients where ruolo = 'MAGAZZINO'), '[]'::jsonb),
  'DAILY',
  '07:30:00',
  'Europe/Rome',
  array['OK', 'NON_NECESSARIO']::text[],
  true
),
(
  true,
  'AUTOMATICA',
  'Elettronica di controllo: schemi dati ed elettrici',
  'TECNICO_SW',
  coalesce((select recipients from role_recipients where ruolo = 'TECNICO_SW'), '[]'::jsonb),
  'DAILY',
  '07:30:00',
  'Europe/Rome',
  array['OK', 'NON_NECESSARIO']::text[],
  true
)
on conflict (task_title, target)
do update set
  enabled = excluded.enabled,
  mode = excluded.mode,
  recipients = excluded.recipients,
  frequency = excluded.frequency,
  send_time = excluded.send_time,
  timezone = excluded.timezone,
  stop_statuses = excluded.stop_statuses,
  only_future = excluded.only_future,
  updated_at = now();
