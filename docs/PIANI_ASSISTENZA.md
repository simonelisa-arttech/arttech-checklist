# Piani di Assistenza Art Tech — Differenze di Gestione

> ⚠️ **BOZZA DA VALIDARE.** Questo documento descrive la gestione operativa dei livelli di
> assistenza così come è oggi implementata nel codice (`lib/supportTier.ts`,
> `components/ClienteAssistenzaSection.tsx`, `app/api/cliente/assistenza/route.ts`) e nei testi
> dell'area cliente. I valori commerciali contrassegnati con **[DA VALIDARE]** vanno confermati
> rispetto al documento ufficiale "Pacchetti SAAS Art Tech" prima di diventare fonte di verità.
> Una volta validato, questo file integra `PROJECT_CONTEXT.md` per la parte assistenza.

Ultimo aggiornamento bozza: 2026-06-15

---

## 1. Principio architetturale

La copertura assistenza è una proprietà del **PROGETTO**, non del cliente.

- **Progetto** = contenitore commerciale/contrattuale. È qui che vive il piano attivo e la sua scadenza.
- **Impianto** = unità tecnica appartenente al progetto. Eredita la copertura del progetto.
- **Cliente** = aggregatore. Può avere più progetti con coperture diverse nello stesso anno.

Gerarchia della source of truth (corretta):

```
Cliente
  └── Progetti
        └── Contratto/Piano
              └── Impianti
```

NON `Cliente → Piano unico`, perché non rappresenta la realtà operativa.

Esempio reale — Cliente **Geasar** (stesso cliente, progetti con piani diversi):

| Progetto | Piano |
|----------|-------|
| Transit Led Wall | Ultra |
| Totem Aeroporto | Plus |
| Ledwall Terminal | Garanzia |
| Monitor Info Point | Nessuna copertura |

Quando il cliente apre un ticket: (1) seleziona l'impianto, (2) oppure seleziona il progetto,
(3) il sistema determina automaticamente il piano applicabile.

Conseguenza operativa: **la determinazione di copertura, SLA, garanzia, interventi residui e
diritti di assistenza parte sempre dal progetto/impianto interessato dalla richiesta**, mai dal
cliente nel suo complesso. L'area cliente mostra una vista aggregata, ma il flusso di assistenza
si risolve sull'impianto selezionato.

---

## 2. I sei livelli di copertura

I livelli sono ordinati dal più alto al più basso. Nel codice il tipo è
`SupportTier = "expired" | "standard" | "plus" | "premium" | "ultra" | "events"`.

| Livello | Codice | Contatto diretto | Priorità | Interventi inclusi | SLA presa in carico |
|---------|--------|------------------|----------|--------------------|---------------------|
| **Eventi** | `events` | Sì (WhatsApp/referente H24) | Massima durante l'evento | On-site dedicato | On-site entro **1h** **[DA VALIDARE]** |
| **Ultra** | `ultra` | Sì (WhatsApp/referente H24) | Assoluta | **[DA VALIDARE]** (illimitati?) | **[DA VALIDARE]** |
| **Premium** | `premium` | Sì (WhatsApp/referente H24) | Alta | **[DA VALIDARE]** (n/anno) | **[DA VALIDARE]** 4/8/12/24/36h |
| **Plus** | `plus` | No | Standard | **[DA VALIDARE]** | **[DA VALIDARE]** |
| **Garanzia Standard** | `standard` | No | Standard | Coperti i difetti in garanzia | 1 giorno lavorativo (presa in carico) |
| **Scaduto / Nessuna copertura** | `expired` | No | Nessuna | Nessuno (a preventivo) | Offerta entro 1 giorno lavorativo |

> Nota SLA Premium: il codice cita una gamma "4/8/12/24/36h" come livelli di servizio Premium.
> Va chiarito **[DA VALIDARE]** se sono varianti di Premium o tempi diversi per gravità/orario.

---

## 3. Dettaglio per livello

### 3.1 Eventi (`events`)
Pacchetto dedicato a eventi/noleggi di breve durata **[DA VALIDARE: ≤ 7 giorni]**.

- Supporto on-site dedicato per la durata dell'evento, intervento rapido **[DA VALIDARE: entro 1h]**.
- Contatto diretto attivo (WhatsApp/referente).
- Gestione: il progetto è marcato come Eventi; alla scadenza dell'evento la copertura termina.

### 3.2 Ultra (`ultra`)
Top di gamma, **priorità assoluta**.

- Contatto diretto H24 (WhatsApp/referente tecnico dedicato).
- Interventi inclusi: **[DA VALIDARE]** (illimitati o tetto annuo).
- SLA di intervento: **[DA VALIDARE]**.
- Nel dominio rinnovi è modellato come `item_tipo = SAAS` + `subtipo = ULTRA` (mai `SAAS_ULTRA`).

