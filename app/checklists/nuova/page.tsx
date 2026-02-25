"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfigMancante from "@/components/ConfigMancante";
import ClientiCombobox from "@/components/ClientiCombobox";
import ClienteModal, { ClienteRecord } from "@/components/ClienteModal";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { sendAlert } from "@/lib/sendAlert";
import { calcM2FromDimensioni } from "@/lib/parseDimensioni";

const SAAS_PIANI = [
  { code: "SAAS-PL", label: "CARE PLUS (ASSISTENZA BASE)" },
  { code: "SAAS-PR", label: "CARE PREMIUM (ASSISTENZA AVANZATA + MONITORAGGIO)" },
  { code: "SAAS-UL", label: "CARE ULTRA (ASSISTENZA PRIORITARIA / H24 SE PREVISTA)" },
  { code: "SAAS-PR4", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H4)" },
  { code: "SAAS-PR8", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H8)" },
  { code: "SAAS-PR12", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H12)" },
  { code: "SAAS-PR24", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H24)" },
  { code: "SAAS-PR36", label: "CARE PREMIUM (ASSISTENZA AVANZATA / H36)" },
  { code: "SAAS-UL4", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAAS-UL8", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAAS-UL12", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAAS-UL24", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAAS-UL36", label: "CARE ULTRA (ASSISTENZA PRIORITARIA)" },
  { code: "SAAS-EVTF", label: "ART TECH EVENT (assistenza remota durante eventi)" },
  { code: "SAAS-EVTO", label: "ART TECH EVENT (assistenza onsite durante eventi)" },
  { code: "SAAS-MON", label: "MONITORAGGIO REMOTO & ALERT" },
  { code: "SAAS-TCK", label: "TICKETING / HELP DESK" },
  { code: "SAAS-SIM", label: "CONNETTIVITÀ SIM DATI" },
  { code: "SAAS-CMS", label: "LICENZA CMS / SOFTWARE TERZI" },
  { code: "SAAS-BKP", label: "BACKUP CONFIGURAZIONI / RIPRISTINO" },
  { code: "SAAS-RPT", label: "REPORTISTICA (LOG, UPTIME, ON-AIR)" },
  { code: "SAAS-SLA", label: "SLA RIPRISTINO (ES. ENTRO 2H) – OPZIONE" },
  { code: "SAAS-EXT", label: "ESTENSIONE GARANZIA / COPERTURE" },
  { code: "SAAS-CYB", label: "CYBER / ANTIVIRUS / HARDENING PLAYER" },
];

const SAAS_SERVIZI_AGGIUNTIVI = [
  { code: "SAAS-EVTR", label: "ART TECH EVENTS (generico)" },
  { code: "SAAS-EVTF", label: "ART TECH EVENTS (assistenza remota durante eventi)" },
  { code: "SAAS-EVTO", label: "ART TECH EVENTS (assistenza onsite durante eventi)" },
];

type ChecklistItem = {
  codice: string;
  descrizione: string;
  descrizione_custom?: string;
  qty: string;
  note: string;
  search?: string;
  categoria_filter?: string;
};

type DraftLicenza = {
  tipo: string;
  scadenza: string;
  note: string;
};

type CatalogItem = {
  id: string;
  codice: string | null;
  descrizione: string | null;
  tipo: string | null;
  categoria?: string | null;
  attivo: boolean;
};

const CATEGORIE_VOCI = [
  "Elettronica",
  "SaaS/Servizi",
  "Prodotti",
  "Strutture",
  "Ricambi",
];

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

function renderBadge(label: "ATTIVA" | "SCADUTA" | "—") {
  let bg = "#e5e7eb";
  let color = "#374151";
  if (label === "ATTIVA") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (label === "SCADUTA") {
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
      {label}
    </span>
  );
}

