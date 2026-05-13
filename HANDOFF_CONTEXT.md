# Handoff Context — AT SYSTEM (arttech-checklist)

Ultimo aggiornamento: 2026-05-13 12:00 CEST

## Stato attuale del progetto

AT SYSTEM e' una web app Next.js/TypeScript con Supabase come source of truth dati. Il dominio piu' fragile resta quello di:
- rinnovi / workflow
- operator app `/operatori`
- cronoprogramma / dati operativi
- fatturazione SIM e nuova fatturazione globale

Lo stato corrente e' buono: i flussi critici principali sono stati stabilizzati e molti problemi di disallineamento tra UI e DB sono stati corretti. In particolare:
- l'app operatori e' stata separata dal backoffice
- i permessi espliciti `can_access_backoffice` e `can_access_operator_app` sono attivi
- la gestione ULTRA scoped e' stata riallineata
- i test E2E rinnovi piu' fragili sono stati stabilizzati
- la fatturazione globale e' stata avviata con modello unificato frontend

## Funzionalita' completate da mantenere

### 1. App operatori standalone `/operatori`
- `/operatori` e' una entry app standalone mobile-friendly
- niente shell/menu admin nella pagina operatori
- header branded minimale con logo + titolo app
- login redirect corretto verso `/operatori`
- separazione netta tra:
  - `App operatori` -> `/operatori`
  - `Anagrafica operatori` -> `/impostazioni/operatori`
- l'operatore non puo' piu' scegliere manualmente un altro personale dall'app campo
- il mapping operatore -> personale viene risolto automaticamente da `/api/me-operatore` e persistito se il match e' univoco e sicuro

### 2. Permessi espliciti accesso backoffice / operator app
- i campi DB ora usati sono:
  - `can_access_backoffice`
  - `can_access_operator_app`
  - `can_access_impostazioni`
- `/api/me-operatore` li espone nel payload
- `/` usa `can_access_backoffice` + `can_access_operator_app`
- `/operatori` usa `can_access_operator_app`
- niente redirect basati su ruolo come regola primaria

### 3. Workflow rinnovi e alert stabilizzati
- workflow da mantenere:
  - `DA_AVVISARE -> AVVISATO -> CONFERMATO -> DA_FATTURARE -> FATTURATO`
- `SAAS_ULTRA` NON e' un `item_tipo` valido:
  - usare sempre `item_tipo = "SAAS"` + `subtipo = "ULTRA"`
- ramo E2E/mock del cliente riallineato:
  - `Invia avviso` aggiorna davvero la riga SAAS osservata dal render
  - badge workflow non deve restare falsamente su `DA_AVVISARE`
- modal `Invia avviso` corretto:
  - modalita' `Email manuale` mostra davvero i campi email/nome
  - non deve mostrare la combobox operatore quando `artTechMode = email`

### 4. SaaS Ultra project-scoped
- il contratto cliente-wide resta in `saas_contratti`
- l'associazione progetto-specifica vive in `rinnovi_servizi.checklist_id`
- il read-side cliente/progetto e' stato corretto:
  - progetto corretto letto dai rinnovi ULTRA scoped
  - la riga ULTRA globale deve sparire se esiste una riga project-scoped equivalente
- la deduplica deve valere:
  - nel blocco compatto
  - nella tabella completa `Gestione completa scadenze e rinnovi`

### 5. Allegati
- sistema allegati riallineato a `attachments.document_type`
- fallback legacy su prefisso nel titolo lasciato solo come tolleranza minima
- `AttachmentsPanel` ora supporta:
  - filtri tipo documento
  - ricerca testuale
- i flussi rapidi dashboard (`Aggiungi attivita`, `Aggiungi intervento`) supportano:
  - file
  - link Drive
  - ODA fornitore

### 6. Dashboard smart / Home
- KPI card navigabili verso viste filtrate
- card KPI SaaS:
  - `SaaS`
  - `SaaS Ultra`
  - `Art Tech Events`
- conteggi su clienti/progetti attivi
- form rapidi Home estesi:
  - `Aggiungi intervento`
  - `Aggiungi attivita`
- entrambi ora includono anche:
  - personale previsto / assegnato
  - mezzi
  - note operative
- salvataggio via flusso esistente `set_operativi`, senza logica parallela

### 7. Fatturazione
- pagina storica `/fatturazione` rinominata semanticamente a `Fatturazione SIM`
- nuova pagina `/fatturazione-globale` avviata
- modello frontend unificato:
  - `lib/billing.ts`
  - `BillingItem`
- fonti aggregate attuali:
  - `SIM`
  - `INTERVENTO`
  - `RINNOVO`
  - `SAAS`
- dominio riallineato:
  - `DA_FATTURARE`
  - `FATTURATO`
  - `SCADUTA` solo stato visuale derivato
- `payment_status` distinto da `FATTURATO`
  - badge `PAGATO` / `NON PAGATO`
  - azione persistente `Segna pagata`
- sezione reale `SCADUTE NON PAGATE` attiva

### 8. Interventi / Progetto
- riepiloghi inclusi/fatturazione riallineati al dataset reale `projectInterventi`
- niente query separata stale per `Inclusi usati`
- conteggi fatture da emettere coerenti con il dataset mostrato in pagina

