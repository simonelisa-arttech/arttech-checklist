create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'tipo'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'tipo_scadenza'
  ) then
    alter table public.scadenze_alert_global_rules
      rename column tipo to tipo_scadenza;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'attiva'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'attivo'
  ) then
    alter table public.scadenze_alert_global_rules
      rename column attiva to attivo;
  end if;
end
$$;

alter table public.scadenze_alert_global_rules
  add column if not exists tipo_scadenza text,
  add column if not exists giorni_preavviso integer,
  add column if not exists preset_id uuid,
  add column if not exists attivo boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'default_template_id'
  ) then
    update public.scadenze_alert_global_rules
    set preset_id = coalesce(preset_id, default_template_id)
    where default_template_id is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'preset_default'
  ) then
    update public.scadenze_alert_global_rules
    set preset_id = coalesce(
      preset_id,
      case
        when trim(coalesce(preset_default, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then trim(preset_default)::uuid
        else null
      end
    )
    where preset_id is null
      and preset_default is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'tipo'
  ) then
    update public.scadenze_alert_global_rules
    set tipo_scadenza = coalesce(nullif(trim(tipo_scadenza), ''), upper(trim(tipo)))
    where coalesce(nullif(trim(tipo_scadenza), ''), '') = '';
  end if;
end
$$;

update public.scadenze_alert_global_rules
set tipo_scadenza = case
  when upper(trim(coalesce(tipo_scadenza, ''))) in ('SAAS_ULTRA', 'RINNOVO') then 'SAAS'
  else upper(trim(coalesce(tipo_scadenza, '')))
end;

update public.scadenze_alert_global_rules
set attivo = coalesce(attivo, true),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now());

create temporary table if not exists tmp_scadenze_alert_global_rules_expanded (
  tipo_scadenza text not null,
  giorni_preavviso integer not null,
  preset_id uuid null,
  attivo boolean not null
) on commit drop;

truncate table tmp_scadenze_alert_global_rules_expanded;

do $$
declare
  step_expr text := 'array[60,30,15,7,1]::integer[]';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'giorni_preavviso'
  ) then
    step_expr := 'coalesce(array[giorni_preavviso], array[60,30,15,7,1]::integer[])';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'enabled_steps'
  ) then
    step_expr := 'case when giorni_preavviso is not null then array[giorni_preavviso] else coalesce(enabled_steps, array[60,30,15,7,1]::integer[]) end';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scadenze_alert_global_rules'
      and column_name = 'step_giorni'
  ) then
    step_expr := 'case when giorni_preavviso is not null then array[giorni_preavviso] else coalesce(step_giorni, array[60,30,15,7,1]::integer[]) end';
  end if;

  execute format(
    $sql$
      insert into tmp_scadenze_alert_global_rules_expanded (tipo_scadenza, giorni_preavviso, preset_id, attivo)
      select distinct
        base.tipo_scadenza,
        steps.step,
        base.preset_id,
        base.attivo
      from (
        select
          tipo_scadenza,
          preset_id,
          attivo,
          %s as steps
        from public.scadenze_alert_global_rules
        where coalesce(tipo_scadenza, '') <> ''
      ) as base
      cross join lateral unnest(coalesce(base.steps, array[60,30,15,7,1]::integer[])) as steps(step)
      where steps.step > 0
    $sql$,
    step_expr
  );
end
$$;

insert into public.scadenze_alert_global_rules (
  id,
  tipo_scadenza,
  giorni_preavviso,
  preset_id,
  attivo,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  tmp.tipo_scadenza,
  tmp.giorni_preavviso,
  tmp.preset_id,
  tmp.attivo,
  now(),
  now()
from tmp_scadenze_alert_global_rules_expanded tmp
where not exists (
  select 1
  from public.scadenze_alert_global_rules existing
  where existing.tipo_scadenza = tmp.tipo_scadenza
    and existing.giorni_preavviso = tmp.giorni_preavviso
);

delete from public.scadenze_alert_global_rules a
using public.scadenze_alert_global_rules b
where a.id < b.id
  and a.tipo_scadenza = b.tipo_scadenza
  and a.giorni_preavviso = b.giorni_preavviso;

drop index if exists scadenze_alert_global_rules_tipo_uniq;

alter table public.scadenze_alert_global_rules
  alter column tipo_scadenza set not null,
  alter column giorni_preavviso set not null,
  alter column attivo set default true,
  alter column attivo set not null,
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
