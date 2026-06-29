# Roadmap — Web App Operatori (ATSYSTEM)

**Stato:** documento di progetto · **Creato:** 2026-06-17 · **Owner:** Art Tech S.r.l. (Simone)
**Ambito:** route `/operatori` e sua integrazione con cronoprogramma, fascicolo tecnico, Area Cliente, Assistenza.
**Regola applicata:** vedi `docs/SYSTEM_SOURCE_OF_TRUTH.md` e `docs/architecture/GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`.

> Principio guida: la Web App Operatori non è un modulo isolato. È un anello della catena del dato
> aziendale. Va progettata come tale **prima** di correggere bug puntuali.

---

## 0. Visione e catena di integrazione

La pipeline naturale del dato operativo in ATSYSTEM:

```
Cronoprogramma  →  Operatore  →  Timbratura  →  Foto  →  Verbale
        →  Fascicolo Tecnico  →  Area Cliente  →  Assistenza
```

- **Cronoprogramma** genera e assegna l'attività all'operatore (slot + `personale_ids`).
- **Operatore** riceve, prende in carico, esegue.
- **Timbratura** misura tempo reale (inizio/pausa/fine) e presenza.
- **Foto** documentano installazione/collaudo on-site.
- **Verbale** struttura l'esito (collaudo, problemi, materiali, firma).
- **Fascicolo Tecnico** consolida documenti/foto/verbali per progetto/impianto.
- **Area Cliente** espone al cliente ciò che gli operatori autorizzati decidono.
- **Assistenza** riusa lo stesso flusso per interventi/ticket e ne misura gli SLA.

Le 4 fasi della roadmap costruiscono progressivamente questa catena.

---

## 1. Stato attuale (sintesi, verificato su codice e DB prod `aaiuyaiwdrecyqjgnjxp`)

- App standalone mobile in `app/operatori/page.tsx`; backend multi-azione `app/api/cronoprogramma/route.ts`; auth `app/api/me-operatore/route.ts`.
- **In uso in produzione**: 39 timbrature registrate (stati presenti: `IN_CORSO`, `COMPLETATA`).
- Assegnazione operatore via `cronoprogramma_meta_slots.personale_ids`, filtrata lato operatore.
- Timbratura start/stop funzionante; **pausa/ripresa rotta in prod** (constraint `cronoprogramma_timbrature.stato` non include `IN_PAUSA` — fix rimandato per scelta).
- Confronto tempo stimato vs reale già presente a livello di singola attività.
- Indirizzo solo testuale; nessuna geolocalizzazione; foto/allegati read-only dall'app operatori.

---

## FASE 1 — Attività assegnate e notifiche

**Funzionalità esistenti**
- Assegnazione: l'admin imposta `personale_ids` sullo slot (`components/cronoprogramma/CronoprogrammaPanel.tsx`).
- L'app operatori carica la timeline (`POST /api/cronoprogramma load_events`/`load`) e mostra solo le attività dell'operatore loggato, raggruppate per urgenza (In corso / Scadute / Oggi / Prossime).
- Auth + mapping automatico operatore→personale (`/api/me-operatore`, flag `can_access_operator_app`).

**Gap**
- Nessuna notifica all'assegnazione (no email, no push, no in-app): l'app è "pull", l'operatore deve aprirla.
- Nessun badge "nuova/non letta", nessuna data di assegnazione, nessun "presa in carico/acknowledgment".
- Mostra solo attività in stato `CONFERMATA`/`RIMANDATA`: se l'admin assegna senza confermare, l'operatore non vede nulla.
- Robustezza del mapping operatore→personale: se non risolto, l'app è inutilizzabile per quell'utente.

**Dipendenze tecniche**
- Resend (già integrato, `lib/email.ts`) per email transazionali.
- Opzionale: Web Push + PWA (service worker) per notifiche su mobile; Supabase Realtime per aggiornamento live in-app.
- Consolidamento del mapping operatore→personale.

**Tabelle coinvolte**
- `cronoprogramma_meta_slots` (`personale_ids`, stato slot), `cronoprogramma_meta`, `operatori`, `personale`.
- Nuova (proposta): `cronoprogramma_assegnazioni_letture` o campi `assegnato_at`/`letto_at`/`preso_in_carico_at` per tracciare ricezione e presa in carico.

