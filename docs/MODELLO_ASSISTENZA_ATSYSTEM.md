# AT SYSTEM — Modello definitivo Assistenza / SAAS / Area Cliente

> ⚠️ **DOCUMENTO ARCHITETTURALE — SOURCE OF TRUTH dei piani di assistenza.**
> Usa esclusivamente la nomenclatura ufficiale di `docs/CATALOGO_PIANI_ATSYSTEM.md`. Il materiale
> commerciale, l'Area Cliente, i contratti, il CRM, gli alert e il deck sono rappresentazioni di
> questo documento. SLA e interventi inclusi sono **configurabili** (non hardcoded). Il deck
> commerciale ne è una versione semplificata. Niente codice/commit finché non validato.

Versione: 2026-06-15 (modello PREMIUM CLIENT)

---

## 0. Principi architetturali confermati

Source of truth della copertura:

```
Cliente
  └── Progetti                (contenitore commerciale/contrattuale)
        └── Contratto/Piano   (livello copertura + add-on PREMIUM CLIENT + SLA + interventi)
              └── Impianti     (unità tecnica, eredita la copertura del progetto)
```

- La copertura **NON** è determinata a livello cliente, ma dal **progetto** e dall'**impianto**.
- Il cliente vede una **vista aggregata e descrittiva**.
- Ogni richiesta è riconducibile a: **cliente → progetto → impianto**.
- SLA, interventi inclusi, priorità e tempi di risposta sono **configurabili**.

---

## A) Modello definitivo dei PIANI

### A.1 Piani principali (sul progetto)

Nomenclatura ufficiale (vedi catalogo). Un solo piano attivo per progetto alla volta.

| Piano | Codice interno | Tier | Significato |
|-------|----------------|------|-------------|
| **Nessuna copertura** | — | `nessuna` | Né garanzia né contratto attivo. Assistenza a preventivo. |
| **Garanzia** | `item_tipo=GARANZIA` | `garanzia` | Garanzia hardware attiva, nessun SAAS. Copre i difetti in garanzia. |
| **CARE PLUS** | `SAAS-PL` | `plus` | SAAS base: iPlayer, cloud, diagnostica, monitoraggio, ticketing, aggiornamenti. |
| **CARE ULTRA** | `SAAS-UL*`, `SAAS-UL-ILL` | `ultra` | Copertura avanzata, priorità assoluta, interventi inclusi, SLA orario H{N}/illimitato. |
| **ART TECH EVENT** | `SAAS-EVTR/EVTO/EVTF` | `event` | Eventi/noleggi temporanei (≤ 7 gg): presidio, on-site rapido, priorità assoluta. |

> ~~CARE PREMIUM~~ (`SAAS-PR*`) è **legacy in dismissione**: non è più un piano. I contratti
> esistenti vengono riallineati manualmente a **CARE PLUS + Premium Client** o **CARE ULTRA**.

### A.2 Add-on trasversale: PREMIUM CLIENT

Programma relazionale/commerciale **trasversale ai piani**, non un piano. A livello dati: flag
**`premium_client`** (boolean), predisposto per futuri programmi (`client_program`:
PREMIUM_CLIENT / STRATEGIC_CLIENT / PARTNER_CLIENT / DOOH_PARTNER).

- **Incluso** in: CARE ULTRA, ART TECH EVENT, noleggi, garanzia per società sportive.
- **Opzionale** (acquistabile) su: CARE PLUS.

**Comprende:** referente dedicato Art Tech, canale WhatsApp prioritario, presa in carico accelerata,
comunicazione preferenziale, gestione proattiva, accesso facilitato ai servizi.

**NON implica:** interventi gratuiti, SLA Ultra, interventi illimitati, ricambi inclusi — questi
dipendono **sempre dal piano**.

### A.3 Add-on servizi componibili
`SAAS-MON` (monitoraggio), `SAAS-TCK` (ticketing), `SAAS-SIM`, `SAAS-CMS`, `SAAS-BKP`, `SAAS-RPT`,
`SAAS-SLA`, `SAAS-EXT`, `SAAS-CYB` — vendibili con qualsiasi piano (vedi catalogo §3).

---

## B) Matrice SLA e servizi

SLA = attributi **configurabili** del contratto, non incorporati nel nome del piano. Oggi l'SLA
orario è già codificato nel suffisso del codice (`SAAS-UL8` = H8); va esposto come attributo.

Due tempi: `sla_presa_in_carico_ore` (presa in carico ticket) e `sla_intervento_onsite_ore`
(intervento on-site, decorrente dalla presa in carico).

