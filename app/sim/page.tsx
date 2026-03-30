"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ConfigMancante from "@/components/ConfigMancante";
import { dbFrom } from "@/lib/clientDbBroker";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type SimCardRow = {
  id?: string;
  numero_telefono: string;
  intestatario: string;
  piano_attivo: string;
  operatore: string;
  tariffa: number | null;
  data_scadenza: string;
  giorni_preavviso: number | null;
  alert_frequenza: string;
  stato_alert: string;
  billing_status: string;
  attiva: boolean;
  in_abbonamento: boolean;
  note: string;
  isNew?: boolean;
};

type SimRechargeRow = {
  id?: string;
  sim_id: string;
  data_ricarica: string;
  importo: number | null;
  note: string;
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

function getScadenzaBadgeState(row: Pick<SimCardRow, "data_scadenza" | "giorni_preavviso">) {
  const scadenza = parseLocalDay(row.data_scadenza);
  if (!scadenza) return null;
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
  return null;
}

function renderScadenzaBadge(state: ReturnType<typeof getScadenzaBadgeState>) {
  if (!state) return null;
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
  const [search, setSearch] = useState("");
  const [attiveFilter, setAttiveFilter] = useState<"ATTIVE" | "TUTTE">("ATTIVE");
  const [operatoreFilter, setOperatoreFilter] = useState("TUTTI");
  const [billingStatusFilter, setBillingStatusFilter] = useState("TUTTI");
  const [editingSimId, setEditingSimId] = useState<string | null>(null);
  const [expandedSimId, setExpandedSimId] = useState<string | null>(null);
  const [rechargesBySimId, setRechargesBySimId] = useState<Record<string, SimRechargeRow[]>>({});
  const [newRechargeBySimId, setNewRechargeBySimId] = useState<
    Record<string, { data_ricarica: string; importo: string; note: string }>
  >({});
  const [savingRechargeKey, setSavingRechargeKey] = useState<string | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef<"top" | "main" | null>(null);
  const [scrollContentWidth, setScrollContentWidth] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: loadError } = await dbFrom("sim_cards")
        .select(
          "id, numero_telefono, intestatario, piano_attivo, operatore, tariffa, data_scadenza, giorni_preavviso, alert_frequenza, stato_alert, billing_status, attiva, in_abbonamento, note"
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
          note: String(row.note || ""),
          isNew: false,
        }));
      setRows(nextRows);

      const persistedSimIds = nextRows
        .map((row) => String(row.id || ""))
        .filter(Boolean);
      const rechargeEntries = await Promise.all(
        persistedSimIds.map(async (simId) => {
          const { data: rechargeData, error: rechargeError } = await dbFrom("sim_recharges")
            .select("id, sim_id, data_ricarica, importo, note")
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

  const billingStatusOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => String(row.billing_status || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "it"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);
    return rows.filter((row) => {
      if (attiveFilter === "ATTIVE" && !row.attiva) return false;
      if (operatoreFilter !== "TUTTI" && row.operatore !== operatoreFilter) return false;
      if (billingStatusFilter !== "TUTTI" && row.billing_status !== billingStatusFilter) return false;

      if (!query) return true;
      const haystack = normalizeText(
        [row.numero_telefono, row.intestatario, row.operatore, row.piano_attivo].join(" ")
      );
      return haystack.includes(query);
    });
  }, [rows, search, attiveFilter, operatoreFilter, billingStatusFilter]);

  useEffect(() => {
    function syncScrollWidth() {
      const nextWidth = scrollContentRef.current?.scrollWidth || 0;
      setScrollContentWidth(nextWidth);
    }

    syncScrollWidth();
    window.addEventListener("resize", syncScrollWidth);
    return () => {
      window.removeEventListener("resize", syncScrollWidth);
    };
  }, [filteredRows, loading, editingSimId, expandedSimId]);

  function handleTopScroll() {
    if (!topScrollRef.current || !mainScrollRef.current) return;
    if (syncingScrollRef.current === "main") {
      syncingScrollRef.current = null;
      return;
    }
    syncingScrollRef.current = "top";
    mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  }

  function handleMainScroll() {
    if (!topScrollRef.current || !mainScrollRef.current) return;
    if (syncingScrollRef.current === "top") {
      syncingScrollRef.current = null;
      return;
    }
    syncingScrollRef.current = "main";
    topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
  }

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
    patch: Partial<{ data_ricarica: string; importo: string; note: string }>
  ) {
    setNewRechargeBySimId((prev) => ({
      ...prev,
      [simId]: {
        data_ricarica: prev[simId]?.data_ricarica || "",
        importo: prev[simId]?.importo || "",
        note: prev[simId]?.note || "",
        ...patch,
      },
    }));
  }

  function addNewSim() {
    const tempId = createTempId("sim");
    setRows((prev) => [
      {
        id: tempId,
        numero_telefono: "",
        intestatario: "",
        piano_attivo: "",
        operatore: "",
        tariffa: null,
        data_scadenza: "",
        giorni_preavviso: null,
        alert_frequenza: "",
        stato_alert: "",
        billing_status: "",
        attiva: true,
        in_abbonamento: false,
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
      numero_telefono: numeroTelefono,
      intestatario: row.intestatario.trim() || null,
      piano_attivo: row.piano_attivo.trim() || null,
      operatore: row.operatore.trim() || null,
      tariffa: row.tariffa == null || !Number.isFinite(row.tariffa) ? null : row.tariffa,
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

  async function addRecharge(row: SimCardRow) {
    const simId = String(row.id || "");
    if (!simId || row.isNew || row.in_abbonamento) return;

    const draft = newRechargeBySimId[simId] || { data_ricarica: "", importo: "", note: "" };
    const dataRicarica = draft.data_ricarica.trim();
    if (!dataRicarica) {
      setError("Data ricarica obbligatoria.");
      return;
    }

    setSavingRechargeKey(simId);
    setError(null);
    setNotice(null);

    const payload = {
      sim_id: simId,
      data_ricarica: dataRicarica,
      importo: draft.importo.trim() ? Number(draft.importo) : null,
      note: draft.note.trim() || null,
    };

    const { data, error: insertError } = await dbFrom("sim_recharges")
      .insert(payload)
      .select("id, sim_id, data_ricarica, importo, note")
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
      note: String(saved?.note || payload.note || ""),
    };

    setRechargesBySimId((prev) => ({
      ...prev,
      [simId]: [nextRecharge, ...(prev[simId] || [])],
    }));
    setNewRechargeBySimId((prev) => ({
      ...prev,
      [simId]: { data_ricarica: "", importo: "", note: "" },
    }));
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
          gridTemplateColumns: "minmax(260px,1.4fr) minmax(160px,0.7fr) minmax(180px,0.8fr) minmax(180px,0.8fr)",
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
            value={attiveFilter}
            onChange={(e) => setAttiveFilter(e.target.value as "ATTIVE" | "TUTTE")}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option value="ATTIVE">Solo attive</option>
            <option value="TUTTE">Tutte</option>
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
          Stato fatturazione
          <select
            value={billingStatusFilter}
            onChange={(e) => setBillingStatusFilter(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option value="TUTTI">Tutti</option>
            {billingStatusOptions.map((option) => (
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
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            borderBottom: "1px solid #e5e7eb",
            background: "#f8fafc",
          }}
        >
          <div style={{ width: scrollContentWidth || "100%", height: 16 }} />
        </div>

        <div
          ref={mainScrollRef}
          onScroll={handleMainScroll}
          style={{ overflowX: "auto", overflowY: "hidden" }}
        >
          <div ref={scrollContentRef} style={{ width: "max-content", minWidth: "100%" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "160px minmax(180px,1fr) minmax(180px,1fr) 140px 110px 130px 170px 90px",
                gap: 12,
                padding: "14px 16px",
                fontSize: 12,
                fontWeight: 800,
                color: "#374151",
                background: "#f8fafc",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div>Numero</div>
              <div>Intestatario</div>
              <div>Piano attivo</div>
              <div>Operatore</div>
              <div>Tariffa</div>
              <div>Scadenza</div>
              <div>Fatturazione</div>
              <div>Attiva</div>
            </div>

            {loading ? (
              <div style={{ padding: 18, color: "#6b7280" }}>Caricamento...</div>
            ) : filteredRows.length === 0 ? (
              <div style={{ padding: 18, color: "#6b7280" }}>Nessuna SIM trovata.</div>
            ) : (
              filteredRows.map((row) => {
            const rowId = String(row.id || "");
            const isEditing = editingSimId === rowId;
            const isExpanded = expandedSimId === rowId || isEditing;
            const scadenzaBadge = getScadenzaBadgeState(row);
            const rechargeRows = rechargesBySimId[rowId] || [];
            const rechargeDraft = newRechargeBySimId[rowId] || {
              data_ricarica: "",
              importo: "",
              note: "",
            };
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
                        gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
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
                                  gridTemplateColumns: "140px 120px minmax(220px,1fr)",
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
                                <div>{recharge.note || "—"}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "160px 140px minmax(220px,1fr) 150px",
                            gap: 12,
                            alignItems: "end",
                          }}
                        >
                          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                            Data ricarica
                            <input
                              type="date"
                              value={rechargeDraft.data_ricarica}
                              onChange={(e) =>
                                updateRechargeDraft(rowId, { data_ricarica: e.target.value })
                              }
                              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                            Importo
                            <input
                              type="number"
                              step="0.01"
                              value={rechargeDraft.importo}
                              onChange={(e) => updateRechargeDraft(rowId, { importo: e.target.value })}
                              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                            Note
                            <input
                              value={rechargeDraft.note}
                              onChange={(e) => updateRechargeDraft(rowId, { note: e.target.value })}
                              placeholder="Note ricarica"
                              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => addRecharge(row)}
                            disabled={savingRechargeKey === rowId}
                            style={{
                              height: 40,
                              padding: "0 14px",
                              borderRadius: 10,
                              border: "1px solid #0f172a",
                              background: "#0f172a",
                              color: "#fff",
                              fontWeight: 800,
                              cursor: savingRechargeKey === rowId ? "wait" : "pointer",
                              opacity: savingRechargeKey === rowId ? 0.8 : 1,
                            }}
                          >
                            {savingRechargeKey === rowId ? "Salvataggio..." : "Salva ricarica"}
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
                        gridTemplateColumns:
                          "150px minmax(160px,1fr) 130px minmax(180px,1fr) 130px 160px 150px 90px",
                        gap: 12,
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 700 }}>{row.numero_telefono || "—"}</div>
                        {renderScadenzaBadge(scadenzaBadge)}
                      </div>
                      <div>{row.intestatario || "—"}</div>
                      <div>{row.operatore || "—"}</div>
                      <div>{row.piano_attivo || "—"}</div>
                      <div>{formatDate(row.data_scadenza)}</div>
                      <div>{renderBillingBadge(row.billing_status)}</div>
                      <div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            background: row.in_abbonamento ? "#dbeafe" : "#f3f4f6",
                            color: row.in_abbonamento ? "#1d4ed8" : "#374151",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.in_abbonamento ? "IN ABBONAMENTO" : "RICARICABILE"}
                        </span>
                      </div>
                      <div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            background: row.attiva ? "#dcfce7" : "#e5e7eb",
                            color: row.attiva ? "#166534" : "#4b5563",
                          }}
                        >
                          {row.attiva ? "ATTIVA" : "OFF"}
                        </span>
                      </div>
                      <div
                        style={{
                          justifySelf: "end",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isExpanded ? "Nascondi dettagli" : "Apri dettagli"}
                      </div>
                    </div>
                    {isExpanded ? (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "minmax(140px, 0.8fr) minmax(140px, 0.8fr) minmax(140px, 0.8fr) minmax(140px, 0.8fr) minmax(140px, 0.8fr) minmax(140px, 0.8fr)",
                            gap: 12,
                            alignItems: "start",
                          }}
                        >
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>Tariffa</div>
                            <div>{formatCurrency(row.tariffa)}</div>
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
                            <div>{row.attiva ? "ATTIVA" : "OFF"}</div>
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
                                      gridTemplateColumns: "140px 120px minmax(220px,1fr)",
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
                                    <div>{recharge.note || "—"}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "160px 140px minmax(220px,1fr) 150px",
                                gap: 12,
                                alignItems: "end",
                              }}
                            >
                              <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                                Data ricarica
                                <input
                                  type="date"
                                  value={rechargeDraft.data_ricarica}
                                  onChange={(e) =>
                                    updateRechargeDraft(rowId, { data_ricarica: e.target.value })
                                  }
                                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                                />
                              </label>
                              <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                                Importo
                                <input
                                  type="number"
                                  step="0.01"
                                  value={rechargeDraft.importo}
                                  onChange={(e) => updateRechargeDraft(rowId, { importo: e.target.value })}
                                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                                />
                              </label>
                              <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                                Note
                                <input
                                  value={rechargeDraft.note}
                                  onChange={(e) => updateRechargeDraft(rowId, { note: e.target.value })}
                                  placeholder="Note ricarica"
                                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => addRecharge(row)}
                                disabled={savingRechargeKey === rowId}
                                style={{
                                  height: 40,
                                  padding: "0 14px",
                                  borderRadius: 10,
                                  border: "1px solid #0f172a",
                                  background: "#0f172a",
                                  color: "#fff",
                                  fontWeight: 800,
                                  cursor: savingRechargeKey === rowId ? "wait" : "pointer",
                                  opacity: savingRechargeKey === rowId ? 0.8 : 1,
                                }}
                              >
                                {savingRechargeKey === rowId ? "Salvataggio..." : "Salva ricarica"}
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
        </div>
      </div>
    </div>
  );
}
