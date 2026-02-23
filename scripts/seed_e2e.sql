-- scripts/seed_e2e.sql
-- Seed deterministico per Playwright / E2E
-- Obiettivo:
--  - PROGETTO_E2E_RENEWALS: con SAAS + GARANZIA
--  - PROGETTO_E2E_DUPLICATE: progetto da duplicare

begin;

insert into public.checklists (
  id,
  cliente,
  nome_checklist,
  saas_piano,
  saas_tipo,
  saas_scadenza,
  garanzia_scadenza,
  stato_progetto
) values (
  '00000000-0000-0000-0000-00000000e201',
  'CLIENTE_E2E',
  'PROGETTO_E2E_RENEWALS',
  'SAS-PL',
  'SAS-EVTR',
  (current_date + interval '30 day')::date,
  (current_date + interval '30 day')::date,
  'IN_CORSO'
)
on conflict (id) do update set
  cliente = excluded.cliente,
  nome_checklist = excluded.nome_checklist,
  saas_piano = excluded.saas_piano,
  saas_tipo = excluded.saas_tipo,
  saas_scadenza = excluded.saas_scadenza,
  garanzia_scadenza = excluded.garanzia_scadenza,
  stato_progetto = excluded.stato_progetto;

update checklists
set
  saas_piano = 'E2E_PLAN',
  saas_scadenza = (current_date + interval '30 day')::date,
  saas_stato = 'ATTIVO',
  saas_tipo = 'STANDARD',
  tipo_saas = 'SAAS',
  garanzia_scadenza = (current_date + interval '30 day')::date,
  garanzia_stato = 'ATTIVA'
where id = '00000000-0000-0000-0000-00000000e201';

insert into public.checklists (
  id,
  cliente,
  nome_checklist,
  stato_progetto
) values (
  '00000000-0000-0000-0000-00000000e202',
  'CLIENTE_E2E',
  'PROGETTO_E2E_DUPLICATE',
  'IN_CORSO'
)
on conflict (id) do update set
  cliente = excluded.cliente,
  nome_checklist = excluded.nome_checklist,
  stato_progetto = excluded.stato_progetto;

insert into public.checklist_items (
  id,
  checklist_id,
  codice,
  descrizione,
  quantita,
  note
) values (
  '00000000-0000-0000-0000-00000000e401',
  '00000000-0000-0000-0000-00000000e202',
  'E2E-COD-001',
  'ITEM_E2E_DUPLICATE',
  1,
  null
)
on conflict (id) do update set
  codice = excluded.codice,
  descrizione = excluded.descrizione,
  quantita = excluded.quantita,
  note = excluded.note;

insert into public.checklist_tasks (
  id,
  checklist_id,
  sezione,
  ordine,
  titolo,
  stato,
  note
) values (
  '00000000-0000-0000-0000-00000000e501',
  '00000000-0000-0000-0000-00000000e202',
  1,
  1,
  'TASK_E2E_DUPLICATE',
  'OK',
  null
)
on conflict (id) do update set
  sezione = excluded.sezione,
  ordine = excluded.ordine,
  titolo = excluded.titolo,
  stato = excluded.stato,
  note = excluded.note;

commit;
