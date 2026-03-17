"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import ClientiCombobox from "@/components/ClientiCombobox";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import InterventiBlock from "@/components/InterventiBlock";
import RenewalsAlertModal from "@/components/RenewalsAlertModal";
import RenewalsBlock from "@/components/RenewalsBlock";
import Toast from "@/components/Toast";
import type { InterventoRow } from "@/lib/interventi";
import {
  getDefaultRenewalAlertRule,
  normalizeRenewalAlertRule,
  type RenewalAlertRuleRow,
} from "@/lib/renewalAlertRules";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { dbFrom } from "@/lib/clientDbBroker";
import { storageRemove, storageSignedUrl, storageUpload } from "@/lib/clientStorageApi";
import { sendAlert } from "@/lib/sendAlert";
import { calcM2FromDimensioni } from "@/lib/parseDimensioni";
import {
  isHttpUrl,
  isMissingMagazzinoDriveColumnError,
  splitMagazzinoFields,
} from "@/lib/magazzino";

type Checklist = {
  id: string;
  cliente: string;
  cliente_id: string | null;
  nome_checklist: string;
  proforma: string | null;
  magazzino_importazione: string | null;
  magazzino_drive_url: string | null;
  tipo_saas: string | null;
  saas_tipo: string | null;
  saas_piano: string | null;
  saas_scadenza: string | null;
  saas_stato: string | null;
  saas_note: string | null;
  m2_calcolati: number | null;
  m2_inclusi: number | null;
  m2_allocati: number | null;
  ultra_interventi_illimitati: boolean | null;
  ultra_interventi_inclusi: number | null;
  data_prevista: string | null;
  data_tassativa: string | null;
  tipo_impianto: string | null;
  impianto_indirizzo: string | null;
  impianto_codice: string | null;
  impianto_descrizione: string | null;
  dimensioni: string | null;
  impianto_quantita: number | null;
  numero_facce: number | null;
  passo: string | null;
  note: string | null;
  tipo_struttura: string | null;
  noleggio_vendita: string | null;
  fine_noleggio: string | null;
  mercato: string | null;
  modello: string | null;
  stato_progetto: string | null;
  data_installazione_reale: string | null;
  garanzia_scadenza: string | null;
  created_at: string;
  updated_at: string | null;
  created_by_operatore: string | null;
  updated_by_operatore: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
};

type ChecklistItem = {
  id: string;
  checklist_id: string;
  codice: string | null;
  descrizione: string | null;
  quantita: number | null;
  note: string | null;
  created_at: string;
};

type ChecklistItemRow = {
  id?: string;
  client_id: string;
  codice: string;
  descrizione: string;
  descrizione_custom?: string;
  quantita: string;
  note: string;
  search?: string;
};

type ChecklistTask = {
  id: string;
  sezione: number | string;
  ordine: number | null;
  titolo: string;
  stato: string;
  note: string | null;
  target: string | null;
  task_template_id: string | null;
  updated_at: string | null;
  updated_by_operatore: string | null;
  operatori?: {
    id: string;
    nome: string | null;
  } | null;
};

type CatalogItem = {
  id: string;
  codice: string | null;
  descrizione: string | null;
  tipo: string | null;
  categoria?: string | null;
  attivo: boolean;
};

type Licenza = {
  id: string;
  checklist_id: string;
  tipo: string | null;
  scadenza: string | null;
  stato: string | null;
  note: string | null;
  intestata_a?: string | null;
  ref_univoco?: string | null;
  telefono?: string | null;
  intestatario?: string | null;
  gestore?: string | null;
  fornitore?: string | null;
  created_at: string | null;
};

type Tagliando = {
  id: string;
  checklist_id: string;
  scadenza: string | null;
  stato: string | null;
  modalita: string | null;
  note: string | null;
  created_at: string | null;
};

type NewLicenza = {
  tipo: string;
  scadenza: string;
  note: string;
  intestata_a: string;
  ref_univoco: string;
  telefono: string;
  intestatario: string;
  gestore: string;
  fornitore: string;
};

type ChecklistDocument = {
  id: string;
  checklist_id: string;
  tipo: string | null;
  filename: string;
  storage_path: string;
  uploaded_at: string | null;
  uploaded_by_operatore: string | null;
};

type ChecklistTaskDocument = {
  id: string;
  checklist_id: string;
  task_id: string;
  filename: string;
  storage_path: string;
  uploaded_at: string | null;
  uploaded_by_operatore: string | null;
};

type ChecklistTaskAttachment = {
  id: string;
  entity_id: string | null;
  source: "UPLOAD" | "LINK" | string;
  title: string | null;
  url: string | null;
  storage_path: string | null;
};

