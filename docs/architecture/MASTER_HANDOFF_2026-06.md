# AT SYSTEM — MASTER HANDOFF (2026-06)

> Documento di allineamento per nuove sessioni (agenti AI e persone). Riassume contesto, principi
> architetturali, decisioni approvate, stato della documentazione assistenza e prossimi passi.
> **AT SYSTEM è la source of truth**: materiale commerciale, Area Cliente, CRM e automazioni si
> adattano ad AT SYSTEM, non viceversa.

Ultimo aggiornamento: 2026-06-15

---

## 0. Contesto aziendale

Art Tech S.r.l. sviluppa e usa **AT SYSTEM** come piattaforma centrale per: gestione clienti,
progetti, impianti LED, cronoprogramma, interventi di assistenza, contratti SAAS, rinnovi, ticketing,
documentazione, area cliente, future automazioni AI.

- Sito aziendale: https://www.maxischermiled.it
- Sistema online: https://atsystem.arttechworld.com
- Repo: https://github.com/simonelisa-arttech/arttech-checklist
- File locali: `/Users/MACBOOKSL/Documents/arttech-checklist`
- Stack: Next.js (App Router) · React · TypeScript strict · Supabase (Postgres/Auth/Realtime) ·
  Vercel · Resend · Playwright (E2E).

---

## 1. Principi architetturali fondamentali

### Source of Truth
AT SYSTEM è la source of truth di nomenclatura, logiche, piani, alert, ticketing e coperture.

### Gerarchia dati
`Cliente → Progetti → Piano/Contratto → Impianti`
La copertura **NON** è a livello cliente: è a livello **progetto/impianto**. Lo stesso cliente può
avere impianti con coperture diverse.

### Impianto = unità tecnica principale
Ogni impianto deve poter avere: storico interventi, documenti, seriali, sostituzioni, aggiornamenti →
**fascicolo tecnico**. L'Area Cliente è costruita **intorno all'impianto**.

### Stato progetto
Source of truth: `getEffectiveProjectStatus()`. `OPERATIVO` = attivo, `CHIUSO` = solo stato finale.
**Mai** usare direttamente `stato_progetto` per logiche UI o filtri.

### Cronoprogramma (hub operativo)
Tutti i blocchi INSTALLAZIONE/DISINSTALLAZIONE usano: `cronoprogramma_meta`,
`cronoprogramma_meta_slots`, `cronoprogramma_meta_referenti`.

### Blocco operativo condiviso
Condiviso tra **pagina progetto** e **cronoprogramma**: le modifiche da una parte sono visibili
dall'altra. Campi: indirizzo, descrizione attività, personale, mezzi, referenti, commerciale Art
Tech, modalità attività, stato operativo. Source of truth: `cronoprogramma_meta`.

### Seriali controllo
Tabella `asset_serials`, relazione `asset_serials.checklist_impianto_id`. Bug risolto: il salvataggio
impianti non deve perdere l'associazione seriale → impianto. Commit: `c3a093f`, `34e33d4`, `adaeb64`.

---

## 2. Modello Assistenza — decisioni APPROVATE (2026-06)

### Piani ufficiali (usare SOLO questi nomi)
- **Garanzia**
- **CARE PLUS**
- **CARE ULTRA**
- **ART TECH EVENT**

### Programma aggiuntivo trasversale
- **PREMIUM CLIENT** — NON è un piano. È un programma relazionale.
  - Comprende: referente dedicato, WhatsApp prioritario, presa in carico accelerata, comunicazione preferenziale, gestione proattiva.
  - NON comprende: interventi gratuiti, SLA Ultra, interventi illimitati, ricambi inclusi (dipendono dal piano).
  - Inclusione: CARE PLUS = opzionale; CARE ULTRA = incluso; ART TECH EVENT = incluso; Noleggi = incluso; società sportive in garanzia = incluso.
  - A livello dati: `premium_client = true/false` (predisporre `client_program` per futuri STRATEGIC/PARTNER/DOOH).

