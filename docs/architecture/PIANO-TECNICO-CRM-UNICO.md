# Piano tecnico — CRM Unico Art Tech (verifica + implementazione)

> Riferimento: `MAIN/ARCHITETTURA-ER-CRM-UNICO.md` v1.0 (09/07/2026) + sezione "INTEGRAZIONE MARKETING" (direttiva CEO 09/07/2026 12:29, recepita via MAIN 12:35).
> Stato: **PIANO TECNICO — decisioni CEO ricevute (MAIN 09/07 12:35), migration Fase 1 completa in `/scripts`, NON ANCORA APPLICATA su Supabase prod. In attesa di conferma esplicita per l'apply.**
> Owner: ATSystem (SoT unica). Autore: agente ATS.

## 0. Sintesi & decisione architetturale chiave

Il modello ER è **compatibile** con lo schema ATSystem attuale e in gran parte **già coperto** da tabelle esistenti. La raccomandazione tecnica centrale:

> **NON creare una tabella `anagrafica` parallela: evolvere `clienti_anagrafica` come anagrafica unica CRM.**

Motivo: `clienti_anagrafica` è già referenziata da **8 tabelle** via FK (`checklists`, `clienti_portale_auth`, `assistenza_tickets`, `sim_cards`, `clienti_referenti`, `clienti_area_cliente_settings`, `portal_registration_requests`, `clienti_portale_impersonation_tokens`) e da tutto il codice app. Una tabella parallela spaccherebbe portale cliente, ticket, progetti. Estendere quella esistente = zero regressioni, migrazione incrementale.

## 1. Compatibilità con lo schema attuale (verificata sul DB prod `aaiuyaiwdrecyqjgnjxp`)

| Entità modello ER | Stato in ATSystem | Azione |
|---|---|---|
| **ANAGRAFICA** | `clienti_anagrafica` (1.490 record) — ha già denominazione, piva, codice_fiscale, email, pec, telefono, indirizzo, comune, cap, provincia, paese, codice_interno, attivo… | Estendere: aggiungere `tipo` (ENUM), `website`. Alias semantici: `denominazione`=ragione_sociale, `comune`=città, `paese`=nazione |
| **CONTATTO** | `clienti_referenti` (id, cliente_id, nome, telefono, email, ruolo, note, attivo…) | Estendere: aggiungere `cognome`, `principale` (boolean). Già è N:1 su anagrafica |
| **TIPO_RELAZIONE** | assente | NUOVA tabella + seed 13 tipi |
| **ANAGRAFICA_RELAZIONE** | assente | NUOVA tabella N:M → `clienti_anagrafica.id` |
| **VOUCHER / WALLET** | esistono `voucher_movimenti` (ledger, chiave `cliente` TEXT) e `voucher_saldi` (carichi/scarichi/saldo per `cliente` TEXT) | Fase 2: riconciliare/evolvere verso il modello ricco (voucher tipizzati + wallet per `anagrafica_id`). NON ripartire da zero |
| **CAMPAGNA** | **NON presente nel DB ATSystem** — vive nel Supabase WP `fvjltdlpwnmxwjcpmwcs` | `inserzionista_id` = **riferimento logico** (UUID anagrafica ATS) risolto via API, **non** FK cross-DB |
| **SCHERMO / inventory** | `checklist_impianti` (180 impianti, publish flags gerarchici già enforced) | Aggiungere `proprietario_id` UUID → `clienti_anagrafica` (nullable), per il Network Partner |
| **PARTNER (PH)** | in Supabase PH `mxvajnnusqlukhqctrym` (partner, partner_relationship_type, partner_relationship) | Migrare in `clienti_anagrafica` + `anagrafica_relazione`; PH dismesso a fine F3 |
| **PROCUREMENT (RdO/ordini/offerte)** | assente | NUOVE tabelle, Fase 3 |
| **TRANSAZIONE / COMPENSAZIONE** | assente | NUOVE tabelle, Fase 2/3 |

## 2. Tabelle impattate

