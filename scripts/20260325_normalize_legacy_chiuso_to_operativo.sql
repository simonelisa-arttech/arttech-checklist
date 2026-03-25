-- Normalizza i record legacy con stato_progetto = 'CHIUSO' usato come progetto in esercizio.
-- Mantiene CHIUSO solo per i checklist con checklist operativa effettivamente completata.

with completion as (
  select
    c.id,
    coalesce(s.pct_complessivo, 0) as pct_complessivo
  from public.checklists c
  left join public.checklist_sections_view s on s.checklist_id = c.id
)
update public.checklists c
set
  stato_progetto = 'OPERATIVO',
  updated_at = now()
from completion x
where c.id = x.id
  and upper(coalesce(c.stato_progetto, '')) = 'CHIUSO'
  and coalesce(x.pct_complessivo, 0) < 100;
