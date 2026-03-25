"use client";

import {
  evaluateAziendaExpectedDocuments,
  evaluatePersonaleExpectedDocuments,
  type SafetyExpectedDocumentItem,
} from "@/lib/safetyCompliance";

type Props = {
  kind: "PERSONALE" | "AZIENDA";
  docs: Array<{ tipo_documento: string; data_scadenza: string | null }>;
  extraDocumentLabels?: string[];
};

function normalizeText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getStateStyle(state: SafetyExpectedDocumentItem["state"]) {
  if (state === "PRESENTE_VALIDO") {
    return { border: "#86efac", background: "#f0fdf4", color: "#166534", label: "Presente e valido" };
  }
  if (state === "IN_SCADENZA") {
    return { border: "#fcd34d", background: "#fffbeb", color: "#a16207", label: "In scadenza" };
  }
  if (state === "SCADUTO") {
    return { border: "#fca5a5", background: "#fff1f2", color: "#b91c1c", label: "Scaduto" };
  }
  return { border: "#fca5a5", background: "#fff1f2", color: "#b91c1c", label: "Mancante" };
}

function computeExtraDocumentState(
  label: string,
  docs: Array<{ tipo_documento: string; data_scadenza: string | null }>
): Pick<SafetyExpectedDocumentItem, "state" | "detail"> {
  const matching = docs.filter((doc) => normalizeText(doc.tipo_documento) === normalizeText(label));
  if (matching.length === 0) {
    return { state: "MANCANTE", detail: `${label} mancante` };
  }
  const sorted = [...matching].sort((a, b) =>
    String(b.data_scadenza || "").localeCompare(String(a.data_scadenza || ""))
  );
  const best = sorted[0] || null;
  const rawDate = String(best?.data_scadenza || "").trim();
  if (!rawDate) {
    return { state: "PRESENTE_VALIDO", detail: `${label} presente` };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${rawDate}T00:00:00`);
  if (!Number.isFinite(expiry.getTime())) {
    return { state: "PRESENTE_VALIDO", detail: `${label} presente` };
  }
  if (expiry < today) {
    return { state: "SCADUTO", detail: `${label} scaduto (${expiry.toLocaleDateString("it-IT")})` };
  }
  const warningLimit = new Date(today);
  warningLimit.setDate(warningLimit.getDate() + 30);
  if (expiry <= warningLimit) {
    return {
      state: "IN_SCADENZA",
      detail: `${label} in scadenza (${expiry.toLocaleDateString("it-IT")})`,
    };
  }
  return {
    state: "PRESENTE_VALIDO",
    detail: `${label} valido (${expiry.toLocaleDateString("it-IT")})`,
  };
}

export default function SafetyExpectedDocumentsPanel({
  kind,
  docs,
  extraDocumentLabels = [],
}: Props) {
  const items =
    kind === "PERSONALE"
      ? evaluatePersonaleExpectedDocuments(docs)
      : evaluateAziendaExpectedDocuments(docs);

  const builtInLabels = new Set(items.map((item) => normalizeText(item.label)));
  const extraItems: SafetyExpectedDocumentItem[] = Array.from(
    new Set(extraDocumentLabels.map((label) => String(label || "").trim()).filter(Boolean))
  )
    .filter((label) => !builtInLabels.has(normalizeText(label)))
    .map((label) => ({
      key: `EXTRA_${normalizeText(label)}`,
      label,
      required: false,
      ...computeExtraDocumentState(label, docs),
    }));

  const allItems = [...items, ...extraItems];

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#f8fafc",
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800 }}>
        Elenco standard atteso {kind === "PERSONALE" ? "persona" : "azienda"}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {allItems.map((item) => {
          const style = getStateStyle(item.state);
          return (
            <div
              key={item.key}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                padding: "8px 10px",
                borderRadius: 10,
                background: "white",
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {item.label}
                {item.required ? (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "#6b7280" }}>minimo</span>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span
                  title={item.detail}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
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
                  {style.label}
                </span>
                <span style={{ fontSize: 12, color: "#4b5563" }}>{item.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
