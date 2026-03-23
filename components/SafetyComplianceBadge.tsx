"use client";

import { useEffect, useMemo, useState } from "react";
import { dbFrom } from "@/lib/clientDbBroker";
import {
  evaluateSafetyCompliance,
  type SafetyAziendaDocumentoRow,
  type SafetyAziendaRow,
  type SafetyDataset,
  type SafetyPersonaleDocumentoRow,
  type SafetyPersonaleRow,
} from "@/lib/safetyCompliance";

type Props = {
  personaleText?: string | null;
  showSummary?: boolean;
};

let safetyDatasetCache: SafetyDataset | null = null;
let safetyDatasetPromise: Promise<SafetyDataset> | null = null;

async function loadSafetyDataset() {
  if (safetyDatasetCache) return safetyDatasetCache;
  if (safetyDatasetPromise) return safetyDatasetPromise;

  safetyDatasetPromise = (async () => {
    const [aziendeRes, personaleRes, personaleDocsRes, aziendeDocsRes] = await Promise.all([
      dbFrom("aziende").select("id,ragione_sociale,tipo,attiva").eq("attiva", true).order("ragione_sociale", { ascending: true }),
      dbFrom("personale").select("id,nome,cognome,azienda_id,tipo,attivo").eq("attivo", true).order("cognome", { ascending: true }).order("nome", { ascending: true }),
      dbFrom("personale_documenti")
        .select("id,personale_id,tipo_documento,data_scadenza")
        .order("data_scadenza", { ascending: true }),
      dbFrom("aziende_documenti")
        .select("id,azienda_id,tipo_documento,data_scadenza")
        .order("data_scadenza", { ascending: true }),
    ]);

    if (aziendeRes.error) throw new Error(aziendeRes.error.message);
    if (personaleRes.error) throw new Error(personaleRes.error.message);
    if (personaleDocsRes.error) throw new Error(personaleDocsRes.error.message);
    if (aziendeDocsRes.error) throw new Error(aziendeDocsRes.error.message);

    const dataset: SafetyDataset = {
      aziende: (((aziendeRes.data as any[]) || []) as SafetyAziendaRow[]).map((row) => ({
        id: String(row.id || ""),
        ragione_sociale: String(row.ragione_sociale || ""),
        tipo: row.tipo ?? null,
        attiva: row.attiva ?? true,
      })),
      personale: (((personaleRes.data as any[]) || []) as SafetyPersonaleRow[]).map((row) => ({
        id: String(row.id || ""),
        nome: String(row.nome || ""),
        cognome: String(row.cognome || ""),
        azienda_id: row.azienda_id ? String(row.azienda_id) : null,
        tipo: row.tipo ?? null,
        attivo: row.attivo ?? true,
      })),
      personaleDocumenti: (((personaleDocsRes.data as any[]) || []) as SafetyPersonaleDocumentoRow[]).map(
        (row) => ({
          id: String(row.id || ""),
          personale_id: String(row.personale_id || ""),
          tipo_documento: String(row.tipo_documento || ""),
          data_scadenza: row.data_scadenza ? String(row.data_scadenza) : null,
        })
      ),
      aziendeDocumenti: (((aziendeDocsRes.data as any[]) || []) as SafetyAziendaDocumentoRow[]).map(
        (row) => ({
          id: String(row.id || ""),
          azienda_id: String(row.azienda_id || ""),
          tipo_documento: String(row.tipo_documento || ""),
          data_scadenza: row.data_scadenza ? String(row.data_scadenza) : null,
        })
      ),
    };

    safetyDatasetCache = dataset;
    return dataset;
  })();

  try {
    return await safetyDatasetPromise;
  } finally {
    safetyDatasetPromise = null;
  }
}

export default function SafetyComplianceBadge({ personaleText, showSummary = true }: Props) {
  const [dataset, setDataset] = useState<SafetyDataset | null>(safetyDatasetCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (safetyDatasetCache) return;
    loadSafetyDataset()
      .then((value) => {
        if (!active) return;
        setDataset(value);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(String(err?.message || "Errore caricamento conformità safety"));
      });
    return () => {
      active = false;
    };
  }, []);

  const compliance = useMemo(() => {
    if (!String(personaleText || "").trim()) return null;
    if (!dataset) return null;
    return evaluateSafetyCompliance(personaleText, dataset);
  }, [dataset, personaleText]);

  if (!String(personaleText || "").trim()) return null;
  if (error) {
    return (
      <span
        title={error}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 999,
          border: "1px solid #fca5a5",
          background: "#fff1f2",
          color: "#b91c1c",
          padding: "3px 8px",
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        Safety n/d
      </span>
    );
  }
  if (!compliance) return null;

  const style =
    compliance.status === "CONFORME"
      ? { border: "#86efac", background: "#f0fdf4", color: "#166534" }
      : compliance.status === "IN_SCADENZA"
      ? { border: "#fcd34d", background: "#fffbeb", color: "#a16207" }
      : { border: "#fca5a5", background: "#fff1f2", color: "#b91c1c" };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span
        title={compliance.tooltip}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 999,
          border: `1px solid ${style.border}`,
          background: style.background,
          color: style.color,
          padding: "3px 8px",
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {compliance.label}
      </span>
      {showSummary ? (
        <span title={compliance.tooltip} style={{ fontSize: 12, color: "#4b5563" }}>
          {compliance.summary}
        </span>
      ) : null}
    </div>
  );
}
