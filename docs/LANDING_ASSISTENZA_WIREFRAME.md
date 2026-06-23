# Landing Assistenza — Wireframe definitivo (`maxischermiled.it/assistenza`)

> Wireframe testuale e dettagliato (nessun codice, nessun mockup grafico, nessuna immagine). Base
> per UI/UX → landing reale → integrazione HubSpot + Area Cliente → campagne. Fonti:
> `LANDING_ASSISTENZA_STRATEGY.md`, `LANDING_ASSISTENZA_FUNNEL.md`, `DECK_ASSISTENZA_13_SLIDE.md`,
> `CUSTOMER_LIFECYCLE_ARTTECH.md`, `MODELLO_ASSISTENZA_ATSYSTEM.md`, `SUPPORT_TIER_PER_PROGETTO.md`.
> Nomenclatura ufficiale; PREMIUM CLIENT = programma relazionale (non un piano); CARE PREMIUM assente.

Versione: 2026-06-15

Legenda: **AC** = Area Cliente (`atsystem.arttechworld.com`), **HS** = HubSpot (form/lead), **WA** = WhatsApp.

**Elementi globali**
- **Header (sticky):** logo Art Tech · menu minimale (Piani · Area Cliente · Contatti) · CTA "Area Cliente".
  - Desktop: logo a sinistra, menu+CTA a destra. Mobile: logo + hamburger; CTA "Area Cliente" sempre visibile.
- **Footer:** contatti (email ticket, WhatsApp, telefono), P.IVA, Privacy/Cookie, link Area Cliente.

---

## 1. Hero
- **Obiettivo:** catturare e indirizzare ai due percorsi (già cliente / valuta).
- **Contenuto:** headline ("La tua immagine sempre accesa — assistenza dedicata per ogni impianto LED"), subhead, 2 CTA, immagine ledwall, trust badge (25 anni, produzione propria, 35 nazioni).
- **CTA primaria:** "Accedi all'Area Cliente" → AC `/login`.
- **CTA secondaria:** "Scopri i piani" (scroll).
- **Area Cliente:** sì (`/login`, `/registrazione`). **HubSpot:** no.
- **Evento analytics:** `page_view`, `cta_click{section:hero,label}`.
- **Desktop:** split 60/40 (testo/immagine), CTA affiancate. **Mobile:** stack verticale, CTA full-width, immagine sotto.

## 2. Perché è diverso
- **Obiettivo:** differenziare (Area Cliente + AT SYSTEM vs tradizionale).
- **Contenuto:** confronto a 2 colonne — *Tradizionale* (telefono/email, caso per caso, nessuno storico) vs *Art Tech* (copertura riconosciuta per impianto, tracciabilità, proattività).
- **CTA primaria:** "Scopri come funziona" (scroll §3).
- **CTA secondaria:** "Apri l'Area Cliente" → AC `/login`.
- **Area Cliente:** sì (secondaria). **HubSpot:** no.
- **Evento:** `cta_click{section:perche_diverso}`, `scroll_50`.
- **Desktop:** due colonne affiancate. **Mobile:** card impilate (o toggle Prima/Dopo).

## 3. Come funziona la copertura
- **Obiettivo:** spiegare il modello per progetto/impianto.
- **Contenuto:** diagramma `Cliente → Progetti → Piano → Impianti` + 3 step ("ogni impianto ha la sua copertura"); nota: stesso cliente, impianti con piani diversi.
- **CTA primaria:** "Verifica la tua copertura" → AC `/login`.
- **CTA secondaria:** "Scopri i piani" (scroll).
- **Area Cliente:** sì. **HubSpot:** no.
- **Evento:** `cta_click{section:come_funziona,label:verifica_copertura}`.
- **Desktop:** diagramma orizzontale a step. **Mobile:** diagramma verticale.

## 4. Garanzia
- **Obiettivo:** presentare il livello base.
- **Contenuto:** card "Garanzia" — copre i difetti secondo condizioni di garanzia, verifiche guidate (no numeri/durate non confermati).
- **CTA primaria:** "Apri assistenza in garanzia" → AC `/login` → ticket.
- **CTA secondaria:** "Scopri CARE PLUS" (scroll §5).
- **Area Cliente:** sì (ticket). **HubSpot:** no (se non cliente → form contatto).
- **Evento:** `plan_view{plan:garanzia}`, `cta_click{section:garanzia}`.
- **Desktop/Mobile:** card piano (icona scudo); mobile a piena larghezza.

## 5. CARE PLUS
- **Obiettivo:** abbonamento base SAAS.
- **Contenuto:** card — gestione/cloud, diagnostica, monitoraggio, ticketing, aggiornamenti; PREMIUM CLIENT opzionale.
- **CTA primaria:** "Richiedi CARE PLUS" → HS form lead.
- **CTA secondaria:** "Confronta i piani" (scroll/anchor).
- **Area Cliente:** indiretto. **HubSpot:** sì (form lead, pipeline commerciale).
- **Evento:** `plan_view{plan:care_plus}`, `cta_click{plan:care_plus}`, `form_start{type:lead}`.
- **Desktop:** card in riga con ULTRA/EVENT. **Mobile:** card impilate / carosello.

