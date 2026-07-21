import type { InterventoRow } from "@/lib/interventi";

export type ContrattoConsumoInterventi = {
  id?: string | null;
  interventi_annui?: number | null;
  illimitati?: boolean | null;
  data_inizio?: string | null;
  data_fine?: string | null;
  scadenza?: string | null;
};

export type ConsumoInterventiContratto = {
  stato: "OK" | "NESSUN_CONTRATTO" | "PERIODO_NON_IMPOSTATO";
  dataInizio: string | null;
  dataFine: string | null;
  totale: number | null;
  illimitati: boolean;
  usati: number | null;
  residui: number | null;
};

function toDateKey(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function getInterventoDate(row: InterventoRow) {
  return toDateKey(row.data_tassativa || row.data || null);
}

/**
 * Source unica del consumo interventi incluso.
 * Step corrente: filtro per periodo contratto.
 * Step futuro: sostituire qui il criterio con intervento.contratto_servizio_id.
 */
export function calcolaConsumoInterventiContratto(params: {
  contratto: ContrattoConsumoInterventi | null | undefined;
  interventi: InterventoRow[];
  checklistId?: string | null;
}): ConsumoInterventiContratto {
  const contratto = params.contratto || null;
  if (!contratto) {
    return {
      stato: "NESSUN_CONTRATTO",
      dataInizio: null,
      dataFine: null,
      totale: null,
      illimitati: false,
      usati: null,
      residui: null,
    };
  }

  const dataInizio = toDateKey(contratto.data_inizio);
  const dataFine = toDateKey(contratto.data_fine || contratto.scadenza || null);
  const illimitati = Boolean(contratto.illimitati);
  const totale =
    !illimitati && typeof contratto.interventi_annui === "number"
      ? contratto.interventi_annui
      : null;

  if (!dataInizio) {
    return {
      stato: "PERIODO_NON_IMPOSTATO",
      dataInizio: null,
      dataFine,
      totale,
      illimitati,
      usati: null,
      residui: null,
    };
  }

  const checklistId = String(params.checklistId || "").trim();
  const usati = params.interventi.filter((row) => {
    if (!row.incluso) return false;
    if (checklistId && String(row.checklist_id || "") !== checklistId) return false;
    const dataIntervento = getInterventoDate(row);
    if (!dataIntervento) return false;
    if (dataIntervento < dataInizio) return false;
    if (dataFine && dataIntervento > dataFine) return false;
    return true;
  }).length;

  return {
    stato: "OK",
    dataInizio,
    dataFine,
    totale,
    illimitati,
    usati,
    residui: illimitati || totale == null ? null : Math.max(0, totale - usati),
  };
}

export function formatConsumoInterventiContratto(consumo: ConsumoInterventiContratto) {
  if (consumo.stato === "PERIODO_NON_IMPOSTATO") return "Periodo non impostato";
  if (consumo.stato === "NESSUN_CONTRATTO") return "Totale inclusi: —";
  if (consumo.illimitati) return `Usati ${consumo.usati ?? 0} / illimitati`;
  if (consumo.totale != null) {
    return `Usati ${consumo.usati ?? 0} / Totale ${consumo.totale} / Residui ${
      consumo.residui ?? 0
    }`;
  }
  return `Usati ${consumo.usati ?? 0} / Totale — / Residui —`;
}
