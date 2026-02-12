-- Prevent duplicate GARANZIA per checklist
create unique index if not exists rinnovi_servizi_garanzia_unique
  on public.rinnovi_servizi (checklist_id)
  where item_tipo = 'GARANZIA';
