# Catalogo ufficiale piani e servizi AT SYSTEM

> **Principio guida:** AT SYSTEM è la source of truth della nomenclatura. Marketing, deck,
> contratti, CRM, Area Cliente, alert e documentazione devono usare **esclusivamente** i nomi e i
> codici di questo catalogo. Il materiale commerciale si adatta al sistema, non viceversa.
>
> Fonte: analisi di `lib/supportTier.ts`, `app/checklists/[id]/page.tsx`,
> `app/dashboard-estesa/page.tsx`, `app/clienti/[cliente]/page.tsx`, dei file di migrazione in
> `/scripts` e del seed `nota_catalog_items_seed_from_pjm.txt`. Migrazione **SAS→SAAS** completata
> il 23/02/2026.
>
> ⚠️ I valori riga-per-riga del DB live (distinct effettivi in `saas_contratti`, `rinnovi_servizi`,
> `checklists`) sono **da confermare** con le query in §6 (il sandbox non raggiunge Supabase).

Versione bozza: 2026-06-15

---

## 1. Piani di copertura (autonomi)

Codice in `saas_contratti.piano_codice` e `checklists.saas_piano`. Il `tier` è il valore semantico
calcolato da `lib/supportTier.ts`.

| Nome commerciale | Codice interno | Tier | Descrizione | Utilizzo attuale |
|------------------|----------------|------|-------------|------------------|
| **CARE PLUS** | `SAAS-PL` | `plus` | Assistenza base SAAS: iPlayer, cloud, diagnostica automatica, monitoraggio, ticketing, aggiornamenti. | UFFICIALE, attivo |
| ~~CARE PREMIUM~~ | `SAAS-PR`, `SAAS-PR4/8/12/24/36` | (legacy) | Assistenza avanzata + SLA orario on-site H{N}. | 🚫 **LEGACY in dismissione** — non più un piano; clienti riallineati a CARE PLUS o CARE ULTRA (vedi §5) |
| **CARE ULTRA** | `SAAS-UL`, `SAAS-UL4/8/12/24/36`, `SAAS-UL-ILL` | `ultra` | Priorità assoluta, SLA orario H{N} o illimitato, canale diretto. | UFFICIALE, attivo |
| **ART TECH EVENT (remoto)** | `SAAS-EVTR` | `events` | Assistenza remota dedicata durante eventi/noleggi (≤ 7 gg). | UFFICIALE |
| **ART TECH EVENT (on site)** | `SAAS-EVTO` | `events` | Presidio/intervento on-site durante l'evento (entro 1h). | UFFICIALE |
| **ART TECH EVENT (flessibile)** | `SAAS-EVTF` | `events` | Variante evento a formato variabile. | UFFICIALE |

Note:
- Le varianti SLA orario sono codificate nel **suffisso** del codice (`…4/8/12/24/36` = H4…H36;
  `-ILL` = illimitato). Regex reali: `/^SAAS-PR(\d+)$/`, `/^SAAS-UL(\d+)$/`.
- `saas_contratti` ha già gli attributi **`interventi_annui`** (int) e **`illimitati`** (bool):
  gli interventi inclusi sono quindi **già configurabili** a livello contratto.

---

## 2. Coperture non-SAAS (in `rinnovi_servizi.item_tipo`)

CHECK constraint reale (`rinnovi_servizi_item_tipo_check`, da `20260330_…sim_support.sql`):

```sql
CHECK (item_tipo IN ('LICENZA', 'TAGLIANDO', 'SAAS', 'RINNOVO', 'GARANZIA', 'SIM'))
```

| item_tipo | Significato | Note |
|-----------|-------------|------|
| `GARANZIA` | Copertura di garanzia hardware standard → tier `standard`. | Una sola per checklist (unique index). Non è un piano SAAS. |
| `SAAS` | Servizio SAAS attivo sul progetto. `subtipo = ULTRA` lo marca come Ultra. | `subtipo` ∈ {ULTRA, null}. |
| `LICENZA` | Licenze software. | Scadenza dedicata. |
| `TAGLIANDO` | Manutenzione ordinaria. | — |
| `SIM` | Schede SIM dati (aggiunto 30/03/2026). | — |
| `RINNOVO` | Rinnovo generico. | **Legacy**: preferire `SAAS`. |

