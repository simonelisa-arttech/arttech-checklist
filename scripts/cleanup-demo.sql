-- Cleanup demo data (use only in non-production environments).
-- Adjust filters if your schema uses different demo markers.

begin;

-- Option A: by cliente label (Cliente Demo)
-- Deletes renewals and interventions first to avoid FK issues.

-- Rinnovi demo
delete from rinnovi_servizi
where cliente ilike '%demo%'
   or riferimento ilike '%demo%'
   or descrizione ilike '%demo%';

-- Interventi demo
delete from saas_interventi
where cliente ilike '%demo%'
   or descrizione ilike '%demo%';

-- Checklist demo
delete from checklists
where cliente ilike '%demo%'
   or nome_checklist ilike '%demo%'
   or proforma ilike '%demo%'
   or magazzino_importazione ilike '%demo%';

commit;
