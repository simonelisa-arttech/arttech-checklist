/**
 * P4.6 — Knowledge Base Assistenza (staff-only).
 *
 * Fonte struttura: docs/KNOWLEDGE_BASE_ASSISTENZA_P4.6.md (struttura validata MAIN, 07/07/2026).
 *
 * ⚠️ AVVERTENZA LEGALE — LEGGERE PRIMA DELL'USO
 * I testi T1–T13 di questo file sono BOZZE OPERATIVE staff-only, non validate.
 * Le clausole legali (§ CLAUSOLE) sono placeholder: il testo verbatim va inserito SOLO
 * dal documento "Testi Preformattati Assistenza (Rev. 1.0)" dopo validazione legale/commerciale
 * (attenzione B2B vs B2C — Codice del Consumo). NESSUN invio automatico di template legali
 * senza revisione caso-per-caso. Verso il cliente può andare solo microcopy divulgativo.
 */

export type CategoriaTicket =
  | "noimage"
  | "brightness"
  | "pixels"
  | "control"
  | "power"
  | "other";

export type TipoRichiesta = "assistenza" | "preventivo";
export type UrgenzaTicket = "bassa" | "media" | "alta";
export type CanaleKB = "cliente" | "staff-only";
export type GradoAutomazione = "si" | "semi" | "no";

/** Verifica rapida guidata (customer-facing) mostrata prima dell'apertura ticket. */
export interface VerificaRapida {
  categoria: CategoriaTicket;
  label: string;
  passi: string[];
  nota?: string;
  canale: CanaleKB;
}

/** Template di risposta staff lungo il ciclo del ticket (staff-only finché non validato). */
export interface TemplateStaff {
  id: string; // T1..T13
  scenario: string;
  uso: string;
  canale: CanaleKB;
  automatizzabile: GradoAutomazione;
  trigger?: string;
  /** Bozza operativa neutra — NON validata. Da rimpiazzare col verbatim Rev. 1.0. */
  testoBozza: string;
  /** id delle clausole legali collegate (staff-only). */
  clausole?: string[];
}

/** Clausola legale — placeholder staff-only, richiede sempre validazione. */
export interface ClausolaLegale {
  id: string;
  titolo: string;
  ambito: string;
  canale: "staff-only";
  richiedeValidazione: true;
  nota: string;
}

/** Suggerimento template per lo staff, con motivazione. */
export interface SuggerimentoTemplate {
  id: string;
  motivo: string;
}

// ---------------------------------------------------------------------------
// § VERIFICHE RAPIDE (customer-facing) — 6 categorie
// Nota: la UI in components/ClienteAssistenzaSection.tsx ha oggi le proprie
// stringhe. Questa è la fonte canonica: allineare la UI in un refactor successivo.
// ---------------------------------------------------------------------------

