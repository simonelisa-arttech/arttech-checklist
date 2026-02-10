create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  task_id uuid not null references public.checklist_tasks(id) on delete cascade,
  stato text not null default 'PENDING',
  last_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_jobs_unique_task
on public.notification_jobs (checklist_id, task_id);

create index if not exists notification_jobs_stato_idx
on public.notification_jobs (stato);
