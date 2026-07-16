-- Customer Lifecycle Engine — Fase 1
-- Additiva, idempotente. NON applicata: apply previa conferma CEO.
-- Aggiunge source / confidence_score / lifecycle_status a rinnovi_servizi e tagliandi.
-- Regola: solo lifecycle_status='ATTIVO' alimenta alert/notifiche/email/CTA/Area Cliente.

begin;

do $$ begin
  if not exists (select 1 from pg_type where typname='lifecycle_source') then
    create type lifecycle_source as enum ('FATTURA','CONTRATTO','OPERATORE','IMPORT','ERP','API');
  end if;
  if not exists (select 1 from pg_type where typname='lifecycle_status') then
    create type lifecycle_status as enum
      ('PROPOSTO','DA_VERIFICARE','VERIFICATO','APPROVATO','ATTIVO','SCADUTO','STORICIZZATO');
  end if;
end $$;

alter table public.rinnovi_servizi
  add column if not exists source lifecycle_source,
  add column if not exists confidence_score integer check (confidence_score between 0 and 100),
  add column if not exists lifecycle_status lifecycle_status not null default 'ATTIVO',
  add column if not exists verificato_da text,
  add column if not exists verificato_il timestamptz,
  add column if not exists origine_note text;

alter table public.tagliandi
  add column if not exists source lifecycle_source,
  add column if not exists confidence_score integer check (confidence_score between 0 and 100),
  add column if not exists lifecycle_status lifecycle_status not null default 'ATTIVO',
  add column if not exists verificato_da text,
  add column if not exists verificato_il timestamptz,
  add column if not exists origine_note text;

update public.rinnovi_servizi
  set source = coalesce(source,'OPERATORE'),
      confidence_score = coalesce(confidence_score,100)
  where source is null or confidence_score is null;

update public.tagliandi
  set source = coalesce(source,'OPERATORE'),
      confidence_score = coalesce(confidence_score,100)
  where source is null or confidence_score is null;

create index if not exists idx_rinnovi_lifecycle on public.rinnovi_servizi (lifecycle_status);
create index if not exists idx_tagliandi_lifecycle on public.tagliandi (lifecycle_status);

commit;
