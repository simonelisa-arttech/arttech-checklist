alter table public.checklist_task_templates
  add column if not exists target text;

update public.checklist_task_templates
set target = 'GENERICA'
where target is null or btrim(target) = '';

alter table public.checklist_task_templates
  alter column target set default 'GENERICA';
