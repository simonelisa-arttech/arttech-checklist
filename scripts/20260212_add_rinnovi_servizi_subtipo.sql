-- Aggiunge colonna subtipo a rinnovi_servizi
-- Usata per distinguere SAAS / SAAS_ULTRA (subtipo='ULTRA') / GARANZIA (subtipo='GARANZIA')
-- Da eseguire su Supabase SQL Editor

ALTER TABLE rinnovi_servizi
  ADD COLUMN IF NOT EXISTS subtipo TEXT DEFAULT NULL;

COMMENT ON COLUMN rinnovi_servizi.subtipo IS 'Sotto-tipo per item_tipo SAAS: ULTRA, GARANZIA, o NULL per SAAS base';