---

## 3. Servizi add-on componibili (in `catalog_items`)

Vendibili in composizione libera con qualsiasi piano. Non sono piani autonomi.

| Nome commerciale | Codice | Descrizione |
|------------------|--------|-------------|
| Monitoraggio remoto & alert | `SAAS-MON` | Monitoring 24/7 con alert proattivi |
| Ticketing / Help desk | `SAAS-TCK` | Gestione ticket + help desk |
| Connettività SIM dati | `SAAS-SIM` | SIM dati/4G |
| Licenza CMS / software terzi | `SAAS-CMS` | Licenze software di terzi |
| Backup configurazioni / ripristino | `SAAS-BKP` | Backup e disaster recovery |
| Reportistica (log, uptime, on-air) | `SAAS-RPT` | Report uptime/performance |
| Opzione SLA ripristino | `SAAS-SLA` | SLA ripristino garantito (opzione) |
| Estensione garanzia / coperture | `SAAS-EXT` | Estensioni copertura |
| Cyber / antivirus / hardening player | `SAAS-CYB` | Sicurezza del player |

---

## 4. Mappa LEGACY → UFFICIALE (da eliminare/normalizzare)

| Legacy | Ufficiale | Dove | Azione |
|--------|-----------|------|--------|
| `SAS-*` (SAS-PL, SAS-PR, SAS-UL, SAS-EVT*, SAS-MON…) | `SAAS-*` | `catalog_items` | Migrazione fatta 23/02/2026; **eliminare eventuali residui** SAS-* |
| `item_tipo = "SAAS_ULTRA"` (solo in-memory) | `item_tipo=SAAS` + `subtipo=ULTRA` | codice TS | Mai scrivere `SAAS_ULTRA` in DB; normalizzare in lettura |
| `checklists.saas_tipo` (campo libero: "ULTRA"/"PREMI"/"EVENT") | `checklists.saas_piano` (codice) + `rinnovi_servizi` | `checklists` | **Deprecare** `saas_tipo`; usare il codice piano come fonte |
| `item_tipo = "RINNOVO"` (generico) | `item_tipo = "SAAS"` | `rinnovi_servizi` | Preferire SAAS per nuovi record |
| Duplicato `SAS-PR24` con descrizione H24 e H36 | un codice = un significato | seed catalogo | **Correggere** l'incoerenza |

---

## 5. Add-on trasversale: PREMIUM CLIENT (decisione APPROVATA 2026-06-15)

**Decisione approvata.** Il vecchio nome "Premium Contact" è **superato**: l'add-on si chiama
**PREMIUM CLIENT**. È un **programma relazionale/commerciale trasversale ai piani**, non un piano di
assistenza. **CARE PREMIUM è dismesso come piano.**

### Modello a livello AT SYSTEM
- Flag **`premium_client`** (boolean) sul contratto/progetto.
- Predisporre l'estensione futura ad altri programmi (es. `client_program` ∈ {PREMIUM_CLIENT,
  STRATEGIC_CLIENT, PARTNER_CLIENT, DOOH_PARTNER}) senza rifare il modello.
- **Incluso** in: **CARE ULTRA**, **ART TECH EVENT**, **noleggi**, **garanzia per società sportive**.
  **Opzionale** (acquistabile) su **CARE PLUS**.

### Cosa comprende PREMIUM CLIENT
Referente dedicato Art Tech · canale WhatsApp prioritario · presa in carico accelerata ·
comunicazione preferenziale · gestione proattiva delle esigenze · accesso facilitato ai servizi Art Tech.

### Cosa NON implica
Interventi gratuiti · SLA Ultra · interventi illimitati · ricambi inclusi.
Questi dipendono **sempre dal piano** (Garanzia / CARE PLUS / CARE ULTRA / ART TECH EVENT).

