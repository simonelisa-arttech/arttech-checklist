# Integrazione HubSpot ↔ ATSystem — Assistenza cliente (design + automazioni)

> **Obiettivo (direttiva CEO/MAIN 06-07/07/2026):** un **flusso unico e coordinato**:
> `cliente apre ticket dal sito → ATSystem → HubSpot → notifiche → tracking → reportistica`.
> Documento di design (mappatura Priorità 2 + spec automazioni Priorità 3). Base per l'implementazione **P4.4**.
> Sorgenti reali lette via connettore HubSpot (read) il 06/07/2026 + schema `assistenza_tickets` prod `aaiuyaiwdrecyqjgnjxp`.

## 1. Flusso unico (end-to-end)

```
[Sito] maxischermiled.it/assistenza · ledcareservice.com
   │  CTA login-first (deep-link)
   ▼
[Art Tech Hub] /cliente → sezione Assistenza (P4.1-P4.5)
   │  apertura ticket guidata (categoria, urgenza, accesso/sicurezza, ricambio, allegati)
   ▼
[ATSystem] assistenza_tickets  ← SOURCE OF TRUTH creazione + dati screening + copertura (tier)
   │  (A) email-to-ticket reply-to=cliente  [ATTUALE]
   │  (B) HubSpot API create/update ticket  [TARGET P4.4]
   ▼
[HubSpot] Pipeline "Assistenza" → priorità/stage/owner/SLA · workflow notifiche/escalation
   │  status stage
   ▼
[Tracking] stato ticket visibile in Hub (P4.2) ← sync stage HubSpot
   ▼
[Reportistica] dashboard HubSpot (volume, SLA, riaperture) + KPI ATSystem
```

## 2. Stato attuale vs target

- **ATTUALE (live):** all'apertura ticket, ATSystem salva su `assistenza_tickets` e invia email allo staff con `Reply-To = email cliente`. HubSpot (email-to-ticket) crea/associa il ticket come **INBOUND EMAIL** nella pipeline "Assistenza". I dati di screening finiscono nel corpo/subject (non strutturati come proprietà).
- **TARGET (P4.4):** ATSystem scrive/aggiorna il ticket in HubSpot **via API** con proprietà **strutturate** (priorità, categoria, stage, tier, campi screening) e associa il **contatto** per email. Correlazione idempotente via proprietà custom `atsystem_ticket_id`. L'email resta come fallback/canale conversazione.

## 3. Pipeline e proprietà HubSpot reali

- **Pipeline ticket:** `0` = "Pipeline di assistenza" (unica).
- **Stage:** `1` Nuovo · `2` In attesa risposta cliente · `3` In attesa di Help Desk · `2632765659` Pre-chiusura · `4` Chiuso.
- **Priorità (`hs_ticket_priority`):** LOW · MEDIUM · HIGH · URGENT.
- **Categoria (`hs_ticket_category`):** PRODUCT_ISSUE · BILLING_ISSUE · FEATURE_REQUEST · GENERAL_INQUIRY (categorie generiche di default, non personalizzate).
- **Source (`source_type`):** CHAT · EMAIL · FORM · PHONE.

## 4. Mappatura campi ATSystem → HubSpot

`assistenza_tickets` (ATSystem) → ticket HubSpot:

