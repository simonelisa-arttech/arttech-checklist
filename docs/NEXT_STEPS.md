# NEXT STEPS — AT SYSTEM

Ultimo aggiornamento: 2026-04-27

## Chiuso / completato

- App operatori standalone `/operatori`
- login redirect corretto verso URL richiesto, inclusa app operatori
- separazione chiara backoffice / app operatori
- permessi espliciti:
  - `can_access_backoffice`
  - `can_access_operator_app`
- collegamento automatico operatore/personale
- SaaS Ultra:
  - associazione progetto letta correttamente da `rinnovi_servizi`
  - deduplica globale/scoped corretta
- workflow rinnovi / alert E2E stabilizzati
- Fatturazione SIM separata semanticamente
- Fatturazione globale avviata
- `payment_status` distinto da `FATTURATO`
- allegati:
  - `document_type`
  - filtri
  - ricerca
- dashboard smart e KPI navigabili
- form rapidi Home completati con allegati e principali dati operativi
- conteggi interventi inclusi/fatturazione riallineati al dataset reale
- menu ripulito con separazione `Menu` / `Impostazioni`

## Priorita' consigliate

### 1. Form rapidi Home
- precompilazione smart piu' forte per:
  - personale previsto / assegnato
  - mezzi
  - note operative
- oggi i campi sono disponibili, ma non ancora intelligenti come il resto del prefill

### 2. UX form rapidi Home
- layout migliore dei modal:
  - piu' compatti
  - piu' leggibili
  - migliori su viewport piccole
- verificare anche eventuale scroll interno e grouping dei campi

### 3. App operatori UX / onboarding
- rendere ancora piu' chiaro il primo ingresso
- migliorare i messaggi di stato quando manca il collegamento operatore/personale
- affinare eventuale onboarding campo per utenti nuovi

### 4. Completamento Fatturazione globale
- aggiungere filtri per `paymentStatus`
- costruire sezioni piu' complete:
  - `FATTURATE`
  - `NON PAGATE`
- esportazione lista / CSV
- valutare successivamente azioni batch

### 5. Dashboard smart avanzata
- KPI piu' operativi e navigabili
- viste aggregate cliente/progetto piu' coerenti
- ulteriori shortcut contestuali

### 6. Cronoprogramma smart
- affinare conflitti / assegnazioni
- migliorare visualizzazione schedule
- maggiore riuso tra Home, pagina cronoprogramma e progetto

## Pending tecnici da tenere presenti

- mantenere una sola source of truth nei dataset UI
- non reintrodurre stati dominio fittizi non supportati da DB
- continuare a usare `/api/cronoprogramma` per i dati operativi
- mantenere ULTRA come:
  - `item_tipo = SAAS`
  - `subtipo = ULTRA`
- verificare sempre i rami E2E/mock quando si toccano rinnovi e alert

## Sequenza consigliata per i prossimi task

1. Migliorare prefill e layout dei form rapidi Home
2. Rifinire UX app operatori
3. Completare filtri/sezioni/export di Fatturazione globale
4. Evolvere dashboard smart
5. Evolvere cronoprogramma smart