### 9. Impianti / cabinet
- la checklist progetto supporta ora piu' righe `Composizione cabinet` per ogni impianto
- la source dati e' `checklist_impianti_cabinet`, collegata a `checklist_impianti`
- i file RCFG cabinet vengono caricati nello storage `checklist-documents`
- duplicazione progetto aggiornata per copiare anche le configurazioni cabinet
- migration da applicare: `scripts/20260513_add_checklist_impianti_cabinet.sql`

### 10. Navigazione
- menu ripulito con separazione:
  - `Menu` = navigazione operativa
  - `Impostazioni` = configurazione/admin
- route ripristinate correttamente:
  - `Dashboard` -> `/dashboard`
  - `Clienti` compatto -> `/clienti-cockpit`
  - `App operatori` -> `/operatori`

### 11. UX SIM / progetto associato
- pagina `app/sim/page.tsx` ora rende utilizzabile il campo `Progetto associato`
- SIM associata:
  - nome progetto cliccabile
  - link secondario `Vai al progetto ->` verso `/checklists/{checklist_id}`
- SIM libera:
  - CTA `Associa a progetto ->`
  - redirect verso `/?focus=sim-association`
  - se la SIM e' persistita aggiunge anche `sim_id`

## Commit recenti importanti

- `PENDING` feat(sim): improve project association UX with direct navigation
- `53cf0a1` feat(dashboard): extend quick activity and intervention creation with operational staffing, vehicles and notes
- `5361f62` fix(renewals): ensure correct conditional rendering and validation for manual email mode in alert modal
- `01760c7` feat(billing): add overdue unpaid section and exclude those items from due billing list
- `e80c308` feat(billing): persist payment status updates from global billing page across all billing sources
- `863e363` feat(billing): add payment status visibility to global billing items across SIM, interventions and renewals
- `88c7650` fix(e2e): use visible renewals text selector instead of heading role in garanzia workflow test
- `80ceee0` refactor(billing): align global billing states with real persisted domain and use fatturato instead of pagata
- `6baaad9` feat(billing): populate global billing due section with unified SIM and intervention items
- `00fc774` refactor(ui): rename current billing page to SIM billing and move access under SIM area
- `97e7e27` feat(operatori): manage backoffice and operator app access flags from operator registry
- `64eb3c3` feat(auth): introduce explicit access control for backoffice and operator app using dedicated flags
- `457152d` refactor(ui): regroup admin navigation into menu and impostazioni dropdowns

## Decisioni architetturali importanti

### Source of truth
Ordine reale da rispettare:
1. Schema Supabase / constraint DB
2. Dominio documentato (`AGENTS.md`, `PROJECT_CONTEXT.md`, handoff)
3. Codice

### Rinnovi / ULTRA
- non introdurre `item_tipo = SAAS_ULTRA`
- ULTRA va sempre modellato come:
  - `item_tipo = SAAS`
  - `subtipo = ULTRA`

### UI datasets
- evitare doppie fonti dati concorrenti
- derivare i dataset visibili da una sola source of truth, poi applicare filtri/dedupliche localmente
- regola particolarmente importante per:
  - rinnovi cliente
  - fatturazione globale
  - riepiloghi interventi

### Cronoprogramma / operativi
- continuare a usare `/api/cronoprogramma` con `action: "set_operativi"`
- non introdurre canali alternativi per salvare campi operativi

### Billing globale
- non reintrodurre stati UI fittizi non persistiti (`PAGATA`, `EMESSA`) se il dominio reale usa `FATTURATO`
- distinguere pagamento via `payment_status`, non tramite `stato` fatturazione

### Progetti / proforma / allegati
- `app/checklists/nuova/page.tsx` e `app/checklists/[id]/page.tsx` gestiscono `checklists.proforma_link_url`
- `licenses.proforma_link_url` e `checklist_items.proforma_link_url` sono supportati in create/edit/load/readonly
- `components/AttachmentsPanel.tsx` ha `allowUploads`; usato in modalita' link-only per allegati progetto nuovo, cronoprogramma, foto/video e allegati task
- il clone progetto in `app/dashboard-estesa/page.tsx` copia anche `proforma_link_url` su checklist, licenze e accessori/ricambi
- build e typecheck del repo possono restare appesi senza errori espliciti; fare sempre anche una verifica sintattica mirata dei file toccati

### Interventi / fatture
- `saas_interventi.fattura_url` e' gestito nel progetto checklist
- `components/InterventiBlock.tsx` espone `Link fattura PDF` nei form intervento fatturato
- `app/checklists/[id]/page.tsx` salva/carica `fattura_url` e mostra inline editor + CTA `Apri PDF` / `Apri link` nella sezione `Fatture emesse`

## Regole operative da rispettare

- un solo step minimo e sicuro per volta
- fix mirati, non refactor larghi
- se il task tocca dominio fragile:
  - typecheck
  - build
  - commit
  - push
- ogni migrazione Supabase va esplicitata in `/scripts` e annotata in handoff/memory
- non creare doppie fonti dati o doppie logiche di salvataggio
- non introdurre stati di dominio nuovi senza allineare DB + mapping + UI

## Fragilita' note ancora presenti

- `rinnovi_servizi` e i suoi constraint restano il punto piu' sensibile
- i rami mock/E2E del workflow rinnovi possono regressare se il render cambia
- `.next/types` sporco puo' far fallire `npx tsc --noEmit`; in quel caso:
  - eseguire `npm run build`
  - rilanciare `npx tsc --noEmit`
- ci sono file sporchi/untracked locali non legati a tutti i task:
  - non vanno ripuliti o revertiti senza richiesta esplicita
