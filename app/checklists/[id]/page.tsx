"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import ClientiCombobox from "@/components/ClientiCombobox";
import Toast from "@/components/Toast";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { sendAlert } from "@/lib/sendAlert";
import { calcM2FromDimensioni } from "@/lib/parseDimensioni";

type Checklist = {
  id: string;
  cliente: string;
  cliente_id: string | null;
  nome_checklist: string;
  proforma: string | null;
  magazzino_importazione: string | null;
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

type FormData = {
  cliente: string;
  cliente_id: string;
  nome_checklist: string;
  proforma: string;
  magazzino_importazione: string;
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
  task_template_id: string | null;
  enabled: boolean;
  mode: "AUTOMATICA" | "MANUALE";
  task_title: string;
  target: "MAGAZZINO" | "TECNICO_SW" | "GENERICA";
  recipients: string[];
  frequency: "DAILY" | "WEEKDAYS" | "WEEKLY";
  send_time: string;
  timezone: string;
  day_of_week: number | null;
  stop_statuses: string[];
  only_future: boolean;
};

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
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
  return v.startsWith("TEC") || v.startsWith("SAS");
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
    "SAS-PL": "CARE PLUS",
    "SAS-PR": "CARE PREMIUM",
    "SAS-UL": "CARE ULTRA",
    "SAS-UL-ILL": "CARE ULTRA (illimitato)",
    "SAS-PR4": "CARE PREMIUM (H4)",
    "SAS-PR8": "CARE PREMIUM (H8)",
    "SAS-PR12": "CARE PREMIUM (H12)",
    "SAS-PR24": "CARE PREMIUM (H24)",
    "SAS-PR36": "CARE PREMIUM (H36)",
    "SAS-UL4": "CARE ULTRA",
    "SAS-UL8": "CARE ULTRA",
    "SAS-UL12": "CARE ULTRA",
    "SAS-UL24": "CARE ULTRA",
    "SAS-UL36": "CARE ULTRA",
    "SAS-EVTR": "ART TECH EVENT",
    "SAS-EVTF": "ART TECH EVENT (remoto)",
    "SAS-EVTO": "ART TECH EVENT (onsite)",
    "SAS-MON": "MONITORAGGIO REMOTO & ALERT",
    "SAS-TCK": "TICKETING / HELP DESK",
    "SAS-SIM": "CONNETTIVITÀ SIM DATI",
    "SAS-CMS": "LICENZA CMS / SOFTWARE TERZI",
    "SAS-BKP": "BACKUP / RIPRISTINO",
    "SAS-RPT": "REPORTISTICA",
    "SAS-SLA": "SLA RIPRISTINO",
    "SAS-EXT": "ESTENSIONE GARANZIA",
    "SAS-CYB": "CYBER / HARDENING",
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
  const [alertSendEmail, setAlertSendEmail] = useState(true);
  const [alertManualMode, setAlertManualMode] = useState(false);
  const [alertManualEmail, setAlertManualEmail] = useState("");
  const [alertManualName, setAlertManualName] = useState("");
  const [alertFormError, setAlertFormError] = useState<string | null>(null);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);
  const [ruleTask, setRuleTask] = useState<ChecklistTask | null>(null);
  const [ruleDraft, setRuleDraft] = useState<NotificationRule | null>(null);
  const [ruleRecipientsInput, setRuleRecipientsInput] = useState("");
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleSendingNow, setRuleSendingNow] = useState(false);
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

  function normalizeSerial(input: string) {
    return input.trim().toUpperCase().replace(/\s+/g, " ");
  }

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
    const { data, error: err } = await supabase
      .from("asset_serials")
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
    const { error: err } = await supabase.from("asset_serials").delete().eq("id", serial.id);
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
    const { data, error: err } = await supabase
      .from("asset_serials")
      .select("checklist_id")
      .eq("tipo", tipo)
      .eq("seriale", seriale);
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
    const { data: checklistsData } = await supabase
      .from("checklists")
      .select("id, cliente, nome_checklist")
      .in("id", others);
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

  function buildFormData(c: Checklist): FormData {
    return {
      cliente: c.cliente ?? "",
      cliente_id: c.cliente_id ?? "",
      nome_checklist: c.nome_checklist ?? "",
      proforma: c.proforma ?? "",
      magazzino_importazione: c.magazzino_importazione ?? "",
      saas_tipo: c.saas_tipo ?? "",
      saas_piano: c.saas_piano ?? "",
      saas_scadenza: toDateInput(c.saas_scadenza),
      saas_stato: c.saas_stato ?? "",
      saas_note: c.saas_note ?? "",
      data_prevista: toDateInput(c.data_prevista),
      data_tassativa: toDateInput(c.data_tassativa),
      tipo_impianto: c.tipo_impianto ?? "",
      impianto_indirizzo: c.impianto_indirizzo ?? "",
      impianto_codice: c.impianto_codice ?? "",
      impianto_descrizione: c.impianto_descrizione ?? "",
      dimensioni: c.dimensioni ?? "",
      impianto_quantita:
        Number.isFinite(Number(c.impianto_quantita)) && Number(c.impianto_quantita) > 0
          ? Number(c.impianto_quantita)
          : 1,
      numero_facce: Number(c.numero_facce ?? 1) > 1 ? 2 : 1,
      passo: c.passo ?? "",
      note: c.note ?? "",
      tipo_struttura: c.tipo_struttura ?? "",
      noleggio_vendita: c.noleggio_vendita ?? "",
      fine_noleggio: toDateInput(c.fine_noleggio),
      mercato: c.mercato ?? "",
      modello: c.modello ?? "",
      stato_progetto: c.stato_progetto ?? "IN_CORSO",
      data_installazione_reale: toDateInput(c.data_installazione_reale),
      garanzia_scadenza: toDateInput(c.garanzia_scadenza),
    };
  }

  async function load(id: string) {
    setLoading(true);
    setError(null);
    setItemsError(null);

    const { data: head, error: err1 } = await supabase
      .from("checklists")
      .select(
        "*, created_by_name, updated_by_name, created_by_operatore, updated_by_operatore"
      )
      .eq("id", id)
      .single();

    if (err1) {
      setError("Errore caricamento checklist: " + err1.message);
      setLoading(false);
      return;
    }

    const { data: items, error: err2 } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("checklist_id", id)
      .order("created_at", { ascending: true });

    if (err2) {
      setError("Errore caricamento righe: " + err2.message);
      setLoading(false);
      return;
    }

    const { data: tasks, error: tasksErr } = await supabase
      .from("checklist_tasks")
      .select(
        "id, sezione, ordine, titolo, stato, note, task_template_id, updated_at, updated_by_operatore, operatori:updated_by_operatore ( id, nome )"
      )
      .eq("checklist_id", id)
      .order("sezione", { ascending: true })
      .order("ordine", { ascending: true });

    if (tasksErr) {
      setError("Errore caricamento task: " + tasksErr.message);
      setLoading(false);
      return;
    }

    const { data: licenzeData, error: licenzeErr } = await supabase
      .from("licenses")
      .select(
        "id, checklist_id, tipo, scadenza, stato, note, intestata_a, ref_univoco, telefono, intestatario, gestore, fornitore, created_at"
      )
      .eq("checklist_id", id)
      .order("created_at", { ascending: false });

    if (licenzeErr) {
      setError("Errore caricamento licenze: " + licenzeErr.message);
      setLoading(false);
      return;
    }

    const { data: docsData, error: docsErr } = await supabase
      .from("checklist_documents")
      .select(
        "id, checklist_id, tipo, filename, storage_path, uploaded_at, uploaded_by_operatore"
      )
      .eq("checklist_id", id)
      .order("uploaded_at", { ascending: false });

    if (docsErr) {
      setError("Errore caricamento documenti: " + docsErr.message);
      setLoading(false);
      return;
    }

    const { data: serialsData, error: serialsErr } = await supabase
      .from("asset_serials")
      .select("*")
      .eq("checklist_id", id)
      .order("created_at", { ascending: true });

    if (serialsErr) {
      setError("Errore caricamento seriali: " + serialsErr.message);
      setLoading(false);
      return;
    }

    if (!catalogLoaded) {
      const { data: catalogData, error: catalogErr } = await supabase
        .from("catalog_items")
        .select("id, codice, descrizione, tipo, categoria, attivo")
        .eq("attivo", true)
        .order("descrizione", { ascending: true });
      const { data: deviceData, error: deviceErr } = await supabase
        .from("catalog_items")
        .select("id, codice, descrizione, tipo, categoria, attivo")
        .eq("attivo", true)
        .ilike("codice", "EL-%")
        .order("descrizione", { ascending: true });

      if (catalogErr) {
        console.error("Errore caricamento catalogo", catalogErr);
      } else {
        setCatalogItems((catalogData || []) as CatalogItem[]);
      }
      if (deviceErr) {
        console.error("Errore caricamento device/modelli (EL-%)", deviceErr);
      } else {
        setDeviceCatalogItems((deviceData || []) as CatalogItem[]);
      }
      setCatalogLoaded(true);
    }

    const headChecklist = head as Checklist;
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

    let activeContratto: ContrattoRow | null = null;
    let ultraNome: string | null = null;
    if (clienteKey) {
      const { data: contrattiData, error: contrattiErr } = await supabase
        .from("saas_contratti")
        .select("id, cliente, piano_codice, scadenza, interventi_annui, illimitati, created_at")
        .ilike("cliente", `%${clienteKey}%`)
        .order("created_at", { ascending: false });

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
        const { data: pianoRow } = await supabase
          .from("saas_piani")
          .select("codice, nome")
          .eq("codice", activeContratto.piano_codice)
          .maybeSingle();
        ultraNome = (pianoRow as any)?.nome ?? null;
      }

      if (activeContratto?.id) {
        const { count } = await supabase
          .from("saas_interventi")
          .select("id", { count: "exact", head: true })
          .eq("contratto_id", activeContratto.id)
          .eq("incluso", true);
        setInterventiInclusiUsati(count ?? 0);
      } else {
        setInterventiInclusiUsati(0);
      }
    }

    setContrattoUltra(activeContratto);
    setContrattoUltraNome(ultraNome);
    setChecklist(headChecklist);
    setRows(mappedRows);
    setOriginalRowIds((items || []).map((r) => r.id));
    setTasks((tasks || []) as unknown as ChecklistTask[]);
    setLicenze((licenzeData || []) as Licenza[]);
    setDocuments((docsData || []) as ChecklistDocument[]);
    setAssetSerials((serialsData || []) as AssetSerial[]);

    const { data: alertData, error: alertErr } = await supabase
      .from("checklist_alert_log")
      .select("task_id, to_operatore_id, created_at")
      .eq("checklist_id", id)
      .order("created_at", { ascending: false });
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
    setLoading(false);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
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
      await load(nextId);
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
    (async () => {
      const { data, error: opErr } = await supabase
        .from("operatori")
        .select("id, nome, email, attivo, alert_enabled, alert_tasks, cliente, ruolo");
      if (opErr) {
        console.error("Errore caricamento operatori", opErr);
        return;
      }
      const map = new Map<string, string>();
      const list: AlertOperatore[] = (data || []).map((o: any) => ({
        id: o.id,
        nome: o.nome ?? null,
        email: o.email ?? null,
        attivo: Boolean(o.attivo),
        cliente: o.cliente ?? null,
        ruolo: o.ruolo ?? null,
        alert_enabled: Boolean(o.alert_enabled),
        alert_tasks: normalizeAlertTasks(o.alert_tasks),
      }));
      (data || []).forEach((o: any) => {
        if (o?.id) map.set(o.id, o.nome ?? o.id);
      });
      setOperatoriMap(map);
      setAlertOperatori(list);
    })();
  }, []);

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
    return !(code.startsWith("TEC") || code.startsWith("SAS"));
  });
  const deviceOptions = deviceCatalogItems;
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
    return alertOperatori.filter((o) => {
      if (!o.attivo || !o.alert_enabled) return false;
      if (checklist?.cliente && o.cliente && String(o.cliente).trim() !== String(checklist.cliente).trim()) {
        return false;
      }
      if (o.alert_tasks?.all_task_status_change) return true;
      if (!task.task_template_id) return true;
      return o.alert_tasks?.task_template_ids?.includes(task.task_template_id);
    });
  }

  async function handleSendAlert() {
    if (!alertTask || !checklist) return;
    setAlertFormError(null);
    const manualEmail = alertManualEmail.trim();
    if (alertManualMode) {
      if (!isValidEmail(manualEmail)) {
        setAlertFormError("Inserisci un'email valida.");
        return;
      }
    } else if (!alertDestinatarioId) {
      setAlertFormError("Seleziona un destinatario.");
      return;
    }
    const destinatario = alertOperatori.find((o) => o.id === alertDestinatarioId);
    if (!alertManualMode && alertSendEmail && !destinatario?.email) {
      setAlertFormError("Il destinatario non ha un'email configurata.");
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

      const { data: tpl } = await supabase
        .from("checklist_task_templates")
        .select("id")
        .eq("sezione", sezioneNorm)
        .eq("titolo", alertTask.titolo)
        .limit(1)
        .maybeSingle();

      if (tpl?.id) {
        taskTemplateId = tpl.id;
        await supabase
          .from("checklist_tasks")
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

    try {
      await sendAlert({
        canale: "manual_task",
        subject,
        text: dettagli,
        html,
        to_email: alertManualMode ? manualEmail : destinatario?.email ?? null,
        to_nome: alertManualMode ? (alertManualName.trim() || null) : destinatario?.nome ?? null,
        to_operatore_id: alertManualMode ? null : alertDestinatarioId,
        from_operatore_id: opId,
        checklist_id: checklist.id,
        task_id: alertTask.id,
        task_template_id: taskTemplateId,
        send_email: alertSendEmail,
      });
    } catch (err) {
      console.error("Errore invio alert task", err);
      showToast(`❌ Invio fallito: ${briefError(err)}`, "error");
      return;
    }

    showToast(alertSendEmail ? "✅ Email inviata" : "✅ Avviso registrato", "success");
    setAlertNotice(
      alertSendEmail ? "✅ Email inviata e log registrato." : "Log registrato (email disattivata)."
    );
    setTimeout(() => setAlertNotice(null), 2500);
    setLastAlertByTask((prev) => {
      const next = new Map(prev);
      next.set(alertTask.id, {
        toOperatoreId: alertDestinatarioId,
        createdAt: new Date().toISOString(),
      });
      return next;
    });
    setTimeout(() => setAlertTask(null), 800);
    setAlertDestinatarioId("");
    setAlertMessaggio("");
    setAlertSendEmail(true);
    setAlertManualMode(false);
    setAlertManualEmail("");
    setAlertManualName("");
  }

  function parseRecipientsInput(input: string) {
    return Array.from(
      new Set(
        input
          .split(/[\n,;]+/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.includes("@"))
      )
    );
  }

  async function openRuleSettings(task: ChecklistTask) {
    setRuleTask(task);
    setRuleError(null);
    setRuleLoading(true);
    try {
      const targetRaw = String((task as any)?.target || "").trim().toUpperCase();
      const target =
        targetRaw === "MAGAZZINO" || targetRaw === "TECNICO_SW" ? targetRaw : "GENERICA";
      const query = new URLSearchParams({
        task_title: task.titolo,
        target,
      });
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
      const row = Array.isArray(json?.data) ? json.data[0] : null;
      const nextDraft: NotificationRule = row
        ? {
            id: row.id,
            task_template_id: row.task_template_id || task.task_template_id || null,
            enabled: row.enabled !== false,
            mode: row.mode === "MANUALE" ? "MANUALE" : "AUTOMATICA",
            task_title: row.task_title || task.titolo,
            target:
              row.target === "MAGAZZINO" || row.target === "TECNICO_SW"
                ? row.target
                : "GENERICA",
            recipients: Array.isArray(row.recipients)
              ? row.recipients.map((x: any) => String(x || "").trim().toLowerCase()).filter((x: string) => x.includes("@"))
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
            stop_statuses:
              Array.isArray(row.stop_statuses) && row.stop_statuses.length > 0
                ? row.stop_statuses.map((x: any) => String(x || "").trim().toUpperCase())
                : ["OK", "NON_NECESSARIO"],
            only_future: row.only_future !== false,
          }
        : {
            task_template_id: task.task_template_id || null,
            enabled: true,
            mode: "MANUALE",
            task_title: task.titolo,
            target,
            recipients: [],
            frequency: "DAILY",
            send_time: "07:30",
            timezone: "Europe/Rome",
            day_of_week: null,
            stop_statuses: ["OK", "NON_NECESSARIO"],
            only_future: true,
          };
      setRuleDraft(nextDraft);
      setRuleRecipientsInput(nextDraft.recipients.join(", "));
    } catch (err: any) {
      setRuleError(err?.message || "Errore caricamento regola.");
      setRuleDraft(null);
    } finally {
      setRuleLoading(false);
    }
  }

  function closeRuleSettings() {
    setRuleTask(null);
    setRuleDraft(null);
    setRuleRecipientsInput("");
    setRuleError(null);
    setRuleLoading(false);
    setRuleSaving(false);
    setRuleSendingNow(false);
  }

  async function saveRuleSettings() {
    if (!ruleDraft) return;
    const recipients = parseRecipientsInput(ruleRecipientsInput);
    const payload = {
      ...ruleDraft,
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
        setRuleDraft({
          id: saved.id,
          task_template_id: saved.task_template_id || payload.task_template_id || null,
          enabled: saved.enabled !== false,
          mode: saved.mode === "MANUALE" ? "MANUALE" : "AUTOMATICA",
          task_title: saved.task_title || payload.task_title,
          target:
            saved.target === "MAGAZZINO" || saved.target === "TECNICO_SW"
              ? saved.target
              : "GENERICA",
          recipients: Array.isArray(saved.recipients)
            ? saved.recipients.map((x: any) => String(x || "").trim().toLowerCase()).filter((x: string) => x.includes("@"))
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
          stop_statuses:
            Array.isArray(saved.stop_statuses) && saved.stop_statuses.length > 0
              ? saved.stop_statuses.map((x: any) => String(x || "").trim().toUpperCase())
              : ["OK", "NON_NECESSARIO"],
          only_future: saved.only_future !== false,
        });
        setRuleRecipientsInput(
          Array.isArray(saved.recipients)
            ? saved.recipients
                .map((x: any) => String(x || "").trim().toLowerCase())
                .filter((x: string) => x.includes("@"))
                .join(", ")
            : recipients.join(", ")
        );
      }
      showToast("Regola notifiche salvata", "success");
    } catch (err: any) {
      setRuleError(err?.message || "Errore salvataggio regola.");
    } finally {
      setRuleSaving(false);
    }
  }

  async function sendRuleNow() {
    if (!ruleDraft) return;
    setRuleSendingNow(true);
    setRuleError(null);
    try {
      const res = await fetch("/api/notifications/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          task_template_id: ruleDraft.task_template_id,
          task_title: ruleDraft.task_title,
          target: ruleDraft.target,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Errore invio manuale.");
      }
      showToast(`Invio manuale completato (${json?.emails_sent ?? 0} email)`, "success");
    } catch (err: any) {
      setRuleError(err?.message || "Errore invio manuale.");
    } finally {
      setRuleSendingNow(false);
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
    const { error: insertErr } = await supabase.from("licenses").insert(payload);
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
    const { error: updateErr } = await supabase
      .from("licenses")
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

    const { error: uploadErr } = await supabase.storage
      .from("checklist-documents")
      .upload(storagePath, docFile, { upsert: false });

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

    const { error: insErr } = await supabase
      .from("checklist_documents")
      .insert(payload);

    if (insErr) {
      alert("Errore salvataggio documento: " + insErr.message);
      return;
    }

    setDocType("");
    setDocFile(null);
    await load(id);
  }

  async function openDocument(doc: ChecklistDocument, download: boolean) {
    const { data, error: urlErr } = await supabase.storage
      .from("checklist-documents")
      .createSignedUrl(doc.storage_path, 60, download ? { download: true } : undefined);
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

    const { error: storageErr } = await supabase.storage
      .from("checklist-documents")
      .remove([doc.storage_path]);

    if (storageErr) {
      alert("Errore eliminazione file: " + storageErr.message);
      return;
    }

    const { error: delErr } = await supabase
      .from("checklist_documents")
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

    const tryUpdate = async (payloadUpdate: Partial<typeof payload>) => {
      return supabase.from("checklists").update(payloadUpdate).eq("id", id);
    };

    let { error: errUpdate } = await tryUpdate(payload);

    if (errUpdate && isClienteIdMissing(errUpdate)) {
      const { cliente_id, ...legacyPayload } = payload;
      ({ error: errUpdate } = await tryUpdate(legacyPayload));
    }
    if (errUpdate && isImpiantoQuantitaMissing(errUpdate)) {
      const { impianto_quantita, ...legacyPayload } = payload;
      ({ error: errUpdate } = await tryUpdate(legacyPayload));
    }

    if (errUpdate) {
      const info = logSupabaseError("update checklist", errUpdate);
      alert("Errore salvataggio: " + (info || errUpdate.message));
      return;
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
        setItemsError("TEC e SAS si gestiscono nelle sezioni dedicate.");
        return;
      }
      if (
        isCustomCode(r.codice) &&
        (startsWithTecOrSas(r.descrizione_custom) || startsWithTecOrSas(r.descrizione))
      ) {
        setItemsError("TEC e SAS si gestiscono nelle sezioni dedicate.");
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
      const { error: itemsUpdateErr } = await supabase
        .from("checklist_items")
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
      const { error: itemsInsertErr } = await supabase
        .from("checklist_items")
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
      const { error: itemsDeleteErr } = await supabase
        .from("checklist_items")
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

    const { error: itemsErr } = await supabase
      .from("checklist_items")
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

    const { error: licensesErr } = await supabase
      .from("licenses")
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

    const { data: docsData, error: docsErr } = await supabase
      .from("checklist_documents")
      .select("id, storage_path")
      .eq("checklist_id", id);
    if (docsErr) {
      const msg =
        logSupabaseError("load checklist_documents", docsErr) ||
        "Errore caricamento documenti checklist";
      alert(msg);
      setItemsError(msg);
      return;
    }
    const paths = (docsData || [])
      .map((d: any) => d.storage_path)
      .filter(Boolean);
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage
        .from("checklist-documents")
        .remove(paths);
      if (storageErr) {
        const msg =
          logSupabaseError("delete storage files", storageErr) ||
          "Errore eliminazione file documenti";
        alert(msg);
        setItemsError(msg);
        return;
      }
    }

    const { error: docsDeleteErr } = await supabase
      .from("checklist_documents")
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

    const { error: checklistErr } = await supabase.from("checklists").delete().eq("id", id);
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
  const proformaDocs = documents.filter(
    (d) => String(d.tipo ?? "").toUpperCase() === "FATTURA_PROFORMA" || String(d.tipo ?? "").toUpperCase() === "PROFORMA"
  );
  const hasProformaDoc = proformaDocs.length > 0;
  const proformaDocTitle = hasProformaDoc
    ? `Documento PROFORMA: ${proformaDocs[0].filename}`
    : "Documento PROFORMA presente";

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
            onClick={() => setEditMode(true)}
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
                  ? operatoriMap.get(checklist.created_by_operatore) ?? "—"
                  : "—")
              }
              isEdit={false}
            />
            <FieldRow
              label="Modificato da"
              view={
                checklist.updated_by_name ??
                (checklist.updated_by_operatore
                  ? operatoriMap.get(checklist.updated_by_operatore) ?? "—"
                  : "—")
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
                    value={formData.impianto_codice}
                    onChange={(e) => {
                      const code = e.target.value;
                      const selected = impiantoOptions.find((i) => (i.codice ?? "") === code);
                      setFormData({
                        ...formData,
                        impianto_codice: code,
                        impianto_descrizione: selected?.descrizione ?? "",
                      });
                    }}
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="">— seleziona impianto TEC —</option>
                    {impiantoOptions.map((item) => (
                      <option key={item.id} value={item.codice ?? ""}>
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
              label="Magazzino importazione"
              view={checklist.magazzino_importazione || "—"}
              edit={
                isEdit ? (
                  <input
                    value={formData.magazzino_importazione}
                    onChange={(e) =>
                      setFormData({ ...formData, magazzino_importazione: e.target.value })
                    }
                    style={{ width: "100%", padding: 10 }}
                  />
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
      <div style={{ marginTop: 22 }}>
        <h2 style={{ marginTop: 0 }}>SERVIZI</h2>

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
                    <option value="SAS-PL">SAS-PL — CARE PLUS</option>
                    <option value="SAS-PR">SAS-PR — CARE PREMIUM</option>
                    <option value="SAS-UL">SAS-UL — CARE ULTRA</option>
                    <option value="SAS-UL-ILL">SAS-UL-ILL — CARE ULTRA (illimitato)</option>
                    <option value="SAS-PR4">SAS-PR4 — CARE PREMIUM (H4)</option>
                    <option value="SAS-PR8">SAS-PR8 — CARE PREMIUM (H8)</option>
                    <option value="SAS-PR12">SAS-PR12 — CARE PREMIUM (H12)</option>
                    <option value="SAS-PR24">SAS-PR24 — CARE PREMIUM (H24)</option>
                    <option value="SAS-PR36">SAS-PR36 — CARE PREMIUM (H36)</option>
                    <option value="SAS-UL4">SAS-UL4 — CARE ULTRA (H4)</option>
                    <option value="SAS-UL8">SAS-UL8 — CARE ULTRA (H8)</option>
                    <option value="SAS-UL12">SAS-UL12 — CARE ULTRA (H12)</option>
                    <option value="SAS-UL24">SAS-UL24 — CARE ULTRA (H24)</option>
                    <option value="SAS-UL36">SAS-UL36 — CARE ULTRA (H36)</option>
                    <option value="SAS-EVTR">SAS-EVTR — ART TECH EVENT</option>
                    <option value="SAS-MON">SAS-MON — MONITORAGGIO REMOTO & ALERT</option>
                    <option value="SAS-TCK">SAS-TCK — TICKETING / HELP DESK</option>
                    <option value="SAS-SIM">SAS-SIM — CONNETTIVITÀ SIM DATI</option>
                    <option value="SAS-CMS">SAS-CMS — LICENZA CMS / SOFTWARE TERZI</option>
                    <option value="SAS-BKP">SAS-BKP — BACKUP / RIPRISTINO</option>
                    <option value="SAS-RPT">SAS-RPT — REPORTISTICA</option>
                    <option value="SAS-SLA">SAS-SLA — SLA RIPRISTINO</option>
                    <option value="SAS-EXT">SAS-EXT — ESTENSIONE GARANZIA</option>
                    <option value="SAS-CYB">SAS-CYB — CYBER / HARDENING</option>
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
                  <option value="SAS-EVTR">SAS-EVTR — ART TECH EVENT</option>
                  <option value="SAS-EVTF">SAS-EVTF — ART TECH EVENT (remoto)</option>
                  <option value="SAS-EVTO">SAS-EVTO — ART TECH EVENT (onsite)</option>
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
            <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.9fr 2fr 2fr 160px",
                  gap: 0,
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
                    gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.9fr 2fr 2fr 160px",
                    gap: 0,
                    padding: "10px 12px",
                    borderBottom: "1px solid #f5f5f5",
                    alignItems: "center",
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
                  <div style={{ display: "flex", gap: 8 }}>
                    {editMode ? (
                      editingLicenzaId === l.id ? (
                        <>
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
        </div>
      </div>
      <div style={{ marginTop: 22 }}>
        <h2 style={{ marginTop: 0 }}>Documenti checklist</h2>

        {docError && (
          <div style={{ color: "crimson", marginBottom: 10 }}>{docError}</div>
        )}

        <div
          style={{
            marginBottom: 12,
            padding: 12,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "white",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "200px 1fr 140px",
              gap: 10,
              alignItems: "end",
            }}
          >
            <label>
              Tipo documento<br />
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                style={{ width: "100%", padding: 10 }}
              >
                <option value="">—</option>
                <option value="FATTURA_PROFORMA">FATTURA PROFORMA</option>
                <option value="DDT">DDT</option>
                <option value="FOTO">FOTO</option>
                <option value="ALTRO">ALTRO</option>
              </select>
            </label>
            <label>
              File<br />
              <input
                type="file"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <button
              type="button"
              onClick={uploadDocument}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                cursor: "pointer",
              }}
            >
              Carica documento
            </button>
          </div>
        </div>

        {documents.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Nessun documento caricato</div>
        ) : (
          <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 200px",
                gap: 0,
                padding: "10px 12px",
                fontWeight: 700,
                borderBottom: "1px solid #eee",
                background: "#fafafa",
              }}
            >
              <div>Nome file</div>
              <div>Tipo</div>
              <div>Data upload</div>
              <div>Caricato da</div>
              <div>Azioni</div>
            </div>

            {documents.map((d) => (
              <div
                key={d.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 200px",
                  gap: 0,
                  padding: "10px 12px",
                  borderBottom: "1px solid #f5f5f5",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <div>{d.filename}</div>
                <div>{d.tipo ?? "—"}</div>
                <div>{d.uploaded_at ? new Date(d.uploaded_at).toLocaleString() : "—"}</div>
                <div>
                  {d.uploaded_by_operatore
                    ? operatoriMap.get(d.uploaded_by_operatore) ?? "—"
                    : "—"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => openDocument(d, false)}
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
                    onClick={() => openDocument(d, true)}
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
                    onClick={() => deleteDocument(d)}
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
        )}
      </div>

      <h2 style={{ marginTop: 22 }}>Voci / Prodotti</h2>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
        Accessori/Extra (no TEC, no SAS)
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

      {tasks.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Checklist operativa</h3>
          {alertNotice && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#166534" }}>
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
                  gridTemplateColumns: "1fr 160px 120px 220px",
                  gap: 12,
                  fontSize: 12,
                  opacity: 0.6,
                  marginBottom: 6,
                }}
              >
                <div></div>
                <div>Stato</div>
                <div>Alert inviato</div>
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
                  <div
                    key={t.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 160px 120px 220px",
                      gap: 12,
                      padding: "6px 0",
                      alignItems: "center",
                    }}
                  >
                    <div>{t.titolo}</div>

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

                          const { error } = await supabase
                            .from("checklist_tasks")
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
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setAlertTask(t)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #ddd",
                            background: "white",
                            cursor: "pointer",
                          }}
                        >
                          Invia alert
                        </button>
                        <button
                          type="button"
                          onClick={() => openRuleSettings(t)}
                          style={{
                            padding: "6px 9px",
                            borderRadius: 8,
                            border: "1px solid #d1d5db",
                            background: "#f8fafc",
                            color: "#111827",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          ⚙ Regola
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
                            ✔{" "}
                            {t.operatori?.nome ??
                              (t.updated_by_operatore ? `ID: ${t.updated_by_operatore}` : "—")}
                          </div>
                          <div>{new Date(t.updated_at).toLocaleString()}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ))}
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
                onClick={() => setAlertTask(null)}
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
                    ? !isValidEmail(alertManualEmail)
                    : !alertDestinatarioId
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  opacity:
                    alertManualMode
                      ? isValidEmail(alertManualEmail)
                        ? 1
                        : 0.5
                      : alertDestinatarioId
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
                </>
              ) : null}
            </div>

            {ruleLoading ? (
              <div style={{ fontSize: 13, opacity: 0.7 }}>Caricamento regola...</div>
            ) : !ruleDraft ? (
              <div style={{ fontSize: 13, color: "#b91c1c" }}>
                {ruleError || "Regola non disponibile."}
              </div>
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
                  Destinatari (email separate da virgola o newline)<br />
                  <textarea
                    value={ruleRecipientsInput}
                    onChange={(e) => setRuleRecipientsInput(e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: 8 }}
                  />
                </label>

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
                  {ruleDraft.mode === "MANUALE" && (
                    <button
                      type="button"
                      onClick={sendRuleNow}
                      disabled={ruleSendingNow}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #2563eb",
                        background: "#2563eb",
                        color: "white",
                        opacity: ruleSendingNow ? 0.7 : 1,
                      }}
                    >
                      {ruleSendingNow ? "Invio..." : "Invia ora"}
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
                    {ruleSaving ? "Salvataggio..." : "Salva"}
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
