"use client";

import { useEffect, useMemo, useState } from "react";
import ConfigMancante from "@/components/ConfigMancante";
import { getBillingStatoPriority, type BillingItem } from "@/lib/billing";
import { dbFrom } from "@/lib/clientDbBroker";
import { getCanonicalInterventoEsitoFatturazione, type InterventoRow } from "@/lib/interventi";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type SimRechargeRow = {
  id: string;
  sim_id: string;
  data_ricarica: string;
  importo: number | null;
  billing_status: string;
  payment_status?: string | null;
  note: string;
};

type SimCardRow = {
  id: string;
  checklist_id: string;
  numero_telefono: string;
};

type ChecklistRow = {
  id: string;
  nome_checklist: string;
  cliente: string;
};

type InterventoBillingRow = InterventoRow & {
  payment_status?: string | null;
  checklist?: {
    id: string;
    nome_checklist: string | null;
  } | null;
};

type RinnovoBillingRow = {
  id: string;
  cliente?: string | null;
  item_tipo?: string | null;
  subtipo?: string | null;
  checklist_id?: string | null;
  scadenza?: string | null;
  stato?: string | null;
  riferimento?: string | null;
  descrizione?: string | null;
  billing_requested_at?: string | null;
  payment_status?: string | null;
};

const sectionTitles = ["DA FATTURARE", "EMESSE", "SCADUTE NON PAGATE", "FATTURATE"] as const;

function formatDate(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return raw;
  return date.toLocaleDateString("it-IT");
}

function formatCurrency(value?: number) {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

function toTime(value?: string | null) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function isOverdueUnpaid(item: BillingItem) {
  return (
    item.stato === "FATTURATO" &&
    (item.paymentStatus || "NON_PAGATO") === "NON_PAGATO" &&
    toTime(item.dataScadenza) > 0 &&
    toTime(item.dataScadenza) < Date.now()
  );
}

function getVisualBillingStato(item: BillingItem): BillingItem["stato"] | "SCADUTA" {
  if (item.stato === "FATTURATO") return item.stato;
  const scadenzaTime = toTime(item.dataScadenza);
  if (scadenzaTime > 0 && scadenzaTime < Date.now()) {
    return "SCADUTA";
  }
  return item.stato;
}

function renderBillingStatoBadge(stato: BillingItem["stato"] | "SCADUTA") {
  let background = "#f3f4f6";
  let color = "#374151";
  if (stato === "SCADUTA") {
    background = "#fee2e2";
    color = "#991b1b";
  } else if (stato === "DA_FATTURARE") {
    background = "#ffedd5";
    color = "#c2410c";
  } else if (stato === "FATTURATO") {
    background = "#dcfce7";
    color = "#166534";
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
      {stato}
    </span>
  );
}

function normalizePaymentStatus(value?: string | null): BillingItem["paymentStatus"] {
  return String(value || "").trim().toUpperCase() === "PAGATO" ? "PAGATO" : "NON_PAGATO";
}

function renderPaymentStatusBadge(status: BillingItem["paymentStatus"]) {
  const isPaid = status === "PAGATO";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: isPaid ? "#dcfce7" : "#f3f4f6",
        color: isPaid ? "#166534" : "#374151",
        whiteSpace: "nowrap",
      }}
    >
      {isPaid ? "PAGATO" : "NON PAGATO"}
    </span>
  );
}

function buildSimDescription(row: SimRechargeRow, sim?: SimCardRow | null) {
  const parts = [`Ricarica SIM ${sim?.numero_telefono || "—"}`];
  const note = String(row.note || "").trim();
  if (note) parts.push(note);
  return parts.join(" · ");
}

function buildInterventoDescription(row: InterventoBillingRow) {
  const parts = [row.ticket_no ? `Intervento ${row.ticket_no}` : "Intervento"];
  const descrizione = String(row.descrizione || "").trim();
  if (descrizione) parts.push(descrizione);
  return parts.join(" · ");
}

function buildRinnovoDescription(row: RinnovoBillingRow) {
  const tipo = String(row.item_tipo || "").toUpperCase();
  const subtipo = String(row.subtipo || "").toUpperCase();
  const label =
    tipo === "SAAS"
      ? subtipo === "ULTRA"
        ? "SaaS Ultra"
        : "SaaS"
      : "Rinnovo";
  const ref = String(row.riferimento || "").trim();
  const descrizione = String(row.descrizione || "").trim();
  return [label, ref || null, descrizione || null].filter(Boolean).join(" · ");
}

