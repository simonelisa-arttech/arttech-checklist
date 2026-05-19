# WORKFLOW FATTO

Popup obbligatorio:
- esito attivita'
- note finali
- problemi
- materiali

Effetti:
- `fatto = true`
- `status = SVOLTA`
- scrittura evento in `cronoprogramma_activity_events`
- scrittura commento leggibile
- scrittura commento strutturato `__REPORT__:`

Compatibilita':
- non rompe timbrature
- non rompe storico commenti esistente
- mantiene `cronoprogramma_meta.fatto` per retrocompatibilita'

