# AGENT OPERATING MODEL — AT SYSTEM

## Scopo
Definire agenti interni specializzati, con responsabilita' chiare, per ridurre regressioni.

## Regole comuni
- Fonte di verita': schema Supabase -> `PROJECT_CONTEXT.md` -> `HANDOFF_CONTEXT.md` -> codice.
- Cambiamenti DB: script in `scripts/` + nota in `docs/AGENT_MEMORY.md`.
- Nessun refactor massivo su flussi critici senza test manuale.

## Agente 1: `workflow-rinnovi`
Ambito:
- `app/clienti/[cliente]/page.tsx` (Scadenze & Rinnovi)
- mapping tipo/stato (`mapRinnovoTipo`, `getWorkflowStato`, `ensureRinnovoForItem`)
Responsabilita':
- coerenza stati: `DA_AVVISARE -> AVVISATO -> CONFERMATO -> DA_FATTURARE -> FATTURATO`
- coerenza tagliandi/licenze/saas/garanzia nel riepilogo unico

## Agente 2: `notifiche-cron`
Ambito:
- `app/api/cron/*.ts`
- `app/api/notification-rules*`
- `notification_log`, `notification_rules`
Responsabilita':
- dedup robusta
- rispetto regole frequency/timezone/only_future
- debug JSON chiaro

## Agente 3: `progetti-dashboard`
Ambito:
- `app/page.tsx`
- filtri dashboard + cronoprogramma
Responsabilita':
- filtri stato/saas chiari
- leggibilita' tabella e link progetto
- m2 e metriche coerenti con campi progetto

## Agente 4: `interventi-fatturazione`
Ambito:
- blocco interventi su scheda cliente
- cronoprogramma interventi
Responsabilita':
- inserimento/modifica/chiusura intervento
- campi ticket/proforma/date previste+tassative
- allineamento esito fatturazione e export

## Agente 5: `anagrafica-servizi`
Ambito:
- servizi associati a progetto (SAAS, SAAS_ULTRA, garanzia, tagliandi)
- licenze e conversioni operative (es. licenza caricata per errore)
Responsabilita':
- associare correttamente al progetto (`checklist_id`)
- supportare casi multi-progetto per lo stesso cliente
- funzioni di correzione rapida (modifica/elimina/converti)

## Agente 6: `qa-release`
Ambito:
- build, e2e, deploy notes
- regressioni note in UI
Responsabilita':
- validazione minima prima push
- aggiornamento handoff/memory con commit e rischi residui

## Sequenza consigliata su feature
1. `anagrafica-servizi` o `workflow-rinnovi` (dominio dati)
2. `interventi-fatturazione` / `progetti-dashboard` (UI e flusso)
3. `notifiche-cron` (automazioni)
4. `qa-release` (verifica e handoff)

