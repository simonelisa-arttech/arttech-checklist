# Handoff Context — AT SYSTEM (arttech-checklist)

## Update 2026-03-25 - Stato progetto legacy `CHIUSO` riallineato a `OPERATIVO`

- helper condiviso:
  - `lib/projectStatus.ts`
  - regole nuove:
    - `OPERATIVO` = progetto in esercizio / non chiuso
    - `CHIUSO` = solo stato finale reale
  - retrocompat:
    - se un record storico ha `stato_progetto = CHIUSO` ma la checklist operativa non e' completa, il mapping effettivo lo espone come `OPERATIVO`
    - se la checklist operativa e' completa (`pct_complessivo >= 100` oppure tutti i task completati nella pagina progetto), lo stato effettivo diventa `CHIUSO`
- `app/page.tsx`
  - filtro dashboard aggiornato:
    - aggiunto `Operativo`
    - `Chiuso` resta come stato finale reale
  - label stato progetto riallineata al nuovo mapping
- `app/api/dashboard/route.ts`
  - restituisce `stato_progetto` gia' normalizzato sullo stato effettivo usando `checklist_sections_view.pct_complessivo`
  - il filtro `stati` ora distingue correttamente `OPERATIVO` da `CHIUSO`
- `app/checklists/[id]/page.tsx`
  - la pagina progetto mostra `OPERATIVO` per i vecchi `CHIUSO` legacy non realmente chiusi
  - il dropdown stato propone `OPERATIVO`
  - `CHIUSO` compare solo se la checklist operativa e' effettivamente completa
  - in salvataggio, un `CHIUSO` scelto senza checklist completa viene normalizzato a `OPERATIVO`
- `app/checklists/nuova/page.tsx`
  - `CHIUSO` rimosso dal form creazione e sostituito con `OPERATIVO`
- `app/clienti/[cliente]/page.tsx`
  - colonna stato progetto riallineata al mapping effettivo
- import:
  - `app/api/import/progetti-csv/route.ts`
  - `app/api/import/checklists-csv/route.ts`
  - gli import normalizzano lo stato legacy `CHIUSO` a `OPERATIVO` in persistenza
- migration SQL:
  - `scripts/20260325_normalize_legacy_chiuso_to_operativo.sql`
  - converte a DB i record legacy `CHIUSO` -> `OPERATIVO` quando `pct_complessivo < 100`

## Update 2026-03-25 - Tipi documento safety puliti e modificabili

- `app/impostazioni/personale/page.tsx`
- `app/impostazioni/aziende/page.tsx`
  - i tipi documento custom non espongono piu' in UI i prefissi tecnici `PERSONALE_` / `AZIENDA_`
  - il codice salvato in `document_types.codice` e' ora uno slug neutro basato sul nome, senza prefissi di dominio
  - le liste `extraDocumentLabels` usano il nome utente-visibile (`nome`, oppure fallback pulito da `codice`)
  - aggiunta gestione inline dei tipi documento custom:
    - modifica nome
    - salvataggio
    - eliminazione
  - i record legacy con solo `codice` sporco vengono mostrati puliti e possono essere corretti direttamente da UI
  - `+ Documento persona` / `+ Documento azienda` non preselezionano piu' automaticamente il primo tipo documento:
    - il campo parte vuoto su `— Seleziona —`
    - evita falsi positivi nell'elenco standard atteso prima di una scelta esplicita

## Update 2026-03-25 - Import progetti idempotente con update server-side di default

- `app/api/import/progetti-csv/route.ts`
  - `on_conflict` default ora e' `update`
  - se il progetto esiste gia':
    - non fa piu' `skip` di default
    - aggiorna server-side solo i campi checklist valorizzati nel file
    - non sovrascrive con `null` o stringhe vuote
  - matching esistente:
    - priorita' a `nome_checklist` + `cliente_id/cliente`
    - fallback compatibile sulla deduplica storica per tag progetto
  - output JSON e log summary ora includono:
    - `inserted`
    - `updated`
    - `skipped`
- campi checklist aggiornati solo se presenti:
  - incluso `po`, `impianto_indirizzo`, `saas_scadenza` e gli altri gia' mappati nella route
- child entities:
  - seriali / licenze / accessori continuano a seguire il ramo esistente post-persistenza
  - update licenze reso piu' robusto:
    - log temporaneo con `po_value`, `licenza_scadenza_value`, `project_id`, `matched_license_ids`
    - se `licenza_scadenza` e' presente in `update`, le licenze esistenti vengono aggiornate
    - se il CSV non elenca tipi licenza ma il progetto ha gia' licenze, la route puo' riallineare la `scadenza` sugli item esistenti del checklist

## Update 2026-03-25 - Campo `PO` aggiunto al flusso progetti

- Migration:
  - `scripts/20260325_add_checklists_po.sql`
  - aggiunge `checklists.po text null`
- `app/api/import/progetti-csv/route.ts`
  - supporta header import:
    - `PO`
    - `po`
    - `purchase_order`
    - `purchase order`
  - salva il valore in `checklists.po`
  - resta compatibile con schema runtime: se la colonna manca, il fallback checklist non rompe l'import
- `app/api/dashboard/route.ts`
  - include `po` nel select e nella ricerca dashboard
- `app/page.tsx`
  - nuova colonna `PO` in dashboard vicino a `Proforma`
- `app/checklists/[id]/page.tsx`
  - `PO` visibile nel blocco `PROGETTO`
  - supportato anche in edit/salvataggio scheda progetto
- `app/clienti/[cliente]/page.tsx`
  - `PO` visibile nella tabella `PROGETTO del cliente`
- `app/import-progetti/page.tsx`
  - testo colonne supportate aggiornato con `po`

## Update 2026-03-25 - Pagina `Importa progetti` riallineata al route corretto

- `app/import-progetti/page.tsx`
  - la UI chiamava ancora hardcoded il route legacy `/api/import/checklists-csv`
  - ora usa solo `/api/import/progetti-csv`
  - allineata anche la lettura della risposta reale del route progetti:
    - `errors[].reason`
    - `warnings[]`
    - `delimiter`
  - aggiunto debug temporaneo lato UI:
    - log console con endpoint realmente chiamato e filename
    - riepilogo in pagina con `Endpoint: /api/import/progetti-csv`
- causa reale del bug:
  - wiring errato della pagina, non parser progetti
  - per questo in UI compariva ancora il messaggio legacy `nome_checklist / cliente`

## Update 2026-03-25 - Import progetti accetta di nuovo `nome_progetto` come campo obbligatorio reale

- `app/api/import/progetti-csv/route.ts`
  - il nome progetto viene ora risolto con alias espliciti:
    - `nome_progetto`
    - `nome progetto`
    - `nome_checklist`
    - `rif progetto`
  - la validazione obbligatoria resta su:
    - `cliente`
    - `nome_progetto`
  - non richiede piu' `nome_checklist` come campo obbligatorio esplicito
  - la validazione usa solo le variabili mappate `cliente` + `nome_progetto`, non i campi raw della row
  - aggiunto debug temporaneo per troubleshooting import:
    - `cliente`
    - `nome_progetto`
    - `sample_row`

## Update 2026-03-25 - Fix sessione browser su fetch client-side protette

