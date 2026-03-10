create table if not exists public.renewal_alert_rules (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  stage text not null check (stage in ('stage1', 'stage2')),
  enabled boolean not null default false,
  mode text not null default 'MANUALE' check (mode in ('MANUALE', 'AUTOMATICO')),
  days_before integer not null default 30 check (days_before in (90, 60, 30, 15, 7, 3, 1)),
  send_to_cliente boolean not null default true,
  send_to_art_tech boolean not null default false,
  art_tech_mode text not null default 'OPERATORE' check (art_tech_mode in ('OPERATORE', 'EMAIL')),
  art_tech_operatore_id uuid null references public.operatori(id) on delete set null,
  art_tech_email text null,
  art_tech_name text null,
  stop_condition text not null default 'AT_EXPIRY' check (stop_condition in ('AT_EXPIRY', 'AFTER_FIRST_SEND', 'ON_STATUS')),
  stop_statuses text[] not null default array['AVVISATO','CONFERMATO','NON_RINNOVATO','FATTURATO']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists renewal_alert_rules_cliente_stage_uniq
  on public.renewal_alert_rules (cliente, stage);

create or replace function public.set_renewal_alert_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_renewal_alert_rules_updated_at on public.renewal_alert_rules;
create trigger trg_renewal_alert_rules_updated_at
before update on public.renewal_alert_rules
for each row
execute function public.set_renewal_alert_rules_updated_at();
