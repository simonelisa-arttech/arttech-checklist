create table if not exists public.asset_serials (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  tipo text not null check (tipo in ('CONTROLLO', 'MODULO_LED')),
  seriale text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists asset_serials_unique_per_checklist
on public.asset_serials (checklist_id, tipo, seriale);

create index if not exists asset_serials_seriale_idx
on public.asset_serials (seriale);

create unique index if not exists asset_serials_controllo_global_unique
on public.asset_serials (seriale)
where tipo = 'CONTROLLO';

create index if not exists asset_serials_tipo_seriale_idx
on public.asset_serials (tipo, seriale);