- `lib/clientDbBroker.ts`
  - il broker client verso `/api/db` invia ora sempre `credentials: "include"`
  - evita i fallback `Unauthorized` nelle viste client che leggono dati via broker con sessione browser gia' attiva
- `components/OperativeNotesPanel.tsx`
  - tutte le chiamate verso `/api/cronoprogramma` (`load`, `set_operativi`, `add_comment`) inviano ora esplicitamente i cookie di sessione
  - risolve il fallback `No auth cookie` visto nelle note operative della scheda cliente/progetto
- `lib/interventoOperativi.ts`
  - stesso allineamento per load/save dei dati operativi intervento
- Impatto pratico:
  - scheda cliente piu' stabile su:
    - note operative
    - personale selector
    - blocchi che leggono via `dbFrom(...)`
  - il fix e' mirato al trasporto sessione, senza cambiare la logica auth server

## Update 2026-03-25 - `AVVISATO` solo con destinatari validi

- `app/api/cron/rinnovi-stage1/route.ts`
  - il cron stage1 non puo' piu' procedere con `AVVISATO` se la lista destinatari effettivi e' vuota
  - ora filtra i recipient con email valida, logga l'errore e salta l'update stato
- `app/api/cron/scadenze-alert/route.ts`
  - allineato lo stesso controllo su recipient effettivi con email valida
  - messaggio errore normalizzato a `Email cliente mancante` quando il problema e' il cliente
- `app/clienti/[cliente]/page.tsx`
  - il flusso manuale non aggiorna piu' `AVVISATO` senza destinatari
  - corretto anche il ramo `E2E mock`, che prima marcava `AVVISATO` senza validazione recipient
- `app/checklists/[id]/page.tsx`
  - messaggio manuale progetto allineato a `Email cliente mancante`
- `components/RenewalsAlertModal.tsx`
  - testo helper piu' esplicito quando manca email cliente

## Update 2026-03-25 - Link allegati in creazione intervento

- `components/InterventiBlock.tsx`
  - il form `Aggiungi intervento` supporta ora anche una coda di link allegati oltre ai file
  - UI nuova:
    - titolo link opzionale
    - URL link
    - bottone `Aggiungi link`
    - lista link accodati con `Rimuovi`
- `app/checklists/[id]/page.tsx`
  - dopo la creazione intervento salva anche i link accodati su `attachments` con:
    - `entity_type = INTERVENTO`
    - `source = LINK`
- `app/clienti/[cliente]/page.tsx`
  - stesso supporto allineato sul blocco condiviso interventi
- Nessuna modifica al pannello allegati esistente dei dettagli intervento:
  - i link nuovi usano la stessa source of truth (`/api/attachments`) gia' usata da `AttachmentsPanel`

## Update 2026-03-25 - Pagine `Personale` e `Aziende` rese compatte con documenti collassati

- `app/impostazioni/personale/page.tsx`
  - aggiunto campo `Cerca` per filtro nome/cognome
  - i documenti persona sono chiusi di default
  - apertura/chiusura solo con pulsante `Elenco`
  - `+ Documento persona` usa solo `select` da elenco tipi documento, niente input libero
  - aggiunto bottone separato `+ Documento` per creare un nuovo tipo documento necessario in `document_types`
- `app/impostazioni/aziende/page.tsx`
  - aggiunto campo `Cerca` per filtro ragione sociale
  - i documenti azienda sono chiusi di default
  - apertura/chiusura solo con pulsante `Elenco`
  - `+ Documento azienda` usa solo `select` da elenco tipi documento, niente input libero
  - aggiunto bottone separato `+ Documento` per creare un nuovo tipo documento necessario in `document_types`
- `components/SafetyExpectedDocumentsPanel.tsx`
  - supporta `extraDocumentLabels`
  - oltre ai documenti standard safety mostra anche eventuali nuovi tipi documento aggiunti manualmente, senza cambiare i criteri minimi di conformita'

## Update 2026-03-25 - Indice orizzontale nella pagina progetto

- `app/checklists/[id]/page.tsx`
  - aggiunto sotto il titolo pagina un indice orizzontale cliccabile stile pill
  - voci collegate ai blocchi principali della scheda progetto:
    - `Dati operativi`
    - `Scadenze e rinnovi`
    - `Servizi`
    - `Licenze`
    - `Interventi`
    - `Foto / Video`
    - `Check list operativa`
  - ogni blocco ha ora `id` dedicato e `scrollMarginTop` per uno scroll piu' pulito
  - nessuna modifica a logica, query o dati della pagina progetto

## Update 2026-03-25 - Dashboard "Aggiungi intervento" ora apre direttamente il progetto

- `app/page.tsx`
  - il submit del modal `Aggiungi intervento` non passa piu' da `/clienti/[cliente]`
  - redirect diretto a `/checklists/[id]?focus=interventi&addIntervento=1`
  - mantiene il prefill opzionale `descrizione`
- `app/checklists/[id]/page.tsx`
  - legge `focus=interventi` / `addIntervento=1` dalla query
  - fa scroll automatico al blocco `Aggiungi intervento` (`#add-intervento`)
  - precompila la descrizione dell'intervento se presente in query
- Nessuna modifica alla logica interventi o alla navigazione cliente standard fuori da questo flusso dashboard.

## Update 2026-03-26 - Primo step riuso cronoprogramma per futura nuova Home

- creato `components/cronoprogramma/CronoprogrammaPanel.tsx`
  - contiene il contenuto principale della pagina cronoprogramma:
    - filtri data/cliente/tipo/ricerca/personale
    - quick range `7/15/30`
    - toggle `Fatto` / `Nascosta`
    - export CSV
    - tabella/timeline con note, operativi, conflitti e storico note
- `app/cronoprogramma/page.tsx`
  - resta il container pagina
  - mantiene wrapper, titolo `AT SYSTEM / CRONOPROGRAMMA`, link `← Dashboard`, stato errore e tutta la logica fetch/state
  - ora monta `CronoprogrammaPanel` come blocco principale
- obiettivo del refactor:
  - preparare un riuso meccanico del contenuto cronoprogramma nella futura Home
  - senza toccare ancora `app/page.tsx` o `app/layout.tsx`

## Update 2026-03-26 - Home operativa riallineata a cockpit + cronoprogramma

- `app/page.tsx`
  - rimosso il placeholder temporaneo verso `/dashboard`
  - la Home ora monta direttamente `components/cronoprogramma/CronoprogrammaPanel.tsx` sotto il cockpit KPI
  - mantenuti invariati:
    - header / top actions
    - cockpit
    - form creazione progetto quando attivo
- per questo step il container cronoprogramma della Home riusa la stessa logica API gia' presente nella pagina dedicata:
  - `load_events`
  - `load`
  - `set_fatto`
  - `set_hidden`
  - `add_comment`
  - `set_operativi`
  - `delete_comment`
- `/dashboard` resta la superficie separata per il blocco progetti, senza cambiamenti in questo step

## Update 2026-03-26 - Navigazione globale minima nel layout

- `app/layout.tsx`
  - logo ora cliccabile verso `/`
  - aggiunta mini navigazione globale nella top bar con link:
    - `Home` -> `/`
    - `Dashboard` -> `/dashboard`
    - `Cronoprogramma` -> `/cronoprogramma`
