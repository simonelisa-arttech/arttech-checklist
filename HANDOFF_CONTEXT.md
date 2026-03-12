# Handoff Context — AT SYSTEM (arttech-checklist)

## Aggiornamento rapido (11 marzo 2026)

- Handoff riallineato prima dei prossimi sviluppi.
- Nuovo endpoint read-only aggregato scadenze: `GET /api/scadenze`
  - builder server-side: `lib/scadenze/buildScadenzeAgenda.ts`
  - fonti aggregate: `rinnovi_servizi`, `tagliandi`, `licenses`, `checklists`, `saas_contratti`
  - filtri supportati: `from`, `to`, `cliente`, `cliente_id`, `checklist_id`, `tipo`, `stato`
  - nessuna UI `/scadenze` ancora implementata in questo step
- Checklist operative:
  - la sync strutturale `checklist_task_templates -> checklist_tasks` resta area fragile
  - il recovery globale batch e' stato disabilitato perche non idempotente sul dataset sporco
  - usare solo recovery mirato per checklist esplicite
- Recovery checklist singola da usare in caso di doppioni:
  - `GET /api/impostazioni/checklist-attivita?recovery=1&checklist_id=<UUID>`
  - supporta anche lista stabile:
    - `GET /api/impostazioni/checklist-attivita?recovery=1&checklist_ids=<UUID1>,<UUID2>`
- Endpoint utili:
  - `GET /api/impostazioni/checklist-attivita`
  - `GET /api/impostazioni/checklist-attivita?recovery=1&checklist_id=<UUID>`
  - `POST /api/checklists/materialize-tasks`
  - `GET|POST|PATCH /api/clienti`
- Problemi ancora aperti:
  - validare manualmente il cleanup reale delle checklist gia sporcate da recovery precedenti
  - evitare qualsiasi recovery globale non basato su checklist esplicite
- Convenzioni operative per i prossimi sviluppi:
  - nessun recovery checklist globale senza lista stabile di `checklist_id`
  - la sync task puo aggiornare solo campi strutturali: `titolo`, `sezione`, `ordine`, `target`, `task_template_id`
  - non toccare da sync: `stato`, note, allegati, log, override notifiche
  - il link Drive cliente vive su `clienti_anagrafica.drive_url` ed e' separato dal link magazzino checklist/progetto

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
  - fix ulteriore sul backfill task template:
    - i task legacy senza `task_template_id` vengono riconosciuti per `titolo + sezione + ordine` e riallineati al template senza duplicazione
    - aggiunto recovery retroattivo mirato per la task ordine `75` `schemi dati ed elettrici + Pixel Map`
- Checklist:
  - aggiunta migration `scripts/20260310_enforce_checklists_cliente_nome_unique.sql`
  - deduplica storica per `(cliente_id, nome_checklist)` mantenendo la checklist piu recente invariata
  - le checklist duplicate piu vecchie vengono rinominate con suffisso `[DUPLICATO <id>]`
  - aggiunto vincolo DB `UNIQUE(cliente_id, nome_checklist)`
  - UI create checklist/progetto intercetta `23505` e mostra messaggio chiaro sul duplicato

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

## Update 2026-03-11 - Checklist operativa: sync template centralizzato

- Aggiunto servizio server `lib/checklist/syncChecklistTemplate.ts` come punto unico per:
  - `materializeChecklistTasks(checklistId)`
  - `syncChecklistTemplate(templateId)`
  - `syncAllChecklistTemplates()`
- Source of truth consolidata:
  - template strutturale: `checklist_task_templates`
  - task materializzate progetto: `checklist_tasks`
  - dati operativi preservati: stato, note, allegati, log, override notifiche
- La sync aggiorna solo campi strutturali (`task_template_id`, `sezione`, `ordine`, `titolo`, `target`) e non sovrascrive dati operativi.
- Le task template disattivate non vengono cancellate dalle checklist esistenti: le righe progetto vengono preservate per non perdere storico e allegati.
- La creazione nuova checklist/progetto ora materializza le task via route unica `POST /api/checklists/materialize-tasks`, senza logiche duplicate sparse.
- Fix `notification_rules`: il salvataggio ora riallinea il write alla chiave unica legacy reale `(task_title, target)` se presente in produzione e aggiorna la riga esistente invece di creare duplicati.

