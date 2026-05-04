# AGENT MEMORY — AT SYSTEM / arttech-checklist

Ultimo aggiornamento: 2026-05-04

## Identita' progetto

AT SYSTEM e' una piattaforma gestionale/operativa costruita su:
- Next.js
- React
- TypeScript
- Supabase
- Playwright

Domini principali:
- clienti / progetti / checklist
- cronoprogramma e dati operativi
- app operatori sul campo
- rinnovi / alert / workflow
- SIM / fatturazione SIM
- fatturazione globale aggregata
- allegati / documenti

## Preferenze utente da rispettare

- lavorare a piccoli step, uno per volta
- quando il task e' eseguibile, eseguirlo senza fermarsi a proporre piani lunghi
- fornire output finali sintetici e operativi
- per i comandi git richiesti, eseguire direttamente:
  - `git add ...`
  - `git commit -m "..."`
  - `git push origin main`
- il contesto di lavoro e il terminale devono essere chiari
- non chiedere all'utente di modificare i file manualmente
- se emerge un conflitto reale con schema/dominio, segnalarlo chiaramente prima di introdurre una soluzione sbagliata

## Regole tecniche da mantenere

### 1. Migrazioni Supabase
- ogni modifica DB va esplicitata con migration in `/scripts`
- annotare sempre la migration in handoff/memory
- se la migration non e' ancora applicata, il codice deve degradare in modo sicuro quando possibile

### 2. Una sola source of truth
- evitare doppie fonti dati
- dataset UI derivati da una sola source of truth + filtri locali
- non duplicare stato tra componenti se non strettamente necessario

### 3. Dominio rinnovi
- workflow canonico:
  - `DA_AVVISARE -> AVVISATO -> CONFERMATO -> DA_FATTURARE -> FATTURATO`
- non introdurre nuovi stati senza allineare:
  - DB
  - helper mapping
  - badge UI
  - documentazione
- `SAAS_ULTRA` non va mai scritto come `item_tipo`

### 4. Cronoprogramma / operativi
- usare il flusso gia' esistente:
  - `/api/cronoprogramma`
  - `action: "set_operativi"`
- campi operativi da riusare:
  - `personale_previsto`
  - `personale_ids`
  - `mezzi`
  - `descrizione_attivita`
  - `indirizzo`
  - `referente_cliente_*`
  - `commerciale_art_tech_*`

### 5. Commit hygiene
- dopo ogni fix/feature verificata:
  - `npx tsc --noEmit`
  - `npm run build`
  - commit
  - push
- attenzione al push in parallelo al commit:
  - controllare sempre `git status -sb`
  - se `ahead 1`, rilanciare `git push origin main`

### 6. Artefatto noto typecheck
- `npx tsc --noEmit` puo' fallire per `.next/types` sporco
- workaround operativo:
  1. `npm run build`
  2. rilanciare `npx tsc --noEmit`

## Snapshot funzionalita' completate da conoscere

### App operatori
- `/operatori` e' app standalone mobile-friendly
- login redirect preservato verso `/operatori`
- separazione netta backoffice / operator app
- mapping automatico operatore/personale
- permessi espliciti:
  - `can_access_backoffice`
  - `can_access_operator_app`

### SaaS Ultra
- contratto cliente-wide in `saas_contratti`
- assegnazione progetto-specifica in `rinnovi_servizi.checklist_id`
- deduplica ULTRA globale/scoped gia' corretta nel read-side

### Rinnovi / E2E
- alert workflow E2E stabilizzato
- il badge renderizzato deve leggere la riga rinnovo corretta
- il modal `Invia avviso` deve commutare correttamente:
  - operatore
  - email manuale

### Fatturazione
- `Fatturazione SIM` separata da `Fatturazione globale`
- `Fatturazione globale` aggrega:
  - SIM
  - INTERVENTO
  - RINNOVO
  - SAAS
- stato fatturazione reale:
  - `DA_FATTURARE`
  - `FATTURATO`
- `payment_status` usato per distinguere:
  - `NON_PAGATO`
  - `PAGATO`

### Allegati
- `attachments.document_type` e' la fonte primaria
- filtri per tipo documento e ricerca testuale gia' attivi
- flussi rapidi Home supportano allegati/link/ODA

### Dashboard / Home
- KPI cliccabili
- card SaaS e Art Tech Events con filtro clienti
- form rapidi Home gia' estesi con dati operativi principali

### SIM
- in `app/sim/page.tsx` il campo `Progetto associato` e' navigabile
- SIM associata:
  - nome progetto cliccabile
  - link rapido `Vai al progetto ->`
- SIM libera:
  - CTA `Associa a progetto ->`
  - redirect dashboard con `focus=sim-association`
  - `sim_id` aggiunto solo per SIM persistite

## Regole pratiche per nuovi agenti/chat

- partire da:
  - `AGENTS.md`
  - `HANDOFF_CONTEXT.md`
  - questo file
  - `docs/NEXT_STEPS.md`
- se il task tocca dominio critico:
  - leggere prima il codice reale
  - cercare la source of truth esistente
  - fare il fix minimo
- se il task cita “non toccare altre pagine/API/layout”, rispettare rigorosamente il perimetro

## Obiettivi aperti piu' probabili

- raffinare i form rapidi Home
- migliorare UX/onboarding app operatori
- completare fatturazione globale
- cronoprogramma smart / dashboard smart evoluta
