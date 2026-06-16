# Support Tier per Progetto — Architettura definitiva

> Specifica architetturale della determinazione della copertura assistenza **a livello progetto**.
> È il riferimento per ogni sviluppo futuro su Area Cliente, ticketing, Premium Client, alert, CRM,
> dashboard assistenza e residui interventi. Fonti di verità correlate: `AGENTS.md`,
> `docs/architecture/source-of-truth.md`, `docs/architecture/do-not-break.md`,
> `MODELLO_ASSISTENZA_ATSYSTEM.md`, `CATALOGO_PIANI_ATSYSTEM.md`,
> `AREA_CLIENTE_CUSTOMER_JOURNEY.md`, `MIGRAZIONE_CARE_PREMIUM.md`.

Versione: 2026-06-15

---

## 0. Scopo e contesto

Modello ufficiale: `Cliente → Progetti → Piano → Impianti`. La copertura **non** è a livello cliente:
è determinata dal **progetto** e dall'**impianto** coinvolto. L'impianto è l'unità tecnica autonoma
e eredita la copertura del progetto. Il cliente vede una vista **aggregata e descrittiva**.

Piani ufficiali: **Garanzia · CARE PLUS · CARE ULTRA · ART TECH EVENT**. Programma trasversale:
**PREMIUM CLIENT**. ~~CARE PREMIUM~~ è **dismesso** (vedi §7).

---

## 1. Source of truth

Tabelle/campi che concorrono alla determinazione (lette per `checklist_id` del progetto):

- **`saas_contratti`** — `piano_codice`, `scadenza`, `interventi_annui`, `illimitati`, (futuro)
  `premium_client`. Oggi è **cliente-level**: va reso **project-scoped** (vedi §8).
- **`rinnovi_servizi`** — `item_tipo` ∈ {LICENZA,TAGLIANDO,SAAS,RINNOVO,GARANZIA,SIM}, `subtipo`
  (ULTRA), `scadenza`. Fonte delle **scadenze**.
- **`checklists`** — `saas_piano`, `saas_scadenza`, `garanzia_scadenza`, `noleggio_vendita`.
  **Fonte primaria reale** dei piani oggi (qui vivono PLUS/EVENT e i residui PREMIUM).
- `checklists.saas_tipo` — **deprecato** (usare `saas_piano`).

### Ordine di priorità (dal più alto)
1. **Contratto formale** `saas_contratti` attivo applicabile al progetto.
2. **Rinnovo** `rinnovi_servizi` SAAS attivo sul `checklist_id` (`subtipo=ULTRA` → ultra).
3. **Piano su checklist** `checklists.saas_piano` attivo (`saas_scadenza >= oggi`).
4. **Garanzia** attiva (`rinnovi_servizi` GARANZIA **o** `checklists.garanzia_scadenza`).
5. Altrimenti → **NESSUNA copertura**.

Regola di precedenza: **contratto > rinnovo > checklist > garanzia > nessuna**.

### Mappatura codice → tier
| Codice | Tier |
|--------|------|
| `SAAS-PL` | CARE PLUS |
| `SAAS-UL*`, `SAAS-UL-ILL` | CARE ULTRA |
| `SAAS-EVTR/EVTO/EVTF` | ART TECH EVENT |
| `item_tipo=GARANZIA` / `garanzia_scadenza` | Garanzia |
| **`SAAS-PR*`** | **NON mappato** → vedi §7 (mai PLUS/ULTRA) |

PREMIUM CLIENT non è in questa tabella: è un **attributo trasversale** (vedi §3).

---

## 2. Algoritmo finale — `computeSupportTierForProgetto()`

Input: `progettoId` (= `checklist_id`). Output normalizzato, **mai** `CARE PREMIUM`.

