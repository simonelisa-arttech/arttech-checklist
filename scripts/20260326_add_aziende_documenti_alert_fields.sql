alter table public.aziende_documenti
  add column if not exists giorni_preavviso integer null,
  add column if not exists alert_frequenza text null,
  add column if not exists alert_stato text null,
  add column if not exists last_notified_at timestamptz null;
