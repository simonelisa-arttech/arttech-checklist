# AGENT MEMORY — Snapshot Operativo

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
