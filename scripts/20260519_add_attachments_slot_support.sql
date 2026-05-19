alter table public.attachments
  add column if not exists slot_id uuid null
  references public.cronoprogramma_meta_slots(id)
  on delete set null;

create index if not exists attachments_slot_idx
  on public.attachments (slot_id, created_at desc);

create index if not exists attachments_entity_slot_idx
  on public.attachments (entity_type, entity_id, slot_id, created_at desc);