**Fase 1** — `clienti_anagrafica` (ALTER +2 col), `clienti_referenti` (ALTER +2 col), `tipo_relazione` (NEW), `anagrafica_relazione` (NEW), `checklist_impianti` (ALTER +`proprietario_id`).
**Fase 2** — `modalita_compensazione` (NEW), `anagrafica_compensazione` (NEW), `voucher` (NEW, evoluzione di voucher_movimenti/saldi), `wallet` (NEW), `campagna_compensazione` (NEW, referenzia campagna WP via UUID logico), `ordine_compensazione` (NEW).
**Fase 3** — `richiesta_offerta` (RdO), `offerta_rdo`, `ordine_fornitura`, `transazione`, viste dashboard CRM, vendor rating.

Nessuna tabella esistente viene rinominata o eliminata in F1/F2. La `clienti_anagrafica` resta il nome fisico (compat FK); opzionale una **view `anagrafica`** con i nomi del modello (ragione_sociale, citta, nazione) per i consumer nuovi.

## 3. Migrazioni previste (additive, idempotenti, in `/scripts`, applicate previa conferma)

**F1-M1 — Estensione anagrafica/contatto**
```sql
alter table public.clienti_anagrafica
  add column if not exists tipo text,            -- AZIENDA|PERSONA_FISICA|ENTE|ASSOCIAZIONE
  add column if not exists website text;
alter table public.clienti_referenti
  add column if not exists cognome text,
  add column if not exists principale boolean not null default false;
```

**F1-M2 — Catalogo tipi relazione + relazioni N:M**
```sql
create table if not exists public.tipo_relazione (
  id uuid primary key default gen_random_uuid(),
  codice text unique not null,
  nome text not null,
  descrizione text,
  dominio text not null check (dominio in ('AT_CHANNEL','PROCUREMENT','NETWORK','TRASVERSALE'))
);
create table if not exists public.anagrafica_relazione (
  id uuid primary key default gen_random_uuid(),
  anagrafica_id uuid not null references public.clienti_anagrafica(id) on delete cascade,
  tipo_relazione_id uuid not null references public.tipo_relazione(id),
  stato text not null default 'ATTIVA' check (stato in ('ATTIVA','SOSPESA','CHIUSA')),
  data_inizio date not null default current_date,
  data_fine date,
  note text,
  created_at timestamptz not null default now(),
  unique (anagrafica_id, tipo_relazione_id)
);
-- seed 13 tipi (INSERZIONISTA, MEDIA_PARTNER, AGENZIA, NETWORK_PARTNER, FORNITORE,
-- INSTALLATORE, PRODUTTORE, PROGETTISTA, CONSULENTE, COLLABORATORE,
-- PARTNER_COMMERCIALE, PARTNER_STRATEGICO, CLIENTE) via insert ... on conflict do nothing
```

**F1-M3 — Proprietario schermo (Network Partner)**
```sql
alter table public.checklist_impianti
  add column if not exists proprietario_id uuid references public.clienti_anagrafica(id) on delete set null;
```
Backfill `proprietario_id` NON automatico (il proprietario dello schermo ≠ necessariamente il cliente del progetto): si popola in un secondo momento con regole verificate.

**F1-M4 — Import dati** (vedi §5). Idempotente: dedup su piva/CF/denominazione_norm; ogni nuova anagrafica ottiene una `anagrafica_relazione` (CLIENTE per il file clienti, FORNITORE per i fornitori).

## 4. Piano di rollback

Tutto additivo → rollback semplice per fase:
- **F1-M1/M3 (ALTER add column):** `alter table … drop column if exists …` (colonne nuove, nessun dato perso di produzione).
- **F1-M2 (nuove tabelle):** `drop table if exists anagrafica_relazione, tipo_relazione cascade`.
- **F1-M4 (import):** ogni riga inserita marcata con `codice_interno` + origine; rollback = `delete from clienti_anagrafica where id in (<batch import id>)` — traccio gli id inseriti in una tabella `_import_log` per delete selettiva. Le relazioni cadono per `on delete cascade`.
- Snapshot/point-in-time: Supabase PITR attivo → ripristino a timestamp pre-migrazione come rete di sicurezza.
- Ogni migrazione è preceduta da un conteggio pre/post e verifica 0-regressioni sui consumer (feed inventory, portale, ticket).

