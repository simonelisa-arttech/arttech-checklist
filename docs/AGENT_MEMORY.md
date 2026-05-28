# AGENT MEMORY — AT SYSTEM / arttech-checklist

Ultimo aggiornamento: 2026-05-28

## Identita' progetto

Snapshot 2026-05-28:
- `app/checklists/[id]/page.tsx`: `Salva impianti` deve preservare `asset_serials.checklist_impianto_id` anche quando l'associazione seriale punta a ID impianto correnti lato UI o temporanei; non affidarsi solo agli ID storici letti dal DB

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

### Cronoprogramma slot-aware
- il cronoprogramma e' ora il centro operativo dell'architettura
- ogni giornata e' uno slot indipendente con:
  - data
  - ore
  - orario
  - timbrature
  - note/report
  - stato giornaliero
- `cronoprogramma_meta` e' la source of truth dello stato operativo corrente
- `cronoprogramma_meta_slots` contiene la pianificazione giornaliera
- `cronoprogramma_activity_events` conserva storico business (`COMPLETATO`, `RIMANDATO`)
- `cronoprogramma_comments` conserva note e report leggibili
- `cronoprogramma_timbrature` e `cronoprogramma_timbrature_intervalli` sono per operatore e per slot

### Stati operativi
- campo corrente: `cronoprogramma_meta.status`
- valori supportati:
  - `BOZZA`
  - `DA_CONFERMARE`
  - `CONFERMATA`
  - `RIMANDATA`
  - `SVOLTA`
  - `ANNULLATA`
- fallback legacy:
  - `fatto = true` -> `SVOLTA`
  - ultimo evento `RIMANDATO` -> `RIMANDATA`
  - default -> `DA_CONFERMARE`

### Propagazione multi-giorno
- propagati automaticamente tra slot dello stesso blocco `INSTALLAZIONE` / `DISINSTALLAZIONE`:
  - status
  - personale
  - mezzi
  - descrizione
  - indirizzo
  - referente cliente
  - commerciale
  - fatto / `SVOLTA`
- restano separati per giornata:
  - `slot_id`
  - data
  - ore
  - orario
  - timer
  - timbrature
  - note
  - report
  - commenti
  - `RIMANDATO`

### App operatori
- l'app operatori usa solo `time_budget_current_operator`
- timer e stato non sono piu' aggregati tra operatori
- l'operatore vede solo la propria timbratura
- l'UI ora mostra l'indirizzo attivita' al posto del personale
- visibilita':
  - mostra `CONFERMATA` e `RIMANDATA`
  - nasconde `BOZZA`, `DA_CONFERMARE`, `ANNULLATA`, `SVOLTA`

### Workflow FATTO / RIMANDATO
- `FATTO` usa popup obbligatorio con:
  - esito
  - note finali
  - problemi
  - materiali
- `RIMANDATO` usa popup con:
  - motivo
  - nuova data
  - ore
  - personale
  - mezzi
  - descrizione
- `FATTO` oggi propaga `SVOLTA` sull'intero blocco multi-giorno
- `RIMANDATO` resta slot-specifico

### Direzione architetturale
- il cronoprogramma deve diventare l'hub operativo unico
- la pagina progetto dovra' diventare:
  - overview
  - accesso rapido
  - riepilogo sintetico
- e' stato estratto il componente shared:
  - `components/cronoprogramma/OperationalBlockEditor.tsx`
- la UI operativa della pagina progetto e' ancora presente ma ora usa il componente shared

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

### Impianti / cabinet
- `app/checklists/[id]/page.tsx` supporta ora piu' configurazioni cabinet per ogni impianto
- la source dati e' `checklist_impianti_cabinet`
- i file RCFG cabinet usano lo storage `checklist-documents` con riferimento persistito in `file_rcfg_url`
- la migration da applicare e' `scripts/20260513_add_checklist_impianti_cabinet.sql`

### Seriali hardware
- in scheda progetto i form `CONTROLLO` e `MODULO_LED` devono restare indipendenti anche lato validazione UI
- `asset_serials.checklist_impianto_id` puo' essere valorizzato solo per i seriali `CONTROLLO`
- retrocompatibilita' obbligatoria: seriali storici con `checklist_impianto_id = null` restano validi e visibili

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

### Progetti / allegati / proforma
- `checklists.proforma_link_url` e' gestito in `app/checklists/nuova/page.tsx` e `app/checklists/[id]/page.tsx`
- `licenses.proforma_link_url` e `checklist_items.proforma_link_url` sono editabili, persistiti e ricaricati
- la duplicazione progetto copia ora anche `proforma_link_url` su checklist, licenze e accessori/ricambi senza copiare gli ID originali
- i pannelli allegati shared (`AttachmentsPanel`) supportano modalita' link-only con `allowUploads={false}`
- cronoprogramma, task attachments, foto/video e allegati progetto nuovo usano ora la modalita' link-only
- `Creato da` / `Modificato da` nella pagina progetto usano fallback robusti su `created_by_operatore` / `updated_by_operatore` e mappa operatori completa

### Interventi / fatture
- `saas_interventi.fattura_url` e' collegato in `app/checklists/[id]/page.tsx`, `components/InterventiBlock.tsx` e `lib/interventi.ts`
- il form nuovo/modifica intervento espone `Link fattura PDF`
- la sezione `Fatture emesse` nella pagina progetto consente inline edit del link fattura e apertura in nuova tab

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

- completare la centralizzazione dell'operativita' nel cronoprogramma
- rendere attachments e link davvero slot-aware
- introdurre dashboard coordinatore operativo
- completare filtri safety / conflitti / mezzi / area geografica
- raffinare il workflow `FATTO` per scelta giornata vs blocco
- migliorare UX/onboarding app operatori
