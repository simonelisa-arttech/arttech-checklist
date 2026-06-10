# Do Not Break — AT SYSTEM

Checklist anti-regressione per aree fragili. Ogni modifica che tocca una di queste aree deve essere verificata contro questa lista prima del commit.

## 1. Blocco operativo condiviso progetto / cronoprogramma

- Cosa non rompere: progetto e cronoprogramma devono leggere e scrivere lo stesso blocco operativo condiviso, senza duplicare stato o perdere propagazione dei dati comuni.
- File principali: `app/api/cronoprogramma/route.ts`, `app/cronoprogramma/page.tsx`, `components/cronoprogramma/CronoprogrammaPanel.tsx`, `components/cronoprogramma/OperationalBlockEditor.tsx`, `app/checklists/[id]/page.tsx`, `components/DashboardCockpitPage.tsx`.
- Commit recenti rilevanti: `56f7495`, `d106ad4`.
- Sintomo tipico se si rompe: il progetto mostra operativi diversi dal cronoprogramma, oppure personale/mezzi/referenti spariscono o non si propagano.
- Check minimo prima del commit: modificare un blocco operativo dalla pagina progetto, aprire il cronoprogramma e verificare stessi dati e stessi badge.

## 2. Cronoprogramma INSTALLAZIONE / DISINSTALLAZIONE slot-aware

- Cosa non rompere: slot separati per giornata, dati comuni propagati sul blocco, `RIMANDATO` slot-specifico, comportamento `FATTO` compatibile con il blocco multi-giorno.
- File principali: `app/api/cronoprogramma/route.ts`, `app/cronoprogramma/page.tsx`, `components/cronoprogramma/CronoprogrammaPanel.tsx`, `lib/cronoprogrammaStatus.ts`.
- Commit recenti rilevanti: `56f7495`, `d106ad4`.
- Sintomo tipico se si rompe: due giornate collassano in una sola riga, oppure un rimando/fatto cambia slot sbagliati.
- Check minimo prima del commit: aprire un progetto con 2 slot, rimandare il secondo slot e verificare che il primo resti invariato.

## 3. Salva impianti

- Cosa non rompere: il salvataggio impianti non deve introdurre campi non supportati, non deve perdere righe valide e non deve spezzare i legami con seriali o dati tecnici esistenti.
- File principali: `app/checklists/[id]/page.tsx`, `app/api/checklists/[id]/route.ts`.
- Commit recenti rilevanti: `34e33d4`, `292f38b`, `c3a093f`.
- Sintomo tipico se si rompe: errore al salvataggio, impianti che spariscono dopo reload, o associazioni tecniche perse.
- Check minimo prima del commit: modificare un impianto esistente e salvare senza `data_disinstallazione`; poi ricaricare e verificare persistenza completa.

## 4. Associazione seriali controllo -> impianto

- Cosa non rompere: i seriali `CONTROLLO` devono mantenere il collegamento a `checklist_impianti`; il form non deve confondere `CONTROLLO` con altri seriali.
- File principali: `app/checklists/[id]/page.tsx`, `components/DashboardCockpitPage.tsx`.
- Commit recenti rilevanti: `adaeb64`, `c3a093f`, `292f38b`, `4013cfc`, `fa55ad7`.
- Sintomo tipico se si rompe: il seriale controllo perde l'impianto associato dopo save/reload, oppure viene mostrato l'impianto sbagliato.
- Check minimo prima del commit: associare un seriale controllo a un impianto, salvare, ricaricare la pagina e verificare che il link resti identico.

## 5. Interventi multi-impianto

- Cosa non rompere: gli interventi devono poter rappresentare `SINGOLO_IMPIANTO`, `IMPIANTI_SELEZIONATI` e `TUTTI_GLI_IMPIANTI` senza perdere retrocompatibilita legacy.
- File principali: `components/InterventiBlock.tsx`, `lib/interventi.ts`, `app/checklists/[id]/page.tsx`, `app/fatturazione-globale/page.tsx`.
- Commit recenti rilevanti: nessun hash dedicato stabilizzato nei file letti; area dipendente dall'architettura documentata e dai fallback legacy su `checklist_impianto_id`.
- Sintomo tipico se si rompe: dopo il reload lo scope cambia da solo, spariscono impianti selezionati o la UI ricade sempre su singolo impianto.
- Check minimo prima del commit: creare o modificare un intervento con 2 impianti, salvare e ricaricare verificando scope e selezione invariati.

