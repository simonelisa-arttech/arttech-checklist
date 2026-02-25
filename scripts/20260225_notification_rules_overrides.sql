-- Step: support global + per-checklist override rules
-- Global rules: checklist_id IS NULL
-- Override rules: checklist_id = checklists.id

begin;

alter table public.notification_rules
  add column if not exists checklist_id uuid null;

-- fk only if absent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'notification_rules'
      AND constraint_name = 'notification_rules_checklist_id_fkey'
  ) THEN
    ALTER TABLE public.notification_rules
      ADD CONSTRAINT notification_rules_checklist_id_fkey
      FOREIGN KEY (checklist_id)
      REFERENCES public.checklists(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- keep templates target available and defaulted
alter table public.checklist_task_templates
  add column if not exists target text;

alter table public.checklist_task_templates
  alter column target set default 'GENERICA';

update public.checklist_task_templates
set target = 'GENERICA'
where target is null or trim(target) = '';

-- optional tasks target default for new inserts
alter table public.checklist_tasks
  alter column target set default 'GENERICA';

-- uniqueness rules
create unique index if not exists notification_rules_override_uniq
  on public.notification_rules(checklist_id, target, task_title)
  where checklist_id is not null;

create unique index if not exists notification_rules_global_uniq
  on public.notification_rules(target, task_title)
  where checklist_id is null;

commit;
