alter table if exists public.saas_interventi
  add column if not exists ticket_no text null;

create index if not exists saas_interventi_ticket_no_idx
  on public.saas_interventi (ticket_no);