```
computeSupportTierForProgetto(progettoId):
  ck  = checklists[progettoId]                 # saas_piano, saas_scadenza, garanzia_scadenza, noleggio_vendita
  rs  = rinnovi_servizi[checklist_id = progettoId]   # SAAS(+subtipo), GARANZIA, scadenze
  ctr = saas_contratti applicabili al progetto       # piano_codice, scadenza, interventi_annui, illimitati, premium_client, premium_client_incluso_garanzia

  tier = NESSUNA ; source = "none" ; warnings = []

  # --- Legacy CARE PREMIUM: rilevamento esplicito, mai conversione automatica ---
  if codicePiano(ctr|rs|ck) match "SAAS-PR*":
      warnings += "CARE PREMIUM da riallineare"     # warning INTERNO
      legacyNonValido = true
      # NON mappare a PLUS/ULTRA. Si prosegue ignorando SOLO il codice PR,
      # valutando le altre fonti (es. garanzia) per il tier reale.

  # --- Determinazione piano attivo (escluso SAAS-PR*) ---
  pianoAttivo = primaFonteAttiva([ctr, rs, ck], scadenza >= oggi, esclusi i codici SAAS-PR*)
  if pianoAttivo:
      tier   = mappa(SAAS-UL*→ULTRA, SAAS-EVT*→EVENT, SAAS-PL→PLUS)
      source = fonte vincente per precedenza
  elif garanziaAttiva(rs|ck):
      tier   = GARANZIA ; source = "garanzia"
  else:
      tier   = NESSUNA

  # Se trovato SAAS-PR* e nessun altro piano/garanzia valido → resta NESSUNA (client),
  # con flag interno legacyNonValido = true (NON mostrato al cliente).

  # --- Premium Client (attributo trasversale, vedi §3) ---
  premiumClient = ctr.premium_client
                  OR tier in {ULTRA, EVENT}
                  OR ck.noleggio
                  OR (tier == GARANZIA AND ctr.premium_client_incluso_garanzia)

  # --- SLA & interventi (configurabili, nullable, non bloccano) ---
  sla        = ctr.sla ?? default_config[tier]
  interventi = { inclusi: ctr.interventi_annui ?? default_config[tier],
                 usati:   count(interventi ON-SITE chiusi imputati al contratto),
                 residui: inclusi - usati }            # solo on-site consuma

  return {
    progettoId, contrattoId, tier, source,
    premiumClient, garanziaAttiva, supportoAttivo, supportoScaduto,
    scadenzaPiano, scadenzaGaranzia, sla, interventi,
    referente, whatsapp,
    _internal: { legacyNonValido, warnings }          # mai esposto al cliente
  }
```

Vista aggregata cliente = `computeSupportForCliente(clienteId)` mappa l'algoritmo su tutti i
progetti del cliente e restituisce: coperture per progetto/impianto + "Premium Client attivo su
almeno un progetto".

---

## 3. Premium Client

**Perché non è un piano:** descrive una **relazione** (canale e priorità di comunicazione), non una
copertura tecnica. Non altera SLA, interventi inclusi o ricambi, che dipendono **sempre dal piano**.

**Come si attiva:**
- Flag `premium_client` (boolean) sul contratto/progetto; predisporre `client_program` per futuri
  programmi (STRATEGIC/PARTNER/DOOH).

**Incluso automaticamente in:**
- **CARE ULTRA**
- **ART TECH EVENT**
- **Noleggi attivi**
- **Garanzie con flag `premium_client_incluso_garanzia`**

**Opzionale (acquistabile)** su **CARE PLUS** (flag esplicito).

