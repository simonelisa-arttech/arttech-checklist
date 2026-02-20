-- 1) target sui template task
alter table public.checklist_task_templates
add column if not exists target text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'checklist_task_templates_target_chk'
  ) then
    alter table public.checklist_task_templates
    add constraint checklist_task_templates_target_chk
    check (target is null or target in ('MAGAZZINO','TECNICO_SW','ALTRO'));
  end if;
end $$;

-- 2) task_template_id su notification_rules
alter table public.notification_rules
add column if not exists task_template_id uuid;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema='public'
      and table_name='notification_rules'
      and constraint_name='notification_rules_task_template_id_fkey'
  ) then
    alter table public.notification_rules
    add constraint notification_rules_task_template_id_fkey
    foreign key (task_template_id) references public.checklist_task_templates(id)
    on delete cascade;
  end if;
end $$;

-- 3) una regola per template
create unique index if not exists notification_rules_template_uniq
on public.notification_rules(task_template_id)
where task_template_id is not null;

-- 4) default modalità manuale
alter table public.notification_rules
alter column mode set default 'MANUALE';

-- 5) backfill target per i due task speciali
update public.checklist_task_templates
set target = 'MAGAZZINO'
where titolo ilike '%Preparazione / riserva disponibilità / ordine merce%';

update public.checklist_task_templates
set target = 'TECNICO_SW'
where titolo ilike '%Elettronica di controllo: schemi dati ed elettrici%';

-- 6) aggancio regole esistenti ai template per titolo
update public.notification_rules r
set task_template_id = t.id
from public.checklist_task_templates t
where r.task_template_id is null
  and lower(trim(t.titolo)) = lower(trim(r.task_title));

-- 7) tutte manuali
update public.notification_rules
set mode = 'MANUALE'
where mode is distinct from 'MANUALE';

-- 8) eccezioni automatiche MAGAZZINO / TECNICO_SW
update public.notification_rules r
set mode = 'AUTOMATICA'
from public.checklist_task_templates t
where r.task_template_id = t.id
  and t.target in ('MAGAZZINO','TECNICO_SW');