| | Nessuna | Garanzia | CARE PLUS | CARE ULTRA | ART TECH EVENT |
|---|---|---|---|---|---|
| **Canale ticket** | sì (a preventivo) | sì | sì + operatore | sì + priorità | sì + priorità assoluta |
| **Premium Client** | no | incluso se sportiva | opzionale | incluso | incluso |
| **Presa in carico** | best effort | standard (~24h) | H{N} configurabile | prioritaria | immediata (evento) |
| **Intervento on-site** | entro 72h post-verifica | best effort (garanzia) | a consumo salvo inclusi | H4–H36 / illimitato | entro 1h |
| **Interventi inclusi/anno** | 0 | difetti in garanzia | `interventi_annui` (default 0) | `interventi_annui`/illimitati | presidio evento |
| **Monitoraggio** | no | no | sì | sì | durante evento |
| **Sconti su extra** | no | no | base | prioritario | da contratto evento |

Maggiorazioni configurabili (da listino storico): **festivi +50%**, **prefestivi +30%**.
Il sistema **non si blocca** se SLA/interventi non configurati: usa default di livello o `null`.

---

## C) Interventi inclusi

Già supportati dallo schema: `saas_contratti.interventi_annui` (int) e `illimitati` (bool).

- `interventi_inclusi_anno` = `interventi_annui` (o ∞ se `illimitati`).
- `interventi_usati` (derivato dagli interventi chiusi imputabili al contratto).
- `interventi_residui` = inclusi − usati.
- Prima ora on-site e tariffe extra: parametriche (storico: 1ª ora inclusa, oraria €55 con sconti).
- Gli interventi **non estendono la garanzia** (nota di tutela).

---

## D) Struttura dati consigliata

Mantiene il dominio esistente (`rinnovi_servizi` per le scadenze; `saas_contratti.piano_codice`;
`checklists.saas_piano`). Evoluzioni:

### D.1 `config_livelli_assistenza` (nuova — configurazione, niente hardcoded)
```
livello ENUM(nessuna, garanzia, plus, ultra, event) PK
label, priorita int, premium_client_incluso boolean,
sla_presa_in_carico_ore int null, sla_intervento_onsite_ore int null,
interventi_inclusi_default int null, descrizione_cliente text
```

### D.2 Add-on PREMIUM CLIENT
- Campo **`premium_client` boolean** su `saas_contratti` (e/o sul progetto/contratto assistenza).
- Predisposizione futura: `client_program text null`.
- In lettura, `premium_client` effettivo = `flag esplicito` OR `config_livelli.premium_client_incluso`
  per il livello OR (noleggio) OR (garanzia + flag società sportiva).

### D.3 Attributi piano/SLA/interventi
- `saas_contratti`: `piano_codice`, `scadenza`, `interventi_annui`, `illimitati` (esistenti) +
  `premium_client` (nuovo) + opzionali `sla_presa_in_carico_ore`, `sla_intervento_onsite_ore`
  (override; altrimenti default da `config_livelli`).
- `checklists.saas_tipo`: **deprecato** (usare `saas_piano` = codice).

### D.4 Tickets
`assistenza_tickets` (esistente) → aggiungere `progetto_id`, `impianto_id`/seriale,
`tier_snapshot`, `premium_client_snapshot`, `sla_snapshot`.

### D.5 CARE PREMIUM legacy
`SAAS-PR*` resta leggibile come legacy; nessuna nuova scrittura. Mappa di riallineamento manuale in
`CATALOGO_PIANI_ATSYSTEM.md §5`.

---

## E) Algoritmo `computeSupportTierForProgetto()`

Input: `progettoId` (checklist_id). Output normalizzato:

```jsonc
{
  "progettoId": "…",
  "contrattoId": "…" | null,
  "tier": "ULTRA" | "EVENT" | "PLUS" | "GARANZIA" | "NESSUNA",
  "source": "saas_contratti" | "rinnovi_servizi" | "checklists.saas" | "garanzia" | "none",
  "premiumClient": true,
  "garanziaAttiva": true,
  "supportoAttivo": true,
  "supportoScaduto": false,
  "scadenzaPiano": "2026-12-31" | null,
  "scadenzaGaranzia": "2027-03-15" | null,
  "sla": { "presaInCaricoOre": 12, "onsiteOre": 24 } | null,
  "interventi": { "inclusiAnno": 5, "usati": 6, "residui": -1 } | null,
  "referente": "Art Tech" | null,
  "whatsapp": "+39…" | null
}
```

Ordine di determinazione (per progetto):
1. **Piano attivo** sul progetto. Fonte primaria reale: **`checklists.saas_piano`** (qui vivono
   PLUS/EVENT e i residui PREMIUM); ULTRA può stare anche in `saas_contratti`/`rinnovi_servizi`
   (`item_tipo=SAAS` + `subtipo=ULTRA`). Mappatura codici → tier: `SAAS-PL`→plus, `SAAS-UL*`→ultra,
   `SAAS-EVT*`→event. **`SAAS-PR*` NON è mappato** (CARE PREMIUM dismesso): nessuna logica speciale.
