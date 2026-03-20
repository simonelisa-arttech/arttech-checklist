# AGENT MEMORY — Snapshot Operativo

## Snapshot 2026-03-20 - Warning conflitti risorse cronoprogramma
- Nuovo helper frontend:
  - `lib/operativiConflicts.ts`
- Regola conflitto:
  - due eventi sono in conflitto se i rispettivi intervalli operativi si sovrappongono
  - e condividono almeno una voce di `personale_previsto` oppure `mezzi`
- L'intervallo operativo continua a usare la source of truth multi-giorno:
  - `data_inizio`
  - `durata_giorni`
  - `data_fine` derivata
- `app/cronoprogramma/page.tsx`
  - calcola i conflitti lato frontend sui dati gia caricati
  - mostra un warning non bloccante su ogni riga in conflitto:
    - bordo rosso leggero
    - badge `Conflitto`
    - tooltip con dettaglio delle risorse coinvolte
- Regola operativa:
  - nessun blocco al salvataggio per ora
  - nessuna nuova API o tabella: solo evidenza visiva nel cronoprogramma

## Snapshot 2026-03-20 - Durata multi-giorno cronoprogramma
- `cronoprogramma_meta` resta la source of truth per i dati operativi di:
  - `INSTALLAZIONE`
  - `INTERVENTO`
  - `DISINSTALLAZIONE`
- Nuovi campi meta:
  - `data_inizio`
  - `durata_giorni`
- `data_fine` non viene salvata: e' sempre derivata da `data_inizio + durata_giorni - 1`
- Fallback compatibilita record vecchi:
  - se `data_inizio` manca -> usa la data evento esistente
  - se `durata_giorni` manca -> assume `1`
- UI aggiornate:
  - `app/checklists/[id]/page.tsx` blocchi operativi installazione/disinstallazione
  - `components/InterventiBlock.tsx` dati operativi intervento
  - `app/clienti/[cliente]/page.tsx` e `app/checklists/[id]/page.tsx` per create/edit intervento
- `app/cronoprogramma/page.tsx`
  - filtra le righe per sovrapposizione dell'intero periodo operativo
  - mostra `Data inizio`, `Data fine`, `Durata`
  - personale e mezzi restano quindi associati a tutta la durata operativa

## Snapshot 2026-03-19 - Interventi da chiudere aperti reali
- `app/api/interventi/da-chiudere/route.ts`
  - la pagina admin usa solo `saas_interventi`, non checklist/task generiche
  - regola aggiornata: `stato_intervento` e' la fonte primaria per decidere se un intervento e' ancora da chiudere
  - stati aperti inclusi:
    - `APERTO`
    - `DA_CHIUDERE`
    - `IN_CORSO`
    - `IN_LAVORAZIONE`
    - `PENDENTE`
    - `PROGRAMMATO`
  - stati finali esclusi:
    - `CHIUSO`
    - `COMPLETATO`
    - `CONCLUSO`
    - `ANNULLATO`
    - `FATTO`
    - `CONFERMATO`
  - `fatturazione_stato` va usato solo come fallback legacy se `stato_intervento` manca

## Snapshot 2026-03-19 - Dati operativi condivisi interventi
- Source of truth unica per i dati operativi intervento:
  - `cronoprogramma_meta` con `row_kind = INTERVENTO`
  - API riusata: `POST /api/cronoprogramma` con `load` e `set_operativi`
- Nuovo helper client-side:
  - `lib/interventoOperativi.ts`
  - espone `loadInterventoOperativi`, `saveInterventoOperativi`, `extractInterventoOperativi`, `EMPTY_INTERVENTO_OPERATIVI`
- `components/InterventiBlock.tsx`
  - il form intervento espone ora anche:
    - personale previsto / incarico
    - mezzi
    - descrizione attivita / note operative
    - indirizzo
    - orario
    - referente cliente + contatto
    - commerciale Art Tech + contatto
- `app/clienti/[cliente]/page.tsx` e `app/checklists/[id]/page.tsx`
  - precompilano i dati operativi in apertura modifica leggendo i meta `INTERVENTO`
  - in creazione e modifica salvano i dati sugli stessi meta del cronoprogramma
- Regola operativa:
  - non duplicare questi campi su nuove tabelle/colonne intervento se serve solo il dominio operativo
  - usare sempre i meta `INTERVENTO` del cronoprogramma come dato condiviso

