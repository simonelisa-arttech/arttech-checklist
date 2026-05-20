# QA CRONOPROGRAMMA TESTS

| ID test | scenario | step | expected result | risultato | note | priorità |
| --- | --- | --- | --- | --- | --- | --- |
| CR-001 | Load attività | Aprire cronoprogramma con dati presenti | Carica righe senza errori e con stati corretti |  |  | Alta |
| CR-002 | Multi-slot | Verificare progetto con 2 giornate | Ogni slot è una riga distinta con data/ore proprie |  |  | Alta |
| CR-003 | Stato operativo | Cambiare stato a `CONFERMATA` | Badge e filtro si aggiornano correttamente |  |  | Alta |
| CR-004 | RIMANDATO slot | Rimandare una sola giornata | Cambia solo quello slot |  |  | Alta |
| CR-005 | FATTO | Completare attività con popup obbligatorio | Scrive fatto, status, commenti ed evento storico |  |  | Alta |
| CR-006 | Allegati blocco | Aprire editor operativo | Mostra allegati generali blocco checklist-level |  |  | Media |
| CR-007 | Allegati giornata | Aprire editor su slot con `slot_id` | Mostra sezione distinta `Allegati giornata` |  |  | Alta |
| CR-008 | Focus progetto | Aprire `/cronoprogramma?focusChecklistId=...` | Filtra correttamente il progetto richiesto |  |  | Media |