**Impatto gestionale**: l'admin vede chi ha ricevuto/preso in carico; meno telefonate; pianificazione più affidabile.
**Impatto area cliente**: indiretto (puntualità). Nessuno diretto in questa fase.
**Impatto assistenza**: la stessa pipeline di assegnazione→operatore servirà ai ticket/interventi di assistenza.
**Priorità**: ALTA (è il primo anello; sblocca l'uso reale dell'app).
**Complessità**: MEDIA (email semplice; push/PWA e realtime alzano la complessità).

---

## FASE 2 — Check-in impianto e geolocalizzazione

**Funzionalità esistenti**
- Indirizzo dell'impianto/slot mostrato come testo (`page.tsx`, campo `indirizzo`).
- Check-in temporale già coperto dallo start timbratura.

**Gap**
- Indirizzo non cliccabile: nessun link "Naviga" verso Google/Apple Maps.
- Nessuna cattura GPS dell'operatore, nessun "sono sul posto" (geofence), nessuna coordinata salvata.
- Nessuna lat/long in DB.

**Dipendenze tecniche**
- `navigator.geolocation` (richiede HTTPS — già ok) e gestione permessi (PWA consigliata).
- URL scheme mappe (`https://www.google.com/maps/dir/?...`, `geo:`, Apple Maps).
- Geocoding indirizzo→coordinate (servizio esterno) **oppure** coordinate salvate a monte sull'impianto.
- Gestione privacy del dato GPS (consenso, minimizzazione).

**Tabelle coinvolte**
- `cronoprogramma_meta_slots` (indirizzo; aggiungere lat/long), `cronoprogramma_timbrature` (aggiungere lat/long del check-in), eventualmente `checklist_impianti` per coordinate persistenti dell'impianto.

**Impatto gestionale**: tracciabilità presenza on-site, dato per audit e per analytics di Fase 4.
**Impatto area cliente**: abilita in futuro la prova "operatore on-site/arrivato" nel fascicolo.
**Impatto assistenza**: per interventi, conferma on-site utile agli SLA (es. EVENTS "on-site entro 1h").
**Priorità**: MEDIA-ALTA (il link mappa è un quick win ad alto valore; GPS/geofence è incrementale).
**Complessità**: MEDIA (link mappa = bassa; GPS + geocoding + geofence + privacy = medio-alta).

---

## FASE 3 — Prova impianto e report operatore

**Funzionalità esistenti**
- Report di chiusura alla fine della timbratura (esito/problemi/materiali/note) salvato come commento JSON `__REPORT__:` (`stop_timbratura`).
- Allegati giornata visibili in sola lettura (`components/AttachmentsPanel.tsx`); meccanismo allegati moderno su tabella `attachments` (`entity_type = CHECKLIST_TASK`).
- Tabella `checklist_task_documents` ora esistente in prod (creata 2026-06-17).

**Gap**
- "Prova impianti" strutturata (collaudo: accensione, parametri, checklist di test) assente.
- Foto/video **non caricabili dall'app operatori** (oggi read-only): manca l'upload dal campo.
- Nessun verbale strutturato / PDF generato; nessuna firma cliente on-site.
- Collegamento esplicito report+foto → **fascicolo tecnico** non formalizzato.

**Dipendenze tecniche**
- Supabase Storage (presente) + rendere `AttachmentsPanel` scrivibile dall'app operatori.
- Generazione PDF del verbale.
- `checklist_task_documents` / `attachments` come storage strutturato; eventuale firma (canvas/touch).
- Dipende da Fase 1 (attività in carico) e Fase 2 (contesto on-site/foto geolocalizzate).

**Tabelle coinvolte**
- `attachments`, `checklist_task_documents`, `checklist_tasks`, `cronoprogramma_comments` (report), `checklist_documents` (fascicolo).
- Nuova (proposta): `verbali_intervento` / `collaudi` per esiti strutturati e firmati.

**Impatto gestionale**: verbale strutturato, foto di collaudo legate al progetto, storico completo.
**Impatto area cliente**: **è il cuore della catena Foto→Verbale→Fascicolo→Area Cliente**: verbali e foto confluiscono nel fascicolo cliente e diventano consultabili (secondo le regole di visibilità decise dagli operatori).
**Impatto assistenza**: il report intervento alimenta lo storico assistenza e i futuri ticket.
**Priorità**: ALTA per valore verso il cliente, ma **dipendente** da Fase 1 e 2.
**Complessità**: ALTA (upload, PDF, firma, modello dati verbali, integrazione fascicolo).

