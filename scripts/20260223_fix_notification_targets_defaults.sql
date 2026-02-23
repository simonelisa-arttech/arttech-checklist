-- Backfill target su checklist_tasks e allineamento regole notifiche

begin;

-- 1) target null -> GENERICA
update public.checklist_tasks
set target = 'GENERICA'
where target is null;

-- 2) Backfill task software su TECNICO_SW (regola minima e sicura per titolo noto)
update public.checklist_tasks
set target = 'TECNICO_SW'
where coalesce(target, 'GENERICA') = 'GENERICA'
  and titolo ilike '%Elettronica di controllo: schemi dati ed elettrici%';

-- 2b) Se presente template con target, allinea i task collegati
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'checklist_task_templates'
      and column_name = 'target'
  ) then
    update public.checklist_tasks t
    set target = tpl.target
    from public.checklist_task_templates tpl
    where t.task_template_id = tpl.id
      and tpl.target in ('MAGAZZINO', 'TECNICO_SW', 'GENERICA')
      and coalesce(t.target, 'GENERICA') <> tpl.target;
  end if;
end $$;

-- 3) Default DB per nuove righe
alter table public.checklist_tasks
  alter column target set default 'GENERICA';

-- 4) Generica deve nascere/restare manuale di default
update public.notification_rules
set mode = 'MANUALE'
where upper(coalesce(target, 'GENERICA')) = 'GENERICA'
  and upper(coalesce(mode, 'MANUALE')) = 'AUTOMATICA';

commit;
