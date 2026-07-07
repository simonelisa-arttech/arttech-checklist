# P4.6 — Knowledge Base Assistenza (T1–T13) + verifiche rapide

> **Obiettivo:** base di conoscenza per l'assistenza — risposte preformate staff (snippet HubSpot) e verifiche rapide guidate, fondamento per l'automazione delle risposte (integrazione P4.4).
> **Stato:** la parte **indipendente** (modello dati, 6 categorie con verifiche/risposte ideali/workflow, bozza mappa T1–T13) è pronta qui. I **testi verbatim T1–T13** e le **clausole legali §1** provengono dal documento "Testi Preformattati Assistenza (Rev. 1.0)" (da Simone) e richiedono **validazione legale** prima dell'uso verso il cliente (vedi §Note legali).
> Fonte: `docs/ASSISTENZA_FLUSSO_LEDCARE.md`, `components/ClienteAssistenzaSection.tsx` (verifiche rapide esistenti), 6 categorie ticket ATSystem.

## 1. Modello dati (snippet staff-only)

Ogni voce della knowledge base:
```
id            (es. T1, KB-NOIMAGE)
tipo          (verifica_rapida | risposta_staff | clausola_legale | faq)
scenario      quando si usa (fase ticket / categoria)
canale        cliente | staff-only
testo         contenuto (verbatim da doc per T1–T13; staff-only per §1)
clausole      riferimenti §1 collegati (staff-only)
automatizzabile  sì/no + condizione trigger
```
Regola: le clausole §1 e i template T1–T13 sono **staff-only** finché non validati legalmente; solo microcopy divulgativo va verso il cliente.

## 2. Le 6 categorie di richiesta (verifiche rapide + risposta ideale + workflow)

Allineate alle categorie del ticket guidato ATSystem. La "risposta ideale" è un template neutro; le varianti dipendono dal tier (Garanzia / CARE PLUS / CARE ULTRA / ART TECH EVENT) e dallo stato copertura.

### A. Schermo senza immagine (`noimage`)
- **Verifiche rapide (cliente):** alimentazione attiva (interruttore/quadro); player/sorgente segnale acceso; LED di stato sul retro; foto dello stato.
- **Domande guidate:** da quando? tutto lo schermo o una parte? LED di stato accesi? modello player?
- **Risposta ideale:** conferma presa in carico + richiesta foto/LED + primo tentativo di diagnosi remota; se non risolto → intervento secondo SLA del tier.
- **Workflow:** verifiche rapide → (se non risolto) apertura ticket con tier → diagnosi remota → intervento on-site.
- **FAQ / automatizzabile:** risposta automatica con checklist alimentazione+player; escalation al tecnico se LED spenti.

### B. Luminosità / colori anomali (`brightness`)
- **Verifiche rapide:** impostazioni luminosità nel CMS; sensore luminosità non ostruito; problema localizzato o diffuso; foto.
- **Domande guidate:** orario in cui accade? auto-brightness attivo? moduli specifici o tutto lo schermo?
- **Risposta ideale:** guida alla regolazione CMS + valutazione moduli; nota che la sostituzione moduli dipende da disponibilità ricambi.
- **Automatizzabile:** suggerimento impostazioni CMS; se moduli difettosi → flusso ricambi (T8/T9).

### C. Pixel / zone spente (`pixels`)
- **Verifiche rapide:** foto con coordinate della zona; numero moduli/pixel coinvolti; danno fisico (impatto) vs elettrico.
- **Risposta ideale:** presa in carico + richiesta foto dettagliata; nota che analisi/diagnostica sono addebitate a prescindere dall'esito (fuori garanzia).
- **Automatizzabile:** raccolta foto + stima moduli; preventivo ricambio se fuori copertura.

### D. CMS / sistema di controllo (`control`)
- **Verifiche rapide:** riavvio player (spegni 30s, riaccendi); connessione di rete; software CMS aggiornato; messaggi di errore.
- **Risposta ideale:** tentativo di **accesso remoto** prima dell'intervento fisico; guida al riavvio.
- **Automatizzabile:** procedura riavvio guidata; se persiste → sessione remota (ATV Cloud / EyeSmartPlayer).

### E. Alimentazione (`power`)
- **Verifiche rapide:** ⚠ non intervenire sull'impianto elettrico; interruttore dedicato nel quadro; scatti di protezione; LED alimentatore.
- **Risposta ideale:** sicurezza prima (nessun fai-da-te); verifica quadro; intervento tecnico su alimentatori/cablaggi.
- **Automatizzabile:** checklist sicurezza; escalation tecnico se protezioni scattate.