export const VERIFICHE_RAPIDE: Record<CategoriaTicket, VerificaRapida> = {
  noimage: {
    categoria: "noimage",
    label: "Schermo senza immagine",
    canale: "cliente",
    passi: [
      "Verifica che l'alimentazione sia attiva (interruttore e quadro elettrico)",
      "Controlla che il player/sorgente segnale sia acceso",
      "Osserva i LED di stato sul retro del pannello",
      "Prepara una foto dello stato attuale",
    ],
    nota: "La risoluzione può richiedere più di un intervento in base alla disponibilità ricambi.",
  },
  brightness: {
    categoria: "brightness",
    label: "Luminosità / colori anomali",
    canale: "cliente",
    passi: [
      "Accedi al CMS e controlla le impostazioni di luminosità",
      "Verifica che il sensore automatico di luminosità non sia ostruito",
      "Identifica se il problema è localizzato o diffuso",
      "Prepara foto del problema",
    ],
    nota: "La sostituzione di moduli LED dipende dalla disponibilità a magazzino.",
  },
  pixels: {
    categoria: "pixels",
    label: "Pixel / zone spente",
    canale: "cliente",
    passi: [
      "Fotografa la zona interessata indicando le coordinate approssimative",
      "Conta il numero di moduli/pixel coinvolti",
      "Verifica se il danno è fisico (impatto) o elettrico (zone nere regolari)",
    ],
    nota: "I costi di analisi e diagnostica sono addebitati indipendentemente dall'esito della riparazione (fuori garanzia).",
  },
  control: {
    categoria: "control",
    label: "CMS / sistema di controllo",
    canale: "cliente",
    passi: [
      "Riavvia il player (spegni, attendi 30 secondi, riaccendi)",
      "Controlla la connessione di rete del player",
      "Verifica che il software CMS sia aggiornato",
      "Annota eventuali messaggi di errore",
    ],
    nota: "Il team proverà prima un accesso remoto per risolvere senza intervento fisico.",
  },
  power: {
    categoria: "power",
    label: "Alimentazione",
    canale: "cliente",
    passi: [
      "⚠️ Non intervenire autonomamente sull'impianto elettrico",
      "Controlla l'interruttore dedicato nel quadro elettrico",
      "Verifica eventuali scatti di protezione",
      "Osserva i LED di stato sull'alimentatore",
    ],
    nota: "Il tecnico verificherà alimentatori e cablaggi durante l'intervento. Sicurezza prima di tutto.",
  },
  other: {
    categoria: "other",
    label: "Altro problema",
    canale: "cliente",
    passi: [
      "Descrivi il problema nel dettaglio (zona dello schermo, orari, messaggi di errore)",
      "Allega foto/video di riferimento se possibile",
    ],
    nota: "Il team valuterà la segnalazione e ti contatterà.",
  },
};

// ---------------------------------------------------------------------------
// § TEMPLATE T1–T13 (staff-only, BOZZE non validate)
// ---------------------------------------------------------------------------