### CARE PREMIUM — DISMESSO (definitivo)
Legacy, non fa parte del modello futuro. **Nessuna** compatibilità funzionale, **nessuna** migrazione
automatica, **nessuna** logica speciale nell'algoritmo. I 14 progetti `SAAS-PR*` esistenti vengono
**riallineati manualmente** da Art Tech (default: `SAAS-PR4`→CARE ULTRA; `SAAS-PR`/`SAAS-PR36`→CARE
PLUS + Premium Client). Restano solo come dato storico fino al completamento.

### Algoritmo futuro `computeSupportTierForProgetto()`
- Restituisce: `GARANZIA | CARE PLUS | CARE ULTRA | ART TECH EVENT | NESSUNA COPERTURA` + `premiumClient: true/false`.
- **Non** restituisce mai CARE PREMIUM. `SAAS-PR*` non mappato (nessuna logica speciale).
- Output normalizzato e dettagli in `MODELLO_ASSISTENZA_ATSYSTEM.md §E`.

---

## 3. Findings reali dal DB (produzione, 2026-06-15)

Progetto Supabase produzione: **`checklists-arttech's Project`** (ref `aaiuyaiwdrecyqjgnjxp`), org `ArtTech`.

- I piani vivono in **`checklists.saas_piano`** (PLUS/EVENT e residui PREMIUM). `saas_contratti`
  contiene **solo ULTRA** (`SAAS-UL4/12/24/36/-ILL`). → L'algoritmo deve leggere `checklists.saas_piano`.
- Distribuzione `checklists.saas_piano`: SAAS-PL ×336, (null) ×128, SAAS-UL ×55, SAAS-UL24 ×31,
  SAAS-MON ×16, SAAS-PR4 ×7, SAAS-UL4 ×7, SAAS-PR ×6, SAAS-EVTF ×2, SAAS-UL8 ×2, SAAS-PR36 ×1.
- **CARE PREMIUM = 14 progetti** (elenco completo in `MIGRAZIONE_CARE_PREMIUM.md`).
- Anomalie legacy in `rinnovi_servizi`: `SAAS_ULTRA` ×1, `SAAS_SCHERMO` ×2 (fuori CHECK
  `item_tipo IN (LICENZA,TAGLIANDO,SAAS,RINNOVO,GARANZIA,SIM)`) → da normalizzare.
- Tabella clienti = **`clienti_anagrafica`** (id uuid). `saas_contratti.cliente` = uuid;
  `checklists.cliente` = nome (text); `checklists.cliente_id` = id.
- Nessun residuo `SAS-*` (migrazione SAS→SAAS completata 23/02/2026).

---

## 4. Documentazione assistenza prodotta (source of truth funzionale)

In `docs/`:
- **`CATALOGO_PIANI_ATSYSTEM.md`** — catalogo ufficiale piani/servizi, codici, legacy→ufficiale, query DB.
- **`MODELLO_ASSISTENZA_ATSYSTEM.md`** — modello architetturale: piani, SLA, interventi, struttura dati, algoritmo, viste per ruolo, alert.
- **`AREA_CLIENTE_CUSTOMER_JOURNEY.md`** — Area Cliente come strumento operativo condiviso; journey, requisiti (foto/video, classificazione impianto, fascicolo tecnico, CTA commerciale).
- **`DOCUMENTO_COMMERCIALE_ASSISTENZA.md`** — guida vendita allineata alla nomenclatura ufficiale.
- **`MIGRAZIONE_CARE_PREMIUM.md`** — elenco dei 14 progetti CARE PREMIUM da riallineare manualmente.
- `PIANI_ASSISTENZA.md` — prima bozza divulgativa (superata dai documenti sopra).

---

## 5. Area Cliente — cosa sviluppare (priorità future)

Documento di riferimento: `AREA_CLIENTE_CUSTOMER_JOURNEY.md`. Principio: **strumento operativo
condiviso cliente ↔ Art Tech**, non portale documentale. Obiettivi: meno telefonate/email, ticket
corretti, individuazione rapida impianto, consultazione documenti/coperture, richieste guidate.

