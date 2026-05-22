# IMPIANTI / INTERVENTI / SAAS ARCHITECTURE

## Obiettivo

Definire un modello architetturale coerente per gestire:
- progetti con piu' impianti appartenenti alla stessa conferma ordine / proforma
- storia tecnica distinta per singolo impianto
- attivita' operative che possono riguardare un impianto, piu' impianti selezionati o tutti gli impianti del progetto
- interventi e consuntivi collegati sempre al singolo impianto o a un insieme esplicito di impianti
- SAAS collegata al progetto ma consumata dalle singole uscite tecniche

Questo documento non cambia il codice esistente. Definisce la direzione corretta per evolvere il sistema in modo incrementale e compatibile con l'architettura slot-aware attuale.

---

## 1. Modello concettuale corretto

### Entita' principali

`Progetto`
- contenitore commerciale e amministrativo
- rappresenta una singola conferma ordine / proforma / logica commerciale
- puo' contenere uno o piu' impianti solo se fanno parte dello stesso pacchetto commerciale
- e' la source of truth per:
  - cliente
  - proforma / conferma ordine
  - SAAS e pacchetti collegati
  - commerciale Art Tech
  - regole di fatturazione incluse / extra

`Impianto`
- unita' tecnica autonoma dentro il progetto
- deve avere storia tecnica distinta
- deve poter aggregare:
  - installazioni
  - disinstallazioni
  - interventi
  - ricambi
  - ore
  - costi extra
  - consuntivi
  - allegati tecnici

`Blocco operativo`
- contenitore operativo di progetto per `INSTALLAZIONE` o `DISINSTALLAZIONE`
- mantiene dati comuni di esecuzione
- puo' coinvolgere:
  - un impianto
  - piu' impianti espliciti
  - tutti gli impianti del progetto
- resta compatibile con il modello slot-aware:
  - un blocco operativo puo' avere piu' slot/giornate

`Slot`
- singola giornata operativa
- mantiene:
  - data
  - ore
  - orario
  - timbrature
  - note/report
  - stato giornaliero
- non sostituisce il legame con gli impianti: lo eredita dal blocco o dalla selezione di impianti del blocco

`Intervento`
- uscita tecnica o assistenza successiva all'installazione
- deve essere sempre riconducibile a:
  - un progetto
  - uno o piu' impianti interessati
- puo' avere:
  - dati operativi
  - ricambi
  - ore
  - costi extra
  - esito
  - consuntivo

`SAAS`
- resta associata al progetto, non al singolo impianto
- il consumo del pacchetto avviene sulle uscite/interventi
- ogni uscita deve dire esplicitamente quali impianti ha toccato

---

## 2. Regole progetto vs impianto

### Regole progetto

Il progetto deve contenere solo dati condivisi e commerciali:
- cliente
- riferimento progetto
- proforma / ordine
- commerciale Art Tech
- stato progetto
- SAAS / pacchetti
- regole fatturazione
- overview impianti

### Regole impianto

L'impianto deve contenere la storia tecnica locale:
- caratteristiche tecniche
- indirizzo / contesto installativo
- cabinet / configurazioni
- seriali e componenti
- interventi tecnici
- ricambi usati
- costi extra specifici
- consuntivi tecnici

### Invariante principale

Un progetto puo' essere multi-impianto solo se:
- stessa conferma ordine / proforma
- stessa logica commerciale
- stessa gestione SAAS / fatturazione di base

Se gli impianti hanno logica commerciale diversa, devono diventare progetti distinti.

---

## 3. Regole interventi per singolo / multiplo / tutti impianti

Ogni attivita' tecnica deve esprimere chiaramente il proprio perimetro impianti.

### Modalita' ammesse

`SINGOLO_IMPIANTO`
- l'attivita' riguarda un solo impianto
- e' il caso standard per assistenza, guasto, ricambio locale, sopralluogo specifico

`IMPIANTI_SELEZIONATI`
- l'attivita' riguarda un sottoinsieme esplicito di impianti del progetto
- utile per lavorazioni parziali, aggiornamenti, ricambi condivisi su alcuni impianti

`TUTTI_GLI_IMPIANTI`
- l'attivita' riguarda l'intero perimetro tecnico del progetto
- utile per installazioni iniziali o disinstallazioni globali