### F. Altro problema (`other`)
- **Verifiche rapide:** descrizione dettagliata + riferimenti (zona, orari, errori); foto.
- **Risposta ideale:** presa in carico + richiesta dettagli mirati; instradamento alla competenza giusta.

## 3. Mappa T1–T13 (BOZZA operativa — da riconciliare col documento reale + §1 legale)

Proposta di scenari lungo il ciclo del ticket (i **testi verbatim** e le **clausole** vanno dal documento "Testi Preformattati"; qui solo lo scopo di ciascun template):

| Cod. | Scenario | Uso | Automatizzabile |
|---|---|---|---|
| T1 | Presa in carico ticket | conferma ricezione + numero + tempi attesi | sì (auto-ack, già attivo) |
| T2 | Richiesta informazioni/foto mancanti | quando i dati sono insufficienti | sì |
| T3 | Diagnosi remota / guida verifiche | primo tentativo senza uscita | sì (per categoria) |
| T4 | Proposta appuntamento intervento on-site | pianificazione con SLA del tier | semi |
| T5 | Conferma intervento programmato | data/ora/tecnico | sì |
| T6 | Report intervento eseguito | esito + attività + eventuali importi | semi |
| T7 | Preventivo fuori garanzia / nessuna copertura | tier NESSUNA → offerta a preventivo | sì (trigger su tipo_richiesta=preventivo) |
| T8 | Gestione ricambio disponibile | tempi spedizione/sostituzione | semi |
| T9 | Ricambio irreperibile / obsolescenza | proposta alternativa/upgrade | no (valutazione) |
| T10 | Sollecito risposta cliente | ticket "in attesa cliente" | sì |
| T11 | Chiusura ticket | riepilogo + soddisfazione | sì |
| T12 | Escalation a responsabile tecnico | superata soglia SLA / complessità | semi |
| T13 | Follow-up post-intervento / upsell | rinnovo copertura / upgrade tecnologico | sì |

> Nota: la numerazione/È contenuto sopra è una **bozza da validare** con il documento reale (Rev. 1.0). Non usare verso il cliente prima della validazione legale.

## 4. Integrazione (P4.4 e automazione)
- I template **T1–T13** alimentano gli **snippet HubSpot** (workflow per stage: presa in carico, attesa cliente, escalation, chiusura) e le future **risposte automatiche**.
- Le **verifiche rapide** (§2) alimentano il form guidato in Area Cliente (già presenti, da estendere) e le risposte automatiche di primo livello.
- Trigger automatizzabili collegati agli stati/tier del design `docs/INTEGRAZIONE_HUBSPOT_ATSYSTEM.md` (T7 su preventivo, T12 su SLA-breach, T1/T10/T11 su cambio stage).

## 5. Note legali (vincolanti)
- Le **clausole §1** (estensione garanzia, addebito uscite, sicurezza D.Lgs. 81/2008, ricambi/irreparabilità, GDPR, foro, ecc.) sono **staff-only** e vanno inserite **verbatim dal documento validato**.
- **Validazione legale/commerciale obbligatoria** prima dell'uso, con attenzione B2B vs B2C (Codice del Consumo): limite reclamo 8 giorni, foro esclusivo ed esclusioni ampie possono risultare vessatori/nulli verso consumatori.
- **Nessun invio automatico** di template legali senza revisione caso-per-caso. Solo il microcopy divulgativo (non legale) può entrare lato cliente.

## 6. Stato implementazione
**IMPLEMENTATO (07/07/2026)** — `lib/assistenzaKnowledge.ts`:
- 6 verifiche rapide (customer-facing) come fonte canonica dei dati;
- template T1–T13 (bozze operative staff-only, non validate);
- clausole legali C-* come placeholder staff-only (`richiedeValidazione: true`);
- helper `suggerisciTemplate()` / `formatSuggerimenti()` — agganciati alla notifica staff in `app/api/cliente/assistenza/route.ts` (i template consigliati compaiono nella mail interna, sostituendo l'hint T7 hardcoded).

**Da completare (a valle, richiede input Simone):**
1. Documento **"Testi Preformattati Assistenza (Rev. 1.0)"** → per rimpiazzare le bozze T1–T13 col verbatim e per il testo delle clausole C-*.
2. **Validazione legale** dei testi customer-facing (B2B vs B2C, Codice del Consumo) prima di qualsiasi invio automatico.
3. Snippet HubSpot per stage (workflow) collegati ai template — con P4.4 già live.
4. Refactor UI: far importare a `ClienteAssistenzaSection.tsx` le `VERIFICHE_RAPIDE` da questo modulo (oggi duplicate) per single source of truth.