function logSupabaseError(error: any) {
  if (!error) return;
  const info = {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
  };
  const raw =
    error && typeof error === "object"
      ? JSON.stringify(error, Object.getOwnPropertyNames(error))
      : String(error);
  console.error("SUPABASE ERROR:", {
    ...info,
    raw,
  });
  const parts = [
    info.message,
    info.details ? `details: ${info.details}` : null,
    info.hint ? `hint: ${info.hint}` : null,
    info.code ? `code: ${info.code}` : null,
    raw && raw !== "{}" ? `raw: ${raw}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function isFiniteNumberString(v: string) {
  if (v.trim() === "") return false;
  const n = Number(v);
  return Number.isFinite(n);
}

function isCustomCode(code: string) {
  return code.trim().toUpperCase() === "CUSTOM";
}

function normalizeCustomCode(code: string) {
  return isCustomCode(code) ? "CUSTOM" : code;
}

function startsWithTecOrSas(value?: string | null) {
  const v = String(value ?? "").trim().toUpperCase();
  return v.startsWith("TEC") || v.startsWith("SAAS");
}

function inferTaskTarget(titolo?: string | null, templateTarget?: string | null) {
  const fromTemplate = String(templateTarget || "")
    .trim()
    .toUpperCase();
  const normalizedFromTemplate =
    fromTemplate === "MAGAZZINO"
      ? "MAGAZZINO"
      : fromTemplate === "TECNICO_SW" ||
          fromTemplate === "TECNICO SW" ||
          fromTemplate === "TECNICO-SW"
        ? "TECNICO_SW"
        : fromTemplate === "GENERICA"
          ? "GENERICA"
          : "";
  if (normalizedFromTemplate) {
    return normalizedFromTemplate;
  }
  if (
    fromTemplate === "MAGAZZINO" ||
    fromTemplate === "TECNICO_SW" ||
    fromTemplate === "GENERICA"
  ) {
    return fromTemplate;
  }
  const t = String(titolo || "")
    .trim()
    .toUpperCase();
  if (t.includes("ELETTRONICA DI CONTROLLO: SCHEMI DATI ED ELETTRICI")) return "TECNICO_SW";
  if (t.includes("PREPARAZIONE / RISERVA DISPONIBILIT") || t.includes("ORDINE MERCE")) {
    return "MAGAZZINO";
  }
  return "GENERICA";
}

export default function NuovaChecklistPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }
  const router = useRouter();
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [deviceCatalogItems, setDeviceCatalogItems] = useState<CatalogItem[]>([]);
  const [currentOperatoreId, setCurrentOperatoreId] = useState<string>("");

  // campi testata
  const [cliente, setCliente] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [nomeChecklist, setNomeChecklist] = useState("");
  const [proforma, setProforma] = useState("");
  const [magazzinoImportazione, setMagazzinoImportazione] = useState("");
  const [saasPiano, setSaasPiano] = useState<string>("");
  const [saasTipo, setSaasTipo] = useState<string>("");
  const [saasScadenza, setSaasScadenza] = useState("");
  const [saasNote, setSaasNote] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [dataTassativa, setDataTassativa] = useState("");
  const [statoProgetto, setStatoProgetto] = useState("IN_CORSO");
  const [dataInstallazioneReale, setDataInstallazioneReale] = useState("");
  const [noleggioVendita, setNoleggioVendita] = useState("");
  const [tipoStruttura, setTipoStruttura] = useState("");
  const [passo, setPasso] = useState("");
  const [tipoImpianto, setTipoImpianto] = useState<"INDOOR" | "OUTDOOR" | "">("");
  const [impiantoIndirizzo, setImpiantoIndirizzo] = useState("");
  const [impiantoCodice, setImpiantoCodice] = useState("");
  const [impiantoDescrizione, setImpiantoDescrizione] = useState("");
  const [dimensioni, setDimensioni] = useState("");
  const [impiantoQuantita, setImpiantoQuantita] = useState(1);
  const [numeroFacce, setNumeroFacce] = useState(1);
  const [garanziaScadenza, setGaranziaScadenza] = useState("");
  const [serialControlInput, setSerialControlInput] = useState("");
  const [serialControlDeviceCode, setSerialControlDeviceCode] = useState("");
  const [serialControlDeviceDescrizione, setSerialControlDeviceDescrizione] = useState("");
  const [serialControlNote, setSerialControlNote] = useState("");
  const [serialModuleInput, setSerialModuleInput] = useState("");
  const [serialModuleNote, setSerialModuleNote] = useState("");
  const [serialiControllo, setSerialiControllo] = useState<
    { seriale: string; note: string; device_code: string | null; device_descrizione: string | null }[]
  >([]);
  const [serialiModuli, setSerialiModuli] = useState<
    { seriale: string; note: string; device_code: string | null; device_descrizione: string | null }[]
  >([]);
  const [serialsError, setSerialsError] = useState<string | null>(null);
  const [ultraScope, setUltraScope] = useState<"CLIENTE" | "CHECKLIST">("CLIENTE");
  const [ultraInclusi, setUltraInclusi] = useState<string>("");
  const [clienteModalOpen, setClienteModalOpen] = useState(false);

  const [rows, setRows] = useState<ChecklistItem[]>([
    {
      codice: "",
      descrizione: "",
      qty: "",
      note: "",
      search: "",
      categoria_filter: "",
    },
  ]);
  const [draftLicenze, setDraftLicenze] = useState<DraftLicenza[]>([]);
  const [newLicenza, setNewLicenza] = useState<DraftLicenza>({
    tipo: "",
    scadenza: "",
    note: "",
  });
  const [licenzeError, setLicenzeError] = useState<string | null>(null);

  const canCreate = useMemo(() => {
    return nomeChecklist.trim().length > 0 && cliente.trim().length > 0;
  }, [cliente, nomeChecklist]);
  const m2Calcolati = useMemo(
    () => {
      const base = calcM2FromDimensioni(dimensioni, numeroFacce);
      const qty =
        Number.isFinite(Number(impiantoQuantita)) && Number(impiantoQuantita) > 0
          ? Number(impiantoQuantita)
          : 1;
      return base == null ? null : base * qty;
    },
    [dimensioni, numeroFacce, impiantoQuantita]
  );

  const isUltraOrPremium =
    saasPiano.startsWith("SAAS-UL") || saasPiano.startsWith("SAAS-PR");

  const strutturaOptions = useMemo(() => {
    return catalogItems.filter((item) => {
      const code = (item.codice ?? "").toUpperCase();
      return code.startsWith("STR-") || code === "TEC-STRCT";
    });
  }, [catalogItems]);
  const impiantoOptions = useMemo(() => {
    return catalogItems.filter((item) => (item.codice ?? "").toUpperCase().startsWith("TEC"));
  }, [catalogItems]);
  const vociProdottiOptions = useMemo(() => {
    return catalogItems.filter((item) => {
      if (item.attivo === false) return false;
      const code = (item.codice ?? "").toUpperCase();
      return !(code.startsWith("TEC") || code.startsWith("SAAS"));
    });
  }, [catalogItems]);
  const deviceOptions = useMemo(() => deviceCatalogItems, [deviceCatalogItems]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null;
    if (stored) setCurrentOperatoreId(stored);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: catalogItems, error: catalogErr } = await supabase
        .from("catalog_items")
        .select("id, codice, descrizione, tipo, categoria, attivo")
        .eq("attivo", true)
        .order("descrizione", { ascending: true });
      const { data: deviceItems, error: deviceErr } = await supabase
        .from("catalog_items")
        .select("id, codice, descrizione, tipo, categoria, attivo")
        .eq("attivo", true)
        .ilike("codice", "EL-%")
        .order("descrizione", { ascending: true });

      if (catalogErr) {
        console.error("Errore caricamento catalogo", catalogErr);
      } else {
        setCatalogItems((catalogItems || []) as CatalogItem[]);
      }
      if (deviceErr) {
        console.error("Errore caricamento device/modelli (EL-%)", deviceErr);
      } else {
        setDeviceCatalogItems((deviceItems || []) as CatalogItem[]);
      }
    })();
  }, []);

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        codice: "",
        descrizione: "",
        qty: "",
        note: "",
        search: "",
        categoria_filter: "",
      },
    ]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, key: keyof ChecklistItem, value: string) {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  }

  function updateRowFields(idx: number, patch: Partial<ChecklistItem>) {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  function normalizeScadenza(input: string) {
    const raw = input.trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return raw;
  }

  function normalizeSerial(input: string) {
    return input.trim().toUpperCase().replace(/\s+/g, " ");
  }

  function addSerial(tipo: "CONTROLLO" | "MODULO_LED") {
    const raw = tipo === "CONTROLLO" ? serialControlInput : serialModuleInput;
    const deviceCode = tipo === "CONTROLLO" ? serialControlDeviceCode : "";
    const deviceDescrizione = tipo === "CONTROLLO" ? serialControlDeviceDescrizione : "";
    const noteRaw = tipo === "CONTROLLO" ? serialControlNote : serialModuleNote;
    const seriale = normalizeSerial(raw);
    if (!seriale) {
      setSerialsError("Inserisci un seriale valido.");
      return;
    }
    setSerialsError(null);
    if (tipo === "CONTROLLO") {
      if (serialiControllo.some((s) => s.seriale === seriale)) return;
      setSerialiControllo((prev) => [
        ...prev,
        {
          seriale,
          note: noteRaw.trim(),
          device_code: deviceCode || null,
          device_descrizione: deviceDescrizione || null,
        },
      ]);
      setSerialControlInput("");
      setSerialControlDeviceCode("");
      setSerialControlDeviceDescrizione("");
      setSerialControlNote("");
    } else {
      if (serialiModuli.some((s) => s.seriale === seriale)) return;
      setSerialiModuli((prev) => [
        ...prev,
        {
          seriale,
          note: noteRaw.trim(),
          device_code: deviceCode || null,
          device_descrizione: deviceDescrizione || null,
        },
      ]);
      setSerialModuleInput("");
      setSerialModuleNote("");
    }
  }

  function removeSerial(tipo: "CONTROLLO" | "MODULO_LED", seriale: string) {
    if (tipo === "CONTROLLO") {
      setSerialiControllo((prev) => prev.filter((s) => s.seriale !== seriale));
    } else {
      setSerialiModuli((prev) => prev.filter((s) => s.seriale !== seriale));
    }
  }

  function addDraftLicenza() {
    if (newLicenza.tipo.trim() === "") {
      setLicenzeError("Inserisci almeno il tipo licenza.");
      return;
    }
    if (newLicenza.scadenza.trim() === "") {
      setLicenzeError("Inserisci la scadenza della licenza.");
      return;
    }
    const scadenzaISO = normalizeScadenza(newLicenza.scadenza);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scadenzaISO)) {
      setLicenzeError("Scadenza non valida (usa il formato YYYY-MM-DD).");
      return;
    }
    setLicenzeError(null);
    setDraftLicenze((prev) => [
      ...prev,
      {
        tipo: newLicenza.tipo.trim(),
        scadenza: scadenzaISO,
        note: newLicenza.note.trim(),
      },
    ]);
    setNewLicenza({ tipo: "", scadenza: "", note: "" });
  }

  function removeDraftLicenza(idx: number) {
    setDraftLicenze((prev) => prev.filter((_, i) => i !== idx));
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

  async function onCreate() {
    try {
      if (!canCreate) {
        alert("Compila almeno Cliente e Nome checklist.");
        return;
      }
      if (!cliente.trim()) {
        alert("Inserisci il cliente.");
        return;
      }
      let operatoreId: string;
      try {
        operatoreId = await resolveOperatoreIdForSave();
      } catch (err: any) {
        alert(err?.message || "Operatore non associato");
        return;
      }

      const payloadChecklist = {
        cliente: cliente.trim(),
        cliente_id: clienteId,
        nome_checklist: nomeChecklist.trim(),
        proforma: proforma.trim() ? proforma.trim() : null,
        magazzino_importazione: magazzinoImportazione.trim()
          ? magazzinoImportazione.trim()
          : null,
        created_by_operatore: operatoreId,
        updated_by_operatore: operatoreId,
        saas_piano: saasPiano || null,
        saas_tipo: saasTipo || null,
        saas_scadenza: saasScadenza.trim() ? saasScadenza.trim() : null,
        saas_note: saasNote.trim() ? saasNote.trim() : null,
        tipo_saas: null,
        data_prevista: dataPrevista.trim() ? dataPrevista.trim() : null,
        data_tassativa: dataTassativa.trim() ? dataTassativa.trim() : null,
        stato_progetto: statoProgetto || null,
        data_installazione_reale: dataInstallazioneReale.trim()
          ? dataInstallazioneReale.trim()
          : null,
        noleggio_vendita: noleggioVendita.trim() ? noleggioVendita.trim() : null,
        tipo_struttura: tipoStruttura.trim() ? tipoStruttura.trim() : null,
        passo: passo.trim() ? passo.trim() : null,
        tipo_impianto: tipoImpianto || null,
        impianto_indirizzo: impiantoIndirizzo.trim() ? impiantoIndirizzo.trim() : null,
        impianto_codice: impiantoCodice.trim() ? impiantoCodice.trim() : null,
        impianto_descrizione: impiantoDescrizione.trim() ? impiantoDescrizione.trim() : null,
        dimensioni: dimensioni.trim() ? dimensioni.trim() : null,
        impianto_quantita:
          Number.isFinite(Number(impiantoQuantita)) && Number(impiantoQuantita) > 0
            ? Number(impiantoQuantita)
            : 1,
        numero_facce: numeroFacce,
        m2_calcolati: m2Calcolati != null ? m2Calcolati : null,
        m2_inclusi: m2Calcolati != null ? m2Calcolati : null,
        m2_allocati: null,
        garanzia_scadenza: garanziaScadenza.trim() ? garanziaScadenza.trim() : null,
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

      const tryInsert = async (payload: Partial<typeof payloadChecklist>) => {
        return supabase
          .from("checklists")
          .insert(payload)
          .select("id")
          .single();
      };

      let { data: created, error: errCreate } = await tryInsert(payloadChecklist);

      if (errCreate && isClienteIdMissing(errCreate)) {
        const { cliente_id, ...legacyPayload } = payloadChecklist;
        ({ data: created, error: errCreate } = await tryInsert(legacyPayload));
      }
      if (errCreate && isImpiantoQuantitaMissing(errCreate)) {
        const { impianto_quantita, ...legacyPayload } = payloadChecklist;
        ({ data: created, error: errCreate } = await tryInsert(legacyPayload));
      }

      if (errCreate) {
        const info = logSupabaseError(errCreate);
        alert("Errore insert checklist: " + (info || errCreate.message));
        return;
      }
      if (!created?.id) {
        alert("Errore: id checklist non ricevuto");
        return;
      }
      const checklistId = created.id as string;

      const { count: existingTasksCount, error: existingTasksErr } = await supabase
        .from("checklist_tasks")
        .select("id", { count: "exact", head: true })
        .eq("checklist_id", checklistId);

      if (existingTasksErr) {
        logSupabaseError(existingTasksErr);
        throw existingTasksErr;
      }

      function mapSezioneToInt(raw: any): number {
        if (raw === null || raw === undefined) return 0;
        if (typeof raw === "number" && Number.isFinite(raw)) return raw;
        const s0 = String(raw).toUpperCase().trim();
        const s = s0.replace(/[\s\-]+/g, "_");
        if (s.includes("DOCUMENTI")) return 0;
        if (s.includes("SEZIONE_1") || s.includes("SEZIONE1") || s.includes("SEZIONE_01"))
          return 1;
        if (s.includes("SEZIONE_2") || s.includes("SEZIONE2") || s.includes("SEZIONE_02"))
          return 2;
        if (s.includes("SEZIONE_3") || s.includes("SEZIONE3") || s.includes("SEZIONE_03"))
          return 3;
        if (s.includes("_1")) return 1;
        if (s.includes("_2")) return 2;
        if (s.includes("_3")) return 3;
        return 0;
      }

      if ((existingTasksCount ?? 0) === 0) {
        let tpl: any[] | null = null;
        let tplErr: any = null;
        const mapTaskTemplateRows = (rows: any[] | null | undefined) =>
          (rows || []).map((x: any) => ({
            sezione: x.sezione,
            ordine: x.ordine,
            titolo: x.titolo ?? x.voce,
            target: x.target ?? null,
          }));

        {
          const res = await supabase
            .from("checklist_task_templates")
            .select("sezione, ordine, titolo, target")
            .eq("attivo", true)
            .order("sezione", { ascending: true })
            .order("ordine", { ascending: true });
          tpl = mapTaskTemplateRows(res.data as any[] | null);
          tplErr = res.error;
        }

        if (tplErr && String(tplErr.message || "").toLowerCase().includes("target")) {
          const res = await supabase
            .from("checklist_task_templates")
            .select("sezione, ordine, titolo")
            .eq("attivo", true)
            .order("sezione", { ascending: true })
            .order("ordine", { ascending: true });
          tpl = mapTaskTemplateRows(res.data as any[] | null);
          tplErr = res.error;
        }

        if (
          tplErr &&
          String(tplErr.message || "").toLowerCase().includes("checklist_task_templates")
        ) {
          const res = await supabase
            .from("checklist_template_items")
            .select("sezione, ordine, voce")
            .eq("attivo", true)
            .order("sezione", { ascending: true })
            .order("ordine", { ascending: true });
          tpl = mapTaskTemplateRows(res.data as any[] | null);
          tplErr = res.error;
        }

        if (tplErr) {
          logSupabaseError(tplErr);
          throw tplErr;
        }

        const rows = (tpl ?? []).map((t: any) => ({
          checklist_id: checklistId,
          sezione: mapSezioneToInt(t.sezione),
          ordine: t.ordine,
          titolo: t.titolo,
          target: inferTaskTarget(t.titolo, t.target),
          stato: "DA_FARE",
        }));

        if (rows.length) {
          const { error: insErr } = await supabase.from("checklist_tasks").insert(rows);
          if (insErr) {
            logSupabaseError(insErr);
            throw insErr;
          }
        }
      }

      // Alcuni ambienti creano task via trigger DB: riallineo comunque il target dal template/titolo.
      {
        const { data: createdTasks, error: createdTasksErr } = await supabase
          .from("checklist_tasks")
          .select("id, titolo, target, task_template_id")
          .eq("checklist_id", checklistId);
        if (createdTasksErr) {
          logSupabaseError(createdTasksErr);
          throw createdTasksErr;
        }

        if (createdTasks && createdTasks.length > 0) {
          const templateIds = Array.from(
            new Set(
              createdTasks
                .map((t: any) => String(t.task_template_id || "").trim())
                .filter(Boolean)
            )
          );
          const templateById = new Map<string, string | null>();
          const templateByTitle = new Map<string, string | null>();

          if (templateIds.length > 0) {
            const { data: templatesById, error: templatesByIdErr } = await supabase
              .from("checklist_task_templates")
              .select("id, target")
              .in("id", templateIds);
            if (templatesByIdErr && !String(templatesByIdErr.message || "").toLowerCase().includes("target")) {
              logSupabaseError(templatesByIdErr);
              throw templatesByIdErr;
            }
            (templatesById || []).forEach((tpl: any) => {
              templateById.set(String(tpl.id), tpl.target ?? null);
            });
          }

          const { data: templatesByTitle, error: templatesByTitleErr } = await supabase
            .from("checklist_task_templates")
            .select("titolo, target")
            .eq("attivo", true);
          if (templatesByTitleErr && !String(templatesByTitleErr.message || "").toLowerCase().includes("target")) {
            logSupabaseError(templatesByTitleErr);
            throw templatesByTitleErr;
          }
          (templatesByTitle || []).forEach((tpl: any) => {
            const key = String(tpl.titolo || "").trim().toLowerCase();
            if (key && !templateByTitle.has(key)) {
              templateByTitle.set(key, tpl.target ?? null);
            }
          });

          for (const task of createdTasks as any[]) {
            const taskId = String(task.id || "");
            if (!taskId) continue;
            const taskTitle = String(task.titolo || "").trim();
            const currentTarget = String(task.target || "").trim().toUpperCase();
            const templateId = String(task.task_template_id || "").trim();
            const templateTargetById = templateId ? templateById.get(templateId) ?? null : null;
            const templateTargetByTitle = taskTitle
              ? templateByTitle.get(taskTitle.toLowerCase()) ?? null
              : null;
            const desiredTarget = inferTaskTarget(taskTitle, templateTargetById ?? templateTargetByTitle);
            if (currentTarget !== desiredTarget) {
              const { error: updTargetErr } = await supabase
                .from("checklist_tasks")
                .update({ target: desiredTarget })
                .eq("id", taskId);
              if (updTargetErr && !String(updTargetErr.message || "").toLowerCase().includes("target")) {
                logSupabaseError(updTargetErr);
                throw updTargetErr;
              }
            }
          }
        }
      }

      const { data: tmpl, error: tmplErr } = await supabase
        .from("checklist_template_items")
        .select("sezione, voce")
        .eq("attivo", true)
        .order("sezione", { ascending: true })
        .order("ordine", { ascending: true })
        .order("voce", { ascending: true });

      if (tmplErr) {
        const info = logSupabaseError(tmplErr);
        alert("Errore seed checklist template: " + (info || tmplErr.message));
      } else if (tmpl && tmpl.length > 0) {
        const payloadChecks = (tmpl as any[]).map((r) => ({
          checklist_id: checklistId,
          sezione: r.sezione,
          voce: r.voce,
          stato: "DA FARE",
          note: null,
        }));

        const { error: seedErr } = await supabase
          .from("checklist_checks")
          .insert(payloadChecks);

        if (seedErr) {
          const info = logSupabaseError(seedErr);
          alert("Errore seed checklist template: " + (info || seedErr.message));
        }
      }

      const normalizedRows = rows
        .map((r) => ({
          codice: normalizeCustomCode(r.codice.trim()),
          descrizione: r.descrizione.trim(),
          descrizione_custom: (r.descrizione_custom ?? "").trim(),
          qty: r.qty.trim(),
          note: r.note.trim(),
        }))
        .filter((r) => r.codice || r.descrizione || r.qty || r.note);

      for (const r of normalizedRows) {
        if (r.qty !== "" && !isFiniteNumberString(r.qty)) {
          alert(`Qty non valida (deve essere numero): "${r.qty}"`);
          return;
        }
        if (!isCustomCode(r.codice) && startsWithTecOrSas(r.codice)) {
          alert("TEC e SAAS si gestiscono nelle sezioni dedicate (Impianto / Licenze-SAAS).");
          return;
        }
        if (isCustomCode(r.codice) && r.descrizione_custom === "") {
          alert("Inserisci la descrizione per la voce fuori catalogo.");
          return;
        }
        if (
          isCustomCode(r.codice) &&
          (startsWithTecOrSas(r.descrizione_custom) || startsWithTecOrSas(r.descrizione))
        ) {
          alert("TEC e SAAS si gestiscono nelle sezioni dedicate (Impianto / Licenze-SAAS).");
          return;
        }
      }

      if (normalizedRows.length > 0) {
        const payloadItems = normalizedRows.map((r) => ({
          checklist_id: checklistId,
          codice: r.codice ? r.codice : null,
          descrizione: isCustomCode(r.codice)
            ? r.descrizione_custom || null
            : r.descrizione
            ? r.descrizione
            : null,
          quantita: r.qty === "" ? null : Number(r.qty),
          note: r.note ? r.note : null,
        }));

        const { error: errItems } = await supabase
          .from("checklist_items")
          .insert(payloadItems);

        if (errItems) {
          const info = logSupabaseError(errItems);
          alert("Errore insert righe: " + (info || errItems.message || ""));
          return;
        }
      }

      if (draftLicenze.length > 0) {
        const payloadLicenze = draftLicenze.map((l) => ({
          checklist_id: checklistId,
          tipo: l.tipo,
          scadenza: l.scadenza,
          stato: "attiva",
          note: l.note ? l.note : null,
        }));
        const { error: licErr } = await supabase.from("licenses").insert(payloadLicenze);
        if (licErr) {
          alert("Errore inserimento licenze: " + licErr.message);
          return;
        }
      }

      const serialPayload = [
        ...serialiControllo.map((s) => ({
          checklist_id: checklistId,
          tipo: "CONTROLLO",
          device_code: s.device_code,
          device_descrizione: s.device_descrizione,
          seriale: normalizeSerial(s.seriale),
          note: s.note ? s.note.trim() : null,
        })),
        ...serialiModuli.map((s) => ({
          checklist_id: checklistId,
          tipo: "MODULO_LED",
          device_code: s.device_code,
          device_descrizione: s.device_descrizione,
          seriale: normalizeSerial(s.seriale),
          note: s.note ? s.note.trim() : null,
        })),
      ];
      if (serialPayload.length > 0) {
        const { error: serialErr } = await supabase.from("asset_serials").insert(serialPayload);
        if (serialErr) {
          const code = (serialErr as any)?.code;
          const msg =
            code === "23505"
              ? "Seriale CONTROLLO già associato ad un altro impianto/progetto."
              : serialErr.message;
          alert("Errore inserimento seriali: " + msg);
          return;
        }
      }

      const { data: taskRows, error: taskRowsErr } = await supabase
        .from("checklist_tasks")
        .select("id, titolo, stato")
        .eq("checklist_id", checklistId)
        .eq("stato", "DA_FARE");

      if (taskRowsErr) {
        console.error("Errore caricamento task per notifiche", taskRowsErr);
      } else if (taskRows && taskRows.length > 0) {
        const jobPayload = taskRows.map((t: any) => ({
          checklist_id: checklistId,
          task_id: t.id,
          stato: "PENDING",
        }));
        const { error: jobErr } = await supabase.from("notification_jobs").insert(jobPayload);
        if (jobErr) {
          console.error("Errore inserimento notification_jobs", jobErr);
        }

        const { data: ops } = await supabase
          .from("operatori")
          .select("id, nome, email, ruolo, attivo, cliente")
          .eq("cliente", cliente.trim())
          .in("ruolo", ["TECNICO", "MAGAZZINO"])
          .eq("attivo", true);

        const recipients = (ops || []).filter(
          (o: any) => o?.email && String(o.email).includes("@")
        );

        if (recipients.length > 0) {
          const subject = `[Art Tech] Attività operative da completare – ${nomeChecklist.trim()}`;
          const link = `/checklists/${checklistId}`;
          const list = taskRows.map((t: any) => `- ${t.titolo}`).join("\n");
          const text = [
            `Cliente: ${cliente.trim()}`,
            `Progetto: ${nomeChecklist.trim()}`,
            "Attività DA_FARE:",
            list,
            `Link: ${link}`,
          ].join("\n");
          const html = `
            <div>
              <h2>Attività operative da completare</h2>
              <ul>
                <li><strong>Cliente:</strong> ${cliente.trim()}</li>
                <li><strong>Progetto:</strong> ${nomeChecklist.trim()}</li>
              </ul>
              <p><strong>Attività DA_FARE:</strong></p>
              <ul>
                ${taskRows.map((t: any) => `<li>${t.titolo}</li>`).join("")}
              </ul>
              <p><a href="${link}">Apri checklist</a></p>
            </div>
          `;
          for (const op of recipients) {
            try {
              await sendAlert({
                canale: "auto_task",
                subject,
                text,
                html,
                to_email: op.email,
                to_nome: op.nome ?? null,
                to_operatore_id: op.id,
                checklist_id: checklistId,
                trigger: "AUTO",
                send_email: true,
              });
            } catch (err) {
              console.error("Errore invio alert automatico", err);
            }
          }
        }
      }

      router.push(`/checklists/${checklistId}`);
    } catch (err: any) {
      const info = logSupabaseError(err);
      alert("Errore: " + (info || err?.message || String(err)));
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>NUOVA CHECK LIST</div>
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

      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 14,
          border: "1px solid #eee",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <label>
            Cliente*<br />
            <ClientiCombobox
              value={cliente}
              onValueChange={(val) => {
                setCliente(val);
                setClienteId(null);
              }}
              selectedId={clienteId}
              onSelectId={(id) => {
                setClienteId(id);
              }}
              placeholder="Cerca cliente..."
            />
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
              Seleziona dall'elenco per collegare l'anagrafica (consigliato). Puoi anche
              scrivere testo libero.
            </div>
            <button
              type="button"
              onClick={() => setClienteModalOpen(true)}
              style={{
                marginTop: 8,
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
            >
              + Nuovo cliente
            </button>
          </label>

          <label>
            RIF. Check List*<br />
            <input
              value={nomeChecklist}
              onChange={(e) => setNomeChecklist(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Proforma<br />
            <input
              value={proforma}
              onChange={(e) => setProforma(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Magazzino importazione<br />
            <input
              value={magazzinoImportazione}
              onChange={(e) => setMagazzinoImportazione(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <div
            style={{
              gridColumn: "1 / -1",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 6,
            }}
          >
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Seriali elettroniche di controllo
              </div>
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
                  <option value="">Device/Modello (opzionale)</option>
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
                    if (e.key === "Enter") addSerial("CONTROLLO");
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
                  onClick={() => addSerial("CONTROLLO")}
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
                      key={s.seriale}
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
                        onClick={() => removeSerial("CONTROLLO", s.seriale)}
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
                    </span>
                  ))
                )}
              </div>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Seriali moduli LED</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  value={serialModuleInput}
                  onChange={(e) => setSerialModuleInput(e.target.value)}
                  placeholder="Aggiungi seriale MODULO_LED"
                  style={{ width: "100%", padding: 8 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addSerial("MODULO_LED");
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
                  onClick={() => addSerial("MODULO_LED")}
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
                      key={s.seriale}
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
                        onClick={() => removeSerial("MODULO_LED", s.seriale)}
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
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <label>
            Descrizione impianto (TEC)<br />
            <select
              value={impiantoCodice}
              onChange={(e) => {
                const code = e.target.value;
                const selected = impiantoOptions.find((i) => (i.codice ?? "") === code);
                setImpiantoCodice(code);
                setImpiantoDescrizione(selected?.descrizione ?? "");
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
          </label>

          <label>
            Dimensioni<br />
            <input
              value={dimensioni}
              onChange={(e) => setDimensioni(e.target.value)}
              placeholder="Es. 4x2 o 4,5 x 2,2"
              style={{ width: "100%", padding: 10 }}
            />
          </label>
          <label>
            Quantita impianti<br />
            <input
              type="number"
              min={1}
              step={1}
              value={impiantoQuantita}
              onChange={(e) => {
                const next = Number(e.target.value);
                setImpiantoQuantita(Number.isFinite(next) && next > 0 ? Math.floor(next) : 1);
              }}
              style={{ width: "100%", padding: 10 }}
            />
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              marginTop: 26,
            }}
          >
            <input
              type="checkbox"
              checked={numeroFacce === 2}
              onChange={(e) => setNumeroFacce(e.target.checked ? 2 : 1)}
            />
            Bifacciale ({numeroFacce} facce)
          </label>

          <label>
            Passo<br />
            <input
              value={passo}
              onChange={(e) => setPasso(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label>
            m² calcolati<br />
            <input
              value={m2Calcolati != null ? m2Calcolati.toFixed(2) : ""}
              readOnly
              style={{ width: "100%", padding: 10, background: "#f7f7f7" }}
            />
          </label>

          <label>
            Tipo impianto<br />
            <select
              value={tipoImpianto}
              onChange={(e) => setTipoImpianto(e.target.value as any)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="">—</option>
              <option value="INDOOR">INDOOR</option>
              <option value="OUTDOOR">OUTDOOR</option>
              <option value="SEMIOUTDOOR">SEMIOUTDOOR</option>
              <option value="DA DEFINIRE">DA DEFINIRE</option>
            </select>
          </label>
          <label>
            Indirizzo impianto<br />
            <input
              value={impiantoIndirizzo}
              onChange={(e) => setImpiantoIndirizzo(e.target.value)}
              placeholder="Es. Via Roma 10, Milano"
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Data installazione prevista<br />
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Data tassativa<br />
            <input
              type="date"
              value={dataTassativa}
              onChange={(e) => setDataTassativa(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Data installazione reale<br />
            <input
              type="date"
              value={dataInstallazioneReale}
              onChange={(e) => setDataInstallazioneReale(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Stato progetto<br />
            <select
              value={statoProgetto}
              onChange={(e) => setStatoProgetto(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="IN_CORSO">IN_CORSO</option>
              <option value="CONSEGNATO">CONSEGNATO</option>
              <option value="CHIUSO">CHIUSO</option>
              <option value="SOSPESO">SOSPESO</option>
            </select>
          </label>

          <label>
            Piano SAAS<br />
            <select
              value={saasPiano}
              onChange={(e) => setSaasPiano(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="">—</option>
              {SAAS_PIANI.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Servizio SAAS aggiuntivo<br />
            <select
              value={saasTipo}
              onChange={(e) => setSaasTipo(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="">— nessuno —</option>
              {SAAS_SERVIZI_AGGIUNTIVI.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            SAAS scadenza<br />
            <input
              type="date"
              value={saasScadenza}
              onChange={(e) => setSaasScadenza(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
            <div style={{ marginTop: 6 }}>{renderBadge(getExpiryStatus(saasScadenza))}</div>
          </label>

          <label>
            SAAS note<br />
            <input
              value={saasNote}
              onChange={(e) => setSaasNote(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Noleggio / Vendita / Service<br />
            <select
              value={noleggioVendita}
              onChange={(e) => setNoleggioVendita(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="">—</option>
              <option value="NOLEGGIO">NOLEGGIO</option>
              <option value="VENDITA">VENDITA</option>
              <option value="SERVICE">SERVICE</option>
              <option value="ALTRO">ALTRO</option>
            </select>
          </label>

          <label>
            Tipo struttura<br />
            <select
              value={tipoStruttura}
              onChange={(e) => setTipoStruttura(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="">—</option>
              {strutturaOptions.map((item) => (
                <option key={item.id} value={item.codice ?? ""}>
                  {item.codice} — {item.descrizione}
                </option>
              ))}
            </select>
          </label>

          {isUltraOrPremium && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 12,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  ULTRA scope<br />
                  <select
                    value={ultraScope}
                    onChange={(e) => setUltraScope(e.target.value as any)}
                    style={{ width: "100%", padding: 10 }}
                  >
                    <option value="CLIENTE">CLIENTE</option>
                    <option value="CHECKLIST">CHECKLIST</option>
                  </select>
                </label>

                <label>
                  Interventi inclusi<br />
                  <input
                    value={ultraInclusi}
                    onChange={(e) => setUltraInclusi(e.target.value)}
                    style={{ width: "100%", padding: 10 }}
                    placeholder="es. 12"
                  />
                </label>
              </div>
            </div>
          )}

          <label>
            Garanzia scadenza<br />
            <input
              type="date"
              value={garanziaScadenza}
              onChange={(e) => setGaranziaScadenza(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>
        </div>

        <div style={{ marginTop: 22 }}>
          <h2 style={{ marginTop: 0 }}>Licenze</h2>
          <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.7 }}>
            (Opzionale) – puoi aggiungerle anche dopo
          </div>

          {licenzeError && (
            <div style={{ color: "crimson", marginBottom: 10 }}>{licenzeError}</div>
          )}

          {draftLicenze.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nessuna licenza in bozza</div>
          ) : (
            <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 2fr 120px",
                  gap: 0,
                  padding: "10px 12px",
                  fontWeight: 700,
                  borderBottom: "1px solid #eee",
                  background: "#fafafa",
                }}
              >
                <div>Tipo / Piano</div>
                <div>Scadenza</div>
                <div>Note</div>
                <div>Azioni</div>
              </div>

              {draftLicenze.map((l, idx) => (
                <div
                  key={`${l.tipo}-${l.scadenza}-${idx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 2fr 120px",
                    gap: 0,
                    padding: "10px 12px",
                    borderBottom: "1px solid #f5f5f5",
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <div>{l.tipo || "—"}</div>
                  <div>{l.scadenza ? new Date(l.scadenza).toLocaleDateString() : "—"}</div>
                  <div>{l.note || "—"}</div>
                  <div>
                    <button
                      type="button"
                      onClick={() => removeDraftLicenza(idx)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      Rimuovi
                    </button>
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
                gridTemplateColumns: "2fr 1fr 2fr 120px",
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
              <button
                type="button"
                onClick={addDraftLicenza}
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
          </div>
        </div>

        <h2 style={{ marginTop: 22 }}>Voci / Prodotti</h2>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
          Accessori/Extra (no TEC, no SAAS)
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 1fr 120px 1fr",
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
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Cerca per codice o descrizione (extra/accessori)"
                      value={r.search ?? ""}
                      onChange={(e) => updateRowFields(idx, { search: e.target.value })}
                      style={{ flex: 1, padding: 10 }}
                    />
                    <select
                      value={r.categoria_filter ?? ""}
                      onChange={(e) => updateRowFields(idx, { categoria_filter: e.target.value })}
                      style={{ padding: 10, minWidth: 160 }}
                    >
                      <option value="">Tutte le categorie</option>
                      {CATEGORIE_VOCI.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__EMPTY__">(vuoto)</option>
                    </select>
                  </div>
                  <select
                    value={r.descrizione ?? ""}
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
                      const selected = vociProdottiOptions.find((c) => c.descrizione === value);
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
                      .filter((item) => {
                        const cat = (r.categoria_filter ?? "").trim();
                        if (!cat) return true;
                        if (cat === "__EMPTY__") {
                          return !item.categoria || item.categoria.trim() === "";
                        }
                        return String(item.categoria || "") === cat;
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
                      <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
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
                  Qty<br />
                  <input
                    value={r.qty}
                    onChange={(e) => updateRow(idx, "qty", e.target.value)}
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>

                <label>
                  Note<br />
                  <input
                    value={r.note}
                    onChange={(e) => updateRow(idx, "note", e.target.value)}
                    style={{ width: "100%", padding: 10 }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button
                  onClick={() => removeRow(idx)}
                  disabled={rows.length === 1}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    cursor: rows.length === 1 ? "not-allowed" : "pointer",
                    background: "white",
                  }}
                >
                  Rimuovi riga
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button
            onClick={addRow}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: "pointer",
              background: "white",
            }}
          >
            + Aggiungi riga
          </button>

          <button
            onClick={onCreate}
            disabled={!canCreate}
            style={{
              marginLeft: "auto",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              cursor: canCreate ? "pointer" : "not-allowed",
              background: "#111",
              color: "white",
              opacity: canCreate ? 1 : 0.5,
            }}
          >
            Crea
          </button>
        </div>
      </div>

      <ClienteModal
        open={clienteModalOpen}
        onClose={() => setClienteModalOpen(false)}
        onSaved={(clienteRecord: ClienteRecord) => {
          if (clienteRecord?.id) {
            setClienteId(clienteRecord.id);
          }
          setCliente(clienteRecord.denominazione || "");
        }}
      />
    </div>
  );
}