- scelta conservativa:
  - nessuna rimozione dei link locali gia' presenti nelle singole pagine
  - nessun refactor della shell oltre il necessario

## Update 2026-03-25 - Personale operativo su `personale_ids` con fallback legacy

- Source of truth nuova per personale operativo:
  - `cronoprogramma_meta.personale_ids` (`uuid[]`)
  - `personale_previsto` resta solo come stringa derivata/compatibile per UI legacy, filtri e conflitti testuali
- UI allineate:
  - `app/cronoprogramma/page.tsx`
  - `app/checklists/[id]/page.tsx`
  - `components/InterventiBlock.tsx`
  - usano ora solo `components/PersonaleMultiSelect.tsx`
  - rimosso l'inserimento manuale testo libero del personale
- `components/PersonaleMultiSelect.tsx`
  - accetta `personaleIds` + `legacyValue`
  - risolve automaticamente i nomi legacy in ID quando trova un match in tabella `personale`
  - i valori non riconosciuti restano visibili come `Legacy non collegati`
  - nessun nuovo nome puo' essere inserito manualmente
- Safety:
  - `components/SafetyComplianceBadge.tsx`
  - `lib/safetyCompliance.ts`
  - lavorano prima su `personale_ids`
  - usano `legacyAssignments` solo come fallback
  - per personale esterno risalgono anche all'azienda collegata per i controlli documentali
- API / meta operativi:
  - `app/api/cronoprogramma/route.ts`
    - legge/salva `personale_ids`
    - retry compatibile se la colonna non esiste ancora a DB
  - `lib/interventoOperativi.ts`
    - include `personale_ids` in load/save
- Interventi progetto/cliente:
  - i form intervento ora mantengono sia `personaleIds` sia `personalePrevisto`
  - la stringa viene sempre derivata dalla selezione ID
- Migrazione DB:
  - `scripts/20260325_add_cronoprogramma_personale_ids.sql`
    - aggiunge `cronoprogramma_meta.personale_ids uuid[]`
    - crea indice GIN
- Regola operativa:
  - nuovi assegnamenti personale solo da elenco `personale`
  - i legacy vengono auto-collegati dove possibile e segnalati dove non risolvibili

## Update 2026-03-25 - Refactor scadenze/avvisi: preset senza trigger, regole globali per step

- Refactor principale completato per separare in modo netto:
  - `Preset avvisi` = solo contenuto/template (`titolo`, `codice`, `tipo`, `subject`, `messaggio`, `attivo`)
  - `Regole globali avvisi` = source of truth dei trigger automatici
  - `Override locale` = solo popup invio manuale
- Contratto applicativo nuovo per `scadenze_alert_global_rules`:
  - `tipo_scadenza`
  - `giorni_preavviso`
  - `preset_id`
  - `attivo`
- Compatibilita' dati mantenuta:
  - `lib/scadenzeAlertConfig.ts` espande ancora i record legacy con `enabled_steps`, `default_template_id`, `tipo` o `step_giorni`
  - `app/api/alert-templates/route.ts` continua a scrivere `trigger = MANUALE` solo come compat DB se la colonna legacy esiste, ma il trigger non e' piu usato dalla logica applicativa
- `CMS` aggiunto ai tipi ufficiali per preset e regole globali
- `app/impostazioni/preset-avvisi/page.tsx`
  - rimossi filtro e dropdown `trigger`
  - il preset non gestisce piu timing/step
- `app/impostazioni/regole-globali-avvisi/page.tsx`
  - una card per tipo scadenza
  - righe ordinate `giorni_preavviso DESC`
  - selezione `preset associato` + `attivo` per ogni step
- `app/api/cron/scadenze-alert/route.ts`
  - legge ora la regola per chiave `(tipo_scadenza, giorni_preavviso)`
  - la finestra cron arriva fino al massimo step configurato (ora include 60 giorni)
  - la regola globale decide solo step+preset; il recapito automatico continua a usare la preferenza cliente (`AUTO_CLIENTE` / `MANUALE_INTERNO`)
- `app/api/cron/rinnovi-stage1/route.ts`
  - riallineato per non dipendere piu da `enabled_steps/default_target/default_delivery_mode`
- Popup `Invia avviso`
  - `components/RenewalsAlertModal.tsx`
  - se manca email cliente in anagrafica, mostra input editabile nel manuale
  - il submit passa l'override alla pagina chiamante
- Salvataggio automatico email cliente:
  - `app/clienti/[cliente]/page.tsx`
  - `app/checklists/[id]/page.tsx`
  - se l'utente invia al cliente con email mancante, l'email inserita viene usata per l'invio e salvata subito in `clienti_anagrafica`
- SQL:
  - nuovo script `scripts/20260325_refactor_scadenze_alert_global_rules.sql`
    - allinea definitivamente `tipo_scadenza`
    - aggiunge `giorni_preavviso` e `preset_id`
    - espande le vecchie regole array in righe singole
  - `scripts/create_scadenze_alert_global_rules.sql` aggiornato al nuovo schema finale

## Update 2026-03-24 - Note operative riusate fuori dal cronoprogramma

- Source of truth unica confermata:
  - `cronoprogramma_meta.descrizione_attivita` per la nota operativa corrente
  - `cronoprogramma_comments` per lo storico note/commenti
- Nuovo componente riusabile:
  - `components/OperativeNotesPanel.tsx`
  - legge/salva sempre via `POST /api/cronoprogramma` usando le azioni gia esistenti:
    - `load`
    - `set_operativi`
    - `add_comment`
- Dove le note sono ora visibili/modificabili:
  - dashboard `app/page.tsx`
    - inline sotto il nome progetto per `INSTALLAZIONE` e, se noleggio, `DISINSTALLAZIONE`
  - pagina cliente `app/clienti/[cliente]/page.tsx`
    - inline nella lista progetti cliente per `INSTALLAZIONE`
  - pagina progetto `app/checklists/[id]/page.tsx`
    - box rapido in alto vicino ai dati progetto per `INSTALLAZIONE` e `DISINSTALLAZIONE`
  - blocco interventi condiviso `components/InterventiBlock.tsx`
    - inline accanto a ogni intervento e nel dettaglio intervento per `INTERVENTO`
- Coerenza con storico:
  - il componente aggiorna la nota corrente con `set_operativi`
  - aggiunge note storiche con `add_comment`
  - mostra lo storico esistente in modal, senza creare tabelle o campi paralleli
- Compatibilita' API:
  - `app/api/cronoprogramma/route.ts` consente ora `load` delle note `INTERVENTO` per qualsiasi intervento esistente, non solo quelli aperti/futuri del timeline cronoprogramma
- Effetto:
  - dashboard, cliente, progetto e blocchi interventi leggono/scrivono la stessa nota centrale del cronoprogramma
  - lo storico resta unico e coerente

## Update 2026-03-24 - Dashboard indirizzo impianto stabile

- `app/page.tsx`
  - la colonna `Indirizzo impianto` della dashboard non usa piu il valore raw direttamente
  - il render sanitizza ora:
    - trim
    - rimozione caratteri invisibili / spazi non standard
    - placeholder vuoti (`-`, `—`, `null`, `n.d.`, `nd`)
  - se il contenuto e' un URL:
    - il link resta cliccabile
    - viene mostrata una label compatta (`Apri mappa` o `Apri link`) invece dell'URL completo
  - se il contenuto e' testo normale:
    - viene mostrato con ellissi/troncamento
  - la cella ha larghezza controllata (`180px`) e non allarga piu anomamente la tabella
