# CRONOPROGRAMMA ARCHITECTURE

Concetto centrale:
- ogni giornata = uno slot indipendente

Tabelle core:
- `cronoprogramma_meta`
- `cronoprogramma_meta_slots`
- `cronoprogramma_comments`
- `cronoprogramma_activity_events`
- `cronoprogramma_timbrature`

Modello operativo:
- `cronoprogramma_meta` contiene lo stato operativo corrente e i dati comuni del blocco
- `cronoprogramma_meta_slots` contiene pianificazione giornaliera
- `cronoprogramma_comments` conserva note e report giornalieri
- `cronoprogramma_activity_events` conserva storico business
- `cronoprogramma_timbrature` conserva tempo per operatore e per slot

Regole attuali:
- slot separati per data / ore / orario / timer / note / report
- propagazione multi-giorno dei dati comuni
- `RIMANDATO` resta per singolo slot
- `FATTO` oggi puo' completare l'intero blocco multi-giorno