---

## FASE 4 — Analytics tempi previsti vs reali

**Funzionalità esistenti**
- Per singola attività: stimato vs reale, delta (Risparmio/Ritardo/In linea), badge semaforo (In linea/Fuori stima/Molto fuori).
- Totale mensile lavorato per operatore nel cruscotto.
- Sorgenti: `getOperativiEstimatedMinutes` (stimato) e `durata_effettiva_minuti` (reale, somma intervalli).

**Gap**
- Nessuna aggregazione a livello di **progetto/blocco multi-giorno e multi-operatore**.
- Nessuna dashboard KPI (efficienza, scostamenti, trend storico), nessun export, nessun confronto con il preventivato di progetto.

**Dipendenze tecniche**
- Dati timbrature affidabili e completi (richiede il fix `IN_PAUSA` e le Fasi 1-3 a regime).
- Eventuale vista/materialized view DB per aggregazioni; libreria grafici lato UI.

**Tabelle coinvolte**
- `cronoprogramma_timbrature`, `cronoprogramma_timbrature_intervalli`, `cronoprogramma_meta_slots` (stimato), tabelle progetto/`checklists`.

**Impatto gestionale**: KPI reali, costo del lavoro, base per preventivazione futura.
**Impatto area cliente**: nessuno diretto (analitica interna).
**Impatto assistenza**: misura dei tempi di intervento vs SLA dei piani (PLUS/PREMIUM/ULTRA/EVENTS).
**Priorità**: MEDIA (analitico, ha senso quando i dati a monte sono completi e puliti).
**Complessità**: MEDIA (aggregazioni + UI; nessun flusso esterno complesso).

---

## Prerequisito trasversale (quick win, schedulato ma NON ancora applicato)

- **Fix `IN_PAUSA`**: il constraint `cronoprogramma_timbrature.stato` in prod ammette solo
  `NON_INIZIATA/IN_CORSO/COMPLETATA`, ma il codice scrive `IN_PAUSA` (route.ts) → la pausa fallisce.
  È un `ALTER` additivo a basso rischio. È prerequisito per dati timbratura puliti (Fase 4) e per una
  timbratura pienamente funzionante (Fase 1/B). Da applicare con conferma, fuori da questa roadmap.

---

## Matrice di sintesi

| Fase | Tema | Priorità | Complessità | Dipende da | Anello catena coperto |
|---|---|---|---|---|---|
| 1 | Attività assegnate + notifiche | ALTA | Media | mapping op.→pers., Resend | Cronoprogramma→Operatore |
| 2 | Check-in + geolocalizzazione | Media-Alta | Media | GPS/PWA, geocoding | Operatore→Timbratura(on-site) |
| 3 | Prova impianto + report/verbale | ALTA (post 1,2) | Alta | Storage, PDF, attachments | Foto→Verbale→Fascicolo→Area Cliente |
| 4 | Analytics tempi | Media | Media | dati Fasi 1-3, fix IN_PAUSA | misura SLA → Assistenza |

**Sequenza consigliata:** prerequisito `IN_PAUSA` → Fase 1 → Fase 2 (partendo dal link mappa) → Fase 3 → Fase 4.

---

## Integrazione con il resto di ATSYSTEM

- **Cronoprogramma**: già la sorgente delle attività (`cronoprogramma_meta_slots`); le Fasi 1-2 ne estendono ricezione e contesto on-site.
- **Fascicolo Tecnico**: destinazione naturale di foto/verbali della Fase 3 (`attachments`, `checklist_task_documents`, `checklist_documents`).
- **Area Cliente**: oggi legge `attachments`+`checklist_tasks` (`app/api/cliente/documenti/route.ts`); la Fase 3 alimenta ciò che il cliente vedrà, nel rispetto delle regole di visibilità decise dagli operatori.
- **Assistenza**: la stessa pipeline (assegnazione→timbratura→report) si applica agli interventi; la Fase 4 ne misura i tempi rispetto agli SLA dei piani.

Ogni fase, in fase di implementazione, dovrà includere il report d'impatto a 10 punti
(`GESTIONALE_AREA_CLIENTE_ALIGNMENT.md`) e aggiornare l'handoff.
