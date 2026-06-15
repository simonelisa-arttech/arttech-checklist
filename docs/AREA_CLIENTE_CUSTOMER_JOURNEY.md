# Area Cliente — Customer Journey

> Documento funzionale dell'Area Cliente AT SYSTEM. Fonte di verità per nomenclatura e coperture:
> `CATALOGO_PIANI_ATSYSTEM.md` e `MODELLO_ASSISTENZA_ATSYSTEM.md`. Allineato al modello per-progetto
> e all'add-on **PREMIUM CLIENT**. Da validare prima dell'implementazione.

Versione: 2026-06-15

---

## 1. Scopo: strumento operativo condiviso, non portale documentale

L'obiettivo dell'Area Cliente **non è mostrare dati**, ma **guidare il cliente all'azione** e rendere
il dialogo con Art Tech più efficiente. È uno spazio operativo condiviso cliente ↔ Art Tech.

Obiettivi misurabili:
- ricevere assistenza più velocemente;
- ridurre chiamate ed email verso Art Tech;
- aprire **ticket corretti** (categoria + impianto giusti);
- individuare subito l'**impianto interessato**;
- consultare documenti e storico in autonomia;
- conoscere **copertura e scadenze** del proprio impianto;
- dialogare con Art Tech in modo strutturato e tracciabile.

Principio UX guida: **ogni schermata spinge verso un'azione utile** (apri ticket, rinnova, scarica,
contatta), non verso la semplice lettura.

---

## 2. Chi accede e come

- **Registrazione** (`/registrazione`): il cliente usa l'email aziendale comunicata in fase d'ordine.
  Se corrisponde all'anagrafica → accesso immediato; altrimenti richiesta in approvazione con
  notifica interna (entro 1 giorno lavorativo).
- **Scoping dati** (source of truth): `Cliente → Progetti → Piano → Impianti`. Il cliente vede
  **solo** i propri progetti/impianti e i relativi dati. Mai dati di altri clienti.
- **Accesso staff (impersonation)**: gli operatori Art Tech possono vedere l'area come il cliente
  (banner interno, invisibile al cliente) per supporto e verifica — è la natura "condivisa" dello strumento.

---

## 3. Architettura informativa (navigazione)

- **L0 — Home / Cruscotto**: saluto, copertura aggregata, scadenze imminenti, ticket aperti, CTA
  rapide ("Apri ticket", "I tuoi impianti").
- **L1 — "I tuoi impianti"**: elenco impianti raggruppati per progetto. Ogni card mostra:
  nome impianto, progetto, **copertura attiva** (badge piano), scadenza, badge **PREMIUM CLIENT** se attivo.