- Causa reale osservata:
  - valori importati raw molto lunghi (soprattutto link Google Maps) o quasi vuoti con caratteri invisibili venivano renderizzati integralmente nella cella dashboard
  - questo faceva percepire la colonna come larga/vuota pur con `tableLayout: fixed`

## Update 2026-03-24 - Import progetti CSV con auto-detect delimitatore

- `app/api/import/progetti-csv/route.ts`
  - l'import massivo non dipende piu dal solo delimitatore `;`
  - supporta ora auto-detect tra:
    - `;`
    - `,`
    - `tab`
- Regola di rilevamento:
  - il parser prova tutti i delimitatori supportati
  - legge la prima riga non vuota del file
  - sceglie il delimitatore che su quella riga produce il maggior numero di colonne
  - tra i candidati a pari colonne, preferisce quello con header richiesti (`cliente`, `nome_progetto`) e piu header noti del template import
  - se nessun candidato produce almeno 2 colonne utili, risponde con errore chiaro `Impossibile rilevare separatore CSV/TSV`
- Effetto:
  - gli export standard CSV di Google Sheets con separatore `,` vengono accettati senza conversioni manuali
  - gli export TSV di Google Sheets con separatore `tab` vengono letti correttamente
  - restano invariate tutte le normalizzazioni gia presenti (`trim`, `proforma _ -> /`, `dimensioni`, deduplica, warning non bloccanti)

## Update 2026-03-24 - Import progetti CSV normalizzazione header

- `app/api/import/progetti-csv/route.ts`
  - gli header del file vengono ora normalizzati prima del mapping righe:
    - `trim()`
    - `lowercase`
    - rimozione BOM
    - rimozione caratteri invisibili / spazi non standard
    - spazi convertiti in `_`
  - aggiunta anche una mappa alias per varianti comuni:
    - `Cliente` -> `cliente`
    - ` nome_progetto ` -> `nome_progetto`
    - `nome progetto` -> `nome_progetto`
    - `rif progetto` -> `nome_progetto`
- Debug temporaneo:
  - log `console.info("[import-progetti-csv][headers]", ...)` con:
    - `original_headers`
    - `normalized_headers`
- Effetto:
  - `cliente` e `nome_progetto` vengono letti correttamente anche da TSV/CSV con intestazioni sporche o formattate da Google Sheets

## Update 2026-03-24 - Import progetti placeholder data vuoti

- `app/api/import/progetti-csv/route.ts`
  - i placeholder data non vengono piu validati come date reali
  - valori trattati come vuoti/null:
    - `-`
    - `—`
    - stringa vuota
    - solo spazi
    - `n.d.`
    - `nd`
    - `null`
- Campi coperti:
  - `data_prevista`
  - `data_tassativa`
  - `data_installazione_reale`
  - `saas_scadenza`
  - `garanzia_scadenza`
- Effetto:
  - il placeholder `-` non genera piu errore `data non valida`
  - una data davvero malformata continua invece a produrre errore

## Update 2026-03-24 - Import progetti indirizzo/maps + scadenze SaaS/licenza

- `app/api/import/progetti-csv/route.ts`
  - `indirizzo` continua a salvare su `checklists.impianto_indirizzo`
  - aggiunti alias header anche per eventuali colonne tipo `link maps` / `google maps`, mappate sempre su `indirizzo`
  - `saas_scadenza` resta salvata su `checklists.saas_scadenza`
  - aggiunta nuova colonna supportata `licenza_scadenza`
    - applicata come scadenza di default alle licenze importate in `licenses.scadenza`
    - con `on_conflict=update` aggiorna anche la scadenza delle licenze gia esistenti dello stesso tipo
- `app/checklists/[id]/page.tsx`
  - `Indirizzo impianto` usa ora rendering link-safe: se il valore importato e' un URL Google Maps/http, viene mostrato come link cliccabile
- `app/import-progetti/page.tsx`
  - testo template/import aggiornato per rendere esplicite le colonne supportate, incluse:
    - `indirizzo`
    - `saas_scadenza`
    - `licenza_scadenza`

## Aggiornamento rapido (19 marzo 2026)

- `fix: allineamento blocco interventi checklist con saas_interventi` in corso locale.
- Causa reale del disallineamento:
  - `app/checklists/[id]/page.tsx` caricava gli interventi progetto tramite il wrapper `db(...)` su `/api/db`
  - nello stesso flow faceva anche una select su `saas_interventi` filtrata solo per `contratto_id`
  - il wrapper per `saas_interventi` richiede almeno uno tra `id`, `checklist_id`, `cliente_id`, `cliente`
  - la query con solo `contratto_id` produceva `Missing required eq filter: one of [id, checklist_id, cliente_id, cliente]`
- Fix applicato:
  - `loadProjectInterventi(checklistId)` legge ora direttamente da `dbFrom("saas_interventi")`
  - filtro reale usato per la scheda progetto: `.eq("checklist_id", checklistId)`
  - stessa source of truth dominio usata dalla pagina admin: tabella reale `saas_interventi`
  - il conteggio `interventi inclusi usati` usa ora anch'esso `checklist_id + contratto_id`
- Effetto:
  - la checklist/progetto mostra gli stessi interventi reali associati a quella checklist che alimentano anche `/admin/interventi-da-chiudere`
  - il blocco `Interventi` continua a mostrare ticket, descrizione, stato, fatturazione e azioni dal dataset reale
  - nessuna modifica alla logica admin

- `feat: import progetti CSV esteso` in corso locale.
- `app/api/import/progetti-csv/route.ts`
  - mantiene parsing CSV `;` compatibile ma ora supporta anche i campi:
    - `indirizzo`
    - `referente_cliente`
    - `contatto_referente`
    - `codice_magazzino`
    - `link_drive_magazzino`
    - `seriali_elettroniche_controllo`
    - `seriali_moduli_led`
    - `descrizione_impianto`
    - `passo`
    - `quantita_impianti`
    - `dimensioni`
    - `tipo_impianto`
    - `data_installazione_reale`
    - `piano_saas`
    - `servizio_saas_aggiuntivo`
    - `saas_scadenza`
    - `garanzia_scadenza`
    - `tipo_struttura`
    - `saas_note`
    - `licenze`
    - `accessori_ricambi`
    - `proforma`
  - `dry_run` e `on_conflict=skip|update` restano supportati
  - warning non bloccanti aggiunti per:
    - codici catalogo non trovati
    - seriali/licenze/accessori non importati
    - colonne `checklists` non presenti nello schema runtime
- Mapping attuale:
  - `checklists`:
    - base progetto + date + stato
    - impianto (`magazzino_importazione`, `magazzino_drive_url`, `impianto_indirizzo`, `impianto_descrizione`, `passo`, `impianto_quantita`, `dimensioni`, `tipo_impianto`)
    - SaaS (`saas_piano`, `saas_tipo`, `saas_scadenza`, `saas_note`)
    - struttura (`tipo_struttura`)
    - garanzia (`garanzia_scadenza`)
  - tabelle correlate:
    - `asset_serials` per `seriali_*`
    - `licenses` per `licenze`
    - `checklist_items` per `accessori_ricambi`