### Esempi
| Cliente | Piano | Premium Client |
|---------|-------|----------------|
| A | CARE PLUS | NO |
| B | CARE PLUS | SÌ (optional) |
| C | CARE ULTRA | SÌ (incluso) |
| D | ART TECH EVENT | SÌ (incluso) |
| Società sportiva in garanzia | Garanzia | SÌ (incluso) |

### CARE PREMIUM (`SAAS-PR*`) — dismissione
- Classificato **legacy in dismissione**: stop alle nuove vendite.
- I contratti esistenti sono **riallineati manualmente** a **CARE PLUS + Premium Client** oppure
  **CARE ULTRA**.
- Prerequisito al riallineamento: la **lista reale dei clienti con CARE PREMIUM attivo** (query §6).

---

## 6. Verifica dati live — query da eseguire sul DB (Supabase SQL editor)

Da lanciare per confermare i valori realmente presenti e scovare legacy residui:

```sql
SELECT piano_codice, COUNT(*) FROM saas_contratti GROUP BY piano_codice ORDER BY 2 DESC;
SELECT item_tipo, subtipo, COUNT(*) FROM rinnovi_servizi GROUP BY item_tipo, subtipo ORDER BY 1,2;
SELECT saas_piano, saas_tipo, COUNT(*) FROM checklists
  WHERE saas_piano IS NOT NULL OR saas_tipo IS NOT NULL
  GROUP BY saas_piano, saas_tipo ORDER BY 3 DESC;
SELECT codice, tipo, descrizione FROM catalog_items WHERE tipo IN ('SAS','SAAS') ORDER BY codice;

-- Lista clienti CARE PREMIUM attivi da riallineare manualmente (prerequisito §5):
SELECT cliente, piano_codice, scadenza
FROM saas_contratti
WHERE piano_codice LIKE 'SAAS-PR%' AND scadenza >= CURRENT_DATE
ORDER BY scadenza;
-- (verificare anche checklists.saas_piano LIKE 'SAAS-PR%')
```

Esito atteso: confermare l'elenco §1–§3, individuare eventuali `SAS-*` o valori anomali ancora in
uso, e produrre la **lista dei contratti CARE PREMIUM da riallineare** (§5).

### Dati live confermati (2026-06-15)
- I piani vivono in **`checklists.saas_piano`**; `saas_contratti` contiene **solo ULTRA**
  (`SAAS-UL4/12/24/36/-ILL`). Quindi la determinazione del tier deve leggere `checklists.saas_piano`.
- **CARE PREMIUM = 14 progetti** (SAAS-PR ×6, SAAS-PR4 ×7, SAAS-PR36 ×1) → elenco completo in
  `docs/MIGRAZIONE_CARE_PREMIUM.md`.
- Anomalie legacy in `rinnovi_servizi`: `SAAS_ULTRA` ×1 e `SAAS_SCHERMO` ×2 (fuori CHECK) → normalizzare.
- Nessun residuo `SAS-*` rilevato.

---

## 7. Nomenclatura ufficiale da usare ovunque (sintesi)

**Piani principali:**
- **Garanzia** (`item_tipo=GARANZIA`)
- **CARE PLUS** (`SAAS-PL`)
- **CARE ULTRA** (`SAAS-UL*`)
- **ART TECH EVENT** (`SAAS-EVT*`)

**Programma aggiuntivo (add-on trasversale):**
- **PREMIUM CLIENT** (`premium_client = true/false`)

**Legacy in dismissione:** ~~CARE PREMIUM~~ (`SAAS-PR*`) → riallineare a CARE PLUS o CARE ULTRA.

**Add-on servizi:** vedi §3.

Nessun materiale (deck, CRM, marketing, Area Cliente) deve introdurre nomi diversi da questi. In
particolare NON usare più "Premium Contact" né presentare "CARE PREMIUM" come piano autonomo.
