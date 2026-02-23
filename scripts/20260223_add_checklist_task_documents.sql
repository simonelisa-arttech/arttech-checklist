create table if not exists public.checklist_task_documents (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  task_id uuid not null references public.checklist_tasks(id) on delete cascade,
  filename text not null,
  storage_path text not null unique,
  uploaded_at timestamptz not null default now(),
  uploaded_by_operatore uuid null references public.operatori(id) on delete set null
);

create index if not exists checklist_task_documents_checklist_idx
  on public.checklist_task_documents(checklist_id);

create index if not exists checklist_task_documents_task_idx
  on public.checklist_task_documents(task_id);