## Snapshot 2026-03-19 - Cockpit dashboard overdue counts
- `app/page.tsx`
  - cockpit riallineato su 2 righe:
    - riga 1: `SCADENZE IN ARRIVO`, `FATTURE DA EMETTERE`
    - riga 2: `INTERVENTI DA CHIUDERE`, `INTERVENTI ENTRO 7 GIORNI`, `CONSEGNE ENTRO 7 GIORNI`, `SMONTAGGI NOLEGGI ENTRO 7 GIORNI`, `NOLEGGI ATTIVI`
  - aggiunti badge secondari per elementi `scaduti / in ritardo` su:
    - scadenze
    - interventi da chiudere
    - interventi entro 7 giorni
    - consegne entro 7 giorni
    - smontaggi noleggi entro 7 giorni
- Route estese senza breaking change:
  - `GET /api/interventi/entro-7-giorni?overdue=1`
  - `GET /api/consegne/entro-7-giorni?overdue=1`
  - `GET /api/noleggi/smontaggi-entro-7-giorni?overdue=1`
- Regola funzionale:
  - gli elementi con data nel passato restano visibili nel cockpit finche non entrano in uno stato finale del loro dominio

## Snapshot 2026-03-19 - Regole globali avvisi scadenze
- Nuova distinzione di dominio per il blocco `Scadenze & Rinnovi`:
  - `scadenze_alert_global_rules`: regole globali automatiche per tipo scadenza (`LICENZA`, `TAGLIANDO`, `GARANZIA`, `SAAS`)
  - `alert_message_templates`: preset riusabili, associabili ai tipi scadenza o usabili come override locale
  - `renewal_alert_rules`: override cliente per i flussi automatici cliente/stage gia esistenti
- Nuova pagina impostazioni:
  - `app/impostazioni/regole-globali-avvisi/page.tsx`
  - raggiungibile da `Impostazioni`
- Pagina `Preset avvisi` resa piu chiara:
  - espone il tipo scadenza associato
  - distingue meglio i preset collegabili a regole globali dagli override locali
- Popup condiviso `components/RenewalsAlertModal.tsx`:
  - elimina la ridondanza `Automatico` + `regola automatica attiva`
  - mostra la regola globale del tipo scadenza
  - distingue `Override locale` da `Override cliente`
- Cron automatico scadenze:
  - `GET /api/cron/scadenze-alert` legge ora `scadenze_alert_global_rules`
  - raggruppa per `cliente + tipo scadenza + step`
  - supporta step `30 / 15 / 7 / 1`
  - usa eventuale preset/default text della regola globale
  - continua a loggare su `checklist_alert_log`, quindi alimenta anche `Ultimo invio`

## Snapshot 2026-03-19 - Fix persistenza data_disinstallazione e cockpit dashboard
- `app/checklists/[id]/page.tsx`
  - rimosso il fallback che eliminava `data_disinstallazione` dal payload di update checklist
  - se la colonna manca davvero, l'utente vede errore esplicito con riferimento alla migration `scripts/20260318_add_checklists_data_disinstallazione.sql`
- `app/page.tsx`
  - il cockpit dashboard non dipende piu da `scadenzeEntro7Count > 0`
  - la banda gialla con shortcut operative resta visibile anche quando il conteggio scadenze e' zero

## Snapshot 2026-03-19 - Cronoprogramma disinstallazioni noleggio
- `app/api/cronoprogramma/route.ts` genera ora anche eventi `DISINSTALLAZIONE` per checklist `NOLEGGIO` con `data_disinstallazione` valorizzata.
- Stati ammessi per la visibilita dello smontaggio noleggio:
  - `IN_CORSO`
  - `IN_LAVORAZIONE`
  - `CONSEGNATO`
- `app/cronoprogramma/page.tsx` supporta ora il tipo evento `DISINSTALLAZIONE` in rendering e filtri.
- Aggiunti preset rapidi periodo:
  - `7 giorni`
  - `15 giorni`
  - `30 giorni`
- I preset impostano range `oggi -> oggi + N` senza rimuovere la possibilita di modificare manualmente `Da` e `A`.

## Snapshot 2026-03-19 - Separazione scadenze servizi vs noleggi
- `lib/scadenze/buildScadenzeAgenda.ts` resta source of truth condivisa per dashboard e pagina `/scadenze`.
- Correzione dominio:
  - l'agenda scadenze esclude ora le righe collegate a checklist con `noleggio_vendita = 'NOLEGGIO'`
  - esclusione applicata a `garanzie`, `saas`, `tagliandi`, `licenze`, `rinnovi_servizi` con `checklist_id` di noleggio