2. **Garanzia attiva** e nessun piano → `tier = GARANZIA`.
3. Altrimenti → `tier = NESSUNA`.

Derivazioni:
- `premiumClient` = flag contratto OR incluso-per-livello (ultra/event) OR noleggio OR (garanzia +
  società sportiva).
- `sla`/`interventi`: da contratto se valorizzati, altrimenti default `config_livelli`; se mancanti → `null` (non blocca).
- Vista aggregata cliente = map su tutti i progetti → coperture per impianto + "premium client attivo su almeno un progetto".

> **CARE PREMIUM è dismesso (decisione definitiva).** `computeSupportTierForProgetto` **non produce
> mai** CARE PREMIUM e **non contiene logica speciale né compatibilità** per `SAAS-PR*`. I progetti
> `SAAS-PR*` esistenti sono **solo dato storico** da **riallineare manualmente** (vedi
> `MIGRAZIONE_CARE_PREMIUM.md`) prima del go-live; finché non riallineati vanno esposti in un
> **report admin "da riallineare"**, non gestiti dall'algoritmo.
> **Step 1** implementa solo `computeSupportTierForProgetto` + aggregatore; SLA/interventi possono
> essere `null` finché non popolati.

---

## F) Cosa vede ogni ruolo

- **Cliente**: L1 "I tuoi impianti"; L2 dettaglio (copertura, scadenza, interventi residui se
  configurati, referente/WhatsApp se Premium Client). Badge "Premium Client" se attivo. Nessun prezzo.
- **Commerciale**: piano per progetto, scadenze, Premium Client sì/no, upsell (Plus→Ultra, attivare
  Premium Client su Plus), contratti CARE PREMIUM legacy da riallineare.
- **Operatore/assistenza**: per ticket cliente/progetto/impianto/piano/SLA/interventi residui/
  priorità; Premium Client per il canale prioritario; coda prioritizzata.
- **Amministrazione**: contratti, scadenze, interventi inclusi vs extra, supplementi, rinnovi,
  elenco CARE PREMIUM da migrare.

Messaggi assistenza guidata: Ultra/Event → assistenza prioritaria inclusa; Plus → inclusa secondo
contratto; Garanzia → presa in carico in garanzia; Nessuna → preventivo. Premium Client aggiunge il
canale diretto a prescindere dal piano.

---

## G) Alert automatici per livello

Via sistema esistente (`/api/send-alert`, Resend, template configurabili).

- Trasversali: scadenza contratto/garanzia 60/30/15 gg; avviso interno alla ricezione ticket (priorità per tier).
- CARE ULTRA / ART TECH EVENT: pre-avviso scadenza anticipato (90/60/30 gg); ticket alta priorità; (Event) inizio/fine evento e presidio.
- CARE PLUS: reminder rinnovo + upsell (Ultra / Premium Client).
- Garanzia: "fine garanzia" 90/60/30 gg con proposta CARE PLUS/ULTRA.
- Nessuna: nessun alert ricorrente; ticket → flusso preventivo.
- Interventi inclusi: alert a `residui = 1` e `= 0`.
- **Premium Client**: alert interni reperibilità/turni; SLA di comunicazione accelerata.
- **CARE PREMIUM legacy**: alert interno "contratto da riallineare" sui contratti `SAAS-PR*`.

---

## Decisioni recepite (2026-06-15)
- Premium Contact → rinominato **PREMIUM CLIENT** (programma trasversale, `premium_client` boolean).
- **CARE PREMIUM DISMESSO (definitivo)**: non fa parte del modello futuro. Nessuna compatibilità
  funzionale, nessuna migrazione automatica, **nessuna logica speciale nell'algoritmo**.
  `computeSupportTierForProgetto` non produce mai CARE PREMIUM. Resta solo come informazione storica
  fino al completamento del **riallineamento manuale** (a cura di Art Tech) dei 14 progetti `SAAS-PR*`.
- Piani principali: **Garanzia, CARE PLUS, CARE ULTRA, ART TECH EVENT**. Programma: **PREMIUM CLIENT**.
- Lista CARE PREMIUM da riallineare: `docs/MIGRAZIONE_CARE_PREMIUM.md` (default: SAAS-PR4→CARE ULTRA,
  SAAS-PR/PR36→CARE PLUS + Premium Client; validazione progetto per progetto prima di toccare i dati).

## Punti ancora da validare
1. Default SLA e interventi inclusi per livello (matrice §B/§C).
2. `premium_client` su `saas_contratti` vs tabella programmi dedicata.
3. Soglie alert anticipati (90/60/30) per Ultra/Event e fine garanzia.
4. Quali interventi "consumano" gli inclusi (solo on-site? anche remoto?).
