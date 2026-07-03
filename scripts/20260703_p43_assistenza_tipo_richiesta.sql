-- P4.3 — Flusso preventivo / fuori garanzia
-- Supabase prod: progetto aaiuyaiwdrecyqjgnjxp · tabella public.assistenza_tickets
-- Additiva e idempotente. Valorizzata lato server: 'preventivo' quando il tier è NESSUNA/expired, altrimenti 'assistenza'.
ALTER TABLE public.assistenza_tickets
  ADD COLUMN IF NOT EXISTS tipo_richiesta text
    CHECK (tipo_richiesta IN ('assistenza','preventivo')) DEFAULT 'assistenza';
