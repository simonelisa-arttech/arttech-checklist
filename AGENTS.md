# AGENTS.md — AT SYSTEM / arttech-checklist

## Scopo del progetto AT SYSTEM
Questo repository gestisce il dominio operativo e commerciale di AT SYSTEM.

Il progetto deve restare coerente tra UI, logica applicativa, Supabase e workflow reali di commessa. Ogni agente AI deve leggere questo file prima di qualunque modifica e usarlo come contesto operativo minimo condiviso per Codex/Cowork.

## Regole operative
- Un solo step alla volta: prima capire lo stato reale, poi intervenire sul punto minimo necessario.
- Non modificare file manualmente: usare sempre patch esplicite e tracciabili.
- Usare sempre comandi copiabili.
- Flusso obbligatorio: prima analisi, poi patch, poi eventuale commit.
- Non fare SQL senza segnalarlo esplicitamente.
- Non fare commit se non richiesto.

## Source Of Truth Tecniche
- Stato progetto: usare `getEffectiveProjectStatus` come riferimento applicativo.
- `OPERATIVO` e uno stato attivo; `CHIUSO` e solo lo stato finale.
- Il blocco operativo condiviso si basa su `cronoprogramma_meta`, `cronoprogramma_meta_slots` e `cronoprogramma_meta_referenti`.
- Gli impianti sono unita tecniche autonome.
- Il progetto e il contenitore commerciale.
- I seriali controllo devono poter essere collegati a `checklist_impianti`.
- Il `SAAS` vive a livello progetto, ma gli interventi devono restare tracciati per impianto.

## Flussi Delicati Da Non Rompere
- Cronoprogramma.
- Blocchi operativi `INSTALLAZIONE` e `DISINSTALLAZIONE`.
- Salva impianti.
- Associazione seriali controllo -> impianto.
- Note checklist operative via `/api/cronoprogramma` con bearer token.
- Allegati.

## Regole DB / Supabase
- Se serve una migration SQL, fermarsi e chiedere conferma prima di scriverla o proporla come applicata.
- Non assumere colonne, tabelle, constraint o trigger non verificati direttamente.
- Tenere presente che in produzione puo esserci schema cache differente rispetto all'ambiente locale o mentale dell'agente.
- In caso di conflitto tra supposizioni del codice e database reale, prevale lo schema Supabase verificato.

## Workflow Di Verifica
Eseguire in questo ordine, salvo richiesta diversa:

```bash
git status --short
npx tsc --noEmit --pretty false
```

Regole operative finali:
- In commit includere solo i file richiesti.
- Non fare commit se non richiesto.
- Se viene richiesto il push, confermare esplicitamente destinazione e branch: `origin/main`.

## Recent Critical Fixes
- `56f7495` blocco operativo condiviso
- `d106ad4` dettagli operativi cronoprogramma
- `02cab01` auth note task
- `adaeb64` UI seriali controllo
- `34e33d4` save impianti senza `data_disinstallazione`
- `c3a093f` preserva associazioni seriali/impianti

## Riferimenti Operativi
- Leggere anche `PROJECT_CONTEXT.md` se presente e aggiornato.
- Leggere anche `HANDOFF_CONTEXT.md` per stato locale, note aperte e migrazioni manuali.
- Se c'e conflitto tra documentazione e schema DB, prevale sempre il database verificato.