| Campo ATSystem | Proprietà HubSpot | Regola di mappatura |
|---|---|---|
| `numero` / `id` | **`atsystem_ticket_id`** (custom, da creare) | Chiave di correlazione idempotente (evita duplicati) |
| `descrizione` | `content` | Testo della richiesta |
| categoria + tier nel subject | `subject` | `[#numero]{[PREVENTIVO]}{[URGENZA ALTA]} <categoria> — tier <TIER> — <email>` (già così nell'email) |
| `urgenza` (bassa/media/alta) | `hs_ticket_priority` | bassa→LOW · media→MEDIUM · alta→HIGH · (ART TECH EVENT o SLA H4 → URGENT) |
| `categoria` (6: noimage/brightness/pixels/control/power/other) | `hs_ticket_category` + **`atsystem_categoria`** (custom) | Standard: tecniche→PRODUCT_ISSUE, preventivo→BILLING_ISSUE, altro→GENERAL_INQUIRY. La categoria fine ATSystem va nella proprietà custom (le 4 HubSpot sono troppo generiche) |
| `stato` (aperto/in_lavorazione/in_attesa/chiuso) | `hs_pipeline_stage` | aperto→`1` Nuovo · in_lavorazione→`3` In attesa Help Desk · in_attesa→`2` In attesa cliente · chiuso→`4` Chiuso |
| `tipo_richiesta` (assistenza/preventivo) | **`atsystem_tipo_richiesta`** (custom) + prefix subject | Preventivo evidenziato; opzionale stage dedicato "Preventivo" (v. §5) |
| `tier` (garanzia/plus/ultra/events/nessuna) | **`atsystem_tier`** (custom) | Per filtri/SLA/report |
| `accesso_quota`,`referente_presente`,`dvr_dpi` | **`atsystem_accesso_sicurezza`** (custom, testo) o 3 booleane | Sicurezza on-site (D.Lgs 81) |
| `ricambio` | **`atsystem_ricambio`** (custom, testo) | Componente segnalato |
| `impianto` | **`atsystem_impianto`** (custom) | Impianto/seriale |
| `email` cliente | associazione **Contact** (by email) | Crea/associa contatto; PREMIUM CLIENT → priorità/owner |
| `telefono` | su Contact (`phone`) | — |
| allegati (`assistenza_ticket_allegati`) | (fase 2) link/allegati | I file restano su Supabase Storage; in HubSpot un link firmato o upload nota |

Priorità derivata anche dal tier: **CARE ULTRA / ART TECH EVENT / PREMIUM CLIENT** → almeno HIGH/URGENT.

## 5. Configurazione HubSpot richiesta (a cura Simone/HubSpot)

**Proprietà ticket custom da creare** (Settings → Properties → Ticket properties):
`atsystem_ticket_id` (single-line text, unico), `atsystem_categoria` (dropdown con le 6 categorie), `atsystem_tier` (dropdown: GARANZIA/PLUS/ULTRA/EVENT/NESSUNA), `atsystem_tipo_richiesta` (dropdown: assistenza/preventivo), `atsystem_impianto` (text), `atsystem_ricambio` (text), `atsystem_accesso_sicurezza` (multi-checkbox: in quota / referente / DVR-DPI), `atsystem_urgenza` (dropdown: bassa/media/alta).

**Opzionale — stage "Preventivo":** aggiungere uno stage dedicato alla pipeline "Assistenza" per i ticket `tipo_richiesta=preventivo` (in alternativa gestirli come **Deal** in una pipeline commerciale). Da decidere con CEO.

**Token Private App** (per la scrittura P4.4): scope `crm.objects.tickets` (r+w), `crm.objects.contacts` (r+w), `crm.schemas.tickets` (read); per i preventivi come deal anche `crm.objects.deals` (r+w). Env backend: `HUBSPOT_PRIVATE_APP_TOKEN` su Vercel (prod+preview).

## 6. Direzione di sincronizzazione

- **Creazione/aggiornamento ticket:** ATSystem → HubSpot (ATSystem è source of truth per creazione + screening + copertura). Idempotente su `atsystem_ticket_id` (search-then-update-or-create).
- **Contatto:** ATSystem → HubSpot (upsert by email); ATSystem non gestisce l'anagrafica marketing.
- **Stato/stage:** HubSpot → ATSystem (ritorno): il Help Desk lavora il ticket in HubSpot; lo stage torna in ATSystem per il tracking in Hub (P4.2). Meccanismo: **webhook HubSpot** (preferito) o **polling** periodico via connettore/edge.
- **Anti-conflitto:** un solo scrittore per proprietà (ATSystem scrive le `atsystem_*` e la creazione; HubSpot/Help Desk scrive stage/owner/SLA).

## 7. Automazioni (spec del flusso ticket)

1. **Apertura (ATSystem):** su POST `/api/cliente/assistenza` → (a) insert `assistenza_tickets`; (b) upsert Contact HubSpot; (c) create/update ticket HubSpot con proprietà §4; (d) stage=Nuovo; (e) email staff (già presente) come fallback/thread.
2. **Assegnazione:** workflow HubSpot per assegnare owner in base a tier/categoria (es. ULTRA/EVENT → coda prioritaria; PREMIUM CLIENT → owner dedicato + nota "WhatsApp H24").
3. **Notifiche:** email staff all'apertura (ATSystem); workflow HubSpot per alert su nuovo ticket, cambio stage, e **SLA a rischio** (in base a `atsystem_tier` → tempi H4–H36 di CARE ULTRA / entro 1h ART TECH EVENT).
4. **Preventivo (tier NESSUNA):** ticket `tipo_richiesta=preventivo` → stage/coda "Preventivo" → template **T7** → trigger al commerciale; opzionale creazione **Deal**/Quote.
5. **Escalation:** superata la soglia SLA senza presa in carico → stage/owner di escalation + template **T12** (responsabile tecnico).
6. **Chiusura & riapertura:** stage Chiuso → sync stato in ATSystem; riapertura (nuova risposta cliente) → torna "In attesa Help Desk" (nota: monitorare le riaperture, ~33% storico — vedi audit).
7. **Tracking cliente:** stato/stage visibile in Hub (P4.2), aggiornato dal ritorno stage.
8. **Reportistica:** dashboard HubSpot sulla pipeline (volume per stage/priorità/tier, tempo di chiusura, tasso riaperture, SLA rispettati) + KPI ATSystem. Base per il miglioramento continuo (e per l'eventuale futura knowledge base T1–T13, P4.6).

## 8. Implementazione P4.4 (quando il token è pronto)

- `lib/hubspot.ts` (nuovo): client con `HUBSPOT_PRIVATE_APP_TOKEN`; funzioni `upsertContact(email, phone)`, `upsertTicket(payload)` (search by `atsystem_ticket_id` → create/update), mapping helper §4.
- Hook in `app/api/cliente/assistenza/route.ts` (POST): dopo l'insert, chiamata non-bloccante a `upsertTicket` (fallback: se il token/API falliscono, resta l'email-to-ticket attuale → nessuna regressione).
- Ritorno stage: endpoint webhook `POST /api/hubspot/ticket-webhook` (o cron di polling) → aggiorna `assistenza_tickets.stato`.
- Idempotenza e sicurezza: mai secrets nel repo; token solo in env; validazione payload.

## 9. Fasi consigliate

1. **[Config HubSpot – Simone]** creare le proprietà custom §5 + token Private App.
2. **[P4.4a]** `lib/hubspot.ts` + upsert Contact/Ticket in apertura (ATSystem→HubSpot), idempotente.
3. **[P4.4b]** workflow HubSpot: assegnazione, notifiche, SLA, preventivo/escalation (§7) — config lato HubSpot.
4. **[P4.4c]** ritorno stage HubSpot→ATSystem (webhook/polling) per il tracking in Hub.
5. **[Report]** dashboard HubSpot + KPI.

Finché il token non è pronto: resta attivo il flusso email-to-ticket (nessun blocco per il cliente).
