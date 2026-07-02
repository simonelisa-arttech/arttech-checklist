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

## ULTIMO STATO — 02/07/2026 (14:00)
STEP 3 chiuso e live. TRACK B: **P3.1 spec pronta** (`docs/P3.1_LANDING_INSTRADAMENTO_LEDCARE.md`, [READY-FOR:MKT] per WordPress). **P3.2 CODICE FATTO e verificato (esbuild OK)**: `app/cliente/page.tsx` legge `?azione/ticket/progetto/impianto` e passa props a `components/ClienteAssistenzaSection.tsx` (nuove props `initialProjectId/initialImpiantoId/autoFocusTicket/mode`: preselezione progetto/impianto se combacia, auto-scroll al form, banner intento assistenza/preventivo). Additivo, fallback = comportamento attuale, nessuna migration.
**DA PUSHARE** (Simone/Codex, branch nuova da `origin/main`=8bea720): `feat/cliente-deeplink-p32`. File nel commit: page.tsx, ClienteAssistenzaSection.tsx, docs/P3.1_*, HANDOFF_ATS_02-07.md. Dopo merge PR: P3.2 attiva la colonna B dei deep-link della landing. Prossimo: P3.3 (auth/onboarding, sensibile) — richiede config Supabase Auth + Resend + possibile migration → approvazione a parte.