Journey principale "Ho un problema": Cliente → Impianto → Categoria → Verifica guidata → Foto/Video →
Ticket → Presa in carico, con riconoscimento automatico di copertura, SLA, Premium Client, garanzia.

Priorità di sviluppo:
1. `computeSupportTierForProgetto()`
2. Vista impianti per progetto (L1/L2)
3. Fascicolo tecnico impianto
4. Ticket guidati (con foto/video)
5. Premium Client
6. Scadenze
7. Documenti
8. Richieste commerciali (CTA ampliamento/upgrade/nuova installazione)

---

## 6. Deck commerciale — indice definitivo (opzione B, 13 slide)

Da generare solo dopo validazione finale. Solo nomenclatura ufficiale.

1. Copertina
2. Perché è diverso (tradizionale vs Area Cliente + AT SYSTEM)
3. Come funziona la copertura (progetto/impianto)
4. Garanzia
5. CARE PLUS
6. CARE ULTRA
7. ART TECH EVENT
8. PREMIUM CLIENT (add-on trasversale)
9. Tabella comparativa
10. Come ricevere assistenza (flusso end-to-end con foto/video)
11. Area Cliente (cosa vede e fa il cliente)
12. AT SYSTEM + Alert automatici e monitoraggio
13. Vantaggi (cliente/commerciale/assistenza) + contatti

---

## 7. Domini e assistenza online (stato)

- **www.ledcareservice.com** — landing assistenza Art Tech online (dominio aziendale).
- **ledcare.it** — redirect 301 → www.ledcareservice.com (impostato; verificare propagazione).
- **maxischermiled.it** — voce menu "Assistenza" aggiornata a www.ledcareservice.com (top bar + off-canvas), cache SiteGround svuotata.
- maxischermo.biz — non toccato (HubSpot e vecchi ticket intatti).
- ⚠️ Aperto: ledcareservice.com mostra talvolta "Sito in costruzione" alla prima visita = **cache stantia** su Aruba (con `?cb=` serve la pagina giusta). Fix da fare in Aruba (rimuovere placeholder + svuotare cache); cancellazione file lato utente.

---

## 8. Regole operative per agenti AI

Prima di qualsiasi modifica, leggere: `AGENTS.md`, `docs/architecture/source-of-truth.md`,
`docs/architecture/do-not-break.md`, `AREA_CLIENTE_CUSTOMER_JOURNEY.md`,
`DOCUMENTO_COMMERCIALE_ASSISTENZA.md`, `MODELLO_ASSISTENZA_ATSYSTEM.md`, e il presente handoff.

- **Mai** commit automatici. **Mai** eseguire SQL senza approvazione (le query DB di analisi vanno proposte/confermate).
- Flusso sempre: **Analisi → proposta → patch → test → eventuale commit**. Un solo step alla volta.
- Lavorare sempre sul codice/dato reale del repo, mai suggerimenti generici.
- Rispettare la nomenclatura ufficiale (mai "CARE PREMIUM" né "Premium Contact").
- **Preferenza utente**: fornire sempre istruzioni copia-incolla per Codex/Claude/CLI, senza
  richiedere modifiche manuali ai file da parte dell'utente quando evitabile.
- Rispondere sempre in italiano.

---

## 9. Prossimi passi (ordine concordato)

1. ✅ Catalogo ufficiale · Modello · Customer Journey · Documento commerciale · Lista CARE PREMIUM.
2. ✅ Indice deck (opzione B, 13 slide).
3. Revisione finale del modello assistenza (validare punti aperti: default SLA/interventi, `premium_client` su `saas_contratti` vs tabella programmi, soglie alert).
4. Generazione deck `.pptx` (dopo validazione indice).
5. Solo dopo: piano migrazione CARE PREMIUM · `computeSupportTierForProgetto()` · implementazione Area Cliente.
