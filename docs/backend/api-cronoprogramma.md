# API CRONOPROGRAMMA

File:
- `app/api/cronoprogramma/route.ts`

Actions principali:
- `load`
- `load_events`
- `set_status`
- `set_fatto`
- `complete_activity`
- `reschedule_activity`
- `set_hidden`
- `set_operativi`
- `start_timbratura`
- `pause_timbratura`
- `resume_timbratura`
- `stop_timbratura`

Regole:
- use slot-aware lookups quando `slot_id` e' presente
- non aggregare timer globali nell'app operatori
- mantenere compatibilita' legacy quando `slot_id` e' nullo

