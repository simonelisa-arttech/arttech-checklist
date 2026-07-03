# Handoff Context — AT SYSTEM (arttech-checklist)

> ⚠️ **REPO UFFICIALE = `/Users/MACBOOKSL/dev/arttech-clean`** (clone pulito). Il repo in `/Users/MACBOOKSL/Documents/arttech-checklist` è **DEPRECATO** (corrotto da sync cloud): non usarlo per codice/git. Ogni `cd`/commit/push va fatto dal clone pulito.

Ultimo aggiornamento: 2026-07-01 CEST

## Stato attuale del progetto

Aggiornamento 2026-07-01 — Fix "Invalid UUID filter for entity_id __tmp__impianto..." (remap cover in creazione progetto):
- **Motivo:** in creazione progetto, al Salva impianto compariva l'alert "Invalid UUID filter for entity_id: __tmp__impianto_...". L'impianto veniva salvato ma l'errore interrompeva il flusso.
- **Causa:** il loop di remap cover (STEP 2, `entity_type = IMPIANTO_COVER`) in `app/checklists/[id]/page.tsx` eseguiva `.update(...).eq("entity_id", oldImpiantoId)` anche quando `oldImpiantoId` era un id client temporaneo (`__tmp__impianto_...`), non un UUID → respinto da `app/api/db/route.ts`. Gli altri accessi a IMPIANTO_COVER erano già guardati con `isRealUuid`.
- **File modificati:** SOLO `app/checklists/[id]/page.tsx` — aggiunto `if (!isRealUuid(oldImpiantoId)) continue;` come prima riga del loop di remap.
- **SQL/migration:** nessuna.
- **PR/commit:** PR #4 (branch `fix/impianto-cover-remap-tmp-uuid`), fix `c792986`, merge `ebba2af` su `main`. Deploy produzione OK (checks 2/2). Verificato in prod: la pagina di un progetto esistente carica pulita, nessun alert.
- **Impatti:** Gestionale positivo (sparisce l'alert, il salvataggio completa). Area Cliente / Assistenza / Support Tier / Customer Lookup / inventory: nessuno.
- **Nota ambiente:** fix eseguito dal clone pulito `~/dev/arttech-clean` (repo in `Documents` corrotto da sync cloud — da non usare più per il codice).

Aggiornamento 2026-06-22 — Support Tier per Progetto: STEP 2 / P2.3.2 + P2.3.3 (Area Cliente: UI per-progetto + POST con progettoId/impiantoId):
- **Motivo:** rendere visibile la copertura PER PROGETTO nell'area cliente e inviare il ticket sul progetto/impianto selezionato, mantenendo intatto il ramo legacy per i clienti senza progetti esposti.
- **File modificati:** SOLO `components/ClienteAssistenzaSection.tsx`.
  - Nuovi stati `selectedProjectId`/`selectedImpiantoId`; rimosso `eslint-disable` su `progetti` (ora usato); `aggregato` resta marcato non-usato.
  - Nuova mappa `TIER_STYLE_PROGETTO` con etichette UFFICIALI: GARANZIA→"Garanzia", PLUS→"CARE PLUS", ULTRA→"CARE ULTRA", EVENT→"ART TECH EVENT", NESSUNA→"Nessuna copertura".
  - `useEffect` di auto-selezione: con **un solo** progetto seleziona automaticamente; con **più** progetti l'utente deve scegliere (gating: form bloccato finché non seleziona).
  - Derivati: `usaPerProgetto = progetti.length > 0`, `selectedProject`, `tsProg`.
  - Render copertura ramificato: se `usaPerProgetto` → dropdown progetto (o label sola lettura se 1), badge copertura per-progetto, badge **PREMIUM CLIENT** (senza origine), WhatsApp diretto (`selectedProject.premiumClient.whatsapp`), avviso "a pagamento previo preventivo" se tier NESSUNA; scadenza/interventi residui mostrati solo se presenti. Altrimenti → blocco **legacy invariato** (`ts`/`info`).
  - Select impianto ramificato: per-progetto usa `selectedProject.impianti` (value = `id`, setta `selectedImpiantoId` + stringa legacy `impianto`); legacy usa `info.impianti` come prima. Impianto **facoltativo**.
  - `submitTicket` payload condizionale: se per-progetto e progetto selezionato → `{ categoria, descrizione, telefono, progettoId, impiantoId? }`; altrimenti payload legacy `{ categoria, descrizione, impianto, telefono }`.
  - Label bottone: "Richiedi preventivo →" se (per-progetto: tier NESSUNA / legacy: tier expired), altrimenti "Apri ticket →".
- **Tre percorsi confermati:** (a) **cliente senza progetti** → `usaPerProgetto=false`, UI e POST 100% legacy; (b) **un progetto** → auto-selezione, badge per-progetto, POST con `progettoId`; (c) **più progetti** → selezione obbligatoria (gating), POST con `progettoId` (+`impiantoId` se scelto).
- **NON toccati:** `app/api/cliente/assistenza/route.ts`, `lib/supportTier.ts`, customer-lookup, `app/cliente/page.tsx`, categorie problema, verifiche rapide, storico ticket, HubSpot/Reply-To, `package.json`. **Nessuna migration/SQL.**
- **Impatto gestionale:** nessuno. **Area Cliente:** ora mostra copertura per progetto + invia progettoId/impiantoId (la POST P2.2.x li gestisce già). **Assistenza:** ticket con tier per-progetto corretto. **Customer Portal/Customer Lookup/Scadenziario/Fascicolo/Catalogo:** invariati.
- **Test/verifiche:** `tsc`/build locali inaffidabili (cartella sotto sync) → validazione su **Vercel/preview**. Review statica OK: nessun riferimento orfano; `info` garantito non-null dalla guard esistente; ramo legacy invariato.
- **Rischi residui:** allegati foto/video ancora fuori scope; `aggregato` ancora non renderizzato (eslint-disable); vocabolario `tier` misto nei ticket resta da unificare (Step 3 + audit consumatori HubSpot).
- **Attività future:** allegati P2.3; Step 3 (unificare tier con customer-lookup, rimuovere "premium" legacy); audit consumatori tier HubSpot; consolidare duplicato `SYSTEM_SOURCE_OF_TRUTH.md`.
- **Regola applicata:** `docs/SYSTEM_SOURCE_OF_TRUTH.md`, `docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`, `docs/architecture/SUPPORT_TIER_PER_PROGETTO.md`. Nessun commit (lo esegue l'utente dal Mac).

Aggiornamento 2026-06-17 — Support Tier per Progetto: STEP 2 / P2.3.1 (Area Cliente: lettura dati per-progetto, senza resa visiva):
- **Motivo:** predisporre `ClienteAssistenzaSection` a consumare i dati per-progetto della GET, senza ancora cambiare la UI (staging per P2.3.2).
- **File modificati:** `components/ClienteAssistenzaSection.tsx` — aggiunti tipi `ProgettoTierVoce`/`ProgettoCopertura`/`AggregatoCliente`; nuovi stati `progetti`/`aggregato`; in `load()` lettura di `data.progetti`/`data.aggregato`. Il campo `assistenza` legacy resta la **fonte visiva attuale** (fallback). Stati nuovi marcati `eslint-disable @typescript-eslint/no-unused-vars` (verranno usati in P2.3.2; il disable si rimuove lì).
- **NESSUN cambio visivo, NESSUN cambio submit:** il rendering e il POST sono identici a prima.
- **NON toccati:** API/route, GET/POST, customer-lookup, `app/cliente/page.tsx`. Nessuna migration.
- **SQL/migration:** nessuna.
- **Impatto gestionale/Area Cliente/Assistenza/Customer Portal/Customer Lookup/Scadenziario/Fascicolo/Catalogo:** nessuno (solo lettura in stato, non renderizzata).
- **Test/verifiche:** `tsc`/build locali inaffidabili (sync) → validazione su Vercel. Review manuale OK.
- **Rischi residui:** stati `progetti`/`aggregato` inutilizzati finché P2.3.2 (gestiti con eslint-disable per non far fallire il lint in build).
- **Attività future:** P2.3.2 (selettore progetto/impianto + badge copertura + PREMIUM CLIENT + WhatsApp + avviso NESSUNA), P2.3.3 (POST con progettoId/impiantoId + fallback). Decisioni P2.3 già approvate (selezione progetto obbligatoria con più progetti; etichette ufficiali; impianto facoltativo; allegati fuori scope).
- **Regola applicata:** `docs/SYSTEM_SOURCE_OF_TRUTH.md`, `docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`, `docs/architecture/SUPPORT_TIER_PER_PROGETTO.md`.

Aggiornamento 2026-06-17 — Support Tier per Progetto: STEP 2 / P2.2.2 (POST assistenza: snapshot tier per-progetto + email):
- **Motivo:** salvare nel ticket il tier reale del progetto e arricchire la notifica interna, mantenendo il fallback legacy.
- **File modificati:** `app/api/cliente/assistenza/route.ts` — solo la **POST**: import `computeSupportTierForProgetto`; se `checklistId` valido → `tierToSave = computeSupportTierForProgetto().tier` (+ premiumClient/source/origine), altrimenti **fallback legacy** `computeSupportTierForCliente()` (invariato); `ticket.tier = tierToSave`; subject email usa `tierToSave`; body email aggiunge Progetto / Tier Source / Premium Client (SÌ/NO) / Origine / nota "Progetto senza copertura attiva" se NESSUNA; se `impiantoId` valido la stringa `impianto` viene valorizzata col nome/seriale risolto (stessa colonna).
- **Decisioni applicate:** vocabolario `tier` **misto accettato** (per-progetto nei ticket con progetto, legacy negli altri); `premiumClient`/`source` **NON persistiti** (solo email); Reply-To **invariato**; nessuna nuova colonna, nessuna migration; GET/UI/customer-lookup non toccati.
- **SQL/migration:** nessuna.
- **Impatto gestionale:** subject/body ticket più precisi (tier per-progetto). **Area Cliente:** UI attuale invariata (non invia progettoId → ramo legacy identico). **Assistenza:** ticket con copertura corretta per progetto. **Customer Portal/Customer Lookup:** invariati. **Scadenziario/Fascicolo/Catalogo:** nessuno.
- **HubSpot/email-to-ticket:** associazione invariata (Reply-To/From). **AUDIT RIMANDATO:** eventuali automazioni HubSpot che leggono il *tier nel subject* vanno aggiornate al nuovo vocabolario (GARANZIA vs STANDARD, EVENT vs EVENTS, NESSUNA vs EXPIRED, PREMIUM rimosso).
- **Test/verifiche:** `tsc`/build locali inaffidabili (I/O cartella sotto sync → hang/137 anche con Node 22). Review manuale OK; nessun `info.tier` orfano (verificato). Validazione definitiva su **Vercel/preview**.
- **Rischi residui:** vocabolario `tier` misto in `assistenza_tickets`; ramo legacy Premium Client in email è proxy (`info.whatsapp`); query extra in POST solo con progettoId.
- **Attività future:** P2.3 (UI selettore impianto/copertura → invio progettoId/impiantoId), Step 3 (unificare tier con customer-lookup), audit consumatori tier.
- **Regola applicata:** `docs/SYSTEM_SOURCE_OF_TRUTH.md`, `docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`, `docs/architecture/SUPPORT_TIER_PER_PROGETTO.md`.

Aggiornamento 2026-06-17 — Support Tier per Progetto: STEP 2 / P2.2.1 (POST assistenza: sicurezza appartenenza, additiva):
- **Motivo:** validare che il ticket sia aperto su un progetto/impianto del cliente loggato, e accettare `progettoId` (alias di `checklist_id`), senza rompere l'Area Cliente attuale.
- **File modificati:** `app/api/cliente/assistenza/route.ts` — solo la **POST**: body esteso (`progettoId`, `impiantoId`); `checklistId = progettoId || checklist_id`; validazione appartenenza progetto→cliente (403 se non suo) e impianto→progetto se `impiantoId` presente (400 se non valido); `impiantoId` senza progetto → 400.
- **Decisioni applicate (P2.2.1):** snapshot `tier` **INVARIATO** (cliente-level, nessun cambio vocabolario); logica **email invariata**; `progettoId` **opzionale con fallback legacy** (se assente, comportamento attuale identico, nessun blocco); `premiumClient`/`source`/`impianto_id` **non persistiti**; `impiantoId` solo validato (tolleranza alla stringa `impianto` legacy mantenuta).
- **NON toccati:** GET, UI, customer-lookup, snapshot tier, email. **Nessuna migration.**
- **SQL/migration:** nessuna.
- **Impatto gestionale:** nessuno. **Impatto Area Cliente:** nessuno per la UI attuale (non invia progettoId → ramo legacy); con progettoId i ticket su progetti altrui vengono **rifiutati** (sicurezza). **Assistenza/Customer Portal/Customer Lookup:** invariati. **Scadenziario/Fascicolo/Catalogo:** nessuno.
- **Test/verifiche:** `tsc` non eseguibile in sandbox (FS errno -35). Da validare sul Mac: `./node_modules/.bin/tsc --noEmit` (Codex CLI). Review manuale OK.
- **Rischi residui:** due query in più (checklists, checklist_impianti) solo quando `progettoId` è presente; nessun impatto sul ramo legacy. Build completa sempre da validare su Vercel.
- **Attività future:** P2.2.2 (snapshot tier per-progetto + email, con decisione vocabolario), P2.3 (UI selettore impianto/copertura), Step 3 (unificare tier con customer-lookup).
- **Regola applicata:** `docs/SYSTEM_SOURCE_OF_TRUTH.md`, `docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`, `docs/architecture/SUPPORT_TIER_PER_PROGETTO.md`.

Aggiornamento 2026-06-17 — Support Tier per Progetto: STEP 2 / P2.1 (GET assistenza arricchita, additiva):
- **Motivo:** esporre la copertura PER PROGETTO nell'area cliente senza rompere il contratto attuale.
- **File modificati:** `app/api/cliente/assistenza/route.ts` — solo la **GET**: aggiunti `aggregato` ({ bestTier, premiumClientAttivo }) e `progetti[]` (tier per progetto/impianto, premiumClient, scadenze, impianti) via `computeSupportForCliente()`; aggiunta query nomi progetto (sola lettura). Campo legacy `assistenza` **invariato**; `tickets` invariato.
- **NON toccati:** POST, UI, customer-lookup, vocabolario/valori salvati nei ticket. Nessuna migration.
- **Decisioni applicate:** `assistenza` legacy mantenuto; `premiumClient`/`source` NON persistiti (solo in risposta GET, derivati); `haLegacyDaRiallineare` NON esposto al client (privacy).
- **SQL/migration:** nessuna.
- **Impatto gestionale:** nessuno. **Impatto Area Cliente:** additivo — la UI attuale ignora i nuovi campi (consumati nello Step P2.3). **Impatto Assistenza/Customer Portal:** nessuna rottura. **Customer Lookup:** invariato (doppia logica ancora da unificare, Step 3). **Scadenziario/Fascicolo/Catalogo:** nessuno (sola lettura).
- **Test/verifiche:** **TSC_EXIT=0 sul Mac** (`./node_modules/.bin/tsc --noEmit` via Codex CLI) → Step 1 (tier per-progetto) e P2.1 (GET) validati lato TypeScript. Fix font Google Fonts applicato col pacchetto `geist`: l'errore Google Fonts non si ripresenta. **Build locale completa NON conclusiva:** `next build` (Turbopack) e `next build --webpack` arrivano entrambi a "Creating an optimized production build …" e poi vengono killati (137) → problema locale/ambiente/risorse, non blocco TypeScript né errore font. Build completa da validare su Vercel/preview deploy o ambiente CI stabile.
- **Rischi residui:** la GET ora chiama sia `computeSupportTierForCliente` (legacy) sia `computeSupportForCliente` (nuovo) → query duplicate (dataset piccolo, accettabile; ottimizzabile derivando il legacy dall'aggregato in futuro). Da verificare typecheck sul Mac prima del commit.
- **Attività future:** P2.2 (POST per-progetto + snapshot), P2.3 (UI selettore impianto/copertura), Step 3 (unificare tier con customer-lookup).
- **Regola applicata:** `docs/SYSTEM_SOURCE_OF_TRUTH.md`, `docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`, `docs/architecture/SUPPORT_TIER_PER_PROGETTO.md`.

Aggiornamento 2026-06-17 — Support Tier per Progetto: STEP 1 additivo (non ancora adottato dai consumatori):
- **Motivo:** introdurre la determinazione della copertura PER PROGETTO (modello Cliente→Progetto→Piano→Impianto), base per Area Cliente/ticket/Premium Client, senza rompere nulla.
- **File modificati:** `lib/supportTier.ts` — aggiunte (additivo) `computeSupportTierForProgetto()` e `computeSupportForCliente()` + tipi (`SupportTierProgetto`, `SupportTierAggregatoCliente`, `PremiumClientInfo`, `SupportTierSource`, `LegacyWarning`, `SlaInfo`, `InterventiInfo`, `ImpiantoTier`, `ProgettoPreload`) e helper `mappaCodiceProgetto`. `computeSupportTierForCliente()` **invariata**.
- **Decisioni applicate:** precedenza progetto-specifico (rinnovi_servizi/checklists) > saas_contratti cliente-wide (fallback) > garanzia > nessuna; bestTier EVENT>ULTRA>PLUS>GARANZIA>NESSUNA; **CARE PREMIUM mai prodotto** (SAAS-PR* → solo warning legacy interno `CARE_PREMIUM_DA_RIALLINEARE`); PREMIUM CLIENT derivato (ULTRA/EVENT/noleggio/flag futuro), non un piano.
- **SQL/migration:** nessuna (campi `premium_client`/classificazione letti in modo difensivo se presenti).
- **Impatto gestionale / Area Cliente / Assistenza / Customer Portal / Customer Lookup:** nessuno — le funzioni nuove non sono ancora richiamate; `/api/cliente/assistenza` e `customer-lookup` invariati.
- **Impatto Scadenziario / Fascicolo / Catalogo:** nessuno (sola lettura).
- **Test/verifiche:** `tsc`/`build` non eseguibili in sandbox (mount sincronizzato instabile: FS errno -35 / resource deadlock). **Typecheck OK sul Mac (`./node_modules/.bin/tsc --noEmit` via Codex CLI, 2026-06-17) → STEP 1 VALIDATO.** `npm run build` completo ancora consigliato prima del deploy (su Mac `npx`/`next build` tendono ad appendersi per la cartella sotto sync cloud).
- **Rischi residui:** SLA e `interventi.usati` restano `null` (mancano default `config_livelli` e definizione consumo on-site); `premium_client`/`premium_client_incluso_garanzia` non a schema → derivazione solo da tier/noleggio; `saas_contratti` resta cliente-wide (fallback) finché non project-scoped.
- **Attività future:** Step 2 (adozione in `/api/cliente/assistenza` + UI per-impianto), Step 3 (unificare la doppia logica tier con `customer-lookup`, rimuovere il tier legacy "premium").
- **Regola applicata:** `docs/SYSTEM_SOURCE_OF_TRUTH.md`, `docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`, `docs/architecture/SUPPORT_TIER_PER_PROGETTO.md`.

Aggiornamento 2026-06-17 — Fix "Could not find the table public.checklist_task_documents" (schema mancante in produzione):
- **Motivo:** all'apertura di alcune checklist in produzione compariva l'errore PostgREST "Could not find the table 'public.checklist_task_documents' in the schema cache".
- **Causa (verificata su DB prod `aaiuyaiwdrecyqjgnjxp` via connettore Supabase):** la tabella `public.checklist_task_documents` NON esisteva (`to_regclass` = NULL). La migration `scripts/20260223_add_checklist_task_documents.sql` esisteva nel repo (untracked) ma non era mai stata applicata in produzione. Le tabelle referenziate (`checklists`, `checklist_tasks`, `operatori`) e `attachments` esistevano già.
- **Azione eseguita:** applicata la migration in PRODUZIONE via Supabase MCP (`apply_migration` name `add_checklist_task_documents`): creata la tabella + indici `checklist_task_documents_checklist_idx` e `_task_idx`, esattamente come da file `20260223`. Inviato `notify pgrst, 'reload schema'` per ricaricare la schema cache. Verificato: 7 colonne corrette.
- **SQL:** `create table if not exists public.checklist_task_documents (...)` + 2 indici (vedi `scripts/20260223_add_checklist_task_documents.sql`). Additiva e idempotente, nessun dato toccato.
- **Impatto gestionale:** positivo — sparisce l'errore; torna disponibile la funzione "documenti allegati alla singola task".
- **Impatto Area Cliente / fascicolo:** nessuno — `app/api/cliente/documenti/route.ts` usa `attachments` + `checklist_tasks`, non `checklist_task_documents`.
- **Impatto Area Assistenza / support tier / customer-lookup / customer portal:** nessuno.
- **RLS:** non abilitata (la migration originale non la prevede). L'accesso avviene in service role via `/api/db`, quindi RLS non necessaria al funzionamento. Da valutare in seguito per coerenza/sicurezza (la tabella è ora esposta via PostgREST senza policy).
- **Rischi residui:** nessuno sui dati. Nota: il file migration resta untracked nel repo — andrebbe versionato per riflettere lo stato di produzione. Lo staging `art-tech-channel-staging` (`fvjltdlpwnmxwjcpmwcs`) NON è uno staging del gestionale (DB app canali/player), quindi le migration del gestionale si applicano solo su prod `aaiuyaiwdrecyqjgnjxp`.
- **Attività future:** versionare le migration in `scripts/` (oggi untracked) e definire un processo di applicazione tracciato; valutare RLS su `checklist_task_documents`.

Aggiornamento 2026-06-17 — Fix "Check list operativa vuota" (self-heal materializzazione task):
- **Motivo:** su alcuni progetti la sezione "Check list operativa" mostrava solo "Accessori / Ricambi" + "Nessuna task operativa collegata", impedendo caricamento documenti e spunta voci.
- **Causa (verificata su DB prod `aaiuyaiwdrecyqjgnjxp`):** `checklist_tasks` vuota per quei progetti. La materializzazione girava solo alla creazione del progetto (`/api/checklists/materialize-tasks`, non bloccante) e su 3 progetti su 594 era stata saltata/fallita. Niente RLS (la route legge in service role), niente bug di UI globale. Progetti rotti al 2026-06-17: `2cf71f51-4c6c-4d63-962a-f252db1f0386`, `6dcb38a5-dd11-4f7a-8065-d084a6929a54`, `3be61ec8-be38-4b13-a56e-04b036f374f2`.
- **File modificati:** `app/api/checklists/[id]/tasks/route.ts` — aggiunto self-heal: se la select su `checklist_tasks` torna 0 task, chiama `materializeChecklistTasks` (idempotente) e rilegge. Estratta la select in helper `selectChecklistTasks`. Import da `lib/checklist/syncChecklistTemplate`.
- **SQL/migration:** nessuna. Nessun cambio schema. La materializzazione è idempotente sui dati esistenti.
- **Impatto gestionale:** positivo — i progetti rotti si auto-riparano alla prima apertura (recovery automatico), tornano DOCUMENTI/SEZIONI, allegati e spunte.
- **Impatto Area Cliente / Customer Portal:** nessuno (route solo-operatore `requireOperatore`, non chiamata dal portale).
- **Impatto Area Assistenza / Support Tier / Customer Lookup:** nessuno (usano `checklists`/`rinnovi_servizi`/`saas_contratti`).
- **Impatto documenti/fascicolo cliente:** positivo indiretto — `app/api/cliente/documenti/route.ts` risale dagli allegati `CHECKLIST_TASK` via `checklist_tasks`; con le task ripristinate il fascicolo torna coerente.
- **Rischi residui:** la route GET ora può scrivere (insert task) alla prima apertura di un progetto vuoto → piccola latenza solo in quel caso. Source of truth invariata (`checklist_tasks`; nessun uso di `checklist_checks` in UI).
- **Attività future:** valutare materializzazione bloccante/garantita alla creazione progetto; opzionale endpoint admin di recovery batch (`syncChecklistTemplatesBatch`) per sanare proattivamente senza attendere l'apertura.
- **Regola applicata:** vedi `docs/SYSTEM_SOURCE_OF_TRUTH.md` e `docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`.

Aggiornamento operativo 2026-05-28:
- fix applicato in `app/checklists/[id]/page.tsx` per preservare le associazioni `asset_serials.checklist_impianto_id` dei seriali elettroniche di controllo durante `Salva impianti`
- il remap ora usa sia gli ID impianto persistiti sia gli ID correnti lato UI, cosi' non si perdono associazioni appena create o rimaste su ID client temporanei

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

### 12. Assistenza / screening clienti (2026-06-15)

Obiettivo: fare screening automatico delle richieste di assistenza per servire meglio il cliente e alleggerire il carico del personale, mantenendo i canali tradizionali come rete di sicurezza finche' l'automatismo dei tier non e' collaudato.

- **`lib/supportTier.ts`** — logica condivisa di determinazione del tier dai dati reali Supabase. Stessa convenzione di `/api/public/customer-lookup`. Gerarchia:
  1. `saas_contratti` cliente-wide attivi (PLUS/PREMIUM/ULTRA/EVENTS)
  2. `rinnovi_servizi` SAAS/RINNOVO attivi sui progetti (ULTRA sempre come `item_tipo=SAAS` + `subtipo=ULTRA`)
  3. `saas_piano`/`saas_tipo` della checklist con `saas_scadenza` attiva
  4. GARANZIA attiva -> `standard`
  5. altrimenti -> `expired`
- Tier: `expired | standard | plus | premium | ultra | events`. Solo `premium/ultra/events` espongono contatto diretto (WhatsApp/referente da env `SUPPORT_PREMIUM_WHATSAPP` / `SUPPORT_PREMIUM_REFERENTE`).
- **`app/api/cliente/assistenza/route.ts`** — endpoint area cliente che usa `computeSupportTierForCliente`.
- **`components/ClienteAssistenzaSection.tsx`** — sezione Assistenza in area cliente: copertura reale, verifiche rapide guidate, apertura ticket.
- **Tabella Supabase `assistenza_tickets`** — ticket salvati su DB con notifica email INTERNA al team (nessuna email automatica al cliente, come da regole).
- **`/registrazione`** (live su atsystem.arttechworld.com) — auto-registrazione con verifica email: match con anagrafica = accesso immediato, altrimenti richiesta in approvazione con notifica interna.
- **Landing assistenza Art Tech** (logo coordinato, 4 livelli spiegati, canali tradizionali email/WhatsApp/ticket/telefono come rete di sicurezza, note legali di tutela): pubblicata su `maxischermo.biz/assistenza.html` e su `www.ledcareservice.com` (dominio gia' vostro, hosting era vuoto). Homepage di maxischermo.biz NON toccata (HubSpot e vecchi ticket intatti).
- Punti ancora aperti: vedi `TODO.md` (redirect ledcare.it, menu maxischermiled.it, decisione homepage maxischermo.biz, collaudo tier con clienti reali).

## Commit recenti importanti

- `45f7d66` feat(area-cliente): sezione Assistenza con tier, ticket guidati e storico

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
- 2026-06-19: fix build font offline-safe sostituendo `next/font/google` con `geist/font/*` in `app/layout.tsx`; file coinvolti `app/layout.tsx`, `package.json`, lockfile; impatto solo styling globale, nessun impatto su Area Cliente/assistenza/API; rischio principale lockfile; test attesi `npx tsc --noEmit` = 0 e `npm run build` = OK

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
