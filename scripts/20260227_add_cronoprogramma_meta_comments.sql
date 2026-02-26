create table if not exists public.cronoprogramma_meta (
  id uuid primary key default gen_random_uuid(),
  row_kind text not null check (row_kind in ('INSTALLAZIONE', 'INTERVENTO')),
  row_ref_id uuid not null,
  fatto boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by_operatore uuid null references public.operatori(id) on delete set null,
  unique (row_kind, row_ref_id)
);

create index if not exists cronoprogramma_meta_row_idx
  on public.cronoprogramma_meta (row_kind, row_ref_id);

create table if not exists public.cronoprogramma_comments (
  id uuid primary key default gen_random_uuid(),
  row_kind text not null check (row_kind in ('INSTALLAZIONE', 'INTERVENTO')),
  row_ref_id uuid not null,
  commento text not null,
  created_at timestamptz not null default now(),
  created_by_operatore uuid null references public.operatori(id) on delete set null
);

create index if not exists cronoprogramma_comments_row_idx
  on public.cronoprogramma_comments (row_kind, row_ref_id, created_at desc);