### Regola di tracciabilita'

Anche se un'attivita' e' di tipo `TUTTI_GLI_IMPIANTI`, il sistema deve poter ricondurre il consuntivo ai singoli impianti toccati.

Modello consigliato:
- il blocco/intervento salva il `scope` dell'attivita'
- in parallelo salva la lista esplicita degli impianti coinvolti
- `TUTTI_GLI_IMPIANTI` e' una semantica di UI/workflow, non un'assenza di riferimenti tecnici

---

## 4. Regole cronoprogramma e blocchi operativi

### Principio

Il cronoprogramma resta l'hub operativo principale.

### Cosa resta invariato

- `cronoprogramma_meta` come source of truth operativa corrente
- `cronoprogramma_meta_slots` per le giornate
- `slot_id` per timbrature, note, report, stato giornaliero
- `RIMANDATO` slot-specifico
- `FATTO` e stato `SVOLTA` compatibili con il modello attuale

### Cosa deve evolvere

Il blocco operativo di `INSTALLAZIONE` / `DISINSTALLAZIONE` deve poter portare:
- `impianto_scope`
  - `SINGOLO_IMPIANTO`
  - `IMPIANTI_SELEZIONATI`
  - `TUTTI_GLI_IMPIANTI`
- lista esplicita impianti coinvolti

### Regola pratica

I dati comuni del blocco restano a livello blocco:
- personale
- mezzi
- descrizione
- indirizzo operativo
- referenti
- commerciale

La storia giornaliera resta per slot:
- data
- ore
- orario
- timbrature
- note
- report

Il legame impianti deve stare a livello blocco operativo, con possibilita' futura di override per slot solo se emergera' un caso reale.

---

## 5. Regole SAAS e scalabilita' interventi

### Regola base

La SAAS si abbina al progetto.

### Regola di consumo

Ogni uscita tecnico / intervento:
- scala dal monte interventi previsto dal pacchetto SAAS del progetto
- indipendentemente dal fatto che tocchi uno o piu' impianti

### Dati che ogni uscita deve tracciare

- impianto o impianti interessati
- ore impiegate
- ricambi usati
- costi extra
- quota inclusa nel pacchetto
- quota da fatturare extra

### Regola consigliata

Il consumo SAAS deve essere per uscita, non per singolo impianto.

Motivo:
- il pacchetto e' commerciale a livello progetto
- la lavorazione puo' toccare piu' impianti nella stessa uscita

Pero' il dettaglio tecnico dell'uscita deve restare tracciato sugli impianti coinvolti.

---

## 6. Regole consuntivo / fatturazione

### Consuntivo operativo

Ogni intervento o blocco completato deve poter generare un consuntivo con:
- ore totali
- operatori coinvolti
- ricambi
- materiali
- costi extra
- esito tecnico
- scope impianti
- impianti effettivamente lavorati

### Fatturazione

La fatturazione resta a livello progetto, ma deve distinguere:
- incluso nel pacchetto / contratto
- extra fatturabile

### Regola consigliata

Il consuntivo deve conservare due livelli:

`Livello commerciale`
- aggregazione progetto
- incluso / extra
- riferimento SAAS / contratto

`Livello tecnico`
- dettaglio per impianto
- ricambi
- ore
- note tecniche

Questo evita di perdere la visibilita' economica di progetto e allo stesso tempo protegge la storia tecnica di impianto.

---

## 7. Proposta schema dati incrementale

Questa e' una proposta futura, non applicata.

### Nuovi concetti minimi consigliati

1. Tabella relazione blocco/intervento -> impianti
- serve per collegare in modo esplicito un'attivita' a uno o piu' impianti

2. Campo scope attivita'
- per distinguere:
  - singolo
  - selezionati
  - tutti

3. Consuntivo con split tecnico/commerciale
- senza spostare subito tutta la fatturazione

### SQL future consigliate ma NON applicate

#### A. Blocco operativo / cronoprogramma -> impianti

Tabella futura consigliata:
- `cronoprogramma_activity_impianti`

Campi minimi:
- `id uuid primary key`
- `row_kind text not null`
- `row_ref_id uuid not null`
- `slot_id uuid null`
- `checklist_impianto_id uuid not null`
- `scope_origin text not null`
- `created_at timestamptz not null default now()`