async function loadBillingRinnoviRows() {
  let select =
    "id, cliente, item_tipo, subtipo, checklist_id, scadenza, stato, riferimento, descrizione, billing_requested_at, payment_status";
  let { data, error } = await supabase
    .from("rinnovi_servizi")
    .select(select)
    .in("stato", ["DA_FATTURARE", "FATTURATO"])
    .in("item_tipo", ["RINNOVO", "SAAS"])
    .order("scadenza", { ascending: false });

  if (error && String(error.message || "").toLowerCase().includes("billing_requested_at")) {
    select = "id, cliente, item_tipo, subtipo, checklist_id, scadenza, stato, riferimento, descrizione, payment_status";
    const retry = await supabase
      .from("rinnovi_servizi")
      .select(select)
      .in("stato", ["DA_FATTURARE", "FATTURATO"])
      .in("item_tipo", ["RINNOVO", "SAAS"])
      .order("scadenza", { ascending: false });
    data = ((retry.data as any[]) || []).map((row) => ({ ...row, billing_requested_at: null }));
    error = retry.error;
  }

  if (error && String(error.message || "").toLowerCase().includes("riferimento")) {
    select = "id, cliente, item_tipo, subtipo, checklist_id, scadenza, stato, descrizione, payment_status";
    const retry = await supabase
      .from("rinnovi_servizi")
      .select(select)
      .in("stato", ["DA_FATTURARE", "FATTURATO"])
      .in("item_tipo", ["RINNOVO", "SAAS"])
      .order("scadenza", { ascending: false });
    data = ((retry.data as any[]) || []).map((row) => ({
      ...row,
      riferimento: null,
      billing_requested_at: row.billing_requested_at ?? null,
    }));
    error = retry.error;
  }

  if (error && String(error.message || "").toLowerCase().includes("descrizione")) {
    select = "id, cliente, item_tipo, subtipo, checklist_id, scadenza, stato, payment_status";
    const retry = await supabase
      .from("rinnovi_servizi")
      .select(select)
      .in("stato", ["DA_FATTURARE", "FATTURATO"])
      .in("item_tipo", ["RINNOVO", "SAAS"])
      .order("scadenza", { ascending: false });
    data = ((retry.data as any[]) || []).map((row) => ({
      ...row,
      riferimento: null,
      descrizione: null,
      billing_requested_at: null,
      payment_status: row.payment_status ?? null,
    }));
    error = retry.error;
  }

  if (error) {
    throw new Error(`Errore caricamento rinnovi e SaaS: ${error.message}`);
  }

  return (((data as any[]) || []) as Array<Record<string, any>>).map(
    (row) =>
      ({
        id: String(row.id || ""),
        cliente: row.cliente ? String(row.cliente) : null,
        item_tipo: row.item_tipo ? String(row.item_tipo) : null,
        subtipo: row.subtipo ? String(row.subtipo) : null,
        checklist_id: row.checklist_id ? String(row.checklist_id) : null,
        scadenza: row.scadenza ? String(row.scadenza) : null,
        stato: row.stato ? String(row.stato) : null,
        riferimento: row.riferimento ? String(row.riferimento) : null,
        descrizione: row.descrizione ? String(row.descrizione) : null,
        billing_requested_at: row.billing_requested_at ? String(row.billing_requested_at) : null,
        payment_status: row.payment_status ? String(row.payment_status) : null,
      }) satisfies RinnovoBillingRow
  );
}

