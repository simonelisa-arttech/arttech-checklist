# Handoff Context — AT SYSTEM (arttech-checklist)

## Repository
GitHub: `simonelisa-arttech/arttech-checklist`
Stack: Next.js App Router, Supabase (Postgres), Vercel, Resend (email)
File sorgente di verità: `PROJECT_CONTEXT.md` (root del repo)

---

## Aggiornamento rapido (3 marzo 2026)

- `fix: cronoprogramma` già pushato con commit `c06234b`:
  - `app/api/cronoprogramma/route.ts` filtra lato API i row refs per stato/data (`IN_CORSO`, `APERTO`, cutoff `2026-01-01`) prima di leggere meta/commenti.
- Patch client aggiuntiva in corso su `app/cronoprogramma/page.tsx` per coerenza eventi timeline/export:
  - query `checklists` con `.eq("stato_progetto", "IN_CORSO")`
  - query `saas_interventi` con `.eq("stato_intervento", "APERTO")` + cutoff `2026-01-01`
  - filtro difensivo installazioni su `(data_tassativa || data_prevista) >= 2026-01-01`
  - esclusione interventi collegati a checklist non presenti nel set `IN_CORSO`.
- Aggiornamento stato progetto e cronoprogramma noleggi:
  - aggiunto valore `RIENTRATO` nei menu stato progetto (`checklists/[id]`, `checklists/nuova`) e nei filtri dashboard.
  - cronoprogramma: i progetti `IN_CORSO` restano visibili; per i noleggi `CONSEGNATO` viene mostrato un evento su `fine_noleggio`; con stato `RIENTRATO` il progetto non viene più mostrato.

## Aggiornamento rapido (10 marzo 2026)

- Pass unico su popup/rule/log del blocco `Scadenze & Rinnovi`.
- Source of truth:
  - stato riga: `rinnovi_servizi` per workflow rinnovi e `licenses` per le licenze
  - regole automatiche: nuova tabella `renewal_alert_rules`
  - log avvisi: `checklist_alert_log`
- Cliente e checklist ora usano lo stesso popup condiviso `components/RenewalsAlertModal.tsx`.
- Modalità `MANUALE`:
  - destinatario scelto nel popup
  - subject e messaggio modificabili
  - log salvato su `checklist_alert_log`
  - stato portato a `AVVISATO` dove previsto
- Modalità `AUTOMATICO`:
  - non chiede destinatario runtime
  - mostra e salva una regola per `cliente + stage`
  - supporta preset `90/60/30/15/7/3/1`, destinatario cliente/Art Tech/entrambi, stop `AT_EXPIRY` / `AFTER_FIRST_SEND` / `ON_STATUS`
- `app/api/cron/rinnovi-stage1/route.ts` legge `renewal_alert_rules`, logga `trigger: AUTOMATICO` e aggiorna `rinnovi_servizi.stato = AVVISATO`.
- `app/avvisi/AvvisiClient.tsx` mostra anche `destinatario`/regola salvata nel log; le licenze arrivano con riferimento reale e non più con etichetta generica fissa nel popup condiviso.

- Checklist operativa:
  - aggiunta colonna `Note` per i task in `app/checklists/[id]/page.tsx`
  - source di persistenza riusata: `cronoprogramma_comments` con `row_kind = 'CHECKLIST_TASK'`
  - vista compatta: ultima nota in tabella
  - storico completo + inserimento nuova nota da modale dedicata
  - creazione nuova task template in `Impostazioni > Checklist attività` ora esegue backfill su tutte le checklist esistenti:
    - inserisce una `checklist_task` per ogni checklist che non ha già quella `task_template_id`
    - conserva `sezione` / `ordine`
    - imposta `stato = DA_FARE`
    - non modifica le task già presenti

---

## Cosa è stato fatto (sessione 12 febbraio 2026)