## 6. Note checklist operative

- Cosa non rompere: le note operative e task note devono continuare a transitare via `/api/cronoprogramma` con autenticazione corretta.
- File principali: `app/api/cronoprogramma/route.ts`, `lib/interventoOperativi.ts`, `components/DashboardCockpitPage.tsx`, `app/operatori/page.tsx`.
- Commit recenti rilevanti: `02cab01`.
- Sintomo tipico se si rompe: aggiunta nota che fallisce in silenzio, `401/403`, oppure note che non compaiono dopo refresh.
- Check minimo prima del commit: aggiungere una nota operativa o task note e verificare scrittura, reload e assenza di errori auth/network.

## 7. Allegati slot-aware

- Cosa non rompere: devono coesistere allegati blocco checklist-level e allegati giornata con `slot_id` corretto.
- File principali: `app/api/attachments/route.ts`, `components/DashboardCockpitPage.tsx`, `app/cronoprogramma/page.tsx`, `components/cronoprogramma/CronoprogrammaPanel.tsx`.
- Commit recenti rilevanti: nessun hash dedicato confermato nei file letti; usare come riferimento i test `QA_ATTACHMENTS_TESTS.md` e `QA_CRONOPROGRAMMA_TESTS.md`.
- Sintomo tipico se si rompe: allegato giornata visibile su tutti gli slot, allegato legacy non piu visibile, oppure `slot_id` perso dopo save.
- Check minimo prima del commit: aggiungere un allegato a un solo slot e verificare che resti visibile solo nella sezione `Allegati giornata` di quello slot.

## 8. Commerciale Art Tech source of truth progetto

- Cosa non rompere: i dati `commerciale_art_tech_*` devono restare coerenti tra progetto, editor operativi e cronoprogramma, senza doppie fonti.
- File principali: `lib/interventoOperativi.ts`, `components/DashboardCockpitPage.tsx`, `app/api/cronoprogramma/route.ts`, `app/checklists/[id]/page.tsx`.
- Commit recenti rilevanti: `56f7495`, `d106ad4`.
- Sintomo tipico se si rompe: il commerciale Art Tech appare valorizzato in una vista e vuoto nell'altra, oppure viene sovrascritto da dati parziali.
- Check minimo prima del commit: salvare nome/contatto Art Tech dal blocco operativo e verificare stesso valore su pagina progetto e cronoprogramma.

## 9. Creazione nuovo progetto multi-impianto

- Cosa non rompere: il progetto deve restare contenitore commerciale, gli impianti devono nascere come unita tecniche distinte e la pagina progetto non deve mescolare i due livelli.
- File principali: `app/checklists/nuova/page.tsx`, `app/checklists/[id]/page.tsx`, `components/DashboardCockpitPage.tsx`.
- Commit recenti rilevanti: `34e33d4` per il salvataggio impianti; per il resto fare riferimento all'architettura `impianti-interventi-saas`.
- Sintomo tipico se si rompe: creazione progetto che genera impianti incompleti, impianti temporanei non risolti, o UI che tratta gli impianti come campi piatti del progetto.
- Check minimo prima del commit: creare un progetto con piu impianti e verificare che ogni impianto resti modificabile e distinto dopo reload.

## 10. SAAS / interventi / consuntivo

- Cosa non rompere: la SAAS resta a livello progetto, mentre uscite, interventi e consuntivo devono restare riconducibili agli impianti realmente toccati.
- File principali: `components/InterventiBlock.tsx`, `lib/interventi.ts`, `app/checklists/[id]/page.tsx`, `app/fatturazione-globale/page.tsx`.
- Commit recenti rilevanti: nessun hash dedicato confermato nei file letti; area guidata dall'architettura documentata in `impianti-interventi-saas-architecture.md`.
- Sintomo tipico se si rompe: consumo SAAS ambiguo, fatturazione che perde il legame con gli impianti, o consuntivo che non distingue tecnico da commerciale.
- Check minimo prima del commit: creare/modificare un intervento con dati SAAS e verificare che il progetto mantenga il contesto commerciale mentre gli impianti interessati restano tracciabili.

## Regola Finale

- Se una modifica tocca una delle aree sopra, non basta che compili: deve superare almeno il check minimo dell'area coinvolta.
- Se il fix introduce una seconda source of truth locale, il rischio regressione e alto anche in assenza di errori immediati.
