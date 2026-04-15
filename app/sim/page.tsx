"use client";

import { useEffect, useMemo, useState } from "react";
import ConfigMancante from "@/components/ConfigMancante";
import { dbFrom } from "@/lib/clientDbBroker";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type SimCardRow = {
  id?: string;
  checklist_id: string;
  numero_telefono: string;
  intestatario: string;
  piano_attivo: string;
  operatore: string;
  tariffa: number | null;
  data_attivazione: string;
  data_scadenza: string;
  giorni_preavviso: number | null;
  alert_frequenza: string;
  stato_alert: string;
  billing_status: string;
  attiva: boolean;
  in_abbonamento: boolean;
  device_installato: string;
  note: string;
  isNew?: boolean;
};

type SimRechargeRow = {
  id?: string;
  sim_id: string;
  data_ricarica: string;
  importo: number | null;
  billing_status: string;
  note: string;
};

type ChecklistProjectRow = {
  id: string;
  nome_checklist: string;
  cliente: string;
};

type RechargeModalState = {
  simId: string;
  numeroTelefono: string;
  cliente: string;
  progetto: string;
  inAbbonamento: boolean;
};

function normalizeText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return raw;
  return date.toLocaleDateString("it-IT");
}

function formatCurrency(value: number | null) {
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

function parseLocalDay(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    date.setHours(0, 0, 0, 0);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
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

function getLatestRechargeRow(rows: SimRechargeRow[]) {
  if (!rows.length) return null;
  return [...rows]
    .sort((a, b) => {
      const aTime = parseLocalDay(a.data_ricarica)?.getTime() || 0;
      const bTime = parseLocalDay(b.data_ricarica)?.getTime() || 0;
      return bTime - aTime;
    })[0] || null;
}

function getEffectiveSimScadenza(
  row: Pick<SimCardRow, "data_attivazione" | "data_scadenza">,
  latestRecharge?: Pick<SimRechargeRow, "data_ricarica"> | null
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

function getSimOperationalState(
  row: Pick<SimCardRow, "attiva" | "giorni_preavviso" | "data_attivazione" | "data_scadenza">,
  latestRecharge?: Pick<SimRechargeRow, "data_ricarica"> | null
) {
  if (!row.attiva) return { stato: "OFF" as const, giorniDelta: null as number | null };

  const effectiveScadenza = getEffectiveSimScadenza(row, latestRecharge);
  const scadenza = parseLocalDay(effectiveScadenza);
  if (!scadenza) return { stato: "ATTIVA" as const, giorniDelta: null as number | null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const giorniDelta = Math.round((scadenza.getTime() - today.getTime()) / msPerDay);

  if (giorniDelta < 0) return { stato: "SCADUTO" as const, giorniDelta };

  const giorniPreavvisoEffettivi =
    typeof row.giorni_preavviso === "number" && Number.isFinite(row.giorni_preavviso)
      ? row.giorni_preavviso
      : 30;
  if (giorniDelta <= giorniPreavvisoEffettivi) {
    return { stato: "IN_SCADENZA" as const, giorniDelta };
  }
  return { stato: "ATTIVA" as const, giorniDelta };
}

function renderScadenzaBadge(state: ReturnType<typeof getSimOperationalState> | null) {
  if (!state || state.stato === "ATTIVA" || state.stato === "OFF") return null;
  const isScaduto = state.stato === "SCADUTO";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: isScaduto ? "#fee2e2" : "#ffedd5",
        color: isScaduto ? "#b91c1c" : "#ea580c",
        whiteSpace: "nowrap",
      }}
    >
      {isScaduto ? "SCADUTO" : "IN SCADENZA"}
    </span>
  );
}

function renderMainSimStatusBadge(state: ReturnType<typeof getSimOperationalState>) {
  const label =
    state.stato === "SCADUTO"
      ? "SCADUTA"
      : state.stato === "IN_SCADENZA"
        ? "IN_SCADENZA"
        : state.stato === "OFF"
          ? "OFF"
          : "OK";
  const background =
    state.stato === "SCADUTO"
      ? "#fee2e2"
      : state.stato === "IN_SCADENZA"
        ? "#ffedd5"
        : state.stato === "OFF"
          ? "#e5e7eb"
          : "#dcfce7";
  const color =
    state.stato === "SCADUTO"
      ? "#991b1b"
      : state.stato === "IN_SCADENZA"
        ? "#c2410c"
        : state.stato === "OFF"
          ? "#4b5563"
          : "#166534";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function renderSimKindBadge(inAbbonamento: boolean) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: inAbbonamento ? "#dbeafe" : "#f3f4f6",
        color: inAbbonamento ? "#1d4ed8" : "#374151",
        whiteSpace: "nowrap",
      }}
    >
      {inAbbonamento ? "ABBONAMENTO" : "RICARICABILE"}
    </span>
  );
}

function renderBillingBadge(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  let background = "#f3f4f6";
  let color = "#374151";

  if (raw === "DA_FATTURARE") {
    background = "#fef3c7";
    color = "#92400e";
  } else if (raw === "FATTURATO") {
    background = "#dcfce7";
    color = "#166534";
  } else if (raw === "INCLUSO") {
    background = "#dbeafe";
    color = "#1d4ed8";
  } else if (raw === "NON_APPLICABILE") {
    background = "#e5e7eb";
    color = "#4b5563";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {raw || "—"}
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
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {raw || "—"}
    </span>
  );
}

