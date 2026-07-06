-- P4.5 — Allegati foto/video ai ticket assistenza
-- Supabase prod: progetto aaiuyaiwdrecyqjgnjxp
-- Additiva e idempotente. Bucket privato + tabella di collegamento allegato→ticket.
-- Accesso solo via API server (service role) → nessuna policy client necessaria.

-- Bucket privato per gli allegati dei ticket
insert into storage.buckets (id, name, public)
values ('ticket-allegati', 'ticket-allegati', false)
on conflict (id) do nothing;

-- Tabella di collegamento allegato → ticket
create table if not exists public.assistenza_ticket_allegati (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.assistenza_tickets(id) on delete cascade,
  cliente_id uuid,
  path text not null,
  filename text,
  content_type text,
  size bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_ass_ticket_allegati_ticket
  on public.assistenza_ticket_allegati(ticket_id);
