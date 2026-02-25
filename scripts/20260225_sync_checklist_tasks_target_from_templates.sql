-- Sync target from templates to existing checklist_tasks.
-- Run manually in Supabase SQL Editor.

begin;

-- 1) Normalize existing values in checklist_task_templates
update public.checklist_task_templates
set target = case
  when target is null then 'GENERICA'
  when upper(trim(target)) = 'MAGAZZINO' then 'MAGAZZINO'
  when upper(trim(target)) in ('TECNICO_SW', 'TECNICO SW', 'TECNICO-SW') then 'TECNICO_SW'
  when upper(trim(target)) = 'ALTRO' then 'GENERICA'
  else 'GENERICA'
end
where target is null
   or upper(trim(target)) not in ('GENERICA', 'MAGAZZINO', 'TECNICO_SW')
   or upper(trim(target)) in ('TECNICO SW', 'TECNICO-SW', 'ALTRO');

-- 2) Normalize existing values in checklist_tasks
update public.checklist_tasks
set target = case
  when target is null then 'GENERICA'
  when upper(trim(target)) = 'MAGAZZINO' then 'MAGAZZINO'
  when upper(trim(target)) in ('TECNICO_SW', 'TECNICO SW', 'TECNICO-SW') then 'TECNICO_SW'
  when upper(trim(target)) = 'ALTRO' then 'GENERICA'
  else 'GENERICA'
end
where target is null
   or upper(trim(target)) not in ('GENERICA', 'MAGAZZINO', 'TECNICO_SW')
   or upper(trim(target)) in ('TECNICO SW', 'TECNICO-SW', 'ALTRO');

-- 3) Primary sync by task_template_id
update public.checklist_tasks ct
set target = coalesce(tt.target, 'GENERICA')
from public.checklist_task_templates tt
where ct.task_template_id = tt.id
  and ct.target is distinct from coalesce(tt.target, 'GENERICA');

-- 4) Fallback sync by title when task_template_id is null
update public.checklist_tasks ct
set target = coalesce(tt.target, 'GENERICA')
from (
  select distinct on (lower(trim(titolo)))
    lower(trim(titolo)) as titolo_key,
    target
  from public.checklist_task_templates
  where trim(coalesce(titolo, '')) <> ''
  order by lower(trim(titolo)),
           case upper(coalesce(target, 'GENERICA'))
             when 'TECNICO_SW' then 1
             when 'MAGAZZINO' then 2
             else 3
           end
) tt
where (ct.task_template_id is null or trim(coalesce(ct.task_template_id::text, '')) = '')
  and lower(trim(coalesce(ct.titolo, ''))) = tt.titolo_key
  and ct.target is distinct from coalesce(tt.target, 'GENERICA');

commit;
