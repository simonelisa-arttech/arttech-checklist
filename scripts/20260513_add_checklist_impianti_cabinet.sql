create table if not exists public.checklist_impianti_cabinet (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  checklist_impianto_id uuid not null references public.checklist_impianti(id) on delete cascade,
  codice_magazzino text null,
  fornitore text null,
  dimensione_cabinet text null,
  numero_cabinet integer null,
  file_rcfg_url text null,
  file_rcfg_name text null,
  note text null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checklist_impianti_cabinet_checklist_idx
  on public.checklist_impianti_cabinet(checklist_id, position);

create index if not exists checklist_impianti_cabinet_impianto_idx
  on public.checklist_impianti_cabinet(checklist_impianto_id, position);
