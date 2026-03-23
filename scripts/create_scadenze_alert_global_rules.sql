create table if not exists public.scadenze_alert_global_rules (
  id uuid primary key default gen_random_uuid(),
  tipo_scadenza text,
  attivo boolean not null default true,
  enabled_steps integer[] not null default array[30,15,7,1]::integer[],
  default_delivery_mode text not null default 'AUTO_CLIENTE',
  default_target text not null default 'CLIENTE',
  default_template_id uuid null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'tipo'
  ) then
    update public.scadenze_alert_global_rules
    set tipo_scadenza = coalesce(
      nullif(trim(tipo_scadenza), ''),
      upper(nullif(trim(tipo), ''))
    )
    where coalesce(nullif(trim(tipo_scadenza), ''), '') = '';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'attiva'
  ) then
    update public.scadenze_alert_global_rules
    set attivo = coalesce(attivo, attiva, true)
    where attivo is distinct from coalesce(attiva, true);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'step_giorni'
  ) then
    update public.scadenze_alert_global_rules
    set enabled_steps = step_giorni
    where step_giorni is not null
      and enabled_steps is distinct from step_giorni;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'modalita_invio'
  ) then
    update public.scadenze_alert_global_rules
    set default_delivery_mode = case
      when upper(coalesce(modalita_invio, '')) in ('MANUALE', 'MANUALE_INTERNO', 'MANUALE INTERNO') then 'MANUALE_INTERNO'
      else 'AUTO_CLIENTE'
    end
    where modalita_invio is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'destinatario_default'
  ) then
    update public.scadenze_alert_global_rules
    set default_target = case
      when upper(coalesce(destinatario_default, '')) in ('ART_TECH', 'ARTTECH') then 'ART_TECH'
      when upper(coalesce(destinatario_default, '')) in ('CLIENTE_E_ART_TECH', 'CLIENTE+ART_TECH') then 'CLIENTE_E_ART_TECH'
      else 'CLIENTE'
    end
    where destinatario_default is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'preset_default'
  ) then
    update public.scadenze_alert_global_rules
    set default_template_id = case
      when trim(coalesce(preset_default, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then trim(preset_default)::uuid
      else default_template_id
    end
    where preset_default is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'note_default'
  ) then
    update public.scadenze_alert_global_rules
    set note = coalesce(note, note_default)
    where note is null
      and note_default is not null;
  end if;
end
$$;

update public.scadenze_alert_global_rules
set tipo_scadenza = upper(trim(tipo_scadenza))
where tipo_scadenza is not null;

alter table public.scadenze_alert_global_rules
  alter column tipo_scadenza set not null,
  alter column attivo set default true,
  alter column attivo set not null,
  alter column enabled_steps set default array[30,15,7,1]::integer[],
  alter column enabled_steps set not null,
  alter column default_delivery_mode set default 'AUTO_CLIENTE',
  alter column default_delivery_mode set not null,
  alter column default_target set default 'CLIENTE',
  alter column default_target set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scadenze_alert_global_rules_tipo_scadenza_check'
  ) then
    alter table public.scadenze_alert_global_rules
      add constraint scadenze_alert_global_rules_tipo_scadenza_check
      check (tipo_scadenza in ('LICENZA', 'TAGLIANDO', 'GARANZIA', 'SAAS'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'scadenze_alert_global_rules_default_delivery_mode_check'
  ) then
    alter table public.scadenze_alert_global_rules
      add constraint scadenze_alert_global_rules_default_delivery_mode_check
      check (default_delivery_mode in ('AUTO_CLIENTE', 'MANUALE_INTERNO'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'scadenze_alert_global_rules_default_target_check'
  ) then
    alter table public.scadenze_alert_global_rules
      add constraint scadenze_alert_global_rules_default_target_check
      check (default_target in ('CLIENTE', 'ART_TECH', 'CLIENTE_E_ART_TECH'));
  end if;
end
$$;

create unique index if not exists scadenze_alert_global_rules_tipo_uniq
  on public.scadenze_alert_global_rules (tipo_scadenza);

create index if not exists idx_scadenze_alert_tipo
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
