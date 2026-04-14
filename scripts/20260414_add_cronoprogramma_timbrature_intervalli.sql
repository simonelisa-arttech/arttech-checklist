create table if not exists public.cronoprogramma_timbrature_intervalli (
  id uuid primary key default gen_random_uuid(),

  -- riferimento alla timbratura principale
  timbratura_id uuid not null
    references public.cronoprogramma_timbrature(id)
    on delete cascade,

  -- intervallo attivo
  started_at timestamptz not null,
  ended_at timestamptz null,

  -- durata calcolata (minuti)
  durata_minuti integer null,

  -- metadati
  created_at timestamptz not null default now()
);

-- indice per lookup veloce per timbratura
create index if not exists cronoprogramma_timbrature_intervalli_timbratura_idx
on public.cronoprogramma_timbrature_intervalli (timbratura_id);