export const TEMPLATE_STAFF: Record<string, TemplateStaff> = {
  T1: {
    id: "T1",
    scenario: "Presa in carico ticket",
    uso: "Conferma ricezione + numero + tempi attesi",
    canale: "staff-only",
    automatizzabile: "si",
    trigger: "creazione ticket (auto-ack)",
    testoBozza:
      "Gentile Cliente, abbiamo ricevuto la sua segnalazione (ticket #{numero}). Il team tecnico la prenderà in carico secondo la copertura attiva sul suo impianto. La aggiorneremo a breve.",
  },
  T2: {
    id: "T2",
    scenario: "Richiesta informazioni/foto mancanti",
    uso: "Quando i dati forniti sono insufficienti",
    canale: "staff-only",
    automatizzabile: "si",
    testoBozza:
      "Per procedere con la diagnosi le chiediamo di integrare la segnalazione con: foto/video del problema, orario in cui si verifica ed eventuali messaggi di errore.",
  },
  T3: {
    id: "T3",
    scenario: "Diagnosi remota / guida verifiche",
    uso: "Primo tentativo di risoluzione senza uscita on-site",
    canale: "staff-only",
    automatizzabile: "si",
    trigger: "categoria noimage/brightness/control",
    testoBozza:
      "Prima di pianificare un intervento tecnico, proviamo alcune verifiche guidate / un accesso remoto. Le indichiamo i passaggi in base alla tipologia del problema.",
  },
  T4: {
    id: "T4",
    scenario: "Proposta appuntamento intervento on-site",
    uso: "Pianificazione secondo SLA del tier",
    canale: "staff-only",
    automatizzabile: "semi",
    testoBozza:
      "Proponiamo un intervento tecnico on-site. In base alla copertura attiva, le date disponibili sono le seguenti: {date}. Ci confermi la preferenza.",
  },
  T5: {
    id: "T5",
    scenario: "Conferma intervento programmato",
    uso: "Data/ora/tecnico confermati",
    canale: "staff-only",
    automatizzabile: "si",
    testoBozza:
      "Confermiamo l'intervento per il {data} alle {ora}. Tecnico incaricato: {tecnico}. Le ricordiamo di garantire l'accesso al sito e l'eventuale referente in loco.",
  },
  T6: {
    id: "T6",
    scenario: "Report intervento eseguito",
    uso: "Esito + attività svolte + eventuali importi",
    canale: "staff-only",
    automatizzabile: "semi",
    testoBozza:
      "Intervento completato. Attività svolte: {attivita}. Esito: {esito}. Eventuali importi e ricambi sono riepilogati nel documento allegato.",
    clausole: ["C-USCITE", "C-RICAMBI"],
  },
  T7: {
    id: "T7",
    scenario: "Preventivo fuori garanzia / nessuna copertura",
    uso: "Tier NESSUNA → offerta a preventivo",
    canale: "staff-only",
    automatizzabile: "si",
    trigger: "tipoRichiesta = preventivo",
    testoBozza:
      "L'impianto non risulta coperto da garanzia o contratto attivo: l'assistenza è erogabile a pagamento previo preventivo. Le invieremo un'offerta entro 1 giorno lavorativo. L'uscita del tecnico è addebitata anche in caso di mancata riparazione per cause non dipendenti dalla nostra volontà.",
    clausole: ["C-USCITE", "C-GARANZIA"],
  },
  T8: {
    id: "T8",
    scenario: "Gestione ricambio disponibile",
    uso: "Tempi di spedizione/sostituzione",
    canale: "staff-only",
    automatizzabile: "semi",
    testoBozza:
      "Il ricambio necessario è disponibile. Tempi stimati di spedizione/sostituzione: {tempi}. Procediamo alla programmazione.",
    clausole: ["C-RICAMBI"],
  },
  T9: {
    id: "T9",
    scenario: "Ricambio irreperibile / obsolescenza",
    uso: "Proposta alternativa o upgrade",
    canale: "staff-only",
    automatizzabile: "no",
    testoBozza:
      "Il componente risulta non più reperibile per obsolescenza. Proponiamo le seguenti alternative / soluzione di upgrade: {alternative}.",
    clausole: ["C-RICAMBI"],
  },
  T10: {
    id: "T10",
    scenario: "Sollecito risposta cliente",
    uso: 'Ticket in stato "in attesa cliente"',
    canale: "staff-only",
    automatizzabile: "si",
    trigger: "stage = in attesa risposta cliente",
    testoBozza:
      "In attesa di un suo riscontro per proseguire con la gestione del ticket #{numero}. In assenza di risposta il ticket resterà sospeso.",
  },
  T11: {
    id: "T11",
    scenario: "Chiusura ticket",
    uso: "Riepilogo + richiesta soddisfazione",
    canale: "staff-only",
    automatizzabile: "si",
    trigger: "stage = chiuso",
    testoBozza:
      "Il ticket #{numero} è stato risolto e viene chiuso. Riepilogo: {riepilogo}. Per qualsiasi necessità resta a disposizione l'Area Cliente.",
  },
  T12: {
    id: "T12",
    scenario: "Escalation a responsabile tecnico",
    uso: "Superata soglia SLA o complessità elevata",
    canale: "staff-only",
    automatizzabile: "semi",
    trigger: "urgenza alta / SLA-breach",
    testoBozza:
      "La segnalazione richiede una valutazione del responsabile tecnico. Abbiamo attivato l'escalation per garantire la gestione prioritaria nei tempi previsti.",
  },
  T13: {
    id: "T13",
    scenario: "Follow-up post-intervento / upsell",
    uso: "Rinnovo copertura o upgrade tecnologico",
    canale: "staff-only",
    automatizzabile: "si",
    trigger: "post-chiusura",
    testoBozza:
      "A seguito dell'intervento, le segnaliamo le opzioni di copertura più adatte al suo impianto (rinnovo/upgrade) per prevenire fermi futuri. Le proposte personalizzate sono nel suo Art Tech Hub.",
  },
};

// ---------------------------------------------------------------------------
// § CLAUSOLE LEGALI (placeholder staff-only — verbatim solo da doc validato)
// ---------------------------------------------------------------------------

