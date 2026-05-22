# QA SCENARIOS

## Scenario 1 — Progetto 1 giorno

- Creare progetto con una sola giornata operativa.
- Confermare lo stato operativo.
- Verificare presenza in cronoprogramma e App Operatori.
- Chiudere attività con `FATTO`.
- Verificare commento, evento storico e `SVOLTA`.

## Scenario 2 — Progetto 2 giorni

- Creare progetto con due slot.
- Verificare due righe separate in cronoprogramma.
- Controllare date e ore specifiche per giornata.
- Modificare personale e descrizione.
- Verificare propagazione dati condivisi su entrambi gli slot.

## Scenario 3 — Installazione + disinstallazione

- Configurare progetto con blocco `INSTALLAZIONE` e `DISINSTALLAZIONE`.
- Verificare che compaiano come attività distinte.
- Confermare stato su entrambi.
- Controllare deep-link dal progetto al cronoprogramma.

## Scenario 4 — Due operatori stessa attività

- Assegnare due operatori allo stesso slot.
- Avviare timer del primo operatore.
- Verificare che il secondo possa avviare il proprio timer.
- Terminare solo il primo e controllare che il secondo resti attivo.

## Scenario 5 — Allegati giornata

- Aprire editor operativo nel cronoprogramma.
- Aggiungere link o documento solo allo slot corrente.
- Verificare visibilità nella sezione `Allegati giornata`.
- Verificare assenza di quel documento sugli altri slot.

## Scenario 6 — Rimando singola giornata

- Su blocco multi-giorno, rimandare solo il secondo slot.
- Verificare aggiornamento della sola giornata selezionata.
- Verificare evento storico `RIMANDATO`.
- Controllare che il primo slot resti invariato.

## Scenario 7 — Fatto su blocco multi-giorno

- Completare uno slot di un blocco multi-giorno.
- Verificare che per l’attuale comportamento il blocco venga marcato `SVOLTA`.
- Controllare commenti e storico sullo slot usato per il completamento.
- Verificare che non si rompano timbrature/report giornalieri.

## QA interventi multi-impianto

### Prerequisiti

- Disporre di un utente operatore/test valido con accesso alla dashboard interna.
- Disporre di un progetto con almeno 2 impianti reali in `IMPIANTI`.
- Verificare di poter aprire direttamente la pagina progetto interessata.
- Verificare che il progetto non abbia impianti temporanei `pending:*` o `__tmp__*`.
- Verificare che il progetto consenta salvataggio e modifica interventi senza errori preesistenti.

### Scenario A — Creazione intervento `SINGOLO_IMPIANTO`

- Aprire la sezione `Interventi` del progetto multi-impianto.
- Creare un nuovo intervento.
- In `Impianti interessati` selezionare scope `SINGOLO_IMPIANTO`.
- Scegliere un solo impianto reale dal progetto.
- Salvare l’intervento.
- Verificare in UI che l’intervento mostri ancora il singolo impianto selezionato.
- Ricaricare la pagina progetto.
- Verificare che lo scope resti `SINGOLO_IMPIANTO`.
- Verificare che l’impianto selezionato sia ancora visibile nel form di modifica.

Controlli attesi:
- `saas_interventi.checklist_impianto_id` valorizzato con l’impianto scelto.
- `saas_interventi_impianti` con una sola relazione per l’intervento.
- Nessun errore console o risposta API in errore.

### Scenario B — Creazione intervento `IMPIANTI_SELEZIONATI`

- Aprire la sezione `Interventi` del progetto multi-impianto.
- Creare un nuovo intervento.
- In `Impianti interessati` selezionare scope `IMPIANTI_SELEZIONATI`.
- Selezionare 2 impianti reali del progetto.
- Salvare l’intervento.
- Verificare in UI che l’intervento mostri i due impianti selezionati.
- Ricaricare la pagina progetto.
- Verificare che lo scope resti `IMPIANTI_SELEZIONATI`.
- Verificare che i 2 impianti siano ancora visibili come selezionati.

