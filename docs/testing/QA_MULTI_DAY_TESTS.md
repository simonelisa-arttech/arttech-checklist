# QA MULTI DAY TESTS

| ID test | scenario | step | expected result | risultato | note | priorità |
| --- | --- | --- | --- | --- | --- | --- |
| MD-001 | Due giornate distinte | Creare slot 20/05 e 21/05 | Cronoprogramma mostra 2 righe separate |  |  | Alta |
| MD-002 | Ore per slot | Impostare 12h primo giorno e 5h secondo | Ogni riga mostra solo le sue ore |  |  | Alta |
| MD-003 | Timbrature per slot | Timbrare solo il secondo giorno | Il primo resta intatto |  |  | Alta |
| MD-004 | Propagazione dati comuni | Modificare personale/indirizzo/stato | I dati condivisi si propagano al blocco |  |  | Alta |
| MD-005 | RIMANDATO singolo slot | Rimandare solo il secondo giorno | Il primo giorno resta invariato |  |  | Alta |
| MD-006 | FATTO blocco | Completare un blocco multi-giorno | Per comportamento attuale propaga `SVOLTA` al blocco |  |  | Alta |
| MD-007 | Allegati giornata | Allegare documento al secondo giorno | Visibile solo sul secondo slot |  |  | Alta |
| MD-008 | Persistenza slot id | Salvare più volte gli operativi | Gli `id` slot non cambiano |  |  | Alta |
