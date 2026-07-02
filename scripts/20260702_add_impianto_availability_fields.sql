-- STEP 3 (D10) — campi availability su checklist_impianti (Supabase aaiuyaiwdrecyqjgnjxp)
-- Applicata in produzione 2026-07-02 (migration `add_impianto_availability_fields`).
-- Additiva, idempotente. Esposti dal feed /api/public/inventory-feed.
ALTER TABLE public.checklist_impianti
  ADD COLUMN IF NOT EXISTS availability_type text
    CHECK (availability_type IN ('PERMANENTE','STAGIONALE','EVENTO','NOLEGGIO')),
  ADD COLUMN IF NOT EXISTS availability_note text,
  ADD COLUMN IF NOT EXISTS availability_from timestamptz,
  ADD COLUMN IF NOT EXISTS availability_to timestamptz;