## 6. CARE ULTRA
- **Obiettivo:** copertura avanzata per impianti critici.
- **Contenuto:** card — priorità, interventi inclusi (secondo contratto), SLA configurabile, PREMIUM CLIENT incluso (no cifre SLA non confermate).
- **CTA primaria:** "Passa a CARE ULTRA" → HS form lead/upsell.
- **CTA secondaria:** "Confronta i piani".
- **Area Cliente:** indiretto. **HubSpot:** sì.
- **Evento:** `plan_view{plan:care_ultra}`, `cta_click{plan:care_ultra}`.
- **Desktop/Mobile:** come §5; badge "consigliato".

## 7. ART TECH EVENT
- **Obiettivo:** eventi e noleggi temporanei.
- **Contenuto:** card — presa in carico immediata, priorità massima durante l'evento, presidio/on-site **secondo contratto** (nessun "on-site entro 1h" come regola).
- **CTA primaria:** "Richiedi assistenza evento" → HS form (urgente).
- **CTA secondaria:** "WhatsApp" → WA.
- **Area Cliente:** indiretto (per clienti: ticket). **HubSpot:** sì.
- **Evento:** `plan_view{plan:art_tech_event}`, `cta_click{plan:event}`, `whatsapp_click`.
- **Desktop/Mobile:** card; mobile con CTA WhatsApp ben visibile.

## 8. PREMIUM CLIENT
- **Obiettivo:** presentare il programma relazionale (trasversale, non un piano).
- **Contenuto:** banner trasversale — *Include:* referente dedicato, WhatsApp prioritario, presa in carico accelerata, comunicazione preferenziale; *Non include:* interventi gratuiti/SLA Ultra/illimitati/ricambi; *Dove:* incluso in CARE ULTRA, ART TECH EVENT, noleggi, garanzie nei casi previsti; opzionale su CARE PLUS.
- **CTA primaria:** "Attiva PREMIUM CLIENT" → HS form.
- **CTA secondaria:** "Parla con un referente" → WA.
- **Area Cliente:** badge (per chi è loggato). **HubSpot:** sì.
- **Evento:** `cta_click{section:premium_client}`, `whatsapp_click`.
- **Desktop:** fascia full-width trasversale (non una colonna piano). **Mobile:** card distinta con stile dedicato.

## 9. Area Cliente
- **Obiettivo:** mostrare lo strumento operativo condiviso.
- **Contenuto:** descrizione "I tuoi impianti" (L1) → dettaglio impianto (L2) con copertura/scadenze, documenti e **fascicolo tecnico**, ticket guidati, CTA commerciale ("ampliamento/upgrade/nuova installazione"). (Placeholder visivo, nessuna immagine in questo doc.)
- **CTA primaria:** "Entra nella tua Area Cliente" → AC `/login`.
- **CTA secondaria:** "Registrati" → AC `/registrazione`.
- **Area Cliente:** sì (login + registrazione). **HubSpot:** no.
- **Evento:** `cta_click{section:area_cliente,label:login|register}`, `registration_start`.
- **Desktop:** testo + mock affiancati. **Mobile:** mock sopra, bullet sotto.

## 10. Alert automatici
- **Obiettivo:** comunicare proattività e monitoraggio.
- **Contenuto:** monitoraggio diagnostico + alert scadenze/rinnovi (prevenzione fermi).
- **CTA primaria:** "Tieni i tuoi impianti sotto controllo" → AC `/registrazione`.
- **CTA secondaria:** "Scopri CARE PLUS/ULTRA" (scroll).
- **Area Cliente:** sì. **HubSpot:** no.
- **Evento:** `cta_click{section:alert}`.
- **Desktop:** 3 icone in riga (monitoraggio, alert, rinnovi). **Mobile:** lista verticale.

## 11. FAQ
- **Obiettivo:** ridurre attrito e obiezioni (anche per Quality Score campagne).
- **Contenuto:** accordion (copertura per impianto, cosa include ogni piano, PREMIUM CLIENT, come aprire un ticket, registrazione, fuori garanzia).
- **CTA primaria:** "Apri un ticket" → AC `/login`.
- **CTA secondaria:** "Contattaci" → HS form / WA.
- **Area Cliente:** sì. **HubSpot:** sì.
- **Evento:** `faq_open{question}`, `cta_click{section:faq}`.
- **Desktop:** accordion 2 colonne. **Mobile:** accordion 1 colonna.

## 12. CTA finale
- **Obiettivo:** chiusura della conversione.
- **Contenuto:** ricap valore + form lead breve + contatti (email/WhatsApp/telefono) + QR/URL Area Cliente.
- **CTA primaria:** "Registrati / Richiedi informazioni" → AC `/registrazione` **o** HS form.
- **CTA secondaria:** "WhatsApp" / "Chiama" → WA / `tel:`.
- **Area Cliente:** sì. **HubSpot:** sì (form).
- **Evento:** `form_submit{type:lead|register}`, `cta_click{section:final}`, `whatsapp_click`, `phone_click`.
- **Desktop:** form a sinistra, contatti a destra. **Mobile:** form sopra, contatti sotto, CTA full-width.