### 3.3 Premium (`premium`)
Contratto con SLA garantiti.

- Contatto diretto (WhatsApp/referente).
- Interventi inclusi: **[DA VALIDARE]** numero/anno; al loro esaurimento gli ulteriori interventi sono **[DA VALIDARE: a pagamento?]**.
- SLA: **[DA VALIDARE]** (gamma citata 4/8/12/24/36h).

### 3.4 Plus (`plus`)
Contratto base SaaS.

- Nessun canale diretto: assistenza via ticket area cliente / canali standard.
- Interventi inclusi e SLA: **[DA VALIDARE]**.

### 3.5 Garanzia Standard (`standard`)
Nessun contratto SaaS attivo, ma **garanzia hardware ancora valida** sull'impianto.

- Copre i difetti rientranti nella garanzia. **[DA VALIDARE]**: durata garanzia (la home cita "Garanzia triennale"), cosa è escluso (usura, danni accidentali, manomissioni).
- Nessun canale diretto: assistenza via ticket.
- La garanzia **non si estende** per effetto degli interventi.

### 3.6 Scaduto / Nessuna copertura (`expired`)
Né contratto né garanzia attivi sull'impianto.

- Assistenza erogabile **a pagamento previo preventivo**.
- L'uscita del tecnico è **addebitata anche in caso di mancata riparazione** per cause non
  dipendenti da Art Tech.
- La risoluzione può richiedere più interventi in base alla disponibilità ricambi.
- In area cliente il cliente può comunque aprire la segnalazione e riceve un'offerta entro 1
  giorno lavorativo.

---

## 4. Come AT SYSTEM determina il piano (logica attuale)

Ordine di valutazione in `computeSupportTierForCliente` (oggi a livello cliente, **da portare a
livello progetto** — vedi piano tecnico):

1. **Contratti cliente-wide attivi** (`saas_contratti`, campo `piano_codice`): PLUS/PREMIUM/ULTRA/EVENTS.
2. **Rinnovi SAAS/RINNOVO attivi** sui progetti (`rinnovi_servizi`, ULTRA via `subtipo`).
3. **SaaS sulla checklist** (`checklists.saas_piano` / `saas_tipo`) con `saas_scadenza` attiva.
4. **Garanzia attiva** (`rinnovi_servizi` GARANZIA o `checklists.garanzia_scadenza`) → `standard`.
5. Altrimenti → `expired`.

Una data è "attiva" se `scadenza >= oggi` (fine giornata). Il contatto diretto
(WhatsApp/referente) è esposto solo per `premium`, `ultra`, `events`.

---

## 5. Comportamento area cliente e assistenza guidata

### Vista area cliente (target)
- **Livello 1 — "I tuoi impianti"**: elenco impianti del cliente.
- **Livello 2 — dettaglio impianto**: copertura attiva (es. SAAS Ultra), interventi inclusi
  (es. 6/12 utilizzati), scadenza (es. 31/12/2026), referente.

### Flusso "Richiedi assistenza"
Quando il cliente avvia la richiesta, AT SYSTEM conosce già: cliente, progetto, impianto, piano,
garanzia, interventi residui, SLA — e adatta il messaggio:

- **Ultra/Premium/Events**: «Hai diritto all'assistenza prioritaria. Intervento incluso nel
  contratto. Descrivi il problema.» + contatto diretto.
- **Plus**: assistenza inclusa secondo contratto, via ticket.
- **Standard (garanzia)**: presa in carico in garanzia, via ticket.
- **Expired/nessuna copertura**: «Impianto fuori garanzia. L'intervento potrebbe essere soggetto a
  preventivo. Vuoi procedere?»

I ticket vengono salvati su `assistenza_tickets` con il `tier` determinato e notificati allo staff
(nessuna email automatica al cliente).

---

## 6. Note di tutela (da mantenere nei testi pubblici)

- La garanzia **non si estende** per effetto degli interventi.
- Alcune risoluzioni possono richiedere **più interventi** in base alla disponibilità ricambi.
- Per impianti **fuori copertura**, l'uscita del tecnico è **addebitata** anche in caso di mancata
  riparazione per cause non dipendenti da Art Tech.
- Costi di analisi/diagnostica possono essere addebitati indipendentemente dall'esito **[DA VALIDARE]**.

---

## 7. Checklist dei punti DA VALIDARE

- [ ] Interventi inclusi/anno per Plus, Premium, Ultra (e se Ultra è illimitato).
- [ ] SLA esatti per ciascun livello (significato della gamma 4/8/12/24/36h).
- [ ] Durata e perimetro della garanzia standard (triennale? cosa esclude).
- [ ] Soglia di durata del pacchetto Eventi (≤ 7 giorni?) e SLA on-site (1h?).
- [ ] Politica di addebito per interventi extra-soglia su Premium/Plus.
- [ ] Addebito diagnostica per impianti fuori copertura.
