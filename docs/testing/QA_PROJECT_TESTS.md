# QA PROJECT TESTS

| ID test | scenario | step | expected result | risultato | note | priorità |
| --- | --- | --- | --- | --- | --- | --- |
| PJ-001 | Creazione progetto | Creare checklist completa | Progetto salvato senza popup errore UUID temporanei |  |  | Alta |
| PJ-002 | Overview operativa | Aprire progetto esistente | Mostra overview e CTA verso cronoprogramma |  |  | Alta |
| PJ-003 | Deep-link cronoprogramma | Cliccare `Apri gestione operativa nel cronoprogramma` | Apre cronoprogramma focalizzato sul progetto |  |  | Alta |
| PJ-004 | Referenti cliente | Aggiungere/modificare referenti nel blocco progetto | Referenti persistono correttamente |  |  | Media |
| PJ-005 | Proforma | Salvare proforma + link proforma | Campi persistono e badge mancante sparisce |  |  | Alta |
| PJ-006 | Impianti | Modificare `Tipo struttura` e salvare | Valore resta visibile dopo save e reload |  |  | Alta |
| PJ-007 | Interventi | Creare intervento generale e collegato impianto | Nessun temp id UUID inviato al DB |  |  | Alta |
| PJ-008 | Duplicazione progetto | Duplicare checklist | Copia solo dati consentiti e resetta ciò che va resettato |  |  | Alta |