---

## Blocchi riutilizzabili vs blocchi che cambiano

**Riutilizzabili (condivisi tra tutte le varianti):** Header, Footer, §3 Come funziona, §8 PREMIUM
CLIENT, §9 Area Cliente, §10 Alert automatici, card piano (§4–7 come componenti), trust badge, FAQ (base).

**Cambiano per variante:**

| Variante | Hero (headline+CTA) | Sezioni in evidenza | CTA primaria | FAQ |
|----------|---------------------|---------------------|--------------|-----|
| `/assistenza` (canonica) | generico, doppia CTA | tutte | "Area Cliente" / "Scopri i piani" | completa |
| `/assistenza/rinnovi` | "Rinnova la tua copertura" | §6/§5 + scadenze | "Rinnova ora" → AC deep-link rinnovo | FAQ rinnovi |
| `/assistenza/upgrade` | "Passa a CARE ULTRA / Attiva PREMIUM CLIENT" | §6 + §8 + comparativa | "Fai l'upgrade" → HS/AC | FAQ upgrade |
| `/assistenza/eventi` | "Assistenza per il tuo evento" | §7 + WhatsApp + (QR `impianto`) | "Richiedi assistenza evento" → HS/WA | FAQ eventi |

> Sempre variabili: Hero, CTA primaria, "piano in evidenza", sottoinsieme FAQ, meta/SEO e UTM di default.

---

## Mappa completa delle CTA

| CTA | Sezione | Destinazione | Tipo |
|-----|---------|--------------|------|
| Accedi all'Area Cliente | Header/Hero/§9 | AC `/login` | Area Cliente |
| Registrati | Hero/§9/§10/§12 | AC `/registrazione` | Area Cliente |
| Scopri i piani / Confronta i piani | Hero/§3/§5–7 | scroll/anchor | Navigazione |
| Verifica la tua copertura | §3 | AC `/login` | Area Cliente |
| Apri assistenza (in garanzia) | §4/§11 | AC `/login` → ticket | Area Cliente |
| Richiedi CARE PLUS | §5 | HS form lead | HubSpot |
| Passa a CARE ULTRA | §6/§12(upgrade) | HS form lead/upsell | HubSpot |
| Richiedi assistenza evento | §7 | HS form / WA | HubSpot/WhatsApp |
| Attiva PREMIUM CLIENT | §8 | HS form | HubSpot |
| Parla con un referente | §8 | WA | WhatsApp |
| Contattaci | §11/§12 | HS form / WA / tel | HubSpot/WhatsApp |
| Richiedi informazioni (lead) | §12 | HS form | HubSpot |

## Mappa completa degli eventi analytics

`page_view` · `scroll_50` · `scroll_90` · `cta_click{section,label}` · `plan_view{plan}` ·
`form_start{type}` · `form_submit{type:lead|register|rinnovo|partner}` · `registration_start` ·
`registration_complete` · `ticket_open` · `whatsapp_click` · `phone_click` · `faq_open{question}` ·
`qr_landing{impianto}` (variante eventi/QR).

## Elenco dati raccolti dai form

- **Lead commerciale (CARE PLUS/ULTRA/EVENT, §5–7, §12):** nome, azienda, email, telefono, esigenza, consenso privacy.
- **Registrazione (§9/§12):** email aziendale (+ verifica), nome, azienda.
- **PREMIUM CLIENT (§8):** nome, azienda, email, telefono (interesse al programma).
- **Rinnovo/upgrade (varianti):** email/azienda + identificazione impianto/contratto + consenso.
- Principio: form minimi; arricchimento successivo in Area Cliente / HubSpot.

## Collegamenti verso AT SYSTEM e HubSpot

- **AT SYSTEM / Area Cliente:** `atsystem.arttechworld.com/login`, `/registrazione`, ticket guidato;
  deep-link con `impianto` per QL/QR (senza PII in URL). Determinazione copertura via
  `computeSupportTierForProgetto` (per progetto/impianto).
- **HubSpot:** form lead → pipeline (commerciale, rinnovi, partner); Reply-To cliente su ticket
  (email-to-ticket); owner/assegnazione per tipo lead.

---

## Punti da validare
1. Form: **HubSpot embedded** vs form custom che postano a HubSpot (campi/eventi/consenso).
2. Destinazione delle CTA "Richiedi <piano>": form HubSpot vs avvio registrazione Area Cliente.
3. Deep-link Area Cliente per rinnovi/QR (passaggio `impianto`/scadenza in modo sicuro).
4. Strumento analytics (GA4?) + cookie consent + naming definitivo eventi/UTM.
5. Numero WhatsApp ufficiale e orari/aspettative (no promesse non confermate).
6. Contenuti FAQ definitivi e loro varianti per rinnovi/upgrade/eventi.
7. Vincolo tecnico: la canonica è su WordPress (`maxischermiled.it`) — verificare il controllo su layout/blocchi riutilizzabili.
