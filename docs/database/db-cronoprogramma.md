# DB CRONOPROGRAMMA

Tabelle core:
- `cronoprogramma_meta`
- `cronoprogramma_meta_slots`
- `cronoprogramma_comments`
- `cronoprogramma_activity_events`
- `cronoprogramma_timbrature`
- `cronoprogramma_timbrature_intervalli`

Campi chiave:
- `cronoprogramma_meta.status`
- `cronoprogramma_meta.fatto`
- `cronoprogramma_meta.hidden`
- `cronoprogramma_meta.slot_id`
- `cronoprogramma_meta_slots.id`
- `cronoprogramma_timbrature.slot_id`

Regole pratiche:
- stato corrente in `cronoprogramma_meta`
- giornate in `cronoprogramma_meta_slots`
- storico in `cronoprogramma_activity_events`
- note/report in `cronoprogramma_comments`
- tempo reale in `cronoprogramma_timbrature`