export const CLAUSOLE_LEGALI: Record<string, ClausolaLegale> = {
  "C-GARANZIA": {
    id: "C-GARANZIA",
    titolo: "Estensione e limiti della garanzia",
    ambito: "copertura hardware, esclusioni",
    canale: "staff-only",
    richiedeValidazione: true,
    nota: "Verbatim da doc Rev. 1.0. Attenzione a esclusioni ampie verso consumatori (Codice del Consumo).",
  },
  "C-USCITE": {
    id: "C-USCITE",
    titolo: "Addebito uscite tecniche",
    ambito: "costo intervento anche in caso di mancata riparazione",
    canale: "staff-only",
    richiedeValidazione: true,
    nota: "Verbatim da doc Rev. 1.0.",
  },
  "C-RICAMBI": {
    id: "C-RICAMBI",
    titolo: "Ricambi e irreparabilità",
    ambito: "disponibilità, obsolescenza, sostituzione",
    canale: "staff-only",
    richiedeValidazione: true,
    nota: "Verbatim da doc Rev. 1.0.",
  },
  "C-SICUREZZA": {
    id: "C-SICUREZZA",
    titolo: "Sicurezza sul lavoro (D.Lgs. 81/2008)",
    ambito: "accesso in quota, DPI, referente in loco",
    canale: "staff-only",
    richiedeValidazione: true,
    nota: "Verbatim da doc Rev. 1.0.",
  },
  "C-GDPR": {
    id: "C-GDPR",
    titolo: "Trattamento dati (GDPR)",
    ambito: "gestione dati ticket e comunicazioni",
    canale: "staff-only",
    richiedeValidazione: true,
    nota: "Verbatim da doc Rev. 1.0.",
  },
  "C-FORO": {
    id: "C-FORO",
    titolo: "Reclami e foro competente",
    ambito: "termini reclamo, foro",
    canale: "staff-only",
    richiedeValidazione: true,
    nota: "Verbatim da doc Rev. 1.0. Limite reclamo 8 gg e foro esclusivo possono essere vessatori/nulli verso consumatori.",
  },
};

// ---------------------------------------------------------------------------
// § HELPER
// ---------------------------------------------------------------------------

export function getVerificaRapida(categoria: CategoriaTicket): VerificaRapida {
  return VERIFICHE_RAPIDE[categoria] ?? VERIFICHE_RAPIDE.other;
}

export function getTemplate(id: string): TemplateStaff | undefined {
  return TEMPLATE_STAFF[id];
}

/**
 * Suggerisce allo staff i template più pertinenti per un ticket in ingresso.
 * Solo suggerimento interno (staff-only): NON invia nulla al cliente.
 */
export function suggerisciTemplate(input: {
  tipoRichiesta: string;
  urgenza: string;
  categoria: string;
}): SuggerimentoTemplate[] {
  const out: SuggerimentoTemplate[] = [];

  // Presa in carico: sempre.
  out.push({ id: "T1", motivo: "presa in carico (auto-ack)" });

  // Preventivo / fuori copertura.
  if (input.tipoRichiesta === "preventivo") {
    out.push({ id: "T7", motivo: "nessuna copertura → preventivo" });
  }

  // Diagnosi remota per categorie risolvibili da remoto.
  if (
    input.categoria === "noimage" ||
    input.categoria === "brightness" ||
    input.categoria === "control"
  ) {
    out.push({ id: "T3", motivo: `diagnosi remota (categoria ${input.categoria})` });
  }

  // Categorie tipicamente legate a ricambi.
  if (input.categoria === "pixels" || input.categoria === "brightness") {
    out.push({ id: "T8", motivo: "possibile gestione ricambi/moduli" });
  }

  // Urgenza alta → candidato escalation + pianificazione rapida.
  if (input.urgenza === "alta") {
    out.push({ id: "T4", motivo: "urgenza alta → pianificare on-site" });
    out.push({ id: "T12", motivo: "urgenza alta → valutare escalation" });
  }

  // Deduplica mantenendo l'ordine.
  const seen = new Set<string>();
  const dedup: SuggerimentoTemplate[] = [];
  for (const s of out) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    dedup.push(s);
  }
  return dedup;
}

/** Formatta i suggerimenti come lista breve leggibile (per email staff). */
export function formatSuggerimenti(sugg: SuggerimentoTemplate[]): string {
  return sugg.map((s) => `${s.id} (${s.motivo})`).join(" · ");
}
