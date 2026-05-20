# QA OPERATOR APP TESTS

| ID test | scenario | step | expected result | risultato | note | priorità |
| --- | --- | --- | --- | --- | --- | --- |
| OP-001 | Login operatore | Accedere con operatore abilitato | App Operatori si apre senza redirect errati |  |  | Alta |
| OP-002 | Filtri visibilità | Caricare attività in stato `BOZZA`, `CONFERMATA`, `RIMANDATA` | Visibili solo `CONFERMATA` e `RIMANDATA` |  |  | Alta |
| OP-003 | Timer personale | Avviare timbratura su attività assegnata | Solo l’operatore corrente vede `IN CORSO` |  |  | Alta |
| OP-004 | Stop personale | Terminare la propria timbratura | Si chiude solo il timer del proprio operatore |  |  | Alta |
| OP-005 | Indirizzo card | Aprire una card attività | Mostra `Indirizzo` e non elenco personale |  |  | Media |
| OP-006 | Allegati giornata | Aprire `Allegati giornata` su slot con documenti | Si aprono solo documenti del singolo slot, in read-only |  |  | Alta |
| OP-007 | Empty state allegati | Aprire `Allegati giornata` su slot senza documenti | Mostra `Nessun allegato giornata` |  |  | Media |
| OP-008 | Note / report | Salvare nota e chiudere attività con report | Note e report restano visibili e coerenti |  |  | Alta |
