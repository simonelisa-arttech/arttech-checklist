import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, anon, { auth: { persistSession: false } });

const CHECKLIST_RENEWALS = '00000000-0000-0000-0000-00000000e201';
const CHECKLIST_DUPLICATE = '00000000-0000-0000-0000-00000000e202';

const now = new Date();
const plus30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function run() {
  const checklistRows = [
    {
      id: CHECKLIST_RENEWALS,
      cliente: 'CLIENTE_E2E',
      nome_checklist: 'PROGETTO_E2E_RENEWALS',
      saas_piano: 'SAAS-PL',
      saas_tipo: 'STANDARD',
      saas_stato: 'ATTIVO',
      tipo_saas: 'SAAS',
      saas_scadenza: plus30,
      garanzia_scadenza: plus30,
      garanzia_stato: 'ATTIVA',
      stato_progetto: 'IN_CORSO',
    },
    {
      id: CHECKLIST_DUPLICATE,
      cliente: 'CLIENTE_E2E',
      nome_checklist: 'PROGETTO_E2E_DUPLICATE',
      stato_progetto: 'IN_CORSO',
    },
  ];

  const { error: checklistErr } = await supabase
    .from('checklists')
    .upsert(checklistRows, { onConflict: 'id' });
  if (checklistErr) throw checklistErr;

  const { error: itemErr } = await supabase
    .from('checklist_items')
    .upsert(
      {
        id: '00000000-0000-0000-0000-00000000e401',
        checklist_id: CHECKLIST_DUPLICATE,
        codice: 'E2E-COD-001',
        descrizione: 'ITEM_E2E_DUPLICATE',
        quantita: 1,
        note: null,
      },
      { onConflict: 'id' }
    );
  if (itemErr) throw itemErr;

  const { error: taskErr } = await supabase
    .from('checklist_tasks')
    .upsert(
      {
        id: '00000000-0000-0000-0000-00000000e501',
        checklist_id: CHECKLIST_DUPLICATE,
        sezione: 'E2E',
        ordine: 1,
        titolo: 'TASK_E2E_DUPLICATE',
        stato: 'OK',
        note: null,
        target: 'GENERICA',
      },
      { onConflict: 'id' }
    );
  if (taskErr) throw taskErr;

  console.log('E2E seed ok');
}

run().catch((err) => {
  console.error('E2E seed failed:', err?.message || err);
  process.exit(1);
});
