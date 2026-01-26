"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type OperatoreRow = {
  id: string;
  nome: string | null;
  ruolo: string | null;
  attivo: boolean | null;
  alert_enabled: boolean | null;
};

type InterventoRow = {
  id: string;
  cliente: string | null;
  checklist_id: string | null;
  data: string | null;
  proforma: string | null;
  codice_magazzino: string | null;
  note: string | null;
  stato_intervento: string | null;
  esito_fatturazione: string | null;
  fatturazione_stato: string | null;
  alert_fattura_last_sent_at: string | null;
};

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

function isFatturaDaEmettere(i: InterventoRow) {
  return getInterventoStato(i) === "CHIUSO" && getEsitoFatturazione(i) === "DA_FATTURARE";
}

function buildMessage(cliente: string, list: InterventoRow[]) {
  const link = `/clienti/${encodeURIComponent(cliente)}`;
  const lines = list.map((i) => {
    const dataLabel = i.data ? new Date(i.data).toLocaleDateString() : "—";
    const proforma = i.proforma || "—";
    const codice = i.codice_magazzino || "—";
    const note = i.note ? ` — ${i.note}` : "";
    return `${dataLabel} | ${proforma} | ${codice}${note}`;
  });
  return [
    `Cliente: ${cliente}`,
    `Interventi da fatturare: ${list.length}`,
    ...lines,
    `Link: ${link}`,
  ].join("\n");
}

export default function AlertFatturePage() {
  const [operatori, setOperatori] = useState<OperatoreRow[]>([]);
  const [currentOperatoreId, setCurrentOperatoreId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem("current_operatore_id") : null;
    if (stored) setCurrentOperatoreId(stored);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from("operatori")
        .select("id, nome, ruolo, attivo, alert_enabled");
      if (err) {
        setError("Errore caricamento operatori: " + err.message);
        return;
      }
      setOperatori((data || []) as OperatoreRow[]);
    })();
  }, []);

  function getRecipients() {
    const active = operatori.filter((o) => o.attivo !== false && o.alert_enabled);
    const filtered = active.filter((o) =>
      ["AMMINISTRAZIONE", "SUPERVISORE"].includes(String(o.ruolo || "").toUpperCase())
    );
    return filtered.length > 0 ? filtered : active;
  }

  async function runJob() {
    setRunning(true);
    setInfo(null);
    setError(null);

    const recipients = getRecipients();
    if (recipients.length === 0) {
      setError("Nessun destinatario abilitato per alert fatturazione.");
      setRunning(false);
      return;
    }

    const { data: rows, error: err } = await supabase
      .from("saas_interventi")
      .select(
        "id, cliente, checklist_id, data, proforma, codice_magazzino, note, stato_intervento, esito_fatturazione, fatturazione_stato, alert_fattura_last_sent_at"
      );

    if (err) {
      setError("Errore caricamento interventi: " + err.message);
      setRunning(false);
      return;
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const due = (rows || []).filter((i: InterventoRow) => {
      if (!isFatturaDaEmettere(i)) return false;
      if (!i.alert_fattura_last_sent_at) return true;
      const last = new Date(i.alert_fattura_last_sent_at);
      return Number.isFinite(last.getTime()) && last < cutoff;
    });

    if (due.length === 0) {
      setInfo("Nessun intervento da fatturare da inviare.");
      setRunning(false);
      return;
    }

    const byCliente = new Map<string, InterventoRow[]>();
    for (const i of due) {
      const key = String(i.cliente || "—");
      if (!byCliente.has(key)) byCliente.set(key, []);
      byCliente.get(key)!.push(i);
    }

    const payloads: any[] = [];
    byCliente.forEach((list, cliente) => {
      const messaggio = buildMessage(cliente, list);
      const checklistId = list[0]?.checklist_id ?? null;
      for (const r of recipients) {
        payloads.push({
          checklist_id: checklistId,
          intervento_id: null,
          to_operatore_id: r.id,
          messaggio,
          canale: "fatturazione_auto",
        });
      }
    });

    if (payloads.length === 0) {
      setInfo("Nessun alert da inviare.");
      setRunning(false);
      return;
    }

    const { error: insErr } = await supabase.from("checklist_alert_log").insert(payloads);
    if (insErr) {
      setError("Errore inserimento alert: " + insErr.message);
      setRunning(false);
      return;
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("saas_interventi")
      .update({
        alert_fattura_last_sent_at: nowIso,
        alert_fattura_last_sent_by: currentOperatoreId ?? null,
      })
      .in(
        "id",
        due.map((i) => i.id)
      );

    if (updErr) {
      setError("Alert inviati ma errore aggiornamento timestamp: " + updErr.message);
    } else {
      setInfo(`Alert inviati: ${due.length} interventi`);
    }

    setRunning(false);
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Alert fatture</h1>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Esecuzione manuale job fatture da emettere</div>
        </div>
        <Link
          href="/impostazioni"
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "#111",
            fontSize: 12,
          }}
        >
          Indietro
        </Link>
      </div>

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}
      {info && <div style={{ marginTop: 12, color: "#166534" }}>{info}</div>}

      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={runJob}
          disabled={running}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #111",
            background: running ? "#e5e7eb" : "#111",
            color: running ? "#111" : "white",
            cursor: running ? "default" : "pointer",
          }}
        >
          {running ? "Esecuzione..." : "Esegui job adesso"}
        </button>
      </div>
    </div>
  );
}