## 5. Mapping dati esistenti (2.805 clienti + 94 fornitori)

**File clienti** `20260522T112900.066-Clienti.xls` (foglio Clienti): 2.804 righe → **1.415 clienti unici** dopo dedup interno (priorità P.IVA 11 cifre → CF → denominazione normalizzata; ~1.144 P.IVA duplicate nel file). Staging `_stg_clienti_import` già caricata e verificata.

Riscontro contro anagrafica esistente (stessi criteri; l'anagrafica attuale ha P.IVA solo su 12 record → match prevalente su **denominazione_norm** + CF):
- **Totali unici:** 1.415
- **Già presenti:** 783 → aggiornamento *solo campi vuoti* (scelta CEO)
- **Nuovi da inserire:** 632
- **Senza email valida:** 525
- **P.IVA malformate** (presente ma ≠ 11 cifre, tipicamente estere BE/CHE/CH-): 46 → revisione manuale prima dell'insert

Mapping colonne → `clienti_anagrafica`: Cod→`codice_interno`, Denominazione→`denominazione`(+`denominazione_norm`), Città→`comune`, Prov→`provincia`, Partita Iva→`piva`, e-mail→`email`, Tel(+Cell)→`telefono`, Codice fiscale→`codice_fiscale`, Indirizzo→`indirizzo`, Cap→`cap`, Pec→`pec`. Ogni cliente → relazione `CLIENTE`.

**94 fornitori:** sorgente da confermare (probabile tabella `partner` del Supabase PH `mxva`, leggibile via connettore, oppure file dedicato). Stesso pipeline: dedup → anagrafica + relazione `FORNITORE`. **Azione richiesta:** conferma sorgente dei 94 fornitori.

> Nota: l'import è la **Fase 1** del CRM. Per questo NON ho inserito i 632 nuovi con il vecchio approccio: attendo l'approvazione del piano per farlo dentro il modello (anagrafica + relazione), evitando doppio lavoro.

## 6. Impatto su screens / campaigns in produzione

- **screens (`checklist_impianti`):** additivo (`proprietario_id` nullable). Nessuna regressione su publish flags, feed inventory, area cliente. Backfill proprietario differito e verificato.
- **campaigns (WP `fvjl`):** NON toccato lo schema WP da ATS (giurisdizione: scrivo solo su ATSystem). `inserzionista_id` sarà un UUID che punta all'anagrafica ATS, popolato/risolto **via API** in fase di booking. Serve coordinamento con WP per: (a) memorizzare l'UUID anagrafica sulla campagna, (b) chiamare l'API ATS per validare identità/compensazioni. **Rischio di accoppiamento cross-DB** gestito mantenendo ATS come SoT e WP come consumer read/validate.

## 7. API minime da esporre (Fase 1)

Tutte sotto auth operatore (staff) o service-to-service per i consumer WP:
- `GET /api/crm/anagrafica?query=` — ricerca/dedup (denominazione/piva/cf).
- `GET /api/crm/anagrafica/:id` — scheda completa: dati + contatti + relazioni attive (+ in F2 compensazioni/wallet).
- `POST /api/crm/anagrafica` — crea (con dedup server-side).
- `PATCH /api/crm/anagrafica/:id` — aggiorna (fill-empty o full).
- `GET/POST/PATCH /api/crm/anagrafica/:id/relazioni` — gestione relazioni N:M.
- `GET /api/crm/tipi-relazione` — catalogo.
- (consumer) `GET /api/public/crm/anagrafica/:id?dominio=AT_CHANNEL|NETWORK|PROCUREMENT` — vista filtrata per front-end, che vede SOLO le relazioni di competenza (book/partner/procurement).
- `GET /api/crm/contacts/marketing-sync?cursor=&limit=` — **nuovo, deliverable obbligatorio** (vedi §12): sync verso Brevo via Make.com, service-to-service, solo contatti con `consenso_marketing=true`.
- `POST /api/crm/contacts/unsubscribe` — **nuovo** (vedi §12): riceve disiscrizioni da Brevo via Make.com, aggiorna `consenso_marketing=false`.

## 8. Accreditamento parallelo + voucher/barter (progettato ORA)

Il requisito CEO "un'entità = N ruoli contemporanei" è nativo: **1 riga `clienti_anagrafica` + N righe `anagrafica_relazione`**. Esempio carpentiere: 1 anagrafica con relazioni FORNITORE + INSERZIONISTA; il voucher/barter è il ponte:
- **Fase 2**: `anagrafica_compensazione` (modalità abilitate), `voucher` tipizzato (7 tipi), `wallet` per anagrafica, `campagna_compensazione`/`ordine_compensazione` (pagamento multi-modalità N:M).
- Flusso barter carpentiere: emissione voucher come quota di pagamento fornitura (Procurement) → riscatto come credito campagne su book.atchannel.it (Media). Tracciato in `transazione` (Fase 3) con emesso_da/emesso_per/valore/scadenza.
- I 3 front-end (book/partner/procurement) consumano la stessa anagrafica via API, ciascuno vedendo solo il proprio dominio.

## 9. Rischi

1. **Qualità dedup**: l'anagrafica attuale ha pochissime P.IVA → match su denominazione_norm, soggetto a falsi positivi/negativi (ragioni sociali simili). Mitigazione: report pre-insert (fatto), revisione dei match ambigui, `codice_interno` come chiave forte dove presente.
2. **Cross-DB campaigns/WP**: nessuna FK reale possibile → coerenza affidata alle API e alla disciplina "ATS = SoT". Rischio di UUID orfani su WP se un'anagrafica viene fusa/cancellata → prevedere API di "merge/redirect" e soft-delete.
3. **Voucher legacy**: `voucher_movimenti/saldi` usano `cliente` TEXT (non UUID) → riconciliazione necessaria in F2 (mappare testo→anagrafica_id) con rischio di ambiguità.
4. **Migrazione PH**: dati partner in Supabase esterno; mapping relationship_type→tipo_relazione da validare.
5. **Volume import** su prod: mitigato da staging + report + conferma + `_import_log` per rollback selettiva.
6. **Privacy/GDPR**: dati personali (CF persone fisiche, email) → restano solo in ATSystem, nessun file/memoria; API con controllo ruolo.

## 10. Tempi stimati (indicativi, a valle approvazione)

- **Fase 1**: migrazioni M1–M3 + seed (~0.5 gg) · API CRUD anagrafica/relazioni (~1–1.5 gg) · import clienti+fornitori con report/conferma (~0.5 gg) · test/verifica no-regressione (~0.5 gg) → **~3 giornate**.
- **Fase 2** (compensazioni + voucher + wallet + pagamenti multi-modalità + riconciliazione voucher legacy): **~4–6 giornate**.
- **Fase 3** (RdO/offerte/ordini + transazioni + dashboard CRM 360 + vendor rating + integrazione booking WP): **~6–10 giornate**, con coordinamento WP.

## 11. Decisioni CEO ricevute (MAIN → ATS, 09/07 12:35) — CHIUSE

1. **Estendere `clienti_anagrafica`** (no tabella parallela) — **CONFERMATO**.
2. **Sorgente 94 fornitori** — file Excel `ANAGRAFICA CLIENTI FORNITORI_MARRO.xlsx` (foglio FORNITORI: Cod/Denominazione/Città/Provincia). Se la tabella PH `mxva.partner` ha dati più ricchi, usarla come base e integrare col file Excel. **Nota tecnica ATS:** il file non è ancora presente nelle cartelle Drive a cui ho accesso in lettura (`SPAZI PUBBLICITARI AT`, `Marketing on air + AI`, `Fatture SRL`) — verificato con ricerca, 0 risultati. Serve che Simone lo carichi in una di queste cartelle o mi indichi il path esatto prima dell'import fornitori.
3. **Update fill-empty** sugli esistenti — confermato (già in piano). **46 P.IVA malformate → QUARANTENA**: import comunque, stato `da_verificare` (nuova colonna, vedi §3 F1-M1bis), nessun blocco import.
4. **ATS non scrive su Supabase WP** — confermato. `inserzionista_id`/`proprietario_id` restano riferimenti logici risolti via API, mai FK cross-DB.

## 12. Integrazione Marketing (Brevo) — deliverable OBBLIGATORIO Fase 1

Direttiva CEO 09/07 12:29 (via MAIN 12:35): con il phase-out HubSpot, **tutti** i contatti CRM (clienti, fornitori, partner di ogni tipo) devono essere disponibili al marketing (Brevo) per campagne/segmentazione/automazioni. Non opzionale, non differibile a Fase 2.

**Regole:** ATS = master, Brevo = consumer. Sync **unidirezionale** ATS→Brevo (i soli dati di engagement open/click possono tornare per scoring, opzionale F2). Mai HubSpot nel flusso contatti. Ogni anagrafica con email valida **e** `consenso_marketing = true` va sincronizzata.

**F1-M1bis — GDPR + quarantena P.IVA (additiva, va in `/scripts` insieme a F1-M1):**
```sql
alter table public.clienti_anagrafica
  add column if not exists consenso_marketing boolean not null default false,
  add column if not exists piva_stato text not null default 'ok'
    check (piva_stato in ('ok','da_verificare')),
  add column if not exists marketing_sync_at timestamptz;
```
- `consenso_marketing`: default false → nessun contatto esistente finisce in Brevo senza consenso esplicito verificato in import (§5: da confermare a Simone come si deduce il consenso per i 632 nuovi — es. presenza di opt-in su fattura/ordine, o default false + campagna di raccolta consenso separata).
- `piva_stato = 'da_verificare'` per le 46 P.IVA malformate in import; non blocca l'insert.
- `marketing_sync_at`: timestamp ultimo sync riuscito verso Brevo (idempotenza/debug).

**API — nuovo endpoint Fase 1 (aggiunta a §7):**
- `GET /api/crm/contacts/marketing-sync?cursor=&limit=` — paginato, auth service-to-service (token dedicato, non l'auth operatore). Espone: `ats_id`, email, `ats_relazioni` (lista tipi relazione attivi), `ats_compensazioni` (F2, vuoto per ora), `ats_voucher_attivi` (F2, 0 per ora), `ats_wallet_saldo` (F2, 0 per ora), `ats_ultimo_ordine`, `ats_verticale`, `ats_sync_at`. Filtra SEMPRE `consenso_marketing = true` e email non nulla/valida.

**Webhook — Fase 1:**
- Trigger su INSERT/UPDATE/DELETE di `clienti_anagrafica` e `anagrafica_relazione` (via trigger DB → tabella `_outbox_marketing_sync` + job che POSTa a un URL Make.com configurabile via env var, con retry) → Make.com instrada verso Brevo (crea/aggiorna contatto, attributi custom, liste/segmenti).
- Disiscrizione Brevo → webhook Make.com→ATS (endpoint `POST /api/crm/contacts/unsubscribe`, service-to-service) → `consenso_marketing = false`.
- Pattern outbox (non trigger sincrono diretto a Make.com) per non bloccare le scritture ATS se Make.com è irraggiungibile — coerente con "Priorità: stabilità sopra nuove funzionalità".

**Import iniziale:** dopo l'import Excel (2.804 clienti + 94 fornitori, §5), sync immediato verso Brevo via Make.com per tutte le righe con `consenso_marketing = true` — non aspettare Fase 2. Il consenso dei record importati va deciso con Simone prima del sync (vedi nota sopra).

**Aggiornamento tempi (§10):** +0.5–1 gg per endpoint marketing-sync + outbox/webhook + colonne GDPR → Fase 1 stimata **~3.5–4 giornate** (era ~3).

**Azione richiesta a Simone/MAIN prima dell'apply:**
1. Path del file `ANAGRAFICA CLIENTI FORNITORI_MARRO.xlsx` (non trovato nelle cartelle Drive montate).
2. Come determinare `consenso_marketing` per i record importati (default false + raccolta consenso separata, oppure criterio da fattura/ordine).
3. URL Make.com di destinazione per il webhook (endpoint da configurare come env var, non hardcoded).
4. Conferma finale per applicare la migration Fase 1 completa (F1-M1 + F1-M1bis + F1-M2 + F1-M3) su Supabase prod `aaiuyaiwdrecyqjgnjxp` — script pronto in `scripts/20260709_crm_unico_fase1.sql`, NON applicato.