- Allineamento dominio import progetti CSV:
  - il tag reale `Rif. Check List` / colonna `Progetto` dashboard usa `checklists.nome_checklist`
  - `codice_progetto` CSV importa quindi su `checklists.nome_checklist`
  - `proforma` CSV resta separata su `checklists.proforma`
  - una stessa `proforma` puo comparire su piu progetti senza warning
  - per compatibilita' con file legacy, se `codice_progetto` manca la route usa `nome_progetto`
- Limite noto:
  - `servizio_saas_aggiuntivo` supporta CSV multipli ma `checklists.saas_tipo` accetta un solo valore
  - il primo valore va in `saas_tipo`, gli extra vengono serializzati in `saas_note` con warning

- `fix: api import multipart non deve redirectare a login` in corso locale.
- Causa reale di `Server action not found` su `POST /api/import/progetti-csv`:
  - `middleware.ts` intercettava anche `/api/*`
  - in assenza di cookie sessione faceva `redirect("/login")`
  - su una `POST multipart/form-data` il redirect portava la richiesta su una pagina App Router invece che sulla route API, producendo la risposta `Server action not found`
- Fix minimale:
  - per richieste `/api/*` non autenticate il middleware restituisce ora `401 JSON`
  - non effettua piu redirect HTML verso `/login`
  - la route `app/api/import/progetti-csv/route.ts` puo quindi rispondere come normale route handler multipart
- Effetto:
  - `/api/import/progetti-csv` non viene piu confusa con una pagina/server action
  - la risposta torna coerente con dominio API anche quando manca autenticazione

- `fix: auth import progetti allineata alla sessione app` in corso locale.
- Causa reale del `401 Unauthorized` residuo su `POST /api/import/progetti-csv`:
  - la route import validava solo il cookie legacy `sb-access-token`
  - la sessione browser reale dell'app puo invece essere salvata nei cookie Supabase `sb-<ref>-auth-token`, anche in forma chunked
- Fix auth:
  - `app/api/import/progetti-csv/route.ts` usa ora `requireOperatore(request)` come le altre API protette dell'app
  - quindi legge la stessa sessione browser same-origin gia riconosciuta dalle pagine/API logged-in e riusa `adminClient` autenticato lato server
- Effetto:
  - da browser loggato, `fetch("/api/import/progetti-csv", { credentials: "include" })` viene autenticata correttamente
  - la route resta protetta e non viene resa pubblica

- `fix: import progetti CSV idempotente` in corso locale.
- Deduplica import:
  - la route usa solo `nome_progetto` come chiave di deduplica
  - `nome_progetto` viene normalizzato con `trim + uppercase`
  - il valore normalizzato viene salvato in `checklists.nome_checklist`
  - il match esistente usa ricerca case-insensitive e poi confronto su valore DB normalizzato (`trim + uppercase`)
- Effetto:
  - lo stesso CSV non reinserisce i progetti gia presenti
  - con `on_conflict=skip` i record esistenti finiscono in `skipped`
  - con `on_conflict=update` i record esistenti vengono aggiornati

- `feat: warning conflitti risorse cronoprogramma` in corso locale.
- Nuovo helper frontend:
  - `lib/operativiConflicts.ts`
  - confronta gli eventi operativi usando:
    - intervallo effettivo `data_inizio -> data_fine`
    - personale assegnato
    - mezzi assegnati
  - conflitto se:
    - i periodi si sovrappongono
    - e almeno una risorsa `personale` o `mezzi` coincide
- `app/cronoprogramma/page.tsx`
  - usa ora `checkOperativiConflicts(...)` sui dati gia presenti lato frontend

- `fix: cronoprogramma date operative + badge + personale manuale` in corso locale.
- Formula data fine corretta:
  - `data_fine = data_inizio + (durata_giorni - 1)`
  - quindi:
    - durata `1` => `data_fine = data_inizio`
    - durata `2` => `data_fine = data_inizio + 1`
- Causa reale del bug:
  - il calcolo era gia impostato come `N - 1`, ma alcuni passaggi usavano `Date` + `toISOString()` su date giornaliere
  - questo introduceva slittamenti di timezone e faceva apparire il giorno precedente in cronoprogramma
- Fix:
  - `lib/operativiSchedule.ts` usa ora aritmetica su giorno puro / UTC-safe per normalizzazione e `data_fine`
  - `app/cronoprogramma/page.tsx` usa formatter date coerente e mostra badge verde `Operativo definito` se esiste `data_inizio` o altro meta operativo valorizzato
  - rimossa la `datalist` di suggerimento automatico dal filtro `Personale previsto`
  - warning solo visivo, nessun blocco al salvataggio
  - ogni riga in conflitto mostra:
    - bordo rosso leggero
    - badge `⚠ Conflitto`
    - tooltip con dettaglio di personale/mezzi gia impegnati
- Nessuna modifica backend/API:
  - il controllo usa i meta operativi gia caricati dal cronoprogramma
  - considera anche la durata multi-giorno introdotta nei campi `data_inizio` e `durata_giorni`

- `feat: durata multi-giorno nei blocchi operativi e cronoprogramma` in corso locale.
- Source of truth confermata:
  - `cronoprogramma_meta` resta la fonte unica per i dati operativi di `INSTALLAZIONE`, `INTERVENTO`, `DISINSTALLAZIONE`
  - aggiunti nei meta i campi:
    - `data_inizio`
    - `durata_giorni`
  - `data_fine` resta derivata e non duplicata a DB
- UI aggiornate:
  - `app/checklists/[id]/page.tsx`
    - blocco installazione/disinstallazione con `Data inizio`, `Durata giorni`, `Data fine` calcolata
  - `components/InterventiBlock.tsx`
    - blocco dati operativi intervento con gli stessi campi
  - `app/clienti/[cliente]/page.tsx` e `app/checklists/[id]/page.tsx`
    - creazione/modifica intervento salvano sugli stessi meta `INTERVENTO`
- Cronoprogramma:
  - `app/cronoprogramma/page.tsx` usa ora il range operativo effettivo:
    - `data_inizio` esplicita se presente
    - altrimenti fallback alla data evento
    - `durata_giorni` fallback a `1`
  - i filtri data considerano sovrapposizione dell'intero periodo, quindi personale e mezzi restano impegnati su tutti i giorni del range
- DB:
  - aggiunta migration `scripts/20260320_add_cronoprogramma_operativi_duration.sql`
  - da eseguire manualmente in Supabase prima di usare i nuovi campi in produzione

- `fix: dashboard old setter names` in corso locale.
- `app/page.tsx`
  - nel catch/reset del `load()` dashboard erano rimasti setter legacy:
    - `setInterventiDaChiudereCount`
    - `setInterventiEntro7Count`
    - `setConsegneEntro7Count`
    - `setSmontaggiEntro7Count`
  - ora il reset usa solo gli state summary correnti:
    - `setInterventiDaChiudereSummary`
    - `setInterventiEntro7Summary`
    - `setConsegneEntro7Summary`
    - `setSmontaggiEntro7Summary`

