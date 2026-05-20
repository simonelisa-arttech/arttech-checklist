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
