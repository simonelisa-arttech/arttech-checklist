# HANDOFF — ATSYSTEM OPERATIVO/CODICE (sigla ATS) — 02/07/2026

> Recovery file anti-crash. Se questa chat riparte da zero: leggendo QUESTO file + i riferimenti in §DOVE
> deve poter riprendere senza chiedere nulla. Aggiornare dopo OGNI azione rilevante.

## CHI SONO
- Chat **ATSYSTEM OPERATIVO/CODICE** (sigla **ATS**). Copilota tecnico Art Tech, in italiano, sul codice reale.
- **Owner esclusivo:** repo `arttech-checklist`, DB Supabase `aaiuyaiwdrecyqjgnjxp` (`checklist_impianti`), **dati impianto alla fonte** (foto/coordinate/dimensioni/audience/stato), **endpoint feed** `/api/public/inventory-feed`, **publish flag**.
- **NON tocco:** DB `fvjltdlpwnmxwjcpmwcs` (Inventory, di WP) in scrittura/DDL — solo lettura; schema/API WP (`/api/screens`); adledmarket/Aruba (Network); Brevo/Ads/Buffer/Make (Marketing). Se serve un cambio lì → lo scrivo nel `_SYNC`/DISPATCH, lo fa l'owner.

## REPO / STACK
- **Repo ufficiale operativo: `~/dev/arttech-clean`** (clone pulito, git sano). ⚠️ NON usare `~/Documents/arttech-checklist` (DEPRECATO, corrotto da sync cloud).
- GitHub: https://github.com/simonelisa-arttech/arttech-checklist · Prod: https://atsystem.arttechworld.com · Supabase prod `aaiuyaiwdrecyqjgnjxp`.
- Stack: Next.js (App Router) + React + TS strict + Supabase + Vercel. Email: Resend. Merge gated da check E2E + Vercel su GitHub.
- Env rilevanti: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `INVENTORY_FEED_API_KEY` (opzionale, protegge il feed).

## OBIETTIVO ATTUALE
Roadmap CEO: (1) **STEP 3 feed** ✅ fatto; (2) **ledcareservice.com** (TRACK B, roadmap in `docs/ASSISTENZA_FLUSSO_LEDCARE.md` §7, iniziare da P3.1) — PROSSIMO; (3) Web App Operatori; (4) architettura AT Channel.

## COSA È GIÀ FATTO (con commit/PR/migration)
- **Self-heal checklist_tasks** (materializzazione 0-task + parziale): PR #2 (`6b5c59f`, merge `f615b1b`) + PR #4 (`c792986`, merge `ebba2af`). Live in prod.
- **Migration prod:** `checklist_task_documents` creata (bug schema-cache); `add_impianto_availability_fields` (availability_type CHECK PERMANENTE/STAGIONALE/EVENTO/NOLEGGIO + note/from/to) applicata su `aaiuyaiwdrecyqjgnjxp`. File: `scripts/20260702_add_impianto_availability_fields.sql`.
- **STEP 2 inventory** (altra chat, assorbita): campi `screen_code/inventory_enabled/inventory_status/audience/lat/lng/inventory_synced_at` su `checklist_impianti`, bucket pubblico `impianti-cover`, `CoverPhotosPanel`. Merge `3569c79`.
- **STEP 3 FEED ✅:** `app/api/public/inventory-feed/route.ts` — PR #5 (`d1fba75`, merge in main) **live in prod** (`GET /api/public/inventory-feed` → JSON, count 3). Espone solo `inventory_enabled=true`, tutti gli inventory_status, availability_*, `source="atsystem"`; niente dati sensibili; auth opzionale `X-Feed-Key`.
- **screen_code assegnati** ai 3 impianti pubblicati: `beinasco-le-dune` (Le Dune, id 07edf766 — id cambiato da 2454f0d4, checklist ricreata), `sport-village-collegno` (id 3500cf11), `sport-village-collegno-totem` (id a493f5ce). Le Dune usa `beinasco-le-dune` per allinearsi al record già creato da Network in `screens` (anti-duplicato).
- Area Cliente/Assistenza/Support Tier (lavoro chat Prodotto assorbito, NON rifare): `lib/supportTier.ts`, `components/ClienteAssistenzaSection.tsx`, `app/api/cliente/assistenza/route.ts`, `app/api/public/customer-lookup/route.ts`, `app/api/public/portal-register/route.ts`, `app/cliente/page.tsx`, `app/registrazione/page.tsx`.