export default function SimPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [rows, setRows] = useState<SimCardRow[]>([]);
  const [projectByChecklistId, setProjectByChecklistId] = useState<Record<string, ChecklistProjectRow>>({});
  const [search, setSearch] = useState("");
  const [simStatusFilter, setSimStatusFilter] = useState<"ATTIVE" | "SCADUTE" | "IN_SCADENZA" | "OFF" | "TUTTE">("ATTIVE");
  const [projectFilter, setProjectFilter] = useState("TUTTI");
  const [operatoreFilter, setOperatoreFilter] = useState("TUTTI");
  const [latestRechargeBillingFilter, setLatestRechargeBillingFilter] = useState("TUTTI");
  const [editingSimId, setEditingSimId] = useState<string | null>(null);
  const [expandedSimId, setExpandedSimId] = useState<string | null>(null);
  const [rechargesBySimId, setRechargesBySimId] = useState<Record<string, SimRechargeRow[]>>({});
  const [newRechargeBySimId, setNewRechargeBySimId] = useState<
    Record<string, { data_ricarica: string; importo: string; billing_status: string; note: string }>
  >({});
  const [savingRechargeKey, setSavingRechargeKey] = useState<string | null>(null);
  const [rechargeModal, setRechargeModal] = useState<RechargeModalState | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: loadError } = await dbFrom("sim_cards")
        .select(
          "id, checklist_id, numero_telefono, intestatario, piano_attivo, operatore, tariffa, data_attivazione, data_scadenza, giorni_preavviso, alert_frequenza, stato_alert, billing_status, attiva, in_abbonamento, device_installato, note"
        )
        .order("numero_telefono", { ascending: true });

      if (!active) return;

      if (loadError) {
        setError(`Errore caricamento SIM: ${loadError.message}`);
        setRows([]);
        setLoading(false);
        return;
      }

      const nextRows = (((data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
          id: String(row.id || ""),
          checklist_id: String(row.checklist_id || ""),
          numero_telefono: String(row.numero_telefono || ""),
          intestatario: String(row.intestatario || ""),
          piano_attivo: String(row.piano_attivo || ""),
          operatore: String(row.operatore || ""),
          tariffa:
            typeof row.tariffa === "number"
              ? row.tariffa
              : row.tariffa == null || row.tariffa === ""
                ? null
                : Number(row.tariffa),
          data_attivazione: String(row.data_attivazione || ""),
          data_scadenza: String(row.data_scadenza || ""),
          giorni_preavviso:
            typeof row.giorni_preavviso === "number"
              ? row.giorni_preavviso
              : row.giorni_preavviso == null || row.giorni_preavviso === ""
                ? null
                : Number(row.giorni_preavviso),
          alert_frequenza: String(row.alert_frequenza || ""),
          stato_alert: String(row.stato_alert || ""),
          billing_status: String(row.billing_status || ""),
          attiva: row.attiva !== false,
          in_abbonamento: row.in_abbonamento === true,
          device_installato: String(row.device_installato || ""),
          note: String(row.note || ""),
          isNew: false,
        }));
      setRows(nextRows);

      const checklistIds = Array.from(
        new Set(nextRows.map((row) => String(row.checklist_id || "").trim()).filter(Boolean))
      );
      if (checklistIds.length > 0) {
        const { data: checklistData } = await dbFrom("checklists")
          .select("id, nome_checklist, cliente")
          .in("id", checklistIds);
        if (!active) return;
        const nextProjectMap: Record<string, ChecklistProjectRow> = {};
        for (const row of (((checklistData as any[]) || []) as Array<Record<string, any>>)) {
          const id = String(row.id || "").trim();
          if (!id) continue;
          nextProjectMap[id] = {
            id,
            nome_checklist: String(row.nome_checklist || ""),
            cliente: String(row.cliente || ""),
          };
        }
        setProjectByChecklistId(nextProjectMap);
      } else {
        setProjectByChecklistId({});
      }

      const persistedSimIds = nextRows
        .map((row) => String(row.id || ""))
        .filter(Boolean);
      const rechargeEntries = await Promise.all(
        persistedSimIds.map(async (simId) => {
          const { data: rechargeData, error: rechargeError } = await dbFrom("sim_recharges")
            .select("id, sim_id, data_ricarica, importo, billing_status, note")
            .eq("sim_id", simId)
            .order("data_ricarica", { ascending: false });

          if (rechargeError) {
            return {
              simId,
              error: rechargeError.message,
              rows: [] as SimRechargeRow[],
            };
          }

          return {
            simId,
            error: null,
            rows: (((rechargeData as any[]) || []) as Array<Record<string, any>>).map((recharge) => ({
              id: String(recharge.id || ""),
              sim_id: String(recharge.sim_id || simId),
              data_ricarica: String(recharge.data_ricarica || ""),
              importo:
                typeof recharge.importo === "number"
                  ? recharge.importo
                  : recharge.importo == null || recharge.importo === ""
                    ? null
                    : Number(recharge.importo),
              billing_status: String(recharge.billing_status || ""),
              note: String(recharge.note || ""),
            })),
          };
        })
      );

      if (!active) return;

      const rechargeMap: Record<string, SimRechargeRow[]> = {};
      let rechargeLoadError: string | null = null;
      for (const entry of rechargeEntries) {
        rechargeMap[entry.simId] = entry.rows;
        if (!rechargeLoadError && entry.error) rechargeLoadError = entry.error;
      }
      setRechargesBySimId(rechargeMap);
      if (rechargeLoadError) {
        setError(`Errore caricamento ricariche SIM: ${rechargeLoadError}`);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const operatoreOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => String(row.operatore || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "it"));
  }, [rows]);

  const projectFilterOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => {
            const checklistId = String(row.checklist_id || "").trim();
            if (!checklistId) return "SIM_LIBERA";
            const project = projectByChecklistId[checklistId];
            return project ? `${project.nome_checklist}${project.cliente ? ` · ${project.cliente}` : ""}` : checklistId;
          })
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "it"));
  }, [rows, projectByChecklistId]);

  const latestRechargeBySimId = useMemo(() => {
    const map: Record<string, SimRechargeRow | null> = {};
    for (const row of rows) {
      const rowId = String(row.id || "");
      if (!rowId) continue;
      map[rowId] = getLatestRechargeRow(rechargesBySimId[rowId] || []);
    }
    return map;
  }, [rows, rechargesBySimId]);

  const latestRechargeBillingOptions = useMemo(() => {
    return Array.from(
      new Set(
        Object.values(latestRechargeBySimId)
          .map((row) => String(row?.billing_status || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "it"));
  }, [latestRechargeBySimId]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);
    return rows.filter((row) => {
      const rowId = String(row.id || "");
      const latestRecharge = latestRechargeBySimId[rowId] || null;
      const simState = getSimOperationalState(row, latestRecharge);
      const checklistId = String(row.checklist_id || "").trim();
      const projectLabel =
        !checklistId
          ? "SIM_LIBERA"
          : projectByChecklistId[checklistId]
            ? `${projectByChecklistId[checklistId].nome_checklist}${projectByChecklistId[checklistId].cliente ? ` · ${projectByChecklistId[checklistId].cliente}` : ""}`
            : checklistId;

      if (simStatusFilter === "ATTIVE" && !["ATTIVA", "IN_SCADENZA"].includes(simState.stato)) return false;
      if (simStatusFilter === "SCADUTE" && simState.stato !== "SCADUTO") return false;
      if (simStatusFilter === "IN_SCADENZA" && simState.stato !== "IN_SCADENZA") return false;
      if (simStatusFilter === "OFF" && simState.stato !== "OFF") return false;
      if (projectFilter !== "TUTTI" && projectLabel !== projectFilter) return false;
      if (operatoreFilter !== "TUTTI" && row.operatore !== operatoreFilter) return false;
      if (
        latestRechargeBillingFilter !== "TUTTI" &&
        String(latestRecharge?.billing_status || "").trim() !== latestRechargeBillingFilter
      ) return false;

      if (!query) return true;
      const haystack = normalizeText(
        [
          row.numero_telefono,
          row.intestatario,
          row.operatore,
          row.piano_attivo,
          row.device_installato,
          projectLabel === "SIM_LIBERA" ? "SIM libera" : projectLabel,
        ].join(" ")
      );
      return haystack.includes(query);
    });
  }, [rows, search, simStatusFilter, projectFilter, operatoreFilter, latestRechargeBillingFilter, latestRechargeBySimId, projectByChecklistId]);

  function createTempId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function updateRow(rowId: string, patch: Partial<SimCardRow>) {
    setRows((prev) =>
      prev.map((row) => (String(row.id || "") === rowId ? { ...row, ...patch } : row))
    );
  }

  function updateRechargeDraft(
    simId: string,
    patch: Partial<{ data_ricarica: string; importo: string; billing_status: string; note: string }>
  ) {
    setNewRechargeBySimId((prev) => ({
      ...prev,
      [simId]: {
        data_ricarica: prev[simId]?.data_ricarica || "",
        importo: prev[simId]?.importo || "",
        billing_status: prev[simId]?.billing_status || "",
        note: prev[simId]?.note || "",
        ...patch,
      },
    }));
  }

  function openRechargeModal(row: SimCardRow, project: ChecklistProjectRow | null) {
    const simId = String(row.id || "");
    if (!simId || row.isNew) return;
    setNewRechargeBySimId((prev) => ({
      ...prev,
      [simId]: {
        data_ricarica: prev[simId]?.data_ricarica || formatDateOnlyValue(new Date()),
        importo: prev[simId]?.importo || "",
        billing_status: prev[simId]?.billing_status || "NON_FATTURARE",
        note: prev[simId]?.note || "",
      },
    }));
    setRechargeModal({
      simId,
      numeroTelefono: row.numero_telefono || "—",
      cliente: project?.cliente || "—",
      progetto: project?.nome_checklist || "SIM libera",
      inAbbonamento: row.in_abbonamento === true,
    });
    setError(null);
    setNotice(null);
  }

  function closeRechargeModal() {
    if (savingRechargeKey) return;
    setRechargeModal(null);
  }

  function addNewSim() {
    const tempId = createTempId("sim");
    setRows((prev) => [
      {
        id: tempId,
        checklist_id: "",
        numero_telefono: "",
        intestatario: "",
        piano_attivo: "",
        operatore: "",
        tariffa: null,
        data_attivazione: "",
        data_scadenza: "",
        giorni_preavviso: null,
        alert_frequenza: "",
        stato_alert: "",
        billing_status: "",
        attiva: true,
        in_abbonamento: false,
        device_installato: "",
        note: "",
        isNew: true,
      },
      ...prev,
    ]);
    setEditingSimId(tempId);
    setExpandedSimId(tempId);
    setNotice(null);
    setError(null);
  }

  function cancelEdit(row: SimCardRow) {
    if (row.isNew) {
      setRows((prev) => prev.filter((item) => String(item.id || "") !== String(row.id || "")));
    }
    setEditingSimId(null);
    if (row.isNew) setExpandedSimId(null);
  }

  async function saveSim(row: SimCardRow) {
    const rowId = String(row.id || "");
    const numeroTelefono = row.numero_telefono.trim();
    if (!numeroTelefono) {
      setError("Numero telefono obbligatorio.");
      return;
    }

    setSavingKey(rowId);
    setError(null);
    setNotice(null);

    const payload = {
      checklist_id: row.checklist_id.trim() || null,
      numero_telefono: numeroTelefono,
      intestatario: row.intestatario.trim() || null,
      piano_attivo: row.piano_attivo.trim() || null,
      operatore: row.operatore.trim() || null,
      tariffa: row.tariffa == null || !Number.isFinite(row.tariffa) ? null : row.tariffa,
      data_attivazione: row.data_attivazione.trim() || null,
      data_scadenza: row.data_scadenza.trim() || null,
      giorni_preavviso:
        row.giorni_preavviso == null || !Number.isFinite(row.giorni_preavviso)
          ? null
          : row.giorni_preavviso,
      alert_frequenza: row.alert_frequenza.trim() || null,
      stato_alert: row.stato_alert.trim() || null,
      billing_status: row.billing_status.trim() || null,
      attiva: row.attiva !== false,
      in_abbonamento: row.in_abbonamento === true,
      device_installato: row.device_installato.trim() || null,
      note: row.note.trim() || null,
    };

    const result = row.isNew
      ? await dbFrom("sim_cards").insert(payload).select("*").single()
      : await dbFrom("sim_cards").update(payload).eq("id", rowId).select("*").single();

    setSavingKey(null);

    if (result.error) {
      setError(`Errore salvataggio SIM: ${result.error.message}`);
      return;
    }

    const saved = result.data as Record<string, any> | null;
    const nextRow: SimCardRow = {
      id: String(saved?.id || row.id || ""),
      checklist_id: String(saved?.checklist_id || row.checklist_id || ""),
      numero_telefono: String(saved?.numero_telefono || payload.numero_telefono),
      intestatario: String(saved?.intestatario || ""),
      piano_attivo: String(saved?.piano_attivo || ""),
      operatore: String(saved?.operatore || ""),
      tariffa:
        typeof saved?.tariffa === "number"
          ? saved.tariffa
          : saved?.tariffa == null || saved?.tariffa === ""
            ? payload.tariffa
            : Number(saved.tariffa),
      data_attivazione: String(saved?.data_attivazione || payload.data_attivazione || ""),
      data_scadenza: String(saved?.data_scadenza || ""),
      giorni_preavviso:
        typeof saved?.giorni_preavviso === "number"
          ? saved.giorni_preavviso
          : saved?.giorni_preavviso == null || saved?.giorni_preavviso === ""
            ? payload.giorni_preavviso
            : Number(saved.giorni_preavviso),
      alert_frequenza: String(saved?.alert_frequenza || payload.alert_frequenza || ""),
      stato_alert: String(saved?.stato_alert || payload.stato_alert || ""),
      billing_status: String(saved?.billing_status || ""),
      attiva: saved?.attiva !== false,
      in_abbonamento: saved?.in_abbonamento === true,
      device_installato: String(saved?.device_installato || ""),
      note: String(saved?.note || ""),
      isNew: false,
    };

    setRows((prev) =>
      prev.map((item) => (String(item.id || "") === rowId ? nextRow : item))
    );
    setEditingSimId(null);
    setExpandedSimId(String(nextRow.id || rowId));
    setNotice("SIM salvata.");
    setRechargesBySimId((prev) => ({
      ...prev,
      [String(nextRow.id || "")]: prev[String(nextRow.id || "")] || [],
    }));
  }

  async function deleteSim(row: SimCardRow) {
    const rowId = String(row.id || "");
    if (!rowId || row.isNew) return;

    const confirmed = window.confirm("Eliminare questa SIM?");
    if (!confirmed) return;

    setSavingKey(rowId);
    setError(null);
    setNotice(null);

    const { error: deleteError } = await dbFrom("sim_cards").delete().eq("id", rowId);
    setSavingKey(null);

    if (deleteError) {
      setError(`Errore eliminazione SIM: ${deleteError.message}`);
      return;
    }

    setRows((prev) => prev.filter((item) => String(item.id || "") !== rowId));
    setRechargesBySimId((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    setNewRechargeBySimId((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
    if (editingSimId === rowId) setEditingSimId(null);
    if (expandedSimId === rowId) setExpandedSimId(null);
    setNotice("SIM eliminata.");
  }

  async function addRecharge(simId: string) {
    const row = rows.find((item) => String(item.id || "") === simId);
    if (!row || row.isNew || row.in_abbonamento) return;

    const draft = newRechargeBySimId[simId] || { data_ricarica: "", importo: "", billing_status: "", note: "" };
    const dataRicarica = draft.data_ricarica.trim();
    if (!dataRicarica) {
      setError("Data ricarica obbligatoria.");
      return;
    }
    const importoValue = draft.importo.trim();
    if (!importoValue) {
      setError("Importo ricarica obbligatorio.");
      return;
    }

    setSavingRechargeKey(simId);
    setError(null);
    setNotice(null);

    const payload = {
      sim_id: simId,
      data_ricarica: dataRicarica,
      importo: Number(importoValue),
      billing_status: draft.billing_status.trim() === "DA_FATTURARE" ? "DA_FATTURARE" : "NON_FATTURARE",
      note: draft.note.trim() || null,
    };

    const { data, error: insertError } = await dbFrom("sim_recharges")
      .insert(payload)
      .select("id, sim_id, data_ricarica, importo, billing_status, note")
      .single();

    setSavingRechargeKey(null);

    if (insertError) {
      setError(`Errore salvataggio ricarica: ${insertError.message}`);
      return;
    }

    const saved = data as Record<string, any> | null;
    const nextRecharge: SimRechargeRow = {
      id: String(saved?.id || ""),
      sim_id: String(saved?.sim_id || simId),
      data_ricarica: String(saved?.data_ricarica || payload.data_ricarica),
      importo:
        typeof saved?.importo === "number"
          ? saved.importo
          : saved?.importo == null || saved?.importo === ""
            ? payload.importo
            : Number(saved.importo),
      billing_status: String(saved?.billing_status || payload.billing_status || ""),
      note: String(saved?.note || payload.note || ""),
    };

    setRechargesBySimId((prev) => ({
      ...prev,
      [simId]: [nextRecharge, ...(prev[simId] || [])],
    }));
    setNewRechargeBySimId((prev) => ({
      ...prev,
      [simId]: {
        data_ricarica: formatDateOnlyValue(new Date()),
        importo: "",
        billing_status: "NON_FATTURARE",
        note: "",
      },
    }));
    setRechargeModal(null);
    setNotice("Ricarica salvata.");
  }

  async function syncSimCards() {
    setSyncing(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/sim/sync-from-licenses", {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({} as any));

      if (!res.ok || json?.ok !== true) {
        throw new Error(String(json?.error || "Errore sincronizzazione SIM"));
      }

      setNotice(
        `Sync completata: processed ${Number(json?.processed || 0)}, inserted ${Number(
          json?.inserted || 0
        )}, updated ${Number(json?.updated || 0)}, skipped ${Number(json?.skipped || 0)}`
      );
      setReloadKey((prev) => prev + 1);
    } catch (err: any) {
      setError(String(err?.message || "Errore sincronizzazione SIM"));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{ maxWidth: 1280, margin: "24px auto", padding: "0 16px 48px" }}>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Censimento SIM</h1>
          <div style={{ marginTop: 6, fontSize: 14, color: "#6b7280" }}>
            Inventario SIM centralizzato con ricerca e filtri minimi.
          </div>
        </div>
        <button
          type="button"
          onClick={syncSimCards}
          disabled={syncing}
          style={{
            height: 42,
            padding: "0 16px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#111827",
            fontWeight: 800,
            cursor: syncing ? "wait" : "pointer",
            opacity: syncing ? 0.8 : 1,
          }}
        >
          {syncing ? "Sincronizzazione..." : "Sincronizza SIM"}
        </button>
        <button
          type="button"
          onClick={addNewSim}
          style={{
            height: 42,
            padding: "0 16px",
            borderRadius: 10,
            border: "1px solid #0f172a",
            background: "#0f172a",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          + Nuova SIM
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Cerca
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Numero, intestatario, operatore, piano"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Stato SIM
          <select
            value={simStatusFilter}
            onChange={(e) =>
              setSimStatusFilter(
                e.target.value as "ATTIVE" | "SCADUTE" | "IN_SCADENZA" | "OFF" | "TUTTE"
              )
            }
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option value="ATTIVE">Solo attive</option>
            <option value="IN_SCADENZA">In scadenza</option>
            <option value="SCADUTE">Scadute</option>
            <option value="OFF">Off</option>
            <option value="TUTTE">Tutte</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Progetto associato
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option value="TUTTI">Tutti</option>
            <option value="SIM_LIBERA">SIM libere</option>
            {projectFilterOptions
              .filter((option) => option !== "SIM_LIBERA")
              .map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Operatore
          <select
            value={operatoreFilter}
            onChange={(e) => setOperatoreFilter(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option value="TUTTI">Tutti</option>
            {operatoreOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Stato fatturazione ultima ricarica
          <select
            value={latestRechargeBillingFilter}
            onChange={(e) => setLatestRechargeBillingFilter(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option value="TUTTI">Tutti</option>
            {latestRechargeBillingOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            fontSize: 14,
          }}
        >
          {notice}
        </div>
      )}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
        }}
      >
        {loading ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Caricamento...</div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Nessuna SIM trovata.</div>
        ) : (
          filteredRows.map((row) => {
            const rowId = String(row.id || "");
            const isEditing = editingSimId === rowId;
            const isExpanded = expandedSimId === rowId || isEditing;
            const rechargeRows = rechargesBySimId[rowId] || [];
            const latestRecharge = latestRechargeBySimId[rowId] || null;
            const effectiveScadenza = getEffectiveSimScadenza(row, latestRecharge);
            const simState = getSimOperationalState(row, latestRecharge);
            const hasRechargeToBill = rechargeRows.some(
              (recharge) => String(recharge.billing_status || "").trim().toUpperCase() === "DA_FATTURARE"
            );
            const scadenzaBadge =
              simState.stato === "SCADUTO" || simState.stato === "IN_SCADENZA" ? simState : null;
            const checklistId = String(row.checklist_id || "").trim();
            const project = checklistId ? projectByChecklistId[checklistId] : null;
            const projectLabel = !checklistId
              ? "SIM libera"
              : project
                ? `${project.nome_checklist}${project.cliente ? ` · ${project.cliente}` : ""}`
                : checklistId;
            return (
              <div
                key={rowId}
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid #f3f4f6",
                  fontSize: 14,
                  background: isEditing
                    ? "#fffdf4"
                    : scadenzaBadge?.stato === "SCADUTO"
                      ? "#fff7f7"
                      : scadenzaBadge?.stato === "IN_SCADENZA"
                        ? "#fffaf5"
                        : "#fff",
                  borderLeft:
                    scadenzaBadge?.stato === "SCADUTO"
                      ? "4px solid #ef4444"
                      : scadenzaBadge?.stato === "IN_SCADENZA"
                        ? "4px solid #f97316"
                        : "4px solid transparent",
                }}
              >
                {isEditing ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 12,
                      }}
                    >
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Numero telefono
                        <input
                          value={row.numero_telefono}
                          onChange={(e) => updateRow(rowId, { numero_telefono: e.target.value })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Intestatario
                        <input
                          value={row.intestatario}
                          onChange={(e) => updateRow(rowId, { intestatario: e.target.value })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Piano attivo
                        <input
                          value={row.piano_attivo}
                          onChange={(e) => updateRow(rowId, { piano_attivo: e.target.value })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Operatore
                        <input
                          value={row.operatore}
                          onChange={(e) => updateRow(rowId, { operatore: e.target.value })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Tariffa
                        <input
                          type="number"
                          step="0.01"
                          value={row.tariffa == null ? "" : String(row.tariffa)}
                          onChange={(e) =>
                            updateRow(rowId, {
                              tariffa: e.target.value.trim() ? Number(e.target.value) : null,
                            })
                          }
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Data attivazione
                        <input
                          type="date"
                          value={row.data_attivazione}
                          onChange={(e) => updateRow(rowId, { data_attivazione: e.target.value })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Data scadenza
                        <input
                          type="date"
                          value={row.data_scadenza}
                          onChange={(e) => updateRow(rowId, { data_scadenza: e.target.value })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Preavviso (giorni)
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.giorni_preavviso == null ? "" : String(row.giorni_preavviso)}
                          onChange={(e) =>
                            updateRow(rowId, {
                              giorni_preavviso: e.target.value.trim() ? Number(e.target.value) : null,
                            })
                          }
                          placeholder="giorni"
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Device installato
                        <input
                          value={row.device_installato}
                          onChange={(e) => updateRow(rowId, { device_installato: e.target.value })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Frequenza alert
                        <select
                          value={row.alert_frequenza}
                          onChange={(e) => updateRow(rowId, { alert_frequenza: e.target.value })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        >
                          <option value="">—</option>
                          <option value="ONCE">ONCE</option>
                          <option value="DAILY">DAILY</option>
                          <option value="WEEKLY">WEEKLY</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Stato alert
                        <select
                          value={row.stato_alert}
                          onChange={(e) => updateRow(rowId, { stato_alert: e.target.value })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        >
                          <option value="">—</option>
                          <option value="ATTIVO">ATTIVO</option>
                          <option value="SOSPESO">SOSPESO</option>
                          <option value="COMPLETATO">COMPLETATO</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Billing status
                        <select
                          value={row.billing_status}
                          onChange={(e) => updateRow(rowId, { billing_status: e.target.value })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        >
                          <option value="">—</option>
                          <option value="DA_FATTURARE">DA_FATTURARE</option>
                          <option value="INCLUSO">INCLUSO</option>
                          <option value="FATTURATO">FATTURATO</option>
                          <option value="NON_APPLICABILE">NON_APPLICABILE</option>
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        Attiva
                        <select
                          value={row.attiva ? "true" : "false"}
                          onChange={(e) => updateRow(rowId, { attiva: e.target.value === "true" })}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                        >
                          <option value="true">ATTIVA</option>
                          <option value="false">OFF</option>
                        </select>
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          paddingTop: 30,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={row.in_abbonamento}
                          onChange={(e) => updateRow(rowId, { in_abbonamento: e.target.checked })}
                        />
                        In abbonamento
                      </label>
                      <div style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                        <span>Progetto associato</span>
                        <div
                          style={{
                            minHeight: 42,
                            display: "flex",
                            alignItems: "center",
                            padding: "0 12px",
                            borderRadius: 10,
                            border: "1px solid #e5e7eb",
                            background: "#f8fafc",
                            color: "#374151",
                          }}
                        >
                          {projectLabel}
                        </div>
                      </div>
                    </div>
                    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                      Note
                      <textarea
                        value={row.note}
                        onChange={(e) => updateRow(rowId, { note: e.target.value })}
                        rows={3}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", resize: "vertical" }}
                      />
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => saveSim(row)}
                        disabled={savingKey === rowId}
                        style={{
                          height: 38,
                          padding: "0 14px",
                          borderRadius: 10,
                          border: "1px solid #0f172a",
                          background: "#0f172a",
                          color: "#fff",
                          fontWeight: 800,
                          cursor: savingKey === rowId ? "wait" : "pointer",
                          opacity: savingKey === rowId ? 0.8 : 1,
                        }}
                      >
                        {savingKey === rowId ? "Salvataggio..." : "Salva"}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelEdit(row)}
                        style={{
                          height: 38,
                          padding: "0 14px",
                          borderRadius: 10,
                          border: "1px solid #d1d5db",
                          background: "#fff",
                          color: "#111827",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Annulla
                      </button>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: row.in_abbonamento ? "#1d4ed8" : "#6b7280",
                        fontWeight: row.in_abbonamento ? 700 : 500,
                      }}
                    >
                      {row.in_abbonamento
                        ? "Ricariche non previste: SIM gestita in abbonamento."
                        : "SIM ricaricabile: compatibile con futura gestione ricariche."}
                    </div>
                    {!row.in_abbonamento && !row.isNew && (
                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: 12,
                          background: "#f8fafc",
                          display: "grid",
                          gap: 12,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800 }}>Ricariche</div>
                        {rechargeRows.length === 0 ? (
                          <div style={{ fontSize: 13, color: "#6b7280" }}>Nessuna ricarica registrata.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            {rechargeRows.map((recharge) => (
                              <div
                                key={String(recharge.id || `${recharge.sim_id}-${recharge.data_ricarica}`)}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                                  gap: 12,
                                  fontSize: 13,
                                  padding: "10px 12px",
                                  borderRadius: 10,
                                  background: "#fff",
                                  border: "1px solid #e5e7eb",
                                }}
                              >
                                <div>{formatDate(recharge.data_ricarica)}</div>
                                <div>{formatCurrency(recharge.importo)}</div>
                                <div>{renderRechargeBillingBadge(recharge.billing_status)}</div>
                                <div>{recharge.note || "—"}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => openRechargeModal(row, project)}
                            style={{
                              height: 38,
                              padding: "0 14px",
                              borderRadius: 10,
                              border: "1px solid #0f172a",
                              background: "#0f172a",
                              color: "#fff",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            Aggiungi ricarica
                          </button>
                        </div>
                      </div>
                    )}
                    {!row.in_abbonamento && row.isNew && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Salva prima la SIM per gestire le ricariche.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedSimId((prev) => (prev === rowId ? null : rowId))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedSimId((prev) => (prev === rowId ? null : rowId));
                        }
                      }}
                      style={{
                        display: "grid",
                        gap: 12,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          gridTemplateColumns: "minmax(0, 1.6fr) minmax(220px, 0.9fr)",
                          alignItems: "start",
                        }}
                      >
                        <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: 15 }}>{row.numero_telefono || "—"}</div>
                            {renderSimKindBadge(row.in_abbonamento)}
                            {renderScadenzaBadge(scadenzaBadge)}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#111827",
                              fontWeight: 600,
                              overflowWrap: "anywhere",
                            }}
                            title={projectLabel}
                          >
                            {projectLabel}
                          </div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>
                            {[row.operatore || "—", row.piano_attivo || "—"].join(" · ")}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gap: 8,
                            justifyItems: "start",
                          }}
                        >
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {renderMainSimStatusBadge(simState)}
                            {hasRechargeToBill ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "5px 10px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  background: "#fef3c7",
                                  color: "#92400e",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                DA FATTURARE
                              </span>
                            ) : null}
                          </div>
                          <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                            <div style={{ color: "#6b7280" }}>Scadenza effettiva</div>
                            <div style={{ fontWeight: 700 }}>{formatDate(effectiveScadenza)}</div>
                          </div>
                          <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                            <div style={{ color: "#6b7280" }}>Ultima ricarica</div>
                            <div style={{ fontWeight: 700 }}>{formatDate(latestRecharge?.data_ricarica)}</div>
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: 10,
                          paddingTop: 4,
                        }}
                      >
                        <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                          <div style={{ color: "#6b7280" }}>Intestatario</div>
                          <div>{row.intestatario || "—"}</div>
                        </div>
                        <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                          <div style={{ color: "#6b7280" }}>Importo ultima</div>
                          <div>{formatCurrency(latestRecharge?.importo ?? null)}</div>
                        </div>
                        <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                          <div style={{ color: "#6b7280" }}>Fatt. ricarica</div>
                          <div>{renderRechargeBillingBadge(latestRecharge?.billing_status)}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                            fontWeight: 700,
                          }}
                        >
                          {isExpanded ? "Nascondi dettagli" : "Apri dettagli"}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                            gap: 12,
                            alignItems: "start",
                          }}
                        >
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Data attivazione</div>
                            <div>{formatDate(row.data_attivazione)}</div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Tariffa</div>
                            <div>{formatCurrency(row.tariffa)}</div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Scadenza effettiva</div>
                            <div>{formatDate(effectiveScadenza)}</div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Preavviso</div>
                            <div>
                              {row.giorni_preavviso == null ? "—" : `${row.giorni_preavviso} giorni`}
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Frequenza alert</div>
                            <div>{row.alert_frequenza || "—"}</div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Stato alert</div>
                            <div>{row.stato_alert || "—"}</div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Tipologia</div>
                            <div>{row.in_abbonamento ? "IN ABBONAMENTO" : "RICARICABILE"}</div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Stato SIM</div>
                            <div>{simState.stato === "OFF" ? "OFF" : simState.stato.replace("_", " ")}</div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Progetto associato</div>
                            <div>{projectLabel}</div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Device installato</div>
                            <div>{row.device_installato || "—"}</div>
                          </div>
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>Note</div>
                          <div>{row.note || "—"}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSimId(rowId);
                            setExpandedSimId(rowId);
                            setNotice(null);
                            setError(null);
                          }}
                          style={{
                            height: 36,
                            padding: "0 14px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            color: "#111827",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteSim(row);
                          }}
                          disabled={savingKey === rowId}
                          style={{
                            height: 36,
                            padding: "0 14px",
                            borderRadius: 10,
                            border: "1px solid #fecaca",
                            background: "#fff1f2",
                            color: "#b91c1c",
                            fontWeight: 700,
                            cursor: savingKey === rowId ? "wait" : "pointer",
                            opacity: savingKey === rowId ? 0.8 : 1,
                          }}
                        >
                          Elimina
                        </button>
                        </div>
                        {row.in_abbonamento ? (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#1d4ed8",
                              fontWeight: 700,
                            }}
                          >
                            Ricariche non previste: SIM gestita in abbonamento.
                          </div>
                        ) : (
                          <div
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: 12,
                              padding: 12,
                              background: "#f8fafc",
                              display: "grid",
                              gap: 12,
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 800 }}>Ricariche</div>
                            {rechargeRows.length === 0 ? (
                              <div style={{ fontSize: 13, color: "#6b7280" }}>Nessuna ricarica registrata.</div>
                            ) : (
                              <div style={{ display: "grid", gap: 8 }}>
                                {rechargeRows.map((recharge) => (
                                  <div
                                    key={String(recharge.id || `${recharge.sim_id}-${recharge.data_ricarica}`)}
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                                      gap: 12,
                                      fontSize: 13,
                                      padding: "10px 12px",
                                      borderRadius: 10,
                                      background: "#fff",
                                      border: "1px solid #e5e7eb",
                                    }}
                                  >
                                    <div>{formatDate(recharge.data_ricarica)}</div>
                                    <div>{formatCurrency(recharge.importo)}</div>
                                    <div>{renderRechargeBillingBadge(recharge.billing_status)}</div>
                                    <div>{recharge.note || "—"}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => openRechargeModal(row, project)}
                                style={{
                                  height: 38,
                                  padding: "0 14px",
                                  borderRadius: 10,
                                  border: "1px solid #0f172a",
                                  background: "#0f172a",
                                  color: "#fff",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                Aggiungi ricarica
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
              );
            })
        )}
      </div>

      {rechargeModal ? (
        <div
          onClick={closeRechargeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 18,
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.18)",
              padding: 20,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>Aggiungi ricarica</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  La scadenza effettiva SIM e le scadenze cliente si riallineano automaticamente sulla ricarica piu recente.
                </div>
              </div>
              <button
                type="button"
                onClick={closeRechargeModal}
                disabled={savingRechargeKey === rechargeModal.simId}
                style={{
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#111827",
                  fontWeight: 700,
                  cursor: savingRechargeKey === rechargeModal.simId ? "wait" : "pointer",
                }}
              >
                Chiudi
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                padding: 14,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Numero SIM</div>
                <div style={{ fontWeight: 700 }}>{rechargeModal.numeroTelefono}</div>
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Cliente</div>
                <div style={{ fontWeight: 700 }}>{rechargeModal.cliente}</div>
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Progetto</div>
                <div style={{ fontWeight: 700 }}>{rechargeModal.progetto}</div>
              </div>
            </div>

            {rechargeModal.inAbbonamento ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Ricarica bloccata: questa SIM e gestita in abbonamento.
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                alignItems: "end",
              }}
            >
              <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                Data ricarica
                <input
                  type="date"
                  value={newRechargeBySimId[rechargeModal.simId]?.data_ricarica || ""}
                  onChange={(e) => updateRechargeDraft(rechargeModal.simId, { data_ricarica: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                Importo
                <input
                  type="number"
                  step="0.01"
                  value={newRechargeBySimId[rechargeModal.simId]?.importo || ""}
                  onChange={(e) => updateRechargeDraft(rechargeModal.simId, { importo: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 42,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={newRechargeBySimId[rechargeModal.simId]?.billing_status === "DA_FATTURARE"}
                  onChange={(e) =>
                    updateRechargeDraft(rechargeModal.simId, {
                      billing_status: e.target.checked ? "DA_FATTURARE" : "NON_FATTURARE",
                    })
                  }
                />
                Fatturare
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                Note
                <input
                  value={newRechargeBySimId[rechargeModal.simId]?.note || ""}
                  onChange={(e) => updateRechargeDraft(rechargeModal.simId, { note: e.target.value })}
                  placeholder="Note ricarica"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closeRechargeModal}
                disabled={savingRechargeKey === rechargeModal.simId}
                style={{
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#111827",
                  fontWeight: 700,
                  cursor: savingRechargeKey === rechargeModal.simId ? "wait" : "pointer",
                }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => addRecharge(rechargeModal.simId)}
                disabled={savingRechargeKey === rechargeModal.simId || rechargeModal.inAbbonamento}
                style={{
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1px solid #0f172a",
                  background: "#0f172a",
                  color: "#fff",
                  fontWeight: 800,
                  cursor:
                    savingRechargeKey === rechargeModal.simId || rechargeModal.inAbbonamento
                      ? "not-allowed"
                      : "pointer",
                  opacity: savingRechargeKey === rechargeModal.simId || rechargeModal.inAbbonamento ? 0.7 : 1,
                }}
              >
                {savingRechargeKey === rechargeModal.simId ? "Salvataggio..." : "Salva ricarica"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