Uso consigliato:
- per `INSTALLAZIONE` / `DISINSTALLAZIONE` salvare di base i legami a livello blocco
- `slot_id` lasciato nullo nella fase iniziale

#### B. Interventi -> impianti multipli

Tabella futura consigliata:
- `saas_interventi_impianti`

Campi minimi:
- `id uuid primary key`
- `intervento_id uuid not null`
- `checklist_impianto_id uuid not null`
- `created_at timestamptz not null default now()`

Retrocompatibilita':
- mantenere `saas_interventi.checklist_impianto_id` come riferimento legacy al primo impianto / caso singolo

#### C. Consuntivo extra / incluso

Estensioni future consigliate su interventi o consuntivi:
- `saas_uscita_inclusa boolean`
- `saas_quota_interventi_scalata integer`
- `costi_extra_importo numeric`
- `costi_extra_descrizione text`

---

## 8. Fasi di implementazione consigliate

### Fase 1 - Chiarezza documentale e UI
- introdurre in UI il concetto di scope impianti:
  - singolo
  - selezionati
  - tutti
- senza ancora cambiare drasticamente il backend
- mantenere il campo legacy singolo impianto dove esiste

### Fase 2 - Interventi multi-impianto
- aggiungere il modello relazione `intervento -> impianti`
- mantenere `checklist_impianto_id` come fallback legacy
- aggiornare la UI Interventi per selezione multipla

### Fase 3 - Blocchi operativi multi-impianto espliciti
- aggiungere relazione `blocco operativo -> impianti`
- cronoprogramma continua a usare il modello slot-aware attuale
- il dettaglio impianti del blocco resta a livello blocco, non di slot

### Fase 4 - Consuntivo e SAAS
- introdurre esplicitamente:
  - incluso nel pacchetto
  - extra fatturabile
- collegare il consumo SAAS alle uscite/interventi

### Fase 5 - Storico tecnico per impianto
- dashboard tecnica per impianto
- timeline impianto con:
  - installazioni
  - interventi
  - ricambi
  - costi
  - consuntivi

---

## 9. Rischi regressione

### Rischio 1 - Confusione tra progetto e impianto

Se si spostano troppi dati tecnici sul progetto, si perde lo storico corretto per impianto.

### Rischio 2 - Rompere il modello slot-aware

Non bisogna trasformare gli slot in sostituto del legame impianto.
Gli slot servono per il tempo/giornata, non per il perimetro tecnico commerciale.

### Rischio 3 - Interventi legacy singolo impianto

Molti flussi attuali si appoggiano a `checklist_impianto_id` singolo.
La transizione deve restare compatibile finche' non sara' introdotta la tabella relazione multipla.

### Rischio 4 - Consumo SAAS ambiguo

Se si scala il pacchetto per impianto invece che per uscita, si altera la logica commerciale.

### Rischio 5 - Fatturazione extra poco leggibile

Se non si separa bene il livello tecnico dal livello commerciale, si rischia di rendere opaco cosa e' incluso e cosa e' extra.

---

## 10. Cosa NON modificare subito

Non modificare subito:
- il modello slot-aware del cronoprogramma
- la logica `FATTO` / `RIMANDATO`
- le timbrature per operatore e per slot
- la UI App Operatori
- la SAAS esistente a livello progetto
- il campo legacy singolo `checklist_impianto_id` sugli interventi
- i flussi fatturazione esistenti

### Motivo

Questi pezzi sono oggi gia' stabilizzati. La modifica corretta e' aggiungere un livello di relazione `attivita' <-> impianti`, non riscrivere i flussi esistenti.

---

## Raccomandazione finale

La direzione corretta non e' trasformare il progetto in un contenitore tecnico indifferenziato.

La direzione corretta e':
- progetto come contenitore commerciale unico
- impianto come unita' tecnica autonoma
- cronoprogramma come hub operativo
- slot come giornate operative
- interventi e consuntivi sempre riconducibili agli impianti toccati
- SAAS consumata per uscita ma rendicontata sugli impianti coinvolti

Questa strategia permette di crescere in modo incrementale senza rompere l'architettura attuale.
