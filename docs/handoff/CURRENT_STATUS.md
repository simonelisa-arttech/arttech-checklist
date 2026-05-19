# CURRENT STATUS

Source of truth principali:
- `app/api/cronoprogramma/route.ts`
- `app/cronoprogramma/page.tsx`
- `components/cronoprogramma/CronoprogrammaPanel.tsx`
- `app/operatori/page.tsx`
- `app/checklists/[id]/page.tsx`
- `lib/projectStatus.ts`

Sistema attuale:
- slot-aware
- multi-operatore
- cronoprogramma centrale
- stati operativi introdotti
- workflow FATTO e RIMANDATO attivi
- timbrature indipendenti per operatore e slot

Snapshot funzionale:
- ogni giornata attivita' e' uno slot indipendente
- `cronoprogramma_meta` e' la source of truth dello stato operativo corrente
- `cronoprogramma_meta_slots` gestisce date, ore e orari per giornata
- `cronoprogramma_activity_events` conserva lo storico business (`COMPLETATO`, `RIMANDATO`)
- `cronoprogramma_comments` conserva note operative e report leggibili
- l'app operatori mostra solo attivita' `CONFERMATA` o `RIMANDATA`
- l'app operatori usa timer per operatore e per slot

Regole architetturali attive:
- `RIMANDATO` resta sempre slot-specifico
- `FATTO` propaga `SVOLTA` sul blocco multi-giorno per `INSTALLAZIONE` e `DISINSTALLAZIONE`
- dati comuni di blocco vengono propagati su tutti gli slot:
  - personale
  - mezzi
  - descrizione
  - indirizzo
  - referenti
  - commerciale
  - status

