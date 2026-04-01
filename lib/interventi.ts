export type InterventoRow = {
  id: string;
  cliente?: string | null;
  checklist_id?: string | null;
  contratto_id?: string | null;
  ticket_no?: string | null;
  data?: string | null;
  data_tassativa?: string | null;
  descrizione?: string | null;
  incluso?: boolean | null;
  proforma?: string | null;
  codice_magazzino?: string | null;
  fatturazione_stato?: string | null;
  stato_intervento?: string | null;
  esito_fatturazione?: string | null;
  chiuso_il?: string | null;
  chiuso_da_operatore?: string | null;
  alert_fattura_last_sent_at?: string | null;
  alert_fattura_last_sent_by?: string | null;
  numero_fattura?: string | null;
  fatturato_il?: string | null;
  note?: string | null;
  note_tecniche?: string | null;
  created_at?: string | null;
  checklist?: {
    id: string;
    nome_checklist: string | null;
    proforma: string | null;
    magazzino_importazione: string | null;
  } | null;
};

export type CanonicalInterventoEsitoFatturazione =
  | "DA_FATTURARE"
  | "INCLUSO"
  | "NON_FATTURARE"
  | "FATTURATO";

function normalizeUpper(value?: string | null) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
}

export function normalizeInterventoEsitoFatturazioneValue(
  value?: string | null
): CanonicalInterventoEsitoFatturazione | null {
  const raw = normalizeUpper(value);
  if (!raw) return null;
  if (raw === "DA_FATTURARE") return "DA_FATTURARE";
  if (raw === "FATTURATO") return "FATTURATO";
  if (raw === "NON_FATTURARE") return "NON_FATTURARE";
  if (raw === "INCLUSO" || raw === "INCLUSO_DA_CONSUNTIVO") {
    return "INCLUSO";
  }
  return null;
}

export function getCanonicalInterventoEsitoFatturazione(input: {
  esito_fatturazione?: string | null;
  fatturazione_stato?: string | null;
  incluso?: boolean | null;
}): CanonicalInterventoEsitoFatturazione | null {
  return (
    normalizeInterventoEsitoFatturazioneValue(input.esito_fatturazione) ||
    normalizeInterventoEsitoFatturazioneValue(input.fatturazione_stato) ||
    (input.incluso === true ? "INCLUSO" : null)
  );
}

export function getInterventoLifecycleStatus(input: {
  stato_intervento?: string | null;
  chiuso_il?: string | null;
  fatturazione_stato?: string | null;
}): "APERTO" | "CHIUSO" {
  const raw = normalizeUpper(input.stato_intervento);
  if (raw === "APERTO" || raw === "CHIUSO") return raw;
  if (input.chiuso_il || normalizeInterventoEsitoFatturazioneValue(input.fatturazione_stato)) {
    return "CHIUSO";
  }
  return "APERTO";
}