type AssetSerial = {
  id: string;
  checklist_id: string;
  tipo: "CONTROLLO" | "MODULO_LED";
  device_code: string | null;
  device_descrizione: string | null;
  seriale: string;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AlertOperatore = {
  id: string;
  nome: string | null;
  email?: string | null;
  attivo: boolean;
  cliente?: string | null;
  ruolo?: string | null;
  alert_enabled: boolean;
  alert_tasks: {
    task_template_ids: string[];
    all_task_status_change: boolean;
    on_checklist_open: boolean;
    allow_manual: boolean;
    allow_automatic: boolean;
    allow_scheduled: boolean;
  };
};

type ContrattoRow = {
  id: string;
  cliente: string;
  piano_codice: string | null;
  scadenza: string | null;
  interventi_annui: number | null;
  illimitati: boolean | null;
  created_at: string | null;
};

type ProjectInterventoForm = {
  data: string;
  data_tassativa: string;
  descrizione: string;
  ticket_no: string;
  incluso: boolean;
  proforma: string;
  codice_magazzino: string;
  fatturazione_stato: string;
  stato_intervento: string;
  note: string;
};

type FormData = {
  cliente: string;
  cliente_id: string;
  nome_checklist: string;
  proforma: string;
  magazzino_importazione: string;
  magazzino_drive_url: string;
  saas_tipo: string | null;
  saas_piano: string | null;
  saas_scadenza: string;
  saas_stato: string;
  saas_note: string;
  data_prevista: string;
  data_tassativa: string;
  tipo_impianto: string;
  impianto_indirizzo: string;
  impianto_codice: string;
  impianto_descrizione: string;
  dimensioni: string;
  impianto_quantita: number;
  numero_facce: number;
  passo: string;
  note: string;
  tipo_struttura: string;
  noleggio_vendita: string;
  fine_noleggio: string;
  mercato: string;
  modello: string;
  stato_progetto: string;
  data_installazione_reale: string;
  garanzia_scadenza: string;
};

type NotificationRule = {
  id?: string;
  checklist_id?: string | null;
  task_template_id: string | null;
  enabled: boolean;
  mode: "AUTOMATICA" | "MANUALE";
  task_title: string;
  target: string;
  recipients: string[]; // extra recipients only
  frequency: "DAILY" | "WEEKDAYS" | "WEEKLY";
  send_time: string;
  timezone: string;
  day_of_week: number | null;
  send_on_create: boolean;
  only_future: boolean;
};

type ProjectRenewalRow = {
  key: string;
  source:
    | "saas"
    | "garanzia"
    | "garanzie"
    | "licenza"
    | "tagliando"
    | "licenze"
    | "tagliandi"
    | "rinnovi";
  recordId: string | null;
  tipo: string;
  riferimento: string;
  scadenza: string | null;
  stato: string | null;
  modalita: string | null;
  note: string | null;
  checklist_id?: string | null;
  item_tipo?: string | null;
};

type ProjectRinnovoRow = {
  id: string;
  checklist_id: string | null;
  item_tipo: string | null;
  scadenza: string | null;
  stato: string | null;
  riferimento: string | null;
  descrizione: string | null;
  note: string | null;
};

type CronoOperativiMeta = {
  fatto?: boolean;
  hidden?: boolean;
  updated_at?: string | null;
  updated_by_operatore?: string | null;
  updated_by_nome?: string | null;
  personale_previsto?: string | null;
  mezzi?: string | null;
  descrizione_attivita?: string | null;
  indirizzo?: string | null;
  orario?: string | null;
  referente_cliente_nome?: string | null;
  referente_cliente_contatto?: string | null;
  commerciale_art_tech_nome?: string | null;
  commerciale_art_tech_contatto?: string | null;
};

type AlertTemplate = {
  id: string;
  codice: string | null;
  titolo: string | null;
  tipo: string | null;
  trigger: string | null;
  subject_template: string | null;
  body_template: string | null;
  attivo: boolean;
};

type AlertStats = {
  n_avvisi: number;
  n_operatore: number;
  n_email_manual: number;
  last_sent_at: string | null;
  last_recipients: string[];
  total_recipients: number;
};

type TaskComment = {
  id: string;
  commento: string;
  created_at: string | null;
  created_by_operatore: string | null;
  created_by_nome: string | null;
};

function toDateInput(value?: string | null) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const it = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (it) return `${it[3]}-${it[2]}-${it[1]}`;
  return "";
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function renderTextOrLink(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  if (!isHttpUrl(raw)) return raw;
  return (
    <a href={raw} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
      {raw}
    </a>
  );
}

function normalizeRuleTargetValue(value?: string | null): string {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return "GENERICA";
  if (raw === "TECNICO SW" || raw === "TECNICO-SW") return "TECNICO_SW";
  if (raw === "ALTRO") return "GENERICA";
  return raw;
}

function isSameClienteOperator(checklistCliente?: string | null, operatoreCliente?: string | null) {
  if (!checklistCliente || !operatoreCliente) return true;
  return String(checklistCliente).trim() === String(operatoreCliente).trim();
}

function isFiniteNumberString(v: string) {
  if (v.trim() === "") return false;
  const n = Number(v);
  return Number.isFinite(n);
}

function isCustomCode(code: string) {
  return code.trim().toUpperCase() === "CUSTOM";
}

function parseNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function getImpiantoSelectValue(
  options: CatalogItem[],
  codice: string,
  descrizione: string
) {
  const code = String(codice || "").trim();
  const desc = String(descrizione || "").trim();
  if (!code) return "";
  const exact = options.find(
    (i) =>
      String(i.codice || "").trim() === code &&
      String(i.descrizione || "").trim() === desc
  );
  if (exact?.id) return exact.id;
  const byCode = options.find((i) => String(i.codice || "").trim() === code);
  return byCode?.id || "";
}

function taskStyle(stato: string) {
  if (stato === "OK") {
    return { background: "#dcfce7", color: "#166534" };
  }
  if (stato === "DA_FARE") {
    return { background: "#fee2e2", color: "#991b1b" };
  }
  if (stato === "NON_NECESSARIO") {
    return { background: "#f3f4f6", color: "#374151" };
  }
  return {};
}

function normalizeCustomCode(code: string) {
  return isCustomCode(code) ? "CUSTOM" : code;
}

function startsWithTecOrSas(value?: string | null) {
  const v = String(value ?? "").trim().toUpperCase();
  return v.startsWith("TEC") || v.startsWith("SAAS");
}

function logSupabaseError(label: string, err: any) {
  const payload = {
    label,
    name: err?.name,
    message: err?.message,
    details: err?.details,
    hint: err?.hint,
    code: err?.code,
    status: err?.status,
    statusText: err?.statusText,
    keys: err ? Object.getOwnPropertyNames(err) : [],
    raw: err,
  };
  console.error("SUPABASE ERROR:", payload);
  const parts = [
    payload.message,
    payload.details ? `details: ${payload.details}` : null,
    payload.hint ? `hint: ${payload.hint}` : null,
    payload.code ? `code: ${payload.code}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function parseLocalDay(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
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

const EMPTY_CRONO_OPERATIVI = {
  personale_previsto: "",
  mezzi: "",
  descrizione_attivita: "",
  indirizzo: "",
  orario: "",
  referente_cliente_nome: "",
  referente_cliente_contatto: "",
  commerciale_art_tech_nome: "",
  commerciale_art_tech_contatto: "",
};

function extractCronoOperativi(meta?: CronoOperativiMeta | null) {
  return {
    personale_previsto: String(meta?.personale_previsto || ""),
    mezzi: String(meta?.mezzi || ""),
    descrizione_attivita: String(meta?.descrizione_attivita || ""),
    indirizzo: String(meta?.indirizzo || ""),
    orario: String(meta?.orario || ""),
    referente_cliente_nome: String(meta?.referente_cliente_nome || ""),
    referente_cliente_contatto: String(meta?.referente_cliente_contatto || ""),
    commerciale_art_tech_nome: String(meta?.commerciale_art_tech_nome || ""),
    commerciale_art_tech_contatto: String(meta?.commerciale_art_tech_contatto || ""),
  };
}

function getExpiryStatus(value?: string | null): "ATTIVA" | "SCADUTA" | "—" {
  const dt = parseLocalDay(value);
  if (!dt) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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
      }}
    >
      {upper}
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

function renderModalitaBadge(value?: string | null) {
  const raw = String(value || "").toUpperCase().trim();
  if (!raw) return "—";
  let bg = "#e5e7eb";
  let color = "#374151";
  if (raw === "INCLUSO") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (raw === "EXTRA") {
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
      {raw}
    </span>
  );
}

function truncateTaskNote(value?: string | null, max = 64) {
  const text = String(value || "").trim();
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function alertKey(tipo?: string | null, checklistId?: string | null, riferimento?: string | null) {
  const t = String(tipo || "NULL").toUpperCase();
  const c = checklistId || "NULL";
  const r = riferimento ?? "NULL";
  return `${t}::${c}::${r}`;
}

function alertKeyForLogRow(row: any) {
  const tipo = String(row?.tipo || "").toUpperCase();
  const checklistId = row?.checklist_id ?? null;
  if (tipo === "TAGLIANDO" || tipo === "LICENZA") {
    return `${tipo}::${checklistId || "NULL"}::${tipo}`;
  }
  return alertKey(tipo, checklistId, row?.riferimento ?? null);
}

function alertKeyForProjectRow(row: ProjectRenewalRow) {
  if (row.source === "tagliando" || row.source === "tagliandi") {
    return `TAGLIANDO::${row.checklist_id || "NULL"}::TAGLIANDO`;
  }
  if (row.source === "licenza" || row.source === "licenze") {
    return `LICENZA::${row.checklist_id || "NULL"}::LICENZA`;
  }
  return alertKey(row.item_tipo ?? row.tipo ?? null, row.checklist_id ?? null, row.riferimento ?? null);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
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
const TAGLIANDO_MODALITA = ["INCLUSO", "EXTRA", "AUTORIZZATO_CLIENTE"];
const RINNOVO_STATI = [
  "DA_AVVISARE",
  "AVVISATO",
  "CONFERMATO",
  "DA_FATTURARE",
  "FATTURATO",
  "NON_RINNOVATO",
];

const ACTIONS_BY_TIPO: Record<
  string,
  { avviso: boolean; conferma: boolean; non_rinnovato: boolean; fattura: boolean }
> = {
  LICENZA: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
  TAGLIANDO: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
  SAAS: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
  GARANZIA: { avviso: true, conferma: true, non_rinnovato: true, fattura: true },
};

function getNextLicenzaScadenza(licenze: Array<{ scadenza?: string | null }>) {
  const dates = licenze
    .map((l) => l.scadenza)
    .filter((d): d is string => Boolean(d));
  if (dates.length === 0) return null;
  return dates.slice().sort((a, b) => String(a).localeCompare(String(b)))[0] ?? null;
}

function saasLabelFromCode(code?: string | null) {
  const raw = (code || "").trim().toUpperCase();
  const map: Record<string, string> = {
    "SAAS-PL": "CARE PLUS",
    "SAAS-PR": "CARE PREMIUM",
    "SAAS-UL": "CARE ULTRA",
    "SAAS-UL-ILL": "CARE ULTRA (illimitato)",
    "SAAS-PR4": "CARE PREMIUM (H4)",
    "SAAS-PR8": "CARE PREMIUM (H8)",
    "SAAS-PR12": "CARE PREMIUM (H12)",
    "SAAS-PR24": "CARE PREMIUM (H24)",
    "SAAS-PR36": "CARE PREMIUM (H36)",
    "SAAS-UL4": "CARE ULTRA",
    "SAAS-UL8": "CARE ULTRA",
    "SAAS-UL12": "CARE ULTRA",
    "SAAS-UL24": "CARE ULTRA",
    "SAAS-UL36": "CARE ULTRA",
    "SAAS-EVTR": "ART TECH EVENT",
    "SAAS-EVTF": "ART TECH EVENT (remoto)",
    "SAAS-EVTO": "ART TECH EVENT (onsite)",
    "SAAS-MON": "MONITORAGGIO REMOTO & ALERT",
    "SAAS-TCK": "TICKETING / HELP DESK",
    "SAAS-SIM": "CONNETTIVITÀ SIM DATI",
    "SAAS-CMS": "LICENZA CMS / SOFTWARE TERZI",
    "SAAS-BKP": "BACKUP / RIPRISTINO",
    "SAAS-RPT": "REPORTISTICA",
    "SAAS-SLA": "SLA RIPRISTINO",
    "SAAS-EXT": "ESTENSIONE GARANZIA",
    "SAAS-CYB": "CYBER / HARDENING",
  };
  return map[raw] ?? null;
}

function ServiceRow({
  label,
  left,
  right,
}: {
  label: string;
  left: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr 140px",
        gap: 12,
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #f1f1f1",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>{label}</div>
      <div>{left}</div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>{right ?? "—"}</div>
    </div>
  );
}

function ServiziBox({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        background: "white",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  view,
  edit,
  isEdit,
}: {
  label: string;
  view: ReactNode;
  edit?: ReactNode;
  isEdit?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: 12,
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid #f1f1f1",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>{label}</div>
      <div>{isEdit && edit !== undefined ? edit : view}</div>
    </div>
  );
}

function getLicenzaStatusLabel(lic: Licenza) {
  return getExpiryStatus(lic.scadenza);
}

export default function ChecklistDetailPage({ params }: { params: any }) {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }
  const mainSectionStyle: CSSProperties = {
    marginTop: 22,
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    background: "white",
  };
  const mainSectionTitleStyle: CSSProperties = {
    margin: 0,
    marginBottom: 10,
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: 0.2,
  };
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [originalData, setOriginalData] = useState<FormData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [dimensioniLocal, setDimensioniLocal] = useState("");
  const [rows, setRows] = useState<ChecklistItemRow[]>([]);
  const [originalRowIds, setOriginalRowIds] = useState<string[]>([]);
  const [tasks, setTasks] = useState<ChecklistTask[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [deviceCatalogItems, setDeviceCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [licenze, setLicenze] = useState<Licenza[]>([]);
  const [projectTagliandi, setProjectTagliandi] = useState<Tagliando[]>([]);
  const [newLicenza, setNewLicenza] = useState<NewLicenza>({
    tipo: "",
    scadenza: "",
    note: "",
    intestata_a: "CLIENTE",
    ref_univoco: "",
    telefono: "",
    intestatario: "",
    gestore: "",
    fornitore: "",
  });
  const [licenzeError, setLicenzeError] = useState<string | null>(null);
  const [editingLicenzaId, setEditingLicenzaId] = useState<string | null>(null);
  const [editingLicenza, setEditingLicenza] = useState<{
    tipo: string;
    scadenza: string;
    note: string;
    stato: "attiva" | "disattivata";
    intestata_a: string;
    ref_univoco: string;
    telefono: string;
    intestatario: string;
    gestore: string;
    fornitore: string;
  } | null>(null);
  const [assetSerials, setAssetSerials] = useState<AssetSerial[]>([]);
  const [serialControlInput, setSerialControlInput] = useState("");
  const [serialControlDeviceCode, setSerialControlDeviceCode] = useState("");
  const [serialControlDeviceDescrizione, setSerialControlDeviceDescrizione] = useState("");
  const [serialModuleInput, setSerialModuleInput] = useState("");
  const [serialModuleDeviceCode, setSerialModuleDeviceCode] = useState("");
  const [serialModuleDeviceDescrizione, setSerialModuleDeviceDescrizione] = useState("");
  const [serialControlNote, setSerialControlNote] = useState("");
  const [serialModuleNote, setSerialModuleNote] = useState("");
  const [serialsError, setSerialsError] = useState<string | null>(null);
  const [serialUsageOpen, setSerialUsageOpen] = useState<{
    tipo: "CONTROLLO" | "MODULO_LED";
    seriale: string;
  } | null>(null);
  const [serialUsageRows, setSerialUsageRows] = useState<
    { checklist_id: string; cliente: string | null; nome_checklist: string | null }[]
  >([]);
  const [documents, setDocuments] = useState<ChecklistDocument[]>([]);
  const [taskDocuments, setTaskDocuments] = useState<ChecklistTaskDocument[]>([]);
  const [taskAttachmentsById, setTaskAttachmentsById] = useState<
    Map<string, ChecklistTaskAttachment[]>
  >(new Map());
  const [taskFilesTask, setTaskFilesTask] = useState<ChecklistTask | null>(null);
  const [taskNotesTask, setTaskNotesTask] = useState<ChecklistTask | null>(null);
  const [taskCommentsById, setTaskCommentsById] = useState<Record<string, TaskComment[]>>({});
  const [taskNoteDraftById, setTaskNoteDraftById] = useState<Record<string, string>>({});
  const [taskNotesLoading, setTaskNotesLoading] = useState(false);
  const [taskNoteSavingTaskId, setTaskNoteSavingTaskId] = useState<string | null>(null);
  const [taskNotesError, setTaskNotesError] = useState<string | null>(null);
  const [taskDocFile, setTaskDocFile] = useState<File | null>(null);
  const [taskDocError, setTaskDocError] = useState<string | null>(null);
  const [docType, setDocType] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentOperatoreId, setCurrentOperatoreId] = useState<string>("");
  const [operatoriMap, setOperatoriMap] = useState<Map<string, string>>(new Map());
  const [alertOperatori, setAlertOperatori] = useState<AlertOperatore[]>([]);
  const [alertTask, setAlertTask] = useState<ChecklistTask | null>(null);
  const [alertDestinatarioId, setAlertDestinatarioId] = useState("");
  const [alertMessaggio, setAlertMessaggio] = useState("");
  const [alertTemplates, setAlertTemplates] = useState<AlertTemplate[]>([]);
  const [alertSelectedPresetId, setAlertSelectedPresetId] = useState("");
  const [alertSendEmail, setAlertSendEmail] = useState(true);
  const [alertManualMode, setAlertManualMode] = useState(false);
  const [alertManualEmail, setAlertManualEmail] = useState("");
  const [alertManualName, setAlertManualName] = useState("");
  const [alertToCliente, setAlertToCliente] = useState(false);
  const [checklistClienteEmail, setChecklistClienteEmail] = useState<string | null>(null);
  const [checklistCustomerDeliveryMode, setChecklistCustomerDeliveryMode] = useState<
    "AUTO_CLIENTE" | "MANUALE_INTERNO"
  >("AUTO_CLIENTE");
  const [alertFormError, setAlertFormError] = useState<string | null>(null);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);
  const [ruleTask, setRuleTask] = useState<ChecklistTask | null>(null);
  const [ruleDraft, setRuleDraft] = useState<NotificationRule | null>(null);
  const [ruleRecipientsInput, setRuleRecipientsInput] = useState("");
  const [ruleAutoRecipients, setRuleAutoRecipients] = useState<string[]>([]);
  const [ruleEffectiveRecipients, setRuleEffectiveRecipients] = useState<string[]>([]);
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleGlobal, setRuleGlobal] = useState<NotificationRule | null>(null);
  const [ruleOverride, setRuleOverride] = useState<NotificationRule | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [lastAlertByTask, setLastAlertByTask] = useState<
    Map<string, { toOperatoreId: string; createdAt: string }>
  >(new Map());
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contrattoUltra, setContrattoUltra] = useState<ContrattoRow | null>(null);
  const [contrattoUltraNome, setContrattoUltraNome] = useState<string | null>(null);
  const [interventiInclusiUsati, setInterventiInclusiUsati] = useState<number>(0);
  const [projectInterventi, setProjectInterventi] = useState<InterventoRow[]>([]);
  const [projectTagliando, setProjectTagliando] = useState<{
    scadenza: string;
    fatturazione: string;
    note: string;
  }>({ scadenza: "", fatturazione: "INCLUSO", note: "" });
  const [projectRinnovi, setProjectRinnovi] = useState<ProjectRinnovoRow[]>([]);
  const [projectTagliandoSaving, setProjectTagliandoSaving] = useState(false);
  const [projectRenewalEdit, setProjectRenewalEdit] = useState<{
    row: ProjectRenewalRow;
    scadenza: string;
    stato: string;
    modalita: string;
    note: string;
    descrizione?: string;
    saas_piano?: string;
    licenza_class?: "LICENZA" | "GARANZIA";
    licenza_tipo?: string;
    fornitore?: string;
    intestato_a?: string;
  } | null>(null);
  const [projectRenewalEditSaving, setProjectRenewalEditSaving] = useState(false);
  const [projectInterventiError, setProjectInterventiError] = useState<string | null>(null);
  const [projectInterventiNotice, setProjectInterventiNotice] = useState<string | null>(null);
  const [projectAlertStatsMap, setProjectAlertStatsMap] = useState<Map<string, AlertStats>>(new Map());
  const [projectRinnoviAlertOpen, setProjectRinnoviAlertOpen] = useState(false);
  const [projectRinnoviAlertStage, setProjectRinnoviAlertStage] = useState<"stage1" | "stage2">("stage1");
  const [projectRinnoviAlertToOperatoreId, setProjectRinnoviAlertToOperatoreId] = useState("");
  const [projectRinnoviAlertSubject, setProjectRinnoviAlertSubject] = useState("");
  const [projectRinnoviAlertMsg, setProjectRinnoviAlertMsg] = useState("");
  const [projectRinnoviAlertSendEmail, setProjectRinnoviAlertSendEmail] = useState(true);
  const [projectRinnoviAlertItems, setProjectRinnoviAlertItems] = useState<ProjectRenewalRow[]>([]);
  const [projectRinnoviAlertDestMode, setProjectRinnoviAlertDestMode] = useState<"operatore" | "email">("operatore");
  const [projectRinnoviAlertTrigger, setProjectRinnoviAlertTrigger] = useState<"MANUALE" | "AUTOMATICO">("MANUALE");
  const [projectRinnoviAlertToArtTech, setProjectRinnoviAlertToArtTech] = useState(true);
  const [projectRinnoviAlertToCliente, setProjectRinnoviAlertToCliente] = useState(false);
  const [projectRinnoviAlertManualEmail, setProjectRinnoviAlertManualEmail] = useState("");
  const [projectRinnoviAlertManualName, setProjectRinnoviAlertManualName] = useState("");
  const [projectRinnoviAlertSending, setProjectRinnoviAlertSending] = useState(false);
  const [projectRinnoviAlertErr, setProjectRinnoviAlertErr] = useState<string | null>(null);
  const [projectRinnoviAlertOk, setProjectRinnoviAlertOk] = useState<string | null>(null);
  const [projectRinnoviAlertRule, setProjectRinnoviAlertRule] = useState<RenewalAlertRuleRow | null>(null);
  const [projectRinnoviAlertRuleLoading, setProjectRinnoviAlertRuleLoading] = useState(false);
  const [projectRinnoviAlertRuleSaving, setProjectRinnoviAlertRuleSaving] = useState(false);
  const [cronoOperativiMeta, setCronoOperativiMeta] = useState<CronoOperativiMeta | null>(null);
  const [cronoOperativiForm, setCronoOperativiForm] = useState(EMPTY_CRONO_OPERATIVI);
  const [cronoOperativiSaving, setCronoOperativiSaving] = useState(false);
  const [cronoOperativiError, setCronoOperativiError] = useState<string | null>(null);
  const [cronoOperativiNotice, setCronoOperativiNotice] = useState<string | null>(null);
  const [rinnoviFilterDaAvvisare, setRinnoviFilterDaAvvisare] = useState(false);
  const [rinnoviFilterScaduti, setRinnoviFilterScaduti] = useState(false);
  const [rinnoviFilterDaFatturare, setRinnoviFilterDaFatturare] = useState(false);
  const [projectInterventiExpandedId, setProjectInterventiExpandedId] = useState<string | null>(null);
  const [projectInterventoEditId, setProjectInterventoEditId] = useState<string | null>(null);
  const [projectInterventoEditForm, setProjectInterventoEditForm] = useState<ProjectInterventoForm | null>(null);
  const [projectInterventoAttachmentCounts, setProjectInterventoAttachmentCounts] = useState<Map<string, number>>(new Map());
  const [projectInterventoFiles, setProjectInterventoFiles] = useState<File[]>([]);
  const [projectInterventoAlertId, setProjectInterventoAlertId] = useState<string | null>(null);
  const [projectInterventoAlertToOperatoreId, setProjectInterventoAlertToOperatoreId] = useState("");
  const [projectInterventoAlertMsg, setProjectInterventoAlertMsg] = useState("");
  const [projectInterventoAlertSendEmail, setProjectInterventoAlertSendEmail] = useState(true);
  const [projectInterventoAlertSending, setProjectInterventoAlertSending] = useState(false);
  const [projectInterventoAlertErr, setProjectInterventoAlertErr] = useState<string | null>(null);
  const [projectInterventoAlertOk, setProjectInterventoAlertOk] = useState<string | null>(null);
  const [projectInterventoBulkOpen, setProjectInterventoBulkOpen] = useState(false);
  const [projectInterventoBulkToOperatoreId, setProjectInterventoBulkToOperatoreId] = useState("");
  const [projectInterventoBulkMsg, setProjectInterventoBulkMsg] = useState("");
  const [projectInterventoBulkSendEmail, setProjectInterventoBulkSendEmail] = useState(true);
  const [projectInterventoBulkSending, setProjectInterventoBulkSending] = useState(false);
  const [projectInterventoBulkErr, setProjectInterventoBulkErr] = useState<string | null>(null);
  const [projectInterventoBulkOk, setProjectInterventoBulkOk] = useState<string | null>(null);
  const [projectInterventoBulkLastSentAt, setProjectInterventoBulkLastSentAt] = useState<string | null>(null);
  const [projectInterventoBulkLastToOperatoreId, setProjectInterventoBulkLastToOperatoreId] = useState<string | null>(null);
  const [projectInterventoBulkLastMessage, setProjectInterventoBulkLastMessage] = useState<string | null>(null);
  const [projectInterventoBulkPreviewOpen, setProjectInterventoBulkPreviewOpen] = useState(false);
  const [projectCloseInterventoId, setProjectCloseInterventoId] = useState<string | null>(null);
  const [projectCloseEsito, setProjectCloseEsito] = useState("");
  const [projectCloseNote, setProjectCloseNote] = useState("");
  const [projectCloseError, setProjectCloseError] = useState<string | null>(null);
  const [newProjectIntervento, setNewProjectIntervento] = useState<ProjectInterventoForm>({
    data: "",
    data_tassativa: "",
    descrizione: "",
    ticket_no: "",
    incluso: true,
    proforma: "",
    codice_magazzino: "",
    fatturazione_stato: "DA_FATTURARE",
    stato_intervento: "APERTO",
    note: "",
  });
  const isPerfEnabled = () =>
    process.env.NODE_ENV !== "production" ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perf"));
  const perfRef = useRef({
    mountDbCalls: 0,
    mountFetchCalls: 0,
    mountActive: false,
    loadSeq: 0,
  });

  const perfCountDb = (label: string) => {
    if (!isPerfEnabled()) return;
    if (perfRef.current.mountActive) perfRef.current.mountDbCalls += 1;
    console.count(`[perf][checklist][db] ${label}`);
  };

  const perfCountFetch = (label: string) => {
    if (!isPerfEnabled()) return;
    if (perfRef.current.mountActive) perfRef.current.mountFetchCalls += 1;
    console.count(`[perf][checklist][fetch] ${label}`);
  };

  function showToast(message: string, variant: "success" | "error" = "success", duration = 2500) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, variant });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }

  function briefError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err ?? "Errore invio");
    return msg.length > 80 ? `${msg.slice(0, 77)}...` : msg;
  }

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function applyTemplate(input: string, ctx: Record<string, string>) {
    return input.replace(/\{(\w+)\}/g, (_, key) => ctx[key] ?? "");
  }

  function normalizeSerial(input: string) {
    return input.trim().toUpperCase().replace(/\s+/g, " ");
  }

  async function db<T = any>(payload: {
    table: string;
    op: "select" | "insert" | "update" | "delete";
    select?: string;
    filter?: Record<string, string | number | boolean | null>;
    order?: Array<{ col: string; asc: boolean }>;
    limit?: number;
    payload?: Record<string, any>;
  }): Promise<{ data: T | null; error: { message: string } | null }> {
    perfCountDb(`${payload.table}.${payload.op}`);
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || json?.ok === false) {
        return { data: null, error: { message: String(json?.error || "DB broker error") } };
      }
      return { data: (json?.data ?? null) as T, error: null };
    } catch (e: any) {
      return { data: null, error: { message: String(e?.message || "DB broker request failed") } };
    }
  }

  // TODO migrate writes: keep direct client writes temporarily to reduce risk of regressions.

  async function addSerial(
    tipo: "CONTROLLO" | "MODULO_LED",
    raw: string,
    noteRaw: string,
    deviceCodeRaw?: string,
    deviceDescrizioneRaw?: string
  ) {
    if (!id) return;
    const seriale = normalizeSerial(raw);
    if (!seriale) {
      setSerialsError("Inserisci un seriale valido.");
      return;
    }
    if (assetSerials.some((s) => s.tipo === tipo && s.seriale === seriale)) {
      setSerialsError("Seriale già presente per questo tipo.");
      return;
    }
    setSerialsError(null);
    const deviceCode = String(deviceCodeRaw ?? "").trim();
    const deviceDescrizione = String(deviceDescrizioneRaw ?? "").trim();
    const { data, error: err } = await dbFrom("asset_serials")
      .insert({
        checklist_id: id,
        tipo,
        device_code: deviceCode || null,
        device_descrizione: deviceDescrizione || null,
        seriale,
        note: noteRaw?.trim() || null,
      })
      .select("*")
      .single();
    if (err) {
      const code = (err as any)?.code;
      const msg =
        tipo === "CONTROLLO" && code === "23505"
          ? "Seriale CONTROLLO già associato ad un altro impianto/progetto."
          : err.message;
      setSerialsError(msg);
      return;
    }
    setAssetSerials((prev) => [...prev, data as AssetSerial]);
    if (tipo === "CONTROLLO") setSerialControlInput("");
    if (tipo === "CONTROLLO") setSerialControlDeviceCode("");
    if (tipo === "CONTROLLO") setSerialControlDeviceDescrizione("");
    if (tipo === "CONTROLLO") setSerialControlNote("");
    if (tipo === "MODULO_LED") setSerialModuleInput("");
    if (tipo === "MODULO_LED") setSerialModuleDeviceCode("");
    if (tipo === "MODULO_LED") setSerialModuleDeviceDescrizione("");
    if (tipo === "MODULO_LED") setSerialModuleNote("");
    showToast("Seriale aggiunto");
  }

  async function removeSerial(serial: AssetSerial) {
    const { error: err } = await dbFrom("asset_serials").delete().eq("id", serial.id);
    if (err) {
      setSerialsError(err.message);
      return;
    }
    setAssetSerials((prev) => prev.filter((s) => s.id !== serial.id));
    showToast("Seriale rimosso");
  }

  async function openSerialUsage(tipo: "CONTROLLO" | "MODULO_LED", seriale: string) {
    if (!id) return;
    setSerialUsageOpen({ tipo, seriale });
    const { data, error: err } = await db<any[]>({
      table: "asset_serials",
      op: "select",
      select: "checklist_id",
      filter: { tipo, seriale },
    });
    if (err) {
      setSerialUsageRows([]);
      return;
    }
    const checklistIds = Array.from(
      new Set((data || []).map((r: any) => r.checklist_id).filter(Boolean))
    ) as string[];
    const others = checklistIds.filter((cid) => cid !== id);
    if (others.length === 0) {
      setSerialUsageRows([]);
      return;
    }
    const rows = await Promise.all(
      others.map(async (cid) => {
        const res = await db<any[]>({
          table: "checklists",
          op: "select",
          select: "id, cliente, nome_checklist",
          filter: { id: cid },
          limit: 1,
        });
        return res.data?.[0] ?? null;
      })
    );
    const checklistsData = rows.filter(Boolean);
    setSerialUsageRows(
      (checklistsData || []).map((r: any) => ({
        checklist_id: r.id,
        cliente: r.cliente ?? null,
        nome_checklist: r.nome_checklist ?? null,
      }))
    );
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setDimensioniLocal(formData?.dimensioni ?? "");
  }, [formData?.dimensioni]);

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

function buildFormData(c: Checklist): FormData {
    const magazzino = splitMagazzinoFields(
      c.magazzino_importazione,
      c.magazzino_drive_url
    );
    return {
      cliente: asText(c.cliente),
      cliente_id: asText(c.cliente_id),
      nome_checklist: asText(c.nome_checklist),
      proforma: asText(c.proforma),
      magazzino_importazione: magazzino.codice,
      magazzino_drive_url: magazzino.driveUrl,
      saas_tipo: asText(c.saas_tipo),
      saas_piano: asText(c.saas_piano),
      saas_scadenza: toDateInput(c.saas_scadenza),
      saas_stato: asText(c.saas_stato),
      saas_note: asText(c.saas_note),
      data_prevista: toDateInput(c.data_prevista),
      data_tassativa: toDateInput(c.data_tassativa),
      tipo_impianto: asText(c.tipo_impianto),
      impianto_indirizzo: asText(c.impianto_indirizzo),
      impianto_codice: asText(c.impianto_codice),
      impianto_descrizione: asText(c.impianto_descrizione),
      dimensioni: asText(c.dimensioni),
      impianto_quantita:
        Number.isFinite(Number(c.impianto_quantita)) && Number(c.impianto_quantita) > 0
          ? Number(c.impianto_quantita)
          : 1,
      numero_facce: Number(c.numero_facce ?? 1) > 1 ? 2 : 1,
      passo: asText(c.passo),
      note: asText(c.note),
      tipo_struttura: asText(c.tipo_struttura),
      noleggio_vendita: asText(c.noleggio_vendita),
      fine_noleggio: toDateInput(c.fine_noleggio),
      mercato: asText(c.mercato),
      modello: asText(c.modello),
      stato_progetto: asText(c.stato_progetto) || "IN_CORSO",
      data_installazione_reale: toDateInput(c.data_installazione_reale),
      garanzia_scadenza: toDateInput(c.garanzia_scadenza),
    };
  }

  function buildProjectInterventoForm(it: InterventoRow): ProjectInterventoForm {
    return {
      data: toDateInput(it.data),
      data_tassativa: toDateInput(it.data_tassativa),
      descrizione: String(it.descrizione || ""),
      ticket_no: String(it.ticket_no || ""),
      incluso: Boolean(it.incluso),
      proforma: String(it.proforma || ""),
      codice_magazzino: String(it.codice_magazzino || ""),
      fatturazione_stato: String(it.fatturazione_stato || "DA_FATTURARE"),
      stato_intervento: String(it.stato_intervento || "APERTO"),
      note: String(it.note || ""),
    };
  }

  async function loadProjectInterventi(checklistId: string) {
    let res: any = await db<any[]>({
      table: "saas_interventi",
      op: "select",
      select:
        "id, cliente, checklist_id, data, data_tassativa, ticket_no, descrizione, incluso, proforma, codice_magazzino, fatturazione_stato, stato_intervento, esito_fatturazione, numero_fattura, fatturato_il, note, note_tecniche, created_at",
      filter: { checklist_id: checklistId },
      order: [{ col: "data", asc: false }],
    });

    if (res.error && String(res.error.message || "").toLowerCase().includes("data_tassativa")) {
      res = await db<any[]>({
        table: "saas_interventi",
        op: "select",
        select:
          "id, cliente, checklist_id, data, ticket_no, descrizione, incluso, proforma, codice_magazzino, fatturazione_stato, stato_intervento, esito_fatturazione, numero_fattura, fatturato_il, note, note_tecniche, created_at",
        filter: { checklist_id: checklistId },
        order: [{ col: "data", asc: false }],
      });
      if (!res.error) {
        res.data = ((res.data || []) as any[]).map((r) => ({ ...r, data_tassativa: null }));
      }
    }
    if (res.error && String(res.error.message || "").toLowerCase().includes("ticket_no")) {
      res = await db<any[]>({
        table: "saas_interventi",
        op: "select",
        select:
          "id, cliente, checklist_id, data, data_tassativa, descrizione, incluso, proforma, codice_magazzino, fatturazione_stato, stato_intervento, esito_fatturazione, numero_fattura, fatturato_il, note, note_tecniche, created_at",
        filter: { checklist_id: checklistId },
        order: [{ col: "data", asc: false }],
      });
      if (!res.error) {
        res.data = ((res.data || []) as any[]).map((r) => ({ ...r, ticket_no: null }));
      }
    }
    if (res.error) throw new Error(res.error.message || "Errore caricamento interventi progetto");
    return ((res.data || []) as InterventoRow[]).filter(
      (row) => String(row?.checklist_id || "") === String(checklistId)
    );
  }

  async function loadInterventoRowAttachmentCounts(rows: InterventoRow[]) {
    const ids = rows.map((row) => row.id).filter(Boolean);
    if (ids.length === 0) {
      setProjectInterventoAttachmentCounts(new Map());
      return;
    }
    const { data, error } = await dbFrom("attachments")
      .select("entity_id")
      .eq("entity_type", "INTERVENTO")
      .in("entity_id", ids);
    if (error) {
      console.error("Errore caricamento conteggio allegati interventi", error);
      return;
    }
    const counts = new Map<string, number>();
    for (const row of (data || []) as Array<{ entity_id: string | null }>) {
      const key = String(row.entity_id || "");
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    setProjectInterventoAttachmentCounts(counts);
  }

  async function loadTaskAttachmentCounts(taskIds: string[]) {
    const ids = Array.from(new Set(taskIds.filter(Boolean)));
    if (ids.length === 0) {
      setTaskAttachmentsById(new Map());
      return;
    }
    const { data, error } = await dbFrom("attachments")
      .select("id, entity_id, source, title, url, storage_path")
      .eq("entity_type", "CHECKLIST_TASK")
      .in("entity_id", ids);
    if (error) {
      console.error("Errore caricamento conteggio allegati task", error);
      return;
    }
    const rowsByTaskId = new Map<string, ChecklistTaskAttachment[]>();
    for (const row of (data || []) as ChecklistTaskAttachment[]) {
      const key = String(row.entity_id || "");
      if (!key) continue;
      const bucket = rowsByTaskId.get(key) || [];
      bucket.push(row);
      rowsByTaskId.set(key, bucket);
    }
    setTaskAttachmentsById(rowsByTaskId);
  }

  function buildChecklistTaskAttachmentKey(
    item:
      | ChecklistTaskAttachment
      | ChecklistTaskDocument
      | { url?: string | null; title?: string | null; storage_path?: string | null; filename?: string | null }
  ) {
    const normalize = (value: string | null | undefined) => String(value || "").trim().toLowerCase();
    const storagePath = normalize("storage_path" in item ? item.storage_path : null);
    if (storagePath) return `upload:${storagePath}`;
    const url = normalize("url" in item ? item.url : null);
    if (url) return `link:${url}`;
    const title = normalize("title" in item ? item.title : "filename" in item ? item.filename : null);
    if (title) return `title:${title}`;
    return "";
  }

  function getChecklistTaskAttachmentCount(taskId: string) {
    const uniqueKeys = new Set<string>();
    const modernRows = taskAttachmentsById.get(taskId) || [];
    const legacyRows = taskDocuments.filter((row) => row.task_id === taskId);

    for (const row of modernRows) {
      const key = buildChecklistTaskAttachmentKey(row);
      if (key) uniqueKeys.add(key);
    }

    for (const row of legacyRows) {
      const key = buildChecklistTaskAttachmentKey(row);
      if (key) uniqueKeys.add(key);
    }

    return uniqueKeys.size;
  }

  async function addInterventoRow() {
    if (!id || !checklist) return;
    const descrizione = newProjectIntervento.descrizione.trim();
    const magazzino = splitMagazzinoFields(
      checklist.magazzino_importazione,
      checklist.magazzino_drive_url
    );
    if (!descrizione) {
      setProjectInterventiError("Inserisci descrizione intervento.");
      return;
    }
    setProjectInterventiError(null);
    const payload = {
      cliente: checklist.cliente,
      checklist_id: id,
      data: newProjectIntervento.data || new Date().toISOString().slice(0, 10),
      data_tassativa: newProjectIntervento.data_tassativa || null,
      ticket_no: newProjectIntervento.ticket_no.trim() || null,
      descrizione,
      tipo: descrizione,
      incluso: Boolean(newProjectIntervento.incluso),
      proforma: newProjectIntervento.proforma.trim() || null,
      codice_magazzino: newProjectIntervento.codice_magazzino.trim() || null,
      fatturazione_stato: newProjectIntervento.fatturazione_stato || "DA_FATTURARE",
      stato_intervento: newProjectIntervento.stato_intervento || "APERTO",
      note: newProjectIntervento.note.trim() || null,
    };
    let inserted: { id: string } | null = null;
    let insRes = await dbFrom("saas_interventi").insert(payload).select("id").single();
    if (insRes.error && String(insRes.error.message || "").toLowerCase().includes("data_tassativa")) {
      const { data_tassativa: _skip, ...payloadNoTassativa } = payload;
      insRes = await dbFrom("saas_interventi").insert(payloadNoTassativa).select("id").single();
    }
    if (insRes.error && String(insRes.error.message || "").toLowerCase().includes("ticket_no")) {
      const { ticket_no: _skip, ...payloadNoTicket } = payload;
      insRes = await dbFrom("saas_interventi").insert(payloadNoTicket).select("id").single();
    }
    if (insRes.error) {
      const insErr = insRes.error;
      setProjectInterventiError(insErr.message);
      return;
    }
    inserted = (insRes.data as { id: string } | null) ?? null;
    if (inserted?.id && projectInterventoFiles.length > 0) {
      await uploadInterventoRowFilesList(inserted.id, projectInterventoFiles);
    }
    const list = await loadProjectInterventi(id);
    setProjectInterventi(list);
    await loadInterventoRowAttachmentCounts(list);
    setProjectInterventiNotice("Intervento aggiunto.");
    setNewProjectIntervento({
      data: "",
      data_tassativa: "",
      descrizione: "",
      ticket_no: "",
      incluso: true,
      proforma: checklist.proforma || "",
      codice_magazzino: magazzino.codice || "",
      fatturazione_stato: "DA_FATTURARE",
      stato_intervento: "APERTO",
      note: "",
    });
    setProjectInterventoFiles([]);
    if (inserted?.id) {
      const created = list.find((row) => row.id === inserted?.id) || null;
      if (created) {
        setProjectInterventoEditId(created.id);
        setProjectInterventoEditForm(buildProjectInterventoForm(created));
        setProjectInterventiExpandedId(created.id);
      }
    }
  }

  function startEditInterventoRow(it: InterventoRow) {
    setProjectInterventoEditId(it.id);
    setProjectInterventoEditForm(buildProjectInterventoForm(it));
  }

  async function saveInterventoRow() {
    if (!projectInterventoEditId || !projectInterventoEditForm) return;
    setProjectInterventiError(null);
    const payload = {
      data: projectInterventoEditForm.data || null,
      data_tassativa: projectInterventoEditForm.data_tassativa || null,
      ticket_no: projectInterventoEditForm.ticket_no.trim() || null,
      descrizione: projectInterventoEditForm.descrizione.trim() || null,
      tipo: projectInterventoEditForm.descrizione.trim() || null,
      incluso: Boolean(projectInterventoEditForm.incluso),
      proforma: projectInterventoEditForm.proforma.trim() || null,
      codice_magazzino: projectInterventoEditForm.codice_magazzino.trim() || null,
      fatturazione_stato: projectInterventoEditForm.fatturazione_stato || "DA_FATTURARE",
      stato_intervento: projectInterventoEditForm.stato_intervento || "APERTO",
      note: projectInterventoEditForm.note.trim() || null,
    };
    let updRes = await dbFrom("saas_interventi")
      .update(payload)
      .eq("id", projectInterventoEditId);
    if (updRes.error && String(updRes.error.message || "").toLowerCase().includes("data_tassativa")) {
      const { data_tassativa: _skip, ...payloadNoTassativa } = payload;
      updRes = await dbFrom("saas_interventi")
        .update(payloadNoTassativa)
        .eq("id", projectInterventoEditId);
    }
    if (updRes.error) {
      const updErr = updRes.error;
      setProjectInterventiError(updErr.message);
      return;
    }
    if (!id) return;
    const list = await loadProjectInterventi(id);
    setProjectInterventi(list);
    await loadInterventoRowAttachmentCounts(list);
    setProjectInterventoEditId(null);
    setProjectInterventoEditForm(null);
    setProjectInterventiNotice("Intervento aggiornato.");
  }

  function getInterventoRowStato(row: InterventoRow) {
    const raw = String(row.stato_intervento || "").toUpperCase();
    if (raw === "APERTO" || raw === "CHIUSO") return raw;
    if (row.fatturazione_stato) return "CHIUSO";
    return "APERTO";
  }

  function getProjectEsitoFatturazione(row: InterventoRow) {
    const raw = String(row.esito_fatturazione || "").toUpperCase();
    if (raw === "DA_FATTURARE" || raw === "NON_FATTURARE" || raw === "INCLUSO_DA_CONSUNTIVO") {
      return raw;
    }
    const fallback = String(row.fatturazione_stato || "").toUpperCase();
    if (fallback === "DA_FATTURARE" || fallback === "NON_FATTURARE" || fallback === "INCLUSO_DA_CONSUNTIVO") {
      return fallback;
    }
    return null;
  }

  function getProjectInterventoAlertRecipients() {
    return alertOperatori.filter((o) => o.attivo !== false);
  }

  function getProjectFatturaAlertRecipients() {
    return alertOperatori.filter((o) => {
      const ruolo = String(o.ruolo || "").toUpperCase();
      return o.attivo !== false && (ruolo === "AMMINISTRAZIONE" || normalizeAlertTasks(o.alert_tasks).all_task_status_change);
    });
  }

  function getProjectFattureDaEmettereList() {
    return projectInterventi.filter(
      (row) => getInterventoRowStato(row) === "CHIUSO" && getProjectEsitoFatturazione(row) === "DA_FATTURARE"
    );
  }

  function buildProjectBulkFattureMessage(list: InterventoRow[]) {
    const checklistLabel = checklist?.nome_checklist || checklist?.id || "—";
    const lines = list.map((row) => {
      const tipo = row.incluso ? "INCLUSO" : "EXTRA";
      const auto = row.note_tecniche && row.note_tecniche.includes("Auto-EXTRA") ? " AUTO" : "";
      const note = row.note ? ` | Note: ${row.note}` : "";
      return `${row.data ? new Date(row.data).toLocaleDateString("it-IT") : "—"} | ${tipo}${auto} | ${row.descrizione || "—"}${note}`;
    });
    return [
      `FATTURE DA EMETTERE — Cliente: ${checklist?.cliente || "—"}`,
      `PROGETTO: ${checklistLabel}`,
      `Totale interventi: ${list.length}`,
      `Link: /checklists/${id}`,
      "",
      ...lines,
    ].join("\n");
  }

  function buildProjectInterventoAlertMessage(row: InterventoRow) {
    const magazzino = splitMagazzinoFields(
      checklist?.magazzino_importazione,
      checklist?.magazzino_drive_url
    );
    return [
      "Intervento EXTRA da fatturare",
      `Cliente: ${checklist?.cliente || "—"}`,
      `PROGETTO: ${checklist?.nome_checklist || checklist?.id || "—"}`,
      `Proforma: ${row.proforma || checklist?.proforma || "—"}`,
      `CodMag: ${row.codice_magazzino || magazzino.codice || "—"}`,
      `Data: ${row.data ? new Date(row.data).toLocaleDateString("it-IT") : "—"}`,
      `Descrizione: ${row.descrizione || "—"}`,
    ].join(" — ");
  }

  function openProjectInterventoAlertModal(row: InterventoRow) {
    setProjectInterventoAlertId(row.id);
    setProjectInterventoAlertToOperatoreId("");
    setProjectInterventoAlertMsg(buildProjectInterventoAlertMessage(row));
    setProjectInterventoAlertErr(null);
    setProjectInterventoAlertOk(null);
  }

  function openProjectBulkInterventoAlertModal() {
    const list = getProjectFattureDaEmettereList();
    if (list.length === 0) {
      setProjectInterventiNotice("Nessuna fattura da emettere.");
      return;
    }
    setProjectInterventoBulkErr(null);
    setProjectInterventoBulkOk(null);
    setProjectInterventoBulkToOperatoreId("");
    setProjectInterventoBulkMsg(buildProjectBulkFattureMessage(list));
    setProjectInterventoBulkOpen(true);
  }

  async function fetchInterventoRowBulkLastAlert() {
    if (!id) return;
    const { data, error } = await dbFrom("checklist_alert_log")
      .select("created_at, to_operatore_id, messaggio")
      .eq("canale", "fatturazione_bulk")
      .eq("checklist_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("Errore lettura ultimo alert bulk checklist", error);
      return;
    }
    setProjectInterventoBulkLastSentAt(data?.created_at ?? null);
    setProjectInterventoBulkLastToOperatoreId(data?.to_operatore_id ?? null);
    setProjectInterventoBulkLastMessage(data?.messaggio ?? null);
  }

  async function uploadInterventoRowFilesList(interventoId: string, files: File[]) {
    for (const file of files) {
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `intervento/${interventoId}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await storageUpload(path, file);
      if (uploadError) {
        setProjectInterventiError("Errore upload file intervento: " + uploadError.message);
        return;
      }
      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "UPLOAD",
          entity_type: "INTERVENTO",
          entity_id: interventoId,
          title: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProjectInterventiError(String(data?.error || "Errore salvataggio allegato"));
        return;
      }
    }
  }

  async function confirmProjectCloseIntervento() {
    if (!projectCloseInterventoId) return;
    if (!projectCloseEsito) {
      setProjectCloseError("Seleziona un esito di fatturazione.");
      return;
    }
    const current = projectInterventi.find((row) => row.id === projectCloseInterventoId);
    const noteTrim = projectCloseNote.trim();
    let noteTecniche = current?.note_tecniche ?? "";
    if (noteTrim) {
      noteTecniche = noteTecniche ? `${noteTecniche}\nChiusura: ${noteTrim}` : `Chiusura: ${noteTrim}`;
    }
    const { error } = await dbFrom("saas_interventi")
      .update({
        stato_intervento: "CHIUSO",
        esito_fatturazione: projectCloseEsito,
        chiuso_il: new Date().toISOString(),
        chiuso_da_operatore: currentOperatoreId || null,
        note_tecniche: noteTecniche || null,
      })
      .eq("id", projectCloseInterventoId);
    if (error) {
      setProjectCloseError("Errore chiusura intervento: " + error.message);
      return;
    }
    if (!id) return;
    const list = await loadProjectInterventi(id);
    setProjectInterventi(list);
    await loadInterventoRowAttachmentCounts(list);
    setProjectCloseInterventoId(null);
    setProjectCloseEsito("");
    setProjectCloseNote("");
    setProjectCloseError(null);
  }

  async function reopenInterventoRow(interventoId: string) {
    if (!currentOperatoreId) {
      setProjectInterventiError("Seleziona un operatore corrente prima di riaprire.");
      return;
    }
    const operatore = alertOperatori.find((row) => row.id === currentOperatoreId) || null;
    const role = operatore?.ruolo ?? null;
    if (!["SUPERVISORE", "PM"].includes(String(role || "").toUpperCase())) {
      setProjectInterventiError("Solo SUPERVISORE o PM possono riaprire l'intervento.");
      return;
    }
    const { error } = await dbFrom("saas_interventi")
      .update({
        stato_intervento: "APERTO",
        esito_fatturazione: null,
        chiuso_il: null,
        chiuso_da_operatore: null,
      })
      .eq("id", interventoId);
    if (error) {
      setProjectInterventiError("Errore riapertura intervento: " + error.message);
      return;
    }
    try {
      await sendAlert({
        canale: "manual",
        subject: "Intervento riaperto",
        message: `Intervento riaperto da ${operatore?.nome ?? operatore?.id ?? "—"}`,
        text: `Intervento riaperto da ${operatore?.nome ?? operatore?.id ?? "—"}`,
        html: `<div><strong>Intervento riaperto</strong><br/>${escapeHtml(`Intervento riaperto da ${operatore?.nome ?? operatore?.id ?? "—"}`)}</div>`,
        to_email: operatore?.email ?? null,
        to_nome: operatore?.nome ?? null,
        to_operatore_id: currentOperatoreId,
        from_operatore_id: currentOperatoreId,
        checklist_id: id,
        intervento_id: interventoId,
        send_email: false,
      });
    } catch (err) {
      console.error("Errore log riapertura intervento checklist", err);
    }
    if (!id) return;
    const list = await loadProjectInterventi(id);
    setProjectInterventi(list);
    await loadInterventoRowAttachmentCounts(list);
  }

  async function sendProjectInterventoAlert() {
    if (!projectInterventoAlertId || !id || !checklist) return;
    setProjectInterventoAlertSending(true);
    setProjectInterventoAlertErr(null);
    setProjectInterventoAlertOk(null);
    const opId =
      currentOperatoreId ??
      (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
    if (!opId) {
      setProjectInterventoAlertErr("Seleziona l’Operatore corrente prima di inviare un alert.");
      setProjectInterventoAlertSending(false);
      return;
    }
    if (!projectInterventoAlertToOperatoreId) {
      setProjectInterventoAlertErr("Seleziona un destinatario per l'alert.");
      setProjectInterventoAlertSending(false);
      return;
    }
    const intervento = projectInterventi.find((row) => row.id === projectInterventoAlertId) || null;
    const destinatario = alertOperatori.find((row) => row.id === projectInterventoAlertToOperatoreId) || null;
    const toEmail = destinatario?.email ?? "";
    if (projectInterventoAlertSendEmail && !toEmail.includes("@")) {
      setProjectInterventoAlertErr("Destinatario senza email valida.");
      setProjectInterventoAlertSending(false);
      return;
    }
    const subject = `[Art Tech] Alert fatturazione – ${checklist.cliente || "—"}`;
    const dettagli = [
      `Cliente: ${checklist.cliente || "—"}`,
      intervento?.descrizione ? `Intervento: ${intervento.descrizione}` : "",
      intervento?.proforma ? `Proforma: ${intervento.proforma}` : "",
      intervento?.codice_magazzino ? `CodMag: ${intervento.codice_magazzino}` : "",
      projectInterventoAlertMsg.trim() ? `Messaggio: ${projectInterventoAlertMsg.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await sendAlert({
        canale: "fatturazione_row",
        subject,
        message: projectInterventoAlertMsg.trim() || dettagli,
        text: dettagli,
        html: `<div><h2>${escapeHtml(subject)}</h2><div>${textToHtml(dettagli)}</div><p style="font-size:12px;color:#6b7280">Messaggio manuale Art Tech.</p></div>`,
        to_email: toEmail || null,
        to_nome: destinatario?.nome ?? null,
        to_operatore_id: projectInterventoAlertToOperatoreId,
        from_operatore_id: opId,
        checklist_id: id,
        intervento_id: projectInterventoAlertId,
        tipo: "GENERICO",
        trigger: "MANUALE",
        send_email: projectInterventoAlertSendEmail,
      });
    } catch (err) {
      console.error("Errore invio alert intervento checklist", err);
      showToast(`❌ Invio fallito: ${briefError(err)}`, "error");
      setProjectInterventoAlertSending(false);
      return;
    }
    const esito = projectInterventoAlertSendEmail ? "✅ Email inviata" : "✅ Avviso registrato";
    setProjectInterventiNotice(esito);
    setProjectInterventoAlertSending(false);
    setProjectInterventoAlertToOperatoreId("");
    setProjectInterventoAlertMsg("");
    setProjectInterventoAlertSendEmail(true);
    setProjectInterventoAlertOk(esito);
    setTimeout(() => setProjectInterventoAlertId(null), 800);
  }

  async function sendProjectBulkFatturaAlert() {
    if (!id || !checklist) return;
    setProjectInterventoBulkSending(true);
    setProjectInterventoBulkErr(null);
    setProjectInterventoBulkOk(null);
    const opId =
      currentOperatoreId ??
      (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
    if (!opId) {
      setProjectInterventoBulkErr("Operatore corrente non trovato.");
      setProjectInterventoBulkSending(false);
      return;
    }
    if (!projectInterventoBulkToOperatoreId) {
      setProjectInterventoBulkErr("Seleziona un destinatario.");
      setProjectInterventoBulkSending(false);
      return;
    }
    const destinatario = alertOperatori.find((row) => row.id === projectInterventoBulkToOperatoreId) || null;
    const toEmail = destinatario?.email ?? "";
    if (projectInterventoBulkSendEmail && !toEmail.includes("@")) {
      setProjectInterventoBulkErr("Destinatario senza email valida.");
      setProjectInterventoBulkSending(false);
      return;
    }
    try {
      await sendAlert({
        canale: "fatturazione_bulk",
        subject: `[Art Tech] Da fatturare – ${checklist.cliente || "—"}`,
        message: projectInterventoBulkMsg.trim() || projectInterventoBulkMsg,
        text: projectInterventoBulkMsg,
        html: `<div><h2>${escapeHtml(`[Art Tech] Da fatturare – ${checklist.cliente || "—"}`)}</h2><div>${textToHtml(projectInterventoBulkMsg || "")}</div><p style="font-size:12px;color:#6b7280">Messaggio manuale Art Tech.</p></div>`,
        to_email: toEmail || null,
        to_nome: destinatario?.nome ?? null,
        to_operatore_id: projectInterventoBulkToOperatoreId,
        from_operatore_id: opId,
        checklist_id: id,
        tipo: "GENERICO",
        trigger: "MANUALE",
        send_email: projectInterventoBulkSendEmail,
      });
    } catch (err) {
      console.error("Errore invio alert bulk checklist", err);
      showToast(`❌ Invio fallito: ${briefError(err)}`, "error");
      setProjectInterventoBulkSending(false);
      return;
    }
    const esito = projectInterventoBulkSendEmail ? "✅ Email inviata" : "✅ Avviso registrato";
    setProjectInterventoBulkSending(false);
    setProjectInterventoBulkOk(esito);
    setProjectInterventoBulkOpen(false);
    setProjectInterventoBulkSendEmail(true);
    setProjectInterventiNotice(`${esito} (${getProjectFattureDaEmettereList().length} interventi).`);
    await fetchInterventoRowBulkLastAlert();
  }

  async function addProjectTagliandoPeriodico() {
    if (!id) return;
    if (!projectTagliando.scadenza) {
      setProjectInterventiError("Inserisci la scadenza del tagliando.");
      return;
    }
    setProjectInterventiError(null);
    setProjectTagliandoSaving(true);
    const modalita =
      String(projectTagliando.fatturazione || "").toUpperCase() === "INCLUSO" ? "INCLUSO" : "EXTRA";
    const payload = {
      checklist_id: id,
      scadenza: projectTagliando.scadenza,
      stato: "ATTIVA",
      modalita,
      note: projectTagliando.note.trim() || "Tagliando periodico",
    };
    const { error } = await dbFrom("tagliandi").insert(payload);
    if (error) {
      setProjectInterventiError(error.message);
      setProjectTagliandoSaving(false);
      return;
    }
    const { data: tagliandiData, error: loadErr } = await db<any[]>({
      table: "tagliandi",
      op: "select",
      select: "id, checklist_id, scadenza, stato, modalita, note, created_at",
      filter: { checklist_id: id },
      order: [{ col: "scadenza", asc: true }],
    });
    if (loadErr) {
      setProjectInterventiError(loadErr.message);
      setProjectTagliandoSaving(false);
      return;
    }
    setProjectTagliandi((tagliandiData || []) as Tagliando[]);
    setProjectTagliando({ scadenza: "", fatturazione: "INCLUSO", note: "" });
    setProjectInterventiNotice("Tagliando periodico aggiunto.");
    setProjectTagliandoSaving(false);
  }

  function openProjectRenewalEdit(row: ProjectRenewalRow) {
    const tipoUpper = String(row.tipo || row.item_tipo || "").toUpperCase();
    setProjectRenewalEdit({
      row,
      scadenza: toDateInput(row.scadenza),
      stato: String(row.stato || "").trim(),
      modalita: String(row.modalita || "").trim(),
      note: String(row.note || "").trim(),
      descrizione: String((row as any).descrizione || "").trim(),
      saas_piano:
        tipoUpper === "SAAS" || tipoUpper === "SAAS_ULTRA"
          ? String(row.riferimento || "").trim()
          : "",
      licenza_class: "LICENZA",
      licenza_tipo: tipoUpper === "LICENZA" ? String(row.riferimento || "").trim() : "",
      fornitore: String((row as any).fornitore || "").trim(),
      intestato_a: String((row as any).intestato_a || "").trim(),
    });
  }

  async function saveProjectRenewalEdit() {
    if (!projectRenewalEdit || !id) return;
    setProjectInterventiError(null);
    setProjectRenewalEditSaving(true);

    const row = projectRenewalEdit.row;
    const scadenza = projectRenewalEdit.scadenza || null;
    const stato = projectRenewalEdit.stato || null;
    const modalita = projectRenewalEdit.modalita || null;
    const note = projectRenewalEdit.note.trim() || null;
    const descrizione = String(projectRenewalEdit.descrizione || "").trim() || null;

    let err: any = null;

    if (row.source === "saas") {
      const res = await dbFrom("checklists")
        .update({ saas_scadenza: scadenza, saas_stato: stato })
        .eq("id", id);
      err = res.error;
    } else if (row.source === "garanzia") {
      const res = await dbFrom("checklists")
        .update({ garanzia_scadenza: scadenza })
        .eq("id", id);
      err = res.error;
    } else if (row.source === "licenza" && row.recordId) {
      const res = await dbFrom("licenze")
        .update({ scadenza, stato, note })
        .eq("id", row.recordId);
      err = res.error;
    } else if (row.source === "tagliando" && row.recordId) {
      const res = await dbFrom("tagliandi")
        .update({ scadenza, stato, modalita, note })
        .eq("id", row.recordId);
      err = res.error;
    } else if (row.source === "rinnovi" && row.recordId) {
      const res = await dbFrom("rinnovi_servizi")
        .update({ scadenza, stato, note, descrizione })
        .eq("id", row.recordId);
      err = res.error;
    }

    if (err) {
      setProjectInterventiError(err.message || "Errore salvataggio voce.");
      setProjectRenewalEditSaving(false);
      return;
    }

    await load(id);
    setProjectRenewalEdit(null);
    setProjectRenewalEditSaving(false);
    setProjectInterventiNotice("Voce scadenza/rinnovo aggiornata.");
  }

  async function deleteProjectRenewalFromEdit() {
    if (!projectRenewalEdit || !id) return;
    const ok = typeof window === "undefined" ? true : window.confirm("Eliminare questa voce da Scadenze & Rinnovi?");
    if (!ok) return;

    const row = projectRenewalEdit.row;
    setProjectInterventiError(null);
    setProjectRenewalEditSaving(true);

    let err: any = null;
    if ((row.source === "licenza" || row.source === "licenze") && row.recordId) {
      const res = await dbFrom("licenze").delete().eq("id", row.recordId);
      err = res.error;
    } else if ((row.source === "tagliando" || row.source === "tagliandi") && row.recordId) {
      const res = await dbFrom("tagliandi").delete().eq("id", row.recordId);
      err = res.error;
    } else if (row.source === "rinnovi" && row.recordId) {
      const res = await dbFrom("rinnovi_servizi").delete().eq("id", row.recordId);
      err = res.error;
    } else if (row.source === "saas" || row.source === "garanzia") {
      setProjectInterventiError(
        "Questa voce va gestita dal progetto (campi SAAS/Garanzia), non come eliminazione riga."
      );
      setProjectRenewalEditSaving(false);
      return;
    } else {
      setProjectInterventiError("Riga non eliminabile.");
      setProjectRenewalEditSaving(false);
      return;
    }

    if (err) {
      setProjectInterventiError(err.message || "Errore eliminazione voce.");
      setProjectRenewalEditSaving(false);
      return;
    }

    await load(id);
    setProjectRenewalEdit(null);
    setProjectRenewalEditSaving(false);
    setProjectInterventiNotice("Voce eliminata.");
  }

  function getProjectWorkflowStato(row: ProjectRenewalRow) {
    const raw = String(row.stato || "").toUpperCase();
    if (row.source === "tagliando" || row.source === "tagliandi") {
      const match = projectRinnovi.find(
        (x) =>
          String(x.checklist_id || "") === String(row.checklist_id || "") &&
          String(x.item_tipo || "").toUpperCase() === "TAGLIANDO"
      );
      if (match?.stato) return String(match.stato).toUpperCase();
      if (raw === "ATTIVA") return "DA_AVVISARE";
      if (raw === "OK") return "CONFERMATO";
      return raw || "DA_AVVISARE";
    }
    if (
      row.source === "saas" ||
      row.source === "garanzia" ||
      row.source === "garanzie" ||
      String(row.item_tipo || "").toUpperCase() === "SAAS" ||
      String(row.item_tipo || "").toUpperCase() === "GARANZIA" ||
      String(row.item_tipo || "").toUpperCase() === "SAAS_ULTRA"
    ) {
      const targetTipo = String(row.item_tipo || row.tipo || "").toUpperCase();
      const match = projectRinnovi.find(
        (x) =>
          String(x.checklist_id || "") === String(row.checklist_id || "") &&
          String(x.item_tipo || "").toUpperCase() === targetTipo
      );
      return String(match?.stato || "DA_AVVISARE").toUpperCase();
    }
    if (row.source === "licenza" || row.source === "licenze") {
      if (raw === "ATTIVA") return "DA_AVVISARE";
      if (raw === "OK") return "CONFERMATO";
    }
    if (RINNOVO_STATI.includes(raw)) return raw;
    return "DA_AVVISARE";
  }

  async function updateProjectRenewalStatus(row: ProjectRenewalRow, nextStatus: string) {
    const status = String(nextStatus || "").toUpperCase();
    if (!id) return;
    setProjectInterventiError(null);
    let err: { message: string } | null = null;

    if (row.source === "saas") {
      const res = await dbFrom("checklists").update({ saas_stato: status }).eq("id", id);
      err = res.error;
    } else if ((row.source === "licenza" || row.source === "licenze") && row.recordId) {
      const res = await dbFrom("licenze").update({ stato: status }).eq("id", row.recordId);
      err = res.error;
    } else if ((row.source === "tagliando" || row.source === "tagliandi") && row.recordId) {
      const mapped =
        status === "CONFERMATO"
          ? "OK"
          : status === "DA_AVVISARE"
          ? "ATTIVA"
          : status;
      const res = await dbFrom("tagliandi").update({ stato: mapped }).eq("id", row.recordId);
      err = res.error;
    } else if (row.source === "rinnovi" && row.recordId) {
      const res = await dbFrom("rinnovi_servizi").update({ stato: status }).eq("id", row.recordId);
      err = res.error;
    }

    if (err) {
      setProjectInterventiError(err.message);
      return;
    }

    await load(id);
    setProjectInterventiNotice(`Stato aggiornato a ${status}.`);
  }

  function getProjectStageList(stage: "stage1" | "stage2", onlyWithin30Days = false) {
    const base = (projectRenewalsAll as ProjectRenewalRow[]).filter((row) =>
      stage === "stage1"
        ? getProjectWorkflowStato(row) === "DA_AVVISARE"
        : getProjectWorkflowStato(row) === "DA_FATTURARE"
    );
    if (!onlyWithin30Days) return base;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return base.filter((row) => {
      const dt = parseLocalDay(row.scadenza);
      if (!dt) return false;
      const diff = Math.ceil((dt.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      return diff >= 0 && diff <= 30;
    });
  }

  function openProjectRinnoviAlert(
    stage: "stage1" | "stage2",
    onlyWithin30Days = false,
    listOverride?: ProjectRenewalRow[]
  ) {
    void loadProjectRinnoviAlertRule(stage);
    const list = listOverride?.length
      ? listOverride
      : getProjectStageList(stage, onlyWithin30Days);
    if (list.length === 0) {
      setProjectInterventiError(
        stage === "stage1" ? "Nessuna scadenza da avvisare." : "Nessun rinnovo da fatturare."
      );
      return;
    }
    setProjectInterventiError(null);
    setProjectRinnoviAlertStage(stage);
    setProjectRinnoviAlertItems(list);
    setProjectRinnoviAlertSubject(
      stage === "stage1"
        ? `[Art Tech] Scadenze servizi – ${checklist?.cliente || "—"}`
        : `[Art Tech] Da fatturare – ${checklist?.cliente || "—"}`
    );
    const lines = list
      .map((row) => {
        const dataLabel = row.scadenza ? new Date(row.scadenza).toLocaleDateString("it-IT") : "—";
        const projectLabel = checklist?.nome_checklist || checklist?.id || "—";
        return `- ${dataLabel} | ${row.riferimento || "—"} | PROGETTO: ${projectLabel}`;
      })
      .join("\n");
    setProjectRinnoviAlertMsg(lines);
    setProjectRinnoviAlertErr(null);
    setProjectRinnoviAlertOk(null);
    setProjectRinnoviAlertOpen(true);
  }

  function getProjectAlertRecipients() {
    return alertOperatori.filter((o) => o.attivo !== false && String(o.email || "").includes("@"));
  }

  async function loadProjectRinnoviAlertRule(stage: "stage1" | "stage2") {
    const clienteKey = String(checklist?.cliente || "").trim();
    if (!clienteKey) {
      setProjectRinnoviAlertRule(getDefaultRenewalAlertRule("", stage));
      return;
    }
    setProjectRinnoviAlertRuleLoading(true);
    const { data, error } = await dbFrom("renewal_alert_rules")
      .select("*")
      .eq("cliente", clienteKey)
      .eq("stage", stage)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("Errore caricamento renewal_alert_rules checklist", error);
      setProjectRinnoviAlertRule(getDefaultRenewalAlertRule(clienteKey, stage));
    } else {
      setProjectRinnoviAlertRule(normalizeRenewalAlertRule((data as any) || null, clienteKey, stage));
    }
    setProjectRinnoviAlertRuleLoading(false);
  }

  async function saveProjectRinnoviAlertRule(rule: RenewalAlertRuleRow) {
    const clienteKey = String(checklist?.cliente || "").trim();
    if (!clienteKey) return;
    setProjectRinnoviAlertRuleSaving(true);
    setProjectRinnoviAlertErr(null);
    setProjectRinnoviAlertOk(null);
    const payload = normalizeRenewalAlertRule(rule, clienteKey, rule.stage);
    const { data, error } = await dbFrom("renewal_alert_rules")
      .upsert(payload, { onConflict: "cliente,stage" })
      .select("*")
      .single();
    if (error) {
      setProjectRinnoviAlertErr(`Errore salvataggio regola automatica: ${error.message}`);
      setProjectRinnoviAlertRuleSaving(false);
      return;
    }
    setProjectRinnoviAlertRule(
      normalizeRenewalAlertRule((data as any) || payload, clienteKey, rule.stage)
    );
    setProjectRinnoviAlertOk("✅ Regola automatica salvata.");
    setProjectRinnoviAlertRuleSaving(false);
  }

  async function loadTaskComments(taskIds: string[]) {
    const ids = Array.from(new Set(taskIds.filter(Boolean)));
    if (ids.length === 0) {
      setTaskCommentsById({});
      return;
    }
    setTaskNotesLoading(true);
    setTaskNotesError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "load",
          rows: ids.map((taskId) => ({ row_kind: "CHECKLIST_TASK", row_ref_id: taskId })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "Errore caricamento note task"));
      }
      const raw = (data?.comments || {}) as Record<string, TaskComment[]>;
      const next: Record<string, TaskComment[]> = {};
      for (const taskId of ids) {
        next[taskId] = Array.isArray(raw[`CHECKLIST_TASK:${taskId}`])
          ? raw[`CHECKLIST_TASK:${taskId}`]
          : [];
      }
      setTaskCommentsById(next);
    } catch (e: any) {
      setTaskNotesError(String(e?.message || "Errore caricamento note task"));
      setTaskCommentsById({});
    } finally {
      setTaskNotesLoading(false);
    }
  }

  async function addTaskComment(task: ChecklistTask) {
    const taskId = String(task.id || "").trim();
    const commento = String(taskNoteDraftById[taskId] || "").trim();
    if (!taskId || !commento) return;
    setTaskNoteSavingTaskId(taskId);
    setTaskNotesError(null);
    try {
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_comment",
          row_kind: "CHECKLIST_TASK",
          row_ref_id: taskId,
          commento,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "Errore salvataggio nota task"));
      }
      const comment = data?.comment as TaskComment | undefined;
      if (comment?.id) {
        setTaskCommentsById((prev) => ({
          ...prev,
          [taskId]: [comment, ...(prev[taskId] || [])],
        }));
      }
      setTaskNoteDraftById((prev) => ({ ...prev, [taskId]: "" }));
      showToast("Nota task aggiunta", "success");
    } catch (e: any) {
      setTaskNotesError(String(e?.message || "Errore salvataggio nota task"));
      showToast(`❌ ${String(e?.message || "Errore salvataggio nota task")}`, "error");
    } finally {
      setTaskNoteSavingTaskId(null);
    }
  }

  async function sendProjectRinnoviAlert(payload: {
    toCliente: boolean;
    toArtTech: boolean;
    artTechMode: "operatore" | "email";
    operatoreId: string;
    manualEmail: string;
    manualName: string;
    subject: string;
    message: string;
    sendEmail: boolean;
  }) {
    if (!id || !checklist) return;
    setProjectRinnoviAlertSending(true);
    setProjectRinnoviAlertErr(null);
    setProjectRinnoviAlertOk(null);
    try {
      const opId =
        currentOperatoreId ??
        (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
      if (!opId) {
        setProjectRinnoviAlertErr("Seleziona l'Operatore corrente prima di inviare.");
        return;
      }
      if (!payload.toArtTech && !payload.toCliente) {
        setProjectRinnoviAlertErr("Seleziona almeno un destinatario (Art Tech e/o cliente).");
        return;
      }
      if (payload.toArtTech && payload.artTechMode === "operatore" && !payload.operatoreId) {
        setProjectRinnoviAlertErr("Seleziona un destinatario Art Tech.");
        return;
      }
      if (payload.toArtTech && payload.artTechMode === "email" && !String(payload.manualEmail || "").includes("@")) {
        setProjectRinnoviAlertErr("Inserisci un'email Art Tech valida.");
        return;
      }
      if (payload.toCliente && !String(checklistClienteEmail || "").includes("@")) {
        setProjectRinnoviAlertErr("Cliente senza email valida in anagrafica.");
        return;
      }
      const list = projectRinnoviAlertItems.length
        ? projectRinnoviAlertItems
        : getProjectStageList(projectRinnoviAlertStage, false);
      if (list.length === 0) {
        setProjectRinnoviAlertErr("Nessun elemento disponibile.");
        return;
      }
      const recipients: Array<{ toEmail: string; toNome: string | null; toOperatoreId: string | null }> = [];
      if (payload.toArtTech && payload.artTechMode === "operatore") {
        const op = alertOperatori.find((o) => o.id === payload.operatoreId) || null;
        const email = String(op?.email || "").trim();
        if (email.includes("@")) {
          recipients.push({
            toEmail: email,
            toNome: op?.nome ?? null,
            toOperatoreId: payload.operatoreId,
          });
        }
      }
      if (payload.toArtTech && payload.artTechMode === "email" && payload.manualEmail.trim()) {
        recipients.push({
          toEmail: payload.manualEmail.trim(),
          toNome: payload.manualName.trim() || null,
          toOperatoreId: null,
        });
      }
      if (payload.toCliente && checklistClienteEmail) {
        recipients.push({
          toEmail: checklistClienteEmail,
          toNome: "Cliente",
          toOperatoreId: null,
        });
      }
      const dedup = new Map<string, { toEmail: string; toNome: string | null; toOperatoreId: string | null }>();
      for (const recipient of recipients) {
        dedup.set(
          `${String(recipient.toOperatoreId || "")}::${String(recipient.toEmail || "").toLowerCase()}`,
          recipient
        );
      }
      const finalRecipients = Array.from(dedup.values()).filter((r) => String(r.toEmail || "").includes("@"));
      if (finalRecipients.length === 0) {
        setProjectRinnoviAlertErr("Nessun destinatario valido selezionato.");
        return;
      }
      const subject =
        payload.subject ||
        (projectRinnoviAlertStage === "stage1"
          ? `[Art Tech] Scadenze servizi – ${checklist?.cliente || "—"}`
          : `[Art Tech] Da fatturare – ${checklist?.cliente || "—"}`);
      const message = (payload.message || "").trim();
      const html = `
        <div>
          <h2>${escapeHtml(subject)}</h2>
          <div>${textToHtml(message)}</div>
          <p style="font-size:12px;color:#6b7280">Messaggio manuale Art Tech.</p>
        </div>
      `;
      const byItemCanale = (item: ProjectRenewalRow) => {
        const src = String(item.source || "");
        const isTag = src === "tagliando" || src === "tagliandi";
        const isLic = src === "licenza" || src === "licenze";
        if (projectRinnoviAlertStage === "stage1") {
          if (isTag) return "tagliando_stage1";
          if (isLic) return "licenza_stage1";
          return "rinnovo_stage1";
        }
        if (isTag) return "tagliando_stage2";
        if (isLic) return "licenza_stage2";
        return "rinnovo_stage2";
      };
      const normalizeTipo = (item: ProjectRenewalRow) => {
        const src = String(item.source || "");
        if (src === "tagliando" || src === "tagliandi") return "TAGLIANDO";
        if (src === "licenza" || src === "licenze") return "LICENZA";
        return String(item.item_tipo || item.tipo || "RINNOVO").toUpperCase();
      };
      const normalizeRiferimento = (item: ProjectRenewalRow) => {
        const src = String(item.source || "");
        if (src === "tagliando" || src === "tagliandi") return item.riferimento || "TAGLIANDO";
        if (src === "licenza" || src === "licenze") return item.riferimento || "LICENZA";
        return item.riferimento || null;
      };

      for (const recipient of finalRecipients) {
        for (let i = 0; i < list.length; i += 1) {
          const item = list[i];
          await sendAlert({
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
            checklist_id: id,
            tagliando_id:
              item.source === "tagliando" || item.source === "tagliandi" ? item.recordId : null,
            tipo: normalizeTipo(item),
            riferimento: normalizeRiferimento(item),
            stato: getProjectWorkflowStato(item),
            trigger: "MANUALE",
            send_email: i === 0 ? payload.sendEmail : false,
          });
        }
      }

      if (projectRinnoviAlertStage === "stage1") {
        const licenzaIds = list
          .filter((item) => item.source === "licenza" || item.source === "licenze")
          .map((item) => item.recordId)
          .filter(Boolean) as string[];
        if (licenzaIds.length > 0) {
          await Promise.allSettled(
            licenzaIds.map((licenseId) =>
              fetch("/api/licenses/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "SEND_ALERT",
                  licenseId,
                  status: "AVVISATO",
                  updatedByOperatoreId: opId,
                }),
              })
            )
          );
        }
      }

      await load(id);
      setProjectRinnoviAlertOk(
        payload.sendEmail ? "✅ Email inviata e log registrato." : "✅ Log avviso registrato."
      );
      setProjectInterventiNotice(
        payload.sendEmail ? "✅ Email inviata e stato aggiornato." : "✅ Avviso registrato."
      );
      setTimeout(() => setProjectRinnoviAlertOpen(false), 800);
    } catch (e: any) {
      setProjectRinnoviAlertErr(e?.message || "Errore invio avviso.");
    } finally {
      setProjectRinnoviAlertSending(false);
    }
  }

  async function deleteInterventoRow(idToDelete: string) {
    if (!idToDelete) return;
    const ok = typeof window === "undefined" ? true : window.confirm("Eliminare questo intervento?");
    if (!ok) return;
    const { error: delErr } = await dbFrom("saas_interventi").delete().eq("id", idToDelete);
    if (delErr) {
      setProjectInterventiError(delErr.message);
      return;
    }
    if (!id) return;
    const list = await loadProjectInterventi(id);
    setProjectInterventi(list);
    await loadInterventoRowAttachmentCounts(list);
    setProjectInterventiNotice("Intervento eliminato.");
  }

  async function loadCronoOperativi(checklistId: string) {
    setCronoOperativiError(null);
    setCronoOperativiNotice(null);
    try {
      perfCountFetch("POST /api/cronoprogramma load");
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "load",
          rows: [{ row_kind: "INSTALLAZIONE", row_ref_id: checklistId }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCronoOperativiError(String(data?.error || "Errore caricamento dati operativi"));
        setCronoOperativiMeta(null);
        setCronoOperativiForm(EMPTY_CRONO_OPERATIVI);
        return;
      }
      const key = `INSTALLAZIONE:${checklistId}`;
      const nextMeta = ((data?.meta || {}) as Record<string, CronoOperativiMeta>)[key] || null;
      setCronoOperativiMeta(nextMeta);
      setCronoOperativiForm(extractCronoOperativi(nextMeta));
    } catch (e: any) {
      setCronoOperativiError(String(e?.message || "Errore caricamento dati operativi"));
      setCronoOperativiMeta(null);
      setCronoOperativiForm(EMPTY_CRONO_OPERATIVI);
    }
  }

  async function saveCronoOperativi() {
    if (!id) return;
    setCronoOperativiSaving(true);
    setCronoOperativiError(null);
    setCronoOperativiNotice(null);
    try {
      perfCountFetch("POST /api/cronoprogramma set_operativi");
      const res = await fetch("/api/cronoprogramma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_operativi",
          row_kind: "INSTALLAZIONE",
          row_ref_id: id,
          ...cronoOperativiForm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCronoOperativiError(String(data?.error || "Errore salvataggio dati operativi"));
        return;
      }
      setCronoOperativiMeta((data?.meta || null) as CronoOperativiMeta | null);
      setCronoOperativiForm(extractCronoOperativi((data?.meta || null) as CronoOperativiMeta | null));
      setCronoOperativiNotice("Dati operativi salvati.");
    } catch (e: any) {
      setCronoOperativiError(String(e?.message || "Errore salvataggio dati operativi"));
    } finally {
      setCronoOperativiSaving(false);
    }
  }

  async function load(id: string) {
    const loadSeq = ++perfRef.current.loadSeq;
    const loadLabel = `[perf][checklist][load#${loadSeq}] total`;
    if (isPerfEnabled()) {
      console.time(loadLabel);
      console.info(`[perf][checklist] load start`, { id, loadSeq });
    }
    setLoading(true);
    setError(null);
    setItemsError(null);

    const debug =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debug") === "1";
    if (isPerfEnabled()) console.time(`[perf][checklist][load#${loadSeq}] fetch head`);
    perfCountFetch("GET /api/checklists/:id");
    const headRes = await fetch(`/api/checklists/${id}${debug ? "?debug=1" : ""}`);
    const headJson = await headRes.json().catch(() => ({}));
    if (isPerfEnabled()) console.timeEnd(`[perf][checklist][load#${loadSeq}] fetch head`);
    const head = headJson?.data as any;
    const err1 = headRes.ok ? null : { message: headJson?.error || "Errore caricamento checklist" };

    if (err1) {
      setError("Errore caricamento checklist: " + err1.message);
      setLoading(false);
      return;
    }

    if (isPerfEnabled()) console.time(`[perf][checklist][load#${loadSeq}] db checklist_items`);
    const { data: items, error: err2 } = await db<any[]>({
      table: "checklist_items",
      op: "select",
      select: "*",
      filter: { checklist_id: id },
      order: [{ col: "created_at", asc: true }],
    });
    if (isPerfEnabled()) console.timeEnd(`[perf][checklist][load#${loadSeq}] db checklist_items`);

    if (err2) {
      setError("Errore caricamento righe: " + err2.message);
      setLoading(false);
      return;
    }

    if (isPerfEnabled()) console.time(`[perf][checklist][load#${loadSeq}] parallel datasets`);
    perfCountFetch("GET /api/checklists/:id/tasks");
    perfCountFetch("GET /api/checklists/:id/licenses");
    perfCountFetch("GET /api/checklists/:id/tagliandi");
    perfCountFetch("GET /api/checklists/:id/documents");
    perfCountFetch("POST /api/db asset_serials");

    const tasksPromise = fetch(`/api/checklists/${id}/tasks`, { cache: "no-store" }).then(async (res) => {
      const json = await res.json().catch(() => ({}));
      return {
        data: (json?.tasks as any[]) || [],
        error: res.ok ? null : { message: json?.error || "Errore caricamento task" },
      };
    });
    const licenzePromise = fetch(`/api/checklists/${id}/licenses`, { cache: "no-store" }).then(async (res) => {
      const json = await res.json().catch(() => ({}));
      return {
        data: (json?.licenses as any[]) || [],
        error: res.ok ? null : { message: json?.error || "Errore caricamento licenze" },
      };
    });
    const tagliandiPromise = fetch(`/api/checklists/${id}/tagliandi`, { cache: "no-store" }).then(async (res) => {
      const json = await res.json().catch(() => ({}));
      return {
        data: (json?.tagliandi as any[]) || [],
        error: res.ok ? null : { message: json?.error || "Errore caricamento tagliandi" },
      };
    });
    const docsPromise = fetch(`/api/checklists/${id}/documents`, { cache: "no-store" }).then(async (res) => {
      const json = await res.json().catch(() => ({}));
      return {
        data: (json?.documents as any[]) || [],
        error: res.ok ? null : { message: json?.error || "Errore caricamento documenti" },
      };
    });
    const serialsPromise = fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        table: "asset_serials",
        op: "select",
        select: "*",
        filter: { checklist_id: id },
        order: [{ col: "created_at", asc: true }],
      }),
    }).then(async (res) => {
      const json = await res.json().catch(() => ({}));
      return {
        data: (json?.data as any[]) || [],
        error:
          res.ok && json?.ok !== false
            ? null
            : { message: json?.error || "Errore caricamento seriali" },
      };
    });
    const taskDocsPromise = db<any[]>({
      table: "checklist_task_documents",
      op: "select",
      select: "id, checklist_id, task_id, filename, storage_path, uploaded_at, uploaded_by_operatore",
      filter: { checklist_id: id },
      order: [{ col: "uploaded_at", asc: false }],
    }).then((res) => {
      const msg = String(res.error?.message || "").toLowerCase();
      const missingTable =
        msg.includes("checklist_task_documents") &&
        (msg.includes("does not exist") ||
          msg.includes("relation") ||
          msg.includes("could not find the table") ||
          msg.includes("schema cache"));
      if (missingTable) {
        return { data: [] as any[], error: null as any };
      }
      return res;
    });
    const rinnoviPromise = (async () => {
      let rinnoviSelect = "id, checklist_id, item_tipo, scadenza, stato, riferimento, descrizione, note";
      let { data: rinnoviDataRaw, error: rinnoviErr } = await db<any[]>({
        table: "rinnovi_servizi",
        op: "select",
        select: rinnoviSelect,
        filter: { checklist_id: id },
        order: [{ col: "scadenza", asc: true }],
        limit: 1000,
      });
      if (rinnoviErr && String(rinnoviErr.message || "").toLowerCase().includes("riferimento")) {
        rinnoviSelect = "id, checklist_id, item_tipo, scadenza, stato, descrizione, note";
        const retry = await db<any[]>({
          table: "rinnovi_servizi",
          op: "select",
          select: rinnoviSelect,
          filter: { checklist_id: id },
          order: [{ col: "scadenza", asc: true }],
          limit: 1000,
        });
        rinnoviDataRaw = (retry.data || []).map((r: any) => ({ ...r, riferimento: null }));
        rinnoviErr = retry.error;
      }
      if (rinnoviErr && String(rinnoviErr.message || "").toLowerCase().includes("descrizione")) {
        rinnoviSelect = "id, checklist_id, item_tipo, scadenza, stato, note";
        const retry = await db<any[]>({
          table: "rinnovi_servizi",
          op: "select",
          select: rinnoviSelect,
          filter: { checklist_id: id },
          order: [{ col: "scadenza", asc: true }],
          limit: 1000,
        });
        rinnoviDataRaw = (retry.data || []).map((r: any) => ({
          ...r,
          riferimento: null,
          descrizione: null,
        }));
        rinnoviErr = retry.error;
      }
      return { data: (rinnoviDataRaw || []) as ProjectRinnovoRow[], error: rinnoviErr };
    })();

    const [tasksResult, licenzeResult, tagliandiResult, docsResult, serialsResult, taskDocsResult, rinnoviResult] =
      await Promise.all([
        tasksPromise,
        licenzePromise,
        tagliandiPromise,
        docsPromise,
        serialsPromise,
        taskDocsPromise,
        rinnoviPromise,
      ]);
    if (isPerfEnabled()) console.timeEnd(`[perf][checklist][load#${loadSeq}] parallel datasets`);

    const tasks = tasksResult.data;
    if (tasksResult.error) {
      setError("Errore caricamento task: " + tasksResult.error.message);
      setLoading(false);
      return;
    }

    const licenzeData = licenzeResult.data;
    if (licenzeResult.error) {
      setError("Errore caricamento licenze: " + licenzeResult.error.message);
      setLoading(false);
      return;
    }

    const tagliandiData = tagliandiResult.data;
    if (tagliandiResult.error) {
      setError("Errore caricamento tagliandi: " + tagliandiResult.error.message);
      setLoading(false);
      return;
    }

    const rinnoviData = rinnoviResult.data;
    if (rinnoviResult.error) {
      setError("Errore caricamento rinnovi: " + rinnoviResult.error.message);
      setLoading(false);
      return;
    }

    const docsData = docsResult.data;
    if (docsResult.error) {
      setError("Errore caricamento documenti: " + docsResult.error.message);
      setLoading(false);
      return;
    }

    let taskDocsData: any[] = [];
    if (taskDocsResult.error) {
      const msg = String(taskDocsResult.error.message || "").toLowerCase();
      const missingTable =
        msg.includes("checklist_task_documents") &&
        (msg.includes("does not exist") ||
          msg.includes("relation") ||
          msg.includes("could not find the table") ||
          msg.includes("schema cache"));
      if (!missingTable) {
        setError("Errore caricamento allegati task: " + taskDocsResult.error.message);
        setLoading(false);
        return;
      }
    } else {
      taskDocsData = (taskDocsResult.data || []) as any[];
    }

    const serialsData = serialsResult.data;
    if (serialsResult.error) {
      setError("Errore caricamento seriali: " + serialsResult.error.message);
      setLoading(false);
      return;
    }

    if (!catalogLoaded) {
      if (isPerfEnabled()) console.time(`[perf][checklist][load#${loadSeq}] db catalog_items`);
      const { data: catalogData, error: catalogErr } = await db<any[]>({
        table: "catalog_items",
        op: "select",
        select: "id, codice, descrizione, tipo, categoria, attivo",
        order: [{ col: "descrizione", asc: true }],
      });
      const activeCatalogData = ((catalogData || []) as any[]).filter((d) => d?.attivo !== false);
      const deviceData = activeCatalogData.filter((d) =>
        String(d?.codice || "").toUpperCase().startsWith("EL-")
      );
      const deviceErr = null;

      if (catalogErr) {
        console.error("Errore caricamento catalogo", catalogErr);
      } else {
        setCatalogItems(activeCatalogData as CatalogItem[]);
      }
      if (deviceErr) {
        console.error("Errore caricamento device/modelli (EL-%)", deviceErr);
      } else {
        setDeviceCatalogItems((deviceData || []) as CatalogItem[]);
      }
      setCatalogLoaded(true);
      if (isPerfEnabled()) console.timeEnd(`[perf][checklist][load#${loadSeq}] db catalog_items`);
    }

    const headChecklist = head as Checklist;
    // Preferisci sempre la denominazione completa dell'anagrafica cliente per la UI progetto.
    if (headChecklist.cliente_id) {
      const { data: anagraficaRows } = await db<any[]>({
        table: "clienti_anagrafica",
        op: "select",
        select: "denominazione",
        filter: { id: headChecklist.cliente_id },
        limit: 1,
      });
      const fullName = String((anagraficaRows?.[0] as any)?.denominazione || "").trim();
      if (fullName) {
        headChecklist.cliente = fullName;
      }
    }
    const mappedRows: ChecklistItemRow[] = (items || []).map((r) => {
      const code = normalizeCustomCode(r.codice ?? "");
      const isCustom = isCustomCode(code);
      return {
        id: r.id,
        client_id: r.id,
        codice: code,
        descrizione: isCustom ? "Altro / Fuori catalogo" : r.descrizione ?? "",
        descrizione_custom: isCustom ? r.descrizione ?? "" : "",
        quantita: r.quantita != null ? String(r.quantita) : "",
        note: r.note ?? "",
        search: "",
      };
    });

    const clienteKey = String(headChecklist.cliente ?? "").trim();
    setChecklistClienteEmail(null);
    setChecklistCustomerDeliveryMode("AUTO_CLIENTE");
    if (headChecklist.cliente_id) {
      const { data: clienteRows } = await db<any[]>({
        table: "clienti_anagrafica",
        op: "select",
        select: "email, scadenze_delivery_mode",
        filter: { id: headChecklist.cliente_id },
        limit: 1,
      });
      const clienteRow = (clienteRows?.[0] as any) || null;
      const mail = String(clienteRow?.email || "").trim();
      setChecklistClienteEmail(mail && mail.includes("@") ? mail : null);
      setChecklistCustomerDeliveryMode(
        String(clienteRow?.scadenze_delivery_mode || "").trim().toUpperCase() === "MANUALE_INTERNO"
          ? "MANUALE_INTERNO"
          : "AUTO_CLIENTE"
      );
    }

    let activeContratto: ContrattoRow | null = null;
    let ultraNome: string | null = null;
    if (headChecklist.cliente_id || clienteKey) {
      const { data: contrattiDataRaw, error: contrattiErr } = await db<any[]>({
        table: "saas_contratti",
        op: "select",
        select: "id, cliente, piano_codice, scadenza, interventi_annui, illimitati, created_at",
        filter: { cliente: clienteKey },
        order: [{ col: "created_at", asc: false }],
        limit: 1000,
      });
      const contrattiData = contrattiDataRaw || [];

      if (!contrattiErr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rows = (contrattiData || []) as ContrattoRow[];
        activeContratto =
          rows.find((r) => {
            if (!r.scadenza) return true;
            const dt = parseLocalDay(r.scadenza);
            return dt != null && dt >= today;
          }) || (rows.length > 0 ? rows[0] : null);
      }

      if (activeContratto?.piano_codice) {
        const { data: pianoRows } = await db<any[]>({
          table: "saas_piani",
          op: "select",
          select: "codice, nome",
          filter: { codice: activeContratto.piano_codice },
          limit: 1,
        });
        ultraNome = (pianoRows?.[0] as any)?.nome ?? null;
      }

      if (activeContratto?.id) {
        const { data: includedRows } = await db<any[]>({
          table: "saas_interventi",
          op: "select",
          select: "id, contratto_id, incluso",
          filter: { contratto_id: activeContratto.id, incluso: true } as any,
          limit: 1000,
        });
        setInterventiInclusiUsati((includedRows || []).length);
      } else {
        setInterventiInclusiUsati(0);
      }
    }

    let interventiData: InterventoRow[] = [];
    try {
      interventiData = await loadProjectInterventi(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("Errore caricamento interventi progetto: " + msg);
      setLoading(false);
      return;
    }

    setContrattoUltra(activeContratto);
    setContrattoUltraNome(ultraNome);
    setProjectInterventi(interventiData);
    await loadInterventoRowAttachmentCounts(interventiData);
    await fetchInterventoRowBulkLastAlert();
    setProjectInterventiError(null);
    setProjectInterventiNotice(null);
    setChecklist(headChecklist);
    setRows(mappedRows);
    setOriginalRowIds((items || []).map((r) => r.id));
    setTasks((tasks || []) as unknown as ChecklistTask[]);
    await loadTaskAttachmentCounts(((tasks || []) as any[]).map((task: any) => String(task.id || "")));
    await loadTaskComments(((tasks || []) as any[]).map((task: any) => String(task.id || "")));
    setLicenze((licenzeData || []) as Licenza[]);
    setProjectTagliandi((tagliandiData || []) as Tagliando[]);
    setProjectRinnovi(rinnoviData);
    setDocuments((docsData || []) as ChecklistDocument[]);
    setTaskDocuments(taskDocsData as ChecklistTaskDocument[]);
    setAssetSerials((serialsData || []) as AssetSerial[]);

    const { data: alertData, error: alertErr } = await db<any[]>({
      table: "checklist_alert_log",
      op: "select",
      select: "task_id, to_operatore_id, created_at, checklist_id",
      filter: { checklist_id: id },
      order: [{ col: "created_at", asc: false }],
      limit: 1000,
    });
    if (!alertErr) {
      const map = new Map<string, { toOperatoreId: string; createdAt: string }>();
      (alertData || []).forEach((r: any) => {
        if (!map.has(r.task_id)) {
          map.set(r.task_id, {
            toOperatoreId: r.to_operatore_id,
            createdAt: r.created_at,
          });
        }
      });
      setLastAlertByTask(map);
    }

    const nextForm = buildFormData(headChecklist);
    setFormData(nextForm);
    setOriginalData(nextForm);
    setNewProjectIntervento({
      data: "",
      data_tassativa: "",
      descrizione: "",
      ticket_no: "",
      incluso: true,
      proforma: headChecklist.proforma || "",
      codice_magazzino: splitMagazzinoFields(
        headChecklist.magazzino_importazione,
        headChecklist.magazzino_drive_url
      ).codice,
      fatturazione_stato: "DA_FATTURARE",
      stato_intervento: "APERTO",
      note: "",
    });
    await loadCronoOperativi(id);
    if (isPerfEnabled()) {
      const renewalRowsCount =
        (headChecklist?.saas_piano ? 1 : 0) +
        (headChecklist?.garanzia_scadenza ? 1 : 0) +
        (licenzeData || []).length +
        (tagliandiData || []).length +
        (rinnoviData || []).length;
      console.info(`[perf][checklist] ready`, {
        loadSeq,
        counts: {
          tasks: (tasks || []).length,
          licenze: (licenzeData || []).length,
          tagliandi: (tagliandiData || []).length,
          rinnovi_servizi: (rinnoviData || []).length,
          rinnovi: renewalRowsCount,
          documents: (docsData || []).length,
        },
      });
      console.timeEnd(loadLabel);
    }
    setLoading(false);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      if (isPerfEnabled()) {
        perfRef.current.mountActive = true;
        perfRef.current.mountDbCalls = 0;
        perfRef.current.mountFetchCalls = 0;
        console.time("[perf][checklist][mount] total");
        console.info("[perf][checklist] mount start");
      }
      // In Next.js 15 `params` may be a Promise. Resolve it safely.
      const resolved = await Promise.resolve(params);
      const nextId = resolved?.id as string | undefined;
      if (!alive) return;

      if (!nextId) {
        setError("Parametro ID mancante");
        setLoading(false);
        return;
      }

      setId(nextId);
      try {
        await load(nextId);
      } catch (e: any) {
        if (!alive) return;
        setError(
          "Errore caricamento checklist: " + String(e?.message || "eccezione client non gestita")
        );
        setLoading(false);
      } finally {
        if (isPerfEnabled()) {
          console.info("[perf][checklist] mount summary", {
            mountDbCalls: perfRef.current.mountDbCalls,
            mountFetchCalls: perfRef.current.mountFetchCalls,
          });
          console.timeEnd("[perf][checklist][mount] total");
          perfRef.current.mountActive = false;
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [params]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null;
    if (stored) setCurrentOperatoreId(stored);
  }, []);

  useEffect(() => {
    if (!isPerfEnabled() || loading) return;
    console.info("[perf][checklist] render ready", {
      id,
      counts: {
        tasks: tasks.length,
        licenze: licenze.length,
        tagliandi: projectTagliandi.length,
        rinnovi_servizi: projectRinnovi.length,
      },
    });
  }, [loading, id, tasks.length, licenze.length, projectTagliandi.length, projectRinnovi.length]);

  useEffect(() => {
    const checklistCliente = String(checklist?.cliente || "").trim();
    if (!checklistCliente) return;
    (async () => {
      try {
        const { data, error: opErr } = await db<any[]>({
          table: "operatori",
          op: "select",
          select: "id, nome, email, attivo, alert_enabled, alert_tasks, cliente, ruolo",
          limit: 1000,
        });
        if (opErr) {
          console.error("Errore caricamento operatori", opErr);
          return;
        }
        const map = new Map<string, string>();
        const activeOperatori = (data || []).filter((o: any) => {
          if (!Boolean(o?.attivo)) return false;
          return isSameClienteOperator(checklistCliente, o?.cliente ?? null);
        });
        const list: AlertOperatore[] = activeOperatori.map((o: any) => ({
          id: o.id,
          nome: o.nome ?? null,
          email: o.email ?? null,
          attivo: true,
          cliente: o.cliente ?? null,
          ruolo: o.ruolo ?? null,
          alert_enabled: Boolean(o.alert_enabled),
          alert_tasks: normalizeAlertTasks(o.alert_tasks),
        }));
        activeOperatori.forEach((o: any) => {
          const id = String(o?.id || "").trim();
          const nome = String(o?.nome || "").trim();
          if (id && nome) map.set(id, nome);
        });
        setOperatoriMap(map);
        setAlertOperatori(list);

        const tplRes = await fetch("/api/alert-templates", {
          method: "GET",
          credentials: "include",
        });
        if (tplRes.ok) {
          const tplJson = await tplRes.json().catch(() => ({}));
          const rows = Array.isArray(tplJson?.data) ? tplJson.data : [];
          setAlertTemplates(
            rows
              .filter((t: any) => t?.attivo === true)
              .map((t: any) => ({
                id: String(t.id || ""),
                codice: t.codice ?? null,
                titolo: t.titolo ?? null,
                tipo: t.tipo ?? null,
                trigger: t.trigger ?? null,
                subject_template: t.subject_template ?? null,
                body_template: t.body_template ?? null,
                attivo: t.attivo === true,
              }))
          );
        }
      } catch (err: any) {
        console.error("Errore runtime useEffect operatori/checklist", err);
      }
    })();
  }, [checklist?.cliente]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return;
      const { data, error: err } = await db<any[]>({
        table: "checklist_alert_log",
        op: "select",
        select: "checklist_id, tipo, riferimento, to_operatore_id, to_email, created_at",
        filter: { checklist_id: id },
        order: [{ col: "created_at", asc: false }],
        limit: 2000,
      });
      if (!alive) return;
      if (err) return;
      const map = new Map<string, AlertStats>();
      const recipientTotal = new Map<string, Set<string>>();
      for (const row of data || []) {
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
        if (row.to_operatore_id) next.n_operatore += 1;
        else if (row.to_email) next.n_email_manual += 1;
        if (!next.last_sent_at || String(row.created_at) > next.last_sent_at) {
          next.last_sent_at = row.created_at ?? null;
        }
        const op = alertOperatori.find((o) => o.id === row.to_operatore_id);
        const recipient =
          row.to_email ||
          (op?.nome || op?.email
            ? `👤 ${op?.nome ?? "Operatore"}${op?.email ? ` (${op.email})` : ""}`
            : null) ||
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
      setProjectAlertStatsMap(map);
    })();
    return () => {
      alive = false;
    };
  }, [id, alertOperatori, projectRinnovi, licenze, projectTagliandi]);

  const m2Calcolati = calcM2FromDimensioni(
    formData?.dimensioni ?? null,
    formData?.numero_facce ?? 1
  );
  const impiantoQuantitaForm =
    Number.isFinite(Number(formData?.impianto_quantita)) && Number(formData?.impianto_quantita) > 0
      ? Number(formData?.impianto_quantita)
      : 1;
  const m2CalcolatiTotali = m2Calcolati == null ? null : m2Calcolati * impiantoQuantitaForm;

  if (loading) return <div style={{ padding: 20 }}>Caricamento…</div>;
  if (error) return <div style={{ padding: 20, color: "crimson" }}>{error}</div>;
  if (!checklist) return <div style={{ padding: 20 }}>Checklist non trovata</div>;

  const strutturaOptions = catalogItems.filter((item) => {
    const code = (item.codice ?? "").toUpperCase();
    return code.startsWith("STR-") || code === "TEC-STRCT";
  });
  const impiantoOptions = catalogItems.filter((item) =>
    (item.codice ?? "").toUpperCase().startsWith("TEC")
  );
  const vociProdottiOptions = catalogItems.filter((item) => {
    if (item.attivo === false) return false;
    const code = (item.codice ?? "").toUpperCase();
    return !(code.startsWith("TEC") || code.startsWith("SAAS"));
  });
  const deviceOptions = deviceCatalogItems;
  const saasPianoOptions = catalogItems
    .filter((item) => {
      const code = String(item.codice || "").toUpperCase();
      return code.startsWith("SAAS-PL") || code.startsWith("SAAS-PR");
    })
    .map((item) => ({
      code: String(item.codice || "").trim(),
      label:
        `${String(item.codice || "").trim()} — ${String(item.descrizione || "—").trim() || "—"}`,
    }));
  const saasServiziAggiuntivi = catalogItems
    .filter((item) => {
      const code = String(item.codice || "").toUpperCase();
      return (
        code.startsWith("SAAS-") &&
        !code.startsWith("SAAS-PL") &&
        !code.startsWith("SAAS-PR") &&
        !code.startsWith("SAAS-UL")
      );
    })
    .map((item) => ({
      code: String(item.codice || "").trim(),
      label:
        `${String(item.codice || "").trim()} — ${String(item.descrizione || "—").trim() || "—"}`,
    }));
  const serialiControllo = assetSerials.filter((s) => s.tipo === "CONTROLLO");
  const serialiModuli = assetSerials.filter((s) => s.tipo === "MODULO_LED");
  const m2Persisted = (() => {
    const base = calcM2FromDimensioni(checklist.dimensioni, checklist.numero_facce ?? 1);
    const qty =
      Number.isFinite(Number(checklist.impianto_quantita)) && Number(checklist.impianto_quantita) > 0
        ? Number(checklist.impianto_quantita)
        : 1;
    if (base != null) return base * qty;
    if (typeof checklist.m2_calcolati === "number" && Number.isFinite(checklist.m2_calcolati)) {
      return checklist.m2_calcolati;
    }
    return null;
  })();

  function updateRowFields(idx: number, patch: Partial<ChecklistItemRow>) {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  function getEligibleOperatori(task: ChecklistTask | null) {
    if (!task) return [];
    const taskTarget = normalizeRuleTargetValue(task.target);
    const strict = alertOperatori.filter((o) => {
      if (!o.attivo) return false;
      if (!isSameClienteOperator(checklist?.cliente, o.cliente)) return false;
      const prefs = normalizeAlertTasks(o.alert_tasks);
      const roleTarget = normalizeRuleTargetValue(o.ruolo);
      if (taskTarget !== "GENERICA" && roleTarget === taskTarget) return true;
      if (!o.alert_enabled) return false;
      if (prefs.all_task_status_change) return true;
      if (!task.task_template_id) return true;
      return prefs.task_template_ids?.includes(task.task_template_id);
    });
    if (strict.length > 0) return strict;

    const fallback = alertOperatori.filter((o) => {
      if (!o.attivo) return false;
      if (!isSameClienteOperator(checklist?.cliente, o.cliente)) return false;
      if (taskTarget === "GENERICA") return true;
      const roleTarget = normalizeRuleTargetValue(o.ruolo);
      return roleTarget === taskTarget;
    });
    if (fallback.length > 0) return fallback;

    return alertOperatori.filter((o) => {
      if (!o.attivo) return false;
      const hasEmail = String(o.email || "").includes("@");
      if (!hasEmail) return false;
      if (taskTarget === "GENERICA") return true;
      const roleTarget = normalizeRuleTargetValue(o.ruolo);
      return roleTarget === taskTarget;
    });
  }

  async function handleSendAlert() {
    if (!alertTask || !checklist) return;
    setAlertFormError(null);
    const manualEmail = alertManualEmail.trim();
    if (alertManualMode) {
      if (!isValidEmail(manualEmail) && !alertToCliente) {
        setAlertFormError("Inserisci un'email valida.");
        return;
      }
    } else if (!alertDestinatarioId && !alertToCliente) {
      setAlertFormError("Seleziona almeno un destinatario (operatore e/o cliente).");
      return;
    }
    const destinatario = !alertManualMode
      ? alertOperatori.find((o) => o.id === alertDestinatarioId)
      : null;
    if (!alertManualMode && alertSendEmail && alertDestinatarioId && !destinatario?.email) {
      setAlertFormError("Il destinatario non ha un'email configurata.");
      return;
    }
    if (alertToCliente && !String(checklistClienteEmail || "").includes("@")) {
      setAlertFormError("Cliente senza email valida in anagrafica.");
      return;
    }
    const opId =
      currentOperatoreId ??
      (typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null);
    if (!opId) {
      setAlertFormError("Seleziona un operatore corrente in dashboard prima di inviare.");
      return;
    }

    let taskTemplateId = alertTask.task_template_id;
    if (!taskTemplateId) {
      let sezioneNorm = "";
      if (typeof alertTask.sezione === "number") {
        sezioneNorm =
          alertTask.sezione === 0
            ? "DOCUMENTI"
            : `SEZIONE ${alertTask.sezione}`;
      } else {
        sezioneNorm = String(alertTask.sezione || "")
          .toUpperCase()
          .replace(/_/g, " ")
          .trim();
      }

      const { data: tplRows } = await db<any[]>({
        table: "checklist_task_templates",
        op: "select",
        select: "id, sezione, titolo",
        filter: { sezione: sezioneNorm, titolo: alertTask.titolo } as any,
        limit: 1,
      });
      const tpl = tplRows?.[0] ?? null;

      if (tpl?.id) {
        taskTemplateId = tpl.id;
        await dbFrom("checklist_tasks")
          .update({ task_template_id: taskTemplateId })
          .eq("id", alertTask.id);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === alertTask.id ? { ...t, task_template_id: taskTemplateId } : t
          )
        );
      }
    }

    if (!taskTemplateId) {
      alert("Task senza template associato.");
      return;
    }

    const clienteLabel = checklist.cliente ?? "—";
    const subject = `[Art Tech] Alert checklist – ${clienteLabel}`;
    const dettagli = [
      `Cliente: ${clienteLabel}`,
      `Checklist: ${checklist.nome_checklist}`,
      `Task: ${alertTask.titolo}`,
      `Stato: ${String(alertTask.stato || "—").toUpperCase()}`,
      alertMessaggio.trim() ? `Messaggio: ${alertMessaggio.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const html = `
      <div>
        <h2>Alert checklist</h2>
        <ul>
          <li><strong>Cliente:</strong> ${clienteLabel}</li>
          <li><strong>Checklist:</strong> ${checklist.nome_checklist}</li>
          <li><strong>Task:</strong> ${alertTask.titolo}</li>
          <li><strong>Stato:</strong> ${String(alertTask.stato || "—").toUpperCase()}</li>
        </ul>
        ${alertMessaggio.trim() ? `<p>${alertMessaggio.trim()}</p>` : ""}
        <p style="font-size:12px;color:#6b7280">Messaggio manuale Art Tech.</p>
      </div>
    `;

    const recipients: Array<{ toEmail: string; toNome: string | null; toOperatoreId: string | null }> = [];
    if (alertManualMode) {
      if (isValidEmail(manualEmail)) {
        recipients.push({
          toEmail: manualEmail,
          toNome: alertManualName.trim() || null,
          toOperatoreId: null,
        });
      }
    } else if (destinatario?.email) {
      recipients.push({
        toEmail: destinatario.email,
        toNome: destinatario.nome ?? null,
        toOperatoreId: alertDestinatarioId || null,
      });
    }
    if (alertToCliente && checklistClienteEmail) {
      recipients.push({
        toEmail: checklistClienteEmail,
        toNome: "Cliente",
        toOperatoreId: null,
      });
    }
    const dedup = new Map<string, { toEmail: string; toNome: string | null; toOperatoreId: string | null }>();
    for (const r of recipients) {
      dedup.set(`${String(r.toOperatoreId || "")}::${r.toEmail.toLowerCase()}`, r);
    }
    const finalRecipients = Array.from(dedup.values()).filter((r) => isValidEmail(r.toEmail));
    if (finalRecipients.length === 0) {
      setAlertFormError("Nessun destinatario valido selezionato.");
      return;
    }

    try {
      for (const recipient of finalRecipients) {
        await sendAlert({
          canale: "manual_task",
          subject,
          text: dettagli,
          html,
          to_email: recipient.toEmail,
          to_nome: recipient.toNome,
          to_operatore_id: recipient.toOperatoreId,
          from_operatore_id: opId,
          checklist_id: checklist.id,
          task_id: alertTask.id,
          task_template_id: taskTemplateId,
          send_email: alertSendEmail,
        });
      }
    } catch (err) {
      console.error("Errore invio alert task", err);
      showToast(`❌ Invio fallito: ${briefError(err)}`, "error");
      return;
    }

    {
      const nowIso = new Date().toISOString();
      const { error: updErr } = await dbFrom("checklist_tasks")
        .update({
          updated_by_operatore: opId,
          updated_at: nowIso,
        })
        .eq("id", alertTask.id);
      if (!updErr) {
        setTasks((prev) =>
          prev.map((x) =>
            x.id === alertTask.id
              ? {
                  ...x,
                  updated_by_operatore: opId,
                  operatori:
                    operatoriMap.get(opId) != null
                      ? { id: opId, nome: operatoriMap.get(opId) || null }
                      : x.operatori,
                  updated_at: nowIso,
                }
              : x
          )
        );
      }
    }

    showToast(alertSendEmail ? "✅ Email inviata" : "✅ Avviso registrato", "success");
    setAlertNotice(
      alertSendEmail ? "✅ Email inviata e log registrato." : "Log registrato (email disattivata)."
    );
    setTimeout(() => setAlertNotice(null), 2500);
    setLastAlertByTask((prev) => {
      const next = new Map(prev);
      next.set(alertTask.id, {
        toOperatoreId: finalRecipients[0]?.toOperatoreId ?? alertDestinatarioId ?? "",
        createdAt: new Date().toISOString(),
      });
      return next;
    });
    setTimeout(() => setAlertTask(null), 800);
    setAlertDestinatarioId("");
    setAlertMessaggio("");
    setAlertSendEmail(true);
    setAlertManualMode(false);
    setAlertToCliente(false);
    setAlertManualEmail("");
    setAlertManualName("");
    setAlertSelectedPresetId("");
  }

  function parseRecipientsInput(input: string) {
    return input
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function buildFallbackRuleDraft(task: ChecklistTask) {
    const target = normalizeRuleTargetValue((task as any)?.target);
    return {
      checklist_id: id ?? null,
      task_template_id: task.task_template_id || null,
      enabled: true,
      mode: target === "MAGAZZINO" || target === "TECNICO_SW" ? "AUTOMATICA" : "MANUALE",
      task_title: task.titolo,
      target,
      recipients: [],
      frequency: "DAILY" as const,
      send_time: "07:30",
      timezone: "Europe/Rome",
      day_of_week: null,
      send_on_create: false,
      only_future: true,
    } as NotificationRule;
  }

  async function openRuleSettings(task: ChecklistTask) {
    setRuleTask(task);
    setRuleError(null);
    setRuleLoading(true);
    try {
      const target = normalizeRuleTargetValue((task as any)?.target);
      const query = new URLSearchParams({
        task_title: task.titolo,
        target,
      });
      if (id) query.set("checklist_id", id);
      if (task.task_template_id) {
        query.set("task_template_id", task.task_template_id);
      }
      const res = await fetch(`/api/notification-rules?${query.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Errore caricamento regola.");
      }
      console.log("Fetched rule:", json?.data);
      const row = json?.effective_rule ?? (Array.isArray(json?.data) ? json.data[0] : null);
      const globalRule = json?.global_rule ?? null;
      const overrideRule = json?.override_rule ?? null;
      const nextDraft: NotificationRule = row
        ? {
            id: row.id,
            checklist_id: id ?? null,
            task_template_id: row.task_template_id || task.task_template_id || null,
            enabled: row.enabled !== false,
            mode: row.mode === "MANUALE" ? "MANUALE" : "AUTOMATICA",
            task_title: row.task_title || task.titolo,
            target: normalizeRuleTargetValue(row.target || target),
            recipients: Array.isArray(row.extra_recipients)
              ? row.extra_recipients
                  .map((x: any) => String(x || "").trim().toLowerCase())
                  .filter((x: string) => x.includes("@"))
              : [],
            frequency:
              row.frequency === "WEEKLY" || row.frequency === "WEEKDAYS"
                ? row.frequency
                : "DAILY",
            send_time: String(row.send_time || "07:30").slice(0, 5),
            timezone: String(row.timezone || "Europe/Rome"),
            day_of_week:
              row.day_of_week === null || row.day_of_week === undefined
                ? null
                : Number(row.day_of_week),
            send_on_create: row.send_on_create === true,
            only_future: row.only_future !== false,
          }
        : buildFallbackRuleDraft(task);
      setRuleDraft(nextDraft);
      setRuleGlobal(
        globalRule
          ? {
              ...nextDraft,
              ...globalRule,
              target: normalizeRuleTargetValue(globalRule.target || target),
              checklist_id: null,
            }
          : null
      );
      setRuleOverride(
        overrideRule
          ? {
              ...nextDraft,
              ...overrideRule,
              target: normalizeRuleTargetValue(overrideRule.target || target),
              checklist_id: id ?? null,
            }
          : null
      );
      setRuleRecipientsInput(nextDraft.recipients.join(", "));
      setRuleAutoRecipients(
        Array.isArray(json?.auto_recipients)
          ? json.auto_recipients
              .map((x: any) => String(x || "").trim().toLowerCase())
              .filter((x: string) => x.includes("@"))
          : []
      );
      setRuleEffectiveRecipients(
        Array.isArray(json?.effective_recipients)
          ? json.effective_recipients
              .map((x: any) => String(x || "").trim().toLowerCase())
              .filter((x: string) => x.includes("@"))
          : []
      );
    } catch (err: any) {
      setRuleError(err?.message || "Nessuna regola disponibile per questa task.");
      setRuleDraft(null);
      setRuleGlobal(null);
      setRuleOverride(null);
      setRuleRecipientsInput("");
      setRuleAutoRecipients([]);
      setRuleEffectiveRecipients([]);
    } finally {
      setRuleLoading(false);
    }
  }

  function closeRuleSettings() {
    setRuleTask(null);
    setRuleDraft(null);
    setRuleRecipientsInput("");
    setRuleAutoRecipients([]);
    setRuleEffectiveRecipients([]);
    setRuleError(null);
    setRuleLoading(false);
    setRuleSaving(false);
    setRuleGlobal(null);
    setRuleOverride(null);
  }

  async function saveRuleSettings() {
    if (!ruleDraft) return;
    const recipients = parseRecipientsInput(ruleRecipientsInput);
    const payload = {
      ...ruleDraft,
      checklist_id: id || null,
      recipients,
      day_of_week: ruleDraft.frequency === "WEEKLY" ? ruleDraft.day_of_week ?? 1 : null,
    };
    setRuleSaving(true);
    setRuleError(null);
    try {
      const res = await fetch("/api/notification-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Errore salvataggio regola.");
      }
      const saved = json?.data;
      if (saved) {
        const nextRule: NotificationRule = {
          id: saved.id,
          checklist_id: saved.checklist_id ?? (id || null),
          task_template_id: saved.task_template_id || payload.task_template_id || null,
          enabled: saved.enabled !== false,
          mode: saved.mode === "MANUALE" ? "MANUALE" : "AUTOMATICA",
          task_title: saved.task_title || payload.task_title,
          target: normalizeRuleTargetValue(saved.target || payload.target),
          recipients: Array.isArray(saved.extra_recipients)
            ? saved.extra_recipients
                .map((x: any) => String(x || "").trim().toLowerCase())
                .filter((x: string) => x.includes("@"))
            : recipients,
          frequency:
            saved.frequency === "WEEKLY" || saved.frequency === "WEEKDAYS"
              ? saved.frequency
              : "DAILY",
          send_time: String(saved.send_time || payload.send_time).slice(0, 5),
          timezone: String(saved.timezone || payload.timezone),
          day_of_week:
            saved.day_of_week === null || saved.day_of_week === undefined
              ? null
              : Number(saved.day_of_week),
          send_on_create: saved.send_on_create === true,
          only_future: saved.only_future !== false,
        };
        setRuleDraft(nextRule);
        setRuleOverride(nextRule);
        setRuleRecipientsInput(
          Array.isArray(saved.extra_recipients)
            ? saved.extra_recipients
                .map((x: any) => String(x || "").trim().toLowerCase())
                .filter((x: string) => x.includes("@"))
                .join(", ")
            : recipients.join(", ")
        );
        setRuleAutoRecipients(
          Array.isArray(saved.auto_recipients)
            ? saved.auto_recipients
                .map((x: any) => String(x || "").trim().toLowerCase())
                .filter((x: string) => x.includes("@"))
            : []
        );
        setRuleEffectiveRecipients(
          Array.isArray(saved.effective_recipients)
            ? saved.effective_recipients
                .map((x: any) => String(x || "").trim().toLowerCase())
                .filter((x: string) => x.includes("@"))
            : []
        );
      }
      showToast("Regola notifiche salvata", "success");
    } catch (err: any) {
      setRuleError(err?.message || "Errore salvataggio regola.");
    } finally {
      setRuleSaving(false);
    }
  }

  async function resetRuleOverride() {
    if (!ruleDraft || !id) return;
    setRuleSaving(true);
    setRuleError(null);
    try {
      const query = new URLSearchParams({
        checklist_id: id,
        task_title: ruleDraft.task_title,
        target: ruleDraft.target,
      });
      const res = await fetch(`/api/notification-rules?${query.toString()}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Errore ripristino default.");
      }
      setRuleOverride(null);
      if (ruleGlobal) {
        setRuleDraft({ ...ruleGlobal, checklist_id: id });
        setRuleRecipientsInput((ruleGlobal.recipients || []).join(", "));
        setRuleAutoRecipients([]);
        setRuleEffectiveRecipients([]);
      } else {
        setRuleDraft((prev) => (prev ? { ...prev, id: undefined } : prev));
      }
      showToast("Override rimosso: ora usa regola globale/default", "success");
    } catch (err: any) {
      setRuleError(err?.message || "Errore ripristino default.");
    } finally {
      setRuleSaving(false);
    }
  }

  function addRow() {
    const clientId = `new-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setRows((prev) => [
      ...prev,
      {
        client_id: clientId,
        codice: "",
        descrizione: "",
        descrizione_custom: "",
        quantita: "",
        note: "",
        search: "",
      },
    ]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function addLicenza() {
    if (!id) return;
    if (newLicenza.tipo.trim() === "") {
      setLicenzeError("Inserisci almeno il tipo licenza.");
      return;
    }
    setLicenzeError(null);
    if (newLicenza.scadenza.trim() === "") {
      setItemsError("Inserisci la scadenza della licenza.");
      alert("Inserisci la scadenza della licenza.");
      return;
    }
    const rawScadenza = newLicenza.scadenza.trim();
    let scadenzaISO = rawScadenza;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawScadenza)) {
      const parsed = new Date(rawScadenza);
      if (Number.isFinite(parsed.getTime())) {
        scadenzaISO = parsed.toISOString().slice(0, 10);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scadenzaISO)) {
      setItemsError("Scadenza non valida (usa il formato YYYY-MM-DD).");
      alert("Scadenza non valida (usa il formato YYYY-MM-DD).");
      return;
    }
    const payload = {
      checklist_id: id,
      tipo: newLicenza.tipo.trim() ? newLicenza.tipo.trim() : null,
      scadenza: scadenzaISO,
      stato: "attiva",
      note: newLicenza.note.trim() ? newLicenza.note.trim() : null,
      intestata_a: newLicenza.intestata_a.trim() ? newLicenza.intestata_a.trim() : null,
      ref_univoco: newLicenza.ref_univoco.trim()
        ? newLicenza.ref_univoco.trim()
        : null,
      telefono: newLicenza.telefono.trim() ? newLicenza.telefono.trim() : null,
      intestatario: newLicenza.intestatario.trim()
        ? newLicenza.intestatario.trim()
        : null,
      gestore: newLicenza.gestore.trim() ? newLicenza.gestore.trim() : null,
      fornitore: newLicenza.fornitore.trim() ? newLicenza.fornitore.trim() : null,
    };
    const { error: insertErr } = await dbFrom("licenses").insert(payload);
    if (insertErr) {
      const msg = logSupabaseError("insert licenses", insertErr) || "Errore inserimento licenza";
      alert(msg);
      setItemsError(msg);
      return;
    }
    setLicenzeError(null);
    setNewLicenza({
      tipo: "",
      scadenza: "",
      note: "",
      intestata_a: "CLIENTE",
      ref_univoco: "",
      telefono: "",
      intestatario: "",
      gestore: "",
      fornitore: "",
    });
    await load(id);
  }

  function normalizeLicenzaScadenza(rawInput: string) {
    const raw = rawInput.trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return null;
  }

  async function updateLicenza(
    licenzaId: string,
    patch: {
      tipo?: string | null;
      scadenza?: string | null;
      note?: string | null;
      stato?: "attiva" | "disattivata";
      intestata_a?: string | null;
      ref_univoco?: string | null;
      telefono?: string | null;
      intestatario?: string | null;
      gestore?: string | null;
      fornitore?: string | null;
    }
  ) {
    if (!id) return;
    const { error: updateErr } = await dbFrom("licenses")
      .update(patch)
      .eq("id", licenzaId);
    if (updateErr) {
      console.error("Errore aggiornamento licenza", updateErr);
      setItemsError("Errore aggiornamento licenza: " + updateErr.message);
      alert("Errore aggiornamento licenza: " + updateErr.message);
      return;
    }
    await load(id);
  }

  function startEditLicenza(l: Licenza) {
    setEditingLicenzaId(l.id);
    setEditingLicenza({
      tipo: l.tipo ?? "",
      scadenza: l.scadenza ? l.scadenza.slice(0, 10) : "",
      note: l.note ?? "",
      stato: (l.stato ?? "attiva") as "attiva" | "disattivata",
      intestata_a: l.intestata_a ?? "CLIENTE",
      ref_univoco: l.ref_univoco ?? "",
      telefono: l.telefono ?? "",
      intestatario: l.intestatario ?? "",
      gestore: l.gestore ?? "",
      fornitore: l.fornitore ?? "",
    });
  }

  async function saveEditLicenza() {
    if (!editingLicenzaId || !editingLicenza) return;
    if (editingLicenza.tipo.trim() === "") {
      setLicenzeError("Inserisci almeno il tipo licenza.");
      return;
    }
    const normalizedScadenza = normalizeLicenzaScadenza(editingLicenza.scadenza);
    if (!normalizedScadenza) {
      setItemsError("Scadenza non valida (usa il formato YYYY-MM-DD).");
      alert("Scadenza non valida (usa il formato YYYY-MM-DD).");
      return;
    }
    await updateLicenza(editingLicenzaId, {
      tipo: editingLicenza.tipo.trim(),
      scadenza: normalizedScadenza,
      note: editingLicenza.note.trim() ? editingLicenza.note.trim() : null,
      stato: editingLicenza.stato,
      intestata_a: editingLicenza.intestata_a.trim() ? editingLicenza.intestata_a.trim() : null,
      ref_univoco: editingLicenza.ref_univoco.trim()
        ? editingLicenza.ref_univoco.trim()
        : null,
      telefono: editingLicenza.telefono.trim() ? editingLicenza.telefono.trim() : null,
      intestatario: editingLicenza.intestatario.trim()
        ? editingLicenza.intestatario.trim()
        : null,
      gestore: editingLicenza.gestore.trim() ? editingLicenza.gestore.trim() : null,
      fornitore: editingLicenza.fornitore.trim()
        ? editingLicenza.fornitore.trim()
        : null,
    });
    setEditingLicenzaId(null);
    setEditingLicenza(null);
  }

  async function deleteLicenza(licenzaId: string) {
    if (!id) return;
    const ok = window.confirm("Eliminare questa licenza?");
    if (!ok) return;
    const res = await fetch("/api/licenses/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "DELETE_LICENSE", licenseId: licenzaId }),
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      const msg = String(json?.error || "Errore eliminazione licenza");
      alert(msg);
      setItemsError(msg);
      return;
    }
    if (editingLicenzaId === licenzaId) {
      setEditingLicenzaId(null);
      setEditingLicenza(null);
    }
    await load(id);
  }

  async function uploadDocument() {
    if (!id) return;
    if (!docFile) {
      setDocError("Seleziona un file.");
      return;
    }
    if (!docType) {
      setDocError("Seleziona il tipo documento.");
      return;
    }
    setDocError(null);

    const safeName = docFile.name.replace(/\s+/g, "_");
    const storagePath = `checklists/${id}/${Date.now()}_${safeName}`;

    const { error: uploadErr } = await storageUpload(storagePath, docFile);

    if (uploadErr) {
      alert("Errore upload documento: " + uploadErr.message);
      return;
    }

    const payload = {
      checklist_id: id,
      tipo: docType,
      filename: docFile.name,
      storage_path: storagePath,
      uploaded_by_operatore: currentOperatoreId || null,
    };

    const { error: insErr } = await dbFrom("checklist_documents")
      .insert(payload);

    if (insErr) {
      alert("Errore salvataggio documento: " + insErr.message);
      return;
    }

    setDocType("");
    setDocFile(null);
    await load(id);
  }

  function openTaskFiles(task: ChecklistTask) {
    setTaskFilesTask(task);
    setTaskDocFile(null);
    setTaskDocError(null);
  }

  function closeTaskFiles() {
    setTaskFilesTask(null);
    setTaskDocFile(null);
    setTaskDocError(null);
    void loadTaskAttachmentCounts(tasks.map((task) => String(task.id || "")));
  }

  async function uploadTaskDocument() {
    if (!id || !taskFilesTask) return;
    if (!taskDocFile) {
      setTaskDocError("Seleziona un file.");
      return;
    }
    const safeName = taskDocFile.name.replace(/[^\w.\-]+/g, "_");
    const storagePath = `checklist-tasks/${id}/${taskFilesTask.id}/${Date.now()}_${safeName}`;

    const { error: uploadErr } = await storageUpload(storagePath, taskDocFile);
    if (uploadErr) {
      setTaskDocError("Errore upload file task: " + uploadErr.message);
      return;
    }

    const { data: inserted, error: insErr } = await dbFrom("checklist_task_documents")
      .insert({
        checklist_id: id,
        task_id: taskFilesTask.id,
        filename: taskDocFile.name,
        storage_path: storagePath,
        uploaded_by_operatore: currentOperatoreId || null,
      })
      .select("*")
      .single();
    if (insErr) {
      setTaskDocError("Errore salvataggio metadati file task: " + insErr.message);
      return;
    }

    setTaskDocuments((prev) => [inserted as ChecklistTaskDocument, ...prev]);
    setTaskDocFile(null);
    setTaskDocError(null);
  }

  async function openTaskDocument(doc: ChecklistTaskDocument, download = false) {
    const { data, error: urlErr } = await storageSignedUrl(doc.storage_path);
    if (urlErr || !data?.signedUrl) {
      alert("Errore apertura file task.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteTaskDocument(doc: ChecklistTaskDocument) {
    const ok = confirm(`Eliminare file task "${doc.filename}"?`);
    if (!ok) return;

    const { error: storageErr } = await storageRemove(doc.storage_path);
    if (storageErr) {
      alert("Errore eliminazione file task: " + storageErr.message);
      return;
    }

    const { error: delErr } = await dbFrom("checklist_task_documents")
      .delete()
      .eq("id", doc.id);
    if (delErr) {
      alert("Errore eliminazione metadati file task: " + delErr.message);
      return;
    }

    setTaskDocuments((prev) => prev.filter((x) => x.id !== doc.id));
  }

  async function openDocument(doc: ChecklistDocument, download: boolean) {
    const { data, error: urlErr } = await storageSignedUrl(doc.storage_path);
    if (urlErr || !data?.signedUrl) {
      alert("Errore apertura documento: " + (urlErr?.message || "URL non disponibile"));
      return;
    }
    if (download) {
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = doc.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      window.open(data.signedUrl, "_blank");
    }
  }

  async function deleteDocument(doc: ChecklistDocument) {
    const ok = window.confirm("Eliminare questo documento?");
    if (!ok) return;

    const { error: storageErr } = await storageRemove(doc.storage_path);

    if (storageErr) {
      alert("Errore eliminazione file: " + storageErr.message);
      return;
    }

    const { error: delErr } = await dbFrom("checklist_documents")
      .delete()
      .eq("id", doc.id);

    if (delErr) {
      alert("Errore eliminazione documento: " + delErr.message);
      return;
    }

    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }

  async function resolveOperatoreIdForSave() {
    const res = await fetch("/api/resolve-operatore", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    if (!res.ok) {
      throw new Error(payload?.error || "Operatore non associato.");
    }
    const operatoreId = payload?.operatore_id;
    if (!operatoreId) {
      throw new Error("Operatore non associato.");
    }

    setCurrentOperatoreId(operatoreId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("current_operatore_id", operatoreId);
    }
    return operatoreId;
  }

  async function onSave() {
    if (!id || !formData) return;
    setItemsError(null);

    let operatoreId: string;
    try {
      operatoreId = await resolveOperatoreIdForSave();
    } catch (err: any) {
      alert(err?.message || "Operatore non associato");
      return;
    }

    const baseM2 = calcM2FromDimensioni(formData.dimensioni, formData.numero_facce);
    const qty =
      Number.isFinite(Number(formData.impianto_quantita)) && Number(formData.impianto_quantita) > 0
        ? Number(formData.impianto_quantita)
        : 1;
    const m2Calcolati = baseM2 == null ? null : baseM2 * qty;

    const payload = {
      cliente: formData.cliente.trim() ? formData.cliente.trim() : null,
      cliente_id: formData.cliente_id?.trim() ? formData.cliente_id.trim() : null,
      nome_checklist: formData.nome_checklist.trim()
        ? formData.nome_checklist.trim()
        : null,
      proforma: formData.proforma.trim() ? formData.proforma.trim() : null,
      magazzino_importazione: formData.magazzino_importazione.trim()
        ? formData.magazzino_importazione.trim()
        : null,
      magazzino_drive_url: formData.magazzino_drive_url.trim()
        ? formData.magazzino_drive_url.trim()
        : null,
      saas_tipo: (formData.saas_tipo ?? "").trim() ? (formData.saas_tipo ?? "").trim() : null,
      saas_piano: (formData.saas_piano ?? "").trim() ? (formData.saas_piano ?? "").trim() : null,
      saas_scadenza: formData.saas_scadenza.trim()
        ? formData.saas_scadenza.trim()
        : null,
      saas_stato: formData.saas_stato.trim() ? formData.saas_stato.trim() : null,
      saas_note: formData.saas_note.trim() ? formData.saas_note.trim() : null,
      tipo_saas: null,
      m2_calcolati: m2Calcolati ?? null,
      m2_inclusi: m2Calcolati ?? null,
      m2_allocati: null,
      updated_by_operatore: operatoreId,
      data_prevista: formData.data_prevista.trim()
        ? formData.data_prevista.trim()
        : null,
      data_tassativa: formData.data_tassativa.trim()
        ? formData.data_tassativa.trim()
        : null,
      tipo_impianto: formData.tipo_impianto.trim()
        ? formData.tipo_impianto.trim()
        : null,
      impianto_indirizzo: formData.impianto_indirizzo.trim()
        ? formData.impianto_indirizzo.trim()
        : null,
      impianto_codice: formData.impianto_codice.trim()
        ? formData.impianto_codice.trim()
        : null,
      impianto_descrizione: formData.impianto_descrizione.trim()
        ? formData.impianto_descrizione.trim()
        : null,
      dimensioni: formData.dimensioni.trim() ? formData.dimensioni.trim() : null,
      impianto_quantita:
        Number.isFinite(Number(formData.impianto_quantita)) && Number(formData.impianto_quantita) > 0
          ? Number(formData.impianto_quantita)
          : 1,
      numero_facce:
        Number.isFinite(Number(formData.numero_facce)) && Number(formData.numero_facce) > 0
          ? Number(formData.numero_facce)
          : 1,
      passo: formData.passo.trim() ? formData.passo.trim() : null,
      note: formData.note.trim() ? formData.note.trim() : null,
      tipo_struttura: formData.tipo_struttura.trim()
        ? formData.tipo_struttura.trim()
        : null,
      noleggio_vendita: formData.noleggio_vendita.trim()
        ? formData.noleggio_vendita.trim()
        : null,
      fine_noleggio: formData.fine_noleggio.trim()
        ? formData.fine_noleggio.trim()
        : null,
      mercato: formData.mercato.trim() ? formData.mercato.trim() : null,
      modello: formData.modello.trim() ? formData.modello.trim() : null,
      stato_progetto: formData.stato_progetto.trim()
        ? formData.stato_progetto.trim()
        : null,
      data_installazione_reale: formData.data_installazione_reale.trim()
        ? formData.data_installazione_reale.trim()
        : null,
      garanzia_scadenza: formData.garanzia_scadenza.trim()
        ? formData.garanzia_scadenza.trim()
        : null,
    };

    const isClienteIdMissing = (err: any) => {
      const msg = `${err?.message || ""}`.toLowerCase();
      const code = `${err?.code || ""}`.toLowerCase();
      return (
        code === "pgrst204" ||
        (msg.includes("cliente_id") && msg.includes("does not exist")) ||
        (msg.includes("cliente_id") && msg.includes("column"))
      );
    };
    const isImpiantoQuantitaMissing = (err: any) => {
      const msg = `${err?.message || ""}`.toLowerCase();
      const code = `${err?.code || ""}`.toLowerCase();
      return (
        code === "pgrst204" ||
        (msg.includes("impianto_quantita") && msg.includes("does not exist")) ||
        (msg.includes("impianto_quantita") && msg.includes("column"))
      );
    };
    const isOperatoreFkError = (err: any) => {
      const msg = `${err?.message || ""}`.toLowerCase();
      const details = `${err?.details || ""}`.toLowerCase();
      const code = `${err?.code || ""}`.toLowerCase();
      return (
        code === "23503" &&
        (msg.includes("created_by_operatore") ||
          msg.includes("updated_by_operatore") ||
          details.includes("operatori"))
      );
    };

    const tryUpdate = async (payloadUpdate: Partial<typeof payload>) => {
      return dbFrom("checklists").update(payloadUpdate).eq("id", id);
    };

    let driveFallbackUsed = false;
    let { error: errUpdate } = await tryUpdate(payload);

    if (errUpdate && isMissingMagazzinoDriveColumnError(errUpdate)) {
      const { magazzino_drive_url, ...legacyPayload } = payload;
      driveFallbackUsed = true;
      ({ error: errUpdate } = await tryUpdate(legacyPayload));
    }
    if (errUpdate && isClienteIdMissing(errUpdate)) {
      const sourcePayload = driveFallbackUsed
        ? (({ magazzino_drive_url: _skip, ...rest }) => rest)(payload)
        : payload;
      const { cliente_id, ...legacyPayload } = sourcePayload;
      ({ error: errUpdate } = await tryUpdate(legacyPayload));
    }
    if (errUpdate && isImpiantoQuantitaMissing(errUpdate)) {
      const sourcePayload = driveFallbackUsed
        ? (({ magazzino_drive_url: _skip, ...rest }) => rest)(payload)
        : payload;
      const { impianto_quantita, ...legacyPayload } = sourcePayload;
      ({ error: errUpdate } = await tryUpdate(legacyPayload));
    }
    if (errUpdate && isOperatoreFkError(errUpdate)) {
      const sourcePayload = driveFallbackUsed
        ? (({ magazzino_drive_url: _skip, ...rest }) => rest)(payload)
        : payload;
      const { updated_by_operatore, ...legacyPayload } = sourcePayload;
      ({ error: errUpdate } = await tryUpdate(legacyPayload));
    }

    if (errUpdate) {
      const info = logSupabaseError("update checklist", errUpdate);
      alert("Errore salvataggio: " + (info || errUpdate.message));
      return;
    }
    if (driveFallbackUsed && formData.magazzino_drive_url.trim()) {
      alert(
        "Checklist salvata. Il link Drive magazzino non e' stato salvato: colonna non disponibile nello schema cache / ambiente non migrato."
      );
    }

    const normalizedRows = rows
      .map((r) => ({
        id: r.id,
        codice: normalizeCustomCode(r.codice.trim()),
        descrizione: r.descrizione.trim(),
        descrizione_custom: (r.descrizione_custom ?? "").trim(),
        quantita: r.quantita.trim(),
        note: r.note.trim(),
      }))
      .filter((r) => {
        return (
          r.codice ||
          r.descrizione ||
          r.descrizione_custom ||
          r.quantita ||
          r.note
        );
      });

    for (const r of normalizedRows) {
      if (r.quantita !== "" && !isFiniteNumberString(r.quantita)) {
        setItemsError(`Quantita non valida (deve essere numero): "${r.quantita}"`);
        return;
      }
      if (isCustomCode(r.codice) && r.descrizione_custom === "") {
        setItemsError("Inserisci la descrizione per la voce fuori catalogo.");
        return;
      }
      if (!isCustomCode(r.codice) && startsWithTecOrSas(r.codice)) {
        setItemsError("TEC e SAAS si gestiscono nelle sezioni dedicate.");
        return;
      }
      if (
        isCustomCode(r.codice) &&
        (startsWithTecOrSas(r.descrizione_custom) || startsWithTecOrSas(r.descrizione))
      ) {
        setItemsError("TEC e SAAS si gestiscono nelle sezioni dedicate.");
        return;
      }
      if (!r.codice || (!isCustomCode(r.codice) && !r.descrizione)) {
        setItemsError("Seleziona una voce valida dal catalogo.");
        return;
      }
    }

    const existingPayload = normalizedRows
      .filter((r) => r.id)
      .map((r) => ({
        id: r.id as string,
        checklist_id: id,
        codice: r.codice ? r.codice : null,
        descrizione: isCustomCode(r.codice)
          ? r.descrizione_custom || null
          : r.descrizione
          ? r.descrizione
          : null,
        quantita: r.quantita === "" ? null : Number(r.quantita),
        note: r.note ? r.note : null,
      }));

    if (existingPayload.length > 0) {
      const { error: itemsUpdateErr } = await dbFrom("checklist_items")
        .upsert(existingPayload, { onConflict: "id" });

      if (itemsUpdateErr) {
        const info = logSupabaseError("update checklist_items", itemsUpdateErr);
        setItemsError("Errore salvataggio righe: " + (info || itemsUpdateErr.message));
        return;
      }
    }

    const insertPayload = normalizedRows
      .filter((r) => !r.id)
      .map((r) => ({
        checklist_id: id,
        codice: r.codice ? r.codice : null,
        descrizione: isCustomCode(r.codice)
          ? r.descrizione_custom || null
          : r.descrizione
          ? r.descrizione
          : null,
        quantita: r.quantita === "" ? null : Number(r.quantita),
        note: r.note ? r.note : null,
      }));

    if (insertPayload.length > 0) {
      const { error: itemsInsertErr } = await dbFrom("checklist_items")
        .insert(insertPayload);

      if (itemsInsertErr) {
        const info = logSupabaseError("insert checklist_items", itemsInsertErr);
        setItemsError("Errore inserimento righe: " + (info || itemsInsertErr.message));
        return;
      }
    }

    const remainingIds = new Set(
      normalizedRows.map((r) => r.id).filter((id): id is string => Boolean(id))
    );
    const deletedIds = originalRowIds.filter((rowId) => !remainingIds.has(rowId));

    if (deletedIds.length > 0) {
      const { error: itemsDeleteErr } = await dbFrom("checklist_items")
        .delete()
        .in("id", deletedIds);

      if (itemsDeleteErr) {
        const info = logSupabaseError("delete checklist_items", itemsDeleteErr);
        setItemsError("Errore eliminazione righe: " + (info || itemsDeleteErr.message));
        return;
      }
    }

    setEditMode(false);
    await load(id);
  }

  function onCancel() {
    if (originalData) setFormData(originalData);
    setEditingLicenzaId(null);
    setEditingLicenza(null);
    setEditMode(false);
    if (id) {
      load(id);
    }
  }

  async function onDeleteChecklist() {
    if (!id) return;
    const ok = confirm(
      "Sei sicuro di voler eliminare questa checklist? L'operazione e' irreversibile."
    );
    if (!ok) return;

    const { error: itemsErr } = await dbFrom("checklist_items")
      .delete()
      .eq("checklist_id", id);
    if (itemsErr) {
      const msg =
        logSupabaseError("delete checklist_items", itemsErr) ||
        "Errore eliminazione righe checklist";
      alert(msg);
      setItemsError(msg);
      return;
    }

    const { error: licensesErr } = await dbFrom("licenses")
      .delete()
      .eq("checklist_id", id);
    if (licensesErr) {
      const msg =
        logSupabaseError("delete licenses", licensesErr) ||
        "Errore eliminazione licenze checklist";
      alert(msg);
      setItemsError(msg);
      return;
    }

    const { data: docsData, error: docsErr } = await db<any[]>({
      table: "checklist_documents",
      op: "select",
      select: "id, storage_path",
      filter: { checklist_id: id },
      limit: 1000,
    });
    if (docsErr) {
      const msg =
        logSupabaseError("load checklist_documents", docsErr) ||
        "Errore caricamento documenti checklist";
      alert(msg);
      setItemsError(msg);
      return;
    }

    let taskDocsData: any[] = [];
    {
      const { data, error } = await db<any[]>({
        table: "checklist_task_documents",
        op: "select",
        select: "id, storage_path",
        filter: { checklist_id: id },
        limit: 1000,
      });
      if (!error) {
        taskDocsData = data || [];
      } else {
        const msg = String(error.message || "").toLowerCase();
        const missingTable =
          msg.includes("checklist_task_documents") &&
          (msg.includes("does not exist") ||
            msg.includes("relation") ||
            msg.includes("could not find the table") ||
            msg.includes("schema cache"));
        if (!missingTable) {
          const emsg =
            logSupabaseError("load checklist_task_documents", error) ||
            "Errore caricamento allegati task";
          alert(emsg);
          setItemsError(emsg);
          return;
        }
      }
    }
    const paths = (docsData || [])
      .map((d: any) => d.storage_path)
      .filter(Boolean);
    const taskPaths = (taskDocsData || [])
      .map((d: any) => d.storage_path)
      .filter(Boolean);
    const allPaths = [...paths, ...taskPaths];
    if (allPaths.length > 0) {
      let storageErr: { message: string } | null = null;
      for (const path of allPaths) {
        const rm = await storageRemove(path);
        if (rm.error) {
          storageErr = rm.error;
          break;
        }
      }
      if (storageErr) {
        const msg =
          logSupabaseError("delete storage files", storageErr) ||
          "Errore eliminazione file documenti";
        alert(msg);
        setItemsError(msg);
        return;
      }
    }

    const { error: docsDeleteErr } = await dbFrom("checklist_documents")
      .delete()
      .eq("checklist_id", id);
    if (docsDeleteErr) {
      const msg =
        logSupabaseError("delete checklist_documents", docsDeleteErr) ||
        "Errore eliminazione documenti checklist";
      alert(msg);
      setItemsError(msg);
      return;
    }

    const { error: taskDocsDeleteErr } = await dbFrom("checklist_task_documents")
      .delete()
      .eq("checklist_id", id);
    if (taskDocsDeleteErr) {
      const msgLower = String(taskDocsDeleteErr.message || "").toLowerCase();
      const missingTable =
        msgLower.includes("checklist_task_documents") &&
        (msgLower.includes("does not exist") || msgLower.includes("relation"));
      if (!missingTable) {
        const msg =
          logSupabaseError("delete checklist_task_documents", taskDocsDeleteErr) ||
          "Errore eliminazione allegati task";
        alert(msg);
        setItemsError(msg);
        return;
      }
    }

    const { error: checklistErr } = await dbFrom("checklists").delete().eq("id", id);
    if (checklistErr) {
      const msg =
        logSupabaseError("delete checklists", checklistErr) ||
        "Errore eliminazione checklist";
      alert(msg);
      setItemsError(msg);
      return;
    }

    router.push("/");
  }

  const isEdit = editMode && formData != null;
  function enterEditMode() {
    if (!checklist) return;
    try {
      setFormData(buildFormData(checklist));
      setEditMode(true);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Errore apertura modifica: ${msg}`);
      setEditMode(false);
    }
  }

  const proformaDocs = documents.filter(
    (d) => String(d.tipo ?? "").toUpperCase() === "FATTURA_PROFORMA" || String(d.tipo ?? "").toUpperCase() === "PROFORMA"
  );
  const hasProformaDoc = proformaDocs.length > 0;
  const proformaDocTitle = hasProformaDoc
    ? `Documento PROFORMA: ${proformaDocs[0].filename}`
    : "Documento PROFORMA presente";

  const projectRenewalsAll = [
    ...(checklist?.saas_piano && checklist?.id === id
      ? [
          {
            id: "SAAS",
            key: "SAAS",
            source: "saas" as const,
            recordId: checklist.id,
            item_tipo: "SAAS",
            tipo: "SAAS",
            riferimento: checklist.saas_piano || "—",
            scadenza: checklist.saas_scadenza || null,
            stato: checklist.saas_stato || "DA_AVVISARE",
            modalita: "—",
            note: checklist.saas_note || null,
            checklist_id: checklist.id,
          },
        ]
      : []),
    ...(checklist?.garanzia_scadenza && checklist?.id === id
      ? [
          {
            id: "GARANZIA",
            key: "GARANZIA",
            source: "garanzie" as const,
            recordId: checklist.id,
            item_tipo: "GARANZIA",
            tipo: "GARANZIA",
            riferimento: "Garanzia impianto",
            scadenza: checklist.garanzia_scadenza || null,
            stato: "DA_AVVISARE",
            modalita: "—",
            note: null,
            checklist_id: checklist.id,
          },
        ]
      : []),
    ...licenze
      .filter((l) => String(l.checklist_id || "") === String(id || ""))
      .map((l) => ({
        id: l.id,
        key: `LIC-${l.id}`,
        source: "licenze" as const,
        recordId: l.id,
        item_tipo: "LICENZA",
        tipo: "LICENZA",
        riferimento: l.tipo || "—",
        scadenza: l.scadenza || null,
        stato: l.stato || "ATTIVA",
        modalita: "—",
        note: l.note || null,
        checklist_id: id || "",
      })),
    ...projectTagliandi
      .filter((t) => String(t.checklist_id || "") === String(id || ""))
      .map((t) => ({
        id: t.id,
        key: `TAG-${t.id}`,
        source: "tagliandi" as const,
        recordId: t.id,
        item_tipo: "TAGLIANDO",
        tipo: "TAGLIANDO",
        riferimento: t.note || "Tagliando periodico",
        scadenza: t.scadenza || null,
        stato: t.stato || "ATTIVA",
        modalita: t.modalita || "—",
        note: t.note || null,
        checklist_id: id || "",
      })),
    ...projectRinnovi
      .filter((r) => String(r.checklist_id || "") === String(id || ""))
      .map((r) => ({
        id: r.id,
        key: `RIN-${r.id}`,
        source: "rinnovi" as const,
        recordId: r.id,
        item_tipo: String(r.item_tipo || "RINNOVO").toUpperCase(),
        tipo: String(r.item_tipo || "RINNOVO").toUpperCase(),
        riferimento: r.riferimento || r.descrizione || "Rinnovo",
        scadenza: r.scadenza || null,
        stato: r.stato || "DA_AVVISARE",
        modalita: "—",
        note: r.note || null,
        checklist_id: id || "",
      })),
  ].filter((row) => String((row as any).checklist_id || "") === String(id || ""));

  let filteredProjectRenewals = projectRenewalsAll;
  if (rinnoviFilterDaAvvisare) {
    filteredProjectRenewals = filteredProjectRenewals.filter(
      (r) => getProjectWorkflowStato(r as ProjectRenewalRow) === "DA_AVVISARE"
    );
  }
  if (rinnoviFilterDaFatturare) {
    filteredProjectRenewals = filteredProjectRenewals.filter(
      (r) => getProjectWorkflowStato(r as ProjectRenewalRow) === "DA_FATTURARE"
    );
  }
  if (rinnoviFilterScaduti) {
    filteredProjectRenewals = filteredProjectRenewals.filter((r) => {
      const dt = parseLocalDay((r as any).scadenza);
      if (!dt) return false;
      return dt < startOfToday();
    });
  }

  function renderProjectAvvisatoBadge(stats?: AlertStats | null) {
    const count = stats?.n_avvisi ?? null;
    const label = count != null ? `AVVISATO (${count})` : "AVVISATO";
    const lastSent = stats?.last_sent_at
      ? new Date(stats.last_sent_at).toLocaleString()
      : "—";
    const recipients =
      stats && stats.last_recipients.length > 0
        ? `Ultimi destinatari:\n${stats.last_recipients.join("\n")}`
        : "Ultimi destinatari: —";
    const tooltip = stats
      ? `Ultimo invio: ${lastSent}\nOperatori: ${stats.n_operatore}\nEmail manuali: ${stats.n_email_manual}\n${recipients}`
      : undefined;
    return (
      <span title={tooltip}>
        {renderRinnovoStatoBadge(label)}
      </span>
    );
  }

  const projectInterventiBlock = (
    <InterventiBlock
      checklists={
        checklist
          ? [
              {
                id: checklist.id,
                nome_checklist: checklist.nome_checklist,
                proforma: checklist.proforma,
                magazzino_importazione: splitMagazzinoFields(
                  checklist.magazzino_importazione,
                  checklist.magazzino_drive_url
                ).codice,
              },
            ]
          : []
      }
      interventi={projectInterventi}
      interventiInfo={projectInterventiNotice}
      interventiError={projectInterventiError}
      alertNotice={null}
      setInterventiNotice={setProjectInterventiNotice}
      includedUsed={interventiInclusiUsati}
      includedTotal={contrattoUltra?.illimitati ? null : contrattoUltra?.interventi_annui ?? null}
      includedResidual={
        contrattoUltra?.illimitati
          ? null
          : contrattoUltra?.interventi_annui != null
          ? Math.max(0, contrattoUltra.interventi_annui - interventiInclusiUsati)
          : null
      }
      includedSummaryOverride={!contrattoUltra ? " / Totale inclusi: —" : null}
      attachmentCounts={projectInterventoAttachmentCounts}
      getOperatoreNome={(value) => operatoriMap.get(String(value || "")) || String(value || "—")}
      currentOperatoreRole={alertOperatori.find((row) => row.id === currentOperatoreId)?.ruolo ?? null}
      currentProjectLabel={checklist?.nome_checklist || "—"}
      newIntervento={{
        data: newProjectIntervento.data,
        dataTassativa: newProjectIntervento.data_tassativa,
        descrizione: newProjectIntervento.descrizione,
        ticketNo: newProjectIntervento.ticket_no,
        incluso: newProjectIntervento.incluso,
        checklistId: id || "",
        proforma: newProjectIntervento.proforma,
        codiceMagazzino: newProjectIntervento.codice_magazzino,
        fatturazioneStato: newProjectIntervento.fatturazione_stato,
        statoIntervento: newProjectIntervento.stato_intervento,
        esitoFatturazione: "",
        numeroFattura: "",
        fatturatoIl: "",
        note: newProjectIntervento.note,
        noteTecniche: "",
      }}
      setNewIntervento={(value) =>
        setNewProjectIntervento((prev) => ({
          ...prev,
          data: value.data,
          data_tassativa: value.dataTassativa,
          descrizione: value.descrizione,
          ticket_no: value.ticketNo,
          incluso: value.incluso,
          proforma: value.proforma,
          codice_magazzino: value.codiceMagazzino,
          fatturazione_stato: value.fatturazioneStato,
          stato_intervento: value.statoIntervento,
          note: value.note,
        }))
      }
      newInterventoFiles={projectInterventoFiles}
      setNewInterventoFiles={setProjectInterventoFiles}
      addIntervento={addInterventoRow}
      editInterventoId={projectInterventoEditId}
      setEditInterventoId={setProjectInterventoEditId}
      editIntervento={{
        data: projectInterventoEditForm?.data || "",
        dataTassativa: projectInterventoEditForm?.data_tassativa || "",
        descrizione: projectInterventoEditForm?.descrizione || "",
        ticketNo: projectInterventoEditForm?.ticket_no || "",
        incluso: projectInterventoEditForm?.incluso ?? true,
        checklistId: id || "",
        proforma: projectInterventoEditForm?.proforma || "",
        codiceMagazzino: projectInterventoEditForm?.codice_magazzino || "",
        fatturazioneStato: projectInterventoEditForm?.fatturazione_stato || "DA_FATTURARE",
        statoIntervento: projectInterventoEditForm?.stato_intervento || "APERTO",
        esitoFatturazione: "",
        numeroFattura: "",
        fatturatoIl: "",
        note: projectInterventoEditForm?.note || "",
        noteTecniche: "",
      }}
      setEditIntervento={(value) =>
        setProjectInterventoEditForm((prev) =>
          prev
            ? {
                ...prev,
                data: value.data,
                data_tassativa: value.dataTassativa,
                descrizione: value.descrizione,
                ticket_no: value.ticketNo,
                incluso: value.incluso,
                proforma: value.proforma,
                codice_magazzino: value.codiceMagazzino,
                fatturazione_stato: value.fatturazioneStato,
                stato_intervento: value.statoIntervento,
                note: value.note,
              }
            : prev
        )
      }
      startEditIntervento={(row) => startEditInterventoRow(row as InterventoRow)}
      saveEditIntervento={saveInterventoRow}
      expandedInterventoId={projectInterventiExpandedId}
      setExpandedInterventoId={setProjectInterventiExpandedId}
      deleteIntervento={deleteInterventoRow}
      closeInterventoId={projectCloseInterventoId}
      setCloseInterventoId={setProjectCloseInterventoId}
      closeEsito={projectCloseEsito}
      setCloseEsito={setProjectCloseEsito}
      closeNote={projectCloseNote}
      setCloseNote={setProjectCloseNote}
      closeError={projectCloseError}
      setCloseError={setProjectCloseError}
      confirmCloseIntervento={confirmProjectCloseIntervento}
      alertInterventoId={projectInterventoAlertId}
      setAlertInterventoId={setProjectInterventoAlertId}
      alertDestinatarioId={projectInterventoAlertToOperatoreId}
      setAlertDestinatarioId={setProjectInterventoAlertToOperatoreId}
      alertMessaggio={projectInterventoAlertMsg}
      setAlertMessaggio={setProjectInterventoAlertMsg}
      alertSendEmail={projectInterventoAlertSendEmail}
      setAlertSendEmail={setProjectInterventoAlertSendEmail}
      sending={projectInterventoAlertSending}
      sendErr={projectInterventoAlertErr}
      sendOk={projectInterventoAlertOk}
      sendInterventoAlert={sendProjectInterventoAlert}
      openAlertModal={(row) => openProjectInterventoAlertModal(row as InterventoRow)}
      getAlertRecipients={getProjectInterventoAlertRecipients}
      bulkOpen={projectInterventoBulkOpen}
      setBulkOpen={setProjectInterventoBulkOpen}
      bulkToOperatoreId={projectInterventoBulkToOperatoreId}
      setBulkToOperatoreId={setProjectInterventoBulkToOperatoreId}
      bulkMsg={projectInterventoBulkMsg}
      setBulkMsg={setProjectInterventoBulkMsg}
      bulkSendEmail={projectInterventoBulkSendEmail}
      setBulkSendEmail={setProjectInterventoBulkSendEmail}
      bulkSending={projectInterventoBulkSending}
      bulkErr={projectInterventoBulkErr}
      bulkOk={projectInterventoBulkOk}
      sendBulkFatturaAlert={sendProjectBulkFatturaAlert}
      getFatturaAlertRecipients={getProjectFatturaAlertRecipients}
      bulkLastSentAt={projectInterventoBulkLastSentAt}
      bulkLastToOperatoreId={projectInterventoBulkLastToOperatoreId}
      bulkLastMessage={projectInterventoBulkLastMessage}
      bulkPreviewOpen={projectInterventoBulkPreviewOpen}
      setBulkPreviewOpen={setProjectInterventoBulkPreviewOpen}
      openBulkAlertModal={openProjectBulkInterventoAlertModal}
      reopenIntervento={reopenInterventoRow}
    />
  );

  const accessoriRicambiBlock = (
    <div style={mainSectionStyle}>
      <div style={mainSectionTitleStyle}>Accessori / Ricambi</div>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
        Accessori/Extra (no TEC, no SAAS)
      </div>

      {itemsError && (
        <div style={{ color: "crimson", marginBottom: 10 }}>{itemsError}</div>
      )}

      {editMode && (
        <div style={{ marginBottom: 10 }}>
          <button type="button" onClick={addRow} style={{ padding: "8px 12px" }}>
            + Aggiungi riga
          </button>
        </div>
      )}

      {!editMode ? (
        rows.length === 0 ? (
          <div>Nessuna riga inserita</div>
        ) : (
          <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 120px 1fr",
                gap: 0,
                padding: 10,
                fontWeight: 700,
                borderBottom: "1px solid #eee",
              }}
            >
              <div>Codice</div>
              <div>Descrizione</div>
              <div>Q.tà</div>
              <div>Note</div>
            </div>

            {rows.map((r) => (
              <div
                key={r.id ?? r.client_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 1fr 120px 1fr",
                  gap: 0,
                  padding: 10,
                  borderBottom: "1px solid #f1f1f1",
                }}
              >
                <div>{normalizeCustomCode(r.codice) || "—"}</div>
                <div>
                  {isCustomCode(r.codice) ? r.descrizione_custom || "—" : r.descrizione || "—"}
                </div>
                <div>{r.quantita || "—"}</div>
                <div>{r.note || "—"}</div>
              </div>
            ))}
          </div>
        )
      ) : rows.length === 0 ? (
        <div>Nessuna riga inserita</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r, idx) => (
            <div
              key={r.id ?? r.client_id}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 1fr 120px 1fr 120px",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <label>
                  Codice<br />
                  <input
                    value={normalizeCustomCode(r.codice)}
                    disabled
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>

                <label>
                  Descrizione<br />
                  <input
                    type="text"
                    placeholder="Cerca per codice o descrizione (extra/accessori)"
                    value={r.search ?? ""}
                    onChange={(e) => updateRowFields(idx, { search: e.target.value })}
                    style={{ width: "100%", padding: 10, marginBottom: 8 }}
                  />
                  <select
                    value={isCustomCode(r.codice) ? "__CUSTOM__" : r.descrizione}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "__CUSTOM__") {
                        updateRowFields(idx, {
                          descrizione: "Altro / Fuori catalogo",
                          codice: "CUSTOM",
                          descrizione_custom: "",
                        });
                        return;
                      }
                      const selected = vociProdottiOptions.find(
                        (c) => c.descrizione === value
                      );
                      updateRowFields(idx, {
                        descrizione: selected?.descrizione ?? "",
                        codice: selected?.codice ?? "",
                        descrizione_custom: "",
                      });
                    }}
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="">— seleziona prodotto / servizio —</option>
                    <option value="__CUSTOM__">Altro / Fuori catalogo</option>
                    {vociProdottiOptions
                      .filter((item) => {
                        const s = (r.search ?? "").trim().toLowerCase();
                        if (!s) return true;
                        const descr = (item.descrizione ?? "").toLowerCase();
                        const code = (item.codice ?? "").toLowerCase();
                        return `${code} ${descr}`.includes(s);
                      })
                      .slice(0, 200)
                      .map((item) => (
                        <option
                          key={`${item.codice ?? "NO_CODE"}__${item.descrizione ?? ""}`}
                          value={item.descrizione ?? ""}
                        >
                          {item.codice ?? "—"} — {item.descrizione ?? "—"}
                        </option>
                      ))}
                  </select>

                  {isCustomCode(r.codice) && (
                    <div style={{ marginTop: 8 }}>
                      <label
                        style={{ display: "block", fontWeight: 600, marginBottom: 4 }}
                      >
                        Descrizione (fuori catalogo)
                      </label>
                      <input
                        type="text"
                        value={r.descrizione_custom ?? ""}
                        onChange={(e) =>
                          updateRowFields(idx, {
                            descrizione_custom: e.target.value,
                          })
                        }
                        placeholder="Es: Schermo P2.6 3x2m + struttura speciale..."
                        style={{ width: "100%", padding: 10 }}
                      />
                    </div>
                  )}
                </label>

                <label>
                  Q.tà<br />
                  <input
                    type="number"
                    value={r.quantita}
                    onChange={(e) => updateRowFields(idx, { quantita: e.target.value })}
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>

                <label>
                  Note<br />
                  <input
                    value={r.note}
                    onChange={(e) => updateRowFields(idx, { note: e.target.value })}
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>

                <div>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    style={{ padding: "8px 12px" }}
                  >
                    Rimuovi
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>CHECK LIST</div>
        </div>
        <a
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
        </a>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, marginBottom: 10 }}>
        {!editMode ? (
          <button
            onClick={enterEditMode}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            Modifica
          </button>
        ) : (
          <>
            <button
              onClick={onSave}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                cursor: "pointer",
                marginLeft: "auto",
              }}
            >
              Salva
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
            >
              Annulla
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 12, marginBottom: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
              background: "white",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>PROGETTO</div>
            <FieldRow
              label="Nome checklist"
              view={checklist.nome_checklist || "—"}
              edit={
                isEdit ? (
                  <input
                    value={formData.nome_checklist}
                    onChange={(e) =>
                      setFormData({ ...formData, nome_checklist: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  />
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Cliente"
              view={
                checklist.cliente ? (
                  <Link
                    href={`/clienti/${encodeURIComponent(checklist.cliente)}`}
                    style={{ textDecoration: "underline", color: "#2563eb" }}
                  >
                    {checklist.cliente}
                  </Link>
                ) : (
                  "—"
                )
              }
              edit={
                isEdit ? (
                  <ClientiCombobox
                    value={formData.cliente}
                    onValueChange={(v) => setFormData({ ...formData, cliente: v })}
                    selectedId={formData.cliente_id || null}
                    onSelectId={(id) =>
                      setFormData({ ...formData, cliente_id: id || "" })
                    }
                    placeholder="Cerca cliente..."
                  />
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Proforma"
              view={
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{checklist.proforma || "—"}</span>
                  {hasProformaDoc ? (
                    <span title={proformaDocTitle}>✅</span>
                  ) : (
                    "—"
                  )}
                </div>
              }
              edit={
                isEdit ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={formData.proforma}
                      onChange={(e) => setFormData({ ...formData, proforma: e.target.value })}
                      style={{ width: "100%", padding: 10 }}
                    />
                    {hasProformaDoc ? (
                      <span title={proformaDocTitle}>✅</span>
                    ) : (
                      "—"
                    )}
                  </div>
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Noleggio / Vendita / Service"
              view={checklist.noleggio_vendita || "—"}
              edit={
                isEdit ? (
                  <select
                    value={formData.noleggio_vendita}
                    onChange={(e) =>
                      setFormData({ ...formData, noleggio_vendita: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="">—</option>
                    <option value="NOLEGGIO">NOLEGGIO</option>
                    <option value="VENDITA">VENDITA</option>
                    <option value="SERVICE">SERVICE</option>
                    <option value="ALTRO">ALTRO</option>
                  </select>
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Stato progetto"
              view={checklist.stato_progetto || "—"}
              edit={
                isEdit ? (
                  <select
                    value={formData.stato_progetto}
                    onChange={(e) =>
                      setFormData({ ...formData, stato_progetto: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="IN_CORSO">IN_CORSO</option>
                    <option value="CONSEGNATO">CONSEGNATO</option>
                    <option value="RIENTRATO">RIENTRATO</option>
                    <option value="CHIUSO">CHIUSO</option>
                    <option value="SOSPESO">SOSPESO</option>
                  </select>
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Note"
              view={checklist.note || "—"}
              edit={
                isEdit ? (
                  <input
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    style={{ width: "100%", padding: 10 }}
                  />
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Creato"
              view={new Date(checklist.created_at).toLocaleString()}
              isEdit={false}
            />
            <FieldRow
              label="Modificato"
              view={checklist.updated_at ? new Date(checklist.updated_at).toLocaleString() : "—"}
              isEdit={false}
            />
            <FieldRow
              label="Creato da"
              view={
                checklist.created_by_name ??
                (checklist.created_by_operatore
                  ? operatoriMap.get(checklist.created_by_operatore) ??
                    checklist.created_by ??
                    "—"
                  : checklist.created_by ?? "—")
              }
              isEdit={false}
            />
            <FieldRow
              label="Modificato da"
              view={
                checklist.updated_by_name ??
                (checklist.updated_by_operatore
                  ? operatoriMap.get(checklist.updated_by_operatore) ??
                    checklist.updated_by ??
                    "—"
                  : checklist.updated_by ?? "—")
              }
              isEdit={false}
            />
          </div>

          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
              background: "white",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>IMPIANTO</div>
            <FieldRow
              label="Descrizione impianto (TEC)"
              view={
                checklist.impianto_codice
                  ? `${checklist.impianto_codice} — ${checklist.impianto_descrizione || "—"}`
                  : "—"
              }
              edit={
                isEdit ? (
                  <select
                    value={getImpiantoSelectValue(
                      impiantoOptions as any,
                      formData.impianto_codice,
                      formData.impianto_descrizione
                    )}
                    onChange={(e) => {
                      const selected = impiantoOptions.find((i) => i.id === e.target.value);
                      setFormData({
                        ...formData,
                        impianto_codice: selected?.codice ?? "",
                        impianto_descrizione: selected?.descrizione ?? "",
                      });
                    }}
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="">— seleziona impianto TEC —</option>
                    {impiantoOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.codice ?? "—"} — {item.descrizione ?? "—"}
                      </option>
                    ))}
                  </select>
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Dimensioni + m²"
              view={`${checklist.dimensioni || "—"} — ${
                m2Persisted != null ? m2Persisted.toFixed(2) : "—"
              } (${checklist.numero_facce ?? 1} facce x ${
                Number.isFinite(Number(checklist.impianto_quantita)) &&
                Number(checklist.impianto_quantita) > 0
                  ? Number(checklist.impianto_quantita)
                  : 1
              } impianti)`}
              edit={
                isEdit ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
                      <input
                        value={dimensioniLocal}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDimensioniLocal(value);
                          setFormData((prev) => (prev ? { ...prev, dimensioni: value } : prev));
                        }}
                        readOnly={false}
                        disabled={false}
                        placeholder="Es: 3x2"
                        style={{ width: "100%", padding: 10 }}
                      />
                      <div
                        style={{
                          width: "100%",
                          padding: 10,
                          background: "#f7f7f7",
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                        }}
                      >
                        {m2CalcolatiTotali != null ? m2CalcolatiTotali.toFixed(2) : ""}
                      </div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={formData.numero_facce === 2}
                        onChange={(e) =>
                          setFormData({ ...formData, numero_facce: e.target.checked ? 2 : 1 })
                        }
                      />
                      Bifacciale ({formData.numero_facce} facce)
                    </label>
                  </div>
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Quantita impianti"
              view={
                Number.isFinite(Number(checklist.impianto_quantita)) &&
                Number(checklist.impianto_quantita) > 0
                  ? String(checklist.impianto_quantita)
                  : "1"
              }
              edit={
                isEdit ? (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={formData.impianto_quantita}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setFormData({
                        ...formData,
                        impianto_quantita:
                          Number.isFinite(next) && next > 0 ? Math.floor(next) : 1,
                      });
                    }}
                    style={{ width: "100%", padding: 10 }}
                  />
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Passo"
              view={checklist.passo || "—"}
              edit={
                isEdit ? (
                  <input
                    value={formData.passo}
                    onChange={(e) => setFormData({ ...formData, passo: e.target.value })}
                    style={{ width: "100%", padding: 10 }}
                  />
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Tipo impianto"
              view={checklist.tipo_impianto || "—"}
              edit={
                isEdit ? (
                  <select
                    value={formData.tipo_impianto}
                    onChange={(e) =>
                      setFormData({ ...formData, tipo_impianto: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="">—</option>
                    <option value="INDOOR">INDOOR</option>
                    <option value="OUTDOOR">OUTDOOR</option>
                    <option value="SEMIOUTDOOR">SEMIOUTDOOR</option>
                    <option value="DA DEFINIRE">DA DEFINIRE</option>
                  </select>
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Indirizzo impianto"
              view={checklist.impianto_indirizzo || "—"}
              edit={
                isEdit ? (
                  <input
                    value={formData.impianto_indirizzo}
                    onChange={(e) =>
                      setFormData({ ...formData, impianto_indirizzo: e.target.value })
                    }
                    placeholder="Es. Via Roma 10, Milano"
                    style={{ width: "100%", padding: 10 }}
                  />
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Tipo struttura"
              view={checklist.tipo_struttura || "—"}
              edit={
                isEdit ? (
                  <select
                    value={formData.tipo_struttura}
                    onChange={(e) =>
                      setFormData({ ...formData, tipo_struttura: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="">—</option>
                    {strutturaOptions.map((item) => (
                      <option key={item.id} value={item.codice ?? ""}>
                        {item.codice} — {item.descrizione}
                      </option>
                    ))}
                    {formData.tipo_struttura &&
                      !strutturaOptions.some((o) => o.codice === formData.tipo_struttura) && (
                        <option value={formData.tipo_struttura}>{formData.tipo_struttura}</option>
                      )}
                  </select>
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Data installazione prevista"
              view={
                checklist.data_prevista
                  ? new Date(checklist.data_prevista).toLocaleDateString()
                  : "—"
              }
              edit={
                isEdit ? (
                  <input
                    type="date"
                    value={formData.data_prevista}
                    onChange={(e) =>
                      setFormData({ ...formData, data_prevista: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  />
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Data tassativa"
              view={
                checklist.data_tassativa
                  ? new Date(checklist.data_tassativa).toLocaleDateString()
                  : "—"
              }
              edit={
                isEdit ? (
                  <input
                    type="date"
                    value={formData.data_tassativa}
                    onChange={(e) =>
                      setFormData({ ...formData, data_tassativa: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  />
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Installazione reale"
              view={
                checklist.data_installazione_reale
                  ? new Date(checklist.data_installazione_reale).toLocaleDateString()
                  : "—"
              }
              edit={
                isEdit ? (
                  <input
                    type="date"
                    value={formData.data_installazione_reale}
                    onChange={(e) =>
                      setFormData({ ...formData, data_installazione_reale: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  />
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Fine noleggio"
              view={
                checklist.fine_noleggio
                  ? new Date(checklist.fine_noleggio).toLocaleDateString()
                  : "—"
              }
              edit={
                isEdit ? (
                  <input
                    type="date"
                    value={formData.fine_noleggio}
                    onChange={(e) =>
                      setFormData({ ...formData, fine_noleggio: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  />
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Garanzia scadenza"
              view={
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>
                    {checklist.garanzia_scadenza
                      ? new Date(checklist.garanzia_scadenza).toLocaleDateString()
                      : "—"}
                  </span>
                  {renderBadge(getExpiryStatus(checklist.garanzia_scadenza))}
                </div>
              }
              edit={
                isEdit ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="date"
                      value={formData.garanzia_scadenza}
                      onChange={(e) =>
                        setFormData({ ...formData, garanzia_scadenza: e.target.value })
                      }
                      style={{ width: "100%", padding: 10 }}
                    />
                    {renderBadge(getExpiryStatus(formData.garanzia_scadenza))}
                  </div>
                ) : undefined
              }
              isEdit={isEdit}
            />
            <FieldRow
              label="Magazzino"
              view={
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                      Codice magazzino
                    </div>
                    <div>
                      {splitMagazzinoFields(
                        checklist.magazzino_importazione,
                        checklist.magazzino_drive_url
                      ).codice || "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                      Link Drive magazzino
                    </div>
                    <div>
                      {renderTextOrLink(
                        splitMagazzinoFields(
                          checklist.magazzino_importazione,
                          checklist.magazzino_drive_url
                        ).driveUrl
                      )}
                    </div>
                  </div>
                </div>
              }
              edit={
                isEdit ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                        Codice magazzino
                      </div>
                      <input
                        value={formData.magazzino_importazione}
                        onChange={(e) =>
                          setFormData({ ...formData, magazzino_importazione: e.target.value })
                        }
                        placeholder="Codice o testo magazzino"
                        style={{ width: "100%", padding: 10 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                        Link Drive magazzino
                      </div>
                      <input
                        value={formData.magazzino_drive_url}
                        onChange={(e) =>
                          setFormData({ ...formData, magazzino_drive_url: e.target.value })
                        }
                        placeholder="https://drive.google.com/..."
                        style={{ width: "100%", padding: 10 }}
                      />
                    </div>
                  </div>
                ) : undefined
              }
              isEdit={isEdit}
            />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
              background: "white",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              Seriali elettroniche di controllo
            </div>
            {editMode && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select
                  value={serialControlDeviceCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    const selected = deviceOptions.find((d) => (d.codice ?? "") === code);
                    setSerialControlDeviceCode(code);
                    setSerialControlDeviceDescrizione(selected?.descrizione ?? "");
                  }}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">Device/Modello (EL-%)</option>
                  {deviceOptions.map((item) => (
                    <option key={item.id} value={item.codice ?? ""}>
                      {item.codice ?? "—"} — {item.descrizione ?? "—"}
                    </option>
                  ))}
                </select>
                <input
                  value={serialControlInput}
                  onChange={(e) => setSerialControlInput(e.target.value)}
                  placeholder="Aggiungi seriale CONTROLLO"
                  style={{ width: "100%", padding: 8 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      addSerial(
                        "CONTROLLO",
                        serialControlInput,
                        serialControlNote,
                        serialControlDeviceCode,
                        serialControlDeviceDescrizione
                      );
                  }}
                />
                <input
                  value={serialControlNote}
                  onChange={(e) => setSerialControlNote(e.target.value)}
                  placeholder="Note (modello/device)"
                  style={{ width: "100%", padding: 8 }}
                />
                <button
                  type="button"
                  onClick={() =>
                    addSerial(
                      "CONTROLLO",
                      serialControlInput,
                      serialControlNote,
                      serialControlDeviceCode,
                      serialControlDeviceDescrizione
                    )
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #111",
                    background: "white",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Aggiungi
                </button>
              </div>
            )}
            {serialsError && (
              <div style={{ color: "crimson", fontSize: 12, marginBottom: 6 }}>
                {serialsError}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {serialiControllo.length === 0 ? (
                <span style={{ opacity: 0.6 }}>—</span>
              ) : (
                serialiControllo.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "#f3f4f6",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {s.seriale}
                    {s.device_code ? (
                      <span style={{ opacity: 0.85, fontWeight: 600 }}>
                        [{s.device_code}
                        {s.device_descrizione ? ` - ${s.device_descrizione}` : ""}]
                      </span>
                    ) : null}
                    {s.note ? (
                      <span style={{ opacity: 0.7, fontWeight: 500 }}>{s.note}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openSerialUsage("CONTROLLO", s.seriale)}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                      title="Usato anche in..."
                    >
                      ?
                    </button>
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => removeSerial(s)}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                        title="Rimuovi"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
              background: "white",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Seriali moduli LED</div>
            {editMode && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select
                  value={serialModuleDeviceCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    const selected = deviceOptions.find((d) => (d.codice ?? "") === code);
                    setSerialModuleDeviceCode(code);
                    setSerialModuleDeviceDescrizione(selected?.descrizione ?? "");
                  }}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">Device/Modello (EL-%)</option>
                  {deviceOptions.map((item) => (
                    <option key={item.id} value={item.codice ?? ""}>
                      {item.codice ?? "—"} — {item.descrizione ?? "—"}
                    </option>
                  ))}
                </select>
                <input
                  value={serialModuleInput}
                  onChange={(e) => setSerialModuleInput(e.target.value)}
                  placeholder="Aggiungi seriale MODULO_LED"
                  style={{ width: "100%", padding: 8 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      addSerial(
                        "MODULO_LED",
                        serialModuleInput,
                        serialModuleNote,
                        serialModuleDeviceCode,
                        serialModuleDeviceDescrizione
                      );
                  }}
                />
                <input
                  value={serialModuleNote}
                  onChange={(e) => setSerialModuleNote(e.target.value)}
                  placeholder="Note (modello/device)"
                  style={{ width: "100%", padding: 8 }}
                />
                <button
                  type="button"
                  onClick={() =>
                    addSerial(
                      "MODULO_LED",
                      serialModuleInput,
                      serialModuleNote,
                      serialModuleDeviceCode,
                      serialModuleDeviceDescrizione
                    )
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #111",
                    background: "white",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Aggiungi
                </button>
              </div>
            )}
            {serialsError && (
              <div style={{ color: "crimson", fontSize: 12, marginBottom: 6 }}>
                {serialsError}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {serialiModuli.length === 0 ? (
                <span style={{ opacity: 0.6 }}>—</span>
              ) : (
                serialiModuli.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "#f3f4f6",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {s.seriale}
                    {s.device_code ? (
                      <span style={{ opacity: 0.85, fontWeight: 600 }}>
                        [{s.device_code}
                        {s.device_descrizione ? ` - ${s.device_descrizione}` : ""}]
                      </span>
                    ) : null}
                    {s.note ? (
                      <span style={{ opacity: 0.7, fontWeight: 500 }}>{s.note}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openSerialUsage("MODULO_LED", s.seriale)}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                      title="Usato anche in..."
                    >
                      ?
                    </button>
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => removeSerial(s)}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                        title="Rimuovi"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      {accessoriRicambiBlock}
      {serialUsageOpen && (
        <div
          onClick={() => setSerialUsageOpen(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              border: "1px solid #eee",
              padding: 16,
              width: 380,
              maxWidth: "90vw",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Usato anche in…</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
              {serialUsageOpen.tipo} — {serialUsageOpen.seriale}
            </div>
            {serialUsageRows.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Nessun altro progetto</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {serialUsageRows.map((r) => (
                  <div
                    key={r.checklist_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "6px 8px",
                      borderRadius: 8,
                      background: "#f9fafb",
                      border: "1px solid #eee",
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.cliente ?? "—"}</div>
                      <div style={{ opacity: 0.7 }}>{r.nome_checklist ?? "—"}</div>
                    </div>
                    <Link href={`/checklists/${r.checklist_id}`}>Apri</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div style={mainSectionStyle}>
        <div style={mainSectionTitleStyle}>Dati operativi / cronoprogramma</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(280px, 1fr))",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Personale previsto / incarico</div>
              <textarea
                value={cronoOperativiForm.personale_previsto}
                onChange={(e) =>
                  setCronoOperativiForm((prev) => ({ ...prev, personale_previsto: e.target.value }))
                }
                style={{ width: "100%", minHeight: 70, padding: 8 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Mezzi</div>
              <textarea
                value={cronoOperativiForm.mezzi}
                onChange={(e) => setCronoOperativiForm((prev) => ({ ...prev, mezzi: e.target.value }))}
                style={{ width: "100%", minHeight: 70, padding: 8 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Descrizione attività</div>
              <textarea
                value={cronoOperativiForm.descrizione_attivita}
                onChange={(e) =>
                  setCronoOperativiForm((prev) => ({ ...prev, descrizione_attivita: e.target.value }))
                }
                style={{ width: "100%", minHeight: 70, padding: 8 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Indirizzo</div>
              <textarea
                value={cronoOperativiForm.indirizzo}
                onChange={(e) =>
                  setCronoOperativiForm((prev) => ({ ...prev, indirizzo: e.target.value }))
                }
                style={{ width: "100%", minHeight: 70, padding: 8 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Orario</div>
              <input
                value={cronoOperativiForm.orario}
                onChange={(e) => setCronoOperativiForm((prev) => ({ ...prev, orario: e.target.value }))}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Referente cliente</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  value={cronoOperativiForm.referente_cliente_nome}
                  onChange={(e) =>
                    setCronoOperativiForm((prev) => ({ ...prev, referente_cliente_nome: e.target.value }))
                  }
                  placeholder="Nome"
                  style={{ width: "100%", padding: 8 }}
                />
                <input
                  value={cronoOperativiForm.referente_cliente_contatto}
                  onChange={(e) =>
                    setCronoOperativiForm((prev) => ({ ...prev, referente_cliente_contatto: e.target.value }))
                  }
                  placeholder="Contatto"
                  style={{ width: "100%", padding: 8 }}
                />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Commerciale Art Tech</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  value={cronoOperativiForm.commerciale_art_tech_nome}
                  onChange={(e) =>
                    setCronoOperativiForm((prev) => ({ ...prev, commerciale_art_tech_nome: e.target.value }))
                  }
                  placeholder="Nome"
                  style={{ width: "100%", padding: 8 }}
                />
                <input
                  value={cronoOperativiForm.commerciale_art_tech_contatto}
                  onChange={(e) =>
                    setCronoOperativiForm((prev) => ({
                      ...prev,
                      commerciale_art_tech_contatto: e.target.value,
                    }))
                  }
                  placeholder="Contatto"
                  style={{ width: "100%", padding: 8 }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={saveCronoOperativi}
              disabled={cronoOperativiSaving}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                background: cronoOperativiSaving ? "#f3f4f6" : "#111",
                color: cronoOperativiSaving ? "#111" : "white",
                cursor: cronoOperativiSaving ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {cronoOperativiSaving ? "Salvataggio..." : "Salva dati operativi"}
            </button>
            {cronoOperativiMeta?.updated_at ? (
              <span style={{ fontSize: 12, opacity: 0.75 }}>
                Ultimo aggiornamento:{" "}
                {new Date(cronoOperativiMeta.updated_at).toLocaleString("it-IT")}
                {cronoOperativiMeta.updated_by_nome ? ` · ${cronoOperativiMeta.updated_by_nome}` : ""}
              </span>
            ) : null}
          </div>
          {cronoOperativiError ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>{cronoOperativiError}</div>
          ) : null}
          {cronoOperativiNotice ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "#166534" }}>{cronoOperativiNotice}</div>
          ) : null}
      </div>
      <RenewalsAlertModal
        open={projectRinnoviAlertOpen}
        cliente={checklist?.cliente || ""}
        stage={projectRinnoviAlertStage}
        title={projectRinnoviAlertStage === "stage1" ? "Invia avviso scadenza" : "Invia avviso fatturazione"}
        customerEmail={checklistClienteEmail}
        customerDeliveryMode={checklistCustomerDeliveryMode || "AUTO_CLIENTE"}
        operators={getProjectAlertRecipients()}
        defaultOperatorId=""
        initialSubject={projectRinnoviAlertSubject}
        initialMessage={projectRinnoviAlertMsg}
        rule={projectRinnoviAlertRule}
        loadingRule={projectRinnoviAlertRuleLoading}
        manualSending={projectRinnoviAlertSending}
        ruleSaving={projectRinnoviAlertRuleSaving}
        error={projectRinnoviAlertErr}
        success={projectRinnoviAlertOk}
        onClose={() => setProjectRinnoviAlertOpen(false)}
        onSubmitManual={sendProjectRinnoviAlert}
        onSaveRule={saveProjectRinnoviAlertRule}
      />
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "white",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Aggiungi tagliando periodico</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px,1.4fr) 140px 180px minmax(220px,1fr) auto",
              gap: 8,
              alignItems: "end",
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Progetto</div>
              <select
                value={id || ""}
                disabled
                style={{
                  width: "100%",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "#f9fafb",
                }}
              >
                <option value={id || ""}>{checklist?.nome_checklist || id || "—"}</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Scadenza</div>
              <input
                type="date"
                value={projectTagliando.scadenza}
                onChange={(e) =>
                  setProjectTagliando((prev) => ({ ...prev, scadenza: e.target.value }))
                }
                style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Fatturazione</div>
              <select
                value={projectTagliando.fatturazione}
                onChange={(e) =>
                  setProjectTagliando((prev) => ({ ...prev, fatturazione: e.target.value }))
                }
                style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
              >
                <option value="INCLUSO">INCLUSO</option>
                <option value="DA_FATTURARE">DA_FATTURARE</option>
                <option value="FATTURATO">FATTURATO</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Note</div>
              <input
                value={projectTagliando.note}
                onChange={(e) =>
                  setProjectTagliando((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Tagliando annuale / periodico"
                style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
              />
            </div>
            <button
              type="button"
              onClick={addProjectTagliandoPeriodico}
              disabled={projectTagliandoSaving}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                fontWeight: 700,
                cursor: projectTagliandoSaving ? "not-allowed" : "pointer",
                opacity: projectTagliandoSaving ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {projectTagliandoSaving ? "Salvataggio..." : "Aggiungi"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: 0.2 }}>
              Scadenze &amp; Rinnovi
            </h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link
                href={`/avvisi?cliente=${encodeURIComponent(checklist?.cliente || "")}`}
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
                onClick={() => openProjectRinnoviAlert("stage1", true)}
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

          <RenewalsBlock
            cliente={checklist?.cliente || ""}
            rows={filteredProjectRenewals}
            checklistById={new Map(checklist ? [[checklist.id, checklist]] : [])}
            rinnoviError={projectInterventiError}
            rinnoviNotice={projectInterventiNotice}
            setRinnoviNotice={setProjectInterventiNotice}
            getWorkflowStato={(row) => getProjectWorkflowStato(row as ProjectRenewalRow)}
            actionsByTipo={ACTIONS_BY_TIPO}
            alertStatsMap={projectAlertStatsMap}
            getAlertKeyForRow={(row) => alertKeyForProjectRow(row as ProjectRenewalRow)}
            renderScadenzaBadge={(scadenza) => renderBadge(getExpiryStatus(scadenza))}
            renderTagliandoStatoBadge={(stato) =>
              renderBadge(String(stato || "ATTIVA").toUpperCase() === "OK" ? "ATTIVA" : String(stato || "ATTIVA"))
            }
            renderAvvisatoBadge={(stats) => renderProjectAvvisatoBadge(stats)}
            renderRinnovoStatoBadge={renderRinnovoStatoBadge}
            renderModalitaBadge={renderModalitaBadge}
            onSendAlert={(row) => openProjectRinnoviAlert("stage1", false, [row as ProjectRenewalRow])}
            onSetDaFatturare={(row) => updateProjectRenewalStatus(row as ProjectRenewalRow, "DA_FATTURARE")}
            onSetFatturato={(row) => updateProjectRenewalStatus(row as ProjectRenewalRow, "FATTURATO")}
            onSetConfermato={(row) => updateProjectRenewalStatus(row as ProjectRenewalRow, "CONFERMATO")}
            onSetNonRinnovato={(row) => updateProjectRenewalStatus(row as ProjectRenewalRow, "NON_RINNOVATO")}
            onEdit={(row) => openProjectRenewalEdit(row as ProjectRenewalRow)}
            editOpen={!!projectRenewalEdit}
            editForm={
              projectRenewalEdit
                ? {
                    tipo: projectRenewalEdit.row.tipo,
                    scadenza: projectRenewalEdit.scadenza,
                    stato: projectRenewalEdit.stato,
                    modalita: projectRenewalEdit.modalita,
                    note: projectRenewalEdit.note,
                    descrizione: projectRenewalEdit.descrizione || "",
                    saas_piano: projectRenewalEdit.saas_piano || "",
                    licenza_class: projectRenewalEdit.licenza_class || "LICENZA",
                    licenza_tipo: projectRenewalEdit.licenza_tipo || "",
                    fornitore: projectRenewalEdit.fornitore || "",
                    intestato_a: projectRenewalEdit.intestato_a || "",
                  }
                : null
            }
            setEditOpen={(open) => {
              if (!open) setProjectRenewalEdit(null);
            }}
            setEditForm={(next) =>
              setProjectRenewalEdit((prev) =>
                prev
                  ? {
                      ...prev,
                      ...(typeof next?.scadenza === "string" ? { scadenza: next.scadenza } : {}),
                      ...(typeof next?.stato === "string" ? { stato: next.stato } : {}),
                      ...(typeof next?.modalita === "string" ? { modalita: next.modalita } : {}),
                      ...(typeof next?.note === "string" ? { note: next.note } : {}),
                      ...(typeof next?.descrizione === "string"
                        ? { descrizione: next.descrizione }
                        : {}),
                      ...(typeof next?.saas_piano === "string"
                        ? { saas_piano: next.saas_piano }
                        : {}),
                      ...(typeof next?.licenza_class === "string"
                        ? {
                            licenza_class: next.licenza_class === "GARANZIA" ? "GARANZIA" : "LICENZA",
                          }
                        : {}),
                      ...(typeof next?.licenza_tipo === "string"
                        ? { licenza_tipo: next.licenza_tipo }
                        : {}),
                      ...(typeof next?.fornitore === "string" ? { fornitore: next.fornitore } : {}),
                      ...(typeof next?.intestato_a === "string"
                        ? { intestato_a: next.intestato_a }
                        : {}),
                    }
                  : prev
              )
            }
            saveEdit={saveProjectRenewalEdit}
            deleteEdit={deleteProjectRenewalFromEdit}
            editSaving={projectRenewalEditSaving}
            editError={projectInterventiError}
            licenzaStati={LICENZA_STATI}
            tagliandoStati={TAGLIANDO_STATI}
            tagliandoModalita={TAGLIANDO_MODALITA}
            rinnovoStati={RINNOVO_STATI}
          />
        </div>
      </div>
      <div style={mainSectionStyle}>
        <h2 style={mainSectionTitleStyle}>Servizi</h2>

        <ServiziBox title="SERVIZI">
          <ServiceRow
            label="PLUS/PREMIUM (impianti)"
            left={
              editMode && formData ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 }}>
                  <select
                    value={formData.saas_piano ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, saas_piano: e.target.value || null })
                    }
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="">—</option>
                    {saasPianoOptions.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={formData.saas_scadenza}
                    onChange={(e) =>
                      setFormData({ ...formData, saas_scadenza: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  />
                </div>
              ) : (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>
                    {checklist.saas_piano
                      ? `${checklist.saas_piano} — ${saasLabelFromCode(checklist.saas_piano) ?? "—"}`
                      : "—"}
                  </span>
                  <span>
                    {checklist.saas_scadenza
                      ? new Date(checklist.saas_scadenza).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              )
            }
            right={
              (editMode && formData ? formData.saas_scadenza : checklist.saas_scadenza)
                ? renderBadge(
                    getExpiryStatus(
                      editMode && formData ? formData.saas_scadenza : checklist.saas_scadenza
                    )
                  )
                : "—"
            }
          />

          <ServiceRow
            label="Servizio aggiuntivo SAAS"
            left={
              editMode && formData ? (
                <select
                  value={formData.saas_tipo ?? ""}
                  onChange={(e) => setFormData({ ...formData, saas_tipo: e.target.value || null })}
                  style={{ width: "100%", padding: 10 }}
                >
                  <option value="">— nessuno —</option>
                  {saasServiziAggiuntivi.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div>
                  {checklist.saas_tipo
                    ? `${checklist.saas_tipo} — ${saasLabelFromCode(checklist.saas_tipo) ?? "—"}`
                    : "—"}
                </div>
              )
            }
            right="—"
          />

          <ServiceRow
            label="SAAS note"
            left={
              editMode && formData ? (
                <textarea
                  value={formData.saas_note}
                  onChange={(e) => setFormData({ ...formData, saas_note: e.target.value })}
                  rows={3}
                  style={{ width: "100%", padding: 10 }}
                />
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{checklist.saas_note || "—"}</div>
              )
            }
            right="—"
          />

          <ServiceRow
            label="ULTRA (cliente)"
            left={
              contrattoUltra ? (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>
                    {contrattoUltra.piano_codice ?? "—"}
                    {contrattoUltraNome ? ` — ${contrattoUltraNome}` : ""}
                  </span>
                  <span>
                    {contrattoUltra.scadenza
                      ? new Date(contrattoUltra.scadenza).toLocaleDateString()
                      : "—"}
                  </span>
                  <span>
                    {contrattoUltra.illimitati
                      ? `Usati ${interventiInclusiUsati} / illimitati`
                      : contrattoUltra.interventi_annui != null
                      ? `Usati ${interventiInclusiUsati} / Totale ${contrattoUltra.interventi_annui} / Residui ${Math.max(
                          0,
                          contrattoUltra.interventi_annui - interventiInclusiUsati
                        )}`
                      : `Usati ${interventiInclusiUsati} / Totale — / Residui —`}
                  </span>
                </div>
              ) : (
                "—"
              )
            }
            right={contrattoUltra ? renderBadge(getExpiryStatus(contrattoUltra.scadenza)) : "—"}
          />

          <ServiceRow
            label="Garanzia"
            left={
              checklist.garanzia_scadenza
                ? new Date(checklist.garanzia_scadenza).toLocaleDateString()
                : "—"
            }
            right={
              checklist.garanzia_scadenza
                ? renderBadge(getExpiryStatus(checklist.garanzia_scadenza))
                : "—"
            }
          />

          <ServiceRow
            label="Licenze"
            left={
              licenze.length === 0
                ? "—"
                : `Attive: ${licenze.length} — Prossima scadenza: ${
                    getNextLicenzaScadenza(licenze)
                      ? new Date(getNextLicenzaScadenza(licenze)!).toLocaleDateString()
                      : "—"
                  }`
            }
            right={
              licenze.length === 0
                ? "—"
                : renderBadge(getExpiryStatus(getNextLicenzaScadenza(licenze)))
            }
          />
        </ServiziBox>

        <div style={{ marginTop: 12 }}>
          <h2 style={mainSectionTitleStyle}>Licenze</h2>
          <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.7 }}>
            Licenze dettaglio (dashboard):{" "}
            {licenze.length === 0
              ? "—"
              : licenze
                  .map(
                    (l) => {
                      const parts = [l.tipo ?? "—"];
                      if (l.telefono) parts.push(l.telefono);
                      if (l.intestata_a) parts.push(`Intestata: ${l.intestata_a}`);
                      if (l.ref_univoco) parts.push(l.ref_univoco);
                      if (l.intestatario) parts.push(l.intestatario);
                      if (l.gestore) parts.push(l.gestore);
                      if (l.fornitore) parts.push(l.fornitore);
                      const suffix = parts.filter(Boolean).join(" · ");
                      return `${suffix} (${l.scadenza ? l.scadenza.slice(0, 10) : "—"})`;
                    }
                  )
                  .join(", ")}
          </div>

          {licenzeError && <div style={{ color: "crimson", marginBottom: 10 }}>{licenzeError}</div>}

          {licenze.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nessuna licenza collegata</div>
          ) : (
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                overflowX: "auto",
                overflowY: "hidden",
              }}
            >
              <div style={{ minWidth: 1180 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "180px 130px 120px 130px 240px 260px 220px",
                    gap: 10,
                    padding: "10px 12px",
                    fontWeight: 700,
                    borderBottom: "1px solid #eee",
                    background: "#fafafa",
                  }}
                >
                  <div>Tipo / Piano</div>
                  <div>Scadenza</div>
                  <div>Stato</div>
                  <div>Intestata</div>
                  <div>Note</div>
                  <div>Riferimento</div>
                  <div>Azioni</div>
                </div>

                {licenze.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "180px 130px 120px 130px 240px 260px 220px",
                      gap: 10,
                      padding: "10px 12px",
                      borderBottom: "1px solid #f5f5f5",
                      alignItems: "start",
                      fontSize: 13,
                    }}
                  >
                  <div>
                    {editMode && editingLicenzaId === l.id ? (
                      <select
                        value={editingLicenza?.tipo ?? ""}
                        onChange={(e) =>
                          setEditingLicenza((prev) =>
                            prev ? { ...prev, tipo: e.target.value } : prev
                          )
                        }
                        style={{ width: "100%", padding: 6 }}
                      >
                        <option value="">—</option>
                        <option value="CMS">CMS</option>
                        <option value="SIM">SIM</option>
                        <option value="SLA">SLA</option>
                        <option value="MON">MON</option>
                        <option value="TCK">TCK</option>
                        <option value="ALTRO">ALTRO</option>
                      </select>
                    ) : (
                      l.tipo ?? "—"
                    )}
                  </div>
                  <div>
                    {editMode && editingLicenzaId === l.id ? (
                      <input
                        type="date"
                        value={editingLicenza?.scadenza ?? ""}
                        onChange={(e) =>
                          setEditingLicenza((prev) =>
                            prev ? { ...prev, scadenza: e.target.value } : prev
                          )
                        }
                        style={{ width: "100%", padding: 6 }}
                      />
                    ) : l.scadenza ? (
                      new Date(l.scadenza).toLocaleDateString()
                    ) : (
                      "—"
                    )}
                  </div>
                  <div>
                    {editMode && editingLicenzaId === l.id ? (
                      <select
                        value={editingLicenza?.stato ?? "attiva"}
                        onChange={(e) =>
                          setEditingLicenza((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  stato: e.target.value as "attiva" | "disattivata",
                                }
                              : prev
                          )
                        }
                        style={{ width: "100%", padding: 6 }}
                      >
                        <option value="attiva">ATTIVA</option>
                        <option value="disattivata">DISATTIVATA</option>
                      </select>
                    ) : (
                      renderBadge(getLicenzaStatusLabel(l))
                    )}
                  </div>
                  <div>
                    {editMode && editingLicenzaId === l.id ? (
                      <select
                        value={editingLicenza?.intestata_a ?? "CLIENTE"}
                        onChange={(e) =>
                          setEditingLicenza((prev) =>
                            prev ? { ...prev, intestata_a: e.target.value } : prev
                          )
                        }
                        style={{ width: "100%", padding: 6 }}
                      >
                        <option value="CLIENTE">Cliente</option>
                        <option value="ART_TECH">Art Tech</option>
                      </select>
                    ) : (
                      l.intestata_a === "ART_TECH"
                        ? "Art Tech"
                        : l.intestata_a
                        ? "Cliente"
                        : "—"
                    )}
                  </div>
                  <div>
                    {editMode && editingLicenzaId === l.id ? (
                      <input
                        value={editingLicenza?.note ?? ""}
                        onChange={(e) =>
                          setEditingLicenza((prev) =>
                            prev ? { ...prev, note: e.target.value } : prev
                          )
                        }
                        style={{ width: "100%", padding: 6 }}
                      />
                    ) : (
                      l.note ?? "—"
                    )}
                  </div>
                  <div>
                    {editMode && editingLicenzaId === l.id ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <input
                          value={editingLicenza?.ref_univoco ?? ""}
                          onChange={(e) =>
                            setEditingLicenza((prev) =>
                              prev ? { ...prev, ref_univoco: e.target.value } : prev
                            )
                          }
                          placeholder="Rif/licenza"
                          style={{ width: "100%", padding: 6 }}
                        />
                        <input
                          value={editingLicenza?.telefono ?? ""}
                          onChange={(e) =>
                            setEditingLicenza((prev) =>
                              prev ? { ...prev, telefono: e.target.value } : prev
                            )
                          }
                          placeholder="Telefono"
                          style={{ width: "100%", padding: 6 }}
                        />
                        <input
                          value={editingLicenza?.intestatario ?? ""}
                          onChange={(e) =>
                            setEditingLicenza((prev) =>
                              prev ? { ...prev, intestatario: e.target.value } : prev
                            )
                          }
                          placeholder="Intestatario"
                          style={{ width: "100%", padding: 6 }}
                        />
                        <input
                          value={editingLicenza?.gestore ?? ""}
                          onChange={(e) =>
                            setEditingLicenza((prev) =>
                              prev ? { ...prev, gestore: e.target.value } : prev
                            )
                          }
                          placeholder="Gestore"
                          style={{ width: "100%", padding: 6 }}
                        />
                        <input
                          value={editingLicenza?.fornitore ?? ""}
                          onChange={(e) =>
                            setEditingLicenza((prev) =>
                              prev ? { ...prev, fornitore: e.target.value } : prev
                            )
                          }
                          placeholder="Fornitore"
                          style={{ width: "100%", padding: 6 }}
                        />
                      </div>
                    ) : (
                      [l.ref_univoco, l.telefono, l.intestatario, l.gestore, l.fornitore]
                        .filter(Boolean)
                        .join(" · ") || "—"
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {editMode ? (
                      editingLicenzaId === l.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => deleteLicenza(l.id)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #dc2626",
                              background: "white",
                              color: "#dc2626",
                              cursor: "pointer",
                            }}
                          >
                            Elimina
                          </button>
                          <button
                            type="button"
                            onClick={saveEditLicenza}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #111",
                              background: "#111",
                              color: "white",
                              cursor: "pointer",
                            }}
                          >
                            Salva
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLicenzaId(null);
                              setEditingLicenza(null);
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #ddd",
                              background: "white",
                              cursor: "pointer",
                            }}
                          >
                            Annulla
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditLicenza(l)}
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
                      )
                    ) : (
                      <span style={{ opacity: 0.6 }}>—</span>
                    )}
                  </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 12,
              background: "white",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>+ Aggiungi licenza</div>
            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 2fr 1fr 120px",
                  gap: 10,
                  alignItems: "end",
                }}
              >
                <label>
                  Tipo / Piano<br />
                  <select
                    value={newLicenza.tipo}
                    onChange={(e) => setNewLicenza({ ...newLicenza, tipo: e.target.value })}
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="">—</option>
                    <option value="CMS">CMS</option>
                    <option value="SIM">SIM</option>
                    <option value="SLA">SLA</option>
                    <option value="MON">MON</option>
                    <option value="TCK">TCK</option>
                    <option value="ALTRO">ALTRO</option>
                  </select>
                </label>
                <label>
                  Scadenza<br />
                  <input
                    type="date"
                    value={newLicenza.scadenza}
                    onChange={(e) => setNewLicenza({ ...newLicenza, scadenza: e.target.value })}
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>
                <label>
                  Note<br />
                  <input
                    value={newLicenza.note}
                    onChange={(e) => setNewLicenza({ ...newLicenza, note: e.target.value })}
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>
                <label>
                  Intestata a<br />
                  <select
                    value={newLicenza.intestata_a}
                    onChange={(e) =>
                      setNewLicenza({ ...newLicenza, intestata_a: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="CLIENTE">Cliente</option>
                    <option value="ART_TECH">Art Tech</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={addLicenza}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Aggiungi
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 2fr 2fr 2fr 2fr",
                  gap: 10,
                }}
              >
                <label>
                  Riferimento (tel/licenza)<br />
                  <input
                    value={newLicenza.ref_univoco}
                    onChange={(e) =>
                      setNewLicenza({ ...newLicenza, ref_univoco: e.target.value })
                    }
                    placeholder="Numero licenza / telefono"
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>
                <label>
                  Telefono<br />
                  <input
                    value={newLicenza.telefono}
                    onChange={(e) =>
                      setNewLicenza({ ...newLicenza, telefono: e.target.value })
                    }
                    placeholder="Numero SIM"
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>
                <label>
                  Intestatario<br />
                  <input
                    value={newLicenza.intestatario}
                    onChange={(e) =>
                      setNewLicenza({ ...newLicenza, intestatario: e.target.value })
                    }
                    placeholder="Intestatario"
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>
                <label>
                  Gestore<br />
                  <input
                    value={newLicenza.gestore}
                    onChange={(e) =>
                      setNewLicenza({ ...newLicenza, gestore: e.target.value })
                    }
                    placeholder="Gestore"
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>
                <label>
                  Fornitore<br />
                  <input
                    value={newLicenza.fornitore}
                    onChange={(e) =>
                      setNewLicenza({ ...newLicenza, fornitore: e.target.value })
                    }
                    placeholder="Fornitore"
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>{projectInterventiBlock}</div>
        </div>
      </div>

      <div style={mainSectionStyle}>
        <h2 style={mainSectionTitleStyle}>Foto / Video</h2>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
          Media di progetto separati dagli allegati delle task operative.
        </div>
        <div style={{ marginBottom: 12 }}>
          <AttachmentsPanel
            title="Foto / Video progetto (upload file + link)"
            entityType="CHECKLIST"
            entityId={id}
            multiple
            storagePrefix="checklist"
          />
        </div>
      </div>

      {tasks.length > 0 && (
        <div style={{ ...mainSectionStyle, marginTop: 24 }}>
          <h2 style={mainSectionTitleStyle}>Checklist operativa</h2>
          {alertNotice && (
            <div style={{ marginTop: 8, marginBottom: 10, fontSize: 12, color: "#166534" }}>
              {alertNotice}
            </div>
          )}

          {[0, 1, 2, 3].map((sec) => (
            <div
              key={sec}
              style={{
                marginTop: 16,
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 12,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {sec === 0 ? "DOCUMENTI" : `SEZIONE ${sec}`}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 160px 180px minmax(220px, 1.2fr) 220px",
                  gap: 12,
                  fontSize: 12,
                  opacity: 0.6,
                  marginBottom: 6,
                }}
              >
                <div></div>
                <div>Stato</div>
                <div>Azioni</div>
                <div>Note</div>
                <div style={{ textAlign: "right" }}>Ultima modifica da</div>
              </div>

              {tasks
                .filter((t) => {
                  const v = t.sezione;
                  if (typeof v === "number") return v === sec;
                  const s = String(v).toUpperCase();
                  if (s === "DOCUMENTI") return sec === 0;
                  if (s === "SEZIONE_1" || s === "SEZIONE 1") return sec === 1;
                  if (s === "SEZIONE_2" || s === "SEZIONE 2") return sec === 2;
                  if (s === "SEZIONE_3" || s === "SEZIONE 3") return sec === 3;
                  return false;
                })
                .map((t) => (
                  (() => {
                    const totalAttachments = getChecklistTaskAttachmentCount(t.id);
                    return (
                  <div
                    key={t.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 160px 180px minmax(220px, 1.2fr) 220px",
                      gap: 12,
                      padding: "6px 0",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ minWidth: 0 }}>{t.titolo}</span>
                    </div>

                    <div>
                      <select
                        value={t.stato}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          fontWeight: 600,
                          ...taskStyle(t.stato),
                        }}
                        onChange={async (e) => {
                          const newStato = e.target.value;

                          const { error } = await dbFrom("checklist_tasks")
                            .update({
                              stato: newStato,
                              updated_by_operatore: currentOperatoreId || null,
                            })
                            .eq("id", t.id);

                          if (!error) {
                            setTasks((prev) =>
                              prev.map((x) =>
                                x.id === t.id
                                  ? {
                                      ...x,
                                      stato: newStato,
                                      updated_by_operatore: currentOperatoreId || null,
                                      operatori:
                                        (currentOperatoreId && operatoriMap.get(currentOperatoreId))
                                          ? {
                                              id: currentOperatoreId,
                                              nome: operatoriMap.get(currentOperatoreId) || null,
                                            }
                                          : x.operatori,
                                      updated_at: new Date().toISOString(),
                                    }
                                  : x
                              )
                            );
                          }
                        }}
                      >
                        <option value="DA_FARE">DA FARE</option>
                        <option value="OK">OK</option>
                        <option value="NON_NECESSARIO">NON NECESSARIO</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => setAlertTask(t)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #ddd",
                            background: "white",
                            cursor: "pointer",
                            fontSize: 12,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Invia
                        </button>
                        <button
                          type="button"
                          onClick={() => openRuleSettings(t)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #d1d5db",
                            background: "#f8fafc",
                            color: "#111827",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ⚙ Regola
                        </button>
                        <button
                          type="button"
                          onClick={() => openTaskFiles(t)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border:
                              totalAttachments > 0 ? "1px solid #16a34a" : "1px solid #d1d5db",
                            background: totalAttachments > 0 ? "#ecfdf5" : "#f8fafc",
                            color: totalAttachments > 0 ? "#166534" : "#111827",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            minWidth: 34,
                          }}
                          title={
                            totalAttachments > 0
                              ? `${totalAttachments} allegati/link presenti`
                              : "Nessun allegato o link"
                          }
                        >
                          📎{totalAttachments > 0 ? ` ${totalAttachments}` : ""}
                        </button>
                      </div>
                      {lastAlertByTask.has(t.id) && (
                        <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
                          <div>
                            Alert inviato a{" "}
                            {operatoriMap.get(lastAlertByTask.get(t.id)!.toOperatoreId) ??
                              lastAlertByTask.get(t.id)!.toOperatoreId}
                          </div>
                          <div>il {new Date(
                            lastAlertByTask.get(t.id)!.createdAt
                          ).toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                    <div>
                      {(() => {
                        const comments = taskCommentsById[t.id] || [];
                        const latest = comments[0] || null;
                        return (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setTaskNotesTask(t);
                                setTaskNotesError(null);
                              }}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                border: "1px solid #d1d5db",
                                background: "white",
                                cursor: "pointer",
                                fontWeight: 700,
                                lineHeight: "26px",
                                flex: "0 0 auto",
                              }}
                              title="Apri storico note"
                            >
                              +
                            </button>
                            <div style={{ minWidth: 0 }}>
                              <div
                                title={latest?.commento || "Nessuna nota"}
                                style={{ fontSize: 12, lineHeight: 1.35, color: "#111827" }}
                              >
                                {truncateTaskNote(latest?.commento)}
                              </div>
                              {latest ? (
                                <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                                  {latest.created_by_nome || operatoriMap.get(latest.created_by_operatore || "") || "—"}
                                  {" · "}
                                  {latest.created_at ? new Date(latest.created_at).toLocaleString("it-IT") : "—"}
                                </div>
                              ) : (
                                <div style={{ marginTop: 4, fontSize: 11, opacity: 0.55 }}>
                                  Nessuna nota
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div
                      style={{
                        justifySelf: "end",
                        textAlign: "right",
                        fontSize: 12,
                        opacity: 0.7,
                      }}
                    >
                      {t.updated_at ? (
                        <>
                          <div>
                            ✔ {t.operatori?.nome ?? operatoriMap.get(t.updated_by_operatore || "") ?? "—"}
                          </div>
                          <div>{new Date(t.updated_at).toLocaleString()}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                    );
                  })()
                ))}
            </div>
      ))}
        </div>
      )}

      {taskNotesTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 55,
            padding: 16,
          }}
          onClick={() => setTaskNotesTask(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 16,
              width: "100%",
              maxWidth: 760,
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>Storico note task</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Task: {taskNotesTask.titolo}</div>
              <button
                type="button"
                onClick={() => setTaskNotesTask(null)}
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

            {taskNotesError && (
              <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 10 }}>{taskNotesError}</div>
            )}

            <div
              style={{
                marginBottom: 14,
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#fafafa",
              }}
            >
              <div style={{ fontSize: 12, marginBottom: 6, fontWeight: 600 }}>Nuova nota</div>
              <textarea
                value={taskNoteDraftById[taskNotesTask.id] || ""}
                onChange={(e) =>
                  setTaskNoteDraftById((prev) => ({ ...prev, [taskNotesTask.id]: e.target.value }))
                }
                rows={4}
                placeholder="Scrivi una nota per questo task"
                style={{ width: "100%", padding: 8 }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => addTaskComment(taskNotesTask)}
                  disabled={
                    taskNoteSavingTaskId === taskNotesTask.id ||
                    !String(taskNoteDraftById[taskNotesTask.id] || "").trim()
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #111",
                    background: "#111",
                    color: "white",
                    opacity:
                      taskNoteSavingTaskId === taskNotesTask.id ||
                      !String(taskNoteDraftById[taskNotesTask.id] || "").trim()
                        ? 0.6
                        : 1,
                  }}
                >
                  {taskNoteSavingTaskId === taskNotesTask.id ? "Salvataggio..." : "Aggiungi nota"}
                </button>
              </div>
            </div>

            {taskNotesLoading ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Caricamento note...</div>
            ) : (taskCommentsById[taskNotesTask.id] || []).length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Nessuna nota inserita per questo task.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {(taskCommentsById[taskNotesTask.id] || []).map((comment) => (
                  <div
                    key={comment.id}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 12,
                      padding: 12,
                      background: "white",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                      {comment.created_by_nome || operatoriMap.get(comment.created_by_operatore || "") || "—"}
                      {" · "}
                      {comment.created_at ? new Date(comment.created_at).toLocaleString("it-IT") : "—"}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{comment.commento}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {taskFilesTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 55,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 16,
              width: "100%",
              maxWidth: 760,
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Allegati task</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
              Task: {taskFilesTask.titolo}
            </div>

            {taskDocError && (
              <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 10 }}>{taskDocError}</div>
            )}
            <div style={{ marginBottom: 12 }}>
              <AttachmentsPanel
                title="Allegati task (upload + link Drive)"
                entityType="CHECKLIST_TASK"
                entityId={taskFilesTask.id}
                multiple
                storagePrefix="task"
              />
            </div>

            {false && (
              <>
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    border: "1px solid #eee",
                    borderRadius: 12,
                    background: "white",
                    display: "grid",
                    gridTemplateColumns: "1fr 160px",
                    gap: 10,
                    alignItems: "end",
                  }}
                >
                  <label>
                    File<br />
                    <input
                      type="file"
                      onChange={(e) => setTaskDocFile(e.target.files?.[0] ?? null)}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={uploadTaskDocument}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    Carica file
                  </button>
                </div>

                {(() => {
                  const taskId = taskFilesTask?.id;
                  if (!taskId) return null;
                  const rows = taskDocuments.filter((d) => d.task_id === taskId);
                  if (rows.length === 0) {
                    return <div style={{ opacity: 0.7 }}>Nessun file caricato per questo task</div>;
                  }
                  return (
                    <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr 200px",
                          padding: "10px 12px",
                          fontWeight: 700,
                          borderBottom: "1px solid #eee",
                          background: "#fafafa",
                        }}
                      >
                        <div>Nome file</div>
                        <div>Data upload</div>
                        <div>Caricato da</div>
                        <div>Azioni</div>
                      </div>
                      {rows.map((d) => (
                        <div
                          key={d.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr 1fr 200px",
                            padding: "10px 12px",
                            borderBottom: "1px solid #f5f5f5",
                            alignItems: "center",
                            fontSize: 13,
                          }}
                        >
                          <div>{d.filename}</div>
                          <div>{d.uploaded_at ? new Date(d.uploaded_at).toLocaleString() : "—"}</div>
                          <div>
                            {d.uploaded_by_operatore
                              ? operatoriMap.get(d.uploaded_by_operatore) ?? "—"
                              : "—"}
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => openTaskDocument(d, false)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #ddd",
                                background: "white",
                                cursor: "pointer",
                              }}
                            >
                              Apri
                            </button>
                            <button
                              type="button"
                              onClick={() => openTaskDocument(d, true)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #ddd",
                                background: "white",
                                cursor: "pointer",
                              }}
                            >
                              Scarica
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTaskDocument(d)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #dc2626",
                                background: "white",
                                color: "#dc2626",
                                cursor: "pointer",
                              }}
                            >
                              Elimina
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                type="button"
                onClick={closeTaskFiles}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {editMode && (
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ marginRight: 12, fontSize: 12, opacity: 0.7 }}>
            Azione irreversibile
          </div>
          <button
            onClick={onDeleteChecklist}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ef4444",
              background: "#ef4444",
              color: "white",
              cursor: "pointer",
            }}
          >
            Elimina checklist
          </button>
        </div>
      )}

      {alertTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 16,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Invia alert</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
              Task: {alertTask.titolo}
            </div>
            <div style={{ marginBottom: 10, fontSize: 12 }}>
              <button
                type="button"
                onClick={() => {
                  const t = alertTask;
                  setAlertTask(null);
                  setRuleTask(t);
                }}
                style={{
                  border: "1px solid #d1d5db",
                  background: "white",
                  borderRadius: 8,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                ⚙ Regole invio automatico
              </button>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={alertManualMode}
                onChange={(e) => {
                  setAlertManualMode(e.target.checked);
                  setAlertFormError(null);
                  if (e.target.checked) setAlertDestinatarioId("");
                }}
              />
              Email manuale
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={alertToCliente}
                onChange={(e) => setAlertToCliente(e.target.checked)}
              />
              Cliente
            </label>
            {alertToCliente && (
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
                Cliente {checklistClienteEmail ? "selezionato" : "senza email valida in anagrafica"}
              </div>
            )}
            <label style={{ display: "block", marginBottom: 10 }}>
              Destinatario<br />
              {alertManualMode ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={alertManualEmail}
                    onChange={(e) => setAlertManualEmail(e.target.value)}
                    placeholder="email@dominio.it"
                    style={{ width: "100%", padding: 8 }}
                  />
                  <input
                    value={alertManualName}
                    onChange={(e) => setAlertManualName(e.target.value)}
                    placeholder="Nome (opzionale)"
                    style={{ width: "100%", padding: 8 }}
                  />
                </div>
              ) : (
                <select
                  value={alertDestinatarioId}
                  onChange={(e) => setAlertDestinatarioId(e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                  disabled={getEligibleOperatori(alertTask).length === 0}
                >
                  <option value="">—</option>
                  {getEligibleOperatori(alertTask).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome ?? o.id}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {!alertManualMode && getEligibleOperatori(alertTask).length === 0 && (
              <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 10 }}>
                Nessun contatto disponibile
              </div>
            )}
            {alertFormError && (
              <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 10 }}>
                {alertFormError}
              </div>
            )}
            {(() => {
              const presets = alertTemplates.filter((t) => {
                const tipo = String(t.tipo || "").toUpperCase();
                const trigger = String(t.trigger || "").toUpperCase();
                const isGeneric = tipo === "GENERICO" || tipo === "";
                const isManual =
                  trigger === "MANUALE" ||
                  trigger === "TASK_STATUS_CHANGE" ||
                  trigger === "";
                return isGeneric && isManual;
              });
              if (presets.length === 0) return null;

              const destinatarioLabel = alertManualMode
                ? [alertManualName.trim() || alertManualEmail.trim(), alertToCliente ? "Cliente" : ""]
                    .filter(Boolean)
                    .join(" + ")
                : alertOperatori.find((o) => o.id === alertDestinatarioId)?.nome ||
                  alertOperatori.find((o) => o.id === alertDestinatarioId)?.email ||
                  (alertToCliente ? "Cliente" : "");

              return (
                <label style={{ display: "block", marginBottom: 10 }}>
                  Preset messaggio<br />
                  <select
                    value={alertSelectedPresetId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAlertSelectedPresetId(value);
                      const tpl = presets.find((t) => String(t.id) === value);
                      if (!tpl) return;
                      const ctx = {
                        cliente: checklist?.cliente || "",
                        checklist: checklist?.nome_checklist || "",
                        task: alertTask.titolo || "",
                        stato: String(alertTask.stato || "").toUpperCase(),
                        nome_destinatario: destinatarioLabel || "",
                      };
                      const body = applyTemplate(String(tpl.body_template || ""), ctx).trim();
                      if (body) setAlertMessaggio(body);
                    }}
                    style={{ width: "100%", padding: 8 }}
                  >
                    <option value="">— Seleziona preset —</option>
                    {presets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.titolo || t.codice || t.id}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
                    Seleziona un preset per precompilare il messaggio
                  </div>
                </label>
              );
            })()}
            <label style={{ display: "block", marginBottom: 12 }}>
              Messaggio (opzionale)<br />
              <textarea
                value={alertMessaggio}
                onChange={(e) => setAlertMessaggio(e.target.value)}
                rows={4}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={alertSendEmail}
                onChange={(e) => setAlertSendEmail(e.target.checked)}
              />
              Invia email
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setAlertTask(null);
                  setAlertSelectedPresetId("");
                }}
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
                onClick={handleSendAlert}
                disabled={
                  alertManualMode
                    ? !isValidEmail(alertManualEmail) && !alertToCliente
                    : !alertDestinatarioId && !alertToCliente
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  opacity:
                    alertManualMode
                      ? isValidEmail(alertManualEmail) || alertToCliente
                        ? 1
                        : 0.5
                      : alertDestinatarioId || alertToCliente
                      ? 1
                      : 0.5,
                }}
              >
                Invia
              </button>
            </div>
          </div>
        </div>
      )}
      {ruleTask && (
        <div
          onClick={closeRuleSettings}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 55,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              padding: 16,
              width: "100%",
              maxWidth: 620,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Impostazioni notifiche</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12 }}>
              Task: {ruleTask.titolo}
              {ruleDraft ? (
                <>
                  <br />
                  Target: <strong>{ruleDraft.target}</strong>
                  <br />
                  Regola effettiva: <strong>{ruleOverride ? "OVERRIDE PROGETTO" : ruleGlobal ? "GLOBALE" : "DEFAULT"}</strong>
                  <br />
                {ruleOverride
                  ? "L'override progetto sostituisce la regola globale per questa task: non parte un secondo invio dalla globale."
                  : ruleGlobal
                  ? "Nessun override locale: questa task usa la regola globale del template."
                  : "Nessuna regola salvata: vale il default di sistema."}
                </>
              ) : null}
            </div>

            {ruleLoading ? (
              <div style={{ fontSize: 13, opacity: 0.7 }}>Caricamento regola...</div>
            ) : !ruleDraft ? (
              <>
                <div style={{ fontSize: 13, color: "#b91c1c" }}>
                  {ruleError || "Nessuna regola disponibile per questa task."}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={closeRuleSettings}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "white",
                    }}
                  >
                    Chiudi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!ruleTask) return;
                      const fallback = buildFallbackRuleDraft(ruleTask);
                      setRuleDraft(fallback);
                      setRuleRecipientsInput("");
                      setRuleAutoRecipients([]);
                      setRuleEffectiveRecipients([]);
                      setRuleError(
                        "Regola globale non disponibile. Stai creando un override progetto da questa checklist."
                      );
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                    }}
                  >
                    Crea override progetto
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={ruleDraft.enabled}
                      onChange={(e) =>
                        setRuleDraft((prev) => (prev ? { ...prev, enabled: e.target.checked } : prev))
                      }
                    />
                    Abilitata
                  </label>
                  <label>
                    Mode<br />
                    <select
                      value={ruleDraft.mode}
                      onChange={(e) =>
                        setRuleDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                mode: e.target.value === "MANUALE" ? "MANUALE" : "AUTOMATICA",
                              }
                            : prev
                        )
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="AUTOMATICA">AUTOMATICA</option>
                      <option value="MANUALE">MANUALE</option>
                    </select>
                  </label>
                </div>

                <label style={{ display: "block", marginTop: 10 }}>
                  Destinatari automatici (da target)<br />
                  <div
                    style={{
                      minHeight: 38,
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 13,
                      background: "#fafafa",
                    }}
                  >
                    {ruleAutoRecipients.length
                      ? ruleAutoRecipients.join(", ")
                      : "Nessun operatore attivo con riceve_notifiche per questo target."}
                  </div>
                </label>

                <label style={{ display: "block", marginTop: 10 }}>
                  Email extra (opzionali, puoi scrivere email o nome operatore)<br />
                  <textarea
                    value={ruleRecipientsInput}
                    onChange={(e) => setRuleRecipientsInput(e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: 8 }}
                  />
                </label>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                  Destinatari effettivi:{" "}
                  {ruleEffectiveRecipients.length ? ruleEffectiveRecipients.join(", ") : "—"}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                  <label>
                    Frequenza<br />
                    <select
                      value={ruleDraft.frequency}
                      onChange={(e) =>
                        setRuleDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                frequency:
                                  e.target.value === "WEEKLY"
                                    ? "WEEKLY"
                                    : e.target.value === "WEEKDAYS"
                                    ? "WEEKDAYS"
                                    : "DAILY",
                              }
                            : prev
                        )
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="DAILY">DAILY</option>
                      <option value="WEEKDAYS">WEEKDAYS</option>
                      <option value="WEEKLY">WEEKLY</option>
                    </select>
                  </label>
                  <label>
                    Ora invio<br />
                    <input
                      type="time"
                      value={ruleDraft.send_time}
                      onChange={(e) =>
                        setRuleDraft((prev) => (prev ? { ...prev, send_time: e.target.value } : prev))
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                  <label>
                    Timezone<br />
                    <input
                      value={ruleDraft.timezone}
                      onChange={(e) =>
                        setRuleDraft((prev) => (prev ? { ...prev, timezone: e.target.value } : prev))
                      }
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                </div>
                {(ruleDraft.mode === "AUTOMATICA" || ruleDraft.target === "AMMINISTRAZIONE") && (
                  <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={ruleDraft.send_on_create}
                      onChange={(e) =>
                        setRuleDraft((prev) =>
                          prev ? { ...prev, send_on_create: e.target.checked } : prev
                        )
                      }
                    />
                    Invia anche alla creazione della checklist
                  </label>
                )}

                {ruleDraft.frequency === "WEEKLY" && (
                  <label style={{ display: "block", marginTop: 10 }}>
                    Giorno settimana<br />
                    <select
                      value={ruleDraft.day_of_week ?? 1}
                      onChange={(e) =>
                        setRuleDraft((prev) =>
                          prev ? { ...prev, day_of_week: Number(e.target.value) } : prev
                        )
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value={1}>Lunedì</option>
                      <option value={2}>Martedì</option>
                      <option value={3}>Mercoledì</option>
                      <option value={4}>Giovedì</option>
                      <option value={5}>Venerdì</option>
                      <option value={6}>Sabato</option>
                      <option value={0}>Domenica</option>
                    </select>
                  </label>
                )}

                <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={ruleDraft.only_future}
                    onChange={(e) =>
                      setRuleDraft((prev) => (prev ? { ...prev, only_future: e.target.checked } : prev))
                    }
                  />
                  Solo checklist future
                </label>

                {ruleError && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>{ruleError}</div>
                )}

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={closeRuleSettings}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "white",
                    }}
                  >
                    Chiudi
                  </button>
                  {ruleOverride && (
                    <button
                      type="button"
                      onClick={resetRuleOverride}
                      disabled={ruleSaving}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #b91c1c",
                        background: "white",
                        color: "#b91c1c",
                        opacity: ruleSaving ? 0.7 : 1,
                      }}
                    >
                      Ripristina default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={saveRuleSettings}
                    disabled={ruleSaving}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      opacity: ruleSaving ? 0.7 : 1,
                    }}
                  >
                    {ruleSaving ? "Salvataggio..." : "Salva override progetto"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
