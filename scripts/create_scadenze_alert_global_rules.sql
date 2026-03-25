create table if not exists public.scadenze_alert_global_rules (
  id uuid primary key default gen_random_uuid(),
  tipo_scadenza text not null,
  giorni_preavviso integer not null,
  preset_id uuid null references public.alert_message_templates(id) on delete set null,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scadenze_alert_global_rules
  add column if not exists tipo_scadenza text,
  add column if not exists giorni_preavviso integer,
  add column if not exists preset_id uuid,
  add column if not exists attivo boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scadenze_alert_global_rules_tipo_scadenza_check'
  ) then
    alter table public.scadenze_alert_global_rules
      add constraint scadenze_alert_global_rules_tipo_scadenza_check
      check (tipo_scadenza in ('LICENZA', 'TAGLIANDO', 'GARANZIA', 'SAAS', 'CMS'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'scadenze_alert_global_rules_giorni_preavviso_check'
  ) then
    alter table public.scadenze_alert_global_rules
      add constraint scadenze_alert_global_rules_giorni_preavviso_check
      check (giorni_preavviso > 0);
  end if;
end
$$;

create unique index if not exists scadenze_alert_global_rules_tipo_step_uniq
  on public.scadenze_alert_global_rules (tipo_scadenza, giorni_preavviso);

create index if not exists idx_scadenze_alert_global_rules_tipo
  on public.scadenze_alert_global_rules (tipo_scadenza);

create or replace function public.set_scadenze_alert_global_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_scadenze_alert_global_rules_updated_at on public.scadenze_alert_global_rules;
create trigger trg_scadenze_alert_global_rules_updated_at
before update on public.scadenze_alert_global_rules
for each row
execute function public.set_scadenze_alert_global_rules_updated_at();
