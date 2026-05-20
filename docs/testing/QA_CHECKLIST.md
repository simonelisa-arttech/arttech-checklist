# QA CHECKLIST

## Progetto

- [ ] Creazione nuovo progetto con dati base completi.
- [ ] Modifica progetto esistente senza perdita dati anagrafici.
- [ ] Salvataggio `Proforma` e `Link Proforma`.
- [ ] Badge `PROFORMA MANCANTE` coerente in dashboard e pagina progetto.
- [ ] Referenti cliente caricati, modificati e rimossi correttamente.
- [ ] Deep-link dal progetto al cronoprogramma funzionante.

## Cronoprogramma

- [ ] Caricamento righe `INSTALLAZIONE`, `DISINSTALLAZIONE`, `INTERVENTO`.
- [ ] Editor operativo apribile dal cronoprogramma.
- [ ] Stato operativo visibile e modificabile senza regressioni.
- [ ] Filtri per stato, cliente, tipo attività e data coerenti.
- [ ] Focus progetto via query param funzionante.

## App Operatori

- [ ] Login operatore e caricamento sole attività assegnate.
- [ ] Visualizzazione indirizzo attività al posto del personale.
- [ ] Visibilità solo attività `CONFERMATA` o `RIMANDATA`.
- [ ] Note/report apribili e salvabili senza chiusure anomale.
- [ ] Allegati giornata apribili in read-only.

## Multi-giorno

- [ ] Ogni slot genera una riga distinta nel cronoprogramma.
- [ ] Date, ore e orari mostrati per slot corretto.
- [ ] Propagazione dati condivisi tra slot del blocco.
- [ ] `RIMANDATO` resta singola giornata.
- [ ] `FATTO` propaga `SVOLTA` al blocco multi-giorno.

## Multi-operatore

- [ ] Due operatori possono iniziare la stessa attività senza blocchi reciproci.
- [ ] Ogni operatore vede solo il proprio timer.
- [ ] Stop di un operatore non chiude l'attività per gli altri.
- [ ] Consuntivo manuale non bloccato da timbrature aperte di altri operatori.

## Allegati

- [ ] Allegati blocco checklist-level ancora visibili nel cronoprogramma.
- [ ] Allegati giornata slot-aware caricati sul solo slot corretto.
- [ ] Nessuna regressione su apertura/copia link.
- [ ] App Operatori mostra solo allegati giornata in read-only.

## FATTO / RIMANDATO

- [ ] Popup `FATTO` obbligatorio con esito, note, problemi, materiali.
- [ ] Scrittura storico in `cronoprogramma_activity_events`.
- [ ] Commento leggibile in `cronoprogramma_comments`.
- [ ] Popup `RIMANDATO` con nuova data e dettagli operativi.
- [ ] `RIMANDATO` non rompe i timer esistenti.

## Status operativi

- [ ] `BOZZA`
- [ ] `DA_CONFERMARE`
- [ ] `CONFERMATA`
- [ ] `RIMANDATA`
- [ ] `SVOLTA`
- [ ] `ANNULLATA`
- [ ] Fallback legacy corretto quando `status` è nullo.

## Interventi

- [ ] Creazione intervento con impianto salvato.
- [ ] Blocco corretto su impianto con id temporaneo.
- [ ] Persistenza `numero_fattura`, `fatturato_il`, `fattura_url`.
- [ ] Riepilogo fatture emesse coerente.

## Duplicazione progetto

- [ ] Duplica checklist senza copiare seriali, licenze, SaaS, tagliandi, garanzie, log avvisi.
- [ ] Copia impianti, checklist items e task con reset stato.
- [ ] Copia link proforma e campi progetto previsti.
- [ ] Duplicazione `checklist_items` robusta su ambienti legacy senza timestamp.

## Edge case legacy

- [ ] Record legacy senza `status`.
- [ ] Allegati senza `slot_id`.
- [ ] Slot senza meta dedicata completa.
- [ ] Progetti esistenti senza cabinet.
- [ ] Operatori con ruolo/reparto cambiato fuori dai target notifiche automatiche.
