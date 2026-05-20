# QA MULTI OPERATOR TESTS

| ID test | scenario | step | expected result | risultato | note | priorità |
| --- | --- | --- | --- | --- | --- | --- |
| MO-001 | Start parallelo | Due operatori avviano stessa attività | Entrambi possono iniziare senza conflitto artificiale |  |  | Alta |
| MO-002 | Timer indipendenti | Lasciare attive due timbrature contemporanee | Ogni operatore vede solo il proprio tempo |  |  | Alta |
| MO-003 | Stop indipendente | Operatore A termina, B resta attivo | Solo A passa a completata personale |  |  | Alta |
| MO-004 | Pausa/riprendi | Un operatore mette in pausa | Solo il suo stato cambia |  |  | Media |
| MO-005 | Consuntivo manuale | Un operatore imposta tempo reale con altro in corso | Nessun blocco dovuto all’altro operatore |  |  | Alta |
| MO-006 | UI App Operatori | Confrontare due sessioni contemporanee | Nessuna condivisione di stato live tra operatori |  |  | Alta |
