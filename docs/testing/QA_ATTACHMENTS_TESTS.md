# QA ATTACHMENTS TESTS

| ID test | scenario | step | expected result | risultato | note | priorità |
| --- | --- | --- | --- | --- | --- | --- |
| AT-001 | Allegati blocco legacy | Aprire allegati checklist-level | Gli allegati esistenti restano visibili |  |  | Alta |
| AT-002 | Allegati slot-aware | Aggiungere allegato a singolo slot | Record salvato con `slot_id` corretto |  |  | Alta |
| AT-003 | Combined mode | Aprire editor cronoprogramma | Vede sezioni `Allegati generali` e `Allegati giornata` |  |  | Alta |
| AT-004 | App Operatori read-only | Aprire allegati giornata in App Operatori | Nessuna azione di modifica disponibile |  |  | Alta |
| AT-005 | Apertura link | Aprire link Google Drive | Si apre in nuova scheda correttamente |  |  | Media |
| AT-006 | Empty state giornata | Slot senza allegati | Mostra empty state corretto senza errori |  |  | Media |
| AT-007 | Delete legacy | Eliminare allegato blocco dal cronoprogramma | Si rimuove solo il record giusto |  |  | Media |
| AT-008 | Persistenza slot dopo save | Salvare operativi dopo allegato slot | `slot_id` resta stabile e l’allegato resta collegato |  |  | Alta |