### Commit già pushati in precedenza (7 commit)
1. `b4050b5` — **fix: rimuovi filtro EXTRA per stage2 tagliandi** — In `getRinnoviStageList` c'era un filtro che escludeva le righe con `item_tipo` diverso da SAAS standard dallo stage2. Rimosso.
2. `0faac18` — **feat: renewal default rules by tipo** — Aggiunta mappa `RENEWAL_DEFAULTS_MONTHS` (LICENZA:12, TAGLIANDO:12, SAAS:12, GARANZIA:24, SAAS_ULTRA:12). Le funzioni `suggestNextScadenza` e `promptNextScadenza` ora accettano il parametro `tipo` e usano la mappa.
3. `185cf97` — **fix: allinea email mittente a EMAIL_FROM env** — In `app/api/send-alert/route.ts`, l'email mittente era hardcoded. Ora usa `process.env.EMAIL_FROM`.
4. `bde234c` — **feat: schedulare cron** — Aggiunti 2 cron job in `vercel.json`: `/api/cron/checklist-reminders` (09:00 UTC) e `/api/cron/reminders` (08:50 UTC).
5. `f963c5e` — **fix: optimistic state update** — Dopo `markWorkflowConfermato` e `markWorkflowNonRinnovato` per SAAS/GARANZIA/SAAS_ULTRA, aggiunto `setRinnovi(prev => prev.map(...))` per aggiornamento UI immediato.
6. `90c4a8f` — **fix: dashboard horizontal scroll** — Scrollbar sticky sempre visibile, CSS in `globals.css`.
7. `4f34bd8` — **feat: add impianto indirizzo field** (fatto da Codex separatamente).

### Commit locali da pushare (4 commit — NON ANCORA IN PRODUZIONE)
8. `7a3a151` — **feat: duplicate project from dashboard**
   - File: `app/page.tsx`
   - Aggiunto bottone "Duplica" prima di "Elimina" in ogni riga progetto
   - Modal con input "Nuovo nome progetto" (default: "COPIA - <nome attuale>")
   - Funzione `duplicateChecklist()`: copia campi progetto/impianto, BOM (`checklist_items`), task (`checklist_tasks` resettate a DA_FARE). NON copia: seriali, licenze, SaaS, tagliandi, garanzie, log avvisi
   - Toast "✅ Progetto duplicato" + redirect a `/checklists/<newId>`
   - Colonna Azioni allargata da 110 a 200px

9. `123e2ed` — **fix: add subtipo column migration**
   - File: `scripts/20260212_add_rinnovi_servizi_subtipo.sql`
   - File: `app/clienti/[cliente]/page.tsx`
   - La colonna `subtipo` in `rinnovi_servizi` è necessaria per distinguere SAAS / SAAS_ULTRA (subtipo='ULTRA') / GARANZIA
   - La migrazione è stata già eseguita manualmente su Supabase SQL Editor
   - Nel codice: `ensureRinnovoForItem` include `subtipo` nel payload solo quando non è null

10. `955f901` — **fix: aggiorna stato AVVISATO dopo invio alert per SAAS/GARANZIA**
    - File: `app/clienti/[cliente]/page.tsx`, funzione `sendRinnoviAlert()`
    - BUG: dopo l'invio di un alert, il codice aggiornava lo stato solo per righe con `source === "rinnovi"` o `"licenze"`. Le righe SAAS (`source: "saas"`), SAAS_ULTRA (`source: "saas_contratto"`), GARANZIA (`source: "garanzie"`) venivano ignorate.
    - FIX: aggiunto blocco che per ogni riga con source saas/saas_contratto/garanzie chiama `ensureRinnovoForItem(r)` per creare il record `rinnovi_servizi` se non esiste, poi `updateRinnovo(rinnovo.id, { stato: "AVVISATO", ... })`.

11. `fb17ac2` — **fix: GARANZIA usa item_tipo proprio invece di SAAS+subtipo**
    - File: `app/clienti/[cliente]/page.tsx`
    - BUG: `mapRinnovoTipo("GARANZIA")` restituiva `{ item_tipo: "SAAS", subtipo: "GARANZIA" }` che violava il check constraint `rinnovi_servizi_item_tipo_check`.
    - FIX: ora restituisce `{ item_tipo: "GARANZIA", subtipo: null }`.
    - Semplificato `getRinnovoMatch` per GARANZIA: cerca solo `item_tipo === "GARANZIA"` + `checklist_id` match.
    - Semplificato filtro SAAS: non serve più escludere "GARANZIA" da subtipo.

---

## Bug attualmente aperti (da verificare dopo il deploy dei 4 commit)

### 1. Stato resta DA_AVVISARE dopo "Invia avviso" su righe SAAS
- **Causa**: il commit `955f901` risolve questo — il codice precedente non gestiva l'aggiornamento stato per source saas/saas_contratto/garanzie.
- **Stato**: fix committato ma non ancora deployato.

### 2. Errore "violates check constraint rinnovi_servizi_item_tipo_check" su NON_RINNOVATO per GARANZIA
- **Causa**: il commit `fb17ac2` risolve questo — GARANZIA veniva mappato a `item_tipo: "SAAS"` che il DB non accetta.
- **Stato**: fix committato ma non ancora deployato.

---

## Architettura chiave — Scadenze & Rinnovi