export default function FatturazioneGlobalePage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState("");
  const [selectedSource, setSelectedSource] = useState<"ALL" | "SIM" | "INTERVENTO" | "RINNOVO" | "SAAS">("ALL");
  const [selectedStato, setSelectedStato] = useState<"ALL" | "DA_FATTURARE" | "FATTURATO" | "SCADUTA">("ALL");

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: rechargeData, error: rechargeError } = await dbFrom("sim_recharges")
          .select("id, sim_id, data_ricarica, importo, billing_status, payment_status, note")
          .in("billing_status", ["DA_FATTURARE", "FATTURATO"])
          .order("data_ricarica", { ascending: false });

        if (rechargeError) {
          throw new Error(`Errore caricamento ricariche SIM: ${rechargeError.message}`);
        }

        const recharges = (((rechargeData as any[]) || []) as Array<Record<string, any>>).map(
          (row) =>
            ({
              id: String(row.id || ""),
              sim_id: String(row.sim_id || ""),
              data_ricarica: String(row.data_ricarica || ""),
              importo:
                typeof row.importo === "number"
                  ? row.importo
                  : row.importo == null || row.importo === ""
                    ? null
                    : Number(row.importo),
              billing_status: String(row.billing_status || ""),
              payment_status: row.payment_status ? String(row.payment_status) : null,
              note: String(row.note || ""),
            }) satisfies SimRechargeRow
        );

        const simIds = Array.from(new Set(recharges.map((row) => row.sim_id).filter(Boolean)));
        const simMap = new Map<string, SimCardRow>();
        const checklistMap = new Map<string, ChecklistRow>();

        if (simIds.length > 0) {
          const { data: simData, error: simError } = await dbFrom("sim_cards")
            .select("id, checklist_id, numero_telefono")
            .in("id", simIds);

          if (simError) {
            throw new Error(`Errore caricamento SIM collegate: ${simError.message}`);
          }

          for (const row of (((simData as any[]) || []) as Array<Record<string, any>>)) {
            const id = String(row.id || "");
            if (!id) continue;
            simMap.set(id, {
              id,
              checklist_id: String(row.checklist_id || ""),
              numero_telefono: String(row.numero_telefono || ""),
            });
          }

          const checklistIds = Array.from(
            new Set(Array.from(simMap.values()).map((row) => row.checklist_id).filter(Boolean))
          );

          if (checklistIds.length > 0) {
            const { data: checklistData, error: checklistError } = await dbFrom("checklists")
              .select("id, nome_checklist, cliente")
              .in("id", checklistIds);

            if (checklistError) {
              throw new Error(`Errore caricamento progetti SIM: ${checklistError.message}`);
            }

            for (const row of (((checklistData as any[]) || []) as Array<Record<string, any>>)) {
              const id = String(row.id || "");
              if (!id) continue;
              checklistMap.set(id, {
                id,
                nome_checklist: String(row.nome_checklist || ""),
                cliente: String(row.cliente || ""),
              });
            }
          }
        }

        const simItems: BillingItem[] = recharges.map((row) => {
          const sim = simMap.get(row.sim_id) || null;
          const checklist = sim?.checklist_id ? checklistMap.get(sim.checklist_id) || null : null;
          return {
            id: `SIM:${row.id}`,
            source: "SIM",
            clienteNome: checklist?.cliente || "—",
            progettoNome: checklist?.nome_checklist || "SIM libera",
            descrizione: buildSimDescription(row, sim),
            importo: row.importo ?? undefined,
            stato:
              String(row.billing_status || "").trim().toUpperCase() === "FATTURATO"
                ? "FATTURATO"
                : "DA_FATTURARE",
            paymentStatus: normalizePaymentStatus(row.payment_status),
            dataCompetenza: row.data_ricarica || undefined,
            riferimentoId: row.id,
          };
        });

        const { data: interventiData, error: interventiError } = await supabase
          .from("saas_interventi")
          .select(
            "id, cliente, checklist_id, ticket_no, data, descrizione, incluso, fatturazione_stato, esito_fatturazione, payment_status, created_at, checklist:checklists(id, nome_checklist)"
          )
          .order("data", { ascending: false });

        if (interventiError) {
          throw new Error(`Errore caricamento interventi: ${interventiError.message}`);
        }

        const interventiItems: BillingItem[] = (((interventiData as any[]) || []) as InterventoBillingRow[])
          .filter((row) => {
            const stato = getCanonicalInterventoEsitoFatturazione(row);
            return stato === "DA_FATTURARE" || stato === "FATTURATO";
          })
          .map((row) => ({
            id: `INTERVENTO:${row.id}`,
            source: "INTERVENTO",
            clienteNome: String(row.cliente || "—"),
            progettoNome: row.checklist?.nome_checklist || undefined,
            descrizione: buildInterventoDescription(row),
            stato: getCanonicalInterventoEsitoFatturazione(row) === "FATTURATO" ? "FATTURATO" : "DA_FATTURARE",
            paymentStatus: normalizePaymentStatus(row.payment_status),
            dataCompetenza: String(row.data || row.created_at || "") || undefined,
            riferimentoId: row.id,
          }));

        const rinnoviRows = await loadBillingRinnoviRows();
        const rinnoviChecklistIds = Array.from(
          new Set(rinnoviRows.map((row) => String(row.checklist_id || "")).filter(Boolean))
        );
        const rinnoviChecklistMap = new Map<string, ChecklistRow>();

        if (rinnoviChecklistIds.length > 0) {
          const { data: rinnoviChecklistData, error: rinnoviChecklistError } = await dbFrom("checklists")
            .select("id, nome_checklist, cliente")
            .in("id", rinnoviChecklistIds);

          if (rinnoviChecklistError) {
            throw new Error(`Errore caricamento progetti rinnovi: ${rinnoviChecklistError.message}`);
          }

          for (const row of (((rinnoviChecklistData as any[]) || []) as Array<Record<string, any>>)) {
            const id = String(row.id || "");
            if (!id) continue;
            rinnoviChecklistMap.set(id, {
              id,
              nome_checklist: String(row.nome_checklist || ""),
              cliente: String(row.cliente || ""),
            });
          }
        }

        const rinnovoItems: BillingItem[] = rinnoviRows
          .filter((row) => String(row.item_tipo || "").toUpperCase() === "RINNOVO")
          .map((row) => {
            const checklist = row.checklist_id ? rinnoviChecklistMap.get(row.checklist_id) || null : null;
            return {
              id: `RINNOVO:${row.id}`,
              source: "RINNOVO",
              clienteNome: String(row.cliente || checklist?.cliente || "—"),
              progettoNome: checklist?.nome_checklist || undefined,
              descrizione: buildRinnovoDescription(row),
              stato: String(row.stato || "").trim().toUpperCase() === "FATTURATO" ? "FATTURATO" : "DA_FATTURARE",
              paymentStatus: normalizePaymentStatus(row.payment_status),
              dataCompetenza: String(row.billing_requested_at || row.scadenza || "") || undefined,
              dataScadenza: String(row.scadenza || "") || undefined,
              riferimentoId: row.id,
            };
          });

        const saasItems: BillingItem[] = rinnoviRows
          .filter((row) => String(row.item_tipo || "").toUpperCase() === "SAAS")
          .map((row) => {
            const checklist = row.checklist_id ? rinnoviChecklistMap.get(row.checklist_id) || null : null;
            return {
              id: `SAAS:${row.id}`,
              source: "SAAS",
              clienteNome: String(row.cliente || checklist?.cliente || "—"),
              progettoNome: checklist?.nome_checklist || undefined,
              descrizione: buildRinnovoDescription(row),
              stato: String(row.stato || "").trim().toUpperCase() === "FATTURATO" ? "FATTURATO" : "DA_FATTURARE",
              paymentStatus: normalizePaymentStatus(row.payment_status),
              dataCompetenza: String(row.billing_requested_at || row.scadenza || "") || undefined,
              dataScadenza: String(row.scadenza || "") || undefined,
              riferimentoId: row.id,
            };
          });

        const nextItems = [...simItems, ...interventiItems, ...rinnovoItems, ...saasItems].sort((a, b) => {
          const byStatus =
            getBillingStatoPriority(getVisualBillingStato(b)) -
            getBillingStatoPriority(getVisualBillingStato(a));
          if (byStatus !== 0) return byStatus;
          return toTime(b.dataCompetenza) - toTime(a.dataCompetenza);
        });

        if (!active) return;
        setItems(nextItems);
      } catch (err: any) {
        if (!active) return;
        setItems([]);
        setError(String(err?.message || "Errore caricamento fatturazione globale"));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const daFatturareItems = useMemo(() => {
    const clienteQuery = selectedCliente.trim().toLowerCase();
    return items
      .filter((item) => !isOverdueUnpaid(item))
      .filter((item) =>
        !clienteQuery ? true : String(item.clienteNome || "").toLowerCase().includes(clienteQuery)
      )
      .filter((item) => (selectedSource === "ALL" ? true : item.source === selectedSource))
      .filter((item) => (selectedStato === "ALL" ? true : getVisualBillingStato(item) === selectedStato))
      .sort((a, b) => {
        const byStatus =
          getBillingStatoPriority(getVisualBillingStato(b)) -
          getBillingStatoPriority(getVisualBillingStato(a));
        if (byStatus !== 0) return byStatus;
        return toTime(b.dataCompetenza) - toTime(a.dataCompetenza);
      });
  }, [items, selectedCliente, selectedSource, selectedStato]);

  const scaduteNonPagateItems = useMemo(
    () =>
      items
        .filter((item) => isOverdueUnpaid(item))
        .sort((a, b) => toTime(b.dataScadenza || b.dataCompetenza) - toTime(a.dataScadenza || a.dataCompetenza)),
    [items]
  );

  async function markAsFatturata(item: BillingItem) {
    const targetId = String(item.riferimentoId || "").trim();
    if (!targetId) return;
    setSavingItemId(item.id);
    try {
      if (item.source === "SIM") {
        const { error } = await dbFrom("sim_recharges")
          .update({ billing_status: "FATTURATO" })
          .eq("id", targetId);
        if (error) throw error;
      } else if (item.source === "INTERVENTO") {
        const nowIso = new Date().toISOString();
        const { error } = await dbFrom("saas_interventi")
          .update({
            fatturazione_stato: "FATTURATO",
            esito_fatturazione: "FATTURATO",
            fatturato_il: nowIso,
          })
          .eq("id", targetId);
        if (error) throw error;
      } else if (item.source === "RINNOVO" || item.source === "SAAS") {
        const { error } = await dbFrom("rinnovi_servizi")
          .update({ stato: "FATTURATO" })
          .eq("id", targetId);
        if (error) throw error;
      }

      setItems((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? { ...current, stato: "FATTURATO", paymentStatus: current.paymentStatus || "NON_PAGATO" }
            : current
        )
      );
    } catch (err) {
      console.error("Errore aggiornamento stato fatturato", {
        source: item.source,
        riferimentoId: targetId,
        err,
      });
    } finally {
      setSavingItemId(null);
    }
  }

  async function markAsPaid(item: BillingItem) {
    const targetId = String(item.riferimentoId || "").trim();
    if (!targetId) return;
    setSavingItemId(item.id);
    try {
      if (item.source === "SIM") {
        const { error } = await dbFrom("sim_recharges")
          .update({ payment_status: "PAGATO" })
          .eq("id", targetId);
        if (error) throw error;
      } else if (item.source === "INTERVENTO") {
        const { error } = await dbFrom("saas_interventi")
          .update({ payment_status: "PAGATO" })
          .eq("id", targetId);
        if (error) throw error;
      } else if (item.source === "RINNOVO" || item.source === "SAAS") {
        const { error } = await dbFrom("rinnovi_servizi")
          .update({ payment_status: "PAGATO" })
          .eq("id", targetId);
        if (error) throw error;
      }

      setItems((prev) =>
        prev.map((current) =>
          current.id === item.id ? { ...current, paymentStatus: "PAGATO" } : current
        )
      );
    } catch (err) {
      console.error("Errore aggiornamento payment_status", {
        source: item.source,
        riferimentoId: targetId,
        err,
      });
    } finally {
      setSavingItemId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px 48px" }}>
      <div style={{ display: "grid", gap: 6, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>Fatturazione</h1>
        <div style={{ fontSize: 14, color: "#6b7280" }}>
          Vista aggregata di tutte le fatture e voci fatturabili (SIM, interventi, rinnovi, servizi)
        </div>
      </div>

      {error ? (
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
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {sectionTitles.map((title) => {
          const isDaFatturare = title === "DA FATTURARE";
          const isScaduteNonPagate = title === "SCADUTE NON PAGATE";
          const rows = isDaFatturare ? daFatturareItems : isScaduteNonPagate ? scaduteNonPagateItems : [];
          return (
            <section
              key={title}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#fff",
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderBottom: "1px solid #f3f4f6",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#111827",
                }}
              >
                {title}
              </div>
              {isDaFatturare ? (
                <div
                  style={{
                    padding: 18,
                    borderBottom: "1px solid #f3f4f6",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                  }}
                >
                  <input
                    value={selectedCliente}
                    onChange={(e) => setSelectedCliente(e.target.value)}
                    placeholder="Cerca cliente..."
                    style={{
                      minHeight: 40,
                      padding: "0 12px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#111827",
                      fontSize: 14,
                    }}
                  />
                  <select
                    value={selectedSource}
                    onChange={(e) =>
                      setSelectedSource(
                        e.target.value as "ALL" | "SIM" | "INTERVENTO" | "RINNOVO" | "SAAS"
                      )
                    }
                    style={{
                      minHeight: 40,
                      padding: "0 12px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#111827",
                      fontSize: 14,
                    }}
                  >
                    <option value="ALL">Tutti i tipi</option>
                    <option value="SIM">SIM</option>
                    <option value="INTERVENTO">INTERVENTO</option>
                    <option value="RINNOVO">RINNOVO</option>
                    <option value="SAAS">SAAS</option>
                  </select>
                  <select
                    value={selectedStato}
                    onChange={(e) =>
                      setSelectedStato(
                        e.target.value as "ALL" | "DA_FATTURARE" | "FATTURATO" | "SCADUTA"
                      )
                    }
                    style={{
                      minHeight: 40,
                      padding: "0 12px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#111827",
                      fontSize: 14,
                    }}
                  >
                    <option value="ALL">Tutti gli stati</option>
                    <option value="DA_FATTURARE">DA_FATTURARE</option>
                    <option value="FATTURATO">FATTURATO</option>
                    <option value="SCADUTA">SCADUTA</option>
                  </select>
                </div>
              ) : null}
              {loading ? (
                <div style={{ padding: 18, fontSize: 14, color: "#6b7280" }}>Caricamento...</div>
              ) : rows.length === 0 ? (
                <div style={{ padding: 18, fontSize: 14, color: "#6b7280" }}>
                  {isDaFatturare
                    ? "Nessun risultato con i filtri attuali"
                    : isScaduteNonPagate
                      ? "Nessuna voce scaduta non pagata"
                      : "Nessun dato disponibile"}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 0 }}>
                  {rows.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "14px 18px",
                        borderTop: "1px solid #f3f4f6",
                        display: "grid",
                        gap: 6,
                        background:
                          getVisualBillingStato(item) === "SCADUTA" || isScaduteNonPagate ? "#fff5f5" : "#fff",
                        borderLeft:
                          getVisualBillingStato(item) === "SCADUTA" || isScaduteNonPagate
                            ? "4px solid #dc2626"
                            : "4px solid transparent",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>{item.source}</div>
                          {renderBillingStatoBadge(getVisualBillingStato(item))}
                          {item.stato === "FATTURATO" ? renderPaymentStatusBadge(item.paymentStatus || "NON_PAGATO") : null}
                        </div>
                        {item.importo != null ? (
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(item.importo)}</div>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{item.clienteNome}</div>
                      <div style={{ fontSize: 13, color: "#111827" }}>{item.descrizione}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {[item.progettoNome ? `Progetto: ${item.progettoNome}` : null, item.dataCompetenza ? `Competenza: ${formatDate(item.dataCompetenza)}` : null, item.dataScadenza ? `Scadenza: ${formatDate(item.dataScadenza)}` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                      {item.stato !== "FATTURATO" || (item.paymentStatus || "NON_PAGATO") === "NON_PAGATO" ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {item.stato !== "FATTURATO" ? (
                            <button
                              type="button"
                              onClick={() => void markAsFatturata(item)}
                              disabled={savingItemId === item.id}
                              style={{
                                minHeight: 34,
                                padding: "0 12px",
                                borderRadius: 8,
                                border: "1px solid #d1d5db",
                                background: "#fff",
                                color: "#111827",
                                fontWeight: 700,
                                cursor: savingItemId === item.id ? "wait" : "pointer",
                                opacity: savingItemId === item.id ? 0.75 : 1,
                              }}
                            >
                              {savingItemId === item.id ? "Aggiornamento..." : "Segna fatturata"}
                            </button>
                          ) : null}
                          {item.stato === "FATTURATO" && (item.paymentStatus || "NON_PAGATO") === "NON_PAGATO" ? (
                            <button
                              type="button"
                              onClick={() => void markAsPaid(item)}
                              disabled={savingItemId === item.id}
                              style={{
                                minHeight: 34,
                                padding: "0 12px",
                                borderRadius: 8,
                                border: "1px solid #d1d5db",
                                background: "#fff",
                                color: "#111827",
                                fontWeight: 700,
                                cursor: savingItemId === item.id ? "wait" : "pointer",
                                opacity: savingItemId === item.id ? 0.75 : 1,
                              }}
                            >
                              {savingItemId === item.id ? "Aggiornamento..." : "Segna pagata"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
