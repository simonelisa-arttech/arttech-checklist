-- P5.1 — Gestione Ticket Nativa: thread bidirezionale + campi operatore/priorità
-- Supabase prod: progetto aaiuyaiwdrecyqjgnjxp
-- ADDITIVA e IDEMPOTENTE. Nessuna modifica/eliminazione di dati o colonne esistenti.
-- Accesso solo via API server (service role): nessuna policy client necessaria.

-- 1) assistenza_tickets — nuove colonne (tutte nullable, nessun default che riscriva righe)
alter table public.assistenza_tickets
  add column if not exists priorita text,            -- alta | media | standard | bassa (calcolata dal piano, P5.2)
  add column if not exists assegnatario_id uuid,     -- operatore che ha preso in carico
  add column if not exists presa_in_carico_at timestamptz,
  add column if not exists prima_risposta_at timestamptz,
  add column if not exists risolto_at timestamptz;

-- FK soft verso operatori (se la colonna è appena stata creata). ON DELETE SET NULL:
-- alla cancellazione di un operatore il ticket resta, solo si scollega l'assegnatario.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'assistenza_tickets_assegnatario_fk'
      and table_name = 'assistenza_tickets'
  ) then
    alter table public.assistenza_tickets
      add constraint assistenza_tickets_assegnatario_fk
      foreign key (assegnatario_id) references public.operatori(id) on delete set null;
  end if;
end $$;

-- Nota: tipo_richiesta è già text libero. Valori usati dall'app (nessun vincolo DB per non
-- rompere righe esistenti): assistenza | preventivo | rinnovo | tagliando | upgrade | rinnovo_sim.

-- 2) Thread messaggi (conversazione bidirezionale operatore <-> cliente)
create table if not exists public.assistenza_ticket_messaggi (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.assistenza_tickets(id) on delete cascade,
  autore_tipo text not null check (autore_tipo in ('operatore','cliente')),
  autore_id uuid,                 -- operatori.id se operatore; cliente_id se cliente (soft ref)
  corpo text not null,
  created_at timestamptz not null default now(),
  letto_cliente boolean not null default false,
  letto_operatore boolean not null default false
);

-- 3) Indici per dashboard operatore e thread
create index if not exists idx_ass_ticket_messaggi_ticket
  on public.assistenza_ticket_messaggi(ticket_id, created_at);

create index if not exists idx_ass_tickets_stato_priorita
  on public.assistenza_tickets(stato, priorita);

create index if not exists idx_ass_tickets_created_at
  on public.assistenza_tickets(created_at);

create index if not exists idx_ass_tickets_assegnatario
  on public.assistenza_tickets(assegnatario_id);