### Fonti dati (`rinnoviAll` è un `useMemo` che merge 6 fonti):
| Source | Origine dati | item_tipo |
|---|---|---|
| `"rinnovi"` | tabella `rinnovi_servizi` | RINNOVO, SAAS, LICENZA, TAGLIANDO |
| `"tagliandi"` | tabella `tagliandi` | TAGLIANDO |
| `"licenze"` | tabella `licenze` (via API) | LICENZA |
| `"saas"` | campo `saas_*` in `checklists` | SAAS |
| `"saas_contratto"` | tabella `saas_contratti` | SAAS_ULTRA |
| `"garanzie"` | campo `garanzia_*` in `checklists` | GARANZIA |

### Workflow stati:
DA_AVVISARE → AVVISATO → CONFERMATO → DA_FATTURARE → FATTURATO

### `getWorkflowStato(r)`:
- Per SAAS/GARANZIA/SAAS_ULTRA: cerca match in `rinnovi_servizi` via `getRinnovoMatch()`, restituisce `match.stato` oppure "DA_AVVISARE" se non c'è match.
- Per altri tipi: usa `r.stato` direttamente.

### `ensureRinnovoForItem(r)`:
- Cerca match esistente con `getRinnovoMatch(r)`
- Se non esiste, crea nuovo record in `rinnovi_servizi` con `stato: DA_AVVISARE`
- Usato prima di aggiornare lo stato (AVVISATO, CONFERMATO, NON_RINNOVATO, etc.)

### `mapRinnovoTipo(tipo)`:
- SAAS → `{ item_tipo: "SAAS", subtipo: null }`
- SAAS_ULTRA → `{ item_tipo: "SAAS", subtipo: "ULTRA" }`
- GARANZIA → `{ item_tipo: "GARANZIA", subtipo: null }` ← CORRETTO nel commit fb17ac2
- Altri → `{ item_tipo: <tipo>, subtipo: null }`

### Check constraint DB:
- `rinnovi_servizi_item_tipo_check` — vincola i valori ammessi per `item_tipo`
- I valori ammessi includono almeno: LICENZA, TAGLIANDO, SAAS, RINNOVO, GARANZIA
- Per SAAS_ULTRA: `item_tipo: "SAAS"` + `subtipo: "ULTRA"` (la colonna `subtipo` è stata aggiunta il 12/02/2026)

---

## File principali

| File | Righe circa | Descrizione |
|---|---|---|
| `app/clienti/[cliente]/page.tsx` | ~7500 | Pagina cliente con blocco Scadenze & Rinnovi |
| `app/page.tsx` | ~2380 | Dashboard con tabella progetti, filtri, bottone Duplica |
| `app/api/send-alert/route.ts` | ~200 | API invio alert email via Resend |
| `app/api/cron/reminders/route.ts` | ~150 | Cron reminders licenze/tagliandi a 60/30/15gg |
| `app/api/cron/checklist-reminders/route.ts` | ~100 | Cron task reminders da notification_jobs |
| `app/avvisi/AvvisiClient.tsx` | ~700 | Storico avvisi con filtri e colonna Progetto |
| `lib/sendAlert.ts` | ~30 | Client wrapper per /api/send-alert |
| `lib/email.ts` | ~50 | Invio email diretto via Resend |
| `components/Toast.tsx` | ~53 | Componente toast riutilizzabile |
| `vercel.json` | ~20 | Config Vercel con cron jobs |
| `PROJECT_CONTEXT.md` | ~140 | Fonte di verità del progetto |

---

## Azione immediata richiesta

I 4 commit locali devono essere pushati:
```bash
git pull origin main && git push origin main
```

Dopo il push, Vercel farà auto-deploy e i fix saranno in produzione.

---

## Update 2026-03-10 - InterventiBlock condiviso cliente/checklist

- Estratto `components/InterventiBlock.tsx` prendendo `app/clienti/[cliente]/page.tsx` come source of truth del blocco Interventi.
- `app/checklists/[id]/page.tsx` ora usa lo stesso componente condiviso, filtrando i dati solo su `checklist_id = id`.
- Uniformati markup/UI/overflow/azioni/pulsanti del blocco Interventi tra cliente e checklist.
- Checklist ora supporta anche:
  - chiusura/riapertura intervento
  - alert fatturazione singolo e bulk
  - allegati e link Drive nello stesso flow del componente condiviso
- Create/edit allegati/link:
  - create: upload file selezionati dopo insert intervento, poi apertura automatica del dettaglio/edit per aggiungere link/altri allegati
  - edit: `AttachmentsPanel` inline nello stesso flow del form modifica
