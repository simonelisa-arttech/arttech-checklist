# WORKFLOW RIMANDATO

Popup:
- motivo
- nuova data
- ore
- personale
- mezzi
- descrizione

Effetti:
- `status = RIMANDATA`
- storico evento in `cronoprogramma_activity_events`
- aggiornamento meta e slot correnti
- commento leggibile in `cronoprogramma_comments`

Regola chiave:
- `RIMANDATO` e' sempre slot-specifico