## Update 2026-03-11 - Recovery retroattivo checklist operative esistenti

- Causa del mancato riallineamento: il sync template -> checklist partiva solo su:
  - creazione/modifica del template
  - creazione nuova checklist
- Le checklist gia esistenti prima del refactor non avevano quindi nessuna code path che eseguisse il recovery globale delle task attive correnti.
- La route `GET /api/impostazioni/checklist-attivita` ora esegue `syncAllChecklistTemplates()` prima di restituire il template.
- Effetto:
  - checklist esistenti vengono riallineate retroattivamente al template attivo
  - checklist nuove continuano a essere materializzate via `materializeChecklistTasks(checklistId)`
- La sync resta non distruttiva sui dati operativi: non sovrascrive stato, note, allegati, log o override notifiche.

## Update 2026-03-11 - Sync checklist_tasks: recovery non bloccante e dedupe reale

- Il recovery globale non gira piu sul semplice `GET` bloccante di `Checklist attivita`.
- La pagina `app/impostazioni/checklist-attivita/page.tsx` carica subito i template e avvia il recovery retroattivo in background con `?recovery=1`.
- La route server deduplica il recovery con cooldown di 5 minuti per evitare lavoro pesante a ogni apertura pagina.
- `lib/checklist/syncChecklistTemplate.ts` ora riconcilia per checklist con questo criterio:
  - match principale: `task_template_id`
  - fallback legacy: titolo normalizzato / overlap titolo, con riallineamento finale di `titolo`, `sezione`, `ordine`, `target`
- Risolti i casi reali:
  - `Elettronica di controllo: schemi dati ed elettrici` viene riallineata al titolo template `Elettronica di controllo`
  - `Preparazione / riserva disponibilita / ordine merce` viene mantenuta come singola riga e spostata alla posizione template corretta (`DOCUMENTI`, ordine `74`)
- Se esistono doppioni della stessa task template, la sync tiene una sola riga canonica, migra allegati/documenti/commenti/meta/job collegati e cancella il duplicato.
- Dati operativi preservati: `stato`, note, allegati, log, override notifiche.

## Update 2026-03-11 - Cleanup finale alias legacy checklist operative

- Il cleanup precedente non eliminava tutti i doppioni perche escludeva dal fallback legacy le righe che avevano gia un `task_template_id` errato o storico.
- La riconciliazione ora gestisce alias espliciti:
  - `Elettronica di controllo: schemi dati ed elettrici` -> `Elettronica di controllo`
  - `Preparazione / riserva disponibilita / ordine merce` -> task canonica template (ora `DOCUMENTI`, ordine `74`)
- Il merge dati tra riga canonica e duplicato ora conserva anche:
  - `stato` piu avanzato
  - `note` della task
  - allegati, documenti task, commenti, meta e notification jobs
- Dopo il merge, la riga duplicata viene eliminata.

## Update 2026-03-11 - Recovery checklist-attivita invocabile manualmente

- Il `Bad Request` sul recovery globale era causato dal volume eccessivo delle query `IN (...)` durante `syncAllChecklistTemplates()`.
- Il servizio ora elabora:
  - `taskIds` in chunk da `250`
  - `checklistIds` in chunk da `100`
- Il recovery globale e' ora batch-based per invocation:
  - `GET /api/impostazioni/checklist-attivita?recovery=1&offset=0&limit=25`
  - risposta con `processed`, `remaining`, `nextOffset`
- Il page load normale di `Checklist attivita` non lancia piu recovery impliciti in background.

## Update 2026-03-11 - Recovery globale messo in sicurezza

- Il recovery batch per offset e' stato disabilitato: non era affidabile e ha peggiorato il dataset `checklist_tasks`.
- Causa sospetta confermata a livello operativo:
  - run ripetibili sullo stesso insieme di checklist
  - convergenza non garantita con recovery globale paginato
- L'endpoint recovery ora accetta solo checklist esplicite e stabili:
  - `GET /api/impostazioni/checklist-attivita?recovery=1&checklist_id=<uuid>`
  - `GET /api/impostazioni/checklist-attivita?recovery=1&checklist_ids=<uuid1>,<uuid2>,<uuid3>`
- La bonifica va eseguita per liste stabili di `checklist_id`, cosi ogni checklist viene processata una sola volta per run.
