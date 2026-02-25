# AGENTS.md — AT SYSTEM (arttech-checklist)

## 🎯 Obiettivo
Questo repository è progettato per essere modificato sia da sviluppatori umani sia da agenti AI (Codex).  
L’obiettivo è garantire:
- Coerenza tra dominio (rinnovi, workflow stati) e DB
- Assenza di regressioni UI sui flussi critici
- Allineamento tra codice, migrazioni e documentazione
- Deploy sicuri su Vercel

## 1️⃣ Fonte di Verità
Ordine di priorità:
1. Schema Supabase (Postgres)
2. `PROJECT_CONTEXT.md` (dominio e architettura)
3. `HANDOFF_CONTEXT.md` (stato corrente + commit locali)
4. Codice sorgente

Se c’è conflitto: prevale lo schema DB.

## 2️⃣ Dominio Critico — Rinnovi & Workflow
### Workflow Stati
`DA_AVVISARE -> AVVISATO -> CONFERMATO -> DA_FATTURARE -> FATTURATO`

Non introdurre stati nuovi senza:
- Aggiornare DB
- Aggiornare `getWorkflowStato`
- Aggiornare UI badge colori
- Aggiornare documentazione

Qualsiasi modifica al mapping deve aggiornare:
- `mapRinnovoTipo`
- `getRinnovoMatch`
- `ensureRinnovoForItem`

### ⚠️ Check Constraint DB
La tabella `rinnovi_servizi` ha constraint su `item_tipo`.

Valori ammessi:
- `LICENZA`
- `TAGLIANDO`
- `SAAS`
- `RINNOVO`
- `GARANZIA`

`SAAS_ULTRA` NON è un `item_tipo`: usare `item_tipo: "SAAS"` + `subtipo: "ULTRA"`.

## 3️⃣ Regole Obbligatorie per Modifiche
### Se tocchi rinnovi
Devi verificare:
- Invio alert aggiorna stato -> `AVVISATO`
- `NON_RINNOVATO` non viola constraint
- `ensureRinnovoForItem` non crea duplicati
- UI si aggiorna senza refresh

### Se tocchi duplicazione progetto
Non devono essere copiati:
- Seriali
- Licenze
- SaaS
- Tagliandi
- Garanzie
- Log avvisi

Devono essere copiati:
- Checklist base
- Impianto
- BOM (`checklist_items`)
- Task (`checklist_tasks` -> stato reset `DA_FARE`)

### Se tocchi popup/modali
Verificare che:
- Non si chiudano su re-render
- Non si chiudano per state reset
- Non si chiudano per route refresh
- Non ci siano key dinamiche che forzano remount

## 4️⃣ Procedura Standard per Feature
Ogni nuova feature deve:
1. Aggiornare documentazione (se tocca dominio)
2. Non rompere workflow rinnovi
3. Passare typecheck (`npx tsc --noEmit`)
4. Non introdurre query duplicate Supabase
5. Non generare stati inconsistente tra UI e DB

## 5️⃣ Procedura Standard per Bugfix
1. Riprodurre bug
2. Identificare:
   - problema stato?
   - problema mapping?
   - problema constraint DB?
3. Fix minimale
4. Aggiornare `HANDOFF_CONTEXT.md`
5. Commit con descrizione chiara

Formato commit:
- `fix: descrizione breve`
- `feat: descrizione breve`
- `refactor: descrizione breve`

## 6️⃣ Deploy Flow
Produzione: Vercel auto-deploy su push `main`.

Prima del push:
```bash
npx tsc --noEmit
git pull origin main
git push origin main
```

Se la modifica tocca DB:
- Migrazione in `/scripts`
- Eseguire manualmente in Supabase
- Annotare in `HANDOFF_CONTEXT.md`

## 7️⃣ File Critici
- `app/clienti/[cliente]/page.tsx` -> blocco Scadenze & Rinnovi
- `app/page.tsx` -> dashboard + duplicazione progetto
- `app/api/send-alert/route.ts`
- `app/api/cron/reminders/route.ts`
- `app/api/cron/checklist-reminders/route.ts`

## 8️⃣ Known Fragilities
- Stato workflow desincronizzato tra UI e DB
- Constraint `rinnovi_servizi_item_tipo_check`
- Mapping `SAAS` / `SAAS_ULTRA` / `GARANZIA`
- Popup duplicazione progetto

Non refactorizzare questi blocchi senza test manuale completo.

## 9️⃣ Obiettivo per gli agenti AI
Quando modifichi codice:
- Riduci complessità
- Non rompere dominio
- Non introdurre duplicazioni stato
- Mantieni coerenza con schema DB
- Aggiorna documentazione se necessario

Se non sei sicuro: chiedi chiarimenti prima di cambiare architettura.

## 🔟 Agenti Interni Specializzati
Per lavorare in modo stabile per competenza, usare anche:
- `docs/AGENT_OPERATING_MODEL.md`
- `docs/AGENT_MEMORY.md`

Regola operativa:
- Ogni task deve essere assegnato all'agente di dominio corretto.
- Dopo modifiche rilevanti, aggiornare `docs/AGENT_MEMORY.md` (snapshot + obiettivi aperti).

## 🔎 Perché questa struttura è utile per AT SYSTEM
Il problema principale è mantenere coerenza tra:
- UI
- Workflow
- Mapping tipi
- Constraint DB
- Cron job
- Email

Questo file aiuta l’agente a non rompere il dominio.
