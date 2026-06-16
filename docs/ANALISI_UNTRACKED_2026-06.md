# AT SYSTEM — Analisi file untracked nel repository (2026-06-15)

> Analisi (sola lettura) degli elementi non tracciati ancora presenti nel repo `arttech-checklist`,
> con indicazione per ciascuno di: contenuto, classificazione (versionare / ignorare / archiviare /
> eliminare), rischio se committato, priorità. Nessun file è stato modificato; nessun commit; nessun
> `.gitignore` creato. Documento condivisibile.

---

## 1. File agente / Cowork
Scaffolding personale, specifico della sessione dell'agente, non del prodotto.

- **CLAUDE.md** — istruzioni/ruolo dell'agente ATSYSTEM (contiene anche l'email utente). → Ignorare
  (.gitignore). Rischio: espone config/email interne. Priorità: media. *(Opzionale: versionare solo
  se si vogliono istruzioni di progetto condivise.)*
- **HEARTBEAT.md** — template runtime (heartbeat). → Ignorare. Rischio: basso. Priorità: bassa.
- **IDENTITY.md** — identità agente ("AT Copilot"). → Ignorare. Rischio: basso. Priorità: bassa.
- **MEMORY.md** — memoria operativa agente. → Ignorare. Rischio: note interne. Priorità: media.
- **SOUL.md** — personalità agente. → Ignorare. Rischio: basso. Priorità: bassa.
- **TOOLS.md** — ambienti/strumenti. → Ignorare. Rischio: basso. Priorità: bassa.
- **USER.md** — **dati personali di Simone** (nome, preferenze). → Ignorare. Rischio: **PII**.
  Priorità: **alta**.

## 2. Dati / import

- **import_progetti_fixed.csv** — 3 righe, import progetti con **dati clienti** (referente,
  contatto, seriali). → Ignorare / archiviare offline. Rischio: **PII clienti**. Priorità: **alta**.
- **data/** — solo `.gitkeep` (cartella dati locale). → Ignorare. Rischio: nullo. Priorità: bassa.
- **archivio/** — solo `.gitkeep` (archivio locale). → Ignorare. Rischio: nullo. Priorità: bassa.
- **test-results/** — artefatti Playwright (`.last-run.json` + duplicato `.last-run 2.json`). →
  Ignorare. Rischio: rumore/churn. Priorità: bassa.

## 3. Documentazione (candidata a versionamento)

- **knowledge/** — `company-profile.md`, `modelli-commerciali.md` (profilo azienda, modelli
  commerciali). → Versionare (da valutare; nessun segreto) oppure spostare in `docs/`. Priorità: media.
- **references/** — `funzionalita-core.md`, `stack-guida.md` (riferimenti tecnici). → Versionare (da
  valutare) oppure spostare in `docs/`. Priorità: media.

## 4. File spurio

- **app/fatturazione-globale/page 2.tsx** — **duplicato stub** (1.5K) della vera `page.tsx` (32K).
  Il nome "page 2" è una copia accidentale (macOS/sync). Non è una route Next.js. → **Eliminare**.
  Rischio: dead code / confusione. Priorità: media.

## 5. Migration SQL (`scripts/`)
Schema/dati reali. **Alcune probabilmente già applicate in produzione** (attachments,
`modalita_attivita`, `saas_interventi_impianti` sono citate nell'architettura). → **Versionare dopo
verifica** dello stato reale in produzione; **non applicare** alla cieca. Rischio: doppia
applicazione o disallineamento con lo schema reale. Priorità: media-alta.

- **20260223_mark_pre2026_projects_consegnato.sql** — set `stato_progetto='CONSEGNATO'` per progetti
  pre-2026 (migrazione **DATI**; idempotenza da verificare).
- **20260227_fix_notification_rules_override_unique.sql** — rimuove vincolo unique legacy regole notifiche.
- **20260304_add_attachments_table.sql** — crea tabella `attachments`.
- **20260304_add_attachments_rls.sql** — RLS su `attachments`.
- **20260304_add_storage_policies_checklist_documents.sql** — storage policies bucket `checklist-documents`.
- **20260404_add_cronoprogramma_modalita_attivita.sql** — aggiunge colonna `modalita_attivita`.
- **20260522_add_saas_interventi_impianti.sql** — crea tabella `saas_interventi_impianti`.

---

## 6. Tabella finale

| elemento | tenere repo | gitignore | eliminare | note |
|---|---|---|---|---|
| CLAUDE.md | — | ✓ | — | Config/ruolo agente + email; opz. versionare se istruzioni condivise |
| HEARTBEAT.md | — | ✓ | — | Template runtime |
| IDENTITY.md | — | ✓ | — | Identità agente |
| MEMORY.md | — | ✓ | — | Memoria agente |
| SOUL.md | — | ✓ | — | Personalità agente |
| TOOLS.md | — | ✓ | — | Strumenti/ambiente |
| USER.md | — | ✓ | — | **PII Simone** — mai committare |
| import_progetti_fixed.csv | — | ✓ | opz. | **PII clienti**; ignorare o archiviare offline |
| archivio/ | — | ✓ | — | Solo `.gitkeep` (mantieni `.gitkeep` se vuoi la cartella) |
| data/ | — | ✓ | — | Solo `.gitkeep`; dati locali/runtime |
| knowledge/ | ✓ (valutare) | — | — | Doc azienda/commerciali; no segreti; eventualmente in `docs/` |
| references/ | ✓ (valutare) | — | — | Riferimenti tecnici; no segreti; eventualmente in `docs/` |
| test-results/ | — | ✓ | — | Artefatti test generati (incl. duplicato `.last-run 2.json`) |
| app/fatturazione-globale/page 2.tsx | — | — | ✓ | Duplicato stub accidentale di `page.tsx` |
| scripts/20260223_mark_pre2026_projects_consegnato.sql | ✓ (dopo verifica) | — | — | Migrazione **dati**; verificare se già eseguita |
| scripts/20260227_fix_notification_rules_override_unique.sql | ✓ (dopo verifica) | — | — | Rimozione vincolo legacy |
| scripts/20260304_add_attachments_table.sql | ✓ (dopo verifica) | — | — | Probabile già applicata |
| scripts/20260304_add_attachments_rls.sql | ✓ (dopo verifica) | — | — | RLS attachments |
| scripts/20260304_add_storage_policies_checklist_documents.sql | ✓ (dopo verifica) | — | — | Storage policies |
| scripts/20260404_add_cronoprogramma_modalita_attivita.sql | ✓ (dopo verifica) | — | — | Probabile già applicata |
| scripts/20260522_add_saas_interventi_impianti.sql | ✓ (dopo verifica) | — | — | Probabile già applicata |

---

## 7. Sintesi operativa consigliata
- **Da ignorare subito** (privacy/runtime): USER.md, import_progetti_fixed.csv, CLAUDE/MEMORY/SOUL/
  IDENTITY/TOOLS/HEARTBEAT.md, data/, archivio/, test-results/.
- **Da eliminare**: `app/fatturazione-globale/page 2.tsx` (duplicato).
- **Da versionare dopo verifica**: le 7 migration in `scripts/` (controllare prima cosa è già
  applicato in produzione).
- **Da valutare**: knowledge/ e references/ → versionare come documentazione (eventualmente in `docs/`).

> Regole rispettate: nessun file modificato, nessun commit, nessun `.gitignore` creato. Per procedere
> serviranno passi separati (proposta `.gitignore`, eliminazione duplicato, verifica migration), uno
> alla volta e con approvazione.