- `fix: dashboard scadenze overdueCount fallback` in corso locale.
- `app/page.tsx`
  - `DashboardScadenzeSummary` richiede `count`, `breakdown` e `overdueCount`
  - nel catch del caricamento dashboard era rimasto un `setScadenzeByPeriod(...)` senza `overdueCount`
  - fix minimale:
    - aggiunto `overdueCount: 0` ai fallback `7 / 15 / 30`

- `fix: remove cast newIntervento to editIntervento` in corso locale.
- `app/clienti/[cliente]/page.tsx`
  - `extractClienteInterventoOperativi(...)` era tipizzata su `typeof editIntervento`
  - nel salvataggio nuovo intervento c'era quindi un cast forzato `newIntervento as typeof editIntervento`
  - fix minimale:
    - introdotto tipo base condiviso `ClienteInterventoOperativiInput`
    - `extractClienteInterventoOperativi(...)` accetta ora quello shape comune
    - rimosso il cast forzato sul salvataggio del nuovo intervento

- `fix: cliente scadenze item_tipo al posto di tipo` in corso locale.
- `app/clienti/[cliente]/page.tsx`
  - `ScadenzaItem` espone il campo reale `item_tipo`
  - erano rimasti accessi a `r.tipo` su oggetti `ScadenzaItem`, causando il build error TypeScript
  - fix minimale:
    - `getAlertKeyForRow()` usa solo `item_tipo`
    - `RenewalsAlertModal` riceve `contextTipo` da `item_tipo`

- `fix: type reset newProjectIntervento` in corso locale.
- `app/checklists/[id]/page.tsx`
  - `ProjectInterventoForm` era stato esteso con i campi operativi condivisi
  - un reset di `setNewProjectIntervento(...)` non includeva piu' tutti i campi richiesti dal tipo
  - fix minimale:
    - introdotto `buildEmptyProjectInterventoForm(...)`
    - riusato per `useState` iniziale e per tutti i reset di `newProjectIntervento`

- `fix: typing tipo alert-templates` in corso locale.
- `app/api/alert-templates/route.ts`
  - il payload `tipo` era tipizzato genericamente come `string | null`
  - il build TypeScript falliva perche il client Supabase si aspetta la union dominio `LICENZA | TAGLIANDO | GARANZIA | SAAS`
  - fix minimale:
    - `tipo` tipizzato come `ScadenzaAlertRuleType | null`
    - `ALLOWED_TIPI` riallineato a `SCADENZE_ALERT_RULE_TYPES`
    - aggiunta `normalizeTipo()` per convertire l'input stringa al tipo corretto senza cambiare la logica runtime
  - stesso riallineamento applicato anche a `trigger`:
    - `trigger` tipizzato come `ScadenzaAlertDefaultTemplateTrigger | null`
    - `ALLOWED_TRIGGER` tipizzato sulla union corretta
    - aggiunta `normalizeTrigger()` e rimozione dell'uso diretto di stringhe raw nel payload

- `fix: interventi aperti non visibili in interventi da chiudere` in corso locale.
- Causa reale:
  - `app/api/interventi/da-chiudere/route.ts` escludeva alcune righe usando `fatturazione_stato` come filtro forte
  - questo poteva nascondere interventi reali con `stato_intervento = APERTO` ma campi fatturazione legacy/non coerenti
  - nella UI progetto la colonna fatturazione mostra comunque `da chiudere` per gli interventi aperti, quindi il mismatch risultava evidente
- Correzione:
  - la route usa ora `stato_intervento` come fonte primaria
  - stati aperti trattati come inclusi: `APERTO`, `DA_CHIUDERE`, `IN_CORSO`, `IN_LAVORAZIONE`, `PENDENTE`, `PROGRAMMATO`
  - stati finali esclusi: `CHIUSO`, `COMPLETATO`, `CONCLUSO`, `ANNULLATO`, `FATTO`, `CONFERMATO`
  - `fatturazione_stato` resta solo fallback per record vecchi senza `stato_intervento`

- `feat: dati operativi condivisi per interventi` in corso locale.
- Source of truth unica:
  - i dati operativi intervento usano `cronoprogramma_meta` con `row_kind = INTERVENTO`
  - lettura/scrittura riusano `POST /api/cronoprogramma` con azioni `load` e `set_operativi`
- UI:
  - `components/InterventiBlock.tsx` mostra ora il blocco `Dati operativi intervento` sia in creazione sia in modifica
  - il blocco e' riusato sia da `app/clienti/[cliente]/page.tsx` sia da `app/checklists/[id]/page.tsx`
- Campi operativi allineati al cronoprogramma:
  - personale previsto / incarico
  - mezzi
  - descrizione attivita / note operative
  - indirizzo
  - orario
  - referente cliente + contatto
  - commerciale Art Tech + contatto
- Sincronizzazione bidirezionale:
  - pagina intervento -> salva su `saas_interventi` + `cronoprogramma_meta`
  - cronoprogramma -> continua a leggere/scrivere gli stessi meta `INTERVENTO`
  - apertura modifica intervento ricarica i meta dal cronoprogramma, quindi i dati restano allineati tra le due pagine

- `fix: pagina interventi da chiudere` in corso locale.
- Causa reale:
  - `app/api/interventi/da-chiudere/route.ts` non usava il dominio interventi reale
  - costruiva la lista da checklist `IN_CORSO` con task aperte e data installazione scaduta/odierna
  - quindi comparivano progetti senza alcun intervento reale in `saas_interventi`
- Correzione:
  - la route usa ora solo record `saas_interventi`
  - inclusi soltanto interventi non chiusi / non fatturati
  - la pagina admin mostra dati coerenti con il dominio: cliente, progetto, data intervento, descrizione/ticket, stato, apri checklist

- `ui: top scrollbar blocco interventi` in corso locale.
- `components/InterventiBlock.tsx` usa ora:
  - scrollbar orizzontale alta sempre visibile
  - scrollbar bassa reale sul contenuto tabella
  - sincronizzazione bidirezionale `scrollLeft`
- Il fix vale sia per:
  - `app/clienti/[cliente]/page.tsx`
  - `app/checklists/[id]/page.tsx`
  perche entrambe renderizzano il blocco condiviso `InterventiBlock`

- `ui: cockpit dashboard overdue counts` in corso locale.
- Layout cockpit riallineato:
  - riga 1: `SCADENZE IN ARRIVO` + `FATTURE DA EMETTERE`
  - riga 2: `INTERVENTI DA CHIUDERE` + `INTERVENTI ENTRO 7 GIORNI` + `CONSEGNE ENTRO 7 GIORNI` + `SMONTAGGI NOLEGGI ENTRO 7 GIORNI` + `NOLEGGI ATTIVI`
- Conteggi secondari aggiunti nel cockpit:
  - `Scadute non gestite` per `SCADENZE`
  - `In ritardo / Scadute` per interventi, consegne e smontaggi
- Route estese con query non breaking `?overdue=1`:
  - `/api/interventi/entro-7-giorni`
  - `/api/consegne/entro-7-giorni`
  - `/api/noleggi/smontaggi-entro-7-giorni`
- Regola:
  - un elemento nel passato continua a comparire nel cockpit finche non entra in uno stato finale coerente col dominio