- Separazione confermata:
  - `SCADENZE IN ARRIVO` usa solo scadenze servizi/tecniche
  - `/scadenze` non mostra piu noleggi/smontaggi
  - `SMONTAGGI NOLEGGI ENTRO 7 GIORNI` resta servito da endpoint dedicato `/api/noleggi/smontaggi-entro-7-giorni`

## Snapshot 2026-03-11 - Handoff stabile + Drive cliente
- Handoff aggiornato con istruzioni operative minime prima di nuovi sviluppi.
- Scadenze aggregate:
  - introdotto builder read-only `lib/scadenze/buildScadenzeAgenda.ts`
  - introdotta route `GET /api/scadenze`
  - source of truth dominio riusata dalla scheda cliente, non dal cronoprogramma
  - introdotta UI minima `app/scadenze/page.tsx` + `app/scadenze/ScadenzeClient.tsx`
  - fetch solo on-load e submit filtro, nessun export ancora
- Checklist operative:
  - recovery globale batch disabilitato
  - usare solo recovery esplicito per checklist singola o lista stabile di `checklist_id`
  - endpoint sicuro:
    - `GET /api/impostazioni/checklist-attivita?recovery=1&checklist_id=<UUID>`
- Cliente:
  - aggiunto campo dedicato `clienti_anagrafica.drive_url`
  - gestito da `GET|POST|PATCH /api/clienti`
  - mostrato nella scheda cliente vicino al nome cliente come link cliccabile in nuova tab
  - validazione applicativa `http/https` lato modal e route API
- aggiunto campo dedicato `clienti_anagrafica.scadenze_delivery_mode`
- valori supportati: `AUTO_CLIENTE` / `MANUALE_INTERNO`
- mostrato e salvabile in scheda cliente; non ancora collegato al motore cron automatico
- notifiche `TECNICO_SW` su checklist create: eleggibilità corretta con precedenza `data_installazione_reale` -> `data_tassativa` -> `data_prevista`
- la data odierna è eleggibile per `TECNICO_SW`; solo date passate bloccano l'invio
- recovery manuale disponibile su `POST /api/notifications/recover-tecnico-sw`, con deduplica su `notification_log` per `checklist_id + target + task_title`
- cron `GET /api/cron/scadenze-alert` introdotto per garanzie/licenze/tagliandi
- step automatici scadenze: `30 / 15 / 7` giorni prima
- precedenza destinatario scadenze: `clienti_anagrafica.scadenze_delivery_mode` (`AUTO_CLIENTE` -> cliente, `MANUALE_INTERNO` -> Art Tech)
- deduplica scadenze automatiche su `checklist_alert_log` con `canale = scadenze_auto` e trigger per step

## Ultimo aggiornamento
2026-02-25

## Struttura attuale (sintesi)
- App Next.js con focus operativo su:
  - Dashboard progetti
  - Scheda cliente (`Scadenze & Rinnovi`, interventi, servizi)
  - Checklist operativa con task e regole notifiche
- Integrazioni:
  - Supabase (dati + auth)
  - Resend (email)
  - Vercel cron (promemoria)

## Funzioni recenti completate
- Cronoprogramma:
  - link progetto cliccabile
  - ricerca ticket
  - layout colonne semplificato
- Interventi:
  - campo `ticket_no`
  - campo `data_tassativa`
  - file allegati in creazione e riga intervento
  - fix leggibilita' tabella
- Scadenze & Rinnovi:
  - form aggiunta tagliando periodico
  - modale modifica con eliminazione voce
  - inserimento servizio SAAS/SAAS_ULTRA associato a progetto
  - estensione SAAS_ULTRA multi-progetto (selezionati/tutti)
- Licenze:
  - bottone elimina in modifica
  - correzione operativa: conversione licenza -> garanzia dalla modale

## Decisioni funzionali confermate
- Tagliandi e servizi devono essere associati a progetto (`checklist_id`).
- Stessa anagrafica cliente puo' avere coperture diverse su progetti diversi.
- Per SAAS_ULTRA deve esistere copertura su subset di progetti (non solo globale).
- Interventi inclusi devono essere valutati rispetto al progetto selezionato.

## Obiettivi aperti (priorita')
1. Verifica in produzione UX aggiunta/modifica/eliminazione su `Scadenze & Rinnovi`.
2. Stabilizzare completamente il calcolo inclusi/residui ULTRA per progetto in tutti i casi legacy.
3. Uniformare conversioni/cancellazioni servizi senza ambiguita' tra righe strutturali e righe rinnovo.
4. Continuare allineamento notifiche automatiche per target/task su dati reali.

