create table if not exists public.sim_cards (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid null references public.checklists(id) on delete set null,
  license_id uuid null references public.licenses(id) on delete set null,
  cliente_id uuid null references public.clienti_anagrafica(id) on delete set null,
  numero_telefono text not null,
  intestatario text null,
  piano_attivo text null,
  operatore text null,
  tariffa numeric null,
  data_scadenza date null,
  stato_alert text null,
  giorni_preavviso integer null,
  alert_frequenza text null,
  last_notified_at timestamptz null,
  billing_status text null,
  attiva boolean not null default true,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sim_recharges (
  id uuid primary key default gen_random_uuid(),
  sim_id uuid not null references public.sim_cards(id) on delete cascade,
  data_ricarica date not null,
  importo numeric null,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists sim_cards_numero_telefono_idx
  on public.sim_cards (numero_telefono);

create index if not exists sim_cards_data_scadenza_idx
  on public.sim_cards (data_scadenza);

create index if not exists sim_recharges_sim_id_idx
  on public.sim_recharges (sim_id);
