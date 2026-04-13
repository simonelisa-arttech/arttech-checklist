"use client";

import { use, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfigMancante from "@/components/ConfigMancante";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import InterventiBlock from "@/components/InterventiBlock";
import type { PendingInterventoLink } from "@/components/InterventiBlock";
import OperativeNotesPanel from "@/components/OperativeNotesPanel";
import RenewalsAlertModal from "@/components/RenewalsAlertModal";
import RenewalsBlock from "@/components/RenewalsBlock";
import Toast from "@/components/Toast";
import {
  buildClienteEmailList,
  formatClienteEmailList,
  normalizeEmailSecondarieInput,
} from "@/lib/clientiEmail";
import {
  getCanonicalInterventoEsitoFatturazione,
  getInterventoLifecycleStatus,
  normalizeInterventoEsitoFatturazioneValue,
  type InterventoRow,
} from "@/lib/interventi";
import {
  loadInterventoOperativi,
  saveInterventoOperativi,
} from "@/lib/interventoOperativi";
import { calcM2FromDimensioni } from "@/lib/parseDimensioni";
import {
  getDefaultRenewalAlertRule,
  normalizeRenewalAlertRule,
  type RenewalAlertRuleRow,
} from "@/lib/renewalAlertRules";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { dbFrom } from "@/lib/clientDbBroker";
import { storageRemove, storageSignedUrl, storageUpload } from "@/lib/clientStorageApi";
import { getEffectiveProjectStatus } from "@/lib/projectStatus";
import { sendAlert } from "@/lib/sendAlert";

function parseLocalDay(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    dt.setHours(0, 0, 0, 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function stripPrefixId(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const uuidMatch = raw.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );
  if (uuidMatch?.[0]) return uuidMatch[0];
  const idx = raw.indexOf(":");
  if (idx >= 0) return raw.slice(idx + 1);
  const dashIdx = raw.indexOf("-");
  if (dashIdx > 0) return raw.slice(dashIdx + 1);
  return raw;
}

const ALLOWED_RINNOVO_STATI = new Set([
  "DA_AVVISARE",
  "AVVISATO",
  "CONFERMATO",
  "DA_FATTURARE",
  "FATTURATO",
  "NON_RINNOVATO",
]);

function normalizeRinnovoStatoForDb(value?: string | null) {
  const stato = String(value || "")
    .trim()
    .toUpperCase();
  return ALLOWED_RINNOVO_STATI.has(stato) ? stato : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function textToHtml(text: string) {
  return text
    .split("\n")
    .map((line) => escapeHtml(line))
    .join("<br/>");
}

function getExpiryStatus(value?: string | null): "ATTIVA" | "SCADUTA" | "—" {
  const dt = parseLocalDay(value);
  if (!dt) return "—";
  const today = startOfToday();
  return dt < today ? "SCADUTA" : "ATTIVA";
}

function renderBadge(label: string) {
  const upper = label.toUpperCase();
  let bg = "#e5e7eb";
  let color = "#374151";
  if (upper === "ATTIVA") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (upper === "SCADUTA") {
    bg = "#fee2e2";
    color = "#991b1b";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {upper}
    </span>
  );
}

function renderModalitaBadge(value?: string | null) {
  const raw = String(value || "").toUpperCase().trim();
  if (!raw) return renderBadge("—");
  let bg = "#e5e7eb";
  let color = "#374151";
  if (raw === "INCLUSO") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (raw === "EXTRA") {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (raw === "AUTORIZZATO_CLIENTE") {
    bg = "#e5e7eb";
    color = "#374151";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {raw}
    </span>
  );
}

function renderTagliandoStatoBadge(value?: string | null) {
  const raw = String(value || "").toUpperCase().trim();
  if (!raw) return renderBadge("—");
  if (raw === "OK") return renderBadge("ATTIVA");
  if (raw === "SCADUTO") return renderBadge("SCADUTA");
  return renderBadge(raw);
}

function renderLicenseStatusBadge(status?: string | null, scadenza?: string | null) {
  const raw = (status || "").toUpperCase().trim();
  if (!raw) return renderBadge(getExpiryStatus(scadenza));
  let bg = "#e5e7eb";
  let color = "#374151";
  if (raw === "DA_FATTURARE") {
    bg = "#fef9c3";
    color = "#854d0e";
  } else if (raw === "FATTURATO") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (raw === "ANNULLATO") {
    bg = "#e5e7eb";
    color = "#374151";
  } else if (raw === "DISATTIVATA") {
    bg = "#e5e7eb";
    color = "#374151";
  } else if (raw === "AVVISATO") {
    bg = "#dbeafe";
    color = "#1e3a8a";
  } else if (raw === "ATTIVA" || raw === "SCADUTA") {
    return renderBadge(raw);
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {raw}
    </span>
  );
}

function getLicenseStatus(lic: { stato?: string | null; scadenza?: string | null }) {
  const stato = (lic.stato || "").toUpperCase().trim();
  if (stato === "DISATTIVATA") return "DISATTIVATA";
  const dt = parseLocalDay(lic.scadenza);
  if (dt && dt < startOfToday()) return "SCADUTA";
  return "ATTIVA";
}

function isSimLicenseType(value?: string | null) {
  return String(value || "").trim().toUpperCase() === "SIM";
}

function getNextLicenzaScadenza(
  licenze: Array<{ scadenza?: string | null; stato?: string | null }>
) {
  const dates = licenze
    .filter((l) => getLicenseStatus(l) !== "DISATTIVATA")
    .map((l) => l.scadenza)
    .filter(Boolean)
    .map((d) => String(d));
  if (dates.length === 0) return null;
  dates.sort((a, b) => a.localeCompare(b));
  return dates[0] ?? null;
}

function renderInterventoBadge(label: "INCLUSO" | "EXTRA") {
  const bg = label === "INCLUSO" ? "#dcfce7" : "#fee2e2";
  const color = label === "INCLUSO" ? "#166534" : "#991b1b";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function renderFatturazioneBadge(label: string) {
  const upper =
    normalizeInterventoEsitoFatturazioneValue(label) || String(label || "").toUpperCase();
  let bg = "#e5e7eb";
  let color = "#374151";
  if (upper === "DA_FATTURARE") {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (upper === "INCLUSO") {
    bg = "#dbeafe";
    color = "#1d4ed8";
  } else if (upper === "NON_FATTURARE") {
    bg = "#e5e7eb";
    color = "#4b5563";
  } else if (upper === "FATTURATO") {
    bg = "#dcfce7";
    color = "#166534";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {upper || "—"}
    </span>
  );
}

function renderRinnovoStatoBadge(label?: string | null) {
  const upper = String(label || "—").toUpperCase();
  let bg = "#e5e7eb";
  let color = "#374151";
  if (upper === "DA_AVVISARE") {
    bg = "#fef3c7";
    color = "#92400e";
  } else if (upper === "AVVISATO") {
    bg = "#dbeafe";
    color = "#1d4ed8";
  } else if (upper === "CONFERMATO") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (upper === "DA_FATTURARE") {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (upper === "FATTURATO") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (upper === "NON_RINNOVATO" || upper === "SCADUTO") {
    bg = "#f3f4f6";
    color = "#6b7280";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {upper}
    </span>
  );
}

function renderScadenzaBadge(value?: string | null) {
  const dt = parseLocalDay(value);
  if (!dt) return renderBadge("—");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dt.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) {
    return renderBadge("SCADUTA");
  }
  let bg = "#e5e7eb";
  let color = "#374151";
  let label = "OK";
  if (diffDays <= 7) {
    bg = "#fee2e2";
    color = "#991b1b";
    label = "7GG";
  } else if (diffDays <= 30) {
    bg = "#fef3c7";
    color = "#92400e";
    label = "30GG";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function fmtDate(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString();
}

function formatCurrency(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateOnlyValue(date?: Date | null) {
  if (!date || !Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isUnauthorizedMessage(error: { message?: string | null } | null | undefined) {
  return String(error?.message || "")
    .trim()
    .toLowerCase()
    .includes("unauthorized");
}

function normalizeClienteSectionError(prefix: string, message: unknown) {
  const raw = String(message || "").trim();
  if (!raw) return prefix;
  const normalized = raw.toLowerCase();
  if (normalized === "unauthorized" || normalized === "no auth cookie") {
    return prefix;
  }
  return `${prefix}: ${raw}`;
}

async function selectClienteSimRows(checklistIds: string[]) {
  return dbFrom("sim_cards")
    .select(
      "id, checklist_id, numero_telefono, intestatario, operatore, piano_attivo, device_installato, data_attivazione, data_scadenza, giorni_preavviso, attiva"
    )
    .in("checklist_id", checklistIds)
    .order("numero_telefono", { ascending: true });
}

async function selectClienteSimRechargeRows(simIds: string[]) {
  return dbFrom("sim_recharges")
    .select("id, sim_id, data_ricarica, importo, billing_status")
    .in("sim_id", simIds)
    .order("data_ricarica", { ascending: false });
}

function addOneYearToDate(value?: string | null) {
  const source = parseLocalDay(value);
  if (!source) return "";
  const next = new Date(source.getTime());
  next.setFullYear(next.getFullYear() + 1);
  if (next.getMonth() !== source.getMonth()) {
    next.setDate(0);
  }
  return formatDateOnlyValue(next);
}

function getLatestClienteSimRechargeRow(rows: ClienteSimRechargeRow[]) {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const aTime = parseLocalDay(a.data_ricarica)?.getTime() || 0;
    const bTime = parseLocalDay(b.data_ricarica)?.getTime() || 0;
    return bTime - aTime;
  })[0] || null;
}

function getClienteSimEffectiveScadenza(
  row: Pick<ClienteSimRow, "data_attivazione" | "data_scadenza">,
  latestRecharge?: Pick<ClienteSimRechargeRow, "data_ricarica"> | null
) {
  const activation = parseLocalDay(row.data_attivazione);
  const lastRecharge = parseLocalDay(latestRecharge?.data_ricarica);
  const baseDate =
    activation && lastRecharge
      ? activation.getTime() >= lastRecharge.getTime()
        ? row.data_attivazione
        : latestRecharge?.data_ricarica || ""
      : activation
        ? row.data_attivazione
        : lastRecharge
          ? latestRecharge?.data_ricarica || ""
          : "";
  if (baseDate) return addOneYearToDate(baseDate);
  return String(row.data_scadenza || "").trim();
}

function getClienteSimOperationalState(
  row: Pick<ClienteSimRow, "attiva" | "giorni_preavviso" | "data_attivazione" | "data_scadenza">,
  latestRecharge?: Pick<ClienteSimRechargeRow, "data_ricarica"> | null
) {
  if (!row.attiva) return "OFF" as const;
  const effectiveScadenza = getClienteSimEffectiveScadenza(row, latestRecharge);
  const scadenza = parseLocalDay(effectiveScadenza);
  if (!scadenza) return "ATTIVA" as const;
  const today = startOfToday();
  const giorniDelta = Math.round((scadenza.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (giorniDelta < 0) return "SCADUTO" as const;
  const giorniPreavvisoEffettivi =
    typeof row.giorni_preavviso === "number" && Number.isFinite(row.giorni_preavviso)
      ? row.giorni_preavviso
      : 30;
  if (giorniDelta <= giorniPreavvisoEffettivi) return "IN_SCADENZA" as const;
  return "ATTIVA" as const;
}

function renderClienteSimStateBadge(state: ReturnType<typeof getClienteSimOperationalState>) {
  let bg = "#e5e7eb";
  let color = "#374151";
  if (state === "ATTIVA") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (state === "IN_SCADENZA") {
    bg = "#ffedd5";
    color = "#ea580c";
  } else if (state === "SCADUTO") {
    bg = "#fee2e2";
    color = "#991b1b";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {state}
    </span>
  );
}

function renderRechargeBillingBadge(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  let background = "#f3f4f6";
  let color = "#374151";

  if (raw === "DA_FATTURARE") {
    background = "#fef3c7";
    color = "#92400e";
  } else if (raw === "FATTURATO") {
    background = "#dcfce7";
    color = "#166534";
  } else if (raw === "NON_FATTURARE") {
    background = "#e5e7eb";
    color = "#4b5563";
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {raw || "—"}
    </span>
  );
}

function formatInvoiceStatus(label?: string | null) {
  const upper =
    normalizeInterventoEsitoFatturazioneValue(label) || String(label || "").toUpperCase();
  if (upper === "DA_FATTURARE") return "Da fatturare";
  if (upper === "FATTURATO") return "Fatturato";
  if (upper === "INCLUSO") return "Incluso";
  if (upper === "NON_FATTURARE") return "Non fatturare";
  return upper || "";
}

function formatRinnovoStatus(label?: string | null) {
  const upper = String(label || "").toUpperCase();
  if (upper === "DA_AVVISARE") return "Da avvisare";
  if (upper === "CONFERMATO") return "Confermato";
  if (upper === "DA_FATTURARE") return "Da fatturare";
  if (upper === "FATTURATO") return "Fatturato";
  if (upper === "NON_RINNOVATO") return "Non rinnovato";
  return upper || "";
}

function formatRinnovoTipo(label?: string | null) {
  const upper = String(label || "").toUpperCase();
  if (upper === "LICENZA") return "Licenza";
  if (upper === "SIM") return "SIM";
  if (upper === "SAAS_SCHERMO") return "SaaS schermo";
  if (upper === "SAAS_ULTRA") return "SaaS Ultra";
  return upper || "";
}

function formatCategoria(label?: string | null) {
  const upper = String(label || "").toUpperCase();
  if (upper === "INTERVENTO") return "Intervento";
  if (upper === "RINNOVO") return "Rinnovo";
  return upper || "";
}
function toCsv(rows: Record<string, any>[], headerOrder?: string[]) {
  const headers = headerOrder && headerOrder.length > 0 ? headerOrder : Object.keys(rows[0] || {});
  const escapeCell = (val: any) => {
    if (val == null) return "";
    const str = String(val);
    if (/[\";\n]/.test(str)) {
      return `"${str.replace(/\"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(";"));
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function renderStatoInterventoBadge(label: string) {
  const upper = String(label || "").toUpperCase();
  let bg = "#f3f4f6";
  let color = "#374151";
  if (upper === "CHIUSO") {
    bg = "#dcfce7";
    color = "#166534";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {upper || "—"}
    </span>
  );
}

function normalizeAlertTasks(input: any) {
  if (!input) {
    return {
      task_template_ids: [],
      all_task_status_change: false,
      on_checklist_open: false,
      allow_manual: true,
      allow_automatic: true,
      allow_scheduled: true,
    };
  }
  if (Array.isArray(input)) {
    return {
      task_template_ids: input.filter(Boolean).map(String),
      all_task_status_change: false,
      on_checklist_open: false,
      allow_manual: true,
      allow_automatic: true,
      allow_scheduled: true,
    };
  }
  if (typeof input === "object") {
    const ids = Array.isArray(input.task_template_ids)
      ? input.task_template_ids.filter(Boolean).map(String)
      : [];
    const all = Boolean(input.all_task_status_change);
    return {
      task_template_ids: ids,
      all_task_status_change: all,
      on_checklist_open: Boolean(input.on_checklist_open),
      allow_manual: input.allow_manual !== false,
      allow_automatic: input.allow_automatic !== false,
      allow_scheduled: input.allow_scheduled !== false,
    };
  }
  return {
    task_template_ids: [],
    all_task_status_change: false,
    on_checklist_open: false,
    allow_manual: true,
    allow_automatic: true,
    allow_scheduled: true,
  };
}

function getInterventoStato(i: InterventoRow): "APERTO" | "CHIUSO" {
  return getInterventoLifecycleStatus(i);
}

function getEsitoFatturazione(i: InterventoRow): string | null {
  return getCanonicalInterventoEsitoFatturazione(i);
}

function canReopenIntervento(currentRole: string | null) {
  const role = String(currentRole || "").toUpperCase();
  return role === "SUPERVISORE" || role === "PM";
}

function isFatturaDaEmettere(i: InterventoRow) {
  return getInterventoStato(i) === "CHIUSO" && getEsitoFatturazione(i) === "DA_FATTURARE";
}

function toNumber(value?: string | null): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function calcM2(dimensioni?: string | null, numeroFacce?: number | null): number | null {
  return calcM2FromDimensioni(dimensioni, numeroFacce ?? 1);
}

type ChecklistRow = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  proforma: string | null;
  po: string | null;
  magazzino_importazione: string | null;
  dimensioni: string | null;
  numero_facce: number | null;
  passo: string | null;
  tipo_impianto: string | null;
  data_prevista: string | null;
  data_tassativa: string | null;
  data_installazione_reale: string | null;
  stato_progetto: string | null;
  saas_piano: string | null;
  saas_tipo: string | null;
  saas_scadenza: string | null;
  saas_note: string | null;
  ultra_interventi_illimitati: boolean | null;
  ultra_interventi_inclusi: number | null;
  garanzia_scadenza: string | null;
  created_at: string;
};

type LicenzaRow = {
  id: string;
  checklist_id: string | null;
  tipo: string | null;
  scadenza: string | null;
  stato: string | null;
  status?: string | null;
  note: string | null;
  intestata_a?: string | null;
  ref_univoco?: string | null;
  telefono?: string | null;
  intestatario?: string | null;
  gestore?: string | null;
  fornitore?: string | null;
  alert_sent_at?: string | null;
  alert_to?: string | null;
  alert_note?: string | null;
  updated_by_operatore?: string | null;
};

type RinnovoServizioRow = {
  id: string;
  cliente?: string | null;
  item_tipo?: string | null;
  subtipo?: string | null;
  sim_id?: string | null;
  riferimento?: string | null;
  descrizione?: string | null;
  checklist_id?: string | null;
  scadenza?: string | null;
  stato?: string | null;
  note_tecniche?: string | null;
  notify_stage1_sent_at?: string | null;
  notify_stage1_to_operatore_id?: string | null;
  confirmed_at?: string | null;
  confirmed_by_operatore_id?: string | null;
  billing_stage2_sent_at?: string | null;
  billing_stage2_to_operatore_id?: string | null;
  proforma?: string | null;
  cod_magazzino?: string | null;
  numero_fattura?: string | null;
  billing_requested_at?: string | null;
  billing_notified_at?: string | null;
};

type TagliandoRow = {
  id: string;
  cliente?: string | null;
  checklist_id?: string | null;
  scadenza?: string | null;
  stato?: string | null;
  note?: string | null;
  modalita?: string | null;
  alert_last_sent_at?: string | null;
  alert_last_sent_by_operatore?: string | null;
};

type ScadenzaItem = {
  id: string;
  source: "rinnovi" | "tagliandi" | "licenze" | "saas" | "garanzie" | "saas_contratto" | "sim";
  tagliando_id?: string | null;
  contratto_id?: string | null;
  sim_id?: string | null;
  item_tipo?: string | null;
  riferimento?: string | null;
  descrizione?: string | null;
  note?: string | null;
  checklist_id?: string | null;
  scadenza?: string | null;
  stato?: string | null;
  proforma?: string | null;
  cod_magazzino?: string | null;
  modalita?: string | null;
};

type EditScadenzaForm = {
  tipo: "LICENZA" | "TAGLIANDO" | "SAAS" | "GARANZIA" | "RINNOVO" | "SAAS_ULTRA" | "SIM";
  scadenza: string;
  stato: string;
  modalita: string;
  note: string;
  fornitore: string;
  intestato_a: string;
  descrizione: string;
  saas_piano: string;
  licenza_tipo: string;
  licenza_class: "LICENZA" | "GARANZIA";
};

type AlertStats = {
  n_avvisi: number;
  n_operatore: number;
  n_email_manual: number;
  last_sent_at: string | null;
  last_recipients: string[];
  total_recipients: number;
};

type AlertMessageTemplate = {
  id: string;
  titolo?: string | null;
  codice?: string | null;
  tipo?: string | null;
  trigger?: string | null;
  subject_template?: string | null;
  body_template?: string | null;
  attivo?: boolean | null;
};

type InterventoFile = {
  id: string;
  intervento_id: string;
  filename: string;
  storage_path: string;
  uploaded_at: string | null;
  uploaded_by_operatore: string | null;
};

type OperatoreRow = {
  id: string;
  user_id?: string | null;
  nome: string | null;
  ruolo: string | null;
  email?: string | null;
  attivo: boolean | null;
  alert_enabled: boolean | null;
  alert_tasks?: {
    task_template_ids: string[];
    all_task_status_change: boolean;
    on_checklist_open: boolean;
    allow_manual: boolean;
    allow_automatic: boolean;
    allow_scheduled: boolean;
  } | null;
};

type ClienteScadenzeDeliveryMode = "AUTO_CLIENTE" | "MANUALE_INTERNO";

const DEFAULT_CLIENTE_SCADENZE_DELIVERY_MODE: ClienteScadenzeDeliveryMode = "AUTO_CLIENTE";

type ContrattoRow = {
  id: string;
  cliente: string;
  piano_codice: string | null;
  scadenza: string | null;
  interventi_annui: number | null;
  illimitati: boolean | null;
  created_at: string;
};

type PianoUltraRow = {
  codice: string;
  nome: string | null;
  interventi_inclusi: number | null;
};

type ClienteSimRow = {
  id: string;
  checklist_id: string | null;
  numero_telefono: string | null;
  intestatario: string | null;
  operatore: string | null;
  piano_attivo: string | null;
  device_installato: string | null;
  data_attivazione: string | null;
  data_scadenza: string | null;
  giorni_preavviso: number | null;
  attiva: boolean;
};

type ClienteSimRechargeRow = {
  id: string;
  sim_id: string;
  data_ricarica: string | null;
  importo: number | null;
  billing_status: string | null;
};

function inferUltraInterventiInclusiFromCode(codeRaw?: string | null) {
  const code = String(codeRaw || "")
    .trim()
    .toUpperCase();
  if (!code) return null;
  if (code.includes("ILL")) return null;
  const m = /^SAAS-UL(\d+)$/.exec(code);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function ClientePage({
  params,
}: {
  params: Promise<{ cliente: string }>;
}) {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }
  const resolvedParams = use(params);
  const router = useRouter();
  const isE2EMode = process.env.NEXT_PUBLIC_E2E === "1";
  const [cliente, setCliente] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [clienteSims, setClienteSims] = useState<ClienteSimRow[]>([]);
  const [clienteSimRechargesById, setClienteSimRechargesById] = useState<
    Record<string, ClienteSimRechargeRow[]>
  >({});
  const [clienteSimsError, setClienteSimsError] = useState<string | null>(null);
  const [licenze, setLicenze] = useState<LicenzaRow[]>([]);
  const [licenzeError, setLicenzeError] = useState<string | null>(null);
  const [licenzeNotice, setLicenzeNotice] = useState<string | null>(null);
  const [licenseAlertOpen, setLicenseAlertOpen] = useState(false);
  const [licenseAlertItem, setLicenseAlertItem] = useState<LicenzaRow | null>(null);
  const [licenseAlertToOperatoreId, setLicenseAlertToOperatoreId] = useState("");
  const [licenseAlertMsg, setLicenseAlertMsg] = useState("");
  const [licenseAlertSendEmail, setLicenseAlertSendEmail] = useState(true);
  const [licenseAlertDestMode, setLicenseAlertDestMode] = useState<"operatore" | "email">(
    "operatore"
  );
  const [licenseAlertManualEmail, setLicenseAlertManualEmail] = useState("");
  const [licenseAlertManualName, setLicenseAlertManualName] = useState("");
  const [licenseAlertSending, setLicenseAlertSending] = useState(false);
  const [licenseAlertErr, setLicenseAlertErr] = useState<string | null>(null);
  const [onlyExpiredWarranty, setOnlyExpiredWarranty] = useState(false);
  const [interventi, setInterventi] = useState<InterventoRow[]>([]);
  const [interventiError, setInterventiError] = useState<string | null>(null);
  const [interventiInfo, setInterventiInfo] = useState<string | null>(null);
  const [rinnovi, setRinnovi] = useState<RinnovoServizioRow[]>([]);
  const [rinnoviError, setRinnoviError] = useState<string | null>(null);
  const [rinnoviFilterDaAvvisare, setRinnoviFilterDaAvvisare] = useState(false);
  const [rinnoviFilterScaduti, setRinnoviFilterScaduti] = useState(false);
  const [rinnoviFilterDaFatturare, setRinnoviFilterDaFatturare] = useState(false);
  const [rinnoviAlertOpen, setRinnoviAlertOpen] = useState(false);
  const [rinnoviAlertStage, setRinnoviAlertStage] = useState<"stage1" | "stage2">("stage1");
  const [rinnoviAlertToOperatoreId, setRinnoviAlertToOperatoreId] = useState("");
  const [rinnoviAlertSubject, setRinnoviAlertSubject] = useState("");
  const [rinnoviAlertMsg, setRinnoviAlertMsg] = useState("");
  const [rinnoviAlertSendEmail, setRinnoviAlertSendEmail] = useState(true);
  const [rinnoviAlertIds, setRinnoviAlertIds] = useState<string[]>([]);
  const [rinnoviAlertItems, setRinnoviAlertItems] = useState<ScadenzaItem[]>([]);
  const [rinnoviAlertDestMode, setRinnoviAlertDestMode] = useState<"operatore" | "email">(
    "operatore"
  );
  const [rinnoviAlertTrigger, setRinnoviAlertTrigger] = useState<"MANUALE" | "AUTOMATICO">(
    "MANUALE"
  );
  const [rinnoviAlertToArtTech, setRinnoviAlertToArtTech] = useState(true);
  const [rinnoviAlertToCliente, setRinnoviAlertToCliente] = useState(false);
  const [rinnoviAlertManualEmail, setRinnoviAlertManualEmail] = useState("");
  const [rinnoviAlertManualName, setRinnoviAlertManualName] = useState("");
  const [rinnoviAlertSending, setRinnoviAlertSending] = useState(false);
  const [rinnoviAlertErr, setRinnoviAlertErr] = useState<string | null>(null);
  const [rinnoviAlertOk, setRinnoviAlertOk] = useState<string | null>(null);
  const [rinnoviAlertRule, setRinnoviAlertRule] = useState<RenewalAlertRuleRow | null>(null);
  const [rinnoviAlertRuleLoading, setRinnoviAlertRuleLoading] = useState(false);
  const [rinnoviAlertRuleSaving, setRinnoviAlertRuleSaving] = useState(false);
  const [rinnoviNotice, setRinnoviNotice] = useState<string | null>(null);
  const [editScadenzaOpen, setEditScadenzaOpen] = useState(false);
  const [editScadenzaItem, setEditScadenzaItem] = useState<ScadenzaItem | null>(null);
  const [editScadenzaForm, setEditScadenzaForm] = useState<EditScadenzaForm | null>(
    null
  );
  const [editScadenzaSaving, setEditScadenzaSaving] = useState(false);
  const [editScadenzaErr, setEditScadenzaErr] = useState<string | null>(null);
  const [alertTemplates, setAlertTemplates] = useState<AlertMessageTemplate[]>([]);
  const [clienteAnagraficaEmail, setClienteAnagraficaEmail] = useState<string | null>(null);
  const [clienteAnagraficaEmailSecondarie, setClienteAnagraficaEmailSecondarie] = useState<
    string | null
  >(null);
  const [clienteAnagraficaEmailDraft, setClienteAnagraficaEmailDraft] = useState("");
  const [clienteAnagraficaEmailSecondarieDraft, setClienteAnagraficaEmailSecondarieDraft] =
    useState("");
  const [clienteAnagraficaEmailSaving, setClienteAnagraficaEmailSaving] = useState(false);
  const [clienteAnagraficaId, setClienteAnagraficaId] = useState<string | null>(null);
  const [clienteDriveUrl, setClienteDriveUrl] = useState<string | null>(null);
  const [clienteDriveDraft, setClienteDriveDraft] = useState("");
  const [clienteDriveEditing, setClienteDriveEditing] = useState(false);
  const [clienteDriveSaving, setClienteDriveSaving] = useState(false);
  const [clienteScadenzeDeliveryMode, setClienteScadenzeDeliveryMode] =
    useState<ClienteScadenzeDeliveryMode>(DEFAULT_CLIENTE_SCADENZE_DELIVERY_MODE);
  const [clienteScadenzeDeliverySaving, setClienteScadenzeDeliverySaving] = useState(false);
  const clienteAnagraficaEmails = useMemo(
    () => buildClienteEmailList(clienteAnagraficaEmail, clienteAnagraficaEmailSecondarie),
    [clienteAnagraficaEmail, clienteAnagraficaEmailSecondarie]
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [tagliandi, setTagliandi] = useState<TagliandoRow[]>([]);
  const [newTagliando, setNewTagliando] = useState({
    checklist_id: "",
    scadenza: "",
    fatturazione: "INCLUSO",
    note: "",
  });
  const [tagliandoSaving, setTagliandoSaving] = useState(false);
  const [applyUltraToAllProjects, setApplyUltraToAllProjects] = useState(false);
  const [applyUltraToSelectedProjects, setApplyUltraToSelectedProjects] = useState(false);
  const [selectedUltraProjectIds, setSelectedUltraProjectIds] = useState<string[]>([]);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportFattInterventiFirst, setExportFattInterventiFirst] = useState(false);
  const [exportLogSending, setExportLogSending] = useState(false);
  const [contratto, setContratto] = useState<ContrattoRow | null>(null);
  const [contrattiRows, setContrattiRows] = useState<ContrattoRow[]>([]);
  const [contrattoError, setContrattoError] = useState<string | null>(null);
  const [showContrattoForm, setShowContrattoForm] = useState(false);
  const [ultraPiani, setUltraPiani] = useState<PianoUltraRow[]>([]);
  const [contrattoForm, setContrattoForm] = useState({
    piano_codice: "",
    scadenza: "",
    interventi_annui: "",
    illimitati: false,
  });
  const [editInterventoId, setEditInterventoId] = useState<string | null>(null);
  const [expandedInterventoId, setExpandedInterventoId] = useState<string | null>(null);
  const [interventoFileUrls, setInterventoFileUrls] = useState<Record<string, string>>({});
  const [interventoFilesById, setInterventoFilesById] = useState<Map<string, InterventoFile[]>>(
    new Map()
  );
  const [proformaDocsByProforma, setProformaDocsByProforma] = useState<
    Map<string, { filename: string; storage_path: string }>
  >(new Map());
  const [currentOperatoreId, setCurrentOperatoreId] = useState<string | null>(null);
  const [interventoUploadFiles, setInterventoUploadFiles] = useState<Record<string, File[]>>(
    {}
  );
  const [newInterventoFiles, setNewInterventoFiles] = useState<File[]>([]);
  const [newInterventoLinks, setNewInterventoLinks] = useState<PendingInterventoLink[]>([]);
  const [alertOperatori, setAlertOperatori] = useState<OperatoreRow[]>([]);
  const [alertInterventoId, setAlertInterventoId] = useState<string | null>(null);
  const [alertDestinatarioId, setAlertDestinatarioId] = useState("");
  const [alertMessaggio, setAlertMessaggio] = useState("");
  const [alertSendEmail, setAlertSendEmail] = useState(true);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkToOperatoreId, setBulkToOperatoreId] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkSendEmail, setBulkSendEmail] = useState(true);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkErr, setBulkErr] = useState<string | null>(null);
  const [bulkOk, setBulkOk] = useState<string | null>(null);
  const [bulkLastSentAt, setBulkLastSentAt] = useState<string | null>(null);
  const [bulkLastToOperatoreId, setBulkLastToOperatoreId] = useState<string | null>(null);
  const [bulkLastMessage, setBulkLastMessage] = useState<string | null>(null);

  function upsertMockRinnovoState(
    checklistId: string | null | undefined,
    itemTipo: string,
    stato: string
  ) {
    if (!checklistId) return;
    const tipo = String(itemTipo || "").toUpperCase();
    const id = `e2e-${tipo}-${checklistId}`;
    setRinnovi((prev) => {
      const existing = prev.find(
        (x) =>
          String(x.checklist_id || "") === String(checklistId) &&
          String(x.item_tipo || "").toUpperCase() === tipo
      );
      if (existing) {
        return prev.map((x) =>
          x.id === existing.id ? { ...x, stato, item_tipo: tipo, checklist_id: checklistId } : x
        );
      }
      return [
        ...prev,
        {
          id,
          checklist_id: checklistId,
          item_tipo: tipo,
          stato,
        } as RinnovoServizioRow,
      ];
    });
  }
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [closeInterventoId, setCloseInterventoId] = useState<string | null>(null);
  const [closeEsito, setCloseEsito] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [lastAlertByIntervento, setLastAlertByIntervento] = useState<
    Map<string, { toOperatoreId: string | null; toNome: string | null; createdAt: string }>
  >(new Map());
  const [alertStatsMap, setAlertStatsMap] = useState<Map<string, AlertStats>>(new Map());
  const [initialClienteLoadDone, setInitialClienteLoadDone] = useState(false);

  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPerfEnabled = () =>
    process.env.NODE_ENV !== "production" ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perf"));
  const perfRef = useRef({
    mountDbCalls: 0,
    mountFetchCalls: 0,
    mountRun: 0,
  });
  const prefillInterventoRef = useRef(false);
  const autoFatturazioneSent = useRef<Set<string>>(new Set());
  const autoFatturazioneInFlight = useRef(false);
  const alertTemplatesLoadedRef = useRef(false);
  const operatoriLoadedRef = useRef(false);
  const operatoriLoadingRef = useRef(false);
  const lastMountClienteKeyRef = useRef("");
  const alertStatsLoadKeyRef = useRef("");
  const lastBulkAlertLoadKeyRef = useRef("");
  const singleFlightRef = useRef<Map<string, Promise<any>>>(new Map());
  const [editIntervento, setEditIntervento] = useState({
    data: "",
    dataTassativa: "",
    descrizione: "",
    ticketNo: "",
    incluso: true,
    proforma: "",
    codiceMagazzino: "",
    fatturazioneStato: "DA_FATTURARE",
    statoIntervento: "APERTO",
    esitoFatturazione: "",
    numeroFattura: "",
    fatturatoIl: "",
    note: "",
    noteTecniche: "",
    dataInizio: "",
    durataGiorni: "",
    modalitaAttivita: "",
    personalePrevisto: "",
    personaleIds: [] as string[],
    mezzi: "",
    descrizioneAttivita: "",
    indirizzo: "",
    orario: "",
    referenteClienteNome: "",
    referenteClienteContatto: "",
    commercialeArtTechNome: "",
    commercialeArtTechContatto: "",
  });
  const [newIntervento, setNewIntervento] = useState({
    data: "",
    dataTassativa: "",
    tipo: "",
    ticketNo: "",
    incluso: true,
    note: "",
    checklistId: "",
    proforma: "",
    codiceMagazzino: "",
    fatturazioneStato: "DA_FATTURARE",
    numeroFattura: "",
    fatturatoIl: "",
    statoIntervento: "APERTO",
    dataInizio: "",
    durataGiorni: "",
    modalitaAttivita: "",
    personalePrevisto: "",
    personaleIds: [] as string[],
    mezzi: "",
    descrizioneAttivita: "",
    indirizzo: "",
    orario: "",
    referenteClienteNome: "",
    referenteClienteContatto: "",
    commercialeArtTechNome: "",
    commercialeArtTechContatto: "",
  });

  type ClienteInterventoOperativiInput = {
    dataInizio: string;
    durataGiorni: string;
    modalitaAttivita: string;
    personalePrevisto: string;
    personaleIds: string[];
    mezzi: string;
    descrizioneAttivita: string;
    indirizzo: string;
    orario: string;
    referenteClienteNome: string;
    referenteClienteContatto: string;
    commercialeArtTechNome: string;
    commercialeArtTechContatto: string;
  };

  function extractClienteInterventoOperativi(form: ClienteInterventoOperativiInput) {
    return {
      data_inizio: form.dataInizio,
      durata_giorni: form.durataGiorni,
      modalita_attivita: form.modalitaAttivita,
      personale_previsto: form.personalePrevisto,
      personale_ids: form.personaleIds,
      mezzi: form.mezzi,
      descrizione_attivita: form.descrizioneAttivita,
      indirizzo: form.indirizzo,
      orario: form.orario,
      referente_cliente_nome: form.referenteClienteNome,
      referente_cliente_contatto: form.referenteClienteContatto,
      commerciale_art_tech_nome: form.commercialeArtTechNome,
      commerciale_art_tech_contatto: form.commercialeArtTechContatto,
    };
  }

  function applyClienteInterventoOperativiForm(
    base: typeof editIntervento,
    form: Awaited<ReturnType<typeof loadInterventoOperativi>>["form"]
  ) {
    return {
      ...base,
      dataInizio: form.data_inizio,
      durataGiorni: form.durata_giorni,
      modalitaAttivita: form.modalita_attivita,
      personalePrevisto: form.personale_previsto,
      personaleIds: form.personale_ids,
      mezzi: form.mezzi,
      descrizioneAttivita: form.descrizione_attivita,
      indirizzo: form.indirizzo,
      orario: form.orario,
      referenteClienteNome: form.referente_cliente_nome,
      referenteClienteContatto: form.referente_cliente_contatto,
      commercialeArtTechNome: form.commerciale_art_tech_nome,
      commercialeArtTechContatto: form.commerciale_art_tech_contatto,
    };
  }

  function showToast(message: string, variant: "success" | "error" = "success", duration = 2500) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, variant });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }

  function isValidHttpUrl(value?: string | null) {
    const raw = String(value || "").trim();
    if (!raw) return false;
    try {
      const parsed = new URL(raw);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function normalizeClienteScadenzeDeliveryMode(value?: string | null): ClienteScadenzeDeliveryMode {
    return String(value || "").trim().toUpperCase() === "MANUALE_INTERNO"
      ? "MANUALE_INTERNO"
      : "AUTO_CLIENTE";
  }

  function normalizeClienteLookupKey(value?: string | null) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, "");
  }

  function applyClienteAnagraficaData(row: any) {
    const anagId = String(row?.id || "").trim();
    if (anagId) setClienteAnagraficaId(anagId);
    const fullName = String(row?.denominazione || "").trim();
    if (fullName) setCliente(fullName);
    const mail = String(row?.email || "").trim();
    setClienteAnagraficaEmail(mail && mail.includes("@") ? mail : null);
    setClienteAnagraficaEmailDraft(mail);
    const secondary = String(row?.email_secondarie || "").trim();
    setClienteAnagraficaEmailSecondarie(secondary || null);
    setClienteAnagraficaEmailSecondarieDraft(secondary);
    const driveUrl = String(row?.drive_url || "").trim();
    setClienteDriveUrl(isValidHttpUrl(driveUrl) ? driveUrl : null);
    setClienteDriveDraft(isValidHttpUrl(driveUrl) ? driveUrl : "");
    setClienteScadenzeDeliveryMode(
      normalizeClienteScadenzeDeliveryMode(row?.scadenze_delivery_mode)
    );
    return anagId;
  }

  async function ensureClienteAnagraficaRecord(overrides?: Record<string, any>) {
    if (clienteAnagraficaId) return clienteAnagraficaId;

    const targetName = String(overrides?.denominazione || cliente || "").trim();
    if (!targetName) throw new Error("Cliente anagrafica non disponibile");

    const searchRes = await fetch(
      `/api/clienti?q=${encodeURIComponent(targetName)}&limit=20&include_inactive=1`,
      {
        cache: "no-store",
        credentials: "include",
      }
    );
    const searchJson = await searchRes.json().catch(() => ({} as any));
    if (searchRes.ok) {
      const list = Array.isArray(searchJson?.data) ? searchJson.data : [];
      const exact = list.find(
        (row: any) =>
          normalizeClienteLookupKey(row?.denominazione) === normalizeClienteLookupKey(targetName)
      );
      if (exact?.id) {
        return applyClienteAnagraficaData(exact);
      }
    }

    const createRes = await fetch("/api/clienti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        denominazione: targetName,
        attivo: true,
        email: clienteAnagraficaEmailDraft.trim() || null,
        email_secondarie: clienteAnagraficaEmailSecondarieDraft.trim() || null,
        drive_url: clienteDriveDraft.trim() || null,
        scadenze_delivery_mode: clienteScadenzeDeliveryMode,
        ...(overrides || {}),
      }),
    });
    const createJson = await createRes.json().catch(() => ({} as any));
    if (!createRes.ok || !createJson?.ok || !createJson?.data) {
      throw new Error(createJson?.error || "Errore creazione anagrafica cliente");
    }
    return applyClienteAnagraficaData(createJson.data);
  }

  async function saveClienteScadenzeDeliveryMode(nextMode: ClienteScadenzeDeliveryMode) {
    setClienteScadenzeDeliverySaving(true);
    try {
      const id =
        clienteAnagraficaId ||
        (await ensureClienteAnagraficaRecord({
          scadenze_delivery_mode: nextMode,
        }));
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id,
          scadenze_delivery_mode: nextMode,
        }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Errore salvataggio preferenza invio scadenze");
      }
      const savedMode = normalizeClienteScadenzeDeliveryMode(json?.data?.scadenze_delivery_mode);
      setClienteScadenzeDeliveryMode(savedMode);
      if (json?.warning) {
        showToast(String(json.warning), "error", 4500);
      } else {
        showToast("✅ Preferenza invio scadenze salvata", "success");
      }
    } catch (err: any) {
      showToast(`❌ Salvataggio preferenza invio scadenze fallito: ${briefError(err)}`, "error");
    } finally {
      setClienteScadenzeDeliverySaving(false);
    }
  }

  async function saveClienteEmail() {
    const nextValue = clienteAnagraficaEmailDraft.trim();
    if (nextValue && !nextValue.includes("@")) {
      showToast("❌ Inserisci un'email cliente valida oppure lascia vuoto", "error");
      return;
    }
    const secondaryEmails = normalizeEmailSecondarieInput(clienteAnagraficaEmailSecondarieDraft);
    if (secondaryEmails.error) {
      showToast(`❌ ${secondaryEmails.error}`, "error");
      return;
    }
    setClienteAnagraficaEmailSaving(true);
    try {
      const id =
        clienteAnagraficaId ||
        (await ensureClienteAnagraficaRecord({
          email: nextValue || null,
          email_secondarie: secondaryEmails.value,
        }));
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id,
          email: nextValue || null,
          email_secondarie: secondaryEmails.value,
        }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Errore salvataggio email cliente");
      }
      const savedEmail = String(json?.data?.email || "").trim();
      setClienteAnagraficaEmail(savedEmail && savedEmail.includes("@") ? savedEmail : null);
      setClienteAnagraficaEmailDraft(savedEmail);
      const savedSecondary = String(json?.data?.email_secondarie || "").trim();
      setClienteAnagraficaEmailSecondarie(savedSecondary || null);
      setClienteAnagraficaEmailSecondarieDraft(savedSecondary);
      showToast("✅ Email cliente salvate", "success");
    } catch (err: any) {
      showToast(`❌ Salvataggio email cliente fallito: ${briefError(err)}`, "error");
    } finally {
      setClienteAnagraficaEmailSaving(false);
    }
  }

  async function saveClienteDriveUrl() {
    const nextValue = clienteDriveDraft.trim();
    if (nextValue && !isValidHttpUrl(nextValue)) {
      showToast("❌ Il link Drive cliente deve essere un URL http/https valido", "error");
      return;
    }
    setClienteDriveSaving(true);
    try {
      const id =
        clienteAnagraficaId ||
        (await ensureClienteAnagraficaRecord({
          drive_url: nextValue || null,
        }));
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id,
          drive_url: nextValue || null,
        }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Errore salvataggio Drive cliente");
      }
      const savedDriveUrl = String(json?.data?.drive_url || "").trim();
      setClienteDriveUrl(isValidHttpUrl(savedDriveUrl) ? savedDriveUrl : null);
      setClienteDriveDraft(isValidHttpUrl(savedDriveUrl) ? savedDriveUrl : "");
      setClienteDriveEditing(false);
      if (json?.warning) {
        showToast(String(json.warning), "error", 4500);
      } else {
        showToast("✅ Drive cliente salvato", "success");
      }
    } catch (err: any) {
      showToast(`❌ Salvataggio Drive cliente fallito: ${briefError(err)}`, "error");
    } finally {
      setClienteDriveSaving(false);
    }
  }

  function perfCountDb(label: string) {
    if (!isPerfEnabled()) return;
    perfRef.current.mountDbCalls += 1;
    console.count(`[perf][cliente][db] ${label}`);
  }

  function perfCountFetch(label: string) {
    if (!isPerfEnabled()) return;
    perfRef.current.mountFetchCalls += 1;
    console.count(`[perf][cliente][fetch] ${label}`);
  }

  function checklistIdsKey(ids?: string[] | null) {
    if (!ids || ids.length === 0) return "";
    return Array.from(new Set(ids.filter(Boolean))).sort().join(",");
  }

  async function runSingleFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
    const existing = singleFlightRef.current.get(key);
    if (existing) return existing as Promise<T>;
    const p = run().finally(() => {
      singleFlightRef.current.delete(key);
    });
    singleFlightRef.current.set(key, p);
    return p;
  }

  async function loadAlertOperatori() {
    if (operatoriLoadedRef.current || operatoriLoadingRef.current) return;
    operatoriLoadingRef.current = true;
    try {
      let opsData: any[] = [];
      try {
        perfCountFetch("GET /api/operatori");
        const res = await fetch("/api/operatori", { credentials: "include" });
        const json = await res.json().catch(() => ({} as any));
        if (res.ok && Array.isArray(json?.data)) {
          opsData = json.data;
        }
      } catch {
        // fallback below
      }
      if (!Array.isArray(opsData) || opsData.length === 0) {
        perfCountDb("operatori.select.fallback");
        const fallback = await dbFrom("operatori")
          .select("id, user_id, nome, ruolo, email, attivo, alert_enabled, alert_tasks")
          .order("ruolo", { ascending: true })
          .order("nome", { ascending: true });
        opsData = (fallback.data || []) as any[];
      }
      const mapped = (opsData || []).map((o: any) => ({
        id: o.id,
        user_id: o.user_id ?? null,
        nome: o.nome ?? null,
        ruolo: o.ruolo ?? null,
        email: o.email ?? null,
        attivo: o.attivo ?? null,
        alert_enabled: o.alert_enabled ?? null,
        alert_tasks: normalizeAlertTasks(o.alert_tasks),
      }));
      setAlertOperatori(mapped as OperatoreRow[]);
      operatoriLoadedRef.current = true;
    } finally {
      operatoriLoadingRef.current = false;
    }
  }

  async function ensureAlertTemplatesLoaded() {
    if (alertTemplatesLoadedRef.current) return;
    await runSingleFlight("alert_message_templates:manuale:attivo", async () => {
      const { data, error } = await dbFrom("alert_message_templates")
        .select("id,codice,titolo,tipo,subject_template,body_template,attivo")
        .eq("attivo", true)
        .order("titolo", { ascending: true });
      if (error) {
        console.error("Errore caricamento template avvisi", error);
        return;
      }
      alertTemplatesLoadedRef.current = true;
      setAlertTemplates((data || []) as AlertMessageTemplate[]);
    });
  }

  function getOperatoreNome(value?: string | null) {
    const key = String(value || "").trim();
    if (!key) return "—";
    const byId = alertOperatori.find((o) => String(o.id || "").trim() === key);
    if (byId?.nome) return byId.nome;
    const byUserId = alertOperatori.find((o) => String(o.user_id || "").trim() === key);
    if (byUserId?.nome) return byUserId.nome;
    return key;
  }

  function alertKey(tipo?: string | null, checklistId?: string | null, riferimento?: string | null) {
    const t = String(tipo || "NULL").toUpperCase();
    const c = checklistId || "NULL";
    const r = riferimento ?? "NULL";
    return `${t}::${c}::${r}`;
  }

  function alertKeyForLogRow(row: any) {
    const tipo = String(row?.tipo || "LICENZA").toUpperCase();
    const checklistId = row?.checklist_id ?? null;
    if (tipo === "TAGLIANDO" || tipo === "LICENZA" || tipo === "GARANZIA") {
      return `${tipo}::${checklistId || "NULL"}::${tipo}`;
    }
    return alertKey(tipo, checklistId, row?.riferimento ?? null);
  }

  function getAlertKeyForRow(r: ScadenzaItem) {
    if (r.source === "tagliandi") {
      return `${String(r.item_tipo || "TAGLIANDO").toUpperCase()}::${r.checklist_id || "NULL"}::TAGLIANDO`;
    }
    if (r.source === "licenze") {
      return `LICENZA::${r.checklist_id || "NULL"}::LICENZA`;
    }
    if (String(r.item_tipo || "").toUpperCase() === "GARANZIA") {
      return `GARANZIA::${r.checklist_id || "NULL"}::GARANZIA`;
    }
    return alertKey(r.item_tipo ?? null, r.checklist_id ?? null, r.riferimento ?? null);
  }

  function renderAvvisatoBadge(
    stats?: AlertStats | null,
    link?: { cliente?: string | null; checklist_id?: string | null; tipo?: string | null }
  ) {
    const count = stats?.n_avvisi ?? null;
    const label = count != null ? `AVVISATO (${count})` : "AVVISATO";
    const lastSent = stats?.last_sent_at
      ? new Date(stats.last_sent_at).toLocaleString()
      : "—";
    const recipients =
      stats && stats.last_recipients.length > 0
        ? `Ultimi destinatari:\n${stats.last_recipients.join("\n")}`
        : "Ultimi destinatari: —";
    const overflow =
      stats && stats.total_recipients > 5
        ? `... +${stats.total_recipients - 5} altri`
        : null;
    const tooltip = stats
      ? `Ultimo invio: ${lastSent}\nOperatori: ${stats.n_operatore}\nEmail manuali: ${stats.n_email_manual}\n${recipients}${overflow ? `\n${overflow}` : ""}`
      : undefined;
    const href =
      link?.checklist_id || link?.cliente || link?.tipo
        ? `/avvisi?${new URLSearchParams({
            ...(link?.cliente ? { cliente: link.cliente } : {}),
            ...(link?.checklist_id ? { checklist_id: link.checklist_id } : {}),
            ...(link?.tipo ? { tipo: link.tipo } : {}),
          }).toString()}`
        : null;
    return (
      <span
        className="group"
        style={{ display: "inline-block", position: "relative" }}
      >
        {href ? (
          <Link
            href={href}
            title={tooltip}
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: "#dbeafe",
              color: "#1d4ed8",
              whiteSpace: "nowrap",
              position: "relative",
              textDecoration: "none",
            }}
          >
            {label}
          </Link>
        ) : (
          <span
            title={tooltip}
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: "#dbeafe",
              color: "#1d4ed8",
              whiteSpace: "nowrap",
              position: "relative",
            }}
          >
            {label}
          </span>
        )}
        {stats && (
          <div
            className="group-hover:block"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 9999,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "8px 10px",
              boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
              minWidth: 220,
              maxWidth: 320,
              fontSize: 12,
              color: "#111",
              display: "none",
              whiteSpace: "pre-wrap",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Dettagli avvisi</div>
            <div>Ultimo invio: {lastSent}</div>
            <div>Operatori: {stats.n_operatore}</div>
            <div>Email manuali: {stats.n_email_manual}</div>
            <div style={{ marginTop: 6, fontWeight: 600 }}>Ultimi destinatari</div>
            {stats.last_recipients.length === 0 ? (
              <div>—</div>
            ) : (
              <div style={{ whiteSpace: "pre-wrap" }}>
                {stats.last_recipients.slice(0, 5).join("\n")}
                {overflow ? `\n${overflow}` : ""}
              </div>
            )}
          </div>
        )}
      </span>
    );
  }

  function applyTemplate(input: string, ctx: Record<string, string>) {
    return input.replace(/\{(\w+)\}/g, (_, key) => ctx[key] ?? "");
  }

  function getTemplateContext(list: ScadenzaItem[]) {
    const first = list[0];
    const checklist = first?.checklist_id ? checklistById.get(first.checklist_id) : null;
    const progetto = checklist?.nome_checklist ?? first?.checklist_id?.slice(0, 8) ?? "—";
    const scadenza = first?.scadenza
      ? new Date(first.scadenza).toLocaleDateString("it-IT")
      : "—";
    const riferimento = first?.riferimento ?? first?.descrizione ?? "—";
    const stato = String(first?.stato || "—").toUpperCase();
    const nomeDest =
      rinnoviAlertDestMode === "operatore"
        ? alertOperatori.find((o) => o.id === rinnoviAlertToOperatoreId)?.nome ??
          alertOperatori.find((o) => o.id === rinnoviAlertToOperatoreId)?.email ??
          ""
        : rinnoviAlertManualEmail.trim();
    const lista =
      list.length > 1
        ? buildMsgScadenzaBulk(list, rinnoviAlertStage)
        : buildMsgScadenzaSingle(first as any, rinnoviAlertStage);
    return {
      cliente: cliente || "",
      progetto,
      scadenza,
      riferimento,
      stato,
      nome_destinatario: nomeDest || "",
      lista,
    };
  }

  function briefError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err ?? "Errore invio");
    return msg.length > 80 ? `${msg.slice(0, 77)}...` : msg;
  }

  function isTagliandoStatoCheckViolation(err: any) {
    const code = String(err?.code || "");
    const msg = String(err?.message || "").toLowerCase();
    return (
      code === "23514" &&
      (msg.includes("tagliandi_stato_check") || (msg.includes("tagliandi") && msg.includes("check constraint")))
    );
  }

  function normalizeTagliandoStatoForDb(statoRaw: string) {
    const stato = String(statoRaw || "").trim().toUpperCase();
    if (stato === "FATTURATO") return "FATTURATO";
    if (stato === "SCADUTO" || stato === "NON_RINNOVATO") return "SCADUTO";
    return "ATTIVA";
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (prefillInterventoRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("addIntervento") !== "1") return;
    prefillInterventoRef.current = true;
    const checklistId = params.get("checklist_id");
    const descrizione = params.get("descrizione");
    setNewIntervento((prev) => ({
      ...prev,
      checklistId: checklistId || prev.checklistId,
      tipo: descrizione || prev.tipo,
    }));
    setTimeout(() => {
      const el = document.getElementById("add-intervento");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (!cancelled) setAuthReady(true);
    }, 1200);

    (async () => {
      setAuthReady(false);
      try {
        const res = await fetch("/api/me-operatore", {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.ok) {
          clearTimeout(fallback);
          setAuthReady(true);
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const mountRun = ++perfRef.current.mountRun;
      if (isPerfEnabled()) {
        perfRef.current.mountDbCalls = 0;
        perfRef.current.mountFetchCalls = 0;
        console.time(`[perf][cliente][mount#${mountRun}] total`);
        console.info(`[perf][cliente] mount start`, { mountRun });
      }
      const raw = resolvedParams?.cliente || "";
      const decoded = decodeURIComponent(raw);
      if (!alive) return;

      let displayCliente = decoded.trim();
      setCliente(displayCliente);
      setClienteAnagraficaEmail(null);
      setClienteAnagraficaEmailSecondarie(null);
      setClienteAnagraficaEmailDraft("");
      setClienteAnagraficaEmailSecondarieDraft("");
      setClienteAnagraficaId(null);
      setClienteDriveUrl(null);
      setClienteDriveDraft("");
      setClienteDriveEditing(false);
      setClienteScadenzeDeliveryMode(DEFAULT_CLIENTE_SCADENZE_DELIVERY_MODE);
      setLoading(true);
      setInitialClienteLoadDone(false);
      setError(null);

      const clienteKey = decoded.trim();
      const normalizedClienteKey = clienteKey.toLowerCase();
      if (!normalizedClienteKey) {
        setChecklists([]);
        setLicenze([]);
        setRinnovi([]);
        setTagliandi([]);
        setInterventi([]);
        setLoading(false);
        setInitialClienteLoadDone(true);
        return;
      }
      if (lastMountClienteKeyRef.current === normalizedClienteKey) {
        setLoading(false);
        setInitialClienteLoadDone(true);
        return;
      }
      lastMountClienteKeyRef.current = normalizedClienteKey;
      if (clienteKey) {
        try {
          if (isPerfEnabled()) console.time(`[perf][cliente][mount#${mountRun}] fetch /api/clienti`);
          perfCountFetch("GET /api/clienti");
          const anagRes = await fetch(`/api/clienti?q=${encodeURIComponent(clienteKey)}&limit=20`, {
            cache: "no-store",
            credentials: "include",
          });
          const anagJson = await anagRes.json().catch(() => ({} as any));
          if (isPerfEnabled()) console.timeEnd(`[perf][cliente][mount#${mountRun}] fetch /api/clienti`);
          const anagList = Array.isArray(anagJson?.data) ? anagJson.data : [];
          const anagData =
            anagList.find(
              (row: any) =>
                normalizeClienteLookupKey(row?.denominazione) === normalizeClienteLookupKey(clienteKey)
            ) || null;
          if (anagData) {
            applyClienteAnagraficaData(anagData);
            const fullName = String((anagData as any)?.denominazione || "").trim();
            if (fullName) {
              displayCliente = fullName;
              setCliente(fullName);
            }
          }
        } catch {
          // keep fallback values from URL
        }
      }
      if (isPerfEnabled()) console.time(`[perf][cliente][mount#${mountRun}] fetch /api/dashboard`);
      perfCountFetch("GET /api/dashboard");
      const dashboardRes = await fetch(`/api/dashboard?q=${encodeURIComponent(clienteKey)}`, {
        credentials: "include",
      });
      const dashboardJson = await dashboardRes.json().catch(() => ({}));
      if (isPerfEnabled()) console.timeEnd(`[perf][cliente][mount#${mountRun}] fetch /api/dashboard`);
      if (!dashboardRes.ok) {
        setError("Errore caricamento PROGETTI: " + (dashboardJson?.error || "errore API dashboard"));
        setLoading(false);
        setInitialClienteLoadDone(true);
        return;
      }

      const list = ((dashboardJson?.data?.checklists || []) as ChecklistRow[]).filter((row) =>
        String((row as any)?.cliente || "")
          .toLowerCase()
          .includes(clienteKey.toLowerCase())
      );
      let licenzeCount = 0;
      const firstClienteId = String((list[0] as any)?.cliente_id || "").trim();
      if (firstClienteId) {
        if (!clienteAnagraficaId) {
          setClienteAnagraficaId(firstClienteId);
        }
        if (isPerfEnabled()) console.time(`[perf][cliente][mount#${mountRun}] db clienti_anagrafica`);
        perfCountDb("clienti_anagrafica.select");
        const { data: clienteById } = await dbFrom("clienti_anagrafica")
          .select("denominazione")
          .eq("id", firstClienteId)
          .maybeSingle();
        if (isPerfEnabled()) console.timeEnd(`[perf][cliente][mount#${mountRun}] db clienti_anagrafica`);
        const fullById = String((clienteById as any)?.denominazione || "").trim();
        if (fullById) {
          displayCliente = fullById;
          setCliente(fullById);
        }
      }
      setChecklists(list);
      const checklistIds = list.map((c) => c.id).filter(Boolean);
      if (checklistIds.length > 0) {
        const byChecklist = new Map<string, string>();
        for (const c of list) {
          if (c.id) {
            const p = (c.proforma || "").trim();
            if (p) byChecklist.set(c.id, p);
          }
        }
        const map = new Map<string, { filename: string; storage_path: string }>();
        for (const c of list as any[]) {
          const docs = Array.isArray(c?.checklist_documents) ? c.checklist_documents : [];
          for (const d of docs) {
            const tipo = String(d?.tipo || "").toUpperCase();
            if (tipo !== "PROFORMA" && tipo !== "FATTURA_PROFORMA") continue;
            const p = c?.id ? byChecklist.get(c.id) : null;
            if (!p) continue;
            if (!map.has(p) && d?.storage_path) {
              map.set(p, {
                filename: d?.filename || "proforma",
                storage_path: d.storage_path,
              });
            }
          }
        }
        setProformaDocsByProforma(map);
      }
      if (checklistIds.length === 0) {
        setLicenze([]);
        setLicenzeError(null);
      } else {
        const idsKey = checklistIdsKey(checklistIds);
        if (isPerfEnabled()) console.time(`[perf][cliente][mount#${mountRun}] db licenses`);
        const { data: licData, error: licErr } = await runSingleFlight(
          `licenses.select.by_checklist_id:${idsKey}`,
          async () => {
            perfCountDb("licenses.select");
            return dbFrom("licenses")
              .select(
                "id, checklist_id, tipo, scadenza, stato, status, note, intestata_a, ref_univoco, telefono, intestatario, gestore, fornitore, alert_sent_at, alert_to, alert_note, updated_by_operatore"
              )
              .in("checklist_id", checklistIds)
              .order("scadenza", { ascending: true });
          }
        );
        if (licErr) {
          setLicenzeError("Errore caricamento licenze: " + licErr.message);
          setLicenze([]);
        } else {
          licenzeCount = (licData || []).length;
          setLicenze((licData || []) as LicenzaRow[]);
          setLicenzeError(null);
        }
        if (isPerfEnabled()) console.timeEnd(`[perf][cliente][mount#${mountRun}] db licenses`);
      }
      if (isPerfEnabled()) console.time(`[perf][cliente][mount#${mountRun}] batch checklist data`);
      const [rinnoviRows, tagliandiRows] = await Promise.all([
        fetchRinnovi(clienteKey, checklistIds),
        fetchTagliandi(clienteKey, checklistIds),
      ]);
      await Promise.all([
        loadInterventiForCliente(clienteKey, checklistIds),
        fetchSaasContratti(clienteKey),
      ]);
      if (isPerfEnabled()) console.timeEnd(`[perf][cliente][mount#${mountRun}] batch checklist data`);

      if (isPerfEnabled()) console.time(`[perf][cliente][mount#${mountRun}] db catalog_items`);
      const { data: pianiData, error: pianiErr } = await runSingleFlight(
        "catalog_items.select.saas_ul",
        async () => {
          perfCountDb("catalog_items.select.saas_ul");
          return dbFrom("catalog_items")
            .select("codice, descrizione")
            .eq("attivo", true)
            .ilike("codice", "SAAS-UL%")
            .order("codice", { ascending: true });
        }
      );

      if (!pianiErr) {
        const mapped = ((pianiData || []) as any[])
          .map((r) => {
            const codice = String(r?.codice || "").trim().toUpperCase();
            if (!codice) return null;
            return {
              codice,
              nome: String(r?.descrizione || "").trim() || null,
              interventi_inclusi: inferUltraInterventiInclusiFromCode(codice),
            } as PianoUltraRow;
          })
          .filter(Boolean) as PianoUltraRow[];
        setUltraPiani(mapped);
      }
      if (isPerfEnabled()) console.timeEnd(`[perf][cliente][mount#${mountRun}] db catalog_items`);

      if (isPerfEnabled()) {
        console.info(`[perf][cliente] ready`, {
          mountRun,
          counts: {
            checklists: list.length,
            licenze: licenzeCount,
            tagliandi: tagliandiRows.length,
            rinnovi: rinnoviRows.length,
          },
          mountDbCalls: perfRef.current.mountDbCalls,
          mountFetchCalls: perfRef.current.mountFetchCalls,
        });
      }
      setLoading(false);
      setInitialClienteLoadDone(true);
      if (isPerfEnabled()) {
        console.timeEnd(`[perf][cliente][mount#${mountRun}] total`);
      }
    })();

    return () => {
      alive = false;
    };
  }, [resolvedParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadClienteSims() {
      if (!authReady) return;
      const checklistIds = checklists.map((c) => c.id).filter(Boolean);
      if (checklistIds.length === 0) {
        setClienteSims([]);
        setClienteSimRechargesById({});
        setClienteSimsError(null);
        return;
      }

      let { data: simData, error: simErr } = await selectClienteSimRows(checklistIds);
      if (simErr && isUnauthorizedMessage(simErr)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const retry = await selectClienteSimRows(checklistIds);
        simData = retry.data;
        simErr = retry.error;
      }
      if (cancelled) return;

      if (simErr) {
        setClienteSims([]);
        setClienteSimRechargesById({});
        setClienteSimsError(normalizeClienteSectionError("Errore caricamento SIM cliente", simErr.message));
        return;
      }

      const simRows = (((simData as any[]) || []) as Array<Record<string, any>>).map((row) => ({
        id: String(row.id || ""),
        checklist_id: row.checklist_id ? String(row.checklist_id) : null,
        numero_telefono: row.numero_telefono ? String(row.numero_telefono) : null,
        intestatario: row.intestatario ? String(row.intestatario) : null,
        operatore: row.operatore ? String(row.operatore) : null,
        piano_attivo: row.piano_attivo ? String(row.piano_attivo) : null,
        device_installato: row.device_installato ? String(row.device_installato) : null,
        data_attivazione: row.data_attivazione ? String(row.data_attivazione) : null,
        data_scadenza: row.data_scadenza ? String(row.data_scadenza) : null,
        giorni_preavviso:
          typeof row.giorni_preavviso === "number"
            ? row.giorni_preavviso
            : row.giorni_preavviso == null || row.giorni_preavviso === ""
              ? null
              : Number(row.giorni_preavviso),
        attiva: row.attiva !== false,
      })) as ClienteSimRow[];

      setClienteSims(simRows);
      setClienteSimsError(null);

      const simIds = simRows.map((row) => row.id).filter(Boolean);
      if (simIds.length === 0) {
        setClienteSimRechargesById({});
        return;
      }

      let { data: rechargeData, error: rechargeErr } = await selectClienteSimRechargeRows(simIds);
      if (rechargeErr && isUnauthorizedMessage(rechargeErr)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const retry = await selectClienteSimRechargeRows(simIds);
        rechargeData = retry.data;
        rechargeErr = retry.error;
      }
      if (cancelled) return;

      if (rechargeErr) {
        setClienteSimRechargesById({});
        setClienteSimsError(
          normalizeClienteSectionError("Errore caricamento ricariche SIM cliente", rechargeErr.message)
        );
        return;
      }

      const rechargeMap: Record<string, ClienteSimRechargeRow[]> = {};
      for (const row of (((rechargeData as any[]) || []) as Array<Record<string, any>>)) {
        const simId = String(row.sim_id || "").trim();
        if (!simId) continue;
        const bucket = rechargeMap[simId] || [];
        bucket.push({
          id: String(row.id || ""),
          sim_id: simId,
          data_ricarica: row.data_ricarica ? String(row.data_ricarica) : null,
          importo:
            typeof row.importo === "number"
              ? row.importo
              : row.importo == null || row.importo === ""
                ? null
                : Number(row.importo),
          billing_status: row.billing_status ? String(row.billing_status) : null,
        });
        rechargeMap[simId] = bucket;
      }
      setClienteSimRechargesById(rechargeMap);
    }

    loadClienteSims();
    return () => {
      cancelled = true;
    };
  }, [authReady, checklists]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      loadAlertOperatori();
    }, 350);
    return () => clearTimeout(t);
  }, [loading, cliente]);

  useEffect(() => {
    if (!initialClienteLoadDone) return;
    fetchLastBulkAlert();
  }, [checklists, initialClienteLoadDone]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null;
    if (stored) setCurrentOperatoreId(stored);
  }, []);

  useEffect(() => {
    if (!isPerfEnabled() || loading) return;
    console.info("[perf][cliente] render ready", {
      cliente,
      counts: {
        checklists: checklists.length,
        licenze: licenze.length,
        tagliandi: tagliandi.length,
        rinnovi: rinnovi.length,
      },
    });
  }, [
    loading,
    cliente,
    checklists.length,
    licenze.length,
    tagliandi.length,
    rinnovi.length,
  ]);

  useEffect(() => {
    const today = new Date();
    const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const toIso = today.toISOString().slice(0, 10);
    const fromIso = from.toISOString().slice(0, 10);
    setExportFrom(fromIso);
    setExportTo(toIso);
  }, []);

  useEffect(() => {
    if (!exportNotice) return;
    const t = setTimeout(() => setExportNotice(null), 7000);
    return () => clearTimeout(t);
  }, [exportNotice]);

  async function loadInterventiForCliente(clienteKey: string, checklistIdsInput?: string[]) {
    const cleanCliente = String(clienteKey || "").trim();
    const checklistIds = (checklistIdsInput || []).filter(Boolean);
    const loadKey = `saas_interventi.select:${cleanCliente.toLowerCase()}:${checklistIdsKey(
      checklistIds
    )}`;
    return runSingleFlight(loadKey, async () => {
    if (!cleanCliente) {
      setInterventi([]);
      setInterventoFilesById(new Map());
      return;
    }

    let ints: any[] | null = null;
    let intsErr: any = null;
    {
      perfCountDb("saas_interventi.select");
      let q = dbFrom("saas_interventi").select(
        "id, cliente, checklist_id, contratto_id, ticket_no, data, data_tassativa, descrizione, incluso, proforma, codice_magazzino, fatturazione_stato, stato_intervento, esito_fatturazione, chiuso_il, chiuso_da_operatore, alert_fattura_last_sent_at, alert_fattura_last_sent_by, numero_fattura, fatturato_il, note, note_tecniche, created_at, checklist:checklists(id, nome_checklist, proforma, magazzino_importazione)"
      );
      q = checklistIds.length > 0 ? q.in("checklist_id", checklistIds) : q.ilike("cliente", cleanCliente);
      const res = await q.order("data", { ascending: false });
      ints = res.data;
      intsErr = res.error;
    }
    if (intsErr && String(intsErr.message || "").toLowerCase().includes("data_tassativa")) {
      perfCountDb("saas_interventi.select.retry_no_data_tassativa");
      let q = dbFrom("saas_interventi").select(
        "id, cliente, checklist_id, contratto_id, ticket_no, data, descrizione, incluso, proforma, codice_magazzino, fatturazione_stato, stato_intervento, esito_fatturazione, chiuso_il, chiuso_da_operatore, alert_fattura_last_sent_at, alert_fattura_last_sent_by, numero_fattura, fatturato_il, note, note_tecniche, created_at, checklist:checklists(id, nome_checklist, proforma, magazzino_importazione)"
      );
      q = checklistIds.length > 0 ? q.in("checklist_id", checklistIds) : q.ilike("cliente", cleanCliente);
      const res = await q.order("data", { ascending: false });
      ints = (res.data || []).map((x: any) => ({ ...x, data_tassativa: null }));
      intsErr = res.error;
    }
    if (intsErr && String(intsErr.message || "").toLowerCase().includes("ticket_no")) {
      perfCountDb("saas_interventi.select.retry_no_ticket_no");
      let q = dbFrom("saas_interventi").select(
        "id, cliente, checklist_id, contratto_id, data, data_tassativa, descrizione, incluso, proforma, codice_magazzino, fatturazione_stato, stato_intervento, esito_fatturazione, chiuso_il, chiuso_da_operatore, alert_fattura_last_sent_at, alert_fattura_last_sent_by, numero_fattura, fatturato_il, note, note_tecniche, created_at, checklist:checklists(id, nome_checklist, proforma, magazzino_importazione)"
      );
      q = checklistIds.length > 0 ? q.in("checklist_id", checklistIds) : q.ilike("cliente", cleanCliente);
      const res = await q.order("data", { ascending: false });
      ints = (res.data || []).map((x: any) => ({ ...x, ticket_no: null }));
      intsErr = res.error;
    }

    if (intsErr) {
      setInterventiError("Errore caricamento interventi: " + intsErr.message);
      return;
    }

    setInterventi((ints || []) as unknown as InterventoRow[]);
    setInterventiError(null);
    const ids = (ints || []).map((i: any) => i.id).filter(Boolean);
    if (ids.length === 0) {
      setInterventoFilesById(new Map());
      setLastAlertByIntervento(new Map());
      return;
    }

    perfCountDb("saas_interventi_files.select");
    const { data: filesData, error: filesErr } = await dbFrom("saas_interventi_files")
      .select("id, intervento_id, filename, storage_path, uploaded_at, uploaded_by_operatore")
      .in("intervento_id", ids)
      .order("uploaded_at", { ascending: false });

    if (!filesErr) {
      const map = new Map<string, InterventoFile[]>();
      for (const f of (filesData || []) as InterventoFile[]) {
        const list = map.get(f.intervento_id) || [];
        list.push(f);
        map.set(f.intervento_id, list);
      }
      setInterventoFilesById(map);
    }

    perfCountDb("checklist_alert_log.select.by_intervento");
    const { data: alertsData, error: alertsErr } = await dbFrom("checklist_alert_log")
      .select("intervento_id, to_operatore_id, created_at")
      .in("intervento_id", ids)
      .order("created_at", { ascending: false });

    if (!alertsErr) {
      const map = new Map<string, { toOperatoreId: string | null; toNome: string | null; createdAt: string }>();
      for (const a of (alertsData || []) as any[]) {
        if (!map.has(a.intervento_id)) {
          map.set(a.intervento_id, {
            toOperatoreId: a.to_operatore_id ?? null,
            toNome: null,
            createdAt: a.created_at,
          });
        }
      }
      setLastAlertByIntervento(map);
    }
    });
  }

  // Interventi are loaded in the main mount batch and refreshed by CRUD handlers.

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!initialClienteLoadDone) return;
      if (autoFatturazioneInFlight.current) return;
      if (interventi.length === 0) return;
      if (alertOperatori.length === 0) return;

      const eligible = interventi.filter((i) => {
        const stato = getInterventoStato(i);
        const esito = getEsitoFatturazione(i);
        return !i.incluso && stato === "CHIUSO" && esito === "DA_FATTURARE";
      });
      if (eligible.length === 0) return;

      const recipients = alertOperatori.filter((o) => {
        const ruolo = String(o.ruolo || "").toUpperCase();
        return (
          o.attivo !== false &&
          (ruolo === "AMMINISTRAZIONE" || normalizeAlertTasks(o.alert_tasks).all_task_status_change)
        );
      });
      if (recipients.length === 0) return;
      const opId =
        currentOperatoreId ??
        (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
      if (!opId) return;

      autoFatturazioneInFlight.current = true;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString();

        const eligibleIds = eligible.map((i) => i.id).filter(Boolean);
        const eligibleIdsKey = checklistIdsKey(eligibleIds);
        const { data: existing, error: existingErr } = await runSingleFlight(
          `checklist_alert_log.select.fatturazione_auto:${eligibleIdsKey}:${todayIso}`,
          async () =>
            dbFrom("checklist_alert_log")
              .select("intervento_id, created_at")
              .in("intervento_id", eligibleIds)
              .eq("canale", "fatturazione_auto")
              .gte("created_at", todayIso)
        );

        if (!alive) return;

        if (existingErr) {
          console.error("Errore lettura alert automatici fatturazione", existingErr);
          return;
        }

        const already = new Set<string>();
        (existing || []).forEach((row: any) => {
          if (row?.intervento_id) already.add(row.intervento_id);
        });
        autoFatturazioneSent.current.forEach((id) => already.add(id));

        const toSend = eligible.filter((i) => !already.has(i.id));
        if (toSend.length === 0) return;

        const payloads: any[] = [];
        const sentIds: string[] = [];
        for (const i of toSend) {
          const checklistId = i.checklist?.id ?? i.checklist_id ?? null;
          if (!checklistId) continue;
          const messaggio = buildAutoFatturazioneMessage(i);
          for (const o of recipients) {
            payloads.push({
              checklist_id: checklistId,
              intervento_id: i.id,
              to_operatore_id: o.id,
              from_operatore_id: opId,
              messaggio,
              canale: "fatturazione_auto",
            });
          }
          sentIds.push(i.id);
        }

        if (payloads.length === 0) return;

        console.log("ALERT FATTURAZIONE opId=", opId);
        const { error: insErr } = await dbFrom("checklist_alert_log")
          .insert(payloads);

        if (!alive) return;

        if (insErr) {
          console.error("Errore log alert automatico fatturazione", insErr);
          return;
        }

        sentIds.forEach((id) => autoFatturazioneSent.current.add(id));
      } finally {
        autoFatturazioneInFlight.current = false;
      }
    })();

    return () => {
      alive = false;
    };
  }, [alertOperatori, cliente, interventi, initialClienteLoadDone]);

  async function startEditIntervento(i: InterventoRow) {
    setEditInterventoId(i.id);
    const baseForm = {
      data: i.data ? String(i.data).slice(0, 10) : "",
      dataTassativa: i.data_tassativa ? String(i.data_tassativa).slice(0, 10) : "",
      descrizione: i.descrizione ?? "",
      ticketNo: i.ticket_no ?? "",
      incluso: Boolean(i.incluso),
      proforma: i.proforma ?? i.checklist?.proforma ?? "",
      codiceMagazzino: i.codice_magazzino ?? i.checklist?.magazzino_importazione ?? "",
      fatturazioneStato: getEsitoFatturazione(i) ?? "DA_FATTURARE",
      statoIntervento: getInterventoStato(i),
      esitoFatturazione: getEsitoFatturazione(i) ?? "",
      numeroFattura: i.numero_fattura ?? "",
      fatturatoIl: i.fatturato_il ? i.fatturato_il.slice(0, 10) : "",
      note: i.note ?? "",
      noteTecniche: i.note_tecniche ?? "",
      dataInizio: "",
      durataGiorni: "",
      modalitaAttivita: "",
      personalePrevisto: "",
      personaleIds: [],
      mezzi: "",
      descrizioneAttivita: "",
      indirizzo: "",
      orario: "",
      referenteClienteNome: "",
      referenteClienteContatto: "",
      commercialeArtTechNome: "",
      commercialeArtTechContatto: "",
    };
    setEditIntervento(baseForm);
    try {
      const { form } = await loadInterventoOperativi(i.id);
      setEditIntervento(applyClienteInterventoOperativiForm(baseForm, form));
    } catch (e: any) {
      setInterventiError(String(e?.message || "Errore caricamento dati operativi intervento"));
    }
  }

  async function saveEditIntervento() {
    if (!editInterventoId) return;
    if (
      editIntervento.fatturazioneStato === "FATTURATO" &&
      !editIntervento.numeroFattura.trim()
    ) {
      setInterventiError("Numero fattura obbligatorio quando lo stato è FATTURATO.");
      return;
    }

    const canonicalEsito =
      normalizeInterventoEsitoFatturazioneValue(editIntervento.fatturazioneStato) ||
      normalizeInterventoEsitoFatturazioneValue(editIntervento.esitoFatturazione) ||
      "DA_FATTURARE";
    const payload = {
      data: editIntervento.data?.trim() ? editIntervento.data.trim() : null,
      data_tassativa: editIntervento.dataTassativa?.trim() ? editIntervento.dataTassativa.trim() : null,
      descrizione: editIntervento.descrizione.trim(),
      ticket_no: editIntervento.ticketNo.trim() ? editIntervento.ticketNo.trim() : null,
      incluso: editIntervento.incluso,
      proforma: editIntervento.proforma.trim() ? editIntervento.proforma.trim() : null,
      codice_magazzino: editIntervento.codiceMagazzino.trim()
        ? editIntervento.codiceMagazzino.trim()
        : null,
      fatturazione_stato:
        editIntervento.statoIntervento === "CHIUSO" ? canonicalEsito : null,
      stato_intervento: editIntervento.statoIntervento,
      esito_fatturazione: canonicalEsito,
      numero_fattura: editIntervento.numeroFattura.trim()
        ? editIntervento.numeroFattura.trim()
        : null,
      fatturato_il:
        canonicalEsito === "FATTURATO"
          ? editIntervento.fatturatoIl || new Date().toISOString().slice(0, 10)
          : null,
      note: editIntervento.note.trim() ? editIntervento.note.trim() : null,
    };

    let { error: updErr } = await dbFrom("saas_interventi")
      .update(payload)
      .eq("id", editInterventoId);
    if (updErr && String(updErr.message || "").toLowerCase().includes("ticket_no")) {
      const { ticket_no, ...legacyPayload } = payload as any;
      const retry = await dbFrom("saas_interventi")
        .update(legacyPayload)
        .eq("id", editInterventoId);
      updErr = retry.error;
    }
    if (updErr && String(updErr.message || "").toLowerCase().includes("data_tassativa")) {
      const { data_tassativa, ...legacyPayload } = payload as any;
      const retry = await dbFrom("saas_interventi")
        .update(legacyPayload)
        .eq("id", editInterventoId);
      updErr = retry.error;
    }

    if (updErr) {
      setInterventiError("Errore aggiornamento intervento: " + updErr.message);
      return;
    }
    try {
      await saveInterventoOperativi(
        editInterventoId,
        extractClienteInterventoOperativi(editIntervento)
      );
    } catch (e: any) {
      setInterventiError(
        "Intervento aggiornato ma dati operativi non salvati: " +
          String(e?.message || "errore sconosciuto")
      );
      return;
    }

    await loadInterventiForCliente(
      cliente,
      checklists.map((c) => c.id).filter(Boolean)
    );
    setEditInterventoId(null);
    setInterventiError(null);
  }

  async function uploadInterventoFiles(interventoId: string) {
    const files = interventoUploadFiles[interventoId] || [];
    if (files.length === 0) return;
    const opId = currentOperatoreId || null;

    for (const file of files) {
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `interventi/${interventoId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await storageUpload(path, file);
      if (upErr) {
        setInterventiError("Errore upload file intervento: " + upErr.message);
        return;
      }
      const { error: insErr } = await dbFrom("saas_interventi_files").insert({
        intervento_id: interventoId,
        filename: file.name,
        storage_path: path,
        uploaded_by_operatore: opId,
      });
      if (insErr) {
        setInterventiError("Errore salvataggio file intervento: " + insErr.message);
        return;
      }
    }

    setInterventoUploadFiles((prev) => ({ ...prev, [interventoId]: [] }));

    const ids = interventi.map((i) => i.id);
    if (ids.length > 0) {
      const { data: filesData, error: filesErr } = await dbFrom("saas_interventi_files")
        .select("id, intervento_id, filename, storage_path, uploaded_at, uploaded_by_operatore")
        .in("intervento_id", ids)
        .order("uploaded_at", { ascending: false });

      if (!filesErr) {
        const map = new Map<string, InterventoFile[]>();
        for (const f of (filesData || []) as InterventoFile[]) {
          const list = map.get(f.intervento_id) || [];
          list.push(f);
          map.set(f.intervento_id, list);
        }
        setInterventoFilesById(map);
      }
    }
  }

  async function uploadInterventoFilesList(interventoId: string, files: File[]) {
    if (files.length === 0) return;
    const opId =
      typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null;

    for (const file of files) {
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `interventi/${interventoId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await storageUpload(path, file);
      if (upErr) {
        setInterventiError("Errore upload file intervento: " + upErr.message);
        return;
      }
      const { error: insErr } = await dbFrom("saas_interventi_files").insert({
        intervento_id: interventoId,
        filename: file.name,
        storage_path: path,
        uploaded_by_operatore: opId,
      });
      if (insErr) {
        setInterventiError("Errore salvataggio file intervento: " + insErr.message);
        return;
      }
    }

    const ids = interventi.map((i) => i.id).concat(interventoId);
    if (ids.length > 0) {
      const { data: filesData, error: filesErr } = await dbFrom("saas_interventi_files")
        .select("id, intervento_id, filename, storage_path, uploaded_at, uploaded_by_operatore")
        .in("intervento_id", ids)
        .order("uploaded_at", { ascending: false });

      if (!filesErr) {
        const map = new Map<string, InterventoFile[]>();
        for (const f of (filesData || []) as InterventoFile[]) {
          const list = map.get(f.intervento_id) || [];
          list.push(f);
          map.set(f.intervento_id, list);
        }
        setInterventoFilesById(map);
      }
    }
  }

  async function uploadInterventoLinksList(interventoId: string, links: PendingInterventoLink[]) {
    if (links.length === 0) return;
    for (const link of links) {
      const url = String(link.url || "").trim();
      const title = String(link.title || "").trim() || url;
      if (!/^https?:\/\//i.test(url)) {
        setInterventiError("URL link intervento non valido.");
        return;
      }
      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          source: "LINK",
          entity_type: "INTERVENTO",
          entity_id: interventoId,
          title,
          url,
          provider: url.toLowerCase().includes("drive.google.com") ? "GOOGLE_DRIVE" : "GENERIC",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInterventiError(String(data?.error || "Errore salvataggio link intervento"));
        return;
      }
    }
  }

  async function openInterventoFile(file: InterventoFile) {
    const { data, error: urlErr } = await storageSignedUrl(file.storage_path);
    if (urlErr || !data?.signedUrl) {
      setInterventiError("Errore apertura file: " + (urlErr?.message || "URL non disponibile"));
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function openProformaDoc(doc: { filename: string; storage_path: string }) {
    const { data, error: urlErr } = await storageSignedUrl(doc.storage_path);
    if (urlErr || !data?.signedUrl) {
      setInterventiError("Errore apertura proforma: " + (urlErr?.message || "URL non disponibile"));
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteInterventoFile(file: InterventoFile) {
    const ok = window.confirm("Eliminare questo file?");
    if (!ok) return;
    const { error: storErr } = await storageRemove(file.storage_path);
    if (storErr) {
      setInterventiError("Errore eliminazione file: " + storErr.message);
      return;
    }
    const { error: delErr } = await dbFrom("saas_interventi_files")
      .delete()
      .eq("id", file.id);
    if (delErr) {
      setInterventiError("Errore eliminazione file: " + delErr.message);
      return;
    }
    setInterventoFilesById((prev) => {
      const next = new Map(prev);
      const list = (next.get(file.intervento_id) || []).filter((f) => f.id !== file.id);
      next.set(file.intervento_id, list);
      return next;
    });
  }


  const proforme = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checklists) {
      const p = (c.proforma || "").trim();
      if (!p) continue;
      map.set(p, (map.get(p) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [checklists]);

  const garanzieRows = useMemo(() => {
    let rows = checklists.filter((c) => c.garanzia_scadenza);
    if (onlyExpiredWarranty) {
      rows = rows.filter((c) => getExpiryStatus(c.garanzia_scadenza) === "SCADUTA");
    }
    return rows;
  }, [checklists, onlyExpiredWarranty]);

  const saasPerImpiantoRows = useMemo(() => {
    return checklists.filter((c) => {
      const piano = String(c.saas_piano ?? "").trim().toUpperCase();
      if (!piano) return false;
      return !piano.startsWith("SAAS-UL");
    });
  }, [checklists]);

  const rinnoviAll = useMemo<ScadenzaItem[]>(() => {
    const checklistMap = new Map(checklists.map((c) => [c.id, c] as const));
    const rinnoviMapped = rinnovi
      // LICENZA is managed from `licenses` table in this page.
      // Keeping both sources causes "ghost/original row comes back" effects.
      .filter((r) => String(r.item_tipo || "").toUpperCase() !== "LICENZA")
      .map((r) => ({
      id: r.id,
      source: "rinnovi" as const,
      item_tipo: r.item_tipo,
      riferimento: getRinnovoReference(r),
      descrizione: r.descrizione ?? null,
      checklist_id: r.checklist_id ?? null,
      scadenza: r.scadenza ?? null,
      stato: r.stato ?? null,
      proforma: r.proforma ?? null,
      cod_magazzino: r.cod_magazzino ?? null,
    }));
    const tagliandiMapped = tagliandi.map((t) => ({
      id: t.id,
      tagliando_id: t.id,
      source: "tagliandi" as const,
      item_tipo: "TAGLIANDO",
      riferimento: t.note || "Tagliando annuale",
      descrizione: t.note ?? null,
      note: t.note ?? null,
      checklist_id: t.checklist_id ?? null,
      scadenza: t.scadenza ?? null,
      stato: t.stato ?? null,
      modalita: t.modalita ?? null,
    }));
    const licenzeMapped = licenze
      .filter((l) => !isSimLicenseType(l.tipo))
      .map((l) => ({
      id: l.id,
      source: "licenze" as const,
      item_tipo: "LICENZA",
      riferimento:
        [
          l.intestata_a ? `Intestata: ${l.intestata_a}` : null,
          l.ref_univoco,
          l.telefono,
          l.intestatario,
          l.gestore,
          l.fornitore,
          l.note,
        ]
          .filter(Boolean)
          .join(" · ") || l.tipo || "Licenza",
      descrizione: l.note ?? null,
      checklist_id: l.checklist_id ?? null,
      scadenza: l.scadenza ?? null,
      stato: l.status ?? l.stato ?? (l.scadenza ? "DA_AVVISARE" : null),
      modalita: null,
    }));
    const simMapped = clienteSims.map((sim) => {
      const latestRecharge = getLatestClienteSimRechargeRow(clienteSimRechargesById[sim.id] || []);
      const scadenza = getClienteSimEffectiveScadenza(sim, latestRecharge);
      const simState = getClienteSimOperationalState(sim, latestRecharge);
      const project = checklistMap.get(String(sim.checklist_id || ""));
      return {
        id: `sim_cards:${sim.id}`,
        source: "sim" as const,
        sim_id: sim.id,
        item_tipo: "SIM",
        riferimento: sim.numero_telefono || sim.intestatario || "SIM",
        descrizione:
          [sim.operatore, sim.piano_attivo, sim.device_installato].filter(Boolean).join(" · ") ||
          null,
        checklist_id: sim.checklist_id ?? null,
        scadenza: scadenza ?? null,
        stato: simState === "OFF" ? "OFF" : simState === "SCADUTO" ? "SCADUTA" : "ATTIVA",
        proforma: project?.proforma ?? null,
        cod_magazzino: project?.magazzino_importazione ?? null,
        modalita: null,
      };
    });
    const saasMapped = saasPerImpiantoRows.map((c) => ({
      id: `saas:${c.id}`,
      source: "saas" as const,
      item_tipo: "SAAS",
      riferimento: c.saas_piano ?? "SaaS",
      descrizione: c.saas_note ?? null,
      checklist_id: c.id,
      scadenza: c.saas_scadenza ?? null,
      stato: c.saas_scadenza ? getExpiryStatus(c.saas_scadenza) : null,
      modalita: null,
    }));
    const contrattiMapped = contrattiRows.map((c) => ({
      id: `saas_contratto:${c.id}`,
      source: "saas_contratto" as const,
      item_tipo: "SAAS_ULTRA",
      riferimento: c.piano_codice ?? "ULTRA",
      descrizione: "Contratto ULTRA cliente",
      checklist_id: null,
      contratto_id: c.id,
      scadenza: c.scadenza ?? null,
      stato: c.scadenza ? getExpiryStatus(c.scadenza) : "ATTIVA",
      modalita: null,
    }));
    const rinnoviGaranziaChecklistIds = new Set(
      rinnovi
        .filter((r) => String(r.item_tipo || "").toUpperCase() === "GARANZIA")
        .map((r) => String(r.checklist_id || ""))
        .filter(Boolean)
    );
    const garanzieMapped = garanzieRows
      .filter((c) => !rinnoviGaranziaChecklistIds.has(String(c.id)))
      .map((c) => ({
      id: `garanzia:${c.id}`,
      source: "garanzie" as const,
      item_tipo: "GARANZIA",
      riferimento: "Garanzia impianto",
      descrizione: null,
      checklist_id: c.id,
      scadenza: c.garanzia_scadenza ?? null,
      stato: c.garanzia_scadenza ? getExpiryStatus(c.garanzia_scadenza) : null,
      modalita: null,
    }));
    return [
      ...rinnoviMapped,
      ...tagliandiMapped,
      ...licenzeMapped,
      ...simMapped,
      ...saasMapped,
      ...contrattiMapped,
      ...garanzieMapped,
    ].sort(
      (a, b) => String(a.scadenza || "").localeCompare(String(b.scadenza || ""))
    );
  }, [
    rinnovi,
    tagliandi,
    licenze,
    checklists,
    clienteSims,
    clienteSimRechargesById,
    saasPerImpiantoRows,
    contrattiRows,
    garanzieRows,
  ]);

  const filteredRinnovi = useMemo(() => {
    let rows = rinnoviAll;
    if (rinnoviFilterDaAvvisare) {
      rows = rows.filter((r) => getWorkflowStato(r) === "DA_AVVISARE");
    }
    if (rinnoviFilterDaFatturare) {
      rows = rows.filter((r) => getWorkflowStato(r) === "DA_FATTURARE");
    }
    if (rinnoviFilterScaduti) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      rows = rows.filter((r) => {
        const dt = parseLocalDay(r.scadenza);
        return dt != null && dt < today;
      });
    }
    return rows;
  }, [
    rinnoviAll,
    rinnoviFilterDaAvvisare,
    rinnoviFilterDaFatturare,
    rinnoviFilterScaduti,
    rinnovi,
  ]);

  const rinnovi30ggBreakdown = useMemo(() => {
    const now = startOfToday();
    const to = startOfToday();
    to.setDate(to.getDate() + 30);
    to.setHours(23, 59, 59, 999);
    const tipi = ["LICENZA", "TAGLIANDO", "SAAS", "GARANZIA", "SAAS_ULTRA"] as const;
    const countsByTipo: Record<string, number> = {};
    for (const t of tipi) countsByTipo[t] = 0;
    let total = 0;
    for (const r of rinnoviAll) {
      const dt = parseLocalDay(r.scadenza);
      if (!dt) continue;
      if (dt < now || dt > to) continue;
      const tipo = String(r.item_tipo || "—").toUpperCase();
      countsByTipo[tipo] = (countsByTipo[tipo] ?? 0) + 1;
      total += 1;
    }
    const tooltipLines = [
      ...tipi.map((t) => `${t}: ${countsByTipo[t] ?? 0}`),
      `Totale: ${total}`,
    ];
    const debugSample = rinnoviAll.slice(0, 5).map((r) => ({
      tipo: String(r.item_tipo || "—").toUpperCase(),
      scadenza: r.scadenza ?? "—",
    }));
    return {
      total,
      countsByTipo,
      tooltip: tooltipLines.join("\n"),
      tooltipLines,
      from: now,
      to,
      debugSample,
      totalRows: rinnoviAll.length,
    };
  }, [rinnoviAll]);

  const rinnovi30ggCount = rinnovi30ggBreakdown.total;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!initialClienteLoadDone) return;
      const checklistIds = Array.from(
        new Set(rinnoviAll.map((r) => r.checklist_id).filter(Boolean))
      ) as string[];
      const checklistIdsSorted = checklistIds.slice().sort();
      const loadKey = checklistIdsSorted.join(",");
      if (loadKey === alertStatsLoadKeyRef.current) return;
      alertStatsLoadKeyRef.current = loadKey;
      if (checklistIds.length === 0) {
        if (alive) setAlertStatsMap(new Map());
        return;
      }
      const { data, error } = await runSingleFlight(
        `checklist_alert_log.select.by_checklist_id:${loadKey}`,
        async () =>
          dbFrom("checklist_alert_log")
            .select("checklist_id, tipo, riferimento, to_operatore_id, to_email, created_at")
            .in("checklist_id", checklistIdsSorted)
      );
      if (!alive) return;
      if (error) {
        console.error("Errore lettura alert log scadenze", error);
        return;
      }
      const map = new Map<string, AlertStats>();
      const recipientTotal = new Map<string, Set<string>>();
      for (const row of (data || []) as any[]) {
        const key = alertKeyForLogRow(row);
        const prev = map.get(key) || {
          n_avvisi: 0,
          n_operatore: 0,
          n_email_manual: 0,
          last_sent_at: null,
          last_recipients: [],
          total_recipients: 0,
        };
        const next: AlertStats = { ...prev };
        next.n_avvisi += 1;
        if (row.to_operatore_id) {
          next.n_operatore += 1;
        } else if (row.to_email) {
          next.n_email_manual += 1;
        }
        if (!next.last_sent_at || String(row.created_at) > next.last_sent_at) {
          next.last_sent_at = row.created_at ?? null;
        }
        const op = alertOperatori.find((o) => o.id === row.to_operatore_id);
        const recipient =
          row.to_email ||
          (op?.nome || op?.email ? `👤 ${op?.nome ?? "Operatore"}${op?.email ? ` (${op.email})` : ""}` : null) ||
          null;
        if (recipient) {
          const list = [recipient, ...next.last_recipients.filter((r) => r !== recipient)];
          next.last_recipients = list.slice(0, 5);
          const set = recipientTotal.get(key) || new Set<string>();
          set.add(recipient);
          recipientTotal.set(key, set);
          next.total_recipients = set.size;
        }
        map.set(key, next);
      }
      setAlertStatsMap(map);
    })();
    return () => {
      alive = false;
    };
  }, [rinnoviAll, initialClienteLoadDone]);

  const exportRangeLabel = useMemo(() => {
    const from = exportFrom ? exportFrom.replaceAll("-", "") : "TUTTO";
    const to = exportTo ? exportTo.replaceAll("-", "") : "TUTTO";
    return `${from}-${to}`;
  }, [exportFrom, exportTo]);

  function getLogExportFilename() {
    const safeCliente = (cliente || "cliente").replace(/\s+/g, "_");
    const today = new Date().toISOString().slice(0, 10);
    if (exportFrom && exportTo) {
      return `log-avvisi_${safeCliente}_${exportFrom}_${exportTo}.csv`;
    }
    return `log-avvisi_${safeCliente}_${today}.csv`;
  }

  function chunkArray<T>(input: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < input.length; i += size) {
      out.push(input.slice(i, i + size));
    }
    return out;
  }

  function inDateRange(value?: string | null) {
    if (!value) return false;
    const dt = parseLocalDay(value);
    if (!dt) return false;
    if (exportFrom) {
      const from = parseLocalDay(exportFrom);
      if (from && dt < from) return false;
    }
    if (exportTo) {
      const to = parseLocalDay(exportTo);
      if (to && dt > to) return false;
    }
    return true;
  }

  function exportInterventiCsv() {
    const rows = interventi
      .filter((i) => (exportFrom || exportTo ? inDateRange(i.data) : true))
      .map((i) => {
        const checklist = i.checklist ?? checklistById.get(i.checklist_id || "") ?? null;
        return {
          Data: fmtDate(i.data),
          Cliente: cliente || "",
          PROGETTO: checklist?.nome_checklist ?? "",
          Proforma: i.proforma || checklist?.proforma || "",
          "Cod. magazzino": i.codice_magazzino || checklist?.magazzino_importazione || "",
          Tipo: i.incluso ? "INCLUSO" : "EXTRA",
          "Stato fatturazione": formatInvoiceStatus(i.fatturazione_stato),
          "Numero fattura": i.numero_fattura || "",
          "Fatturato il": fmtDate(i.fatturato_il),
          Descrizione: i.descrizione || "",
          Note: i.note || "",
          "PROGETTO ID": i.checklist_id ?? "",
        };
      });
    const statusOrder: Record<string, number> = {
      DA_FATTURARE: 0,
      FATTURATO: 1,
      NON_FATTURARE: 2,
    };
    rows.sort((a, b) => {
      const aRaw =
        interventi.find((i) => fmtDate(i.data) === a.Data && (i.descrizione || "") === a.Descrizione)
          ?.fatturazione_stato || "";
      const bRaw =
        interventi.find((i) => fmtDate(i.data) === b.Data && (i.descrizione || "") === b.Descrizione)
          ?.fatturazione_stato || "";
      const ao = statusOrder[String(aRaw || "").toUpperCase()] ?? 9;
      const bo = statusOrder[String(bRaw || "").toUpperCase()] ?? 9;
      if (ao !== bo) return ao - bo;
      return String(b.Data || "").localeCompare(String(a.Data || ""));
    });
    const headers = [
      "Data",
      "Cliente",
      "PROGETTO",
      "Proforma",
      "Cod. magazzino",
      "Tipo",
      "Stato fatturazione",
      "Numero fattura",
      "Fatturato il",
      "Descrizione",
      "Note",
      "PROGETTO ID",
    ];
    const csv = toCsv(rows, headers);
    const safeCliente = (cliente || "cliente").replace(/\s+/g, "_");
    downloadCsv(`Cliente_${safeCliente}_Interventi_${exportRangeLabel}.csv`, csv);
    setExportNotice(
      rows.length > 0
        ? `✅ CSV generato (${rows.length} righe)`
        : "⚠️ Nessun dato nel periodo selezionato"
    );
  }

  function exportRinnoviCsv() {
    const rows = rinnovi
      .filter((r) => (exportFrom || exportTo ? inDateRange(r.scadenza) : true))
      .map((r) => {
        const checklist = r.checklist_id ? checklistById.get(r.checklist_id) : null;
        return {
          "Tipo servizio": String(r.item_tipo || "").toUpperCase(),
          Scadenza: fmtDate(r.scadenza),
          Stato: formatRinnovoStatus(r.stato),
          PROGETTO: checklist?.nome_checklist || "",
          Proforma: checklist?.proforma || "",
          "Cod. magazzino": checklist?.magazzino_importazione || "",
          "Avviso inviato il": fmtDate(r.notify_stage1_sent_at),
          "Alert admin inviato il": fmtDate(r.billing_stage2_sent_at),
          "Numero fattura": r.numero_fattura || "",
          Note: r.note_tecniche || "",
          "PROGETTO ID": r.checklist_id || "",
          "Item ID": r.id || "",
        };
      });
    const statusOrder: Record<string, number> = {
      DA_AVVISARE: 0,
      CONFERMATO: 1,
      DA_FATTURARE: 2,
      FATTURATO: 3,
      NON_RINNOVATO: 4,
    };
    rows.sort((a, b) => {
      const aRaw = rinnovi.find((r) => r.id === a["Item ID"])?.stato || "";
      const bRaw = rinnovi.find((r) => r.id === b["Item ID"])?.stato || "";
      const ao = statusOrder[String(aRaw || "").toUpperCase()] ?? 9;
      const bo = statusOrder[String(bRaw || "").toUpperCase()] ?? 9;
      if (ao !== bo) return ao - bo;
      return String(a.Scadenza || "").localeCompare(String(b.Scadenza || ""));
    });
    const headers = [
      "Tipo servizio",
      "Scadenza",
      "Stato",
      "PROGETTO",
      "Proforma",
      "Cod. magazzino",
      "Avviso inviato il",
      "Alert admin inviato il",
      "Numero fattura",
      "Note",
      "PROGETTO ID",
      "Item ID",
    ];
    const csv = toCsv(rows, headers);
    const safeCliente = (cliente || "cliente").replace(/\s+/g, "_");
    downloadCsv(`Cliente_${safeCliente}_ScadenzeRinnovi_${exportRangeLabel}.csv`, csv);
    setExportNotice(
      rows.length > 0
        ? `✅ CSV generato (${rows.length} righe)`
        : "⚠️ Nessun dato nel periodo selezionato"
    );
  }

  function exportFatturazioneCsv() {
    const interventiRows = interventi
      .filter((i) => (exportFrom || exportTo ? inDateRange(i.data) : true))
      .map((i) => {
        const checklist = i.checklist ?? checklistById.get(i.checklist_id || "") ?? null;
        return {
          Stato: formatInvoiceStatus(i.fatturazione_stato || ""),
          Categoria: "Intervento",
          Tipo: i.incluso ? "INCLUSO" : "EXTRA",
          Data: fmtDate(i.data),
          Cliente: cliente || "",
          PROGETTO: checklist?.nome_checklist || "",
          Proforma: i.proforma || checklist?.proforma || "",
          "Cod. magazzino": i.codice_magazzino || checklist?.magazzino_importazione || "",
          Descrizione: i.descrizione || "",
          "Numero fattura": i.numero_fattura || "",
          Note: i.note || "",
        };
      });
    const rinnoviRows = rinnovi
      .filter((r) => (exportFrom || exportTo ? inDateRange(r.scadenza) : true))
      .map((r) => {
        const checklist = r.checklist_id ? checklistById.get(r.checklist_id) : null;
        const stato = String(r.stato || "").toUpperCase();
        const mapped =
          stato === "DA_FATTURARE" || stato === "FATTURATO" ? stato : "NON_PRONTO";
        const descr =
          r.descrizione ||
          `Rinnovo ${formatRinnovoTipo(r.item_tipo)} — scadenza ${fmtDate(r.scadenza)}`;
        return {
          Stato: mapped === "NON_PRONTO" ? "Non pronto" : formatInvoiceStatus(mapped),
          Categoria: "Rinnovo",
          Tipo: formatRinnovoTipo(r.item_tipo),
          Data: fmtDate(r.scadenza),
          Cliente: cliente || "",
          PROGETTO: checklist?.nome_checklist || "",
          Proforma: checklist?.proforma || "",
          "Cod. magazzino": checklist?.magazzino_importazione || "",
          Descrizione: descr,
          "Numero fattura": r.numero_fattura || "",
          Note: r.note_tecniche || "",
        };
      });
    const rows = [...interventiRows, ...rinnoviRows].sort((a, b) => {
      const order = (v: string) =>
        v === "Da fatturare" ? 0 : v === "Fatturato" ? 1 : 2;
      if (a.Stato !== b.Stato) return order(a.Stato) - order(b.Stato);
      if (a.Categoria !== b.Categoria) {
        return exportFattInterventiFirst
          ? a.Categoria === "Intervento"
            ? -1
            : 1
          : a.Categoria === "Rinnovo"
          ? -1
          : 1;
      }
      return String(a.Data || "").localeCompare(String(b.Data || ""));
    });
    const headers = [
      "Stato",
      "Categoria",
      "Tipo",
      "Data",
      "Cliente",
      "PROGETTO",
      "Proforma",
      "Cod. magazzino",
      "Descrizione",
      "Numero fattura",
      "Note",
    ];
    const csv = toCsv(rows, headers);
    const safeCliente = (cliente || "cliente").replace(/\s+/g, "_");
    downloadCsv(`Cliente_${safeCliente}_Fatturazione_${exportRangeLabel}.csv`, csv);
    setExportNotice(
      rows.length > 0
        ? `✅ CSV generato (${rows.length} righe)`
        : "⚠️ Nessun dato nel periodo selezionato"
    );
  }

  async function exportLogAvvisiCsv() {
    if (exportLogSending) return;
    setExportLogSending(true);
    try {
      const checklistIds = checklists.map((c) => c.id).filter(Boolean);
      if (checklistIds.length === 0) {
        showToast("❌ Export Log Avvisi fallito: nessun PROGETTO", "error");
        setExportLogSending(false);
        return;
      }
      const rows: Record<string, any>[] = [];
      const chunks = chunkArray(checklistIds, 500);
      const today = new Date();
      const defaultFrom = new Date(today);
      defaultFrom.setDate(defaultFrom.getDate() - 365);
      for (const ids of chunks) {
        let q = dbFrom("checklist_alert_log")
          .select(
            "created_at, tipo, riferimento, scadenza, modalita, stato, trigger, inviato_email, to_operatore_id, to_email, to_nome, destinatario, subject, messaggio, checklist_id, intervento_id"
          )
          .in("checklist_id", ids)
          .order("created_at", { ascending: false });
        if (exportFrom) {
          q = q.gte("created_at", `${exportFrom}T00:00:00`);
        } else if (!exportTo) {
          q = q.gte("created_at", defaultFrom.toISOString());
        }
        if (exportTo) {
          q = q.lte("created_at", `${exportTo}T23:59:59`);
        }
        const { data, error } = await q;
        if (error) throw error;
        for (const r of (data || []) as any[]) {
          rows.push({
            created_at: r.created_at ?? "",
            tipo: r.tipo ?? "",
            riferimento: r.riferimento ?? "",
            scadenza: r.scadenza ?? "",
            modalita: r.modalita ?? "",
            stato: r.stato ?? "",
            trigger: r.trigger ?? "",
            inviato_email: r.inviato_email ?? "",
            to_operatore_id: r.to_operatore_id ?? "",
            to_email: r.to_email ?? "",
            to_nome: r.to_nome ?? "",
            destinatario: r.destinatario ?? "",
            subject: r.subject ?? "",
            messaggio:
              typeof r.messaggio === "string" && r.messaggio.length > 300
                ? `${r.messaggio.slice(0, 300)}…`
                : r.messaggio ?? "",
            checklist_id: r.checklist_id ?? "",
            intervento_id: r.intervento_id ?? "",
          });
        }
      }
      const headers = [
        "created_at",
        "tipo",
        "riferimento",
        "scadenza",
        "modalita",
        "stato",
        "trigger",
        "inviato_email",
        "to_operatore_id",
        "to_email",
        "to_nome",
        "destinatario",
        "subject",
        "messaggio",
        "checklist_id",
        "intervento_id",
      ];
      const csv = toCsv(rows, headers);
      downloadCsv(getLogExportFilename(), csv);
      showToast("✅ CSV Log Avvisi scaricato", "success");
    } catch (err) {
      console.error("Export Log Avvisi failed", err);
      showToast(`❌ Export Log Avvisi fallito: ${briefError(err)}`, "error");
    } finally {
      setExportLogSending(false);
    }
  }

  const checklistById = useMemo(() => {
    const map = new Map<string, ChecklistRow>();
    for (const c of checklists) {
      map.set(c.id, c);
    }
    return map;
  }, [checklists]);

  function getInterventoDefaultsFromChecklist(checklistId: string) {
    const found = checklistById.get(String(checklistId || "").trim());
    return {
      proforma: String(found?.proforma || "").trim(),
      codiceMagazzino: String(found?.magazzino_importazione || "").trim(),
    };
  }

  useEffect(() => {
    if (!newIntervento.checklistId) return;
    const defaults = getInterventoDefaultsFromChecklist(newIntervento.checklistId);
    setNewIntervento((prev) => {
      if (
        prev.proforma === defaults.proforma &&
        prev.codiceMagazzino === defaults.codiceMagazzino
      ) {
        return prev;
      }
      return {
        ...prev,
        proforma: defaults.proforma,
        codiceMagazzino: defaults.codiceMagazzino,
      };
    });
  }, [newIntervento.checklistId, checklistById]);

  const nextLicenzaScadenza = useMemo(() => {
    return getNextLicenzaScadenza(licenze);
  }, [licenze]);

  const currentOperatore = useMemo(() => {
    if (!currentOperatoreId) return null;
    return alertOperatori.find((o) => o.id === currentOperatoreId) ?? null;
  }, [alertOperatori, currentOperatoreId]);

  const interventiInclusiUsati = useMemo(() => {
    return interventi.filter((i) => i.incluso).length;
  }, [interventi]);

  const interventiTotali = useMemo(() => {
    if (!contratto) return null;
    if (contratto.illimitati) return null;
    const val = contratto.interventi_annui;
    return val == null ? null : Number(val);
  }, [contratto]);

  const interventiResidui = useMemo(() => {
    if (interventiTotali == null) return null;
    return Math.max(0, interventiTotali - interventiInclusiUsati);
  }, [interventiTotali, interventiInclusiUsati]);

  const ultraCoverageByChecklist = useMemo(() => {
    const byChecklist = new Map<string, { total: number; unlimited: boolean }>();
    const today = startOfToday();

    for (const c of checklists) {
      if (!c.id) continue;
      const entry = byChecklist.get(c.id) || { total: 0, unlimited: false };
      if (c.ultra_interventi_illimitati) {
        entry.unlimited = true;
      } else if (typeof c.ultra_interventi_inclusi === "number" && c.ultra_interventi_inclusi > 0) {
        entry.total += c.ultra_interventi_inclusi;
      }
      byChecklist.set(c.id, entry);
    }

    for (const r of rinnovi) {
      const itemTipo = String(r.item_tipo || "").toUpperCase();
      const subtipo = String(r.subtipo || "").toUpperCase();
      const checklistId = String(r.checklist_id || "");
      if (!checklistId) continue;
      if (itemTipo !== "SAAS" || subtipo !== "ULTRA") continue;
      const stato = String(r.stato || "").toUpperCase();
      if (["NON_RINNOVATO", "SCADUTO"].includes(stato)) continue;
      const dt = parseLocalDay(r.scadenza || null);
      if (dt && dt < today) continue;

      const entry = byChecklist.get(checklistId) || { total: 0, unlimited: false };
      const code = String(r.riferimento || "").trim().toUpperCase();
      const piano = ultraPiani.find((p) => String(p.codice || "").trim().toUpperCase() === code);
      const isUnlimited =
        code.includes("ILL") || String(piano?.nome || "").toUpperCase().includes("ILLIMIT");
      if (isUnlimited) {
        entry.unlimited = true;
      } else {
        const included = Number(piano?.interventi_inclusi ?? 0);
        if (Number.isFinite(included) && included > 0) {
          entry.total += included;
        }
      }
      byChecklist.set(checklistId, entry);
    }

    const out = new Map<string, number | null>();
    for (const [checklistId, entry] of byChecklist.entries()) {
      if (entry.unlimited) {
        out.set(checklistId, null);
        continue;
      }
      // "0" means no project-specific ULTRA cap configured:
      // let caller fallback to cliente-wide inclusi logic.
      if (entry.total > 0) {
        out.set(checklistId, entry.total);
      }
    }
    return out;
  }, [checklists, rinnovi, ultraPiani]);

  const ultraPianoOptions = useMemo(() => {
    return [
      ...ultraPiani,
      ...(ultraPiani.some((p) => p.codice === "SAAS-UL8")
        ? []
        : [
            {
              codice: "SAAS-UL8",
              nome: "CARE ULTRA (H8)",
              interventi_inclusi: null,
            },
          ]),
    ];
  }, [ultraPiani]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!expandedInterventoId) return;
      const files = interventoFilesById.get(expandedInterventoId) || [];
      if (files.length === 0) {
        if (alive) setInterventoFileUrls({});
        return;
      }
      const entries: Record<string, string> = {};
      for (const f of files) {
        const { data, error: urlErr } = await storageSignedUrl(f.storage_path);
        if (!urlErr && data?.signedUrl) {
          entries[f.id] = data.signedUrl;
        }
      }
      if (alive) setInterventoFileUrls(entries);
    })();
    return () => {
      alive = false;
    };
  }, [expandedInterventoId, interventoFilesById]);

  function isImageFile(filename: string) {
    const lower = filename.toLowerCase();
    return (
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".gif") ||
      lower.endsWith(".webp")
    );
  }

  async function fetchSaasContratti(clienteKey: string) {
    const key = (clienteKey || "").trim();
    if (!key) return [] as ContrattoRow[];
    return runSingleFlight(`saas_contratti.select:${key.toLowerCase()}`, async () => {
      perfCountDb("saas_contratti.select");
      const { data: contrattiData, error: contrattiErr } = await dbFrom("saas_contratti")
        .select("id, cliente, piano_codice, scadenza, interventi_annui, illimitati, created_at")
        .eq("cliente", key)
        .order("created_at", { ascending: false });

      if (contrattiErr) {
        setContrattoError("Errore caricamento contratto: " + contrattiErr.message);
        setContratto(null);
        setContrattiRows([]);
        return [] as ContrattoRow[];
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rows = (contrattiData || []) as ContrattoRow[];
      const active =
        rows.find((r) => {
          if (!r.scadenza) return true;
          const dt = parseLocalDay(r.scadenza);
          return dt != null && dt >= today;
        }) || (rows.length > 0 ? rows[0] : null);

      setContratto(active);
      setContrattiRows(rows);
      setContrattoError(null);
      if (active) {
        setContrattoForm({
          piano_codice: active.piano_codice ?? "",
          scadenza: active.scadenza ?? "",
          interventi_annui: active.interventi_annui != null ? String(active.interventi_annui) : "",
          illimitati: Boolean(active.illimitati),
        });
      } else {
        setContrattoForm({
          piano_codice: "",
          scadenza: "",
          interventi_annui: "",
          illimitati: false,
        });
      }

      return rows;
    });
  }

  async function saveContratto() {
    const clienteKey = (cliente || "").trim();
    if (!clienteKey) return;
    if (!contrattoForm.piano_codice.trim()) {
      setContrattoError("Seleziona un Piano ULTRA prima di salvare.");
      return;
    }

    const interventiAnnui = contrattoForm.illimitati
      ? null
      : contrattoForm.interventi_annui.trim() === ""
      ? null
      : Number(contrattoForm.interventi_annui.replace(",", "."));

    if (!contrattoForm.illimitati && contrattoForm.interventi_annui.trim() !== "") {
      if (!Number.isFinite(interventiAnnui)) {
        setContrattoError("Interventi annui non valido.");
        return;
      }
    }

    const payload = {
      cliente: clienteKey,
      piano_codice: contrattoForm.piano_codice.trim()
        ? contrattoForm.piano_codice.trim()
        : null,
      scadenza: contrattoForm.scadenza.trim() ? contrattoForm.scadenza.trim() : null,
      interventi_annui: interventiAnnui,
      illimitati: contrattoForm.illimitati,
    };

    let savedContratto: ContrattoRow | null = null;
    if (contratto?.id) {
      const { data, error: updErr } = await dbFrom("saas_contratti")
        .update(payload)
        .eq("id", contratto.id)
        .select("id, cliente, piano_codice, scadenza, interventi_annui, illimitati, created_at")
        .single();

      if (updErr) {
        setContrattoError("Errore salvataggio contratto: " + updErr.message);
        return;
      }
      savedContratto = data as ContrattoRow;
      setContratto(savedContratto);
    } else {
      const { data, error: insErr } = await dbFrom("saas_contratti")
        .insert(payload)
        .select("id, cliente, piano_codice, scadenza, interventi_annui, illimitati, created_at")
        .single();

      if (insErr) {
        setContrattoError("Errore creazione contratto: " + insErr.message);
        return;
      }
      savedContratto = data as ContrattoRow;
      setContratto(savedContratto);
    }

    if (savedContratto?.id) {
      const rinnovoPayload: Record<string, any> = {
        cliente: clienteKey,
        item_tipo: "SAAS",
        subtipo: "ULTRA",
        riferimento: savedContratto.piano_codice ?? "ULTRA",
        scadenza: savedContratto.scadenza ?? null,
        stato: "ATTIVA",
        descrizione: "ULTRA",
      };

      const scopeAll = applyUltraToAllProjects;
      const scopeSelected = !scopeAll && applyUltraToSelectedProjects;
      const scopedChecklistIds = scopeAll
        ? checklists.map((c) => c.id)
        : scopeSelected
        ? selectedUltraProjectIds
        : [];

      if (scopeSelected && scopedChecklistIds.length === 0) {
        setContrattoError("Seleziona almeno un progetto per applicare SAAS ULTRA.");
        return;
      }

      if (scopedChecklistIds.length > 0) {
        const { error: delGlobalErr } = await dbFrom("rinnovi_servizi")
          .delete()
          .eq("cliente", clienteKey)
          .eq("item_tipo", "SAAS")
          .eq("subtipo", "ULTRA")
          .is("checklist_id", null);
        if (delGlobalErr) console.error("Errore delete ultra globale", delGlobalErr);

        // Evita duplicati: massimo una SAAS_ULTRA per progetto.
        const { error: delScopedErr } = await dbFrom("rinnovi_servizi")
          .delete()
          .eq("cliente", clienteKey)
          .eq("item_tipo", "SAAS")
          .eq("subtipo", "ULTRA")
          .in("checklist_id", scopedChecklistIds);
        if (delScopedErr) console.error("Errore delete ultra scoped", delScopedErr);

        const scopedRows = scopedChecklistIds
          .filter(Boolean)
          .map((checklistId) => {
            const checklist = checklistById.get(checklistId);
            return {
              ...rinnovoPayload,
              checklist_id: checklistId,
              proforma: checklist?.proforma ?? null,
              cod_magazzino: checklist?.magazzino_importazione ?? null,
            };
          });
        const { error: insScopedErr } = await dbFrom("rinnovi_servizi")
          .insert(scopedRows);
        if (insScopedErr) console.error("Errore insert ultra per progetto", insScopedErr);
      } else {
        // Modalità globale: pulisce eventuali associazioni ULTRA per-progetto.
        const { error: delAllScopedErr } = await dbFrom("rinnovi_servizi")
          .delete()
          .eq("cliente", clienteKey)
          .eq("item_tipo", "SAAS")
          .eq("subtipo", "ULTRA")
          .not("checklist_id", "is", null);
        if (delAllScopedErr) console.error("Errore delete ultra scoped all", delAllScopedErr);

        const { data: existing, error: findErr } = await dbFrom("rinnovi_servizi")
          .select("id")
          .eq("item_tipo", "SAAS")
          .eq("subtipo", "ULTRA")
          .eq("cliente", clienteKey)
          .is("checklist_id", null)
          .maybeSingle();

        if (findErr) {
          console.error("Errore lookup rinnovo SAAS", findErr);
        } else if (existing?.id) {
          const { error: updErr } = await dbFrom("rinnovi_servizi")
            .update(rinnovoPayload)
            .eq("id", existing.id);
          if (updErr) console.error("Errore update rinnovo SAAS", updErr);
        } else {
          const { error: insErr } = await dbFrom("rinnovi_servizi")
            .insert(rinnovoPayload);
          if (insErr) console.error("Errore insert rinnovo SAAS", insErr);
        }
      }
    }

    await fetchSaasContratti(clienteKey);
    setContrattoError(null);
    setApplyUltraToAllProjects(false);
    setApplyUltraToSelectedProjects(false);
    setSelectedUltraProjectIds([]);
    showToast("✅ ULTRA salvata", "success");
  }

  async function addIntervento() {
    const clienteKey = (cliente || "").trim();
    const descrizione = newIntervento.tipo.trim();
    if (!descrizione) {
      setInterventiError("Inserisci la descrizione intervento.");
      return;
    }
    if (!newIntervento.checklistId) {
      setInterventiError("Seleziona un PROGETTO per l'intervento.");
      return;
    }

    let inclusoToSave = newIntervento.incluso;
    let noteTecnicheToSave: string | null = null;
    if (newIntervento.incluso) {
      const checklistId = String(newIntervento.checklistId || "");
      const projectCap = ultraCoverageByChecklist.get(checklistId);
      if (projectCap !== undefined && projectCap !== null) {
        const usedOnProject = interventi.filter(
          (i) => i.incluso && String(i.checklist_id || "") === checklistId
        ).length;
        if (usedOnProject >= projectCap) {
          inclusoToSave = false;
          setInterventiInfo(
            `Interventi inclusi terminati sul progetto (${usedOnProject}/${projectCap}) → registrato come EXTRA`
          );
          noteTecnicheToSave = "Auto-EXTRA: inclusi ULTRA progetto finiti";
        }
      } else if (
        contratto &&
        !contratto.illimitati &&
        interventiTotali != null &&
        interventiInclusiUsati >= interventiTotali
      ) {
        // fallback legacy cliente-wide
        inclusoToSave = false;
        setInterventiInfo("Interventi inclusi terminati → registrato come EXTRA");
        noteTecnicheToSave = "Auto-EXTRA: inclusi finiti";
      }
    }

    const dataValue =
      newIntervento.data?.trim() || new Date().toISOString().slice(0, 10);
    const fatturazione =
      normalizeInterventoEsitoFatturazioneValue(newIntervento.fatturazioneStato) || "DA_FATTURARE";
    const fatturatoIlValue =
      fatturazione === "FATTURATO"
        ? newIntervento.fatturatoIl?.trim() || new Date().toISOString().slice(0, 10)
        : null;

    const payload = {
      cliente: clienteKey,
      checklist_id: newIntervento.checklistId,
      contratto_id: contratto?.id ?? null,
      ticket_no: newIntervento.ticketNo.trim() ? newIntervento.ticketNo.trim() : null,
      data: dataValue,
      data_tassativa: newIntervento.dataTassativa?.trim() ? newIntervento.dataTassativa.trim() : null,
      tipo: descrizione,
      descrizione,
      incluso: inclusoToSave,
      proforma: newIntervento.proforma.trim() ? newIntervento.proforma.trim() : null,
      codice_magazzino: newIntervento.codiceMagazzino.trim()
        ? newIntervento.codiceMagazzino.trim()
        : null,
      fatturazione_stato: null,
      stato_intervento: "APERTO",
      esito_fatturazione: fatturazione,
      chiuso_il: null,
      chiuso_da_operatore: null,
      numero_fattura: newIntervento.numeroFattura.trim()
        ? newIntervento.numeroFattura.trim()
        : null,
      fatturato_il: fatturatoIlValue,
      note: newIntervento.note.trim() ? newIntervento.note.trim() : null,
      note_tecniche: noteTecnicheToSave,
    };

    let inserted: any = null;
    let insertErr: any = null;
    {
      const res = await dbFrom("saas_interventi")
        .insert(payload)
        .select("id")
        .single();
      inserted = res.data;
      insertErr = res.error;
    }
    if (insertErr && String(insertErr.message || "").toLowerCase().includes("ticket_no")) {
      const { ticket_no, ...legacyPayload } = payload as any;
      const res = await dbFrom("saas_interventi")
        .insert(legacyPayload)
        .select("id")
        .single();
      inserted = res.data;
      insertErr = res.error;
    }
    if (insertErr && String(insertErr.message || "").toLowerCase().includes("data_tassativa")) {
      const { data_tassativa, ...legacyPayload } = payload as any;
      const res = await dbFrom("saas_interventi")
        .insert(legacyPayload)
        .select("id")
        .single();
      inserted = res.data;
      insertErr = res.error;
    }

    if (insertErr) {
      setInterventiError("Errore inserimento intervento: " + insertErr.message);
      return;
    }
    let operativiSaveError: string | null = null;
    if (inserted?.id) {
      try {
        await saveInterventoOperativi(
          inserted.id,
          extractClienteInterventoOperativi(newIntervento)
        );
      } catch (e: any) {
        operativiSaveError =
          "Intervento creato ma dati operativi non salvati: " +
          String(e?.message || "errore sconosciuto");
      }
    }

    if (inserted?.id && newInterventoFiles.length > 0) {
      await uploadInterventoFilesList(inserted.id, newInterventoFiles);
    }
    if (inserted?.id && newInterventoLinks.length > 0) {
      await uploadInterventoLinksList(inserted.id, newInterventoLinks);
    }

    await loadInterventiForCliente(
      clienteKey,
      checklists.map((c) => c.id).filter(Boolean)
    );

    setNewIntervento({
      data: "",
      dataTassativa: "",
      tipo: "",
      ticketNo: "",
      incluso: true,
      note: "",
      checklistId: "",
      proforma: "",
      codiceMagazzino: "",
      fatturazioneStato: "DA_FATTURARE",
      numeroFattura: "",
      fatturatoIl: "",
      statoIntervento: "APERTO",
      dataInizio: "",
      durataGiorni: "",
      modalitaAttivita: "",
      personalePrevisto: "",
      personaleIds: [],
      mezzi: "",
      descrizioneAttivita: "",
      indirizzo: "",
      orario: "",
      referenteClienteNome: "",
      referenteClienteContatto: "",
      commercialeArtTechNome: "",
      commercialeArtTechContatto: "",
    });
    setNewInterventoFiles([]);
    setNewInterventoLinks([]);
    setInterventiError(operativiSaveError);
  }

  async function deleteIntervento(id: string) {
    const ok = window.confirm("Eliminare questo intervento?");
    if (!ok) return;
    const { error: delErr } = await dbFrom("saas_interventi").delete().eq("id", id);
    if (delErr) {
      setInterventiError("Errore eliminazione intervento: " + delErr.message);
      return;
    }
    setInterventi((prev) => prev.filter((i) => i.id !== id));
  }

  function buildAutoFatturazioneMessage(i: InterventoRow) {
    const checklistName = i.checklist?.nome_checklist ?? i.checklist_id ?? "—";
    const proforma = i.proforma || i.checklist?.proforma || "—";
    const dataLabel = i.data ? new Date(i.data).toLocaleDateString() : "—";
    return `Cliente: ${cliente || "—"} | PROGETTO: ${checklistName} | Proforma: ${proforma} | Data: ${dataLabel}`;
  }

  function buildFattureAlertMessage(list: InterventoRow[]) {
    const link = `/clienti/${encodeURIComponent(cliente)}`;
    const lines = list.map((i) => {
      const dataLabel = i.data ? new Date(i.data).toLocaleDateString() : "—";
      const proforma = i.proforma || i.checklist?.proforma || "—";
      const codice = i.codice_magazzino || i.checklist?.magazzino_importazione || "—";
      const note = i.note ? ` — ${i.note}` : "";
      return `${dataLabel} | ${proforma} | ${codice}${note}`;
    });
    return [
      `Cliente: ${cliente || "—"}`,
      `Interventi da fatturare: ${list.length}`,
      ...lines,
      `Link: ${link}`,
    ].join("\n");
  }

  function buildBulkFattureMessage(list: InterventoRow[]) {
    const link = `/clienti/${encodeURIComponent(cliente)}`;
    const checklistMap = new Map(
      checklists.map((c) => [
        c.id,
        {
          nome: c.nome_checklist ?? null,
          proforma: c.proforma ?? null,
          codMag: c.magazzino_importazione ?? null,
        },
      ])
    );
    const shortId = (value?: string | null) => (value ? value.slice(0, 8) : "—");
    const fmtDate = (value?: string | null) =>
      value ? new Date(value).toLocaleDateString() : "—";
    const trimDesc = (value?: string | null) => {
      const raw = String(value || "—").trim();
      return raw.length > 80 ? `${raw.slice(0, 77)}...` : raw;
    };
    const grouped = new Map<string, InterventoRow[]>();
    for (const i of list) {
      const key = i.checklist_id || "—";
      const arr = grouped.get(key) || [];
      arr.push(i);
      grouped.set(key, arr);
    }
    const sortedChecklistIds = Array.from(grouped.keys()).sort((a, b) => {
      const aName = checklistMap.get(a)?.nome ?? a;
      const bName = checklistMap.get(b)?.nome ?? b;
      return String(aName).localeCompare(String(bName));
    });
    const lines: string[] = [];
    for (const checklistId of sortedChecklistIds) {
      const meta = checklistMap.get(checklistId);
      const name = meta?.nome ?? shortId(checklistId);
      const proforma = meta?.proforma ?? "—";
      const codMag = meta?.codMag ?? "—";
      const linkChecklist = checklistId !== "—" ? `/checklists/${checklistId}` : "—";
      lines.push(`CHECKLIST: ${name} (id: ${shortId(checklistId)})`);
      lines.push(`Proforma: ${proforma} | CodMag: ${codMag} | Link: ${linkChecklist}`);
      const items = grouped.get(checklistId) || [];
      items.sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
      for (const i of items) {
        const tipo = i.incluso ? "INCLUSO" : "EXTRA";
        const auto = i.note_tecniche && i.note_tecniche.includes("Auto-EXTRA") ? " AUTO" : "";
        const note = i.note ? ` | Note: ${trimDesc(i.note)}` : "";
        lines.push(
          `- ${fmtDate(i.data)} | ${tipo}${auto} | ${trimDesc(i.descrizione)}${note}`
        );
      }
      lines.push("");
    }
    return [
      `FATTURE DA EMETTERE — Cliente: ${cliente || "—"}`,
      `Totale interventi: ${list.length}`,
      `Totale PROGETTI coinvolti: ${sortedChecklistIds.length}`,
      `Data invio: ${new Date().toLocaleString()}`,
      "",
      ...lines.filter((l) => l !== ""),
      "",
      `Link: ${link}`,
    ].join("\n");
  }

  function buildAlertMessage(i: InterventoRow) {
    const parts = [
      "Intervento EXTRA da fatturare",
      `Cliente: ${cliente || "—"}`,
      `PROGETTO: ${i.checklist?.nome_checklist ?? i.checklist_id ?? "—"}`,
      `Proforma: ${i.proforma || i.checklist?.proforma || "—"}`,
      `CodMag: ${i.codice_magazzino || i.checklist?.magazzino_importazione || "—"}`,
      `Data: ${i.data ? new Date(i.data).toLocaleDateString() : "—"}`,
      `Descrizione: ${i.descrizione || "—"}`,
    ];
    return parts.join(" — ");
  }

  function openInterventoAlertModal(i: InterventoRow) {
    setAlertInterventoId(i.id);
    setAlertDestinatarioId("");
    setAlertMessaggio(buildAlertMessage(i));
    setAlertNotice(null);
  }

  function openBulkInterventoAlertModal() {
    const list = getFattureDaEmettereList();
    if (list.length === 0) {
      setInterventiInfo("Nessuna fattura da emettere.");
      return;
    }
    setBulkErr(null);
    setBulkOk(null);
    setBulkToOperatoreId("");
    setBulkMsg(buildBulkFattureMessage(list));
    setBulkOpen(true);
  }

  async function confirmCloseIntervento() {
    if (!closeInterventoId) return;
    if (!closeEsito) {
      setCloseError("Seleziona un esito di fatturazione.");
      return;
    }
    const intervento = interventi.find((x) => x.id === closeInterventoId);
    const noteTrim = closeNote.trim();
    let noteTecniche = intervento?.note_tecniche ?? "";
    if (noteTrim) {
      noteTecniche = noteTecniche
        ? `${noteTecniche}\nChiusura: ${noteTrim}`
        : `Chiusura: ${noteTrim}`;
    }

    const payload = {
      stato_intervento: "CHIUSO",
      fatturazione_stato: closeEsito,
      esito_fatturazione: closeEsito,
      chiuso_il: new Date().toISOString(),
      chiuso_da_operatore: currentOperatoreId ?? null,
      note_tecniche: noteTecniche ? noteTecniche : null,
    };

    const { error: updErr } = await dbFrom("saas_interventi")
      .update(payload)
      .eq("id", closeInterventoId);

    if (updErr) {
      setCloseError("Errore chiusura intervento: " + updErr.message);
      return;
    }

    await loadInterventiForCliente(
      cliente,
      checklists.map((c) => c.id).filter(Boolean)
    );

    setCloseInterventoId(null);
    setCloseEsito("");
    setCloseNote("");
    setCloseError(null);
  }

  function getAlertRecipients() {
    return alertOperatori.filter(
      (o) => o.attivo !== false
    );
  }

  function getFatturaAlertRecipients() {
    return alertOperatori.filter(
      (o) => o.attivo !== false
    );
  }

  function getDefaultOperatoreIdByRole(role: string) {
    const target = alertOperatori.find(
      (o) =>
        o.attivo !== false &&
        String(o.email || "").includes("@") &&
        String(o.ruolo || "").toUpperCase() === role
    );
    if (target) return target.id;
    const fallback = alertOperatori.find(
      (o) => o.attivo !== false && String(o.email || "").includes("@")
    );
    return fallback?.id ?? "";
  }

  function getRinnoviRecipientLabel() {
    if (!rinnoviAlertToArtTech && rinnoviAlertToCliente) return "Cliente";
    if (rinnoviAlertDestMode === "email") {
      const mail = rinnoviAlertManualEmail.trim();
      const name = rinnoviAlertManualName.trim();
      return name ? `Email manuale: ${name} — ${mail}` : `Email manuale: ${mail}`;
    }
    const op = alertOperatori.find((o) => o.id === rinnoviAlertToOperatoreId);
    if (!op) return "Operatore selezionato";
    const role = op.ruolo ? ` — ${op.ruolo}` : "";
    const email = op.email ? ` — ${op.email}` : "";
    return `Operatore: ${op.nome ?? op.id}${role}${email}`;
  }

  async function loadRinnoviAlertRule(stage: "stage1" | "stage2") {
    const clienteKey = String(cliente || "").trim();
    if (!clienteKey) {
      setRinnoviAlertRule(getDefaultRenewalAlertRule("", stage));
      return;
    }
    setRinnoviAlertRuleLoading(true);
    const { data, error } = await dbFrom("renewal_alert_rules")
      .select("*")
      .eq("cliente", clienteKey)
      .eq("stage", stage)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("Errore caricamento renewal_alert_rules", error);
      setRinnoviAlertRule(getDefaultRenewalAlertRule(clienteKey, stage));
    } else {
      setRinnoviAlertRule(normalizeRenewalAlertRule((data as any) || null, clienteKey, stage));
    }
    setRinnoviAlertRuleLoading(false);
  }

  async function saveRinnoviAlertRule(rule: RenewalAlertRuleRow) {
    const clienteKey = String(cliente || "").trim();
    if (!clienteKey) return;
    setRinnoviAlertRuleSaving(true);
    setRinnoviAlertErr(null);
    setRinnoviAlertOk(null);
    const payload = normalizeRenewalAlertRule(rule, clienteKey, rule.stage);
    const canSendToClienteAutomatically =
      clienteScadenzeDeliveryMode === "AUTO_CLIENTE" &&
      String(clienteAnagraficaEmail || "").includes("@");
    if (!canSendToClienteAutomatically && payload.send_to_cliente) {
      payload.send_to_cliente = false;
      setRinnoviAlertErr(
        clienteScadenzeDeliveryMode === "MANUALE_INTERNO"
          ? "Invio automatico cliente disattivato: il cliente è in modalità Manuale interno."
          : "Inserire email cliente in scheda cliente per attivare gli avvisi automatici."
      );
    }
    const { data, error } = await dbFrom("renewal_alert_rules")
      .upsert(payload, { onConflict: "cliente,stage" })
      .select("*")
      .single();
    if (error) {
      setRinnoviAlertErr(`Errore salvataggio override cliente: ${error.message}`);
      setRinnoviAlertRuleSaving(false);
      return;
    }
    const saved = normalizeRenewalAlertRule((data as any) || payload, clienteKey, rule.stage);
    setRinnoviAlertRule(saved);
    setRinnoviAlertOk("✅ Override cliente salvato.");
    setRinnoviAlertRuleSaving(false);
  }

  async function fetchRinnovi(clienteKey: string, checklistIdsInput?: string[]) {
    if (!clienteKey) return [] as RinnovoServizioRow[];
    const checklistIds = (checklistIdsInput || []).filter(Boolean);
    const loadKey = `rinnovi_servizi.select:${String(clienteKey || "")
      .trim()
      .toLowerCase()}:${checklistIdsKey(checklistIds)}`;
    return runSingleFlight(loadKey, async () => {
      perfCountDb("rinnovi_servizi.select");
      const base = dbFrom("rinnovi_servizi").select("*");
      const q =
        checklistIds.length > 0
          ? base.in("checklist_id", checklistIds)
          : base.eq("cliente", clienteKey);
      const { data, error } = await q.order("scadenza", { ascending: true });
      if (error) {
        setRinnoviError("Errore caricamento rinnovi: " + error.message);
        return [] as RinnovoServizioRow[];
      }
      const rows = (data || []) as RinnovoServizioRow[];
      setRinnovi(rows);
      setRinnoviError(null);
      return rows;
    });
  }

  async function fetchTagliandi(clienteKey: string, checklistIdsInput?: string[]) {
    if (!clienteKey) return [] as TagliandoRow[];
    const checklistIds = (checklistIdsInput || []).filter(Boolean);
    const loadKey = `tagliandi.select:${String(clienteKey || "")
      .trim()
      .toLowerCase()}:${checklistIdsKey(checklistIds)}`;
    return runSingleFlight(loadKey, async () => {
      perfCountDb("tagliandi.select");
      const base = dbFrom("tagliandi").select("*");
      const q =
        checklistIds.length > 0
          ? base.in("checklist_id", checklistIds)
          : base.eq("cliente", clienteKey);
      const { data, error } = await q.order("scadenza", { ascending: true });
      if (error) {
        setRinnoviError("Errore caricamento tagliandi: " + error.message);
        return [] as TagliandoRow[];
      }
      const rows = (data || []) as TagliandoRow[];
      setTagliandi(rows);
      return rows;
    });
  }

  async function addTagliandoPeriodico() {
    const clienteKey = (cliente || "").trim();
    if (!clienteKey) {
      setRinnoviError("Cliente non valido per inserire il tagliando.");
      return;
    }
    if (!newTagliando.checklist_id) {
      setRinnoviError("Seleziona il progetto del tagliando.");
      return;
    }
    if (!newTagliando.scadenza) {
      setRinnoviError("Inserisci la scadenza del tagliando.");
      return;
    }

    const fatt = String(newTagliando.fatturazione || "INCLUSO").toUpperCase();
    const modalita = fatt === "INCLUSO" ? "INCLUSO" : "EXTRA";
    const stato =
      fatt === "FATTURATO"
        ? "FATTURATO"
        : fatt === "DA_FATTURARE"
        ? "DA_FATTURARE"
        : "DA_AVVISARE";

    setTagliandoSaving(true);
    setRinnoviError(null);
    try {
      const payload = {
        cliente: clienteKey,
        checklist_id: newTagliando.checklist_id,
        scadenza: newTagliando.scadenza,
        modalita,
        stato,
        note: (newTagliando.note || "").trim() || "Tagliando periodico",
      };
      let { error } = await dbFrom("tagliandi").insert(payload);
      if (error && isTagliandoStatoCheckViolation(error)) {
        const retryPayload = {
          ...payload,
          stato: normalizeTagliandoStatoForDb(payload.stato),
        };
        const retry = await dbFrom("tagliandi").insert(retryPayload);
        error = retry.error;
      }
      if (error) {
        setRinnoviError("Errore inserimento tagliando: " + error.message);
        return;
      }
      setNewTagliando({
        checklist_id: "",
        scadenza: "",
        fatturazione: "INCLUSO",
        note: "",
      });
      setRinnoviNotice("Tagliando periodico inserito.");
      await fetchTagliandi(clienteKey);
    } finally {
      setTagliandoSaving(false);
    }
  }

  function getRinnovoReference(r: RinnovoServizioRow) {
    return r.riferimento || r.descrizione || r.checklist_id?.slice(0, 8) || "—";
  }

  function toScadenzaItemFromRinnovo(r: RinnovoServizioRow): ScadenzaItem {
    return {
      id: r.id,
      source: "rinnovi",
      sim_id: r.sim_id ?? null,
      item_tipo: r.item_tipo,
      riferimento: getRinnovoReference(r),
      descrizione: r.descrizione ?? null,
      checklist_id: r.checklist_id ?? null,
      scadenza: r.scadenza ?? null,
      stato: r.stato ?? null,
      proforma: r.proforma ?? null,
      cod_magazzino: r.cod_magazzino ?? null,
    };
  }

  function buildMsgTagliandoSingle(r: ScadenzaItem, stage: "stage1" | "stage2") {
    const dataLabel = r.scadenza ? new Date(r.scadenza).toLocaleDateString() : "—";
    const checklist = r.checklist_id ? checklistById.get(r.checklist_id) : null;
    const checklistName = checklist?.nome_checklist ?? r.checklist_id?.slice(0, 8) ?? "—";
    const header =
      stage === "stage1"
        ? `AVVISO TAGLIANDO — Cliente: ${cliente || "—"}`
        : `FATTURAZIONE TAGLIANDO — Cliente: ${cliente || "—"}`;
    const modalita = r.modalita ? `Modalità: ${String(r.modalita).toUpperCase()}` : "Modalità: —";
    return [
      header,
      `Riferimento: ${r.riferimento ?? r.descrizione ?? "—"}`,
      `Scadenza: ${dataLabel}`,
      `PROGETTO: ${checklistName}`,
      modalita,
      `Stato: ${String(r.stato || "—").toUpperCase()}`,
    ].join("\n");
  }

  function buildMsgScadenzaSingle(r: ScadenzaItem, stage: "stage1" | "stage2") {
    if (r.source === "tagliandi") return buildMsgTagliandoSingle(r, stage);
    return buildMsgRinnovoSingle(r as RinnovoServizioRow, stage);
  }

  function buildMsgScadenzaBulk(list: ScadenzaItem[], stage: "stage1" | "stage2") {
    const rinnoviItems = list.filter((x) => x.source === "rinnovi");
    const tagliandiItems = list.filter((x) => x.source === "tagliandi");
    const lines: string[] = [];
    const header =
      stage === "stage1"
        ? `AVVISO SCADENZE — Cliente: ${cliente || "—"}`
        : `FATTURAZIONE SCADENZE — Cliente: ${cliente || "—"}`;
    const now = new Date().toLocaleString();

    if (rinnoviItems.length > 0) {
      lines.push("RINNOVI:");
      for (const r of rinnoviItems) {
        const dataLabel = r.scadenza ? new Date(r.scadenza).toLocaleDateString() : "—";
        const checklist = r.checklist_id ? checklistById.get(r.checklist_id) : null;
        const checklistName = checklist?.nome_checklist ?? r.checklist_id?.slice(0, 8) ?? "—";
        const base = `${dataLabel} | ${r.riferimento ?? "—"} | PROGETTO: ${checklistName}`;
        const stato = r.stato ? ` | Stato: ${String(r.stato).toUpperCase()}` : "";
        lines.push(`- ${base}${stato}`);
      }
      lines.push("");
    }

    if (tagliandiItems.length > 0) {
      lines.push("TAGLIANDI:");
      for (const r of tagliandiItems) {
        const dataLabel = r.scadenza ? new Date(r.scadenza).toLocaleDateString() : "—";
        const checklist = r.checklist_id ? checklistById.get(r.checklist_id) : null;
        const checklistName = checklist?.nome_checklist ?? r.checklist_id?.slice(0, 8) ?? "—";
        const modalita = r.modalita ? ` | Modalità: ${String(r.modalita).toUpperCase()}` : "";
        const stato = r.stato ? ` | Stato: ${String(r.stato).toUpperCase()}` : "";
        lines.push(
          `- ${dataLabel} | ${r.riferimento ?? r.descrizione ?? "—"} | PROGETTO: ${checklistName}${modalita}${stato}`
        );
      }
      lines.push("");
    }

    return [header, `Totale: ${list.length}`, `Data invio: ${now}`, "", ...lines].join("\n");
  }

  function buildMsgRinnovoSingle(r: RinnovoServizioRow, stage: "stage1" | "stage2") {
    const dataLabel = r.scadenza ? new Date(r.scadenza).toLocaleDateString() : "—";
    const checklist = r.checklist_id ? checklistById.get(r.checklist_id) : null;
    const checklistName = checklist?.nome_checklist ?? r.checklist_id?.slice(0, 8) ?? "—";
    const proforma = r.proforma || checklist?.proforma || "—";
    const codMag = r.cod_magazzino || checklist?.magazzino_importazione || "—";
    const link = r.checklist_id ? `/checklists/${r.checklist_id}` : "—";
    const tipo = String(r.item_tipo || "ALTRO").toUpperCase();
    const header =
      stage === "stage1"
        ? `AVVISO RINNOVO — Cliente: ${cliente || "—"}`
        : `FATTURAZIONE RINNOVO — Cliente: ${cliente || "—"}`;
    return [
      header,
      `Tipo: ${tipo}`,
      `Riferimento: ${getRinnovoReference(r)}`,
      `Scadenza: ${dataLabel}`,
      `PROGETTO: ${checklistName} | Link: ${link}`,
      `Proforma: ${proforma} | CodMag: ${codMag}`,
      `Stato: ${String(r.stato || "—").toUpperCase()}`,
    ].join("\n");
  }

  function buildMsgRinnovoBulk(list: RinnovoServizioRow[], stage: "stage1" | "stage2") {
    const grouped = new Map<string, RinnovoServizioRow[]>();
    for (const r of list) {
      const key = String(r.item_tipo || "ALTRO").toUpperCase();
      const arr = grouped.get(key) || [];
      arr.push(r);
      grouped.set(key, arr);
    }
    const types = Array.from(grouped.keys()).sort();
    const lines: string[] = [];
    for (const tipo of types) {
      lines.push(`TIPO: ${tipo}`);
      const items = grouped.get(tipo) || [];
      items.sort((a, b) => String(a.scadenza || "").localeCompare(String(b.scadenza || "")));
      for (const r of items) {
        const dataLabel = r.scadenza ? new Date(r.scadenza).toLocaleDateString() : "—";
        const checklist = r.checklist_id ? checklistById.get(r.checklist_id) : null;
        const checklistName = checklist?.nome_checklist ?? r.checklist_id?.slice(0, 8) ?? "—";
        const proforma = r.proforma || checklist?.proforma || "—";
        const codMag = r.cod_magazzino || checklist?.magazzino_importazione || "—";
        const base = `${dataLabel} | ${getRinnovoReference(r)} | PROGETTO: ${checklistName} | Proforma: ${proforma} | CodMag: ${codMag}`;
        const link = r.checklist_id ? ` | /checklists/${r.checklist_id}` : "";
        const stato = r.stato ? ` | Stato: ${String(r.stato).toUpperCase()}` : "";
        lines.push(`- ${base}${link}${stato}`);
      }
      lines.push("");
    }
    const now = new Date().toLocaleString();
    const header =
      stage === "stage1"
        ? `AVVISO RINNOVI — Cliente: ${cliente || "—"}`
        : `FATTURAZIONE RINNOVI — Cliente: ${cliente || "—"}`;
    return [
      header,
      `Interventi: ${list.length}`,
      `Data invio: ${now}`,
      "",
      ...lines.filter((l) => l !== ""),
    ].join("\n");
  }

  async function updateRinnovo(id: string, payload: Record<string, any>) {
    const rawId = stripPrefixId(id);
    if (!rawId) return false;
    const normalizedPayload = { ...payload };
    if (Object.prototype.hasOwnProperty.call(normalizedPayload, "stato")) {
      const normalizedStato = normalizeRinnovoStatoForDb(normalizedPayload.stato);
      if (!normalizedStato) {
        setRinnoviError("Stato rinnovo non valido.");
        return false;
      }
      normalizedPayload.stato = normalizedStato;
    }
    const { error } = await dbFrom("rinnovi_servizi").update(normalizedPayload).eq("id", rawId);
    if (error) {
      setRinnoviError("Errore aggiornamento rinnovo: " + error.message);
      return false;
    }
    return true;
  }

  async function updateRinnovi(ids: string[], payload: Record<string, any>) {
    const rawIds = ids.map((id) => stripPrefixId(id)).filter(Boolean);
    if (rawIds.length === 0) return true;
    const normalizedPayload = { ...payload };
    if (Object.prototype.hasOwnProperty.call(normalizedPayload, "stato")) {
      const normalizedStato = normalizeRinnovoStatoForDb(normalizedPayload.stato);
      if (!normalizedStato) {
        setRinnoviError("Stato rinnovo non valido.");
        return false;
      }
      normalizedPayload.stato = normalizedStato;
    }
    const { error } = await dbFrom("rinnovi_servizi").update(normalizedPayload).in("id", rawIds);
    if (error) {
      setRinnoviError("Errore aggiornamento rinnovi: " + error.message);
      return false;
    }
    return true;
  }

  const LICENZA_STATI = [
    "DA_AVVISARE",
    "AVVISATO",
    "CONFERMATO",
    "DA_FATTURARE",
    "FATTURATO",
    "NON_RINNOVATO",
    "ANNULLATO",
  ];
  const TAGLIANDO_STATI = [
    "DA_AVVISARE",
    "AVVISATO",
    "CONFERMATO",
    "DA_FATTURARE",
    "FATTURATO",
    "NON_RINNOVATO",
    "SCADUTO",
  ];
  const RINNOVO_STATI = ["DA_AVVISARE", "AVVISATO", "CONFERMATO", "DA_FATTURARE", "FATTURATO", "NON_RINNOVATO"];
  const TAGLIANDO_MODALITA = ["INCLUSO", "EXTRA", "AUTORIZZATO_CLIENTE"];
  const FATTURAZIONE_MENU_OPTIONS = [
    "DA_FATTURARE",
    "FATTURATO",
    "NON_FATTURARE",
    "INCLUSO_DA_CONSUNTIVO",
  ];

  function openEditScadenza(r: ScadenzaItem) {
    const itemTipo = String(r.item_tipo || "").toUpperCase();
    const isGaranzia = r.source === "garanzie" || itemTipo === "GARANZIA";
    setEditScadenzaErr(null);
    let form: EditScadenzaForm = {
      tipo: "RINNOVO",
      scadenza: r.scadenza ?? "",
      stato: String(r.stato || "").toUpperCase(),
      modalita: String(r.modalita || ""),
      note: r.note ?? "",
      fornitore: "",
      intestato_a: "",
      descrizione: r.descrizione ?? "",
      saas_piano: "",
      licenza_tipo: "",
      licenza_class: "LICENZA",
    };
    if (r.source === "licenze") {
      const l = licenze.find((x) => x.id === r.id);
      form = {
        ...form,
        tipo: "LICENZA",
        scadenza: l?.scadenza ?? r.scadenza ?? "",
        stato: String(l?.status || l?.stato || r.stato || "").toUpperCase(),
        note: l?.note ?? "",
        fornitore: l?.fornitore ?? "",
        intestato_a: l?.intestata_a ?? "",
        licenza_tipo: l?.tipo ?? "",
        licenza_class: "LICENZA",
      };
    } else if (r.source === "tagliandi") {
      const t = tagliandi.find((x) => x.id === r.id);
      form = {
        ...form,
        tipo: "TAGLIANDO",
        scadenza: t?.scadenza ?? r.scadenza ?? "",
        stato: getWorkflowStato(r),
        modalita: String(t?.modalita || r.modalita || ""),
        note: t?.note ?? "",
      };
    } else if (r.source === "saas_contratto") {
      const c = r.contratto_id ? contrattiRows.find((x) => x.id === r.contratto_id) : null;
      form = {
        ...form,
        tipo: "SAAS_ULTRA",
        scadenza: c?.scadenza ?? r.scadenza ?? "",
        stato: "",
        note: "",
        saas_piano: c?.piano_codice ?? r.riferimento ?? "",
      };
    } else if (isGaranzia) {
      const c = r.checklist_id ? checklistById.get(r.checklist_id) : null;
      form = {
        ...form,
        tipo: "GARANZIA",
        scadenza: c?.garanzia_scadenza ?? r.scadenza ?? "",
        stato: "",
        note: "",
      };
    } else {
      const rr = rinnovi.find((x) => x.id === r.id);
      form = {
        ...form,
        tipo: "RINNOVO",
        scadenza: rr?.scadenza ?? r.scadenza ?? "",
        stato: String(rr?.stato || r.stato || "").toUpperCase(),
        descrizione: rr?.descrizione ?? r.descrizione ?? "",
      };
    }
    setEditScadenzaItem(r);
    setEditScadenzaForm(form);
    setEditScadenzaOpen(true);
  }

  async function saveEditScadenza() {
    if (!editScadenzaItem || !editScadenzaForm) return;
    setEditScadenzaSaving(true);
    setEditScadenzaErr(null);
    try {
      if (editScadenzaForm.tipo === "LICENZA") {
        const licenzaId = stripPrefixId(editScadenzaItem.id);
        if (!licenzaId) throw new Error("ID licenza non valido");
        const l = licenze.find((x) => String(x.id) === String(licenzaId));
        const checklistId = l?.checklist_id ?? editScadenzaItem.checklist_id ?? null;
        if (editScadenzaForm.licenza_class === "GARANZIA") {
          if (!checklistId) {
            throw new Error(
              "Questa licenza non è associata a un progetto. Impossibile convertirla in garanzia."
            );
          }
          const { error: updChecklistErr } = await dbFrom("checklists")
            .update({ garanzia_scadenza: editScadenzaForm.scadenza || null })
            .eq("id", checklistId);
          if (updChecklistErr) throw new Error(updChecklistErr.message);

          const { error: delLicErr } = await dbFrom("licenses")
            .delete()
            .eq("id", licenzaId);
          if (delLicErr) throw new Error(delLicErr.message);

          setLicenze((prev) => prev.filter((x) => String(x.id) !== String(licenzaId)));
          setChecklists((prev) =>
            prev.map((c) =>
              c.id === checklistId
                ? {
                    ...c,
                    garanzia_scadenza: editScadenzaForm.scadenza || null,
                  }
                : c
            )
          );
          showToast("✅ Voce convertita da licenza a garanzia", "success");
          setEditScadenzaOpen(false);
          return;
        }
        const { error } = await dbFrom("licenses")
          .update({
            scadenza: editScadenzaForm.scadenza || null,
            status: editScadenzaForm.stato || null,
            note: editScadenzaForm.note || null,
            fornitore: editScadenzaForm.fornitore || null,
            intestata_a: editScadenzaForm.intestato_a || null,
            tipo: editScadenzaForm.licenza_tipo || null,
          })
          .eq("id", licenzaId);
        if (error) throw new Error(error.message);
        setLicenze((prev) =>
          prev.map((l) =>
            String(l.id) === String(licenzaId)
              ? {
                  ...l,
                  scadenza: editScadenzaForm.scadenza || null,
                  status: editScadenzaForm.stato || null,
                  note: editScadenzaForm.note || null,
                  fornitore: editScadenzaForm.fornitore || null,
                  intestata_a: editScadenzaForm.intestato_a || null,
                  tipo: editScadenzaForm.licenza_tipo || null,
                }
              : l
          )
        );
      } else if (editScadenzaForm.tipo === "TAGLIANDO") {
        const tagliandoId = stripPrefixId(editScadenzaItem.id);
        if (!tagliandoId) throw new Error("ID tagliando non valido");
        const workflowStato = String(editScadenzaForm.stato || "").toUpperCase();
        const dbStato =
          workflowStato === "FATTURATO"
            ? "FATTURATO"
            : workflowStato === "NON_RINNOVATO" || workflowStato === "SCADUTO"
            ? "SCADUTO"
            : "ATTIVA";
        const okTag = await updateTagliando(tagliandoId, {
          scadenza: editScadenzaForm.scadenza || null,
          stato: dbStato,
          modalita: editScadenzaForm.modalita || null,
          note: editScadenzaForm.note || null,
        });
        if (!okTag) throw new Error("Errore aggiornamento tagliando");
        if (workflowStato) {
          await setTagliandoWorkflow(
            {
              ...editScadenzaItem,
              scadenza: editScadenzaForm.scadenza || editScadenzaItem.scadenza || null,
            },
            workflowStato
          );
        }
        setTagliandi((prev) =>
          prev.map((t) =>
            String(t.id) === String(tagliandoId)
              ? {
                  ...t,
                  scadenza: editScadenzaForm.scadenza || null,
                  stato: dbStato,
                  modalita: editScadenzaForm.modalita || null,
                  note: editScadenzaForm.note || null,
                }
              : t
          )
        );
      } else if (editScadenzaForm.tipo === "SAAS") {
        const checklistId = editScadenzaItem.checklist_id;
        if (!checklistId) throw new Error("Checklist non trovata");
        const { error } = await dbFrom("checklists")
          .update({
            saas_scadenza: editScadenzaForm.scadenza || null,
            saas_note: editScadenzaForm.note || null,
          })
          .eq("id", checklistId);
        if (error) throw new Error(error.message);
        setChecklists((prev) =>
          prev.map((c) =>
            c.id === checklistId
              ? {
                  ...c,
                  saas_scadenza: editScadenzaForm.scadenza || null,
                  saas_note: editScadenzaForm.note || null,
                }
              : c
          )
        );
      } else if (editScadenzaForm.tipo === "SAAS_ULTRA") {
        const contrattoId = editScadenzaItem.contratto_id;
        if (!contrattoId) throw new Error("Contratto non trovato");
        const { error } = await dbFrom("saas_contratti")
          .update({
            scadenza: editScadenzaForm.scadenza || null,
          })
          .eq("id", contrattoId);
        if (error) throw new Error(error.message);
        setContrattiRows((prev) =>
          prev.map((c) =>
            c.id === contrattoId
              ? {
                  ...c,
                  scadenza: editScadenzaForm.scadenza || null,
                }
              : c
          )
        );
        if (contratto?.id === contrattoId) {
          setContratto((prev) =>
            prev
              ? {
                  ...prev,
                  scadenza: editScadenzaForm.scadenza || null,
                }
              : prev
          );
        }
      } else if (editScadenzaForm.tipo === "GARANZIA") {
        const checklistId = editScadenzaItem.checklist_id;
        if (!checklistId) throw new Error("Checklist non trovata");
        const { error } = await dbFrom("checklists")
          .update({
            garanzia_scadenza: editScadenzaForm.scadenza || null,
          })
          .eq("id", checklistId);
        if (error) throw new Error(error.message);
        setChecklists((prev) =>
          prev.map((c) =>
            c.id === checklistId
              ? {
                  ...c,
                  garanzia_scadenza: editScadenzaForm.scadenza || null,
                }
              : c
          )
        );
      } else {
        const ok = await updateRinnovi([editScadenzaItem.id], {
          scadenza: editScadenzaForm.scadenza || null,
          stato: editScadenzaForm.stato || null,
          descrizione: editScadenzaForm.descrizione || null,
        });
        if (!ok) throw new Error("Errore aggiornamento rinnovo");
        setRinnovi((prev) =>
          prev.map((r) =>
            r.id === editScadenzaItem.id
              ? {
                  ...r,
                  scadenza: editScadenzaForm.scadenza || null,
                  stato: editScadenzaForm.stato || null,
                  descrizione: editScadenzaForm.descrizione || null,
                }
              : r
          )
        );
      }
      showToast("✅ Modifica salvata", "success");
      setEditScadenzaOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "Errore salvataggio");
      setEditScadenzaErr(msg);
      showToast(`❌ Salvataggio fallito: ${briefError(err)}`, "error");
    } finally {
      setEditScadenzaSaving(false);
    }
  }

  async function deleteContrattoFromScadenza() {
    if (!editScadenzaItem?.contratto_id) {
      setEditScadenzaErr("Contratto non trovato");
      return;
    }
    const clienteKey = (cliente || "").trim();
    setEditScadenzaSaving(true);
    setEditScadenzaErr(null);
    try {
      const { error } = await dbFrom("saas_contratti")
        .delete()
        .eq("id", editScadenzaItem.contratto_id);
      if (error) throw new Error(error.message);
      await fetchSaasContratti(clienteKey);
      setEditScadenzaOpen(false);
      showToast("✅ Contratto eliminato", "success");
    } catch (err: any) {
      setEditScadenzaErr(briefError(err));
      showToast(`❌ Eliminazione fallita: ${briefError(err)}`, "error");
    } finally {
      setEditScadenzaSaving(false);
    }
  }

  async function deleteScadenzaItemFromEdit() {
    if (!editScadenzaItem || !editScadenzaForm) return;
    const ok = window.confirm("Eliminare questa voce da Scadenze & Rinnovi?");
    if (!ok) return;
    setEditScadenzaSaving(true);
    setEditScadenzaErr(null);
    try {
      if (editScadenzaForm.tipo === "LICENZA") {
        const licenzaId = stripPrefixId(editScadenzaItem.id);
        if (!licenzaId) throw new Error("ID licenza non valido");
        const res = await fetch("/api/licenses/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "DELETE_LICENSE", licenseId: licenzaId }),
        });
        const json = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(String(json?.error || "Errore eliminazione licenza"));
        setLicenze((prev) => prev.filter((x) => String(x.id) !== String(licenzaId)));
      } else if (editScadenzaForm.tipo === "TAGLIANDO") {
        const tagliandoId = stripPrefixId(editScadenzaItem.id);
        if (!tagliandoId) throw new Error("ID tagliando non valido");
        const { error } = await dbFrom("tagliandi").delete().eq("id", tagliandoId);
        if (error) throw new Error(error.message);
        setTagliandi((prev) => prev.filter((x) => String(x.id) !== String(tagliandoId)));
      } else if (editScadenzaForm.tipo === "RINNOVO") {
        const rinnovoId = stripPrefixId(editScadenzaItem.id);
        if (!rinnovoId) throw new Error("ID rinnovo non valido");
        const { error } = await dbFrom("rinnovi_servizi")
          .delete()
          .eq("id", rinnovoId);
        if (error) throw new Error(error.message);
        setRinnovi((prev) => prev.filter((x) => String(x.id) !== String(rinnovoId)));
      } else if (editScadenzaForm.tipo === "SAAS_ULTRA") {
        await deleteContrattoFromScadenza();
        return;
      } else {
        setEditScadenzaErr(
          "Questa voce va gestita nella pagina Progetto (Checklist), non dalla scheda cliente."
        );
        return;
      }
      setEditScadenzaOpen(false);
      showToast("✅ Voce eliminata", "success");
    } catch (err: any) {
      setEditScadenzaErr(briefError(err));
      showToast(`❌ Eliminazione fallita: ${briefError(err)}`, "error");
    } finally {
      setEditScadenzaSaving(false);
    }
  }

  function getRinnoviStageList(stage: "stage1" | "stage2", onlyWithin30Days = false) {
    let list =
      stage === "stage1"
        ? rinnoviAll.filter((r) => getWorkflowStato(r) === "DA_AVVISARE")
        : rinnoviAll.filter((r) => getWorkflowStato(r) === "DA_FATTURARE");
    // Tutti i tagliandi (INCLUSO, EXTRA, AUTORIZZATO_CLIENTE) possono passare a DA_FATTURARE/FATTURATO
    if (onlyWithin30Days) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter((r) => {
        const dt = parseLocalDay(r.scadenza);
        if (!dt) return false;
        const diff = Math.ceil((dt.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        return diff >= 0 && diff <= 30;
      });
    }
    return list;
  }

  function openRinnoviAlert(
    stage: "stage1" | "stage2",
    onlyWithin30Days = false,
    listOverride?: ScadenzaItem[] | RinnovoServizioRow[]
  ) {
    void loadRinnoviAlertRule(stage);
    void ensureAlertTemplatesLoaded();
    void loadAlertOperatori();
    const list = (listOverride
      ? (listOverride as any[]).map((r) =>
          "source" in r ? (r as ScadenzaItem) : toScadenzaItemFromRinnovo(r)
        )
      : getRinnoviStageList(stage, onlyWithin30Days)) as ScadenzaItem[];
    if (list.length === 0) {
      setRinnoviError(
        stage === "stage1" ? "Nessuna scadenza da avvisare." : "Nessun rinnovo da fatturare."
      );
      return;
    }
    setRinnoviAlertStage(stage);
    setRinnoviAlertIds(list.map((r) => r.id));
    setRinnoviAlertItems(list);
    const defaultSubject =
      stage === "stage1"
        ? `[Art Tech] Scadenze servizi – ${cliente || "—"}`
        : `[Art Tech] Da fatturare – ${cliente || "—"}`;
    setRinnoviAlertSubject(defaultSubject);
    setSelectedPresetId("");
    setRinnoviAlertMsg(
      list.length === 1 ? buildMsgScadenzaSingle(list[0], stage) : buildMsgScadenzaBulk(list, stage)
    );
    setRinnoviAlertErr(null);
    setRinnoviAlertOk(null);
    setRinnoviAlertOpen(true);
  }

  async function sendRinnoviAlert(payload: {
    toCliente: boolean;
    toArtTech: boolean;
    artTechMode: "operatore" | "email";
    operatoreId: string;
    manualEmail: string;
    manualName: string;
    clienteEmailOverride?: string;
    subject: string;
    message: string;
    sendEmail: boolean;
  }) {
    setRinnoviAlertSending(true);
    setRinnoviAlertErr(null);
    setRinnoviAlertOk(null);
    try {
      const manualCustomerEmail = String(payload.clienteEmailOverride || "").trim();
      const e2eHasValidRecipient =
        (payload.toArtTech &&
          (payload.artTechMode === "operatore"
            ? Boolean(payload.operatoreId)
            : payload.manualEmail.trim().includes("@"))) ||
        (payload.toCliente &&
          ((clienteAnagraficaEmails.length > 0 &&
            clienteAnagraficaEmails.some((email) => String(email || "").trim().includes("@"))) ||
            manualCustomerEmail.includes("@")));
      if (isE2EMode) {
        if (!e2eHasValidRecipient) {
          setRinnoviAlertErr("Email cliente mancante");
          return;
        }
        const list =
          rinnoviAlertItems.length > 0
            ? rinnoviAlertItems
            : (getRinnoviStageList(rinnoviAlertStage) as ScadenzaItem[]);
        if (list.length === 0) {
          setRinnoviAlertErr("Nessun elemento disponibile per l'invio.");
          return;
        }
        for (const r of list) {
          const mapped = mapRinnovoTipo(String(r.item_tipo || "").toUpperCase());
          if (mapped.item_tipo) {
            upsertMockRinnovoState(r.checklist_id, mapped.item_tipo, "AVVISATO");
          }
        }
        setRinnoviAlertOk("✅ E2E mock: invio avviso simulato.");
        setRinnoviNotice("✅ E2E mock: stato AVVISATO.");
        setTimeout(() => setRinnoviAlertOpen(false), 300);
        return;
      }

      const opId =
        currentOperatoreId ??
        (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
      if (!opId) {
        setRinnoviAlertErr("Seleziona l’Operatore corrente (in alto) prima di inviare un alert.");
        return;
      }
      if (!payload.toArtTech && !payload.toCliente) {
        setRinnoviAlertErr("Seleziona almeno un destinatario (Art Tech e/o cliente).");
        return;
      }
      if (payload.toArtTech && payload.artTechMode === "operatore" && !payload.operatoreId) {
        setRinnoviAlertErr("Seleziona un destinatario Art Tech.");
        return;
      }
      if (payload.toArtTech && payload.artTechMode === "email" && !payload.manualEmail.trim().includes("@")) {
        setRinnoviAlertErr("Inserisci un'email valida.");
        return;
      }
      let customerEmailsForSend = [...clienteAnagraficaEmails];
      if (payload.toCliente && customerEmailsForSend.length === 0) {
        if (!manualCustomerEmail.includes("@")) {
          setRinnoviAlertErr("Email cliente mancante");
          return;
        }
        const clienteId =
          clienteAnagraficaId ||
          (await ensureClienteAnagraficaRecord({
            email: manualCustomerEmail,
          }));
        const saveRes = await fetch("/api/clienti", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: clienteId,
            email: manualCustomerEmail,
          }),
        });
        const saveJson = await saveRes.json().catch(() => ({} as any));
        if (!saveRes.ok || !saveJson?.ok) {
          throw new Error(saveJson?.error || "Errore salvataggio email cliente");
        }
        const savedEmail = String(saveJson?.data?.email || manualCustomerEmail).trim();
        setClienteAnagraficaEmail(savedEmail);
        setClienteAnagraficaEmailDraft(savedEmail);
        customerEmailsForSend = savedEmail ? [savedEmail] : [manualCustomerEmail];
      }

      const list =
        rinnoviAlertItems.length > 0
          ? rinnoviAlertItems
          : (getRinnoviStageList(rinnoviAlertStage) as ScadenzaItem[]);
      if (list.length === 0) {
        setRinnoviAlertErr("Nessun elemento disponibile per l'invio.");
        return;
      }

      const recipients: Array<{ toEmail: string; toNome: string | null; toOperatoreId: string | null }> = [];
      if (payload.toArtTech && payload.artTechMode === "operatore" && payload.operatoreId) {
        const op = alertOperatori.find((o) => o.id === payload.operatoreId) || null;
        const email = String(op?.email || "").trim();
        if (!email.includes("@")) {
          setRinnoviAlertErr("Operatore selezionato senza email valida.");
          return;
        }
        recipients.push({
          toEmail: email,
          toNome: op?.nome ?? null,
          toOperatoreId: payload.operatoreId,
        });
      }
      if (payload.toArtTech && payload.artTechMode === "email" && payload.manualEmail.trim()) {
        recipients.push({
          toEmail: payload.manualEmail.trim(),
          toNome: payload.manualName.trim() || null,
          toOperatoreId: null,
        });
      }
      if (payload.toCliente) {
        for (const email of customerEmailsForSend) {
          recipients.push({
            toEmail: email,
            toNome: "Cliente",
            toOperatoreId: null,
          });
        }
      }
      const dedupMap = new Map<string, { toEmail: string; toNome: string | null; toOperatoreId: string | null }>();
      for (const recipient of recipients) {
        dedupMap.set(
          `${String(recipient.toOperatoreId || "")}::${String(recipient.toEmail || "").toLowerCase()}`,
          recipient
        );
      }
      const finalRecipients = Array.from(dedupMap.values()).filter((recipient) => recipient.toEmail.includes("@"));
      if (finalRecipients.length === 0) {
        setRinnoviAlertErr("Nessun destinatario valido selezionato.");
        return;
      }

      const subject =
        payload.subject ||
        (rinnoviAlertStage === "stage1"
          ? `[Art Tech] Scadenze servizi – ${cliente || "—"}`
          : `[Art Tech] Da fatturare – ${cliente || "—"}`);
      const message = (payload.message || "").trim() || payload.message || "";
      const html = `
        <div>
          <h2>${escapeHtml(subject)}</h2>
          <div>${textToHtml(message)}</div>
          <p style="font-size:12px;color:#6b7280">Messaggio manuale Art Tech.</p>
        </div>
      `;
      const byItemCanale = (item: ScadenzaItem) => {
        const src = String(item.source || "");
        const isTag = src === "tagliandi";
        const isLic = src === "licenze";
        if (rinnoviAlertStage === "stage1") {
          if (isTag) return "tagliando_stage1";
          if (isLic) return "licenza_stage1";
          return "rinnovo_stage1";
        }
        if (isTag) return "tagliando_stage2";
        if (isLic) return "licenza_stage2";
        return "rinnovo_stage2";
      };
      const normalizeTipo = (item: ScadenzaItem) => {
        if (item.source === "tagliandi") return "TAGLIANDO";
        if (item.source === "licenze") return "LICENZA";
        return String(item.item_tipo || "RINNOVO").toUpperCase();
      };
      const normalizeRiferimento = (item: ScadenzaItem) => {
        if (item.source === "tagliandi") return item.riferimento || "TAGLIANDO";
        if (item.source === "licenze") return item.riferimento || "LICENZA";
        return item.riferimento ?? null;
      };

      const updatedTagliandiIds: string[] = [];
      for (const recipient of finalRecipients) {
        for (let i = 0; i < list.length; i += 1) {
          const item = list[i];
          const res: any = await sendAlert({
            canale: byItemCanale(item),
            subject,
            message,
            text: message,
            html,
            to_email: recipient.toEmail || null,
            to_nome: recipient.toNome,
            to_operatore_id: recipient.toOperatoreId,
            destinatario: recipient.toNome || recipient.toEmail,
            from_operatore_id: opId,
            checklist_id: item.checklist_id ?? null,
            tagliando_id: item.source === "tagliandi" ? item.tagliando_id ?? item.id ?? null : null,
            tipo: normalizeTipo(item),
            riferimento: normalizeRiferimento(item),
            stato: getWorkflowStato(item),
            trigger: "MANUALE",
            send_email: i === 0 ? payload.sendEmail : false,
          });
          if (res?.updated?.id) updatedTagliandiIds.push(String(res.updated.id));
        }
      }
      if (updatedTagliandiIds.length > 0) {
        setTagliandi((prev) =>
          prev.map((row) =>
            updatedTagliandiIds.includes(row.id)
              ? {
                  ...row,
                  stato: "AVVISATO",
                  alert_last_sent_at: new Date().toISOString(),
                  alert_last_sent_by_operatore: opId ?? row.alert_last_sent_by_operatore,
                }
              : row
          )
        );
      }

      const nowIso = new Date().toISOString();
      const recipientOperatorId = payload.artTechMode === "operatore" ? payload.operatoreId : null;
      if (rinnoviAlertStage === "stage1") {
        const pairs = new Map<string, { checklistId: string; itemTipo: string }>();
        for (const row of list) {
          if (!row.checklist_id) continue;
          const tipoRaw = String(row.item_tipo || "").toUpperCase();
          const mapped = mapRinnovoTipo(tipoRaw);
          const itemTipo = String(mapped.item_tipo || "").toUpperCase();
          if (!itemTipo) continue;
          pairs.set(`${row.checklist_id}::${itemTipo}`, { checklistId: row.checklist_id, itemTipo });
        }
        const byTipo = new Map<string, string[]>();
        for (const { checklistId, itemTipo } of pairs.values()) {
          byTipo.set(itemTipo, Array.from(new Set([...(byTipo.get(itemTipo) || []), checklistId])));
        }
        for (const [itemTipo, checklistIds] of byTipo.entries()) {
          await dbFrom("rinnovi_servizi")
            .update({ stato: "AVVISATO", updated_at: nowIso })
            .eq("item_tipo", itemTipo)
            .in("checklist_id", checklistIds);
        }
        setRinnovi((prev) =>
          prev.map((row) => {
            const itemTipo = String(row.item_tipo || "").toUpperCase();
            const checklistIds = byTipo.get(itemTipo);
            if (!checklistIds || !checklistIds.includes(String(row.checklist_id || ""))) return row;
            return {
              ...row,
              stato: "AVVISATO",
              notify_stage1_sent_at: nowIso,
              notify_stage1_to_operatore_id: recipientOperatorId,
            };
          })
        );
      }

      const rinnoviIds = list.filter((row) => row.source === "rinnovi").map((row) => row.id);
      const licenzeIds = list.filter((row) => row.source === "licenze").map((row) => row.id);
      const workflowItems = list.filter((row) => ["saas", "saas_contratto", "garanzie"].includes(row.source));
      for (const row of workflowItems) {
        const rinnovo = await ensureRinnovoForItem(row);
        if (!rinnovo) continue;
        await updateRinnovo(
          rinnovo.id,
          rinnoviAlertStage === "stage1"
            ? {
                stato: "AVVISATO",
                notify_stage1_sent_at: nowIso,
                notify_stage1_to_operatore_id: recipientOperatorId,
              }
            : {
                billing_notified_at: nowIso,
                billing_stage2_sent_at: nowIso,
                billing_stage2_to_operatore_id: recipientOperatorId,
              }
        );
      }

      if (rinnoviAlertStage === "stage1") {
        if (rinnoviIds.length > 0) {
          await updateRinnovi(rinnoviIds, {
            stato: "AVVISATO",
            notify_stage1_sent_at: nowIso,
            notify_stage1_to_operatore_id: recipientOperatorId,
          });
        }
        if (licenzeIds.length > 0) {
          await Promise.allSettled(
            licenzeIds.map((licenseId) =>
              fetch("/api/licenses/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "SEND_ALERT",
                  licenseId,
                  status: "AVVISATO",
                  alertTo: finalRecipients[0]?.toOperatoreId ?? finalRecipients[0]?.toEmail ?? null,
                  alertNote: message,
                  updatedByOperatoreId: opId,
                }),
              })
            )
          );
        }
      } else {
        if (rinnoviIds.length > 0) {
          await updateRinnovi(rinnoviIds, {
            billing_notified_at: nowIso,
            billing_stage2_sent_at: nowIso,
            billing_stage2_to_operatore_id: recipientOperatorId,
          });
        }
        if (licenzeIds.length > 0) {
          await Promise.allSettled(
            licenzeIds.map((licenseId) =>
              fetch("/api/licenses/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "SEND_ALERT",
                  licenseId,
                  alertTo: finalRecipients[0]?.toOperatoreId ?? finalRecipients[0]?.toEmail ?? null,
                  alertNote: message,
                  updatedByOperatoreId: opId,
                }),
              })
            )
          );
        }
      }

      const recipientLabel = `Destinatari: ${finalRecipients.map((recipient) => recipient.toNome || recipient.toEmail).join(", ")}`;
      const esitoLabel = payload.sendEmail ? "✅ Email inviata" : "✅ Avviso registrato";
      showToast(esitoLabel, "success");
      setRinnoviNotice(`${esitoLabel} — ${recipientLabel}`);
      setRinnoviAlertOk(payload.sendEmail ? "✅ Email inviata e log registrato." : "✅ Log avviso registrato.");
      setTimeout(() => setRinnoviAlertOpen(false), 800);
      await fetchRinnovi((cliente || "").trim());
      await fetchTagliandi((cliente || "").trim());
    } finally {
      setRinnoviAlertSending(false);
    }
  }

  async function markRinnovoConfermato(r: RinnovoServizioRow) {
    const opId =
      currentOperatoreId ??
      (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
    if (!opId) {
      setRinnoviError("Seleziona l'Operatore corrente (in alto) prima di confermare.");
      return;
    }
    const nextScadenza = promptNextScadenza(r.scadenza ?? null, r.item_tipo);
    if (!nextScadenza) return;
    const ok = await updateRinnovo(r.id, {
      stato: "DA_FATTURARE",
      scadenza: nextScadenza,
      confirmed_at: new Date().toISOString(),
      confirmed_by_operatore_id: opId,
    });
    if (ok) {
      setRinnoviNotice("Riga aggiornata: DA_FATTURARE.");
      await fetchRinnovi((cliente || "").trim());
    }
  }

  async function markRinnovoDaFatturare(r: RinnovoServizioRow) {
    if (String(r.stato || "").toUpperCase() !== "CONFERMATO") {
      setRinnoviError("Puoi passare a DA_FATTURARE solo se il rinnovo è CONFERMATO.");
      return;
    }
    const payload: Record<string, any> = { stato: "DA_FATTURARE" };
    if ("billing_requested_at" in r) {
      payload.billing_requested_at = new Date().toISOString();
    }
    const ok = await updateRinnovo(r.id, payload);
    if (ok) {
      setRinnoviNotice("Riga aggiornata: DA_FATTURARE.");
      await fetchRinnovi((cliente || "").trim());
      openRinnoviAlert("stage2", false, [r]);
    }
  }

  async function markRinnovoNonRinnovato(r: RinnovoServizioRow) {
    const ok = await updateRinnovo(r.id, { stato: "NON_RINNOVATO" });
    if (ok) {
      setRinnoviNotice("Riga aggiornata: NON_RINNOVATO.");
      await fetchRinnovi((cliente || "").trim());
    }
  }

  async function markRinnovoFatturato(r: RinnovoServizioRow) {
    if ("numero_fattura" in r && !r.numero_fattura) {
      setRinnoviError("Numero fattura obbligatorio per segnare FATTURATO.");
      return;
    }
    const ok = await updateRinnovo(r.id, { stato: "FATTURATO" });
    if (ok) {
      setRinnoviNotice("Riga aggiornata: FATTURATO.");
      await fetchRinnovi((cliente || "").trim());
    }
  }

  async function updateTagliando(id: string, payload: Record<string, any>) {
    const rawId = stripPrefixId(id);
    if (!rawId) return false;
    const normalizedPayload = { ...payload };
    if (typeof normalizedPayload?.stato === "string") {
      normalizedPayload.stato = normalizeTagliandoStatoForDb(normalizedPayload.stato);
    }
    if (
      Object.prototype.hasOwnProperty.call(normalizedPayload, "modalita") &&
      normalizedPayload.modalita != null
    ) {
      const allowed = new Set(["INCLUSO", "EXTRA", "AUTORIZZATO_CLIENTE"]);
      const m = String(normalizedPayload.modalita || "")
        .trim()
        .toUpperCase();
      if (!allowed.has(m)) {
        setRinnoviError("Modalità tagliando non valida.");
        return false;
      }
      normalizedPayload.modalita = m;
    }

    let { error } = await dbFrom("tagliandi").update(normalizedPayload).eq("id", rawId);
    if (error && isTagliandoStatoCheckViolation(error) && typeof normalizedPayload?.stato === "string") {
      const retryPayload = {
        ...normalizedPayload,
        stato: normalizeTagliandoStatoForDb(normalizedPayload.stato),
      };
      const retry = await dbFrom("tagliandi").update(retryPayload).eq("id", rawId);
      error = retry.error;
    }
    if (error) {
      setRinnoviError("Errore aggiornamento tagliando: " + error.message);
      return false;
    }
    return true;
  }

  async function setTagliandoWorkflow(r: ScadenzaItem, stato: string) {
    const existing = await ensureRinnovoForItem(r);
    if (!existing) return false;
    const ok = await updateRinnovo(existing.id, { stato });
    if (ok) {
      await fetchRinnovi((cliente || "").trim());
    }
    return ok;
  }

  async function markTagliandoOk(r: ScadenzaItem) {
    const nextScadenza = promptNextScadenza(r.scadenza ?? null, "TAGLIANDO");
    if (!nextScadenza) return;
    const ok = await updateTagliando(r.id, { stato: "ATTIVA", scadenza: nextScadenza });
    if (ok) {
      setTagliandi((prev) =>
        prev.map((t) => (t.id === r.id ? { ...t, scadenza: nextScadenza, stato: "ATTIVA" } : t))
      );
      await setTagliandoWorkflow({ ...r, scadenza: nextScadenza }, "CONFERMATO");
      setRinnoviNotice("Tagliando confermato.");
      await fetchTagliandi((cliente || "").trim());
    }
  }

  async function markTagliandoDaFatturare(r: ScadenzaItem) {
    const ok = await setTagliandoWorkflow(r, "DA_FATTURARE");
    if (ok) {
      setRinnoviNotice("Tagliando segnato DA_FATTURARE.");
      await fetchTagliandi((cliente || "").trim());
    }
  }

  async function markTagliandoFatturato(r: ScadenzaItem) {
    const okTag = await updateTagliando(r.id, { stato: "FATTURATO" });
    if (!okTag) return;
    const ok = await setTagliandoWorkflow(r, "FATTURATO");
    if (ok) {
      setRinnoviNotice("Tagliando fatturato.");
      await fetchTagliandi((cliente || "").trim());
    }
  }

  async function markTagliandoNonRinnovato(r: ScadenzaItem) {
    const ok = await updateTagliando(r.id, { stato: "SCADUTO" });
    if (ok) {
      setRinnoviNotice("Tagliando segnato SCADUTO.");
      await fetchTagliandi((cliente || "").trim());
    }
  }

  async function setLicenzaStatusForScadenze(
    licenseId: string,
    status: "DA_AVVISARE" | "AVVISATO" | "CONFERMATO" | "NON_RINNOVATO" | "DA_FATTURARE" | "FATTURATO" | "ANNULLATO"
  ) {
    if (!currentOperatoreId) {
      setRinnoviError("Seleziona l’Operatore corrente (in alto) prima di aggiornare lo stato.");
      return false;
    }
    const res = await fetch("/api/licenses/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SET_STATUS",
        licenseId,
        status,
        updatedByOperatoreId: currentOperatoreId,
      }),
    });
    if (!res.ok) {
      let msg = "Errore aggiornamento licenza";
      try {
        const data = await res.json();
        msg = data?.error || msg;
      } catch {
        // ignore
      }
      setRinnoviError(msg);
      return false;
    }
    setLicenze((prev) =>
      prev.map((l) => (l.id === licenseId ? { ...l, status } : l))
    );
    return true;
  }

  async function markLicenzaConfermata(r: ScadenzaItem) {
    const nextScadenza = promptNextScadenza(r.scadenza ?? null, "LICENZA");
    if (!nextScadenza) return;
    const updated = await updateSourceScadenza(r, nextScadenza);
    if (!updated) return;
    const ok = await setLicenzaStatusForScadenze(r.id, "DA_FATTURARE");
    if (ok) {
      setLicenze((prev) =>
        prev.map((l) =>
          l.id === r.id ? { ...l, scadenza: nextScadenza, status: "DA_FATTURARE" } : l
        )
      );
      setRinnoviNotice("Licenza confermata: DA_FATTURARE.");
    }
  }

  async function markLicenzaDaFatturare(r: ScadenzaItem) {
    const ok = await setLicenzaStatusForScadenze(r.id, "DA_FATTURARE");
    if (ok) {
      setRinnoviNotice("Licenza segnata DA_FATTURARE.");
      openRinnoviAlert("stage2", false, [r]);
    }
  }

  async function markLicenzaFatturato(r: ScadenzaItem) {
    const ok = await setLicenzaStatusForScadenze(r.id, "FATTURATO");
    if (ok) setRinnoviNotice("Licenza fatturata.");
  }

  async function markLicenzaNonRinnovata(r: ScadenzaItem) {
    const ok = await setLicenzaStatusForScadenze(r.id, "NON_RINNOVATO");
    if (ok) setRinnoviNotice("Licenza segnata NON_RINNOVATA.");
  }

  function getFattureDaEmettereList() {
    return interventi.filter((i) => getEsitoFatturazione(i) === "DA_FATTURARE");
  }

  const ACTIONS_BY_TIPO: Record<
    string,
    { avviso: boolean; conferma: boolean; non_rinnovato: boolean; fattura: boolean }
  > = {
    LICENZA: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
    SIM: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
    TAGLIANDO: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
    SAAS: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
    GARANZIA: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
    SAAS_ULTRA: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
    RINNOVO: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
  };

  // Mappa configurabile: mesi di rinnovo di default per tipo
  const RENEWAL_DEFAULTS_MONTHS: Record<string, number> = {
    LICENZA: 12,
    SIM: 12,
    TAGLIANDO: 12,
    SAAS: 12,
    GARANZIA: 24,
    SAAS_ULTRA: 12,
    RINNOVO: 12,
  };

  function suggestNextScadenza(value?: string | null, tipo?: string | null) {
    const dt = parseLocalDay(value ?? null);
    if (!dt) return "";
    const months = RENEWAL_DEFAULTS_MONTHS[String(tipo || "").toUpperCase()] ?? 12;
    const next = new Date(dt);
    next.setMonth(next.getMonth() + months);
    return next.toISOString().slice(0, 10);
  }

  function promptNextScadenza(value?: string | null, tipo?: string | null) {
    if (typeof window === "undefined") return null;
    const months = RENEWAL_DEFAULTS_MONTHS[String(tipo || "").toUpperCase()] ?? 12;
    const suggested = suggestNextScadenza(value, tipo);
    const input = window.prompt(`Nuova scadenza (YYYY-MM-DD) — default +${months} mesi:`, suggested);
    if (!input) return null;
    const dt = parseLocalDay(input.trim());
    if (!dt) {
      setRinnoviError("Data scadenza non valida. Usa formato YYYY-MM-DD.");
      return null;
    }
    return dt.toISOString().slice(0, 10);
  }

  function mapRinnovoTipo(tipo: string) {
    const upper = String(tipo || "").toUpperCase();
    if (upper === "SIM") return { item_tipo: "SIM", subtipo: null };
    if (upper === "SAAS_ULTRA") return { item_tipo: "SAAS", subtipo: "ULTRA" };
    if (upper === "GARANZIA") return { item_tipo: "GARANZIA", subtipo: null };
    if (upper === "SAAS") return { item_tipo: "SAAS", subtipo: null };
    return { item_tipo: upper, subtipo: null };
  }

  function getRinnovoMatch(r: ScadenzaItem) {
    if (r.source === "rinnovi") {
      return rinnovi.find((x) => x.id === r.id) || null;
    }
    const tipo = String(r.item_tipo || "").toUpperCase();
    if (tipo === "SIM") {
      const simId = String(r.sim_id || "").trim();
      if (!simId) return null;
      return (
        rinnovi.find(
          (x) =>
            String(x.item_tipo || "").toUpperCase() === "SIM" &&
            String(x.sim_id || "").trim() === simId
        ) || null
      );
    }
    if (tipo === "SAAS_ULTRA") {
      return (
        rinnovi.find(
          (x) =>
            (String(x.item_tipo || "").toUpperCase() === "SAAS_ULTRA" ||
              (String(x.item_tipo || "").toUpperCase() === "SAAS" &&
                String(x.subtipo || "").toUpperCase() === "ULTRA")) &&
            String(x.checklist_id || "") === "" &&
            String(x.scadenza || "") === String(r.scadenza || "") &&
            String(x.cliente || "").trim() === String(cliente || "").trim()
        ) || null
      );
    }
    if (tipo === "GARANZIA") {
      return (
        rinnovi.find(
          (x) =>
            String(x.item_tipo || "").toUpperCase() === "GARANZIA" &&
            String(x.checklist_id || "") === String(r.checklist_id || "")
        ) || null
      );
    }
    if (tipo === "SAAS") {
      return (
        rinnovi.find(
          (x) =>
            String(x.item_tipo || "").toUpperCase() === "SAAS" &&
            !["ULTRA"].includes(String(x.subtipo || "").toUpperCase()) &&
            String(x.checklist_id || "") === String(r.checklist_id || "")
        ) || null
      );
    }
    if (!r.checklist_id) return null;
    return (
      rinnovi.find(
        (x) =>
          String(x.item_tipo || "").toUpperCase() === tipo &&
          String(x.checklist_id || "") === String(r.checklist_id || "")
      ) || null
    );
  }

  function getWorkflowStato(r: ScadenzaItem) {
    const tipo = String(r.item_tipo || "").toUpperCase();
    const raw = String(r.stato || "").toUpperCase();
    if (r.source === "tagliandi") {
      const match = getRinnovoMatch(r);
      if (match?.stato) return String(match.stato).toUpperCase();
      if (raw === "ATTIVA") return "DA_AVVISARE";
      if (raw === "OK") return "CONFERMATO";
    }
    if (tipo === "SAAS" || tipo === "GARANZIA" || tipo === "SAAS_ULTRA") {
      const match = getRinnovoMatch(r);
      return String(match?.stato || "DA_AVVISARE").toUpperCase();
    }
    if (tipo === "SIM") {
      const match = getRinnovoMatch(r);
      return String(match?.stato || "DA_AVVISARE").toUpperCase();
    }
    if (tipo === "LICENZA") {
      if (raw === "ATTIVA") return "DA_AVVISARE";
      if (raw === "OK") return "CONFERMATO";
    }
    return raw;
  }

  async function ensureRinnovoForItem(r: ScadenzaItem) {
    const existing = getRinnovoMatch(r);
    if (existing) return existing;
    const tipo = String(r.item_tipo || "").toUpperCase();
    const clienteKey = (cliente || "").trim();
    if (!clienteKey) return null;
    const mapped = mapRinnovoTipo(tipo);
    const payload: Record<string, any> = {
      cliente: clienteKey,
      item_tipo: mapped.item_tipo,
      checklist_id: r.checklist_id ?? null,
      scadenza: r.scadenza ?? null,
      stato: "DA_AVVISARE",
    };
    if (tipo === "SIM") {
      payload.sim_id = r.sim_id ?? null;
    }
    if (mapped.subtipo) payload.subtipo = mapped.subtipo;
    if (tipo === "SAAS_ULTRA") {
      payload.checklist_id = null;
    }
    const isGaranzia =
      String(mapped.item_tipo || "").toUpperCase() === "GARANZIA" && payload.checklist_id;
    let data: any = null;
    let error: any = null;
    if (isGaranzia) {
      const existing = await dbFrom("rinnovi_servizi")
        .select("*")
        .eq("checklist_id", String(payload.checklist_id))
        .eq("item_tipo", String(mapped.item_tipo || "").toUpperCase())
        .limit(1)
        .maybeSingle();
      if (existing.error) {
        error = existing.error;
      } else if (existing.data?.id) {
        const upd = await dbFrom("rinnovi_servizi")
          .update(payload)
          .eq("id", existing.data.id)
          .select("*")
          .single();
        data = upd.data;
        error = upd.error;
      } else {
        const ins = await dbFrom("rinnovi_servizi")
          .insert(payload)
          .select("*")
          .single();
        data = ins.data;
        error = ins.error;
      }
    } else {
      const ins = await dbFrom("rinnovi_servizi")
        .insert(payload)
        .select("*")
        .single();
      data = ins.data;
      error = ins.error;
    }
    if (error) {
      setRinnoviError("Errore creazione rinnovo: " + error.message);
      return null;
    }
    await fetchRinnovi(clienteKey);
    return (data || null) as RinnovoServizioRow | null;
  }

  async function updateSourceScadenza(r: ScadenzaItem, newDate: string) {
    if (r.source === "tagliandi") {
      const tagliandoId = stripPrefixId(r.id);
      if (!tagliandoId) return false;
      const { error } = await dbFrom("tagliandi")
        .update({ scadenza: newDate })
        .eq("id", tagliandoId);
      if (error) {
        setRinnoviError("Errore aggiornamento scadenza tagliando: " + error.message);
        return false;
      }
      return true;
    }
    if (r.source === "licenze") {
      const licenzaId = stripPrefixId(r.id);
      if (!licenzaId) return false;
      const { error } = await dbFrom("licenses").update({ scadenza: newDate }).eq("id", licenzaId);
      if (error) {
        setRinnoviError("Errore aggiornamento scadenza licenza: " + error.message);
        return false;
      }
      return true;
    }
    if (r.source === "saas") {
      if (!r.checklist_id) return false;
      const { error } = await dbFrom("checklists").update({ saas_scadenza: newDate }).eq("id", r.checklist_id);
      if (error) {
        setRinnoviError("Errore aggiornamento scadenza SAAS: " + error.message);
        return false;
      }
      setChecklists((prev) =>
        prev.map((c) => (c.id === r.checklist_id ? { ...c, saas_scadenza: newDate } : c))
      );
      return true;
    }
    if (r.source === "garanzie") {
      if (!r.checklist_id) return false;
      const { error } = await dbFrom("checklists")
        .update({ garanzia_scadenza: newDate })
        .eq("id", r.checklist_id);
      if (error) {
        setRinnoviError("Errore aggiornamento scadenza GARANZIA: " + error.message);
        return false;
      }
      setChecklists((prev) =>
        prev.map((c) => (c.id === r.checklist_id ? { ...c, garanzia_scadenza: newDate } : c))
      );
      return true;
    }
    if (r.source === "saas_contratto") {
      const contrattoId = r.contratto_id ?? String(r.id || "").replace("saas_contratto:", "");
      const { error } = await dbFrom("saas_contratti")
        .update({ scadenza: newDate })
        .eq("id", contrattoId);
      if (error) {
        setRinnoviError("Errore aggiornamento scadenza SAAS_ULTRA: " + error.message);
        return false;
      }
      setContrattiRows((prev) =>
        prev.map((c) => (String(c.id) === String(contrattoId) ? { ...c, scadenza: newDate } : c))
      );
      return true;
    }
    if (r.source === "rinnovi") {
      const rinnovoId = stripPrefixId(r.id);
      if (!rinnovoId) return false;
      const { error } = await dbFrom("rinnovi_servizi")
        .update({ scadenza: newDate })
        .eq("id", rinnovoId);
      if (error) {
        setRinnoviError("Errore aggiornamento scadenza rinnovo: " + error.message);
        return false;
      }
      return true;
    }
    return true;
  }

  async function markWorkflowConfermato(r: ScadenzaItem) {
    const nextScadenza = promptNextScadenza(r.scadenza ?? null, r.item_tipo);
    if (!nextScadenza) return;
    const row = await ensureRinnovoForItem(r);
    if (!row) return;
    const opId =
      currentOperatoreId ??
      (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
    const nowIso = new Date().toISOString();
    const ok = await updateRinnovo(row.id, {
      stato: "DA_FATTURARE",
      scadenza: nextScadenza,
      confirmed_at: nowIso,
      confirmed_by_operatore_id: opId,
    });
    if (ok) {
      // Optimistic update rinnovi state per aggiornare badge subito
      setRinnovi((prev) =>
        prev.map((x) =>
          x.id === row.id
            ? { ...x, stato: "DA_FATTURARE", scadenza: nextScadenza, confirmed_at: nowIso, confirmed_by_operatore_id: opId }
            : x
        )
      );
      await updateSourceScadenza(r, nextScadenza);
      setRinnoviNotice("Riga aggiornata: DA_FATTURARE.");
      await fetchRinnovi((cliente || "").trim());
    }
  }

  async function markWorkflowNonRinnovato(r: ScadenzaItem) {
    if (isE2EMode) {
      const mapped = mapRinnovoTipo(String(r.item_tipo || "").toUpperCase());
      if (mapped.item_tipo) {
        upsertMockRinnovoState(r.checklist_id, mapped.item_tipo, "NON_RINNOVATO");
      }
      setRinnoviNotice("Riga aggiornata: NON_RINNOVATO.");
      return;
    }
    const row = await ensureRinnovoForItem(r);
    if (!row) return;
    const ok = await updateRinnovo(row.id, { stato: "NON_RINNOVATO" });
    if (ok) {
      // Optimistic update rinnovi state per aggiornare badge subito
      setRinnovi((prev) =>
        prev.map((x) => (x.id === row.id ? { ...x, stato: "NON_RINNOVATO" } : x))
      );
      setRinnoviNotice("Riga aggiornata: NON_RINNOVATO.");
      await fetchRinnovi((cliente || "").trim());
    }
  }

  async function fetchLastBulkAlert() {
    const checklistIds = checklists.map((c) => c.id).filter(Boolean);
    const loadKey = checklistIdsKey(checklistIds);
    if (loadKey === lastBulkAlertLoadKeyRef.current) return;
    lastBulkAlertLoadKeyRef.current = loadKey;
    if (checklistIds.length === 0) {
      setBulkLastSentAt(null);
      setBulkLastToOperatoreId(null);
      setBulkLastMessage(null);
      return;
    }
    const { data, error } = await runSingleFlight(
      `checklist_alert_log.select.fatturazione_bulk:${loadKey}`,
      async () =>
        dbFrom("checklist_alert_log")
          .select("created_at, to_operatore_id, checklist_id, messaggio")
          .eq("canale", "fatturazione_bulk")
          .in("checklist_id", checklistIds)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
    );
    if (error) {
      console.error("Errore lettura ultimo alert bulk", error);
      return;
    }
    if (!data) {
      setBulkLastSentAt(null);
      setBulkLastToOperatoreId(null);
      setBulkLastMessage(null);
      return;
    }
    setBulkLastSentAt(data.created_at ?? null);
    setBulkLastToOperatoreId(data.to_operatore_id ?? null);
    setBulkLastMessage(data.messaggio ?? null);
  }

  function buildLicenseAlertMessage(l: LicenzaRow) {
    const checklist = l.checklist_id ? checklistById.get(l.checklist_id) : null;
    const name = checklist?.nome_checklist ?? l.checklist_id ?? "—";
    const scad = l.scadenza ? new Date(l.scadenza).toLocaleDateString() : "—";
    const tipo = l.tipo ?? "—";
    return [
      `ALERT LICENZA — Cliente: ${cliente || "—"}`,
      `PROGETTO: ${name}`,
      `Tipo: ${tipo}`,
      `Scadenza: ${scad}`,
      `Stato: ${(l.status || l.stato || "—").toString().toUpperCase()}`,
    ].join("\n");
  }

  function openLicenseAlertModal(l: LicenzaRow) {
    setLicenseAlertItem(l);
    setLicenseAlertDestMode("operatore");
    setLicenseAlertManualEmail("");
    setLicenseAlertManualName("");
    setLicenseAlertToOperatoreId(currentOperatoreId ?? "");
    setLicenseAlertMsg(buildLicenseAlertMessage(l));
    setLicenseAlertErr(null);
    setLicenseAlertOpen(true);
  }

  async function sendLicenseAlert() {
    if (!licenseAlertItem) return;
    setLicenseAlertSending(true);
    setLicenseAlertErr(null);
    if (!currentOperatoreId) {
      setLicenseAlertErr("Seleziona l’Operatore corrente (in alto) prima di inviare un alert.");
      setLicenseAlertSending(false);
      return;
    }
    if (licenseAlertDestMode === "operatore" && !licenseAlertToOperatoreId) {
      setLicenseAlertErr("Seleziona un destinatario.");
      setLicenseAlertSending(false);
      return;
    }
    if (licenseAlertDestMode === "email") {
      const mail = licenseAlertManualEmail.trim();
      if (!mail || !mail.includes("@")) {
        setLicenseAlertErr("Inserisci un'email valida.");
        setLicenseAlertSending(false);
        return;
      }
    }
    const toOperatore =
      licenseAlertDestMode === "operatore"
        ? alertOperatori.find((o) => o.id === licenseAlertToOperatoreId) || null
        : null;
    const toEmail =
      licenseAlertDestMode === "operatore"
        ? toOperatore?.email ?? ""
        : licenseAlertManualEmail.trim();
    const toNome =
      licenseAlertDestMode === "operatore"
        ? toOperatore?.nome ?? null
        : licenseAlertManualName.trim() || null;

    const message = (licenseAlertMsg || "").trim() || licenseAlertMsg || "";
    try {
      console.debug("send-alert payload (licenza)", {
        canale: "license_alert",
        subject: `[Art Tech] Alert licenza – ${cliente || "—"}`,
        message,
        to_email: toEmail || null,
      });
      await sendAlert({
        canale: "license_alert",
        subject: `[Art Tech] Alert licenza – ${cliente || "—"}`,
        message,
        html: `<div>${textToHtml(licenseAlertMsg || "")}</div>`,
        text: licenseAlertMsg,
        to_email: toEmail,
        to_nome: toNome,
        to_operatore_id: licenseAlertDestMode === "operatore" ? licenseAlertToOperatoreId : null,
        from_operatore_id: currentOperatoreId,
        cliente,
        checklist_id: licenseAlertItem.checklist_id ?? null,
        tipo: "LICENZA",
        trigger: "MANUALE",
        meta: { license_id: licenseAlertItem.id },
        send_email: licenseAlertSendEmail,
      });
    } catch (e: any) {
      console.error("Errore invio alert licenza", e);
      showToast(`❌ Invio fallito: ${briefError(e)}`, "error");
      setLicenseAlertSending(false);
      return;
    }

    await fetch("/api/licenses/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SEND_ALERT",
        licenseId: licenseAlertItem.id,
        alertTo:
          licenseAlertDestMode === "operatore"
            ? licenseAlertToOperatoreId
            : licenseAlertManualEmail.trim(),
        alertNote: licenseAlertMsg,
        updatedByOperatoreId: currentOperatoreId,
      }),
    });

    setLicenseAlertSending(false);
    showToast(licenseAlertSendEmail ? "✅ Email inviata" : "✅ Avviso registrato", "success");
    setTimeout(() => setLicenseAlertOpen(false), 800);
    setLicenseAlertSendEmail(true);
    setLicenzeNotice("Alert licenza inviato.");
    setLicenseAlertToOperatoreId("");
    setLicenseAlertManualEmail("");
    setLicenseAlertManualName("");
  }

  async function sendBulkFatturaAlert() {
    setBulkSending(true);
    setBulkErr(null);
    setBulkOk(null);
    const opId =
      currentOperatoreId ??
      (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
    if (!opId) {
      setBulkErr("Operatore corrente non trovato.");
      setBulkSending(false);
      return;
    }
    if (!bulkToOperatoreId) {
      setBulkErr("Seleziona un destinatario.");
      setBulkSending(false);
      return;
    }
    const list = getFattureDaEmettereList();
    console.log("BULK START", {
      opId,
      count: list.length,
      to: bulkToOperatoreId,
    });
    const checklistId = list.find((i) => i.checklist_id)?.checklist_id ?? null;
    if (!checklistId) {
      setBulkErr("PROGETTO non trovato per l'invio bulk.");
      setBulkSending(false);
      return;
    }
    const op = alertOperatori.find((o) => o.id === bulkToOperatoreId);
    const toEmail = op?.email ?? "";
    if (bulkSendEmail && !toEmail.includes("@")) {
      setBulkErr("Destinatario senza email valida.");
      setBulkSending(false);
      return;
    }
    const subject = `[Art Tech] Da fatturare – ${cliente || "—"}`;
    const html = `
      <div>
        <h2>${escapeHtml(subject)}</h2>
        <div>${textToHtml(bulkMsg || "")}</div>
        <p style="font-size:12px;color:#6b7280">Messaggio manuale Art Tech.</p>
      </div>
    `;
    const message = (bulkMsg || "").trim() || bulkMsg || "";
    try {
      console.debug("send-alert payload (bulk)", {
        canale: "fatturazione_bulk",
        subject,
        message,
        to_email: toEmail || null,
      });
      await sendAlert({
        canale: "fatturazione_bulk",
        subject,
        message,
        text: bulkMsg,
        html,
        to_email: toEmail || null,
        to_nome: op?.nome ?? null,
        to_operatore_id: bulkToOperatoreId,
        from_operatore_id: opId,
        checklist_id: checklistId,
        tipo: "GENERICO",
        trigger: "MANUALE",
        send_email: bulkSendEmail,
      });
    } catch (err) {
      console.error("Errore invio alert bulk", err);
      showToast(`❌ Invio fallito: ${briefError(err)}`, "error");
      setBulkSending(false);
      return;
    }
    const okCount = list.length;
    const toName =
      alertOperatori.find((o) => o.id === bulkToOperatoreId)?.nome ?? bulkToOperatoreId;
    const esito = bulkSendEmail ? "✅ Email inviata" : "✅ Avviso registrato";
    showToast(esito, "success");
    setBulkSending(false);
    setTimeout(() => setBulkOpen(false), 800);
    setBulkSendEmail(true);
    setInterventiInfo(
      `${esito} (${okCount} interventi, destinatario: ${toName}).`
    );
    await fetchLastBulkAlert();
  }

  async function reopenIntervento(interventoId: string) {
    if (!currentOperatoreId) {
      setInterventiError("Seleziona un operatore corrente prima di riaprire.");
      return;
    }
    const opId = currentOperatoreId;
    const op = alertOperatori.find((o) => o.id === currentOperatoreId);
    const role = op?.ruolo ?? null;
    if (!canReopenIntervento(role)) {
      setInterventiError("Solo SUPERVISORE o PM possono riaprire l'intervento.");
      return;
    }

    const payload = {
      stato_intervento: "APERTO",
      fatturazione_stato: null,
      chiuso_il: null,
      chiuso_da_operatore: null,
    };
    const { error: updErr } = await dbFrom("saas_interventi")
      .update(payload)
      .eq("id", interventoId);
    if (updErr) {
      setInterventiError("Errore riapertura intervento: " + updErr.message);
      return;
    }

    const intervento = interventi.find((x) => x.id === interventoId);
    const checklistId = intervento?.checklist?.id ?? intervento?.checklist_id ?? null;
    if (checklistId) {
      const nome = op?.nome ?? op?.id ?? "—";
      console.log("ALERT FATTURAZIONE opId=", opId);
      try {
      await sendAlert({
        canale: "manual",
        subject: "Intervento riaperto",
        message: `Intervento riaperto da ${nome}`,
        text: `Intervento riaperto da ${nome}`,
        html: `<div><strong>Intervento riaperto</strong><br/>${escapeHtml(
          `Intervento riaperto da ${nome}`
        )}</div>`,
          to_email: op?.email ?? null,
          to_nome: op?.nome ?? null,
          to_operatore_id: currentOperatoreId,
          from_operatore_id: opId,
          checklist_id: checklistId,
          intervento_id: interventoId,
          send_email: false,
        });
      } catch (err) {
        console.error("Errore log riapertura intervento", err);
      }
    }

    await loadInterventiForCliente(
      cliente,
      checklists.map((c) => c.id).filter(Boolean)
    );
  }

  async function sendInterventoAlert() {
    if (!alertInterventoId) return;
    setSending(true);
    setSendErr(null);
    setSendOk(null);
    const opId =
      currentOperatoreId ??
      (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
    if (!opId) {
      setSendErr("Seleziona l’Operatore corrente (in alto) prima di inviare un alert.");
      setSending(false);
      return;
    }
    if (!alertDestinatarioId) {
      setSendErr("Seleziona un destinatario per l'alert.");
      setSending(false);
      return;
    }
    const intervento = interventi.find((x) => x.id === alertInterventoId);
    const checklistId = intervento?.checklist_id ?? null;
    const msg = alertMessaggio.trim();
    const toOperatoreId = alertDestinatarioId;
    console.log("SEND ALERT", {
      checklistId,
      interventoId: alertInterventoId,
      toOperatoreId,
      msg,
    });
    const op = alertOperatori.find((o) => o.id === toOperatoreId);
    const toEmail = op?.email ?? "";
    if (alertSendEmail && !toEmail.includes("@")) {
      setSendErr("Destinatario senza email valida.");
      setSending(false);
      return;
    }
    const subject = `[Art Tech] Alert fatturazione – ${cliente || "—"}`;
    const dettagli = [
      `Cliente: ${cliente || "—"}`,
      intervento?.descrizione ? `Intervento: ${intervento.descrizione}` : "",
      intervento?.proforma ? `Proforma: ${intervento.proforma}` : "",
      intervento?.codice_magazzino ? `CodMag: ${intervento.codice_magazzino}` : "",
      msg ? `Messaggio: ${msg}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const html = `
      <div>
        <h2>${escapeHtml(subject)}</h2>
        <div>${textToHtml(dettagli)}</div>
        <p style="font-size:12px;color:#6b7280">Messaggio manuale Art Tech.</p>
      </div>
    `;
    const message = msg || dettagli;
    try {
      console.debug("send-alert payload (intervento)", {
        canale: "fatturazione_row",
        subject,
        message,
        to_email: toEmail || null,
      });
      await sendAlert({
        canale: "fatturazione_row",
        subject,
        message,
        text: dettagli,
        html,
        to_email: toEmail || null,
        to_nome: op?.nome ?? null,
        to_operatore_id: toOperatoreId,
        from_operatore_id: opId,
        checklist_id: checklistId,
        intervento_id: alertInterventoId,
        tipo: "GENERICO",
        trigger: "MANUALE",
        send_email: alertSendEmail,
      });
    } catch (err) {
      console.error("Errore invio alert intervento", err);
      showToast(`❌ Invio fallito: ${briefError(err)}`, "error");
      setSending(false);
      return;
    }
    const esito = alertSendEmail ? "✅ Email inviata" : "✅ Avviso registrato";
    showToast(esito, "success");
    setAlertNotice(esito);
    setAlertDestinatarioId("");
    setAlertMessaggio("");
    setAlertSendEmail(true);
    setSending(false);
    setTimeout(() => setAlertInterventoId(null), 800);

    if (intervento) {
      setLastAlertByIntervento((prev) => {
        const next = new Map(prev);
        const toNome = alertOperatori.find((o) => o.id === toOperatoreId)?.nome ?? null;
        next.set(intervento.id, {
          toOperatoreId,
          toNome,
          createdAt: new Date().toISOString(),
        });
        return next;
      });
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Caricamento…</div>;
  if (error) return <div style={{ padding: 20, color: "crimson" }}>{error}</div>;
  const clienteSimRows = clienteSims
    .slice()
    .sort((a, b) =>
      String(a.numero_telefono || "").localeCompare(String(b.numero_telefono || ""), "it")
    );
  const compactInterventiRows = [...interventi].sort((a, b) =>
    String(b.data_tassativa || b.data || b.created_at || "").localeCompare(
      String(a.data_tassativa || a.data || a.created_at || "")
    )
  );
  const compactRowStyle: CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "white",
    padding: "12px 14px",
    display: "grid",
    gap: 8,
  };
  const compactMetaRowStyle: CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    fontSize: 12,
    color: "#475569",
  };
  const detailsStyle: CSSProperties = {
    marginTop: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#f8fafc",
    padding: 12,
  };

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>SCHEDA CLIENTE</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>Cliente: {cliente}</h2>
      </div>
      <div
        style={{
          marginTop: 4,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "white",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 13 }}>Email cliente</strong>
        <input
          value={clienteAnagraficaEmailDraft}
          onChange={(e) => setClienteAnagraficaEmailDraft(e.target.value)}
          placeholder="Email principale cliente"
          style={{
            flex: "1 1 320px",
            minWidth: 240,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
          }}
        />
        <textarea
          value={clienteAnagraficaEmailSecondarieDraft}
          onChange={(e) => setClienteAnagraficaEmailSecondarieDraft(e.target.value)}
          placeholder="Email secondarie cliente (una per riga o separate da virgola)"
          rows={3}
          style={{
            flex: "1 1 320px",
            minWidth: 240,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
          }}
        />
        <button
          type="button"
          onClick={saveClienteEmail}
          disabled={clienteAnagraficaEmailSaving}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
            opacity: clienteAnagraficaEmailSaving ? 0.7 : 1,
          }}
        >
          {clienteAnagraficaEmailSaving ? "Salvataggio..." : "Salva"}
        </button>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Email principale e secondarie in anagrafica sono la source of truth per gli avvisi cliente di Scadenze e Rinnovi.
        </span>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Destinatari cliente correnti: {formatClienteEmailList(clienteAnagraficaEmail, clienteAnagraficaEmailSecondarie) || "nessuno"}
        </span>
      </div>
      <div
        style={{
          marginTop: 4,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "white",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 13 }}>Drive cliente</strong>
        {!clienteDriveEditing && clienteDriveUrl ? (
          <>
            <a
              href={clienteDriveUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "#1d4ed8",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                wordBreak: "break-all",
              }}
            >
              {clienteDriveUrl}
            </a>
            <button
              type="button"
              onClick={() => {
                setClienteDriveDraft(clienteDriveUrl);
                setClienteDriveEditing(true);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
            >
              Modifica
            </button>
          </>
        ) : (
          <>
            <input
              value={clienteDriveDraft}
              onChange={(e) => setClienteDriveDraft(e.target.value)}
              placeholder="Nessun link Drive"
              style={{
                flex: "1 1 420px",
                minWidth: 240,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
              }}
            />
            <button
              type="button"
              onClick={saveClienteDriveUrl}
              disabled={clienteDriveSaving}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                cursor: "pointer",
                opacity: clienteDriveSaving ? 0.7 : 1,
              }}
            >
              {clienteDriveSaving ? "Salvataggio..." : "Salva"}
            </button>
            {clienteDriveEditing && (
              <button
                type="button"
                onClick={() => {
                  setClienteDriveDraft(clienteDriveUrl || "");
                  setClienteDriveEditing(false);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Annulla
              </button>
            )}
          </>
        )}
      </div>
      <div
        style={{
          marginTop: 10,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "white",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 13 }}>Invio scadenze</strong>
        <select
          value={clienteScadenzeDeliveryMode}
          onChange={(e) =>
            setClienteScadenzeDeliveryMode(
              normalizeClienteScadenzeDeliveryMode(e.target.value)
            )
          }
          style={{
            minWidth: 280,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "white",
          }}
        >
          <option value="AUTO_CLIENTE">Automatico al cliente</option>
          <option value="MANUALE_INTERNO">Manuale interno (solo Art Tech)</option>
        </select>
        <button
          type="button"
          onClick={() => saveClienteScadenzeDeliveryMode(clienteScadenzeDeliveryMode)}
          disabled={clienteScadenzeDeliverySaving}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
            opacity: clienteScadenzeDeliverySaving ? 0.7 : 1,
          }}
        >
          {clienteScadenzeDeliverySaving ? "Salvataggio..." : "Salva"}
        </button>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Automatico al cliente = invii automatici consentiti verso il cliente. Manuale interno = solo gestione interna Art Tech.
        </span>
      </div>
      {clienteScadenzeDeliveryMode === "AUTO_CLIENTE" && clienteAnagraficaEmails.length === 0 ? (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #f59e0b",
            background: "#fffbeb",
            color: "#92400e",
            fontSize: 12,
          }}
        >
          Inserire email cliente in scheda cliente per attivare gli avvisi automatici.
        </div>
      ) : null}
      <div
        style={{
          marginTop: 6,
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid #eee",
          background: "white",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
        }}
      >
        <strong>Scadenze entro 30gg</strong>
        <span
          className="group"
          style={{ display: "inline-block", position: "relative" }}
        >
          <span
            title={rinnovi30ggBreakdown.tooltip}
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: rinnovi30ggCount > 0 ? "#fee2e2" : "#e5e7eb",
              color: rinnovi30ggCount > 0 ? "#991b1b" : "#374151",
              fontWeight: 700,
              display: "inline-block",
              whiteSpace: "nowrap",
            }}
          >
            {rinnovi30ggCount}
          </span>
          <div
            className="group-hover:block"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 9999,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "8px 10px",
              boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
              minWidth: 180,
              maxWidth: 280,
              fontSize: 12,
              color: "#111",
              display: "none",
              whiteSpace: "pre-wrap",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Dettaglio scadenze</div>
            {rinnovi30ggBreakdown.tooltipLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </span>
      </div>
      {process.env.NEXT_PUBLIC_DEBUG_BADGE === "1" && (
        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7, whiteSpace: "pre-wrap" }}>
          {`Badge debug:
from: ${rinnovi30ggBreakdown.from.toISOString()}
to: ${rinnovi30ggBreakdown.to.toISOString()}
totale righe: ${rinnovi30ggBreakdown.totalRows}
prime 5:
${rinnovi30ggBreakdown.debugSample
  .map((r) => `${r.tipo} — ${r.scadenza}`)
  .join("\n")}`}
        </div>
      )}

      {(contratto || showContrattoForm) && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>SAAS Cliente (ULTRA)</div>
            {contratto && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Attivo: {contratto.piano_codice ?? "—"}
              </div>
            )}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
            Condizioni SAAS ULTRA
          </div>

          {contrattoError && (
            <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{contrattoError}</div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              marginTop: 8,
            }}
          >
            <label>
              Piano ULTRA<br />
              <select
                value={contrattoForm.piano_codice}
                onChange={(e) => {
                  const next = e.target.value;
                  setContrattoForm((prev) => ({
                    ...prev,
                    piano_codice: next,
                  }));
                }}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="">—</option>
                {ultraPianoOptions.map((p) => (
                  <option key={p.codice} value={p.codice}>
                    {p.codice} — {p.nome ?? "—"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Scadenza<br />
              <input
                type="date"
                value={contrattoForm.scadenza}
                onChange={(e) => setContrattoForm({ ...contrattoForm, scadenza: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Illimitati<br />
              <select
                value={contrattoForm.illimitati ? "SI" : "NO"}
                onChange={(e) =>
                  setContrattoForm({ ...contrattoForm, illimitati: e.target.value === "SI" })
                }
                style={{ width: "100%", padding: 8 }}
              >
                <option value="NO">NO</option>
                <option value="SI">SI</option>
              </select>
            </label>

            <label>
              Interventi annui<br />
              <input
                value={contrattoForm.interventi_annui}
                onChange={(e) =>
                  setContrattoForm({ ...contrattoForm, interventi_annui: e.target.value })
                }
                disabled={contrattoForm.illimitati}
                style={{
                  width: "100%",
                  padding: 8,
                  background: contrattoForm.illimitati ? "#f0f0f0" : "white",
                }}
              />
            </label>
          </div>

          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={applyUltraToSelectedProjects}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setApplyUltraToSelectedProjects(checked);
                  if (checked) setApplyUltraToAllProjects(false);
                  if (!checked) setSelectedUltraProjectIds([]);
                }}
              />
              Applica ULTRA a progetti selezionati del cliente
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={applyUltraToAllProjects}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setApplyUltraToAllProjects(checked);
                  if (checked) {
                    setApplyUltraToSelectedProjects(false);
                    setSelectedUltraProjectIds([]);
                  }
                }}
              />
              Applica ULTRA a tutti i progetti del cliente
            </label>
          </div>

          {applyUltraToSelectedProjects && (
            <div
              style={{
                marginTop: 8,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 8,
                maxHeight: 120,
                overflowY: "auto",
                background: "white",
              }}
            >
              {checklists.map((c) => {
                const checked = selectedUltraProjectIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedUltraProjectIds((prev) => {
                          if (e.target.checked) return Array.from(new Set([...prev, c.id]));
                          return prev.filter((id) => id !== c.id);
                        });
                      }}
                    />
                    {c.nome_checklist || c.id}
                  </label>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={saveContratto}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                cursor: "pointer",
              }}
            >
              Aggiungi
            </button>
          </div>
        </div>
      )}

      {!contratto && !showContrattoForm && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowContrattoForm(true)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "white",
              cursor: "pointer",
            }}
          >
            Crea contratto ULTRA
          </button>
        </div>
      )}

      {false && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "white",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>SAAS a schermo</div>
          <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 140px 2fr",
                padding: "10px 12px",
                fontWeight: 800,
                background: "#fafafa",
                borderBottom: "1px solid #eee",
              }}
            >
              <div>PROGETTO</div>
              <div>Proforma</div>
              <div>SAAS piano</div>
              <div>Scadenza</div>
              <div>Stato</div>
              <div>Note</div>
            </div>
            {saasPerImpiantoRows.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 140px 2fr",
                  padding: "10px 12px",
                  borderBottom: "1px solid #f3f4f6",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <Link
                  href={`/checklists/${c.id}`}
                  style={{ textDecoration: "none", fontWeight: 700 }}
                >
                  {c.nome_checklist ?? "—"}
                </Link>
                <div>{c.proforma ?? "—"}</div>
                <div>{c.saas_piano ?? "—"}</div>
                <div>
                  {c.saas_scadenza ? new Date(c.saas_scadenza).toLocaleDateString() : "—"}
                </div>
                <div>{renderBadge(getExpiryStatus(c.saas_scadenza))}</div>
                <div>{c.saas_note ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {false && (
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Garanzie</h2>
          <label style={{ fontSize: 12, opacity: 0.8 }}>
            <input
              type="checkbox"
              checked={onlyExpiredWarranty}
              onChange={(e) => setOnlyExpiredWarranty(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Solo scadute
          </label>
        </div>
        {garanzieRows.length === 0 ? (
          <div style={{ opacity: 0.7, marginTop: 6 }}>Nessuna garanzia trovata</div>
        ) : (
          <div style={{ marginTop: 10, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                padding: "10px 12px",
                fontWeight: 800,
                background: "#fafafa",
                borderBottom: "1px solid #eee",
              }}
            >
              <div>PROGETTO</div>
              <div>Scadenza</div>
              <div>Stato</div>
            </div>
            {garanzieRows.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr",
                  padding: "10px 12px",
                  borderBottom: "1px solid #f3f4f6",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <div>{c.nome_checklist ?? "—"}</div>
                <div>{c.garanzia_scadenza ? new Date(c.garanzia_scadenza).toLocaleDateString() : "—"}</div>
                <div>{renderBadge(getExpiryStatus(c.garanzia_scadenza))}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {false && (
      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0 }}>Licenze</h2>
        {licenzeNotice && (
          <div style={{ color: "#166534", marginTop: 6 }}>{licenzeNotice}</div>
        )}
        {licenzeError && (
          <div style={{ color: "crimson", marginTop: 6 }}>{licenzeError}</div>
        )}
        {licenze.length === 0 ? (
          <div style={{ opacity: 0.7, marginTop: 6 }}>Nessuna licenza trovata</div>
        ) : (
          <>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              Totale: {licenze.length} — Prossima scadenza:{" "}
              {nextLicenzaScadenza
                ? new Date(String(nextLicenzaScadenza)).toLocaleDateString()
                : "—"}
            </div>
            <div
              style={{
                marginTop: 10,
                border: "1px solid #eee",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1.6fr 0.8fr 0.9fr 0.9fr 1fr 1fr 2fr 2fr 180px",
                  padding: "10px 12px",
                  fontWeight: 800,
                  background: "#fafafa",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div>PROGETTO</div>
                <div>Tipo</div>
                <div>Scadenza</div>
                <div>Stato</div>
                <div>Intestato a</div>
                <div>Fornitore</div>
                <div>Note</div>
                <div>Riferimento</div>
                <div>Azioni</div>
              </div>
              {licenze.map((l) => {
                const checklist = l.checklist_id
                  ? checklistById.get(l.checklist_id)
                  : null;
                const label = checklist?.nome_checklist ?? l.checklist_id ?? "—";
                return (
                  <div
                    key={l.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1.6fr 0.8fr 0.9fr 0.9fr 1fr 1fr 2fr 2fr 180px",
                      padding: "10px 12px",
                      borderBottom: "1px solid #f3f4f6",
                      alignItems: "center",
                      fontSize: 13,
                    }}
                  >
                    {l.checklist_id ? (
                      <Link
                        href={`/checklists/${l.checklist_id}`}
                        style={{ textDecoration: "none", fontWeight: 700 }}
                      >
                        {label}
                      </Link>
                    ) : (
                      <div>{label}</div>
                    )}
                    <div>{l.tipo ?? "—"}</div>
                    <div>
                      {l.scadenza ? new Date(l.scadenza).toLocaleDateString() : "—"}
                    </div>
                    <div>{renderBadge(getLicenseStatus(l))}</div>
                    <div>
                      {l.intestata_a === "ART_TECH"
                        ? "Art Tech"
                        : l.intestata_a ?? "—"}
                    </div>
                    <div>{l.fornitore ?? "—"}</div>
                    <div>{l.note ?? "—"}</div>
                    <div>
                      {[
                        l.intestata_a ? `Intestata: ${l.intestata_a}` : null,
                        l.ref_univoco,
                        l.telefono,
                        l.intestatario,
                        l.gestore,
                        l.fornitore,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {l.checklist_id ? (
                        <Link
                          href={`/checklists/${l.checklist_id}`}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #ddd",
                            background: "white",
                            cursor: "pointer",
                            fontSize: 12,
                            textDecoration: "none",
                            color: "inherit",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          Modifica
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #ddd",
                            background: "#f9fafb",
                            cursor: "not-allowed",
                            fontSize: 12,
                            opacity: 0.6,
                          }}
                        >
                          Modifica
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      )}

      {false && (
      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0 }}>Proforme</h2>
        {proforme.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Nessuna proforma trovata</div>
        ) : (
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {proforme.map(([p, count]) => {
              const doc = proformaDocsByProforma.get(p);
              const hasDoc = Boolean(doc);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    if (doc) openProformaDoc(doc);
                  }}
                  disabled={!hasDoc}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #eee",
                    borderRadius: 999,
                    background: "#fafafa",
                    fontSize: 13,
                    cursor: hasDoc ? "pointer" : "default",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: hasDoc ? 1 : 0.7,
                  }}
                  title={hasDoc ? "Apri proforma" : "File mancante"}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: hasDoc ? "#22c55e" : "#ef4444",
                      display: "inline-block",
                    }}
                  />
                  {p} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            marginBottom: 10,
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 10,
            background: "#fcfcfc",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Aggiungi tagliando periodico</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px,1.4fr) 140px 180px minmax(220px,1fr) auto",
              gap: 8,
              alignItems: "end",
            }}
          >
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Progetto</div>
              <select
                value={newTagliando.checklist_id}
                onChange={(e) =>
                  setNewTagliando((prev) => ({ ...prev, checklist_id: e.target.value }))
                }
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              >
                <option value="">— seleziona progetto —</option>
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_checklist || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Scadenza</div>
              <input
                type="date"
                value={newTagliando.scadenza}
                onChange={(e) =>
                  setNewTagliando((prev) => ({ ...prev, scadenza: e.target.value }))
                }
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Fatturazione</div>
              <select
                value={newTagliando.fatturazione}
                onChange={(e) =>
                  setNewTagliando((prev) => ({ ...prev, fatturazione: e.target.value }))
                }
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              >
                <option value="INCLUSO">INCLUSO</option>
                <option value="DA_FATTURARE">DA_FATTURARE</option>
                <option value="FATTURATO">FATTURATO</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Note</div>
              <input
                value={newTagliando.note}
                onChange={(e) =>
                  setNewTagliando((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Tagliando annuale / periodico"
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              />
            </div>
            <button
              type="button"
              onClick={addTagliandoPeriodico}
              disabled={tagliandoSaving}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                fontWeight: 700,
                cursor: tagliandoSaving ? "not-allowed" : "pointer",
                opacity: tagliandoSaving ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {tagliandoSaving ? "Salvataggio..." : "Aggiungi"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: 0.2 }}>
            Scadenze &amp; Rinnovi
          </h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href={`/avvisi?cliente=${encodeURIComponent(cliente || "")}`}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "white",
                cursor: "pointer",
                whiteSpace: "nowrap",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              Storico avvisi cliente
            </Link>
            <button
              type="button"
              onClick={() => openRinnoviAlert("stage1", true)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "white",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Invia avviso rapido
            </button>
          </div>
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={rinnoviFilterDaAvvisare}
              onChange={(e) => setRinnoviFilterDaAvvisare(e.target.checked)}
            />
            Solo da avvisare
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={rinnoviFilterScaduti}
              onChange={(e) => setRinnoviFilterScaduti(e.target.checked)}
            />
            Solo scaduti
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={rinnoviFilterDaFatturare}
              onChange={(e) => setRinnoviFilterDaFatturare(e.target.checked)}
            />
            Solo da fatturare
          </label>
        </div>

        <div
          style={{
            display: "none",
            marginTop: 10,
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 10,
            background: "#fcfcfc",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Aggiungi tagliando periodico</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px,1.4fr) 140px 180px minmax(220px,1fr) auto",
              gap: 8,
              alignItems: "end",
            }}
          >
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Progetto</div>
              <select
                value={newTagliando.checklist_id}
                onChange={(e) =>
                  setNewTagliando((prev) => ({ ...prev, checklist_id: e.target.value }))
                }
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              >
                <option value="">— seleziona progetto —</option>
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_checklist || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Scadenza</div>
              <input
                type="date"
                value={newTagliando.scadenza}
                onChange={(e) =>
                  setNewTagliando((prev) => ({ ...prev, scadenza: e.target.value }))
                }
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Fatturazione</div>
              <select
                value={newTagliando.fatturazione}
                onChange={(e) =>
                  setNewTagliando((prev) => ({ ...prev, fatturazione: e.target.value }))
                }
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              >
                <option value="INCLUSO">INCLUSO</option>
                <option value="DA_FATTURARE">DA_FATTURARE</option>
                <option value="FATTURATO">FATTURATO</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Note</div>
              <input
                value={newTagliando.note}
                onChange={(e) =>
                  setNewTagliando((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Tagliando annuale / periodico"
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              />
            </div>
            <button
              type="button"
              onClick={addTagliandoPeriodico}
              disabled={tagliandoSaving}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                fontWeight: 700,
                cursor: tagliandoSaving ? "not-allowed" : "pointer",
                opacity: tagliandoSaving ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {tagliandoSaving ? "Salvataggio..." : "Aggiungi"}
            </button>
          </div>
        </div>

        {filteredRinnovi.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.7 }}>Nessuna scadenza trovata</div>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {filteredRinnovi.map((row) => {
              const project = checklistById.get(String(row.checklist_id || ""));
              const workflowStato = getWorkflowStato(row);
              const scadenzaBadge =
                row.source === "licenze"
                  ? renderLicenseStatusBadge(row.stato, row.scadenza)
                  : row.source === "tagliandi"
                  ? renderTagliandoStatoBadge(row.stato)
                  : row.source === "sim"
                  ? renderBadge(String(row.stato || "—"))
                  : renderScadenzaBadge(row.scadenza);

              return (
                <div
                  key={row.id}
                  role={row.checklist_id ? "button" : undefined}
                  tabIndex={row.checklist_id ? 0 : undefined}
                  onClick={() => {
                    if (row.checklist_id) router.push(`/checklists/${row.checklist_id}`);
                  }}
                  onKeyDown={(e) => {
                    if (!row.checklist_id) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/checklists/${row.checklist_id}`);
                    }
                  }}
                  style={{
                    ...compactRowStyle,
                    cursor: row.checklist_id ? "pointer" : "default",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>
                        {formatRinnovoTipo(row.item_tipo) || "Scadenza"}
                      </div>
                      <div style={compactMetaRowStyle}>
                        <span>Rif: {row.riferimento || row.descrizione || "—"}</span>
                        <span>Progetto: {project?.nome_checklist || "—"}</span>
                        <span>Scadenza: {fmtDate(row.scadenza) || "—"}</span>
                      </div>
                    </div>
                    <div>{renderRinnovoStatoBadge(workflowStato)}</div>
                  </div>
                  <div style={compactMetaRowStyle}>
                    <span>{scadenzaBadge}</span>
                    {row.modalita ? <span>{renderModalitaBadge(row.modalita)}</span> : null}
                    {row.proforma ? <span>Proforma: {row.proforma}</span> : null}
                    {row.cod_magazzino ? <span>Magazzino: {row.cod_magazzino}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <details style={detailsStyle}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Gestione completa scadenze e rinnovi</summary>
          <div style={{ marginTop: 12 }}>
            <RenewalsBlock
              cliente={cliente}
              rows={filteredRinnovi}
              checklistById={checklistById}
              rinnoviError={rinnoviError}
              rinnoviNotice={rinnoviNotice}
              setRinnoviNotice={setRinnoviNotice}
              getWorkflowStato={getWorkflowStato}
              actionsByTipo={ACTIONS_BY_TIPO}
              alertStatsMap={alertStatsMap}
              getAlertKeyForRow={getAlertKeyForRow}
              renderScadenzaBadge={renderScadenzaBadge}
              renderTagliandoStatoBadge={renderTagliandoStatoBadge}
              renderAvvisatoBadge={renderAvvisatoBadge}
              renderRinnovoStatoBadge={renderRinnovoStatoBadge}
              renderModalitaBadge={renderModalitaBadge}
              onSendAlert={(r) => openRinnoviAlert("stage1", false, [r])}
              onSetDaFatturare={(r) =>
                r.source === "tagliandi"
                  ? markTagliandoDaFatturare(r)
                  : r.source === "licenze"
                  ? markLicenzaDaFatturare(r)
                  : markRinnovoDaFatturare(r as RinnovoServizioRow)
              }
              onSetFatturato={(r) =>
                r.source === "tagliandi"
                  ? markTagliandoFatturato(r)
                  : r.source === "licenze"
                  ? markLicenzaFatturato(r)
                  : markRinnovoFatturato(r as RinnovoServizioRow)
              }
              onSetConfermato={(r) =>
                r.source === "tagliandi"
                  ? markTagliandoOk(r)
                  : r.source === "licenze"
                  ? markLicenzaConfermata(r)
                  : markWorkflowConfermato(r)
              }
              onSetNonRinnovato={(r) =>
                r.source === "licenze"
                  ? markLicenzaNonRinnovata(r)
                  : r.source === "tagliandi"
                  ? markTagliandoNonRinnovato(r)
                  : markWorkflowNonRinnovato(r)
              }
              onEdit={openEditScadenza}
              editOpen={editScadenzaOpen}
              editForm={editScadenzaForm}
              setEditOpen={setEditScadenzaOpen}
              setEditForm={setEditScadenzaForm}
              saveEdit={saveEditScadenza}
              deleteEdit={deleteScadenzaItemFromEdit}
              editSaving={editScadenzaSaving}
              editError={editScadenzaErr}
              licenzaStati={LICENZA_STATI}
              tagliandoStati={TAGLIANDO_STATI}
              tagliandoModalita={TAGLIANDO_MODALITA}
              rinnovoStati={RINNOVO_STATI}
            />
          </div>
        </details>
      </div>

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 14,
            background: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 800 }}>Export</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>CSV cliente</div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12 }}>
              Da<br />
              <input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                style={{ padding: 6 }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              A<br />
              <input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                style={{ padding: 6 }}
              />
            </label>
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "stretch",
            }}
          >
            <button
              type="button"
              onClick={exportInterventiCsv}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "white",
                cursor: "pointer",
                flex: "1 1 220px",
              }}
            >
              ⬇️ Export Interventi
            </button>
            <button
              type="button"
              onClick={exportRinnoviCsv}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "white",
                cursor: "pointer",
                flex: "1 1 220px",
              }}
            >
              ⬇️ Export Scadenze &amp; Rinnovi
            </button>
            <button
              type="button"
              onClick={exportFatturazioneCsv}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "white",
                cursor: "pointer",
                flex: "1 1 220px",
              }}
            >
              ⬇️ Export Fatturazione
            </button>
            <button
              type="button"
              onClick={exportLogAvvisiCsv}
              disabled={exportLogSending}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #111",
                background: exportLogSending ? "#e5e7eb" : "white",
                cursor: exportLogSending ? "default" : "pointer",
                flex: "1 1 220px",
              }}
            >
              {exportLogSending ? "Export in corso..." : "⬇️ Export Log Avvisi"}
            </button>
          </div>
          <label style={{ marginTop: 8, fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={exportFattInterventiFirst}
              onChange={(e) => setExportFattInterventiFirst(e.target.checked)}
            />
            Metti “Interventi” prima di “Rinnovi” nel CSV Fatturazione
          </label>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Esporta CSV per il cliente: {cliente}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
            Periodo: {exportFrom || "TUTTO"} → {exportTo || "TUTTO"}
          </div>
          {exportNotice && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#166534" }}>{exportNotice}</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0 }}>ATTIVITÀ</h2>
        {compactInterventiRows.length === 0 ? (
          <div style={{ opacity: 0.7, marginTop: 6 }}>Nessuna attività presente</div>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {compactInterventiRows.map((row) => {
              const targetProjectId = String(row.checklist_id || "");
              const project = checklistById.get(targetProjectId);
              const lifecycleStatus = getInterventoLifecycleStatus(row);
              const esitoFatturazione =
                getCanonicalInterventoEsitoFatturazione(row) ||
                row.fatturazione_stato ||
                row.esito_fatturazione;

              return (
                <div
                  key={row.id}
                  role={targetProjectId ? "button" : undefined}
                  tabIndex={targetProjectId ? 0 : undefined}
                  onClick={() => {
                    if (targetProjectId) router.push(`/checklists/${targetProjectId}`);
                  }}
                  onKeyDown={(e) => {
                    if (!targetProjectId) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/checklists/${targetProjectId}`);
                    }
                  }}
                  style={{
                    ...compactRowStyle,
                    cursor: targetProjectId ? "pointer" : "default",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{row.descrizione || "Intervento"}</div>
                      <div style={compactMetaRowStyle}>
                        <span>Progetto: {project?.nome_checklist || "—"}</span>
                        <span>Data: {fmtDate(row.data_tassativa || row.data) || "—"}</span>
                        <span>Ticket: {row.ticket_no || "—"}</span>
                      </div>
                    </div>
                    <div>{renderStatoInterventoBadge(lifecycleStatus)}</div>
                  </div>
                  <div style={compactMetaRowStyle}>
                    <span>{renderInterventoBadge(row.incluso ? "INCLUSO" : "EXTRA")}</span>
                    <span>{renderFatturazioneBadge(String(esitoFatturazione || "—"))}</span>
                    <span>Stato: {row.stato_intervento || lifecycleStatus}</span>
                    {row.proforma ? <span>Proforma: {row.proforma}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <details style={detailsStyle}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Gestione completa attività</summary>
          <div style={{ marginTop: 12 }}>
            <InterventiBlock
              checklists={checklists}
              interventi={interventi}
              interventiInfo={interventiInfo}
              interventiError={interventiError}
              alertNotice={alertNotice}
              setInterventiNotice={setInterventiInfo}
              includedUsed={interventiInclusiUsati}
              includedTotal={contratto ? interventiTotali : null}
              includedResidual={contratto ? interventiResidui : null}
              includedSummaryOverride={!contratto ? " / Totale inclusi: —" : null}
              attachmentCounts={new Map(
                Array.from(interventoFilesById.entries()).map(([id, files]) => [id, files.length])
              )}
              getOperatoreNome={getOperatoreNome}
              currentOperatoreRole={alertOperatori.find((o) => o.id === currentOperatoreId)?.ruolo ?? null}
              newIntervento={{
                data: newIntervento.data,
                dataTassativa: newIntervento.dataTassativa,
                descrizione: newIntervento.tipo,
                ticketNo: newIntervento.ticketNo,
                incluso: newIntervento.incluso,
                checklistId: newIntervento.checklistId,
                proforma: newIntervento.proforma,
                codiceMagazzino: newIntervento.codiceMagazzino,
                fatturazioneStato: newIntervento.fatturazioneStato,
                statoIntervento: newIntervento.statoIntervento,
                esitoFatturazione: "",
                numeroFattura: newIntervento.numeroFattura,
                fatturatoIl: newIntervento.fatturatoIl,
                note: newIntervento.note,
                noteTecniche: "",
                dataInizio: newIntervento.dataInizio,
                durataGiorni: newIntervento.durataGiorni,
                modalitaAttivita: newIntervento.modalitaAttivita,
                personalePrevisto: newIntervento.personalePrevisto,
                personaleIds: newIntervento.personaleIds,
                mezzi: newIntervento.mezzi,
                descrizioneAttivita: newIntervento.descrizioneAttivita,
                indirizzo: newIntervento.indirizzo,
                orario: newIntervento.orario,
                referenteClienteNome: newIntervento.referenteClienteNome,
                referenteClienteContatto: newIntervento.referenteClienteContatto,
                commercialeArtTechNome: newIntervento.commercialeArtTechNome,
                commercialeArtTechContatto: newIntervento.commercialeArtTechContatto,
              }}
              setNewIntervento={(value) => {
                setNewIntervento({
                  data: value.data,
                  dataTassativa: value.dataTassativa,
                  tipo: value.descrizione,
                  ticketNo: value.ticketNo,
                  incluso: value.incluso,
                  note: value.note,
                  checklistId: value.checklistId,
                  proforma: value.proforma,
                  codiceMagazzino: value.codiceMagazzino,
                  fatturazioneStato: value.fatturazioneStato,
                  numeroFattura: value.numeroFattura,
                  fatturatoIl: value.fatturatoIl,
                  statoIntervento: value.statoIntervento,
                  dataInizio: value.dataInizio,
                  durataGiorni: value.durataGiorni,
                  modalitaAttivita: value.modalitaAttivita,
                  personalePrevisto: value.personalePrevisto,
                  personaleIds: value.personaleIds,
                  mezzi: value.mezzi,
                  descrizioneAttivita: value.descrizioneAttivita,
                  indirizzo: value.indirizzo,
                  orario: value.orario,
                  referenteClienteNome: value.referenteClienteNome,
                  referenteClienteContatto: value.referenteClienteContatto,
                  commercialeArtTechNome: value.commercialeArtTechNome,
                  commercialeArtTechContatto: value.commercialeArtTechContatto,
                });
              }}
              newInterventoFiles={newInterventoFiles}
              setNewInterventoFiles={setNewInterventoFiles}
              newInterventoLinks={newInterventoLinks}
              setNewInterventoLinks={setNewInterventoLinks}
              addIntervento={addIntervento}
              editInterventoId={editInterventoId}
              setEditInterventoId={setEditInterventoId}
              editIntervento={{
                ...editIntervento,
                checklistId: "",
              }}
              setEditIntervento={(value) =>
                setEditIntervento({
                  data: value.data,
                  dataTassativa: value.dataTassativa,
                  descrizione: value.descrizione,
                  ticketNo: value.ticketNo,
                  incluso: value.incluso,
                  proforma: value.proforma,
                  codiceMagazzino: value.codiceMagazzino,
                  fatturazioneStato: value.fatturazioneStato,
                  statoIntervento: value.statoIntervento,
                  esitoFatturazione: value.esitoFatturazione,
                  numeroFattura: value.numeroFattura,
                  fatturatoIl: value.fatturatoIl,
                  note: value.note,
                  noteTecniche: value.noteTecniche,
                  dataInizio: value.dataInizio,
                  durataGiorni: value.durataGiorni,
                  modalitaAttivita: value.modalitaAttivita,
                  personalePrevisto: value.personalePrevisto,
                  personaleIds: value.personaleIds,
                  mezzi: value.mezzi,
                  descrizioneAttivita: value.descrizioneAttivita,
                  indirizzo: value.indirizzo,
                  orario: value.orario,
                  referenteClienteNome: value.referenteClienteNome,
                  referenteClienteContatto: value.referenteClienteContatto,
                  commercialeArtTechNome: value.commercialeArtTechNome,
                  commercialeArtTechContatto: value.commercialeArtTechContatto,
                })
              }
              startEditIntervento={startEditIntervento}
              saveEditIntervento={saveEditIntervento}
              expandedInterventoId={expandedInterventoId}
              setExpandedInterventoId={setExpandedInterventoId}
              deleteIntervento={deleteIntervento}
              closeInterventoId={closeInterventoId}
              setCloseInterventoId={setCloseInterventoId}
              closeEsito={closeEsito}
              setCloseEsito={setCloseEsito}
              closeNote={closeNote}
              setCloseNote={setCloseNote}
              closeError={closeError}
              setCloseError={setCloseError}
              confirmCloseIntervento={confirmCloseIntervento}
              alertInterventoId={alertInterventoId}
              setAlertInterventoId={setAlertInterventoId}
              alertDestinatarioId={alertDestinatarioId}
              setAlertDestinatarioId={setAlertDestinatarioId}
              alertMessaggio={alertMessaggio}
              setAlertMessaggio={setAlertMessaggio}
              alertSendEmail={alertSendEmail}
              setAlertSendEmail={setAlertSendEmail}
              sending={sending}
              sendErr={sendErr}
              sendOk={sendOk}
              sendInterventoAlert={sendInterventoAlert}
              openAlertModal={openInterventoAlertModal}
              getAlertRecipients={getAlertRecipients}
              bulkOpen={bulkOpen}
              setBulkOpen={setBulkOpen}
              bulkToOperatoreId={bulkToOperatoreId}
              setBulkToOperatoreId={setBulkToOperatoreId}
              bulkMsg={bulkMsg}
              setBulkMsg={setBulkMsg}
              bulkSendEmail={bulkSendEmail}
              setBulkSendEmail={setBulkSendEmail}
              bulkSending={bulkSending}
              bulkErr={bulkErr}
              bulkOk={bulkOk}
              sendBulkFatturaAlert={sendBulkFatturaAlert}
              getFatturaAlertRecipients={getFatturaAlertRecipients}
              bulkLastSentAt={bulkLastSentAt}
              bulkLastToOperatoreId={bulkLastToOperatoreId}
              bulkLastMessage={bulkLastMessage}
              bulkPreviewOpen={bulkPreviewOpen}
              setBulkPreviewOpen={setBulkPreviewOpen}
              openBulkAlertModal={openBulkInterventoAlertModal}
              reopenIntervento={reopenIntervento}
            />
          </div>
        </details>
      </div>

      {licenseAlertOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setLicenseAlertOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Invia alert licenza</div>
              <button
                type="button"
                onClick={() => setLicenseAlertOpen(false)}
                style={{
                  marginLeft: "auto",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                Chiudi
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 10, fontSize: 12 }}>
                <Link href="/impostazioni/operatori" style={{ color: "#2563eb", textDecoration: "underline" }}>
                  ⚙ Regole invio automatico
                </Link>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Destinatario</div>
              <div style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 8 }}>
                <label>
                  <input
                    type="radio"
                    checked={licenseAlertDestMode === "operatore"}
                    onChange={() => setLicenseAlertDestMode("operatore")}
                    style={{ marginRight: 6 }}
                  />
                  Operatore
                </label>
                <label>
                  <input
                    type="radio"
                    checked={licenseAlertDestMode === "email"}
                    onChange={() => setLicenseAlertDestMode("email")}
                    style={{ marginRight: 6 }}
                  />
                  Email manuale
                </label>
              </div>
              {licenseAlertDestMode === "operatore" ? (
                <select
                  value={licenseAlertToOperatoreId}
                  onChange={(e) => setLicenseAlertToOperatoreId(e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">—</option>
                  {getAlertRecipients().map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nome ?? "—"}
                      {op.ruolo ? ` — ${op.ruolo}` : ""}
                      {op.email ? ` — ${op.email}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    placeholder="Email"
                    value={licenseAlertManualEmail}
                    onChange={(e) => setLicenseAlertManualEmail(e.target.value)}
                    style={{ width: "100%", padding: 8 }}
                  />
                  <input
                    placeholder="Nome (opzionale)"
                    value={licenseAlertManualName}
                    onChange={(e) => setLicenseAlertManualName(e.target.value)}
                    style={{ width: "100%", padding: 8 }}
                  />
                </div>
              )}
            </div>

            <label style={{ display: "block", marginTop: 10 }}>
              Messaggio<br />
              <textarea
                value={licenseAlertMsg}
                onChange={(e) => setLicenseAlertMsg(e.target.value)}
                rows={6}
                style={{ width: "100%", padding: 8, marginTop: 6 }}
              />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={licenseAlertSendEmail}
                onChange={(e) => setLicenseAlertSendEmail(e.target.checked)}
              />
              Invia email
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setLicenseAlertOpen(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={sendLicenseAlert}
                disabled={
                  licenseAlertSending ||
                  (licenseAlertDestMode === "operatore"
                    ? !licenseAlertToOperatoreId
                    : !licenseAlertManualEmail.trim())
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  opacity:
                    licenseAlertSending ||
                    (licenseAlertDestMode === "operatore"
                      ? !licenseAlertToOperatoreId
                      : !licenseAlertManualEmail.trim())
                      ? 0.6
                      : 1,
                }}
              >
                {licenseAlertSending ? "Invio..." : "Invia"}
              </button>
            </div>
            {licenseAlertErr && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
                {licenseAlertErr}
              </div>
            )}
          </div>
        </div>
      )}

      {bulkOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setBulkOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Invia alert fatture</div>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                style={{
                  marginLeft: "auto",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                Chiudi
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 10, fontSize: 12 }}>
                <Link href="/impostazioni/operatori" style={{ color: "#2563eb", textDecoration: "underline" }}>
                  ⚙ Regole invio automatico
                </Link>
              </div>
              <label style={{ display: "block", marginBottom: 10 }}>
                Destinatario<br />
                <select
                  value={bulkToOperatoreId}
                  onChange={(e) => setBulkToOperatoreId(e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">—</option>
                  {getFatturaAlertRecipients().map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nome ?? "—"}
                      {op.ruolo ? ` — ${op.ruolo}` : ""}
                      {op.email ? ` — ${op.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {getFatturaAlertRecipients().length === 0 && (
                <div style={{ marginTop: -6, marginBottom: 10, fontSize: 12, color: "#b91c1c" }}>
                  Nessun operatore attivo disponibile
                </div>
              )}
              <label style={{ display: "block", marginBottom: 10 }}>
                Messaggio<br />
                <textarea
                  value={bulkMsg}
                  onChange={(e) => setBulkMsg(e.target.value)}
                  rows={8}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={bulkSendEmail}
                  onChange={(e) => setBulkSendEmail(e.target.checked)}
                />
                Invia email
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={sendBulkFatturaAlert}
                disabled={bulkSending || !bulkToOperatoreId}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  opacity: bulkSending || !bulkToOperatoreId ? 0.6 : 1,
                }}
              >
                {bulkSending ? "Invio..." : "Invia"}
              </button>
            </div>
            {bulkErr && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
                {bulkErr}
              </div>
            )}
            {bulkOk && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#166534" }}>
                {bulkOk}
              </div>
            )}
          </div>
        </div>
      )}

      {bulkPreviewOpen && bulkLastMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setBulkPreviewOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Recap ultimo alert bulk</div>
              <button
                type="button"
                onClick={() => setBulkPreviewOpen(false)}
                style={{
                  marginLeft: "auto",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                Chiudi
              </button>
            </div>
            <textarea
              readOnly
              value={bulkLastMessage}
              rows={12}
              style={{ width: "100%", marginTop: 10, padding: 10, fontSize: 12 }}
            />
          </div>
        </div>
      )}

      <RenewalsAlertModal
        open={rinnoviAlertOpen}
        cliente={cliente || ""}
        contextTipo={rinnoviAlertItems[0]?.item_tipo || null}
        stage={rinnoviAlertStage}
        title={rinnoviAlertStage === "stage1" ? "Invia avviso scadenza" : "Invia alert fatturazione rinnovi"}
        customerEmail={clienteAnagraficaEmail}
        customerEmails={clienteAnagraficaEmails}
        customerDeliveryMode={clienteScadenzeDeliveryMode}
        operators={getAlertRecipients()}
        defaultOperatorId={
          rinnoviAlertStage === "stage1"
            ? getDefaultOperatoreIdByRole("SUPERVISORE")
            : getDefaultOperatoreIdByRole("AMMINISTRAZIONE")
        }
        initialSubject={rinnoviAlertSubject}
        initialMessage={rinnoviAlertMsg}
        rule={rinnoviAlertRule}
        loadingRule={rinnoviAlertRuleLoading}
        manualSending={rinnoviAlertSending}
        ruleSaving={rinnoviAlertRuleSaving}
        error={rinnoviAlertErr}
        success={rinnoviAlertOk}
        onClose={() => setRinnoviAlertOpen(false)}
        onSubmitManual={sendRinnoviAlert}
        onSaveRule={saveRinnoviAlertRule}
      />

      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0 }}>PROGETTO del cliente</h2>
        {checklists.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Nessun PROGETTO trovato</div>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {checklists.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/checklists/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/checklists/${c.id}`);
                  }
                }}
                style={{
                  ...compactRowStyle,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{c.nome_checklist ?? "—"}</div>
                    <div style={compactMetaRowStyle}>
                      <span>Proforma: {c.proforma ?? "—"}</span>
                      <span>PO: {c.po ?? "—"}</span>
                      <span>
                        Data chiave:{" "}
                        {c.data_tassativa
                          ? new Date(c.data_tassativa).toLocaleDateString()
                          : c.data_prevista
                          ? new Date(c.data_prevista).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                  <div>{renderBadge(getEffectiveProjectStatus({ stato_progetto: c.stato_progetto }) ?? "—")}</div>
                </div>
                <div style={compactMetaRowStyle}>
                  <span>Impianto: {c.tipo_impianto ?? "—"}</span>
                  <span>Dimensioni: {c.dimensioni ?? "—"}</span>
                  <span>
                    m2:{" "}
                    {calcM2(c.dimensioni, c.numero_facce) != null
                      ? calcM2(c.dimensioni, c.numero_facce)!.toFixed(2)
                      : "—"}
                  </span>
                  <span>Passo: {c.passo ?? "—"}</span>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <OperativeNotesPanel
                    compact
                    title="Note operative"
                    authReady={authReady}
                    items={[
                      {
                        rowKind: "INSTALLAZIONE",
                        rowRefId: c.id,
                        label: "Installazione",
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0 }}>SIM cliente</h2>
        {!authReady ? <div style={{ opacity: 0.7, marginTop: 6 }}>Caricamento SIM cliente...</div> : null}
        {clienteSimsError && <div style={{ color: "crimson", marginTop: 6 }}>{clienteSimsError}</div>}
        {!authReady ? null : clienteSimRows.length === 0 ? (
          <div style={{ opacity: 0.7, marginTop: 6 }}>Nessuna SIM associata ai progetti del cliente</div>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {clienteSimRows.map((row) => {
                const latestRecharge = getLatestClienteSimRechargeRow(
                  clienteSimRechargesById[row.id] || []
                );
                const effectiveScadenza = getClienteSimEffectiveScadenza(row, latestRecharge);
                const simState = getClienteSimOperationalState(row, latestRecharge);
                const project = checklistById.get(String(row.checklist_id || ""));

                return (
                  <div
                    key={row.id}
                    role={row.checklist_id ? "button" : undefined}
                    tabIndex={row.checklist_id ? 0 : undefined}
                    onClick={() => {
                      if (row.checklist_id) router.push(`/checklists/${row.checklist_id}`);
                    }}
                    onKeyDown={(e) => {
                      if (!row.checklist_id) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/checklists/${row.checklist_id}`);
                      }
                    }}
                    style={{
                      ...compactRowStyle,
                      cursor: row.checklist_id ? "pointer" : "default",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{row.numero_telefono || "—"}</div>
                      <div>{renderClienteSimStateBadge(simState)}</div>
                    </div>
                    <div style={compactMetaRowStyle}>
                      <span>Progetto: {project?.nome_checklist || "—"}</span>
                      <span>Operatore: {row.operatore || "—"}</span>
                      <span>Piano: {row.piano_attivo || "—"}</span>
                      <span>Scadenza: {fmtDate(effectiveScadenza) || "—"}</span>
                    </div>
                    <div style={compactMetaRowStyle}>
                      <span>Device: {row.device_installato || "—"}</span>
                      <span>Ultima ricarica: {fmtDate(latestRecharge?.data_ricarica) || "—"}</span>
                      <span>Importo: {formatCurrency(latestRecharge?.importo)}</span>
                      <span>{renderRechargeBillingBadge(latestRecharge?.billing_status)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
