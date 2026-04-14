create table if not exists public.cronoprogramma_timbrature (
  id uuid primary key default gen_random_uuid(),

  -- riferimento attività (polimorfico, come cronoprogramma)
  row_kind text not null,
  row_ref_id uuid not null,

  -- operatore che timbra
  operatore_id uuid not null references public.operatori(id) on delete cascade,
  personale_id uuid null references public.personale(id) on delete set null,

  -- timbrature
  started_at timestamptz null,
  ended_at timestamptz null,

  -- durata calcolata (in minuti)
  durata_effettiva_minuti integer null,

  -- stato semplice
  stato text not null default 'NON_INIZIATA'
    check (stato in ('NON_INIZIATA', 'IN_CORSO', 'COMPLETATA')),

  -- metadati
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- indice per lookup veloce attività
create index if not exists cronoprogramma_timbrature_row_idx
on public.cronoprogramma_timbrature (row_kind, row_ref_id);

-- indice per operatore
create index if not exists cronoprogramma_timbrature_operatore_idx
on public.cronoprogramma_timbrature (operatore_id);

-- trigger aggiornamento updated_at (se già usi funzione standard nel progetto, riusala)
-- altrimenti lascia commentato
-- create trigger ...