- **L2 — Dettaglio impianto** (il "fascicolo tecnico" dell'impianto):
  - copertura e scadenza, interventi residui (se previsti dal piano), referente, badge **PREMIUM CLIENT** se attivo;
  - **classificazione impianto**: badge **Critico / Strategico / Standard** (base futura per SLA e pianificazione);
  - **storico completo (fascicolo tecnico)**: installazione, interventi, sostituzioni, aggiornamenti, documenti, seriali hardware;
  - **CTA "Richiedi assistenza per questo impianto"** (precompila il ticket col contesto giusto);
  - **CTA commerciale "Richiedi ampliamento / upgrade / nuova installazione"** (genera opportunità).
- **Sezioni trasversali**: Assistenza/Ticket, Documenti, Scadenze. Tutte filtrabili per impianto/progetto.

---

## 4. I Customer Journey chiave

### J1 — "Ho un problema, voglio assistenza" (journey primario)
Obiettivo: ticket corretto, sul giusto impianto, con la copertura riconosciuta automaticamente.

1. Il cliente clicca **"Richiedi assistenza"** (da L0, da L1 o dal dettaglio impianto L2).
2. **Seleziona l'impianto** (se è partito dal dettaglio, è già selezionato).
3. AT SYSTEM determina **automaticamente** la copertura del progetto/impianto
   (`computeSupportTierForProgetto`): piano, garanzia, interventi residui, SLA, Premium Client.
4. **Sceglie la categoria del problema** (schermo senza immagine, luminosità/colori, pixel/zone
   spente, CMS/controllo, alimentazione, altro).
5. Compare la **verifica rapida guidata** della categoria (controlli da fare prima del ticket: riduce
   interventi inutili e chiamate).
6. Compila descrizione, **allega foto/video del problema** (diagnostica guidata: per i ledwall una
   foto/video spesso evita una telefonata e accelera la diagnosi) e (telefono facoltativo) invia.
7. **Messaggio adattato alla copertura**:
   - CARE ULTRA / ART TECH EVENT → «Hai diritto all'assistenza prioritaria, intervento incluso da contratto.»
   - CARE PLUS → «Assistenza inclusa secondo contratto.»
   - Garanzia → «Presa in carico in garanzia per i problemi coperti.»
   - Nessuna copertura → «Impianto fuori garanzia: l'intervento potrebbe essere a preventivo. Vuoi procedere?»
   - **PREMIUM CLIENT attivo** (qualsiasi piano) → canale diretto/prioritario (WhatsApp + referente) in evidenza.
8. Conferma ticket con numero; notifica interna allo staff (Reply-To = email cliente per aggancio CRM).
   Nessuna email automatica al cliente.

### J2 — "Quando scade il mio contratto / la garanzia?"
- In L1/L2 ogni impianto mostra **scadenze** con badge (ok / in scadenza / scaduto).
- CTA contestuale: "Richiedi rinnovo" → genera richiesta/contatto (non transazione automatica).

### J3 — "Mi serve un documento / contratto / fattura"
- Sezione **Documenti** filtrata per impianto/progetto: solo i documenti marcati visibili al cliente.
- Apertura sicura via link temporaneo; fatture scaricabili per numero.

### J4 — "Che copertura ho su questo impianto?"
- L2 mostra in chiaro: piano (Garanzia / CARE PLUS / CARE ULTRA / ART TECH EVENT), scadenza,
  interventi inclusi/residui (se previsti), e se è attivo **PREMIUM CLIENT** (con cosa comporta:
  referente + canale prioritario).

### J5 — "Voglio parlare con Art Tech"
- Canali sempre raggiungibili (email, WhatsApp, telefono, vista ticket).
- Con **PREMIUM CLIENT**: canale WhatsApp prioritario + referente dedicato in primo piano.
- Senza: canali standard, con invito a usare il ticket per tracciabilità.

### J6 — Primo accesso
- Onboarding breve: "Questi sono i tuoi impianti e la tua copertura. Da qui apri assistenza in 3 passi."

### J7 — "Voglio ampliare / fare upgrade / una nuova installazione" (opportunità commerciale)
- CTA **"Richiedi ampliamento / upgrade / nuova installazione"** in Home e nel dettaglio impianto.
- Genera una **richiesta commerciale (lead)** instradata al commerciale Art Tech, con contesto
  cliente/impianto/progetto già allegato.
- L'Area Cliente diventa così anche un **canale di generazione opportunità**, non solo di assistenza.

---

## 5. Cosa vede il cliente per livello di copertura

| | Garanzia | CARE PLUS | CARE ULTRA | ART TECH EVENT | Nessuna |
|---|---|---|---|---|---|
| Apertura ticket guidata | sì | sì | sì (priorità) | sì (priorità assoluta) | sì (→ preventivo) |
| Interventi inclusi/residui | difetti in garanzia | se previsti da contratto | sì | presidio evento | no |
| Messaggio assistenza | "in garanzia" | "incluso da contratto" | "prioritario incluso" | "prioritario evento" | "a preventivo" |
| **PREMIUM CLIENT** (se attivo) | incluso se società sportiva | opzionale | incluso | incluso | — |

PREMIUM CLIENT aggiunge **sempre** (a prescindere dal piano): referente dedicato, WhatsApp
prioritario, presa in carico accelerata. **Non** aggiunge interventi/SLA: quelli restano del piano.

---

## 6. Mappatura schermate ↔ dati (sistema reale)

Endpoint area cliente già esistenti (da estendere al per-progetto + Premium Client):

| Schermata | Dati / endpoint | Note |
|-----------|-----------------|------|
| Profilo / scoping | `/api/cliente/me` | settings di visibilità sezioni |
| L1 "I tuoi impianti" | `/api/cliente/progetti` (+ impianti) | raggruppare per progetto; copertura per progetto |
| L2 copertura | `computeSupportTierForProgetto` (nuovo, per-progetto) | oggi il tier è cliente-level → da portare a progetto |
| Scadenze | `/api/cliente/scadenze`, `/rinnovi`, `/tagliandi` | badge stato |
| Documenti | `/api/cliente/documenti` + `/documenti/{id}/download`, `/fatture/{n}` | solo visibili al cliente |
| Assistenza/Ticket | `/api/cliente/assistenza` (GET tier, POST ticket) | categorie + verifiche rapide già presenti |

Da costruire/evolvere: vista per-impianto L1/L2, `computeSupportTierForProgetto`, badge/flag
**PREMIUM CLIENT**, precompilazione ticket con impianto+copertura.

---

## 7. Lato Art Tech (lo strumento condiviso)

Lo stesso oggetto visto dal cliente è operativo anche per Art Tech:
- il **ticket** nasce già con cliente/progetto/impianto/piano/SLA/Premium Client → l'operatore non
  deve richiedere informazioni di base (meno email di chiarimento);
- coda prioritizzata per piano + Premium Client;
- impersonation per assistere il cliente vedendo esattamente la sua area;
- storico condiviso (interventi, documenti, comunicazioni).

---

## 8. Come l'Area Cliente riduce chiamate ed email

- **Verifiche rapide** prima del ticket → meno interventi/contatti inutili.
- **Ticket strutturato** (impianto + categoria + copertura) → meno scambi di chiarimento.
- **Stato ticket e scadenze visibili** → meno "a che punto siamo?" telefonici.
- **Documenti self-service** → meno richieste di invio.
- **Messaggi contestuali per copertura** → il cliente sa subito cosa aspettarsi (incluso vs preventivo).

---

## 9. Metriche di successo
- % ticket aperti dall'area vs email/telefono.
- % ticket con impianto e categoria corretti.
- Tempo medio di apertura ticket.
- Riduzione email/chiamate "di servizio" (stato, documenti, scadenze).
- Tasso di self-service (documenti/scadenze consultati senza contattare).

---

## 10. Requisiti funzionali sintetici (per implementazione futura)
1. Copertura calcolata **per progetto/impianto** (non cliente).
2. Badge **PREMIUM CLIENT** trasversale, con canale prioritario quando attivo.
3. Ticket precompilato con impianto + copertura + categoria + verifica rapida.
4. Sezioni filtrabili per impianto/progetto, scoping rigoroso per cliente.
5. Documenti/fatture self-service sicuri.
6. Coerenza totale di nomenclatura con il catalogo ufficiale.
7. **Diagnostica guidata con allegato foto/video** nel flusso ticket (J1).
8. **Classificazione impianto** (Critico / Strategico / Standard), base per SLA e pianificazione.
9. **Storico impianto = fascicolo tecnico** completo: installazione, interventi, sostituzioni,
   aggiornamenti, documenti, seriali.
10. **CTA commerciale** (ampliamento / upgrade / nuova installazione) → lead al commerciale Art Tech.

## 11. Punti da validare
- Quali documenti rendere visibili di default al cliente (contratti? fatture? report?).
- Mostrare gli **interventi residui** al cliente o solo internamente?
- Onboarding primo accesso: quanto guidato.
- Notifiche al cliente (oggi nessuna email automatica): introdurre stato ticket via area/email?
