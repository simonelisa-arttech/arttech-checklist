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
  checklist?: {
    id: string;
    nome_checklist: string | null;
  } | null;
};

const sectionTitles = ["DA FATTURARE", "EMESSE", "SCADUTE NON PAGATE", "PAGATE"] as const;

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

export default function FatturazioneGlobalePage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BillingItem[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: rechargeData, error: rechargeError } = await dbFrom("sim_recharges")
          .select("id, sim_id, data_ricarica, importo, billing_status, note")
          .eq("billing_status", "DA_FATTURARE")
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
            stato: "DA_FATTURARE",
            dataCompetenza: row.data_ricarica || undefined,
            riferimentoId: row.id,
          };
        });

        const { data: interventiData, error: interventiError } = await supabase
          .from("saas_interventi")
          .select(
            "id, cliente, checklist_id, ticket_no, data, descrizione, incluso, fatturazione_stato, esito_fatturazione, created_at, checklist:checklists(id, nome_checklist)"
          )
          .order("data", { ascending: false });

        if (interventiError) {
          throw new Error(`Errore caricamento interventi: ${interventiError.message}`);
        }

        const interventiItems: BillingItem[] = (((interventiData as any[]) || []) as InterventoBillingRow[])
          .filter((row) => getCanonicalInterventoEsitoFatturazione(row) === "DA_FATTURARE")
          .map((row) => ({
            id: `INTERVENTO:${row.id}`,
            source: "INTERVENTO",
            clienteNome: String(row.cliente || "—"),
            progettoNome: row.checklist?.nome_checklist || undefined,
            descrizione: buildInterventoDescription(row),
            stato: "DA_FATTURARE",
            dataCompetenza: String(row.data || row.created_at || "") || undefined,
            riferimentoId: row.id,
          }));

        const nextItems = [...simItems, ...interventiItems].sort((a, b) => {
          const byStatus = getBillingStatoPriority(b.stato) - getBillingStatoPriority(a.stato);
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

  const daFatturareItems = useMemo(
    () => items.filter((item) => item.stato === "DA_FATTURARE"),
    [items]
  );

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
          const rows = isDaFatturare ? daFatturareItems : [];
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
              {loading ? (
                <div style={{ padding: 18, fontSize: 14, color: "#6b7280" }}>Caricamento...</div>
              ) : rows.length === 0 ? (
                <div style={{ padding: 18, fontSize: 14, color: "#6b7280" }}>Nessun dato disponibile</div>
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
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>{item.source}</div>
                        {item.importo != null ? (
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(item.importo)}</div>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{item.clienteNome}</div>
                      <div style={{ fontSize: 13, color: "#111827" }}>{item.descrizione}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {[item.progettoNome ? `Progetto: ${item.progettoNome}` : null, item.dataCompetenza ? `Competenza: ${formatDate(item.dataCompetenza)}` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
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