- `feat: regole globali avvisi scadenze` in corso locale.
- Distinzione riallineata:
  - `scadenze_alert_global_rules` = regole globali automatiche per tipo scadenza
  - `alert_message_templates` = preset riusabili / default delle regole globali / override locali
  - `renewal_alert_rules` = override cliente sul flusso automatico gia esistente
- UI:
  - nuova pagina `Impostazioni -> Regole globali avvisi`
  - pagina `Preset avvisi` resa piu esplicita su tipo scadenza associato e uso reale
  - popup `Scadenze e Rinnovi` semplificato:
    - rimosso il flag ridondante `regola automatica attiva`
    - `Automatico` mostra la regola globale del tipo scadenza
    - `Override locale` gestisce preset/testo/destinatari solo per l'invio singolo
- Cron:
  - `GET /api/cron/scadenze-alert` usa ora `scadenze_alert_global_rules`
  - grouping per `cliente + tipo scadenza + step`
  - step supportati: `30 / 15 / 7 / 1`
  - eventuale preset default della regola globale viene applicato al subject/body
  - il log continua su `checklist_alert_log`, quindi `Ultimo invio` resta alimentato automaticamente
- DB:
  - aggiunta migration `scripts/20260319_add_scadenze_alert_global_rules.sql`
  - da eseguire manualmente in Supabase prima di usare la nuova pagina impostazioni

- `fix: persistenza data_disinstallazione + ripristino cockpit dashboard` in corso locale.
- Causa reale `data_disinstallazione`:
  - nel save checklist `app/checklists/[id]/page.tsx` esisteva un fallback che rimuoveva silenziosamente `data_disinstallazione` dal payload su errore compatibilita schema
  - il salvataggio poteva quindi andare in `ok` senza persistere il campo
- Causa reale cockpit dashboard:
  - la banda gialla in `app/page.tsx` era renderizzata solo se `scadenzeEntro7Count > 0`
  - quando il count scadenze andava a zero spariva tutto il cockpit, incluse le altre celle shortcut
- Correzione:
  - rimosso il fallback che scartava `data_disinstallazione`; ora il campo viene salvato oppure viene mostrato un errore esplicito di schema
  - il cockpit dashboard e' di nuovo sempre visibile, anche con `SCADENZE IN ARRIVO = 0`
- `feat: cronoprogramma mostra disinstallazioni noleggio + preset periodo` in corso locale.
- Causa reale:
  - `app/api/cronoprogramma/route.ts` riconosceva `DISINSTALLAZIONE` solo per meta/commenti
  - il loader `load_events` non selezionava `data_disinstallazione` e generava solo eventi `INSTALLAZIONE` e `INTERVENTO`
  - `app/cronoprogramma/page.tsx` filtrava/tipizzava solo `INSTALLAZIONE | INTERVENTO`
- Correzione:
  - i progetti `NOLEGGIO` con `data_disinstallazione` e stato `IN_CORSO` / `IN_LAVORAZIONE` / `CONSEGNATO` entrano ora come evento `DISINSTALLAZIONE`
  - aggiunti preset rapidi `7 / 15 / 30 giorni` sul filtro date del cronoprogramma, compatibili con il filtro manuale
- `fix: separa scadenze servizi da noleggi` in corso locale.
- Dashboard `SCADENZE IN ARRIVO` e pagina `/scadenze` usano entrambe `GET /api/scadenze`, che delega a `lib/scadenze/buildScadenzeAgenda.ts`.
- Causa reale mixed domain:
  - il builder aggregava anche righe collegate a checklist con `noleggio_vendita = 'NOLEGGIO'`
  - il count dashboard e la pagina `/scadenze` ereditavano quindi anche scadenze appartenenti al dominio noleggio
- Correzione mirata nel builder condiviso:
  - escluse dall'agenda scadenze le righe `garanzie`, `saas`, `tagliandi`, `licenze`, `rinnovi_servizi` collegate a checklist `NOLEGGIO`
  - invariato il flusso separato `GET /api/noleggi/smontaggi-entro-7-giorni`
- `fix: riallinea vincolo row_kind note task cronoprogramma` in corso locale.
- Causa reale errore note task:
  - UI `Storico note task` e API `/api/cronoprogramma` inviano gia `row_kind = 'CHECKLIST_TASK'`
  - il DB colpito dall'errore ha ancora un constraint `cronoprogramma_comments_row_kind_check` non allineato
- Aggiunta migration idempotente `scripts/20260319_fix_cronoprogramma_comments_row_kind_check.sql` per riallineare i valori ammessi a:
  - `INSTALLAZIONE`
  - `DISINSTALLAZIONE`
  - `INTERVENTO`
  - `CHECKLIST_TASK`
- `fix: abilita impostazioni per tecnico sw` in corso locale.
- Allineato il criterio di visibilita del bottone `Impostazioni` per includere anche `TECNICO_SW`.
- Verifica completata sui percorsi `app/impostazioni/*`:
  - non e' presente un blocco ruolo dedicato lato pagina
  - le pagine interne restano navigabili per utente autenticato
  - gli endpoint `api/admin/*` restano limitati ai ruoli admin e continuano solo a governare azioni admin specifiche dentro `Impostazioni > Operatori`

## Aggiornamento rapido (11 marzo 2026)

- Handoff riallineato prima dei prossimi sviluppi.
- Nuovo endpoint read-only aggregato scadenze: `GET /api/scadenze`
  - builder server-side: `lib/scadenze/buildScadenzeAgenda.ts`
  - fonti aggregate: `rinnovi_servizi`, `tagliandi`, `licenses`, `checklists`, `saas_contratti`
  - filtri supportati: `from`, `to`, `cliente`, `cliente_id`, `checklist_id`, `tipo`, `stato`
  - prima UI minima disponibile in `app/scadenze/page.tsx`
  - pagina read-only con filtri `from/to/cliente/tipo/stato` e tabella risultati
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
- preferenza cliente per invio scadenze: `clienti_anagrafica.scadenze_delivery_mode` con valori `AUTO_CLIENTE` / `MANUALE_INTERNO` (step iniziale: solo lettura/salvataggio UI, non ancora collegato al cron)
- notifiche checklist `TECNICO_SW`: eleggibilità basata sul campo reale `data_installazione_reale`, con fallback `data_tassativa` -> `data_prevista`; la data di oggi è valida, il passato no
- recovery dedicato disponibile su `POST /api/notifications/recover-tecnico-sw` per checklist `IN_CORSO` eleggibili non ancora inviate a `TECNICO_SW`
- cron automatico scadenze disponibile su `GET /api/cron/scadenze-alert`: usa la stessa agenda di `/api/scadenze`, gestisce step `30/15/7`, legge `clienti_anagrafica.scadenze_delivery_mode` e deduplica via `checklist_alert_log`

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

## Update 2026-03-23 - Regole globali avvisi schema compat + preset dropdown

- La pagina `/impostazioni/regole-globali-avvisi` usava solo lo schema legacy `tipo_scadenza / enabled_steps / default_template_id`.
- Era stato introdotto anche uno script alternativo con schema diverso (`tipo / step_giorni / preset_default`), creando disallineamento tra DB e UI.
- Fix applicato:
  - page load compatibile con entrambi gli shape (`legacy` e `modern`)
  - save con fallback `upsert` su `tipo_scadenza` oppure `tipo`
  - `/api/db` ora consente anche `tipo` e `attiva` per questa tabella
  - il caricamento dei preset non si ferma piu se il read delle regole fallisce
  - il select `Preset default` mostra stato vuoto coerente quando non ci sono preset compatibili
