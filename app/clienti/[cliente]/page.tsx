"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfigMancante from "@/components/ConfigMancante";
import Toast from "@/components/Toast";
import { calcM2FromDimensioni } from "@/lib/parseDimensioni";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
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
  const upper = String(label || "").toUpperCase();
  let bg = "#e5e7eb";
  let color = "#374151";
  if (upper === "DA_FATTURARE") {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (upper === "INCLUSO_DA_CONSUNTIVO") {
    bg = "#dbeafe";
    color = "#1d4ed8";
  } else if (upper === "FATTURATO") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (upper === "NON_FATTURARE") {
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
      {upper === "INCLUSO_DA_CONSUNTIVO" ? "A CONSUNTIVO" : upper || "—"}
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

function formatInvoiceStatus(label?: string | null) {
  const upper = String(label || "").toUpperCase();
  if (upper === "DA_FATTURARE") return "Da fatturare";
  if (upper === "FATTURATO") return "Fatturato";
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
    return { task_template_ids: [], all_task_status_change: false };
  }
  if (Array.isArray(input)) {
    return {
      task_template_ids: input.filter(Boolean).map(String),
      all_task_status_change: false,
    };
  }
  if (typeof input === "object") {
    const ids = Array.isArray(input.task_template_ids)
      ? input.task_template_ids.filter(Boolean).map(String)
      : [];
    const all = Boolean(input.all_task_status_change);
    return { task_template_ids: ids, all_task_status_change: all };
  }
  return { task_template_ids: [], all_task_status_change: false };
}

function getInterventoStato(i: InterventoRow): "APERTO" | "CHIUSO" {
  const raw = String(i.stato_intervento || "").toUpperCase();
  if (raw === "APERTO" || raw === "CHIUSO") return raw;
  if (i.fatturazione_stato) return "CHIUSO";
  return "APERTO";
}

function getEsitoFatturazione(i: InterventoRow): string | null {
  const raw = String(i.esito_fatturazione || "").toUpperCase();
  if (raw === "DA_FATTURARE" || raw === "NON_FATTURARE" || raw === "INCLUSO_DA_CONSUNTIVO") {
    return raw;
  }
  const fallback = String(i.fatturazione_stato || "").toUpperCase();
  if (fallback === "DA_FATTURARE" || fallback === "NON_FATTURARE") return fallback;
  if (fallback === "INCLUSO_DA_CONSUNTIVO") return fallback;
  return null;
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

type InterventoRow = {
  id: string;
  cliente: string;
  checklist_id: string | null;
  contratto_id: string | null;
  ticket_no: string | null;
  data: string;
  data_tassativa: string | null;
  descrizione: string;
  incluso: boolean;
  proforma: string | null;
  codice_magazzino: string | null;
  fatturazione_stato: string | null;
  stato_intervento: string | null;
  esito_fatturazione: string | null;
  chiuso_il: string | null;
  chiuso_da_operatore: string | null;
  alert_fattura_last_sent_at: string | null;
  alert_fattura_last_sent_by: string | null;
  numero_fattura: string | null;
  fatturato_il: string | null;
  note: string | null;
  note_tecniche: string | null;
  created_at: string;
  checklist?: {
    id: string;
    nome_checklist: string | null;
    proforma: string | null;
    magazzino_importazione: string | null;
  } | null;
};

type RinnovoServizioRow = {
  id: string;
  cliente?: string | null;
  item_tipo?: string | null;
  subtipo?: string | null;
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
  source: "rinnovi" | "tagliandi" | "licenze" | "saas" | "garanzie" | "saas_contratto";
  tagliando_id?: string | null;
  contratto_id?: string | null;
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
  tipo: "LICENZA" | "TAGLIANDO" | "SAAS" | "GARANZIA" | "RINNOVO" | "SAAS_ULTRA";
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
  } | null;
};

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

export default function ClientePage({ params }: { params: any }) {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }
  const router = useRouter();
  const isE2EMode = process.env.NEXT_PUBLIC_E2E === "1";
  const [cliente, setCliente] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
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
  const [rinnoviAlertManualEmail, setRinnoviAlertManualEmail] = useState("");
  const [rinnoviAlertManualName, setRinnoviAlertManualName] = useState("");
  const [rinnoviAlertSending, setRinnoviAlertSending] = useState(false);
  const [rinnoviAlertErr, setRinnoviAlertErr] = useState<string | null>(null);
  const [rinnoviAlertOk, setRinnoviAlertOk] = useState<string | null>(null);
  const [rinnoviNotice, setRinnoviNotice] = useState<string | null>(null);
  const [editScadenzaOpen, setEditScadenzaOpen] = useState(false);
  const [editScadenzaItem, setEditScadenzaItem] = useState<ScadenzaItem | null>(null);
  const [editScadenzaForm, setEditScadenzaForm] = useState<EditScadenzaForm | null>(
    null
  );
  const [editScadenzaSaving, setEditScadenzaSaving] = useState(false);
  const [editScadenzaErr, setEditScadenzaErr] = useState<string | null>(null);
  const [alertTemplates, setAlertTemplates] = useState<AlertMessageTemplate[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [tagliandi, setTagliandi] = useState<TagliandoRow[]>([]);
  const [newTagliando, setNewTagliando] = useState({
    checklist_id: "",
    scadenza: "",
    fatturazione: "INCLUSO",
    note: "",
  });
  const [tagliandoSaving, setTagliandoSaving] = useState(false);
  const [newServizioScadenza, setNewServizioScadenza] = useState({
    checklist_id: "",
    tipo: "SAAS",
    riferimento: "",
    scadenza: "",
    stato: "DA_AVVISARE",
    note: "",
  });
  const [servizioSaving, setServizioSaving] = useState(false);
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

  useEffect(() => {
    if (newServizioScadenza.tipo !== "SAAS_ULTRA") {
      setApplyUltraToAllProjects(false);
      setApplyUltraToSelectedProjects(false);
      setSelectedUltraProjectIds([]);
    }
  }, [newServizioScadenza.tipo]);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefillInterventoRef = useRef(false);
  const autoFatturazioneSent = useRef<Set<string>>(new Set());
  const autoFatturazioneInFlight = useRef(false);
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
  });

  function showToast(message: string, variant: "success" | "error" = "success", duration = 2500) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, variant });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
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
    if (tipo === "TAGLIANDO" || tipo === "LICENZA") {
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
    let alive = true;
    (async () => {
      const resolved = await Promise.resolve(params);
      const raw = (resolved?.cliente as string) || "";
      const decoded = decodeURIComponent(raw);
      if (!alive) return;

      setCliente(decoded);
      setLoading(true);
      setError(null);

      const clienteKey = decoded.trim();
      const { data: cls, error: clsErr } = await supabase
        .from("checklists")
        .select(
          "id, cliente, nome_checklist, proforma, magazzino_importazione, dimensioni, numero_facce, passo, tipo_impianto, data_prevista, data_tassativa, data_installazione_reale, stato_progetto, saas_piano, saas_tipo, saas_scadenza, saas_note, ultra_interventi_illimitati, ultra_interventi_inclusi, garanzia_scadenza, created_at"
        )
        .ilike("cliente", `%${clienteKey}%`)
        .order("created_at", { ascending: false });

      if (clsErr) {
        setError("Errore caricamento PROGETTI: " + clsErr.message);
        setLoading(false);
        return;
      }

      const list = (cls || []) as ChecklistRow[];
      setChecklists(list);
      const checklistIds = list.map((c) => c.id).filter(Boolean);
      if (checklistIds.length > 0) {
        const { data: docsData, error: docsErr } = await supabase
          .from("checklist_documents")
          .select("checklist_id, tipo, filename, storage_path, uploaded_at")
          .in("checklist_id", checklistIds)
          .order("uploaded_at", { ascending: false });
        if (!docsErr) {
          const byChecklist = new Map<string, string>();
          for (const c of list) {
            if (c.id) {
              const p = (c.proforma || "").trim();
              if (p) byChecklist.set(c.id, p);
            }
          }
          const map = new Map<string, { filename: string; storage_path: string }>();
          for (const d of (docsData || []) as any[]) {
            const tipo = String(d.tipo || "").toUpperCase();
            if (tipo !== "PROFORMA" && tipo !== "FATTURA_PROFORMA") continue;
            const p = d.checklist_id ? byChecklist.get(d.checklist_id) : null;
            if (!p) continue;
            if (!map.has(p) && d.storage_path) {
              map.set(p, {
                filename: d.filename || "proforma",
                storage_path: d.storage_path,
              });
            }
          }
          setProformaDocsByProforma(map);
        }
      }
      if (checklistIds.length === 0) {
        setLicenze([]);
        setLicenzeError(null);
      } else {
        const { data: licData, error: licErr } = await supabase
          .from("licenses")
          .select(
            "id, checklist_id, tipo, scadenza, stato, status, note, intestata_a, ref_univoco, telefono, intestatario, gestore, fornitore, alert_sent_at, alert_to, alert_note, updated_by_operatore"
          )
          .in("checklist_id", checklistIds)
          .order("scadenza", { ascending: true });
        if (licErr) {
          setLicenzeError("Errore caricamento licenze: " + licErr.message);
          setLicenze([]);
        } else {
          setLicenze((licData || []) as LicenzaRow[]);
          setLicenzeError(null);
        }
      }
      await fetchRinnovi(clienteKey);
      await fetchTagliandi(clienteKey);

      await fetchSaasContratti(clienteKey);

      const { data: pianiData, error: pianiErr } = await supabase
        .from("saas_piani")
        .select("codice, nome, interventi_inclusi")
        .ilike("codice", "SAAS-UL%")
        .order("codice", { ascending: true });

      if (!pianiErr) {
        setUltraPiani((pianiData || []) as PianoUltraRow[]);
      }

      const { data: opsData } = await supabase
        .from("operatori")
        .select("id, user_id, nome, ruolo, email, attivo, alert_enabled, alert_tasks")
        .order("ruolo", { ascending: true })
        .order("nome", { ascending: true });
      if (opsData) {
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
        if (mapped.length <= 1) {
          console.log("ALERT OPERATORI", mapped.length, mapped);
        }
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [params]);

  useEffect(() => {
    fetchLastBulkAlert();
  }, [checklists]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null;
    if (stored) setCurrentOperatoreId(stored);
  }, []);

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

  async function loadInterventiForCliente(clienteKey: string) {
    const cleanCliente = String(clienteKey || "").trim();
    if (!cleanCliente) {
      setInterventi([]);
      setInterventoFilesById(new Map());
      return;
    }

    let ints: any[] | null = null;
    let intsErr: any = null;
    {
      const res = await supabase
        .from("saas_interventi")
        .select(
          "id, cliente, checklist_id, contratto_id, ticket_no, data, data_tassativa, descrizione, incluso, proforma, codice_magazzino, fatturazione_stato, stato_intervento, esito_fatturazione, chiuso_il, chiuso_da_operatore, alert_fattura_last_sent_at, alert_fattura_last_sent_by, numero_fattura, fatturato_il, note, note_tecniche, created_at, checklist:checklists(id, nome_checklist, proforma, magazzino_importazione)"
        )
        .ilike("cliente", cleanCliente)
        .order("data", { ascending: false });
      ints = res.data;
      intsErr = res.error;
    }
    if (intsErr && String(intsErr.message || "").toLowerCase().includes("data_tassativa")) {
      const res = await supabase
        .from("saas_interventi")
        .select(
          "id, cliente, checklist_id, contratto_id, ticket_no, data, descrizione, incluso, proforma, codice_magazzino, fatturazione_stato, stato_intervento, esito_fatturazione, chiuso_il, chiuso_da_operatore, alert_fattura_last_sent_at, alert_fattura_last_sent_by, numero_fattura, fatturato_il, note, note_tecniche, created_at, checklist:checklists(id, nome_checklist, proforma, magazzino_importazione)"
        )
        .ilike("cliente", cleanCliente)
        .order("data", { ascending: false });
      ints = (res.data || []).map((x: any) => ({ ...x, data_tassativa: null }));
      intsErr = res.error;
    }
    if (intsErr && String(intsErr.message || "").toLowerCase().includes("ticket_no")) {
      const res = await supabase
        .from("saas_interventi")
        .select(
          "id, cliente, checklist_id, contratto_id, data, data_tassativa, descrizione, incluso, proforma, codice_magazzino, fatturazione_stato, stato_intervento, esito_fatturazione, chiuso_il, chiuso_da_operatore, alert_fattura_last_sent_at, alert_fattura_last_sent_by, numero_fattura, fatturato_il, note, note_tecniche, created_at, checklist:checklists(id, nome_checklist, proforma, magazzino_importazione)"
        )
        .ilike("cliente", cleanCliente)
        .order("data", { ascending: false });
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

    const { data: filesData, error: filesErr } = await supabase
      .from("saas_interventi_files")
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

    const { data: alertsData, error: alertsErr } = await supabase
      .from("checklist_alert_log")
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
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadInterventiForCliente(cliente);
      if (!alive) return;
    })();

    return () => {
      alive = false;
    };
  }, [contratto?.id, cliente]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("alert_message_templates")
        .select("id,codice,titolo,tipo,trigger,subject_template,body_template,attivo")
        .eq("attivo", true)
        .eq("trigger", "MANUALE")
        .order("titolo", { ascending: true });
      if (!alive) return;
      if (error) {
        console.error("Errore caricamento template avvisi", error);
        return;
      }
      setAlertTemplates((data || []) as AlertMessageTemplate[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
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
          (ruolo === "AMMINISTRAZIONE" || o.alert_tasks?.all_task_status_change)
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

        const { data: existing, error: existingErr } = await supabase
          .from("checklist_alert_log")
          .select("intervento_id, created_at")
          .in(
            "intervento_id",
            eligible.map((i) => i.id)
          )
          .eq("canale", "fatturazione_auto")
          .gte("created_at", todayIso);

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
        const { error: insErr } = await supabase
          .from("checklist_alert_log")
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
  }, [alertOperatori, cliente, interventi]);

  function startEditIntervento(i: InterventoRow) {
    setEditInterventoId(i.id);
    setEditIntervento({
      data: i.data ? String(i.data).slice(0, 10) : "",
      dataTassativa: i.data_tassativa ? String(i.data_tassativa).slice(0, 10) : "",
      descrizione: i.descrizione ?? "",
      ticketNo: i.ticket_no ?? "",
      incluso: Boolean(i.incluso),
      proforma: i.proforma ?? i.checklist?.proforma ?? "",
      codiceMagazzino: i.codice_magazzino ?? i.checklist?.magazzino_importazione ?? "",
      fatturazioneStato: i.fatturazione_stato ?? "DA_FATTURARE",
      statoIntervento: getInterventoStato(i),
      esitoFatturazione: getEsitoFatturazione(i) ?? "",
      numeroFattura: i.numero_fattura ?? "",
      fatturatoIl: i.fatturato_il ? i.fatturato_il.slice(0, 10) : "",
      note: i.note ?? "",
      noteTecniche: i.note_tecniche ?? "",
    });
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
      fatturazione_stato: editIntervento.fatturazioneStato,
      stato_intervento: editIntervento.statoIntervento,
      esito_fatturazione:
        editIntervento.statoIntervento === "CHIUSO" && editIntervento.esitoFatturazione
          ? editIntervento.esitoFatturazione
          : null,
      numero_fattura: editIntervento.numeroFattura.trim()
        ? editIntervento.numeroFattura.trim()
        : null,
      fatturato_il:
        editIntervento.fatturazioneStato === "FATTURATO"
          ? editIntervento.fatturatoIl || new Date().toISOString().slice(0, 10)
          : null,
      note: editIntervento.note.trim() ? editIntervento.note.trim() : null,
    };

    let { error: updErr } = await supabase
      .from("saas_interventi")
      .update(payload)
      .eq("id", editInterventoId);
    if (updErr && String(updErr.message || "").toLowerCase().includes("ticket_no")) {
      const { ticket_no, ...legacyPayload } = payload as any;
      const retry = await supabase
        .from("saas_interventi")
        .update(legacyPayload)
        .eq("id", editInterventoId);
      updErr = retry.error;
    }
    if (updErr && String(updErr.message || "").toLowerCase().includes("data_tassativa")) {
      const { data_tassativa, ...legacyPayload } = payload as any;
      const retry = await supabase
        .from("saas_interventi")
        .update(legacyPayload)
        .eq("id", editInterventoId);
      updErr = retry.error;
    }

    if (updErr) {
      setInterventiError("Errore aggiornamento intervento: " + updErr.message);
      return;
    }

    await loadInterventiForCliente(cliente);
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
      const { error: upErr } = await supabase.storage
        .from("checklist-documents")
        .upload(path, file, { upsert: false });
      if (upErr) {
        setInterventiError("Errore upload file intervento: " + upErr.message);
        return;
      }
      const { error: insErr } = await supabase.from("saas_interventi_files").insert({
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
      const { data: filesData, error: filesErr } = await supabase
        .from("saas_interventi_files")
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
      const { error: upErr } = await supabase.storage
        .from("checklist-documents")
        .upload(path, file, { upsert: false });
      if (upErr) {
        setInterventiError("Errore upload file intervento: " + upErr.message);
        return;
      }
      const { error: insErr } = await supabase.from("saas_interventi_files").insert({
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
      const { data: filesData, error: filesErr } = await supabase
        .from("saas_interventi_files")
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

  async function openInterventoFile(file: InterventoFile) {
    const { data, error: urlErr } = await supabase.storage
      .from("checklist-documents")
      .createSignedUrl(file.storage_path, 60 * 5);
    if (urlErr || !data?.signedUrl) {
      setInterventiError("Errore apertura file: " + (urlErr?.message || "URL non disponibile"));
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function openProformaDoc(doc: { filename: string; storage_path: string }) {
    const { data, error: urlErr } = await supabase.storage
      .from("checklist-documents")
      .createSignedUrl(doc.storage_path, 60 * 5);
    if (urlErr || !data?.signedUrl) {
      setInterventiError("Errore apertura proforma: " + (urlErr?.message || "URL non disponibile"));
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteInterventoFile(file: InterventoFile) {
    const ok = window.confirm("Eliminare questo file?");
    if (!ok) return;
    const { error: storErr } = await supabase.storage
      .from("checklist-documents")
      .remove([file.storage_path]);
    if (storErr) {
      setInterventiError("Errore eliminazione file: " + storErr.message);
      return;
    }
    const { error: delErr } = await supabase
      .from("saas_interventi_files")
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
    const rinnoviMapped = rinnovi.map((r) => ({
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
    const licenzeMapped = licenze.map((l) => ({
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
      stato: l.status ?? (l.scadenza ? "DA_AVVISARE" : null),
      modalita: null,
    }));
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
      ...saasMapped,
      ...contrattiMapped,
      ...garanzieMapped,
    ].sort(
      (a, b) => String(a.scadenza || "").localeCompare(String(b.scadenza || ""))
    );
  }, [rinnovi, tagliandi, licenze, saasPerImpiantoRows, contrattiRows, garanzieRows]);

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
      const checklistIds = Array.from(
        new Set(rinnoviAll.map((r) => r.checklist_id).filter(Boolean))
      ) as string[];
      if (checklistIds.length === 0) {
        if (alive) setAlertStatsMap(new Map());
        return;
      }
      const { data, error } = await supabase
        .from("checklist_alert_log")
        .select("checklist_id, tipo, riferimento, to_operatore_id, to_email, created_at")
        .in("checklist_id", checklistIds);
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
  }, [rinnoviAll, alertOperatori]);

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
        let q = supabase
          .from("checklist_alert_log")
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
      out.set(checklistId, entry.unlimited ? null : entry.total);
    }
    return out;
  }, [checklists, rinnovi, ultraPiani]);

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
        const { data, error: urlErr } = await supabase.storage
          .from("checklist-documents")
          .createSignedUrl(f.storage_path, 60 * 10);
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
    if (!key) return [];
    const { data: contrattiData, error: contrattiErr } = await supabase
      .from("saas_contratti")
      .select("id, cliente, piano_codice, scadenza, interventi_annui, illimitati, created_at")
      .ilike("cliente", `%${key}%`)
      .order("created_at", { ascending: false });

    if (contrattiErr) {
      setContrattoError("Errore caricamento contratto: " + contrattiErr.message);
      setContratto(null);
      setContrattiRows([]);
      return [];
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
      const { data, error: updErr } = await supabase
        .from("saas_contratti")
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
      const { data, error: insErr } = await supabase
        .from("saas_contratti")
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
        scadenza: savedContratto.scadenza ?? null,
        stato: "ATTIVA",
        descrizione: "ULTRA",
      };

      const { data: existing, error: findErr } = await supabase
        .from("rinnovi_servizi")
        .select("id")
        .eq("item_tipo", "SAAS")
        .eq("subtipo", "ULTRA")
        .eq("cliente", clienteKey)
        .maybeSingle();

      if (findErr) {
        console.error("Errore lookup rinnovo SAAS", findErr);
      } else if (existing?.id) {
        const { error: updErr } = await supabase
          .from("rinnovi_servizi")
          .update(rinnovoPayload)
          .eq("id", existing.id);
        if (updErr) console.error("Errore update rinnovo SAAS", updErr);
      } else {
        const { error: insErr } = await supabase
          .from("rinnovi_servizi")
          .insert(rinnovoPayload);
        if (insErr) console.error("Errore insert rinnovo SAAS", insErr);
      }
    }

    await fetchSaasContratti(clienteKey);
    setContrattoError(null);
    showToast("✅ Contratto salvato", "success");
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
    const fatturazione = newIntervento.fatturazioneStato || "DA_FATTURARE";
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
      fatturazione_stato: fatturazione,
      stato_intervento: "APERTO",
      esito_fatturazione: null,
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
      const res = await supabase
        .from("saas_interventi")
        .insert(payload)
        .select("id")
        .single();
      inserted = res.data;
      insertErr = res.error;
    }
    if (insertErr && String(insertErr.message || "").toLowerCase().includes("ticket_no")) {
      const { ticket_no, ...legacyPayload } = payload as any;
      const res = await supabase
        .from("saas_interventi")
        .insert(legacyPayload)
        .select("id")
        .single();
      inserted = res.data;
      insertErr = res.error;
    }
    if (insertErr && String(insertErr.message || "").toLowerCase().includes("data_tassativa")) {
      const { data_tassativa, ...legacyPayload } = payload as any;
      const res = await supabase
        .from("saas_interventi")
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

    if (inserted?.id && newInterventoFiles.length > 0) {
      await uploadInterventoFilesList(inserted.id, newInterventoFiles);
    }

    await loadInterventiForCliente(clienteKey);

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
    });
    setNewInterventoFiles([]);
    setInterventiError(null);
  }

  async function deleteIntervento(id: string) {
    const ok = window.confirm("Eliminare questo intervento?");
    if (!ok) return;
    const { error: delErr } = await supabase.from("saas_interventi").delete().eq("id", id);
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
      esito_fatturazione: closeEsito,
      chiuso_il: new Date().toISOString(),
      chiuso_da_operatore: currentOperatoreId ?? null,
      note_tecniche: noteTecniche ? noteTecniche : null,
    };

    const { error: updErr } = await supabase
      .from("saas_interventi")
      .update(payload)
      .eq("id", closeInterventoId);

    if (updErr) {
      setCloseError("Errore chiusura intervento: " + updErr.message);
      return;
    }

    await loadInterventiForCliente(cliente);

    setCloseInterventoId(null);
    setCloseEsito("");
    setCloseNote("");
    setCloseError(null);
  }

  function getAlertRecipients() {
    return alertOperatori.filter(
      (o) => o.attivo !== false && o.alert_enabled && String(o.email || "").includes("@")
    );
  }

  function getFatturaAlertRecipients() {
    return alertOperatori.filter(
      (o) => o.attivo !== false && o.alert_enabled && String(o.email || "").includes("@")
    );
  }

  function getDefaultOperatoreIdByRole(role: string) {
    const target = alertOperatori.find(
      (o) =>
        o.attivo !== false &&
        o.alert_enabled &&
        String(o.ruolo || "").toUpperCase() === role
    );
    if (target) return target.id;
    const fallback = alertOperatori.find((o) => o.attivo !== false && o.alert_enabled);
    return fallback?.id ?? "";
  }

  function getRinnoviRecipientLabel() {
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

  async function fetchRinnovi(clienteKey: string) {
    if (!clienteKey) return;
    const { data, error } = await supabase
      .from("rinnovi_servizi")
      .select("*")
      .eq("cliente", clienteKey)
      .order("scadenza", { ascending: true });
    if (error) {
      setRinnoviError("Errore caricamento rinnovi: " + error.message);
      return;
    }
    setRinnovi((data || []) as RinnovoServizioRow[]);
    setRinnoviError(null);
  }

  async function fetchTagliandi(clienteKey: string) {
    if (!clienteKey) return;
    const { data, error } = await supabase
      .from("tagliandi")
      .select("*")
      .eq("cliente", clienteKey)
      .order("scadenza", { ascending: true });
    if (error) {
      setRinnoviError("Errore caricamento tagliandi: " + error.message);
      return;
    }
    setTagliandi((data || []) as TagliandoRow[]);
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
      const { error } = await supabase.from("tagliandi").insert(payload);
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

  async function addServizioScadenza() {
    const clienteKey = (cliente || "").trim();
    if (!clienteKey) {
      setRinnoviError("Cliente non valido per inserire il servizio.");
      return;
    }
    const tipo = String(newServizioScadenza.tipo || "SAAS").toUpperCase();
    const applyAllForUltra = tipo === "SAAS_ULTRA" && applyUltraToAllProjects;
    const applySelectedForUltra =
      tipo === "SAAS_ULTRA" && !applyAllForUltra && applyUltraToSelectedProjects;
    if (!applyAllForUltra && !applySelectedForUltra && !newServizioScadenza.checklist_id) {
      setRinnoviError("Seleziona il progetto da associare al servizio.");
      return;
    }
    if (!newServizioScadenza.scadenza) {
      setRinnoviError("Inserisci la scadenza del servizio.");
      return;
    }
    const checklistIds = applyAllForUltra
      ? checklists.map((c) => c.id)
      : applySelectedForUltra
      ? selectedUltraProjectIds
      : [newServizioScadenza.checklist_id];
    if (checklistIds.length === 0) {
      setRinnoviError("Nessun progetto disponibile per aggregare SAAS ULTRA.");
      return;
    }

    const tipoMapped = mapRinnovoTipo(tipo);
    const riferimento = (newServizioScadenza.riferimento || "").trim();
    const targetRiferimento =
      riferimento || (tipo === "SAAS_ULTRA" ? "ULTRA progetto" : "SAAS progetto");
    const targetStato = String(newServizioScadenza.stato || "DA_AVVISARE").toUpperCase();

    const payload = checklistIds
      .filter(Boolean)
      .filter((checklistId) => {
        // Skip exact duplicates if same item already exists for this project and service code.
        return !rinnovi.some((r) => {
          const sameChecklist = String(r.checklist_id || "") === String(checklistId || "");
          const sameTipo = String(r.item_tipo || "").toUpperCase() === tipoMapped.item_tipo;
          const sameSubtipo = String(r.subtipo || "").toUpperCase() === String(tipoMapped.subtipo || "").toUpperCase();
          const sameRif = String(r.riferimento || "").trim().toUpperCase() === targetRiferimento.toUpperCase();
          return sameChecklist && sameTipo && sameSubtipo && sameRif;
        });
      })
      .map((checklistId) => {
        const checklist = checklistById.get(checklistId);
        return {
          cliente: clienteKey,
          checklist_id: checklistId,
          item_tipo: tipoMapped.item_tipo,
          subtipo: tipoMapped.subtipo,
          riferimento: targetRiferimento,
          descrizione: (newServizioScadenza.note || "").trim() || null,
          scadenza: newServizioScadenza.scadenza,
          stato: targetStato,
          proforma: checklist?.proforma ?? null,
          cod_magazzino: checklist?.magazzino_importazione ?? null,
        };
      });
    if (payload.length === 0) {
      setRinnoviError("Servizio già presente sui progetti selezionati.");
      return;
    }

    setServizioSaving(true);
    setRinnoviError(null);
    try {
      const { data, error } = await supabase
        .from("rinnovi_servizi")
        .insert(payload)
        .select("*");
      if (error) {
        setRinnoviError("Errore inserimento servizio: " + error.message);
        return;
      }
      if (data && Array.isArray(data) && data.length > 0) {
        setRinnovi((prev) => [...prev, ...(data as RinnovoServizioRow[])]);
      }
      setNewServizioScadenza({
        checklist_id: "",
        tipo: "SAAS",
        riferimento: "",
        scadenza: "",
        stato: "DA_AVVISARE",
        note: "",
      });
      setApplyUltraToAllProjects(false);
      setApplyUltraToSelectedProjects(false);
      setSelectedUltraProjectIds([]);
      setRinnoviNotice(
        payload.length > 1
          ? `Servizio aggiunto a ${payload.length} progetti.`
          : "Servizio aggiunto al progetto."
      );
      await fetchRinnovi(clienteKey);
    } finally {
      setServizioSaving(false);
    }
  }

  function getRinnovoReference(r: RinnovoServizioRow) {
    return r.riferimento || r.descrizione || r.checklist_id?.slice(0, 8) || "—";
  }

  function toScadenzaItemFromRinnovo(r: RinnovoServizioRow): ScadenzaItem {
    return {
      id: r.id,
      source: "rinnovi",
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
    const { error } = await supabase.from("rinnovi_servizi").update(payload).eq("id", id);
    if (error) {
      setRinnoviError("Errore aggiornamento rinnovo: " + error.message);
      return false;
    }
    return true;
  }

  async function updateRinnovi(ids: string[], payload: Record<string, any>) {
    if (ids.length === 0) return true;
    const { error } = await supabase.from("rinnovi_servizi").update(payload).in("id", ids);
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
  const TAGLIANDO_STATI = ["DA_AVVISARE", "AVVISATO", "OK", "SCADUTO", "DA_FATTURARE", "FATTURATO"];
  const RINNOVO_STATI = ["DA_AVVISARE", "AVVISATO", "CONFERMATO", "DA_FATTURARE", "FATTURATO", "NON_RINNOVATO"];
  const TAGLIANDO_MODALITA = ["INCLUSO", "EXTRA", "AUTORIZZATO_CLIENTE"];
  const FATTURAZIONE_MENU_OPTIONS = [
    "DA_FATTURARE",
    "FATTURATO",
    "NON_FATTURARE",
    "INCLUSO_DA_CONSUNTIVO",
  ];

  function openEditScadenza(r: ScadenzaItem) {
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
        stato: String(t?.stato || r.stato || "").toUpperCase(),
        modalita: String(t?.modalita || r.modalita || ""),
        note: t?.note ?? "",
      };
    } else if (r.source === "saas") {
      const c = r.checklist_id ? checklistById.get(r.checklist_id) : null;
      form = {
        ...form,
        tipo: "SAAS",
        scadenza: c?.saas_scadenza ?? r.scadenza ?? "",
        stato: "",
        note: c?.saas_note ?? "",
        saas_piano: c?.saas_piano ?? "",
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
    } else if (r.source === "garanzie") {
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
        const l = licenze.find((x) => x.id === editScadenzaItem.id);
        const checklistId = l?.checklist_id ?? editScadenzaItem.checklist_id ?? null;
        if (editScadenzaForm.licenza_class === "GARANZIA") {
          if (!checklistId) {
            throw new Error(
              "Questa licenza non è associata a un progetto. Impossibile convertirla in garanzia."
            );
          }
          const { error: updChecklistErr } = await supabase
            .from("checklists")
            .update({ garanzia_scadenza: editScadenzaForm.scadenza || null })
            .eq("id", checklistId);
          if (updChecklistErr) throw new Error(updChecklistErr.message);

          const { error: delLicErr } = await supabase
            .from("licenses")
            .delete()
            .eq("id", editScadenzaItem.id);
          if (delLicErr) throw new Error(delLicErr.message);

          setLicenze((prev) => prev.filter((x) => x.id !== editScadenzaItem.id));
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
        const { error } = await supabase
          .from("licenses")
          .update({
            scadenza: editScadenzaForm.scadenza || null,
            status: editScadenzaForm.stato || null,
            note: editScadenzaForm.note || null,
            fornitore: editScadenzaForm.fornitore || null,
            intestata_a: editScadenzaForm.intestato_a || null,
            tipo: editScadenzaForm.licenza_tipo || null,
          })
          .eq("id", editScadenzaItem.id);
        if (error) throw new Error(error.message);
        setLicenze((prev) =>
          prev.map((l) =>
            l.id === editScadenzaItem.id
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
        const { error } = await supabase
          .from("tagliandi")
          .update({
            scadenza: editScadenzaForm.scadenza || null,
            stato: editScadenzaForm.stato || null,
            modalita: editScadenzaForm.modalita || null,
            note: editScadenzaForm.note || null,
          })
          .eq("id", editScadenzaItem.id);
        if (error) throw new Error(error.message);
        setTagliandi((prev) =>
          prev.map((t) =>
            t.id === editScadenzaItem.id
              ? {
                  ...t,
                  scadenza: editScadenzaForm.scadenza || null,
                  stato: editScadenzaForm.stato || null,
                  modalita: editScadenzaForm.modalita || null,
                  note: editScadenzaForm.note || null,
                }
              : t
          )
        );
      } else if (editScadenzaForm.tipo === "SAAS") {
        const checklistId = editScadenzaItem.checklist_id;
        if (!checklistId) throw new Error("Checklist non trovata");
        const { error } = await supabase
          .from("checklists")
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
        const { error } = await supabase
          .from("saas_contratti")
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
        const { error } = await supabase
          .from("checklists")
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
      const { error } = await supabase
        .from("saas_contratti")
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
        const { error } = await supabase.from("licenses").delete().eq("id", editScadenzaItem.id);
        if (error) throw new Error(error.message);
        setLicenze((prev) => prev.filter((x) => x.id !== editScadenzaItem.id));
      } else if (editScadenzaForm.tipo === "TAGLIANDO") {
        const { error } = await supabase.from("tagliandi").delete().eq("id", editScadenzaItem.id);
        if (error) throw new Error(error.message);
        setTagliandi((prev) => prev.filter((x) => x.id !== editScadenzaItem.id));
      } else if (editScadenzaForm.tipo === "RINNOVO") {
        const { error } = await supabase
          .from("rinnovi_servizi")
          .delete()
          .eq("id", editScadenzaItem.id);
        if (error) throw new Error(error.message);
        setRinnovi((prev) => prev.filter((x) => x.id !== editScadenzaItem.id));
      } else if (editScadenzaForm.tipo === "SAAS_ULTRA") {
        await deleteContrattoFromScadenza();
        return;
      } else if (editScadenzaForm.tipo === "SAAS") {
        const checklistId = editScadenzaItem.checklist_id;
        if (!checklistId) throw new Error("Checklist non trovata");
        const { error } = await supabase
          .from("checklists")
          .update({
            saas_piano: null,
            saas_scadenza: null,
            saas_tipo: null,
            saas_note: null,
          })
          .eq("id", checklistId);
        if (error) throw new Error(error.message);
        setChecklists((prev) =>
          prev.map((c) =>
            c.id === checklistId
              ? { ...c, saas_piano: null, saas_scadenza: null, saas_tipo: null, saas_note: null }
              : c
          )
        );
      } else if (editScadenzaForm.tipo === "GARANZIA") {
        const checklistId = editScadenzaItem.checklist_id;
        if (!checklistId) throw new Error("Checklist non trovata");
        const { error } = await supabase
          .from("checklists")
          .update({ garanzia_scadenza: null })
          .eq("id", checklistId);
        if (error) throw new Error(error.message);
        setChecklists((prev) =>
          prev.map((c) => (c.id === checklistId ? { ...c, garanzia_scadenza: null } : c))
        );
      } else {
        setEditScadenzaErr("Tipo voce non supportato.");
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
        ? rinnoviAll.filter((r) => String(r.stato || "").toUpperCase() === "DA_AVVISARE")
        : rinnoviAll.filter((r) => String(r.stato || "").toUpperCase() === "DA_FATTURARE");
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
    setRinnoviAlertToOperatoreId(
      stage === "stage1" ? getDefaultOperatoreIdByRole("SUPERVISORE") : getDefaultOperatoreIdByRole("AMMINISTRAZIONE")
    );
    setRinnoviAlertDestMode("operatore");
    setRinnoviAlertManualEmail("");
    setRinnoviAlertManualName("");
    setRinnoviAlertMsg(
      list.length === 1 ? buildMsgScadenzaSingle(list[0], stage) : buildMsgScadenzaBulk(list, stage)
    );
    setRinnoviAlertErr(null);
    setRinnoviAlertOk(null);
    setRinnoviAlertOpen(true);
  }

  async function sendRinnoviAlert() {
    setRinnoviAlertSending(true);
    setRinnoviAlertErr(null);
    setRinnoviAlertOk(null);
    if (isE2EMode) {
      const list =
        rinnoviAlertItems.length > 0
          ? rinnoviAlertItems
          : (getRinnoviStageList(rinnoviAlertStage) as ScadenzaItem[]);
      if (list.length === 0) {
        setRinnoviAlertErr("Nessun elemento disponibile per l'invio.");
        setRinnoviAlertSending(false);
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
      setRinnoviAlertSending(false);
      setTimeout(() => setRinnoviAlertOpen(false), 300);
      return;
    }
    const opId =
      currentOperatoreId ??
      (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
    if (!opId) {
      setRinnoviAlertErr("Seleziona l’Operatore corrente (in alto) prima di inviare un alert.");
      setRinnoviAlertSending(false);
      return;
    }
    if (rinnoviAlertDestMode === "operatore" && !rinnoviAlertToOperatoreId) {
      setRinnoviAlertErr("Seleziona un destinatario.");
      setRinnoviAlertSending(false);
      return;
    }
    if (rinnoviAlertDestMode === "email") {
      const mail = rinnoviAlertManualEmail.trim();
      if (!mail.includes("@")) {
        setRinnoviAlertErr("Inserisci un'email valida.");
        setRinnoviAlertSending(false);
        return;
      }
    }
    const list =
      rinnoviAlertItems.length > 0
        ? rinnoviAlertItems
        : (getRinnoviStageList(rinnoviAlertStage) as ScadenzaItem[]);
    if (list.length === 0) {
      setRinnoviAlertErr("Nessun elemento disponibile per l'invio.");
      setRinnoviAlertSending(false);
      return;
    }
    const checklistId = list.find((r) => r.checklist_id)?.checklist_id ?? null;
    const hasTagliandi = list.some((r) => r.source === "tagliandi");
    const hasRinnovi = list.some((r) => r.source === "rinnovi");
    const hasLicenze = list.some((r) => r.source === "licenze");
    const singleItem = list.length === 1 ? list[0] : null;
    const currentTipo =
      singleItem?.item_tipo
        ? String(singleItem.item_tipo).toUpperCase()
        : hasTagliandi && !hasLicenze
        ? "TAGLIANDO"
        : hasLicenze
        ? "LICENZA"
        : "RINNOVO";
    const canale =
      rinnoviAlertStage === "stage1"
        ? hasTagliandi && !hasRinnovi && !hasLicenze
          ? "tagliando_stage1"
          : hasLicenze && !hasRinnovi && !hasTagliandi
          ? "licenza_stage1"
          : "rinnovo_stage1"
        : hasTagliandi && !hasRinnovi && !hasLicenze
        ? "tagliando_stage2"
        : hasLicenze && !hasRinnovi && !hasTagliandi
        ? "licenza_stage2"
        : "rinnovo_stage2";
    const op =
      rinnoviAlertDestMode === "operatore"
        ? alertOperatori.find((o) => o.id === rinnoviAlertToOperatoreId)
        : null;
    const toEmail =
      rinnoviAlertDestMode === "email"
        ? rinnoviAlertManualEmail.trim()
        : op?.email ?? "";
    const toNome =
      rinnoviAlertDestMode === "email"
        ? rinnoviAlertManualName.trim() || null
        : op?.nome ?? null;
    if (rinnoviAlertSendEmail && !toEmail.includes("@")) {
      setRinnoviAlertErr("Destinatario senza email valida.");
      setRinnoviAlertSending(false);
      return;
    }
    const subject =
      rinnoviAlertSubject ||
      (rinnoviAlertStage === "stage1"
        ? `[Art Tech] Scadenze servizi – ${cliente || "—"}`
        : `[Art Tech] Da fatturare – ${cliente || "—"}`);
    const html = `
      <div>
        <h2>${escapeHtml(subject)}</h2>
        <div>${textToHtml(rinnoviAlertMsg || "")}</div>
        <p style="font-size:12px;color:#6b7280">Messaggio manuale Art Tech.</p>
      </div>
    `;
    const message = (rinnoviAlertMsg || "").trim() || rinnoviAlertMsg || "";
    const tagliandoOnly = hasTagliandi && !hasRinnovi && !hasLicenze;
    const tagliandoItems = list.filter((r) => r.source === "tagliandi");
    try {
      console.debug("send-alert payload (rinnovi)", {
        canale,
        subject,
        message,
        to_email: toEmail || null,
      });
      if (tagliandoOnly && tagliandoItems.length > 0) {
        const updatedIds: string[] = [];
        for (let i = 0; i < tagliandoItems.length; i += 1) {
          const t = tagliandoItems[i];
          const res: any = await sendAlert({
            canale,
            subject,
            message,
            text: rinnoviAlertMsg,
            html,
            to_email: toEmail || null,
            to_nome: toNome,
            to_operatore_id: rinnoviAlertDestMode === "operatore" ? rinnoviAlertToOperatoreId : null,
            from_operatore_id: opId,
            checklist_id: checklistId,
            tagliando_id: t.tagliando_id ?? t.id ?? null,
            tipo: String(t.item_tipo || "TAGLIANDO").toUpperCase(),
            riferimento: t.riferimento ?? null,
            stato: t.stato ?? null,
            trigger: "MANUALE",
            send_email: i === 0 ? rinnoviAlertSendEmail : false,
          });
          if (res?.updated?.id) updatedIds.push(res.updated.id);
        }
        if (updatedIds.length > 0) {
          setTagliandi((prev) =>
            prev.map((row) =>
              updatedIds.includes(row.id)
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
      } else {
        await sendAlert({
          canale,
          subject,
          message,
          text: rinnoviAlertMsg,
          html,
          to_email: toEmail || null,
          to_nome: toNome,
          to_operatore_id: rinnoviAlertDestMode === "operatore" ? rinnoviAlertToOperatoreId : null,
          from_operatore_id: opId,
          checklist_id: checklistId,
          tipo: currentTipo,
          riferimento: singleItem?.riferimento ?? null,
          stato: singleItem?.stato ?? null,
          trigger: "MANUALE",
          send_email: rinnoviAlertSendEmail,
        });
      }
    } catch (err) {
      console.error("Errore invio alert rinnovi", err);
      showToast(`❌ Invio fallito: ${briefError(err)}`, "error");
      setRinnoviAlertSending(false);
      return;
    }
    const nowIso = new Date().toISOString();
    if (rinnoviAlertStage === "stage1") {
      const pairs = new Map<string, { checklistId: string; itemTipo: string }>();
      for (const r of list) {
        if (!r.checklist_id) continue;
        const tipoRaw = String(r.item_tipo || "").toUpperCase();
        const mapped = mapRinnovoTipo(tipoRaw);
        const itemTipo = String(mapped.item_tipo || "").toUpperCase();
        if (!itemTipo) continue;
        const key = `${r.checklist_id}::${itemTipo}`;
        pairs.set(key, { checklistId: r.checklist_id, itemTipo });
      }
      for (const { checklistId, itemTipo } of pairs.values()) {
        await supabase
          .from("rinnovi_servizi")
          .update({ stato: "AVVISATO", updated_at: nowIso })
          .eq("checklist_id", checklistId)
          .eq("item_tipo", itemTipo);
        setRinnovi((prev) =>
          prev.map((row) =>
            String(row.checklist_id || "") === String(checklistId) &&
            String(row.item_tipo || "").toUpperCase() === itemTipo
              ? {
                  ...row,
                  stato: "AVVISATO",
                  notify_stage1_sent_at: nowIso,
                  notify_stage1_to_operatore_id:
                    rinnoviAlertDestMode === "operatore" ? rinnoviAlertToOperatoreId : null,
                }
              : row
          )
        );
      }
    }
    const rinnoviIds = list.filter((r) => r.source === "rinnovi").map((r) => r.id);
    const licenzeIds = list.filter((r) => r.source === "licenze").map((r) => r.id);
    // Righe SAAS/SAAS_ULTRA/GARANZIA: assicura record rinnovi_servizi e aggiorna stato
    const workflowItems = list.filter((r) =>
      ["saas", "saas_contratto", "garanzie"].includes(r.source)
    );
    for (const r of workflowItems) {
      const rinnovo = await ensureRinnovoForItem(r);
      if (rinnovo) {
        const updPayload: Record<string, any> =
          rinnoviAlertStage === "stage1"
            ? {
                stato: "AVVISATO",
                notify_stage1_sent_at: nowIso,
                notify_stage1_to_operatore_id:
                  rinnoviAlertDestMode === "operatore" ? rinnoviAlertToOperatoreId : null,
              }
            : {
                billing_notified_at: nowIso,
                billing_stage2_sent_at: nowIso,
                billing_stage2_to_operatore_id:
                  rinnoviAlertDestMode === "operatore" ? rinnoviAlertToOperatoreId : null,
              };
        await updateRinnovo(rinnovo.id, updPayload);
      }
    }
    if (rinnoviAlertStage === "stage1") {
      if (rinnoviIds.length > 0) {
        await updateRinnovi(rinnoviIds, {
          stato: "AVVISATO",
          notify_stage1_sent_at: nowIso,
          notify_stage1_to_operatore_id:
            rinnoviAlertDestMode === "operatore" ? rinnoviAlertToOperatoreId : null,
        });
      }
      if (licenzeIds.length > 0) {
        await Promise.all(
          licenzeIds.map((id) =>
            fetch("/api/licenses/action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "SEND_ALERT",
                licenseId: id,
                status: "AVVISATO",
                alertTo:
                  rinnoviAlertDestMode === "operatore"
                    ? rinnoviAlertToOperatoreId
                    : rinnoviAlertManualEmail.trim(),
                alertNote: rinnoviAlertMsg,
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
          billing_stage2_to_operatore_id:
            rinnoviAlertDestMode === "operatore" ? rinnoviAlertToOperatoreId : null,
        });
      }
      if (licenzeIds.length > 0) {
        await Promise.all(
          licenzeIds.map((id) =>
            fetch("/api/licenses/action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "SEND_ALERT",
                licenseId: id,
                alertTo:
                  rinnoviAlertDestMode === "operatore"
                    ? rinnoviAlertToOperatoreId
                    : rinnoviAlertManualEmail.trim(),
                alertNote: rinnoviAlertMsg,
                updatedByOperatoreId: opId,
              }),
            })
          )
        );
      }
    }
    const recipientLabel = getRinnoviRecipientLabel();
    const esitoLabel = rinnoviAlertSendEmail ? "✅ Email inviata" : "✅ Avviso registrato";
    showToast(esitoLabel, "success");
    setRinnoviNotice(`${esitoLabel} — ${recipientLabel}`);
    setRinnoviAlertSending(false);
    setTimeout(() => setRinnoviAlertOpen(false), 800);
    setRinnoviAlertSendEmail(true);
    await fetchRinnovi((cliente || "").trim());
    await fetchTagliandi((cliente || "").trim());
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
    const { error } = await supabase.from("tagliandi").update(payload).eq("id", id);
    if (error) {
      setRinnoviError("Errore aggiornamento tagliando: " + error.message);
      return false;
    }
    return true;
  }

  async function markTagliandoOk(r: ScadenzaItem) {
    const nextScadenza = promptNextScadenza(r.scadenza ?? null, "TAGLIANDO");
    if (!nextScadenza) return;
    const ok = await updateTagliando(r.id, { stato: "DA_FATTURARE", scadenza: nextScadenza });
    if (ok) {
      setTagliandi((prev) =>
        prev.map((t) => (t.id === r.id ? { ...t, scadenza: nextScadenza, stato: "DA_FATTURARE" } : t))
      );
      setRinnoviNotice("Tagliando confermato: DA_FATTURARE.");
      await fetchTagliandi((cliente || "").trim());
    }
  }

  async function markTagliandoDaFatturare(r: ScadenzaItem) {
    const ok = await updateTagliando(r.id, { stato: "DA_FATTURARE" });
    if (ok) {
      setRinnoviNotice("Tagliando segnato DA_FATTURARE.");
      await fetchTagliandi((cliente || "").trim());
      openRinnoviAlert("stage2", false, [r]);
    }
  }

  async function markTagliandoFatturato(r: ScadenzaItem) {
    const ok = await updateTagliando(r.id, { stato: "FATTURATO" });
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
    TAGLIANDO: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
    SAAS: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
    GARANZIA: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
    SAAS_ULTRA: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
    RINNOVO: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
  };

  // Mappa configurabile: mesi di rinnovo di default per tipo
  const RENEWAL_DEFAULTS_MONTHS: Record<string, number> = {
    LICENZA: 12,
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
    if (tipo === "SAAS" || tipo === "GARANZIA" || tipo === "SAAS_ULTRA") {
      const match = getRinnovoMatch(r);
      return String(match?.stato || "DA_AVVISARE").toUpperCase();
    }
    return String(r.stato || "").toUpperCase();
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
    if (mapped.subtipo) payload.subtipo = mapped.subtipo;
    if (tipo === "SAAS_ULTRA") {
      payload.checklist_id = null;
    }
    const isGaranzia =
      String(mapped.item_tipo || "").toUpperCase() === "GARANZIA" && payload.checklist_id;
    const { data, error } = isGaranzia
      ? await supabase
          .from("rinnovi_servizi")
          .upsert(payload, { onConflict: "checklist_id,item_tipo" })
          .select("*")
          .single()
      : await supabase
          .from("rinnovi_servizi")
          .insert(payload)
          .select("*")
          .single();
    if (error) {
      setRinnoviError("Errore creazione rinnovo: " + error.message);
      return null;
    }
    await fetchRinnovi(clienteKey);
    return (data || null) as RinnovoServizioRow | null;
  }

  async function updateSourceScadenza(r: ScadenzaItem, newDate: string) {
    if (r.source === "tagliandi") {
      const { error } = await supabase.from("tagliandi").update({ scadenza: newDate }).eq("id", r.id);
      if (error) {
        setRinnoviError("Errore aggiornamento scadenza tagliando: " + error.message);
        return false;
      }
      return true;
    }
    if (r.source === "licenze") {
      const { error } = await supabase.from("licenses").update({ scadenza: newDate }).eq("id", r.id);
      if (error) {
        setRinnoviError("Errore aggiornamento scadenza licenza: " + error.message);
        return false;
      }
      return true;
    }
    if (r.source === "saas") {
      const { error } = await supabase.from("checklists").update({ saas_scadenza: newDate }).eq("id", r.checklist_id);
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
      const { error } = await supabase
        .from("checklists")
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
      const { error } = await supabase
        .from("saas_contratti")
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
      const { error } = await supabase.from("rinnovi_servizi").update({ scadenza: newDate }).eq("id", r.id);
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
    if (checklistIds.length === 0) {
      setBulkLastSentAt(null);
      setBulkLastToOperatoreId(null);
      setBulkLastMessage(null);
      return;
    }
    const { data, error } = await supabase
      .from("checklist_alert_log")
      .select("created_at, to_operatore_id, checklist_id, messaggio")
      .eq("canale", "fatturazione_bulk")
      .in("checklist_id", checklistIds)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
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
      esito_fatturazione: null,
      chiuso_il: null,
      chiuso_da_operatore: null,
    };
    const { error: updErr } = await supabase
      .from("saas_interventi")
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

    await loadInterventiForCliente(cliente);
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

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>SCHEDA CLIENTE</div>
        </div>
        <Link
          href="/"
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "inherit",
            background: "white",
            marginLeft: "auto",
          }}
        >
          ← Dashboard
        </Link>
      </div>

      <h2 style={{ marginTop: 12, marginBottom: 6 }}>Cliente: {cliente}</h2>
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
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
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
                {[
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
                ].map((p) => (
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
              {contratto?.id ? "Aggiorna contratto" : "Salva contratto"}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Scadenze &amp; Rinnovi</h2>
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

        <div
          style={{
            marginTop: 10,
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 10,
            background: "#fcfcfc",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Aggiungi servizio SAAS / ULTRA associato al progetto
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px,1.4fr) 140px minmax(180px,1fr) 140px 160px minmax(180px,1fr) auto",
              gap: 8,
              alignItems: "end",
            }}
          >
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Progetto</div>
              <select
                value={newServizioScadenza.checklist_id}
                onChange={(e) =>
                  setNewServizioScadenza((prev) => ({ ...prev, checklist_id: e.target.value }))
                }
                disabled={
                  newServizioScadenza.tipo === "SAAS_ULTRA" &&
                  (applyUltraToAllProjects || applyUltraToSelectedProjects)
                }
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background:
                    newServizioScadenza.tipo === "SAAS_ULTRA" &&
                    (applyUltraToAllProjects || applyUltraToSelectedProjects)
                      ? "#f9fafb"
                      : "white",
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
              <div style={{ fontSize: 12, marginBottom: 4 }}>Tipo</div>
              <select
                value={newServizioScadenza.tipo}
                onChange={(e) =>
                  setNewServizioScadenza((prev) => ({
                    ...prev,
                    tipo: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              >
                <option value="SAAS">SAAS</option>
                <option value="SAAS_ULTRA">SAAS_ULTRA</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Piano / Codice</div>
              <input
                value={newServizioScadenza.riferimento}
                onChange={(e) =>
                  setNewServizioScadenza((prev) => ({ ...prev, riferimento: e.target.value }))
                }
                placeholder="es. SAAS-PL / SAAS-UL4"
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              />
              {newServizioScadenza.tipo === "SAAS_ULTRA" && (
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                  >
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
                    Applica a progetti selezionati
                  </label>
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                  >
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
                    Applica a tutti i progetti del cliente
                  </label>
                  {applyUltraToSelectedProjects && (
                    <div
                      style={{
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
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Scadenza</div>
              <input
                type="date"
                value={newServizioScadenza.scadenza}
                onChange={(e) =>
                  setNewServizioScadenza((prev) => ({ ...prev, scadenza: e.target.value }))
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
              <div style={{ fontSize: 12, marginBottom: 4 }}>Stato</div>
              <select
                value={newServizioScadenza.stato}
                onChange={(e) =>
                  setNewServizioScadenza((prev) => ({ ...prev, stato: e.target.value }))
                }
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "white",
                }}
              >
                {RINNOVO_STATI.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Note</div>
              <input
                value={newServizioScadenza.note}
                onChange={(e) =>
                  setNewServizioScadenza((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Opzionale"
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
              onClick={addServizioScadenza}
              disabled={servizioSaving}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                fontWeight: 700,
                cursor: servizioSaving ? "not-allowed" : "pointer",
                opacity: servizioSaving ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {servizioSaving ? "Salvataggio..." : "Aggiungi"}
            </button>
          </div>
        </div>

        {rinnoviError && (
          <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{rinnoviError}</div>
        )}
        {rinnoviNotice && (
          <div style={{ marginTop: 6, color: "#166534", fontSize: 12 }}>
            {rinnoviNotice}
          </div>
        )}

        {filteredRinnovi.length === 0 ? (
          <div style={{ marginTop: 8, opacity: 0.7 }}>Nessuna scadenza/rinnovo trovato</div>
        ) : (
          <div
            data-testid="renewals-table"
            style={{
              marginTop: 10,
              border: "1px solid #eee",
              borderRadius: 12,
              overflow: "hidden",
              background: "white",
            }}
          >
            <div
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1.1fr 110px 120px 120px 90px 330px",
              padding: "10px 12px",
              fontWeight: 800,
              background: "#fafafa",
              borderBottom: "1px solid #eee",
              fontSize: 12,
              columnGap: 12,
            }}
          >
            <div style={{ textAlign: "center" }}>Tipo</div>
            <div style={{ textAlign: "center" }}>Riferimento</div>
            <div style={{ textAlign: "center" }}>Scadenza</div>
            <div style={{ textAlign: "center" }}>Stato</div>
            <div style={{ textAlign: "center" }}>Ultimo invio</div>
            <div style={{ textAlign: "center" }}>Modalità</div>
            <div style={{ textAlign: "center" }}>Azioni</div>
          </div>

          {filteredRinnovi.map((r) => {
            const checklist = r.checklist_id ? checklistById.get(r.checklist_id) : null;
            const checklistName = checklist?.nome_checklist ?? r.checklist_id?.slice(0, 8);
            const stato = getWorkflowStato(r);
            const isTagliando = r.source === "tagliandi";
            const isLicenza = r.source === "licenze";
            const isSaas = r.source === "saas" || r.source === "saas_contratto";
            const isGaranzia = r.source === "garanzie";
            const tipoUpper = String(r.item_tipo || "").toUpperCase();
            const actions = ACTIONS_BY_TIPO[tipoUpper] || {
              avviso: !isGaranzia,
              conferma: !isGaranzia,
              non_rinnovato: !isGaranzia,
              fattura: !isGaranzia,
            };
            const isExpiryOnly = false;
            const hasScadenza = Boolean(r.scadenza);
            const canStage1 = actions.avviso && (isLicenza ? hasScadenza : ["DA_AVVISARE", "AVVISATO"].includes(stato));
            const canConfirm = actions.conferma
                ? isTagliando
                  ? !["DA_FATTURARE", "FATTURATO", "SCADUTO"].includes(stato)
                  : !["CONFERMATO", "DA_FATTURARE", "FATTURATO", "NON_RINNOVATO"].includes(stato)
                : false;
            const canStage2 = actions.fattura
                ? isTagliando
                  ? stato === "DA_FATTURARE" || stato === "OK"
                  : stato === "CONFERMATO" || stato === "DA_FATTURARE"
                : false;
            const canNonRinnovato = actions.non_rinnovato
                ? isTagliando
                  ? !["FATTURATO", "SCADUTO"].includes(stato)
                  : !["FATTURATO", "NON_RINNOVATO"].includes(stato)
                : false;
            const canFatturato = actions.fattura ? (isTagliando ? stato === "DA_FATTURARE" : stato === "DA_FATTURARE") : false;
            const alertStats = alertStatsMap.get(getAlertKeyForRow(r)) || null;
            const lastSent = alertStats?.last_sent_at
              ? new Date(alertStats.last_sent_at).toLocaleString()
              : "—";
            const lastSentTooltip = alertStats
              ? `Totale invii: ${alertStats.n_avvisi}\nUltimo invio: ${lastSent}`
              : "Nessun invio";
            return (
              <div
                key={r.id}
                data-testid="renewal-row"
                data-item-tipo={String(r.item_tipo || "").toUpperCase()}
                data-source={String(r.source || "")}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1.1fr 110px 120px 120px 90px 330px",
                  padding: "10px 12px",
                  borderBottom: "1px solid #f3f4f6",
                  alignItems: "center",
                  fontSize: 12,
                  columnGap: 12,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  {String(r.item_tipo || "—").toUpperCase()}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <div>{r.riferimento ?? r.descrizione ?? "—"}</div>
                  {r.checklist_id && (
                      <Link
                        href={`/checklists/${r.checklist_id}`}
                        style={{ fontSize: 11, color: "#2563eb", textDecoration: "none" }}
                      >
                        PROGETTO: {checklistName ?? r.checklist_id.slice(0, 8)}
                      </Link>
                    )}
                  </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <div>{r.scadenza ? new Date(r.scadenza).toLocaleDateString() : "—"}</div>
                  {renderScadenzaBadge(r.scadenza)}
                </div>
                <div
                  style={{
                    overflow: "visible",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <div data-testid="workflow-badge">
                    {isTagliando
                      ? renderTagliandoStatoBadge(r.stato)
                      : stato === "AVVISATO"
                      ? renderAvvisatoBadge(alertStats, {
                          cliente,
                          checklist_id: r.checklist_id ?? null,
                          tipo: r.item_tipo ?? null,
                        })
                      : renderRinnovoStatoBadge(stato)}
                  </div>
                </div>
                <div
                  title={lastSentTooltip}
                  style={{ textAlign: "center", display: "flex", justifyContent: "center" }}
                >
                  {lastSent}
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  {isTagliando ? renderModalitaBadge(r.modalita) : "—"}
                </div>
                <div
                  data-testid="workflow-actions-btn"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 110px)",
                    justifyContent: "center",
                    alignContent: "center",
                    gap: 6,
                    width: "100%",
                  }}
                >
                    {actions.avviso && (
                      <div
                        style={{
                          display: "contents",
                        }}
                      >
                      <button
                        type="button"
                        data-testid="send-alert-btn"
                        data-status-target="AVVISATO"
                        onClick={() => openRinnoviAlert("stage1", false, [r])}
                        disabled={!canStage1}
                        title={
                          canStage1
                            ? "Invia avviso (stage1)"
                            : "Disponibile solo per stato DA_AVVISARE o AVVISATO"
                        }
                        style={{
                          padding: "4px 8px",
                          width: 110,
                          borderRadius: 6,
                          border: "1px solid #111",
                          background: "white",
                          cursor: canStage1 ? "pointer" : "not-allowed",
                          fontSize: 12,
                          fontWeight: 700,
                          opacity: canStage1 ? 1 : 0.5,
                          textAlign: "center",
                        }}
                      >
                        {stato === "AVVISATO" ? "Invia nuovo avviso" : "Invia avviso"}
                      </button>
                      {actions.fattura && (
                        <button
                          type="button"
                          data-testid="set-status-DA_FATTURARE"
                          onClick={() => {
                            if (stato === "DA_FATTURARE") {
                              openRinnoviAlert("stage2", false, [r]);
                            } else {
                              if (isTagliando) {
                                markTagliandoDaFatturare(r);
                              } else if (isLicenza) {
                                markLicenzaDaFatturare(r);
                              } else {
                                markRinnovoDaFatturare(r as RinnovoServizioRow);
                              }
                            }
                          }}
                          disabled={!canStage2}
                          title={
                            canStage2
                              ? "Invia admin (stage2)"
                              : "Disponibile solo dopo CONFERMATO"
                          }
                          style={{
                            padding: "4px 8px",
                            width: 110,
                            borderRadius: 6,
                            border: "1px solid #111",
                            background: "white",
                            cursor: canStage2 ? "pointer" : "not-allowed",
                            fontSize: 12,
                            fontWeight: 700,
                            opacity: canStage2 ? 1 : 0.5,
                            textAlign: "center",
                          }}
                        >
                          Invia admin
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="edit-expiry-btn"
                        onClick={() => openEditScadenza(r)}
                        style={{
                          padding: "3px 6px",
                          width: 110,
                          borderRadius: 6,
                          border: "1px solid #111",
                          background: "white",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: "center",
                        }}
                      >
                        Modifica
                      </button>
                    </div>
                    )}
                    {actions.conferma || actions.non_rinnovato || actions.fattura ? (
                      <div
                        style={{
                          display: "contents",
                        }}
                      >
                      {actions.conferma && (
                        <button
                          type="button"
                          data-testid="set-status-CONFERMATO"
                          onClick={() =>
                            isTagliando
                              ? markTagliandoOk(r)
                              : isLicenza
                              ? markLicenzaConfermata(r)
                              : markWorkflowConfermato(r)
                          }
                          disabled={!canConfirm}
                          title={
                            canConfirm
                              ? "Segna come CONFERMATO"
                              : "Stato già CONFERMATO o oltre"
                          }
                          style={{
                            padding: "4px 6px",
                            width: 110,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "#f9fafb",
                            cursor: canConfirm ? "pointer" : "not-allowed",
                            fontSize: 12,
                            opacity: canConfirm ? 1 : 0.5,
                            textAlign: "center",
                          }}
                        >
                          Confermato
                        </button>
                      )}
                      {actions.non_rinnovato && (
                        <button
                          type="button"
                          data-testid="set-status-NON_RINNOVATO"
                          onClick={() =>
                            isLicenza
                              ? markLicenzaNonRinnovata(r)
                              : isTagliando
                              ? markTagliandoNonRinnovato(r)
                              : markWorkflowNonRinnovato(r)
                          }
                          disabled={!canNonRinnovato}
                          title={
                            canNonRinnovato
                              ? "Segna come NON_RINNOVATO"
                              : "Non disponibile se già FATTURATO/NON_RINNOVATO"
                          }
                          style={{
                            padding: "4px 6px",
                            width: 110,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "#f9fafb",
                            cursor: canNonRinnovato ? "pointer" : "not-allowed",
                            fontSize: 12,
                            opacity: canNonRinnovato ? 1 : 0.5,
                            textAlign: "center",
                          }}
                        >
                          NON_RINNOVATO
                        </button>
                      )}
                      {actions.fattura && (
                        <button
                          type="button"
                          data-testid="set-status-FATTURATO"
                          onClick={() =>
                            isTagliando
                              ? markTagliandoFatturato(r)
                              : isLicenza
                              ? markLicenzaFatturato(r)
                              : markRinnovoFatturato(r as RinnovoServizioRow)
                          }
                          disabled={!canFatturato}
                          title={
                            canFatturato
                              ? "Segna come FATTURATO"
                              : "Disponibile solo per stato DA_FATTURARE"
                          }
                          style={{
                            padding: "3px 6px",
                            width: 110,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "#f9fafb",
                            cursor: canFatturato ? "pointer" : "not-allowed",
                            fontSize: 11,
                            opacity: canFatturato ? 1 : 0.5,
                            textAlign: "center",
                          }}
                        >
                          FATTURATO
                        </button>
                      )}
                    </div>
                    ) : null}
                    {isExpiryOnly && (
                      <div>
                        <button
                          type="button"
                          onClick={() => openEditScadenza(r)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "1px solid #111",
                            background: "white",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          Modifica
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Interventi</h2>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Inclusi usati: {interventiInclusiUsati}
            {!contratto ? (
              <> / Totale inclusi: —</>
            ) : interventiTotali == null ? (
              <> / Totale inclusi: ∞ (illimitato)</>
            ) : (
              <>
                {" "}
                / Totale inclusi: {interventiTotali} / Residui: {interventiResidui}
              </>
            )}
            {interventiResidui != null && interventiResidui <= 0 && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: "#fee2e2",
                  color: "#991b1b",
                  fontWeight: 700,
                }}
              >
                Inclusi finiti
              </span>
            )}
          </div>
        </div>

        {interventiInfo && (
          <div style={{ marginTop: 6, color: "#166534", fontSize: 12 }}>
            {interventiInfo}
          </div>
        )}

        {interventiError && (
          <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>
            {interventiError}
          </div>
        )}
        {alertNotice && (
          <div style={{ marginTop: 6, color: "#555", fontSize: 12 }}>
            {alertNotice}
          </div>
        )}
        {bulkLastSentAt && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#166534", fontWeight: 600 }}>
            ✅ Ultimo alert fatturazione (bulk):{" "}
            {new Date(bulkLastSentAt).toLocaleString()}
            {(() => {
              const op = alertOperatori.find((o) => o.id === bulkLastToOperatoreId);
              if (!op) return bulkLastToOperatoreId ? ` — a ${bulkLastToOperatoreId}` : "";
              const email = op.email ? ` (${op.email})` : "";
              return ` — a ${op.nome ?? op.id}${email}`;
            })()}
          </div>
        )}
        {bulkLastMessage && (
          <div style={{ marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setBulkPreviewOpen(true)}
              style={{
                padding: 0,
                border: "none",
                background: "transparent",
                color: "#2563eb",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Mostra recap
            </button>
          </div>
        )}

        <div
          id="add-intervento"
          style={{
            marginTop: 10,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "white",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Aggiungi intervento</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label>
              Data<br />
              <input
                type="date"
                value={newIntervento.data}
                onChange={(e) => setNewIntervento({ ...newIntervento, data: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label>
              Data tassativa<br />
              <input
                type="date"
                value={newIntervento.dataTassativa}
                onChange={(e) => setNewIntervento({ ...newIntervento, dataTassativa: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Descrizione<br />
              <input
                value={newIntervento.tipo}
                onChange={(e) => setNewIntervento({ ...newIntervento, tipo: e.target.value })}
                style={{ width: "100%", padding: 8 }}
                placeholder="Assistenza, aggiornamento..."
              />
            </label>

            <label>
              Ticket n°<br />
              <input
                value={newIntervento.ticketNo}
                onChange={(e) => setNewIntervento({ ...newIntervento, ticketNo: e.target.value })}
                style={{ width: "100%", padding: 8 }}
                placeholder="es. 1234"
              />
            </label>

            <label>
              Incluso / Extra<br />
              <select
                value={newIntervento.incluso ? "INCLUSO" : "EXTRA"}
                onChange={(e) =>
                  setNewIntervento({ ...newIntervento, incluso: e.target.value === "INCLUSO" })
                }
                style={{ width: "100%", padding: 8 }}
              >
                <option value="INCLUSO">INCLUSO</option>
                <option value="EXTRA">EXTRA</option>
              </select>
            </label>

            <label>
              PROGETTO<br />
              <select
                value={newIntervento.checklistId}
                onChange={(e) => {
                  const checklistId = e.target.value;
                  const found = checklistById.get(checklistId);
                  setNewIntervento({
                    ...newIntervento,
                    checklistId,
                    proforma: found?.proforma ?? newIntervento.proforma,
                    codiceMagazzino: found?.magazzino_importazione ?? newIntervento.codiceMagazzino,
                  });
                }}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="">—</option>
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_checklist ?? c.id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Proforma<br />
              <input
                value={newIntervento.proforma}
                onChange={(e) => setNewIntervento({ ...newIntervento, proforma: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Cod. magazzino<br />
              <input
                value={newIntervento.codiceMagazzino}
                onChange={(e) =>
                  setNewIntervento({ ...newIntervento, codiceMagazzino: e.target.value })
                }
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <label>
              Fatturazione<br />
              <select
                value={newIntervento.fatturazioneStato}
                onChange={(e) => {
                  const next = e.target.value;
                  setNewIntervento({
                    ...newIntervento,
                    fatturazioneStato: next,
                    fatturatoIl:
                      next === "FATTURATO" && !newIntervento.fatturatoIl
                        ? new Date().toISOString().slice(0, 10)
                        : newIntervento.fatturatoIl,
                  });
                }}
                style={{ width: "100%", padding: 8 }}
              >
                {FATTURAZIONE_MENU_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            {newIntervento.statoIntervento === "CHIUSO" &&
              newIntervento.fatturazioneStato === "FATTURATO" && (
              <>
                <label>
                  Numero fattura<br />
                  <input
                    value={newIntervento.numeroFattura}
                    onChange={(e) =>
                      setNewIntervento({ ...newIntervento, numeroFattura: e.target.value })
                    }
                    style={{ width: "100%", padding: 8 }}
                  />
                </label>
                <label>
                  Fatturato il<br />
                  <input
                    type="date"
                    value={newIntervento.fatturatoIl}
                    onChange={(e) =>
                      setNewIntervento({ ...newIntervento, fatturatoIl: e.target.value })
                    }
                    style={{ width: "100%", padding: 8 }}
                  />
                </label>
              </>
            )}
          </div>

          <div style={{ marginTop: 10 }}>
            <label>
              Dettaglio intervento<br />
              <textarea
                value={newIntervento.note}
                onChange={(e) => setNewIntervento({ ...newIntervento, note: e.target.value })}
                rows={4}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            <label>
              Allegati (opzionale)<br />
              <input
                type="file"
                multiple
                onChange={(e) => setNewInterventoFiles(e.target.files ? Array.from(e.target.files) : [])}
              />
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={addIntervento}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                cursor: "pointer",
              }}
            >
              Aggiungi intervento
            </button>
          </div>
        </div>

        {interventi.length === 0 ? (
          <div style={{ opacity: 0.7, marginTop: 8 }}>Nessun intervento trovato</div>
        ) : (
          <>
            <div
              style={{
                marginTop: 10,
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
                background: "#fafafa",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Fatture da emettere</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {interventi.filter((i) => isFatturaDaEmettere(i)).length} interventi
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  console.log("CLICK BULK ALERT");
                  const list = getFattureDaEmettereList();
                  console.log(
                    "BULK LIST",
                    list.length,
                    list.map((x) => x.id)
                  );
                  if (list.length === 0) {
                    setInterventiInfo("Nessuna fattura da emettere.");
                    return;
                  }
                  setBulkErr(null);
                  setBulkOk(null);
                  setBulkToOperatoreId("");
                  setBulkMsg(buildBulkFattureMessage(list));
                  setBulkOpen(true);
                }}
                disabled={bulkSending}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "white",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  opacity: bulkSending ? 0.6 : 1,
                }}
              >
                Invia alert ora (fatturazione)
              </button>
            </div>
            <div
              style={{
                marginTop: 10,
                border: "1px solid #eee",
                borderRadius: 12,
                overflowX: "auto",
                width: "100%",
                background: "white",
              }}
            >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "90px minmax(180px,1fr) minmax(240px,1.5fr) 110px 90px 120px 150px 150px 130px 150px",
                columnGap: 8,
                padding: "6px 8px",
                fontWeight: 800,
                background: "#fafafa",
                borderBottom: "1px solid #eee",
                fontSize: 12,
                minWidth: 1410,
                tableLayout: "fixed",
              }}
            >
              <div style={{ whiteSpace: "nowrap" }}>Data</div>
              <div style={{ whiteSpace: "nowrap" }}>PROGETTO</div>
              <div>Descrizione</div>
              <div style={{ whiteSpace: "nowrap" }}>Ticket n°</div>
              <div style={{ whiteSpace: "nowrap" }}>Tipo</div>
              <div style={{ whiteSpace: "nowrap" }}>Stato</div>
              <div style={{ whiteSpace: "nowrap" }}>Proforma</div>
              <div style={{ whiteSpace: "nowrap" }}>Codice</div>
              <div style={{ whiteSpace: "nowrap" }}>Fatturazione</div>
              <div style={{ whiteSpace: "nowrap" }}>AZIONI</div>
            </div>
            {interventi.map((i) => (
              <div key={i.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "90px minmax(180px,1fr) minmax(240px,1.5fr) 110px 90px 120px 150px 150px 130px 150px",
                    columnGap: 8,
                    padding: "6px 8px",
                    alignItems: "center",
                    fontSize: 12,
                    minWidth: 1410,
                    tableLayout: "fixed",
                  }}
                >
                  <div style={{ whiteSpace: "nowrap" }}>
                    {i.data ? new Date(i.data).toLocaleDateString() : "—"}
                  </div>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {i.checklist?.nome_checklist
                      ? i.checklist.nome_checklist
                      : i.checklist_id
                      ? i.checklist_id.slice(0, 8)
                      : "—"}
                  </div>
                  <div style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{i.descrizione}</div>
                  <div style={{ whiteSpace: "nowrap" }}>{i.ticket_no || "—"}</div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      alignItems: "flex-start",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {renderInterventoBadge(i.incluso ? "INCLUSO" : "EXTRA")}
                    </div>
                  </div>
                  <div style={{ whiteSpace: "nowrap" }}>
                    {renderStatoInterventoBadge(getInterventoStato(i))}
                  </div>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {i.proforma || i.checklist?.proforma || "—"}
                  </div>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {i.codice_magazzino || i.checklist?.magazzino_importazione || "—"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, whiteSpace: "nowrap" }}>
                    {getInterventoStato(i) === "APERTO" ? (
                      <>
                        <div>—</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>da chiudere</div>
                      </>
                    ) : (
                      <>
                        {renderFatturazioneBadge(getEsitoFatturazione(i) || "—")}
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      alignItems: "stretch",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedInterventoId(expandedInterventoId === i.id ? null : i.id)
                    }
                      style={{
                        padding: "3px 6px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        background: "#f8fafc",
                        cursor: "pointer",
                        width: "100%",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                      }}
                    title="Apri allegati intervento"
                  >
                    📎 File ({(interventoFilesById.get(i.id) || []).length})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedInterventoId(expandedInterventoId === i.id ? null : i.id)
                    }
                      style={{
                        padding: "3px 6px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                        width: "100%",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                      }}
                  >
                    Dettagli
                  </button>
                  {getInterventoStato(i) === "APERTO" && (
                    <button
                      type="button"
                      onClick={() => {
                        setCloseInterventoId(i.id);
                        setCloseEsito("DA_FATTURARE");
                        setCloseNote("");
                        setCloseError(null);
                      }}
                      style={{
                        padding: "3px 6px",
                        borderRadius: 6,
                        border: "1px solid #111",
                        background: "white",
                        cursor: "pointer",
                        width: "100%",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                      }}
                    >
                      Chiudi
                    </button>
                  )}
                  {getInterventoStato(i) === "CHIUSO" &&
                    getEsitoFatturazione(i) === "DA_FATTURARE" && (
                    <button
                      type="button"
                      onClick={() => {
                        setAlertInterventoId(i.id);
                        setAlertDestinatarioId("");
                        setAlertMessaggio(buildAlertMessage(i));
                        setAlertNotice(null);
                      }}
                      style={{
                        padding: "3px 6px",
                        borderRadius: 6,
                        border: "1px solid #111",
                        background: "white",
                        cursor: "pointer",
                        width: "100%",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                      }}
                    >
                      Invia alert fattura
                    </button>
                  )}
                    <button
                      type="button"
                      onClick={() => startEditIntervento(i)}
                      style={{
                        padding: "3px 6px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                        width: "100%",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                      }}
                    >
                      Modifica
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteIntervento(i.id)}
                      style={{
                        padding: "3px 6px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                        width: "100%",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                      }}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
                {lastAlertByIntervento.get(i.id) && (
                  <div style={{ padding: "0 12px 10px", fontSize: 12, opacity: 0.7 }}>
                    Ultimo alert:{" "}
                    {lastAlertByIntervento.get(i.id)!.toNome ??
                      lastAlertByIntervento.get(i.id)!.toOperatoreId ??
                      "—"}{" "}
                    —{" "}
                    {new Date(lastAlertByIntervento.get(i.id)!.createdAt).toLocaleString()}
                  </div>
                )}
                {editInterventoId === i.id && (
                  <div
                    style={{
                      padding: "10px 12px 14px",
                      background: "#fafafa",
                      borderTop: "1px solid #eee",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Stato intervento</div>
                      {renderStatoInterventoBadge(getInterventoStato(i))}
                      {getInterventoStato(i) === "CHIUSO" &&
                        canReopenIntervento(
                          alertOperatori.find((o) => o.id === currentOperatoreId)?.ruolo ?? null
                        ) && (
                          <button
                            type="button"
                            onClick={() => reopenIntervento(i.id)}
                            style={{
                              marginLeft: "auto",
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #111",
                              background: "white",
                              cursor: "pointer",
                            }}
                          >
                            Riapri
                          </button>
                        )}
                    </div>
                    {getInterventoStato(i) === "CHIUSO" && (
                      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Esito fatturazione</div>
                        {renderFatturazioneBadge(getEsitoFatturazione(i) || "—")}
                        <div style={{ fontSize: 12, opacity: 0.7, marginLeft: 8 }}>Chiuso da</div>
                        <div style={{ fontSize: 12 }}>
                          {getOperatoreNome(i.chiuso_da_operatore)}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Chiuso il</div>
                        <div style={{ fontSize: 12 }}>
                          {i.chiuso_il ? new Date(i.chiuso_il).toLocaleDateString() : "—"}
                        </div>
                      </div>
                    )}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 140px 1fr 1fr 1fr",
                        gap: 10,
                      }}
                    >
                      <label>
                        Data<br />
                        <input
                          type="date"
                          value={editIntervento.data}
                          onChange={(e) =>
                            setEditIntervento({ ...editIntervento, data: e.target.value })
                          }
                          style={{ width: "100%", padding: 8 }}
                        />
                      </label>
                      <label>
                        Data tassativa<br />
                        <input
                          type="date"
                          value={editIntervento.dataTassativa}
                          onChange={(e) =>
                            setEditIntervento({ ...editIntervento, dataTassativa: e.target.value })
                          }
                          style={{ width: "100%", padding: 8 }}
                        />
                      </label>
                      <label>
                        Descrizione<br />
                        <input
                          value={editIntervento.descrizione}
                          onChange={(e) =>
                            setEditIntervento({ ...editIntervento, descrizione: e.target.value })
                          }
                          style={{ width: "100%", padding: 8 }}
                        />
                      </label>
                      <label>
                        Tipo<br />
                        <select
                          value={editIntervento.incluso ? "INCLUSO" : "EXTRA"}
                          onChange={(e) =>
                            setEditIntervento({
                              ...editIntervento,
                              incluso: e.target.value === "INCLUSO",
                            })
                          }
                          disabled={editIntervento.noteTecniche.includes("Auto-EXTRA")}
                          style={{ width: "100%", padding: 8 }}
                        >
                          <option value="INCLUSO">INCLUSO</option>
                          <option value="EXTRA">EXTRA</option>
                        </select>
                      </label>
                      <label>
                        Ticket n°<br />
                        <input
                          value={editIntervento.ticketNo}
                          onChange={(e) =>
                            setEditIntervento({ ...editIntervento, ticketNo: e.target.value })
                          }
                          style={{ width: "100%", padding: 8 }}
                        />
                      </label>
                      <label>
                        Proforma<br />
                        <input
                          value={editIntervento.proforma}
                          onChange={(e) =>
                            setEditIntervento({ ...editIntervento, proforma: e.target.value })
                          }
                          style={{ width: "100%", padding: 8 }}
                        />
                      </label>
                      <label>
                        Cod. magazzino<br />
                        <input
                          value={editIntervento.codiceMagazzino}
                          onChange={(e) =>
                            setEditIntervento({
                              ...editIntervento,
                              codiceMagazzino: e.target.value,
                            })
                          }
                          style={{ width: "100%", padding: 8 }}
                        />
                      </label>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr 1fr",
                        gap: 10,
                        marginTop: 10,
                      }}
                    >
                      <label>
                        Stato fatturazione<br />
                        <select
                          value={editIntervento.fatturazioneStato}
                          onChange={(e) =>
                            setEditIntervento({
                              ...editIntervento,
                              fatturazioneStato: e.target.value,
                            })
                          }
                          style={{ width: "100%", padding: 8 }}
                        >
                          {FATTURAZIONE_MENU_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Numero fattura<br />
                        <input
                          value={editIntervento.numeroFattura}
                          onChange={(e) =>
                            setEditIntervento({
                              ...editIntervento,
                              numeroFattura: e.target.value,
                            })
                          }
                          disabled={editIntervento.fatturazioneStato !== "FATTURATO"}
                          style={{ width: "100%", padding: 8 }}
                        />
                      </label>
                      <label>
                        Fatturato il<br />
                        <input
                          type="date"
                          value={editIntervento.fatturatoIl}
                          onChange={(e) =>
                            setEditIntervento({
                              ...editIntervento,
                              fatturatoIl: e.target.value,
                            })
                          }
                          disabled={editIntervento.fatturazioneStato !== "FATTURATO"}
                          style={{ width: "100%", padding: 8 }}
                        />
                      </label>
                      {editIntervento.statoIntervento !== "CHIUSO" && (
                        <div style={{ gridColumn: "1 / span 3", fontSize: 12, opacity: 0.7 }}>
                          Intervento aperto: la fatturazione verrà completata alla chiusura.
                        </div>
                      )}
                      <label>
                        Dettaglio intervento<br />
                        <textarea
                          value={editIntervento.note}
                          onChange={(e) =>
                            setEditIntervento({ ...editIntervento, note: e.target.value })
                          }
                          rows={3}
                          style={{ width: "100%", padding: 8 }}
                        />
                      </label>
                    </div>

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => setEditInterventoId(null)}
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
                        onClick={saveEditIntervento}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #111",
                          background: "#111",
                          color: "white",
                        }}
                      >
                        Salva modifiche
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {expandedInterventoId && (
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
          onClick={() => setExpandedInterventoId(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const i = interventi.find((x) => x.id === expandedInterventoId);
              if (!i) return null;
              const files = interventoFilesById.get(i.id) || [];
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>Dettaglio intervento</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {i.data ? new Date(i.data).toLocaleDateString() : "—"} ·{" "}
                        {i.checklist?.nome_checklist ?? i.checklist_id?.slice(0, 8) ?? "—"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedInterventoId(null)}
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

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Descrizione</div>
                    <div>{i.descrizione}</div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Dettaglio</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{i.note || "—"}</div>
                    {i.note_tecniche && (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                        Note tecniche: {i.note_tecniche}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Allegati</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="file"
                        multiple
                        onChange={(e) =>
                          setInterventoUploadFiles((prev) => ({
                            ...prev,
                            [i.id]: e.target.files ? Array.from(e.target.files) : [],
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => uploadInterventoFiles(i.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #111",
                          background: "#111",
                          color: "white",
                          cursor: "pointer",
                        }}
                      >
                        Carica file
                      </button>
                    </div>

                    {files.length ? (
                      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                        {files.map((f) => (
                          <div
                            key={f.id}
                            style={{
                              border: "1px solid #eee",
                              borderRadius: 10,
                              padding: 8,
                              fontSize: 12,
                            }}
                          >
                            {isImageFile(f.filename) && interventoFileUrls[f.id] ? (
                              <img
                                src={interventoFileUrls[f.id]}
                                alt={f.filename}
                                style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 6 }}
                              />
                            ) : (
                              <div
                                style={{
                                  height: 90,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "#f3f4f6",
                                  borderRadius: 6,
                                }}
                              >
                                FILE
                              </div>
                            )}
                            <div style={{ marginTop: 6, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {f.filename}
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                              <button
                                type="button"
                                onClick={() => openInterventoFile(f)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #ddd",
                                  background: "white",
                                }}
                              >
                                Apri
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteInterventoFile(f)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #dc2626",
                                  background: "white",
                                  color: "#dc2626",
                                }}
                              >
                                Elimina
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                        Nessun allegato
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {closeInterventoId && (
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
          onClick={() => setCloseInterventoId(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Chiudi intervento</div>
              <button
                type="button"
                onClick={() => setCloseInterventoId(null)}
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

            {closeError && (
              <div style={{ marginTop: 8, color: "crimson", fontSize: 12 }}>{closeError}</div>
            )}

            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", marginBottom: 10 }}>
                Esito fatturazione<br />
                <select
                  value={closeEsito}
                  onChange={(e) => setCloseEsito(e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">—</option>
                  {FATTURAZIONE_MENU_OPTIONS.filter((opt) => opt !== "FATTURATO").map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 10 }}>
                Note (opzionale)<br />
                <textarea
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setCloseInterventoId(null)}
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
                onClick={confirmCloseIntervento}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                }}
              >
                Conferma chiusura
              </button>
            </div>
          </div>
        </div>
      )}

      {alertInterventoId && (
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
          onClick={() => setAlertInterventoId(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Invia alert fattura</div>
              <button
                type="button"
                onClick={() => setAlertInterventoId(null)}
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
              <label style={{ display: "block", marginBottom: 10 }}>
                Destinatario<br />
                <select
                  value={alertDestinatarioId}
                  onChange={(e) => setAlertDestinatarioId(e.target.value)}
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
              </label>
              {getAlertRecipients().length === 0 && (
                <div style={{ marginTop: -6, marginBottom: 10, fontSize: 12, color: "#b91c1c" }}>
                  Nessun destinatario con Alert ON + email valida
                </div>
              )}
              <label style={{ display: "block", marginBottom: 10 }}>
                Messaggio (opzionale)<br />
                <textarea
                  value={alertMessaggio}
                  onChange={(e) => setAlertMessaggio(e.target.value)}
                  rows={4}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={alertSendEmail}
                  onChange={(e) => setAlertSendEmail(e.target.checked)}
                />
                Invia email
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setAlertInterventoId(null)}
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
                onClick={sendInterventoAlert}
                disabled={sending || !alertDestinatarioId}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  opacity: sending || !alertDestinatarioId ? 0.6 : 1,
                }}
              >
                {sending ? "Invio..." : "Invia"}
              </button>
            </div>
            {sendErr && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
                {sendErr}
              </div>
            )}
            {sendOk && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#166534" }}>
                {sendOk}
              </div>
            )}
          </div>
        </div>
      )}

      {editScadenzaOpen && editScadenzaForm && (
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
          onClick={() => setEditScadenzaOpen(false)}
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
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                Modifica {editScadenzaForm.tipo}
              </div>
              <button
                type="button"
                onClick={() => setEditScadenzaOpen(false)}
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

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label>
                Scadenza<br />
                <input
                  type="date"
                  value={editScadenzaForm.scadenza || ""}
                  onChange={(e) =>
                    setEditScadenzaForm({ ...editScadenzaForm, scadenza: e.target.value })
                  }
                  style={{ width: "100%", padding: 8 }}
                />
              </label>

              {editScadenzaForm.tipo === "SAAS" && (
                <label>
                  Piano<br />
                  <input
                    value={editScadenzaForm.saas_piano || "—"}
                    readOnly
                    style={{ width: "100%", padding: 8, background: "#f9fafb" }}
                  />
                </label>
              )}
              {editScadenzaForm.tipo === "SAAS_ULTRA" && (
                <label>
                  Piano ULTRA<br />
                  <input
                    value={editScadenzaForm.saas_piano || "—"}
                    readOnly
                    style={{ width: "100%", padding: 8, background: "#f9fafb" }}
                  />
                </label>
              )}

              {editScadenzaForm.tipo === "LICENZA" && (
                <>
                  <label>
                    Classe voce<br />
                    <select
                      value={editScadenzaForm.licenza_class}
                      onChange={(e) =>
                        setEditScadenzaForm({
                          ...editScadenzaForm,
                          licenza_class: (e.target.value as "LICENZA" | "GARANZIA") || "LICENZA",
                        })
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="LICENZA">LICENZA</option>
                      <option value="GARANZIA">GARANZIA (converte questa voce)</option>
                    </select>
                  </label>
                  <label>
                    Tipo / Piano<br />
                    <input
                      value={editScadenzaForm.licenza_tipo}
                      onChange={(e) =>
                        setEditScadenzaForm({ ...editScadenzaForm, licenza_tipo: e.target.value })
                      }
                      disabled={editScadenzaForm.licenza_class === "GARANZIA"}
                      style={{
                        width: "100%",
                        padding: 8,
                        background:
                          editScadenzaForm.licenza_class === "GARANZIA" ? "#f9fafb" : "white",
                      }}
                    />
                  </label>
                  {editScadenzaForm.licenza_class === "GARANZIA" && (
                    <div style={{ fontSize: 12, color: "#92400e" }}>
                      Al salvataggio la licenza verrà rimossa e sarà impostata la scadenza garanzia sul progetto.
                    </div>
                  )}
                  <label>
                    Stato<br />
                    <select
                      value={editScadenzaForm.stato}
                      onChange={(e) =>
                        setEditScadenzaForm({ ...editScadenzaForm, stato: e.target.value })
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      {LICENZA_STATI.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Fornitore<br />
                    <input
                      value={editScadenzaForm.fornitore}
                      onChange={(e) =>
                        setEditScadenzaForm({ ...editScadenzaForm, fornitore: e.target.value })
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                  <label>
                    Intestato a<br />
                    <input
                      value={editScadenzaForm.intestato_a}
                      onChange={(e) =>
                        setEditScadenzaForm({ ...editScadenzaForm, intestato_a: e.target.value })
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                  <label>
                    Note<br />
                    <input
                      value={editScadenzaForm.note}
                      onChange={(e) =>
                        setEditScadenzaForm({ ...editScadenzaForm, note: e.target.value })
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                </>
              )}

              {editScadenzaForm.tipo === "TAGLIANDO" && (
                <>
                  <label>
                    Stato<br />
                    <select
                      value={editScadenzaForm.stato}
                      onChange={(e) =>
                        setEditScadenzaForm({ ...editScadenzaForm, stato: e.target.value })
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      {TAGLIANDO_STATI.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Modalità<br />
                    <select
                      value={editScadenzaForm.modalita}
                      onChange={(e) =>
                        setEditScadenzaForm({ ...editScadenzaForm, modalita: e.target.value })
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="">—</option>
                      {TAGLIANDO_MODALITA.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Note<br />
                    <input
                      value={editScadenzaForm.note}
                      onChange={(e) =>
                        setEditScadenzaForm({ ...editScadenzaForm, note: e.target.value })
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                </>
              )}

              {editScadenzaForm.tipo === "RINNOVO" && (
                <>
                  <label>
                    Stato<br />
                    <select
                      value={editScadenzaForm.stato}
                      onChange={(e) =>
                        setEditScadenzaForm({ ...editScadenzaForm, stato: e.target.value })
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      {RINNOVO_STATI.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Descrizione<br />
                    <input
                      value={editScadenzaForm.descrizione}
                      onChange={(e) =>
                        setEditScadenzaForm({ ...editScadenzaForm, descrizione: e.target.value })
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                </>
              )}

              {editScadenzaForm.tipo === "SAAS" && (
                <label>
                  Note<br />
                  <input
                    value={editScadenzaForm.note}
                    onChange={(e) =>
                      setEditScadenzaForm({ ...editScadenzaForm, note: e.target.value })
                    }
                    style={{ width: "100%", padding: 8 }}
                  />
                </label>
              )}
              {editScadenzaForm.tipo === "SAAS_ULTRA" && (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Modifica solo la data di scadenza.
                </div>
              )}

              {editScadenzaForm.tipo === "GARANZIA" && (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Modifica solo la data di scadenza.
                </div>
              )}
            </div>

            {editScadenzaErr && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
                {editScadenzaErr}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              {["LICENZA", "TAGLIANDO", "RINNOVO", "SAAS_ULTRA", "SAAS", "GARANZIA"].includes(
                editScadenzaForm.tipo
              ) && (
                <button
                  type="button"
                  onClick={deleteScadenzaItemFromEdit}
                  disabled={editScadenzaSaving}
                  style={{
                    marginRight: "auto",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #b91c1c",
                    background: "white",
                    color: "#b91c1c",
                    cursor: "pointer",
                    opacity: editScadenzaSaving ? 0.6 : 1,
                  }}
                >
                  Elimina voce
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditScadenzaOpen(false)}
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
                onClick={saveEditScadenza}
                disabled={editScadenzaSaving}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  opacity: editScadenzaSaving ? 0.6 : 1,
                }}
              >
                {editScadenzaSaving ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  Nessun destinatario con Alert ON + email valida
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

      {rinnoviAlertOpen && (
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
          onClick={() => setRinnoviAlertOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {rinnoviAlertStage === "stage1"
                  ? "Invia avviso rinnovi"
                  : "Invia alert fatturazione rinnovi"}
              </div>
              <button
                type="button"
                onClick={() => setRinnoviAlertOpen(false)}
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
              {(() => {
                const hasTagliandi = rinnoviAlertItems.some((r) => r.source === "tagliandi");
                const hasLicenze = rinnoviAlertItems.some((r) => r.source === "licenze");
                const currentTipo = hasTagliandi && !hasLicenze ? "TAGLIANDO" : hasLicenze ? "LICENZA" : "GENERICO";
                const presets = alertTemplates.filter((t) => {
                  if (t.attivo !== true) return false;
                  if (String(t.trigger || "") !== "MANUALE") return false;
                  const tipo = String(t.tipo || "");
                  return tipo === currentTipo || tipo === "GENERICO";
                });
                if (presets.length === 0) return null;
                return (
                  <label style={{ display: "block", marginBottom: 10 }}>
                    Preset<br />
                    <select
                      value={selectedPresetId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedPresetId(value);
                        const tpl = presets.find(
                          (t) => String(t.id) === value || String(t.codice || "") === value
                        );
                        if (!tpl) return;
                        const ctx = getTemplateContext(rinnoviAlertItems);
                        const subject = applyTemplate(tpl.subject_template || "", ctx);
                        const body = applyTemplate(tpl.body_template || "", ctx);
                        if (subject.trim()) setRinnoviAlertSubject(subject);
                        if (body.trim()) setRinnoviAlertMsg(body);
                      }}
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="">— Seleziona —</option>
                      {presets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.titolo || t.codice || t.id}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                      Seleziona un preset per precompilare il messaggio
                    </div>
                  </label>
                );
              })()}
              <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 12 }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="rinnovi-dest"
                    checked={rinnoviAlertDestMode === "operatore"}
                    onChange={() => setRinnoviAlertDestMode("operatore")}
                  />
                  Operatore
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="rinnovi-dest"
                    checked={rinnoviAlertDestMode === "email"}
                    onChange={() => setRinnoviAlertDestMode("email")}
                  />
                  Email manuale
                </label>
              </div>
              <label style={{ display: "block", marginBottom: 10 }}>
                Destinatario<br />
                {rinnoviAlertDestMode === "operatore" ? (
                  <select
                    value={rinnoviAlertToOperatoreId}
                    onChange={(e) => setRinnoviAlertToOperatoreId(e.target.value)}
                    style={{ width: "100%", padding: 8 }}
                  >
                    <option value="">—</option>
                    {alertOperatori
                      .filter((o) => o.attivo !== false && o.alert_enabled)
                      .map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.nome ?? "—"}
                          {op.ruolo ? ` — ${op.ruolo}` : ""}
                          {op.email ? ` — ${op.email}` : ""}
                        </option>
                      ))}
                  </select>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input
                      placeholder="Email"
                      value={rinnoviAlertManualEmail}
                      onChange={(e) => setRinnoviAlertManualEmail(e.target.value)}
                      style={{ width: "100%", padding: 8 }}
                    />
                    <input
                      placeholder="Nome (opzionale)"
                      value={rinnoviAlertManualName}
                      onChange={(e) => setRinnoviAlertManualName(e.target.value)}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </div>
                )}
              </label>
              <label style={{ display: "block", marginBottom: 10 }}>
                Subject<br />
                <input
                  value={rinnoviAlertSubject}
                  onChange={(e) => setRinnoviAlertSubject(e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
              <label style={{ display: "block", marginBottom: 10 }}>
                Messaggio<br />
                <textarea
                  value={rinnoviAlertMsg}
                  onChange={(e) => setRinnoviAlertMsg(e.target.value)}
                  rows={10}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={rinnoviAlertSendEmail}
                  onChange={(e) => setRinnoviAlertSendEmail(e.target.checked)}
                />
                Invia email
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setRinnoviAlertOpen(false)}
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
                onClick={sendRinnoviAlert}
                disabled={
                  rinnoviAlertSending ||
                  (rinnoviAlertDestMode === "operatore"
                    ? !rinnoviAlertToOperatoreId
                    : !rinnoviAlertManualEmail.trim())
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  opacity:
                    rinnoviAlertSending ||
                    (rinnoviAlertDestMode === "operatore"
                      ? !rinnoviAlertToOperatoreId
                      : !rinnoviAlertManualEmail.trim())
                      ? 0.6
                      : 1,
                }}
              >
                {rinnoviAlertSending ? "Invio..." : "Invia"}
              </button>
            </div>
            {rinnoviAlertErr && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
                {rinnoviAlertErr}
              </div>
            )}
            {rinnoviAlertOk && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#166534" }}>
                {rinnoviAlertOk}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0 }}>PROGETTO del cliente</h2>
        {checklists.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Nessun PROGETTO trovato</div>
        ) : (
          <div style={{ marginTop: 10, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr",
                padding: "10px 12px",
                fontWeight: 800,
                background: "#fafafa",
                borderBottom: "1px solid #eee",
              }}
            >
              <div>Progetto</div>
              <div>Proforma</div>
              <div>Dimensioni</div>
              <div>m2</div>
              <div>Passo</div>
              <div>Tipo impianto</div>
              <div>Date</div>
              <div>Stato</div>
            </div>

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
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr",
                  padding: "10px 12px",
                  borderBottom: "1px solid #f3f4f6",
                  alignItems: "center",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 800 }}>{c.nome_checklist ?? "—"}</div>
                <div>{c.proforma ?? "—"}</div>
                <div>{c.dimensioni ?? "—"}</div>
                <div>
                  {calcM2(c.dimensioni, c.numero_facce) != null
                    ? calcM2(c.dimensioni, c.numero_facce)!.toFixed(2)
                    : "—"}
                </div>
                <div>{c.passo ?? "—"}</div>
                <div>{c.tipo_impianto ?? "—"}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  <div>
                    Prev: {c.data_prevista ? new Date(c.data_prevista).toLocaleDateString() : "—"}
                  </div>
                  <div>
                    Tass: {c.data_tassativa ? new Date(c.data_tassativa).toLocaleDateString() : "—"}
                  </div>
                  <div>
                    Reale:{" "}
                    {c.data_installazione_reale
                      ? new Date(c.data_installazione_reale).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
                <div>{c.stato_progetto ?? "—"}</div>
              </div>
            ))}
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
