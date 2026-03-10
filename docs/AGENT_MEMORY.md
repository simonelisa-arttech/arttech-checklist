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
