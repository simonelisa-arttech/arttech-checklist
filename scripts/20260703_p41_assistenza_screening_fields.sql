-- P4.1 — Screening avanzato ticket assistenza
-- Supabase prod: progetto aaiuyaiwdrecyqjgnjxp · tabella public.assistenza_tickets
-- Additiva e idempotente. NON eseguire in prod senza conferma CEO (protocollo).
-- Esposta/popolata da: app/api/cliente/assistenza (POST) + components/ClienteAssistenzaSection.tsx
ALTER TABLE public.assistenza_tickets
  ADD COLUMN IF NOT EXISTS urgenza text CHECK (urgenza IN ('bassa','media','alta')),
  ADD COLUMN IF NOT EXISTS accesso_quota boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS referente_presente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dvr_dpi boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ricambio text;