- `scripts/create_scadenze_alert_global_rules.sql` ora crea/riallinea la tabella al contratto reale usato dall'app e copia i dati dai nomi colonna alternativi se presenti.

## Update 2026-03-23 - Import progetti CSV auto-normalizza proforma, dimensioni e numeri

- La route `app/api/import/progetti-csv/route.ts` normalizza in ingresso:
  - `proforma`: `_` -> `/`
  - `dimensioni`: `_` e `,` -> `.`, poi compatta in formato `LxH`
  - numeri decimali import (`quantita_impianti`): `,` -> `.`
- Se una correzione automatica viene applicata, la route aggiunge un warning non bloccante `formato corretto automaticamente: <campo>`.
- Per `dimensioni` viene anche calcolato `m2_calcolati` / `m2_inclusi` dal formato normalizzato.

## Update 2026-03-23 - Modulo safety personale / aziende / documenti

- Aggiunto script DB `scripts/20260323_create_personale_aziende_safety_module.sql` con tabelle:
  - `aziende`
  - `personale`
  - `personale_documenti`
  - `aziende_documenti`
  - `document_types`
- Aggiunto whitelisting `/api/db` per CRUD su queste tabelle.
- Nuove pagine impostazioni:
  - `/impostazioni/aziende`
  - `/impostazioni/personale`
- Le pagine permettono:
  - anagrafiche aziende interne/esterne
  - anagrafiche personale interno/esterno con collegamento azienda
  - gestione documenti sicurezza per azienda e persona
- Nessuna integrazione ancora con cronoprogramma.

## Update 2026-03-23 - Badge conformità safety su cronoprogramma e blocchi operativi

- Aggiunto helper `lib/safetyCompliance.ts` con verifica documentale non bloccante su assegnazioni testuali da `personale_previsto`.
- Matching attuale:
  - persone: match per nome+cognome contro `personale`
  - aziende: match per ragione sociale contro `aziende`
- Controlli minimi:
  - personale: `Visita medica`, `Formazione generale`, `Formazione specifica`
  - aziende: `DURC`, `Visura camerale`
  - eventuali `abilitazioni/corsi` e documenti sicurezza azienda gia' presenti vengono segnalati se scaduti / in scadenza
- UI:
  - cronoprogramma: badge safety sulla riga evento
  - scheda progetto: badge nei blocchi installazione/disinstallazione
  - interventi progetto: badge nel form `Dati operativi intervento`
- Nessun blocco sul salvataggio: solo warning visivo (`verde/giallo/rosso`).

## Update 2026-03-23 - Personale operativo da elenco censito

- Il campo libero `personale_previsto` nei blocchi operativi progetto/intervento e' stato sostituito con `components/PersonaleMultiSelect.tsx`.
- Il componente:
  - carica il personale attivo da tabella `personale`
  - mostra `nome cognome`
  - se esterno aggiunge anche l'azienda
  - consente ricerca e selezione multipla con badge dei selezionati
- Compatibilita':
  - il valore salvato resta `personale_previsto` come stringa
  - formato emesso: `Mario Rossi; Luca Bianchi`
  - eventuali token legacy non riconosciuti vengono preservati e mostrati come badge `Legacy`, rimovibili manualmente

## Update 2026-03-24 - Safety badge trasparente + elenco standard atteso

- I criteri minimi safety restano invariati:
  - personale: `Visita medica`, `Formazione generale`, `Formazione specifica`
  - aziende: `DURC`, `Visura camerale`
- `SafetyComplianceBadge` ora mostra anche i motivi principali del giallo/rosso vicino al badge, oltre al tooltip completo.
- Aggiunto pannello `SafetyExpectedDocumentsPanel` nelle pagine impostazioni:
  - personale: `Visita medica`, `Formazione generale`, `Formazione specifica`, `Lavori in quota`, `Primo soccorso`, `Antincendio`, `Patente / patentini`
  - aziende: `DURC`, `Visura camerale`, `DVR`, `POS`, `Assicurazione / documento impresa`
- Per ogni voce il pannello mostra:
  - `Presente e valido`
  - `In scadenza`
  - `Scaduto`
  - `Mancante`
- Sistemato anche l'allineamento del flag `Attivo` nella pagina personale.

## Update 2026-03-26 - Normalizzazione runtime `stato_progetto` legacy

- Riallineati alcuni endpoint runtime al dominio `OPERATIVO` / `CHIUSO` usando `getEffectiveProjectStatus(...)`.
- Patch minime applicate in:
  - `app/api/cronoprogramma/route.ts`
  - `app/api/consegne/entro-7-giorni/route.ts`
  - `app/api/noleggi/smontaggi-entro-7-giorni/route.ts`
  - `app/api/notifications/on-checklist-create/route.ts`
  - `lib/notifications/checklistEligibility.ts`
  - `app/api/db/route.ts`
- Nel broker `/api/db` la normalizzazione in uscita riguarda solo `checklists` e `checklists_backup`; i filtri SQL raw non sono stati cambiati.
- Restano volutamente fuori, per patch futura separata:
  - `app/api/noleggi/attivi/route.ts`
  - `app/api/cron/noleggi-disinstallazione-alert/route.ts`
  - `app/api/fatture/da-emettere/route.ts`
  - `app/api/notifications/recover-tecnico-sw/route.ts`

## Update 2026-03-26 - Estratto blocco progetti dashboard in componente riusabile

- creato:
  - `components/dashboard/DashboardProjectsSection.tsx`
- aggiornato:
  - `app/page.tsx`
- scopo:
  - estrazione meccanica del blocco `filtri + tabella progetti` dalla home/dashboard
  - nessuna modifica funzionale a fetch, filtri, sorting, note operative inline o rendering tabella
- vincoli rispettati:
  - nessun tocco a cronoprogramma
  - nessun tocco a `app/layout.tsx`
  - nessuna nuova route `/dashboard` ancora introdotta

## Update 2026-03-26 - Nuova pagina `/dashboard` che riusa il blocco progetti

- creato:
  - `app/dashboard/page.tsx`
- la nuova pagina riusa `components/dashboard/DashboardProjectsSection.tsx`
- per questa fase il container di `/dashboard` duplica in modo conservativo la logica minima della home necessaria a:
  - fetch `/api/dashboard`
  - filtri e sorting client-side
  - note operative inline
  - azioni riga `Apri` / `Elimina`
  - lookup operatori per `Creato da` / `Modificato da`
- vincoli rispettati:
  - Home `/` invariata in questo step
  - nessun tocco a cronoprogramma
  - nessun tocco a `app/layout.tsx`

## Update 2026-03-26 - Home separata dalla dashboard progetti

- aggiornato:
  - `app/page.tsx`
- in Home restano:
  - header / top actions
  - cockpit KPI
  - form creazione progetto quando attivato
- rimosso dalla Home il blocco `filtri + tabella progetti`
- al suo posto inserito un placeholder intermedio con link chiaro a `/dashboard`
- nessun tocco a:
  - cronoprogramma
  - `app/layout.tsx`
