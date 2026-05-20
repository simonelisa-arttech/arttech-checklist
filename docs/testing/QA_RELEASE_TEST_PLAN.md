# QA RELEASE TEST PLAN

## Obiettivo

Validare la stabilità operativa del sistema prima di deploy critici o nuove feature su:
- progetti
- cronoprogramma
- App Operatori
- workflow multi-slot
- allegati e storico operativo

## Smoke test

- Accesso dashboard
- Accesso progetto
- Accesso cronoprogramma
- Accesso App Operatori
- Caricamento API principali senza errori bloccanti

## Regression test

- Creazione progetto
- Modifica progetto
- Salvataggio blocchi operativi
- Stati operativi
- FATTO / RIMANDATO
- Timbrature multi-operatore
- Allegati blocco e allegati giornata

## Mobile test

- App Operatori su viewport mobile
- Pulsanti `Inizia`, `Termina`, `Note / report`, `Allegati giornata`
- Wrap corretto di indirizzi e contenuti lunghi

## Multi-user test

- Due operatori sulla stessa attività
- Coordinatore che modifica stato mentre un operatore è in corso
- Verifica refresh e consistenza stato UI/DB

## Checklist finale verde / rosso

- [ ] Smoke test verde
- [ ] Regression test verde
- [ ] Mobile test verde
- [ ] Multi-user test verde
- [ ] Nessun bug bloccante aperto
- [ ] Nessun bug alta priorità non triagiato

## Decisione rilascio

- Stato finale:
- Data verifica:
- Responsabile QA:
- Go / No-Go:
