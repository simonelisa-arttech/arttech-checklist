# Feature — Filtro piano attivo + Upsell nell'Art Tech Hub

> **Stato:** DESIGN/SPEC (pre-implementazione). Direttiva CEO via MAIN (07/07/2026).
> **Priorità:** implementare **dopo P4.6**. Questo documento è la specifica; il codice arriva in una fase successiva.
> **Repo:** `~/dev/arttech-clean` (ufficiale). **Fonte dati:** riuso di `lib/supportTier.ts`.

## 1. Obiettivo
Quando il cliente accede all'Art Tech Hub, il sistema:
1. **rileva il piano di assistenza attivo** su ATSystem (per progetto e aggregato cliente);
2. **propone azioni commerciali personalizzate** in base allo stato: rinnovo, upgrade di piano, tagliando/manutenzione programmata, upgrade software;
3. espone una **sezione Software/Upgrade** (Art Tech Channel / Channel PRIME / upgrade EyeSmartPlayer) acquistabile;
4. il tutto **transazionale nel Marketplace dell'Hub**, punto di atterraggio delle CTA della pagina commerciale `maxischermiled.it/assistenza` costruita da MKT.

Principio di coordinamento (anti-ridondanza): **MKT convince** (pagina pubblica, marketing, per tutti) → **Hub vende** (cliente loggato, dati reali, transazione). Nessun clone di contenuti/prezzi tra i due; l'Hub è la parte transazionale.

## 2. Fonte dati — riuso, nessuna nuova pipeline
La determinazione del piano è **già implementata** e va riusata così com'è:

- `computeSupportForCliente(db, clienteId)` → `SupportTierAggregatoCliente`:
  - `progetti[]` con, per ciascun progetto: `tier` (`GARANZIA|PLUS|ULTRA|EVENT|NESSUNA`), `source`, `scadenzaPiano`, `scadenzaGaranzia`, `supportoAttivo`, `supportoScaduto`, `interventi` (inclusi/residui), `premiumClient`, `impianti[]`, `legacy`;
  - aggregati: `bestTier`, `premiumClientAttivo`, `haLegacyDaRiallineare`.
- Gerarchia ufficiale confermata: `EVENT > ULTRA > PLUS > GARANZIA > NESSUNA`. **Mai** CARE PREMIUM come piano (SAAS-PR = legacy, flag `legacy`).
- `isDateActive()` per le scadenze; le date sono su `rinnovi_servizi.scadenza`, `saas_contratti.scadenza`, `checklists.saas_scadenza` / `garanzia_scadenza`.

→ La feature è un **layer di regole** sopra questo aggregato: nessuna nuova query sulla determinazione del tier.

## 3. Motore proposte (`lib/hubUpsell.ts` — nuovo)
Input: `SupportTierAggregatoCliente` + finestra di preavviso (giorni). Output: lista tipizzata di **proposte** per progetto/cliente.

Regole (bozza, da validare commercialmente):

| Trigger | Condizione | Proposta |
|---|---|---|
| **Rinnovo** | `supportoAttivo` e `scadenzaPiano` entro N giorni (default 60) | Rinnova {tier} in scadenza il {data} |
| **Rinnovo garanzia** | solo `GARANZIA` attiva e `scadenzaGaranzia` entro N giorni | Rinnova/estendi copertura |
| **Riattivazione** | `supportoScaduto === true` | Riattiva assistenza (era {tier}) |
| **Upgrade piano** | `tier ∈ {GARANZIA, PLUS}` | Passa a {tier superiore}: PLUS→ULTRA, GARANZIA→PLUS/ULTRA |
| **Tagliando** | previsto (scadenza `rinnovi_servizi.item_tipo=TAGLIANDO`) entro N giorni | Prenota tagliando/manutenzione programmata |
| **Upgrade software** | vedi §4 (indipendente dal tier) | Attiva/aggiorna Channel / Channel PRIME / EyeSmartPlayer |
| **Premium Client** | `!premiumClientAttivo` e `tier ∈ {PLUS}` | Aggiungi PREMIUM CLIENT (add-on relazionale) |

Note:
- La proposta di upgrade usa `PROGETTO_TIER_RANK` per calcolare il "livello superiore".
- Nessuna proposta se `haLegacyDaRiallineare` sul progetto → mostrare invece un flag "verifica copertura" (evita offerte su dati legacy non validi).
- Le proposte sono **suggerimenti commerciali**, non impegni contrattuali: prezzi non hardcodati (ATSystem non hardcoda i prezzi — SLA/interventi configurabili). Il prezzo puntuale arriva come preventivo/checkout.

## 4. Sezione Software / Upgrade
Catalogo software acquistabile, **indipendente dal tier assistenza**:

- **Art Tech Channel** — versione standard del canale editoriale/commerciale.
- **Art Tech Channel PRIME** — versione premium (contenuti più ricchi + funzioni avanzate). **In sviluppo** → stato `coming_soon` con raccolta interesse (lead), non acquisto immediato finché non rilasciato.
- **Upgrade EyeSmartPlayer** — aggiornamenti player/monitoraggio disponibili.