## Governance agenti (attiva)
- Ruoli e confini operativi ufficiali in `docs/AGENT_OPERATING_MODEL.md`.
- Regola: ogni modifica cross-dominio richiede aggiornamento di questo file (snapshot operativo).

## Snapshot 2026-03-10 - Interventi shared block
- Creato `components/InterventiBlock.tsx` come blocco condiviso 1:1 per Interventi.
- `app/clienti/[cliente]/page.tsx` resta source of truth funzionale ma renderizza tramite componente condiviso.
- `app/checklists/[id]/page.tsx` renderizza lo stesso componente condiviso e limita i record a `checklist_id = id`.
- Flow allegati/link unificato:
  - create con upload file post-insert
  - apertura automatica edit/dettaglio per aggiungere link Drive o altri allegati
  - edit con `AttachmentsPanel` inline nello stesso flow

## Obiettivo aperto specifico
1. Verifica manuale su cliente e checklist del flusso Interventi completo: create, edit, close, reopen, alert singolo, alert bulk, allegati, link.

## Snapshot 2026-03-10 - Popup avvisi/rinnovi unificato
- Creato `components/RenewalsAlertModal.tsx` come popup condiviso per `Invia avviso scadenza`.
- Nuova source of truth per regole automatiche: `renewal_alert_rules`.
- Source of truth confermate:
  - stato workflow: `rinnovi_servizi` / `licenses`
  - log avvisi: `checklist_alert_log`
  - regole automatiche: `renewal_alert_rules`
- `MANUALE` e `AUTOMATICO` ora sono separati chiaramente:
  - `MANUALE`: scelta destinatario nel popup
  - `AUTOMATICO`: visualizzazione/salvataggio regola, non scelta destinatario runtime
- `app/api/cron/rinnovi-stage1/route.ts` usa la regola automatica stage1 per cliente e aggiorna `AVVISATO`.
- Storico avvisi mostra anche il campo `destinatario`/regola; le licenze vengono loggate con riferimento reale.

## Snapshot 2026-03-10 - Note checklist operativa
- La checklist operativa usa ora note per task con persistenza in `cronoprogramma_comments`.
- `row_kind` esteso a `CHECKLIST_TASK` per riusare la stessa struttura autore/data/commento del cronoprogramma.
- In tabella viene mostrata l'ultima nota; il pulsante `+` apre storico completo e form di inserimento.

## Snapshot 2026-03-10 - Backfill task template checklist
- La creazione di una nuova riga in `Impostazioni > Checklist attivita` propaga ora la task a tutte le checklist esistenti.
- Implementazione server-side in `app/api/impostazioni/checklist-attivita/route.ts`.
- Regole:
  - nessun duplicato per `checklist_id + task_template_id`
  - `stato` iniziale sempre `DA_FARE`
  - `sezione` e `ordine` copiati dal template
  - nessuna modifica alle task gia presenti
- Fix successivo:
  - le checklist legacy con task create senza `task_template_id` vengono riallineate al template per match `titolo + sezione + ordine`
  - recovery retroattivo automatico per la task ordine `75` `schemi dati ed elettrici + Pixel Map`

## Snapshot 2026-03-10 - Vincolo univoco checklist
- Aggiunta migration per enforcement `UNIQUE(cliente_id, nome_checklist)` su `checklists`.
- Prima dell'enforcement, i duplicati storici mantengono invariata la checklist piu recente; le altre vengono rinominate come duplicate.
- UI create checklist/progetto mostra messaggio chiaro quando il DB risponde con violazione del vincolo univoco.

## Snapshot 2026-03-11 - Checklist operativa sync e notification_rules
- Estratta la sync checklist operativa in `lib/checklist/syncChecklistTemplate.ts`.
- Funzioni disponibili:
  - `materializeChecklistTasks(checklistId)`
  - `syncChecklistTemplate(templateId)`
  - `syncAllChecklistTemplates()`
- La creazione checklist/progetto usa ora la route unica `POST /api/checklists/materialize-tasks`.
- La sync template -> checklist aggiorna solo `sezione`, `ordine`, `titolo`, `target`, oltre all'aggancio `task_template_id` per righe legacy.
- Non tocca mai dati operativi della task: `stato`, note, allegati, log, override notifiche.
- Le task template disattivate restano preservate nelle checklist esistenti per non perdere storico.
- `notification_rules` ora gestisce anche ambienti ancora fermi al vincolo legacy `(task_title, target)`:
  - se la riga esiste, viene aggiornata
  - se l'insert collide sul vecchio indice unico, la route converte il salvataggio in update della riga compatibile
  - precedenza effettiva lato UI/resta: override checklist > globale.