## COSA RESTA DA FARE (priorità)
1. **[READY-FOR:WP]** Feed live → WP fa pull/reconcile per `screen_code` (STEP 4, loro). Attendono conferma frequenza pull (D9) + endpoint feedback `inventory_synced_at`.
2. **Valorizzare availability_* e audience/foto** dei 3 impianti pubblicati (oggi null) — dato alla fonte, mio.
3. **TRACK B ledcareservice.com** — P3.1 (spec landing/instradamento) ✅ FATTA (`docs/P3.1_LANDING_INSTRADAMENTO_LEDCARE.md`; esecuzione WordPress = MKT/owner, non ATS). **PROSSIMO = P3.2** (codice mio): far leggere a `/cliente` `?azione/ticket/progetto/impianto` (additivo, isolato, prereq PR #1 ✅) → attiva i deep-link "ricchi". Poi P3.3 (auth, sensibile) / P3.4 (screening+HubSpot).
4. **4 publish flag** (AT Channel/AdLedMarket/MyDOOH/DOOHBook) — evoluzione di `inventory_enabled` (design futuro, no migration ora).
5. **Web App Operatori** (roadmap `docs/architecture/ROADMAP_WEB_APP_OPERATORI.md`): fix constraint `IN_PAUSA` su `cronoprogramma_timbrature` (pausa rotta in prod), notifiche assegnazione, GPS/mappa, verbale/fascicolo, analytics.

## DECISIONI PRESE (ratificate CEO)
- Repo ufficiale = `~/dev/arttech-clean`; Documents deprecato.
- STEP 3: D1 `screen_code`=location_tag (owner ATS); D2 pull/reconcile; D3 lat/lng→mx/my lato WP; D7 `screen_code` = `citta-location` lowercase ASCII hyphen; D10 availability enum. Feed autorizzato + migration availability autorizzata.
- AT Channel = contenitore pubblico (sottodomini atchannel.it); EyeSmartPlayer NON è più il container; consumer = AT Channel/DOOHBook/MyDOOH/AdLedMarket.
- Protocollo ruoli + DISPATCH + SIMONE_TODO + persistenza anti-crash.

## BLOCCANTI
- Nessuno per ATS. WP era `[BLOCCATO-DA:ATSystem]` per il feed → **ora sbloccato** (feed live).
- Cross-check: Network ha un draft `beinasco-le-dune` in `screens`; ho usato lo stesso codice per non duplicare. `stadio-001`/Torino FC NON è in ATSystem.

## DOVE SONO LE INFORMAZIONI
- Protocollo ruoli: `SPAZI PUBBLICITARI AT/PROTOCOLLO_RUOLI_ANTI-CONFLITTO_02-07.md`
- Dispatch: `SPAZI PUBBLICITARI AT/DISPATCH_ECOSISTEMA.md` · Todo Simone: `MARKETING/GENERALE ART TECH/Marketing on air + AI/SIMONE_TODO.md`
- Sync dati: `SPAZI PUBBLICITARI AT/_SYNC_ArtTech_ATSystem_Inventory.md` (+ `_SYNC_ArtTech_Network_WebPlatform.md`)
- Repo docs: `docs/SYSTEM_SOURCE_OF_TRUTH.md`, `docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`, `INVENTORY_PUBLISH_CONTRACT.md`, `AUDIT_IMPIANTO_IDENTITY_ECOSYSTEM.md`, `ROADMAP_WEB_APP_OPERATORI.md`, `CENSIMENTO_LOCATION_2026-06-30.md`, `docs/ASSISTENZA_FLUSSO_LEDCARE.md`, `docs/MODELLO_ASSISTENZA_ATSYSTEM.md`, `HANDOFF_CONTEXT.md`.

## ULTIMO STATO — 02/07/2026 (18:00)
**P4.1 LIVE** (PR #9 mergiata `cdef7b7`; migration applicata+verificata in prod). **P4.2 CODICE PRONTO** (da pushare, PR dedicata): pannello "I miei ticket" con stato/tracking arricchito nella sezione Assistenza del Hub. File: `components/ClienteAssistenzaSection.tsx` (mappe stato/urgenza + card ricche: numero, stato badge, categoria, urgenza, copertura, impianto, descrizione, aperto/aggiornato) + `app/api/cliente/assistenza/route.ts` (GET tickets select esteso: tier/urgenza/impianto/updated_at). esbuild OK. **Nessuna migration** (colonne già esistenti). Nessuna dipendenza esterna. Prossimo dopo P4.2: P4.3 (preventivo/fuori garanzia) → P4.5 (allegati) → P4.4 (HubSpot API, attende token) → P4.6.
Precedenti:

## ULTIMO STATO — 02/07/2026 (17:30)
**EPIC Customer Portal avviata — modulo Assistenza (P4).** Breakdown approvato CEO: P4.1→P4.2→P4.3→P4.5→P4.4→P4.6. **P4.1 CODICE PRONTO** (da pushare, PR dedicata): screening avanzato ticket. File: `components/ClienteAssistenzaSection.tsx` (nuovi campi urgenza/accesso-quota/referente/DVR-DPI/ricambio nel form) + `app/api/cliente/assistenza/route.ts` (parsing+persistenza+email+urgenza nel subject) + migration additiva `scripts/20260703_p41_assistenza_screening_fields.sql` (NON eseguita). esbuild OK. Nessuna dipendenza esterna. Nota: P4.2 (storico "I tuoi ticket") già parzialmente presente nel componente.
**Config HubSpot per P4.4** (CEO la prepara in parallelo): Private App token env `HUBSPOT_PRIVATE_APP_TOKEN` (scopes tickets read/write, schemas.tickets.read, +quotes/line_items.write per preventivi). Audit HubSpot ticket Davide = SOSPESO (cap.7 dossier consegnato, no altre estrazioni).
Precedenti:

## ULTIMO STATO — 02/07/2026 (16:30)
**P3.4 Art Tech Hub (1° step) MERGIATA e LIVE** (PR #8, merge `b0c15f2`, e2e+Vercel verdi, deploy prod ok). `/cliente` ora è l'Hub: home a 5 card + top nav, Dashboard/Assistenza separate, Marketplace a card (placeholder), News/Analytics placeholder. Deep-link preservati (smoke: `?sezione=marketplace` → login con param). Resa visiva verificabile solo loggati (auth). **Arco P3 chiuso**: P3.1 (spec landing) ✅, P3.2 (deep-link) ✅ live, P3.3 (onboarding set-password) ✅ live, P3.4 (Hub 1° step) ✅ live.
**PROSSIMO = EPIC "Customer Portal Experience"** (dopo P3.4): 1) Dashboard premium; 2) Assistenza screening avanzato + HubSpot T1–T13 (era P3.4 originale, ora nella sezione Assistenza); 3) Marketplace wiring reale (coordinamento WP/NET/ESP); 4) News/AT Channel feed; 5) Analytics reali. Rif: `docs/ARTTECH_HUB_P3.4.md`, `docs/ASSISTENZA_FLUSSO_LEDCARE.md`. Punto aperto non bloccante: verifica live email onboarding + Supabase Redirect URLs (config prod).
Precedenti:

## ULTIMO STATO — 02/07/2026 (16:00)
**P3.4 Art Tech Hub (1° step): CODICE PRONTO, PR da aprire.** `app/cliente/page.tsx` rifattorizzato in Hub: top nav + home a 5 card (icona+stato) + sezioni Dashboard (dati esistenti invariati) / Assistenza (separata) / Marketplace (griglia card CTA placeholder: rinnovi, upgrade ESP, AT Channel, MyDOOH, DOOHBook, AdLedMarket, promozioni, voucher — badge PRESTO) / News / Analytics (placeholder). Deep-link P3.2/P3.3 preservati (`?azione/ticket` → Assistenza; nuovo `?sezione=`). Additivo, nessuna migration, nessun cambio ai fetch. esbuild OK; test /cliente non E2E-abile senza sessione cliente nel seed → gate = build Vercel. Doc: `docs/ARTTECH_HUB_P3.4.md` (+ roadmap EPIC "Customer Portal Experience"). File PR: `app/cliente/page.tsx`, `docs/ARTTECH_HUB_P3.4.md`. Branch da aprire: `feat/p34-arttech-hub`.
Precedenti:

## ULTIMO STATO — 02/07/2026 (15:30)
**P3.3 MERGIATA e LIVE** (PR #7, merge `5838efa`, check e2e+Vercel verdi). Onboarding cliente ora usa **link set-password** (no password in chiaro) + prefill `?email=` + redirect CLIENTE→`/cliente`. Verifiche fatte: check verdi, schema prod OK (colonne insert confermate read-only), primitivo `generateLink` già provato in prod (reset operatori). NON verificato live il giro email→click (nessun accesso mailbox) → test manuale prod con cliente reale in anagrafica quando serve. **Config da confermare in Supabase**: Redirect URLs deve includere `…/auth/callback` (prod già ok se reset operatori funziona; aggiungere preview `*.vercel.app` + localhost).
**NUOVA DIRETTIVA CEO (02/07): Area Cliente → "Art Tech Hub"** (customer portal premium, 5 sezioni: Dashboard / LedCare-Assistenza / Marketplace / News-AT Channel / Analytics; UX Apple Business/Google Workspace/Salesforce/Tesla; mai gestionale). Vedi memoria `art-tech-hub-customer-portal`. **Prossimo = P3.4 come 1° step verso Hub**: separare Dashboard/Assistenza in `app/cliente` + predisporre struttura Marketplace. Poi EPIC "Customer Portal Experience". P3.4 originale (screening ticket + HubSpot) si integra nella sezione Assistenza.
Precedenti:

## ULTIMO STATO — 02/07/2026 (15:00)
**P3.3 onboarding cliente: CODICE PRONTO, PR dedicata da aprire (no push su main diretto).** Scoperto che l'onboarding self-service esisteva già (`/api/public/portal-register`, inviava password temporanea). Migliorato a **link set-password** (recovery, stesso primitivo del reset operatori) + prefill `?email=` in `/registrazione` (wrap Suspense) + redirect ruolo-aware CLIENTE→`/cliente` in `/reset-password`. Nessuna migration (tabelle già esistenti). Aggiunto E2E `tests/registrazione-prefill.spec.ts`. Config Supabase Auth/Resend documentata con valori esatti in `docs/P3.3_ONBOARDING_CONFIG.md` (redirect URLs allow-list /auth/callback per prod/preview/localhost; Resend via nostro EMAIL_FROM, no SMTP Supabase). esbuild OK; tsc non eseguibile in sandbox (no node_modules) → gate = Vercel build + e2e sulla PR. File PR: portal-register, registrazione, reset-password, tests/registrazione-prefill.spec.ts, docs/P3.3_ONBOARDING_CONFIG.md. **Merge dopo verifica CEO** (flusso sensibile). NB portal-access operatori NON toccato (fuori scope, possibile allineamento futuro).
Precedenti:

## ULTIMO STATO — 02/07/2026 (14:15)
STEP 3 live. TRACK B: **P3.1 spec** ✅ + **P3.2 MERGIATA e LIVE**. PR #6 mergiata su main (merge `d87e352`, E2E+Vercel verdi). `app/cliente/page.tsx` legge `?azione/ticket/progetto/impianto`; `ClienteAssistenzaSection` ha props `initialProjectId/initialImpiantoId/autoFocusTicket/mode` (preselezione, auto-scroll, banner). Smoke prod OK (`/cliente?azione=assistenza` → `/login?azione=assistenza`, param preservato). Deep-link "colonna B" della spec P3.1 ora attivi.
**PROSSIMO = P3.3** (onboarding/riconoscimento cliente): da email riconosciuta in `clienti_anagrafica` → magic-link/set-password + `clienti_portale_auth`; `/registrazione` funzionale + `?email=` prefill. SENSIBILE (identità/sicurezza): richiede config **Supabase Auth redirect URLs** + **Resend** + possibile migration/policy → preparare piano e **attendere autorizzazione CEO** su config/migration. Rif: `docs/ASSISTENZA_FLUSSO_LEDCARE.md` §6.1 / P3.3. Branch locale `feat/cliente-deeplink-p32` mergiata (si può cancellare).