Modello dati proposto (nuova tabella `hub_software_catalogo`, additiva):
```
id, codice (channel | channel_prime | esp_upgrade_x), nome, descrizione,
stato (attivo | coming_soon | dismesso), acquistabile (bool),
prezzo_indicativo (nullable), note
```
+ tabella `hub_software_attivazioni` (cosa ha già il cliente) per mostrare "posseduto / disponibile / in arrivo". In assenza di questa tabella all'avvio: derivare "posseduto" da segnali esistenti (es. presenza EyeSmartPlayer sull'impianto) e trattare Channel/PRIME come "disponibile".

## 5. Marketplace transazionale (Hub) — readiness
La sezione `Marketplace` dell'Hub (già presente come struttura in `app/cliente/page.tsx`, `MARKETPLACE_ITEMS`) deve:
1. **mostrare i piani** e gli upgrade con lo stato del cliente (posseduto / rinnovabile / upgrade / in arrivo);
2. **ricevere le CTA** da `maxischermiled.it/assistenza` via deep-link (`/cliente?section=marketplace&...`), coerente con i deep-link già usati per Assistenza;
3. **avviare la transazione**.

⚠️ **Vincolo pagamenti (importante):** l'inserimento di dati di pagamento / carte e l'esecuzione di transazioni finanziarie **non** vanno automatizzati lato agente. Per la v1 il "acquisto" del Marketplace è un **checkout a richiesta**: genera una richiesta/ordine (stessa infrastruttura ticket/preventivo, tipo `RINNOVO`/`UPGRADE`/`SOFTWARE`) → sync HubSpot (come deal/ticket) → il commerciale chiude. Un pagamento self-service reale (es. Stripe) è una **decisione separata** (provider, fatturazione, IVA) da ratificare prima di implementarlo.

## 6. UX nell'Hub
- **Dashboard**: banner sintetico "Il tuo piano: {bestTier} · {n} proposte" → porta al Marketplace.
- **Assistenza**: già mostra la copertura; aggiungere link contestuale "rinnova/upgrade" quando `supportoScaduto` o `NESSUNA` (collegamento naturale col flusso preventivo P4.3).
- **Marketplace**: elenco proposte (§3) + catalogo software (§4), ciascuna con CTA → checkout a richiesta.
- Coerenza brand: card premium, nomenclatura ufficiale (CARE PLUS / CARE ULTRA / ART TECH EVENT / PREMIUM CLIENT), rosso brand `#C9142B`.

## 7. Integrazione HubSpot
Riuso di `lib/hubspot.ts` (P4.4): le richieste di rinnovo/upgrade/software diventano ticket/deal con proprietà `atsystem_*` dedicate (es. `atsystem_tipo_richiesta ∈ {rinnovo, upgrade, software}`) → il commerciale le lavora nella pipeline. Da definire se usare pipeline "Assistenza" o una pipeline commerciale separata (decisione con MKT/commerciale).

## 8. Fasi di implementazione (dopo P4.6)
1. `lib/hubUpsell.ts` — motore proposte puro (input aggregato tier → proposte), unit-testabile, nessun side-effect.
2. API `/api/cliente/hub/proposte` — espone le proposte al frontend (auth cliente, riuso `resolveClientePortalAuth`).
3. UI Marketplace: rendering proposte + catalogo software (stati posseduto/disponibile/in arrivo).
4. Checkout a richiesta → ticket/deal + sync HubSpot.
5. (Eventuale, decisione separata) pagamento self-service.
6. Migration additive: `hub_software_catalogo` (+ `hub_software_attivazioni`) e proprietà HubSpot per rinnovo/upgrade/software — in `/scripts`, applicate previa conferma.

## 9. Report d'impatto a 10 punti (regola obbligatoria ATSYSTEM)
1. **Gestionale:** nessuna modifica ai flussi interni; lettura sola del tier esistente.
2. **Area cliente/Hub:** nuove proposte + sezione software; additivo, non altera Assistenza P4.x.
3. **Assistenza:** collegamento contestuale rinnovo/upgrade (non modifica il flusso ticket).
4. **Customer-lookup:** riuso della stessa logica tier (coerenza garantita da `supportTier.ts`).
5. **Documenti/fascicolo:** nessun impatto (v1).
6. **Scadenziario:** legge le scadenze esistenti; non le modifica.
7. **Cataloghi/support tier:** introduce `hub_software_catalogo` (nuovo), non tocca i tier.
8. **SQL:** solo migration additive/idempotenti; nessuna scrittura su DB Web Platform (`fvjl...`).
9. **Test:** motore proposte unit-testato; E2E Marketplace (Playwright) sul checkout a richiesta.
10. **Rischi disallineamento:** prezzi non hardcodati (evita divergenza col listino); no offerte su progetti `legacy`; anti-ridondanza con la pagina MKT (CTA→Hub, no duplicazione contenuti).

## 10. Decisioni CEO / domande aperte
- **Pagamenti:** checkout a richiesta (v1) o pagamento self-service reale (provider da scegliere)?
- **Pipeline HubSpot:** rinnovi/upgrade nella pipeline "Assistenza" o in una pipeline commerciale dedicata?
- **Channel PRIME:** data/criteri di rilascio per passare da `coming_soon` ad acquistabile.
- **Finestra preavviso** rinnovi/tagliandi (default proposto: 60 giorni).
- **Prezzi indicativi** da mostrare in Hub: sì/no (o solo "richiedi preventivo")?