## Snapshot 2026-03-11 - Recovery retroattivo checklist esistenti
- Il problema residuo era che il riallineamento template -> checklist non veniva eseguito per i template gia attivi se nessuno li modificava.
- `GET /api/impostazioni/checklist-attivita` esegue ora `syncAllChecklistTemplates()` come recovery retroattivo globale.
- Risultato:
  - ogni task template attiva viene inserita nelle checklist che la stanno ancora perdendo
  - le righe legacy esistenti vengono collegate a `task_template_id` per match `titolo + sezione + ordine`
  - nessun tocco a `stato`, note, allegati, log, override notifiche.

## Snapshot 2026-03-11 - Recovery checklist non bloccante + cleanup doppioni
- Il recovery globale non viene piu eseguito nel `GET` bloccante della pagina `Checklist attivita`.
- La pagina avvia invece un fetch background su `?recovery=1`; la route server deduplica il recovery con cooldown.
- La sync `template -> checklist_tasks` ora fa riconciliazione vera:
  - prioritario `task_template_id`
  - fallback legacy per titolo normalizzato/compatibile
  - riallineamento di `titolo`, `sezione`, `ordine`, `target`
- Se ci sono doppioni della stessa task template in una checklist:
  - sceglie una riga canonica in base a collegamento template + dati operativi disponibili
  - migra allegati, documenti task, commenti cronoprogramma, meta e notification_jobs
  - elimina il duplicato solo dopo il merge
- Questo copre anche i due casi reali emersi:
  - titolo canonico `Elettronica di controllo`
  - spostamento canonico di `Preparazione / riserva disponibilita / ordine merce` in `DOCUMENTI` ordine `74`.

## Snapshot 2026-03-11 - Alias legacy espliciti e merge note/stato
- La riconciliazione finale non si limita piu alle righe senza `task_template_id`.
- Anche una riga gia collegata male viene ora considerata candidata al merge se rientra negli alias legacy espliciti.
- Alias gestiti:
  - `Elettronica di controllo: schemi dati ed elettrici` -> `Elettronica di controllo`
  - `Preparazione / riserva disponibilita / ordine merce` -> task canonica del template
- Sul merge del duplicato nella riga canonica vengono preservati anche `stato` e `note` della task, oltre ai riferimenti esterni gia gestiti.

## Snapshot 2026-03-11 - Recovery manuale eseguibile
- Il `Bad Request` sul recovery globale derivava da query troppo grandi durante `syncAllChecklistTemplates()`.
- Correzione:
  - chunk `taskIds` nelle query statistiche operative
  - chunk `checklistIds` nel recovery globale
- Recovery manuale disponibile via:
  - `GET /api/impostazioni/checklist-attivita?recovery=1&offset=0&limit=25`
- La route ora processa batch limitati di checklist per invocation e restituisce:
  - `processed`
  - `remaining`
  - `nextOffset`
- Il page load di `Checklist attivita` non avvia piu recovery batch automatici.

## Snapshot 2026-03-11 - Recovery batch disabilitato, cleanup per checklist_ids stabili
- Il recovery globale con offset e' stato disabilitato per sicurezza: non e' considerato idempotente sul dataset sporco.
- La route recovery accetta ora solo:
  - `checklist_id=<uuid>`
  - `checklist_ids=<uuid1>,<uuid2>,...`
- Strategia corretta:
  - snapshot esterno degli `id` checklist da bonificare
  - invocazioni ripetute con liste esplicite e stabili
  - nessun ricalcolo paginato per offset sul run di cleanup

## Query rapide di controllo (manuali)
```sql
-- Tagliandi cliente con progetto associato
select id, cliente, checklist_id, scadenza, modalita, stato
from public.tagliandi
where lower(cliente) = lower('<CLIENTE>');

-- Coperture SAAS/ULTRA per progetto
select id, cliente, checklist_id, item_tipo, subtipo, riferimento, scadenza, stato
from public.rinnovi_servizi
where lower(cliente) = lower('<CLIENTE>')
order by checklist_id, item_tipo, subtipo;

-- Interventi inclusi per progetto
select checklist_id, count(*) as inclusi
from public.saas_interventi
where lower(cliente) = lower('<CLIENTE>') and incluso = true
group by checklist_id;
```