**`premium_client_incluso_garanzia`** è un flag **generale** (non legato solo alle "società
sportive"): oggi vale per le società sportive in garanzia, domani può valere per federazioni, enti,
sponsor o clienti strategici, senza modificare il modello.

**Cosa comprende:** referente dedicato, WhatsApp prioritario, presa in carico accelerata,
comunicazione preferenziale, gestione proattiva. **Cosa NON comprende:** interventi gratuiti, SLA
Ultra, interventi illimitati, ricambi inclusi.

**Convivenza:** si somma a qualunque piano (Garanzia/PLUS/ULTRA/EVENT) come layer indipendente; nel
calcolo è un boolean derivato, non un ramo del tier.

---

## 4. Area Cliente

Il tier-per-progetto guida:
- **Ticket**: precompilato con impianto + copertura riconosciuta; messaggio adattato (ULTRA/EVENT =
  prioritario incluso; PLUS = incluso via ticket; Garanzia = presa in carico in garanzia; NESSUNA =
  a preventivo). `SAAS-PR*` → trattato come **NESSUNA** lato cliente (nessuna promessa).
- **Visibilità servizi**: mostra solo i servizi coerenti col tier del progetto.
- **Residui interventi**: visibili se previsti dal piano (solo on-site consuma).
- **Notifiche**: scadenze/rinnovi e stato ticket.
- **CTA commerciali**: "Richiedi ampliamento/upgrade/nuova installazione" → lead.
- **Premium Client**: badge + canale prioritario (referente/WhatsApp) a prescindere dal piano.

---

## 5. Backoffice

- **Scheda progetto**: badge "Piano attivo + scadenza + Premium Client" in **sola lettura**; se
  `legacyNonValido` → avviso "CARE PREMIUM da riallineare".
- **Dashboard assistenza**: distribuzione coperture, scadenze imminenti, progetti legacy da riallineare.
- **Coda ticket**: prioritizzata secondo la **Matrice ufficiale di priorità ticket** (sotto).
- **Cronoprogramma**: il tier non altera il blocco operativo condiviso (`cronoprogramma_meta*`);
  resta informazione di contesto, senza introdurre seconde source of truth.

### Matrice ufficiale di priorità ticket

Logica di priorità **unica e condivisa** da Area Cliente, Dashboard assistenza, HubSpot e future
code ticket (queue). Premium Client agisce come modificatore di priorità rispetto al solo piano.

| # | Priorità | Combinazione |
|---|----------|--------------|
| 1 | massima | ART TECH EVENT + PREMIUM CLIENT |
| 2 | | ART TECH EVENT |
| 3 | | CARE ULTRA + PREMIUM CLIENT |
| 4 | | CARE ULTRA |
| 5 | | Garanzia + PREMIUM CLIENT |
| 6 | | CARE PLUS + PREMIUM CLIENT |
| 7 | | Garanzia |
| 8 | | CARE PLUS |
| 9 | minima | Nessuna copertura |

---

## 6. Alert

Il tier alimenta (via `/api/send-alert` + Resend + template):
- **Rinnovi**: scadenza piano 90/60/30/15gg (90/60/30 anticipati per ULTRA/EVENT).
- **Garanzie**: "fine garanzia" 90/60/30gg con proposta CARE PLUS/ULTRA.
- **Interventi residui**: alert a residui = 1 e = 0.
- **Premium Client**: alert interni reperibilità/turni e comunicazione accelerata.
- **Legacy**: report interno "CARE PREMIUM da riallineare" (non ricorrente, non al cliente).

---

## 7. Dati legacy

- **CARE PREMIUM / `SAAS-PR*`** — **dismesso**. Regole:
  - `SAAS-PR*` **non è mai un piano valido** e **non** viene mostrato al cliente;
  - genera **warning interno** "CARE PREMIUM da riallineare" + flag `legacyNonValido` (alias `LEGACY_NON_VALIDO`);
  - **mai** convertito automaticamente in PLUS o ULTRA (riallineamento manuale, `MIGRAZIONE_CARE_PREMIUM.md`);
  - il codice `SAAS-PR*` viene **escluso dalla mappatura piano**, ma **si continuano a valutare le
    altre fonti** del progetto. Quindi il risultato finale NON è sempre NESSUNA:
    - `SAAS-PR*` **da solo** (nessun altro piano/garanzia valida) → **NESSUNA**;
    - `SAAS-PR*` **+ garanzia valida** sul progetto → **GARANZIA** (non NESSUNA);
  - in entrambi i casi restano il flag interno `legacyNonValido` e il warning.
- **`SAAS_ULTRA`** (item_tipo legacy, fuori CHECK) → normalizzare a `item_tipo=SAAS` + `subtipo=ULTRA`.
- **`SAAS_SCHERMO`** (×2, fuori CHECK) → da **verificare e correggere** (significato da chiarire).
- Altre anomalie → trattate come dato da bonificare (cleanup via SQL **approvato**, mai automatico).

Principio: l'algoritmo **non** contiene logica speciale che produca tier legacy; si limita a
**rilevare** e segnalare internamente.

---

## 8. Roadmap tecnica

**Già implementato (oggi):**
- `lib/supportTier.ts` calcola il tier a **livello cliente** (con tier `premium` ancora presente).
- Customer lookup pubblico riallineato a `supportTier.ts`; supporto ULTRA/EVENT in Area Cliente.
- `saas_contratti.interventi_annui` / `illimitati` (interventi configurabili) già presenti.
- Ticket su `assistenza_tickets` con reply-to cliente (HubSpot email-to-ticket).

**Mancante (da costruire):**
- `computeSupportTierForProgetto(progettoId)` **per-progetto** + aggregatore cliente.
- Project-scoping di `saas_contratti`.
- Campo `premium_client` (+ `premium_client_incluso_garanzia`, predisposizione `client_program`).
- SLA come **attributo** (non parsing del suffisso codice).
- Derivazione `interventi_usati` da interventi **on-site** chiusi.
- Rilevamento legacy `SAAS-PR*` + warning interno; rimozione del tier `premium` dall'output.
- Classificazione impianto (Critico/Strategico/Standard) e fascicolo tecnico.

**Priorità:**
1. `computeSupportTierForProgetto` + aggregatore (base di tutto).
2. Campo `premium_client` (+ flag garanzia) e derivazione.
3. Vista impianti L1/L2 in Area Cliente.
4. Ticket guidati con tier per-progetto.
5. SLA/interventi configurabili + residui.
6. Alert per-tier.
7. Bonifica legacy (con SQL approvata).

---

## 9. Punti ancora da validare

1. Precedenza `saas_contratti` vs `checklists.saas_piano` in caso di conflitto (proposta: contratto formale prevale).
2. Come legare `saas_contratti` al progetto (project-scoping).
3. Default SLA/interventi per livello (matrice ancora da fissare).
4. Nome/struttura definitivi del flag `premium_client_incluso_garanzia` (booleano singolo vs lista programmi).
5. Significato e correzione di `SAAS_SCHERMO`.
6. Se la classificazione impianto entra nel calcolo SLA.
7. Esporre o meno gli interventi residui al cliente (oggi proposta: sì).
