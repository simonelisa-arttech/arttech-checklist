-- Seed demo data for quick UI smoke tests.
-- Note: adjust columns if your schema has required fields not covered here.

begin;

-- 1) Checklist demo (includes "cliente" demo)
with demo_checklist as (
  insert into checklists (
    cliente,
    nome_checklist,
    proforma,
    magazzino_importazione,
    created_by_operatore,
    updated_by_operatore
  )
  values (
    'Cliente Demo',
    'Checklist Demo',
    'PF-DEMO',
    'MAG-DEMO',
    null,
    null
  )
  returning id, cliente, proforma, magazzino_importazione
)

-- 2) Rinnovo demo (stato DA_AVVISARE)
insert into rinnovi_servizi (
  cliente,
  item_tipo,
  riferimento,
  descrizione,
  checklist_id,
  scadenza,
  stato,
  proforma,
  cod_magazzino
)
select
  cliente,
  'SAAS',
  'RINNOVO-DEMO',
  'Rinnovo demo',
  id,
  (current_date + interval '30 days')::date,
  'DA_AVVISARE',
  proforma,
  magazzino_importazione
from demo_checklist;

-- 3) Intervento demo (fatturazione DA_FATTURARE)
insert into saas_interventi (
  cliente,
  checklist_id,
  data,
  descrizione,
  incluso,
  fatturazione_stato
)
select
  cliente,
  id,
  now(),
  'Intervento demo',
  false,
  'DA_FATTURARE'
from demo_checklist;

commit;