Controlli attesi:
- `saas_interventi_impianti` con 2 relazioni per l’intervento.
- `saas_interventi.checklist_impianto_id` valorizzato solo se la selezione effettiva si riduce a un impianto, altrimenti `null`.
- Nessun errore console o risposta API in errore.

### Scenario C — Creazione intervento `TUTTI_GLI_IMPIANTI`

- Aprire la sezione `Interventi` del progetto multi-impianto.
- Creare un nuovo intervento.
- In `Impianti interessati` selezionare scope `TUTTI_GLI_IMPIANTI`.
- Salvare l’intervento.
- Verificare in UI che l’intervento mostri `TUTTI_GLI_IMPIANTI`.
- Ricaricare la pagina progetto.
- Verificare che lo scope resti `TUTTI_GLI_IMPIANTI`.

Controlli attesi:
- `saas_interventi_impianti` con una relazione per ogni impianto reale del progetto.
- `saas_interventi.checklist_impianto_id` a `null`.
- Nessun errore console o risposta API in errore.

### Scenario D — Modifica `SINGOLO_IMPIANTO` -> `IMPIANTI_SELEZIONATI`

- Aprire un intervento già salvato come `SINGOLO_IMPIANTO`.
- Passare lo scope a `IMPIANTI_SELEZIONATI`.
- Selezionare 2 impianti reali.
- Salvare.
- Verificare che il form e la lista interventi riflettano la nuova selezione.
- Ricaricare la pagina.
- Verificare che restino scope e impianti selezionati corretti.

Controlli attesi:
- le relazioni precedenti vengano sostituite
- `saas_interventi_impianti` contenga solo i nuovi impianti scelti
- nessun collegamento residuo al vecchio singolo impianto

### Scenario E — Modifica `IMPIANTI_SELEZIONATI` -> `TUTTI_GLI_IMPIANTI`

- Aprire un intervento già salvato come `IMPIANTI_SELEZIONATI`.
- Passare lo scope a `TUTTI_GLI_IMPIANTI`.
- Salvare.
- Verificare che il form mostri `TUTTI_GLI_IMPIANTI`.
- Ricaricare la pagina.
- Verificare che tutti gli impianti del progetto risultino coperti.

Controlli attesi:
- `delete + insert` relazioni eseguito correttamente
- `saas_interventi_impianti` allineato a tutti gli impianti del progetto
- `saas_interventi.checklist_impianto_id` a `null`

### Scenario F — Reload e retrocompatibilità legacy

- Aprire un intervento storico con solo `checklist_impianto_id` legacy valorizzato e nessuna relazione in `saas_interventi_impianti`.
- Verificare che al caricamento venga ricostruito come `SINGOLO_IMPIANTO`.
- Aprire un intervento senza legacy e senza relazioni.
- Verificare che al caricamento venga ricostruito come `TUTTI_GLI_IMPIANTI`.

Controlli attesi:
- nessun crash se la tabella `saas_interventi_impianti` è vuota
- comportamento coerente con i fallback legacy

### Cosa verificare sempre

- UI:
  - scope visualizzato correttamente
  - impianti selezionati ancora visibili dopo il save
  - nessun reset inatteso del form
- Salvataggio:
  - l’intervento viene creato o aggiornato correttamente
  - nessun errore toast/modale/API
- Reload:
  - lo scope viene ricostruito correttamente
  - la selezione impianti resta coerente
- DB / query:
  - `saas_interventi.checklist_impianto_id` coerente con il legacy
  - `saas_interventi_impianti` coerente con la selezione reale
- Console / network:
  - assenza di errori JS
  - assenza di `400/500` sulle chiamate di save/load interventi

### Nota operativa QA

- Questo protocollo non introduce bypass auth e non richiede credenziali hardcoded.
- Il test browser va eseguito solo con un operatore valido già disponibile nell’ambiente.
- Se manca un utente test o un progetto multi-impianto accessibile, il QA va considerato bloccato per prerequisiti mancanti, non fallito applicativamente.
