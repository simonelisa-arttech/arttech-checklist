# Source Of Truth — AT SYSTEM

Questo documento definisce le invarianti architetturali che Codex/Cowork deve assumere come base prima di modificare codice, query o flussi UI.

## Modello concettuale

- `progetto` = contenitore commerciale e amministrativo
- `impianto` = unita tecnica autonoma con storico proprio
- `cronoprogramma` = hub operativo principale
- blocco operativo condiviso = `cronoprogramma_meta` + `cronoprogramma_meta_slots` + `cronoprogramma_meta_referenti`

## Invarianti applicative

- Pagina progetto e cronoprogramma devono leggere e scrivere la stessa source of truth operativa.
- La source of truth dello stato progetto lato UI e filtri e `getEffectiveProjectStatus` in [lib/projectStatus.ts](/Users/MACBOOKSL/Documents/arttech-checklist/lib/projectStatus.ts).
- `OPERATIVO` e uno stato attivo.
- `CHIUSO` e solo lo stato finale.
- Il cronoprogramma non e una vista secondaria: e il centro operativo da cui dipendono timeline, stato attivita, note, allegati e parte della UX operatori.

## Progetto Vs Impianto

- Il progetto contiene dati condivisi, commerciali e amministrativi.
- L'impianto contiene lo storico tecnico locale.
- Gli impianti non sono sotto-record usa-e-getta del progetto: sono unita operative autonome.
- Lo storico tecnico corretto deve poter sopravvivere anche quando il progetto contiene piu impianti.

## Operativita

- Il blocco operativo condiviso vive su:
  - `cronoprogramma_meta` per stato corrente e dati comuni
  - `cronoprogramma_meta_slots` per giornate/slot
  - `cronoprogramma_meta_referenti` per i referenti condivisi
- La scrittura applicativa passa da [app/api/cronoprogramma/route.ts](/Users/MACBOOKSL/Documents/arttech-checklist/app/api/cronoprogramma/route.ts).
- Le UI principali che non devono divergere sono:
  - [app/cronoprogramma/page.tsx](/Users/MACBOOKSL/Documents/arttech-checklist/app/cronoprogramma/page.tsx)
  - [components/cronoprogramma/CronoprogrammaPanel.tsx](/Users/MACBOOKSL/Documents/arttech-checklist/components/cronoprogramma/CronoprogrammaPanel.tsx)
  - [components/cronoprogramma/OperationalBlockEditor.tsx](/Users/MACBOOKSL/Documents/arttech-checklist/components/cronoprogramma/OperationalBlockEditor.tsx)
  - [app/checklists/[id]/page.tsx](/Users/MACBOOKSL/Documents/arttech-checklist/app/checklists/[id]/page.tsx)
  - [components/DashboardCockpitPage.tsx](/Users/MACBOOKSL/Documents/arttech-checklist/components/DashboardCockpitPage.tsx)

## SAAS E Interventi

- La SAAS resta a livello progetto.
- Uscite e interventi devono essere tracciati per impianto.
- L'architettura corretta non e spostare la SAAS sugli impianti, ma tenere separati:
  - livello commerciale a progetto
  - livello tecnico sugli impianti toccati
- I riferimenti applicativi correnti sono:
  - [components/InterventiBlock.tsx](/Users/MACBOOKSL/Documents/arttech-checklist/components/InterventiBlock.tsx)
  - [lib/interventi.ts](/Users/MACBOOKSL/Documents/arttech-checklist/lib/interventi.ts)
  - [app/checklists/[id]/page.tsx](/Users/MACBOOKSL/Documents/arttech-checklist/app/checklists/[id]/page.tsx)

## Seriali Controllo

- `asset_serials.checklist_impianto_id` punta a `checklist_impianti`.
- Il collegamento seriale controllo -> impianto e parte della source of truth tecnica.
- I seriali storici con `checklist_impianto_id = null` restano validi, ma i nuovi salvataggi non devono rompere le associazioni esistenti.

## Note Task Operative

- Le note operative passano da `/api/cronoprogramma`.
- Le chiamate devono includere bearer token quando il flusso lo richiede.
- Questo punto e critico per non rompere autenticazione e scrittura note lato task/operatori.

## Regola Operativa Finale

- Se pagina progetto e cronoprogramma mostrano dati diversi sullo stesso blocco operativo, il sistema e in regressione.
- Se una modifica introduce una seconda source of truth locale, il fix e architetturalmente sbagliato anche se la UI sembra funzionare.
