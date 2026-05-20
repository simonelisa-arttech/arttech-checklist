# QA HANDOFF

## Cosa testare ora

1. Stabilità progetto / cronoprogramma / App Operatori.
2. Workflow multi-giorno slot-aware.
3. Timbrature multi-operatore.
4. Workflow `FATTO` / `RIMANDATO`.
5. Allegati generali blocco e allegati giornata.

## Ordine consigliato

1. Smoke test generale.
2. Progetti e overview operative.
3. Cronoprogramma admin.
4. App Operatori.
5. Multi-giorno.
6. Multi-operatore.
7. Allegati.
8. Duplicazione progetto.
9. Edge case legacy.

## Cosa NON sviluppare prima del test

- Nuove dashboard operative avanzate.
- Estensioni App Operatori fuori dai fix critici.
- Nuove feature su allegati oltre il read-only già introdotto.
- Refactor profondi sui workflow cronoprogramma.

## Regola operativa

Prima stabilizzazione, poi nuove feature.

Finché la suite QA operativa non è passata:
- evitare feature di espansione dominio
- dare priorità a bug bloccanti e regressioni
- aggiornare i documenti QA dopo ogni fix rilevante
