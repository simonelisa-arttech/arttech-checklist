"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { dbFrom } from "@/lib/clientDbBroker";

type AziendaRow = {
  id: string;
  ragione_sociale: string;
};

type PersonaleRow = {
  id: string;
  nome: string;
  cognome: string;
  azienda_id: string;
};

type PersonaleDocumentoRow = {
  id: string;
  personale_id: string;
  tipo_documento: string;
  data_scadenza: string;
  giorni_preavviso: string;
};

type AziendaDocumentoRow = {
  id: string;
  azienda_id: string;
  tipo_documento: string;
  data_scadenza: string;
  giorni_preavviso: string;
};

type SimCardRow = {
  id: string;
  numero_telefono: string;
  intestatario: string;
  piano_attivo: string;
  operatore: string;
  data_scadenza: string;
  giorni_preavviso: string;
  attiva: boolean;
};

type UnifiedScadenzaRow = {
  id: string;
  tipo: "PERSONALE" | "AZIENDA" | "SIM";
  nome: string;
  tipo_documento: string;
  data_scadenza: string;
  giorni_delta: number;
  stato_scadenza: "SCADUTO" | "IN_SCADENZA";
  href: string;
};

function parseDateOnly(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDocumentoScadenzaState(doc: { data_scadenza: string; giorni_preavviso: string }) {
  const expiry = parseDateOnly(doc.data_scadenza);
  if (!expiry) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { stato_scadenza: "SCADUTO" as const, giorni_delta: diffDays };
  }

  const preavvisoRaw = String(doc.giorni_preavviso || "").trim();
  const preavviso = preavvisoRaw ? Number(preavvisoRaw) : 30;
  if (Number.isFinite(preavviso) && diffDays <= preavviso) {
    return { stato_scadenza: "IN_SCADENZA" as const, giorni_delta: diffDays };
  }

  return null;
}

function formatDate(value?: string | null) {
  const date = parseDateOnly(value);
  if (!date) return "—";
  return date.toLocaleDateString("it-IT");
}

function renderBadge(stato: "SCADUTO" | "IN_SCADENZA") {
  const isScaduto = stato === "SCADUTO";
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
      {stato === "SCADUTO" ? "SCADUTO" : "IN SCADENZA"}
    </span>
  );
}

export default function ScadenzePage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<UnifiedScadenzaRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);

      const [
        aziendeRes,
        personeRes,
        personaleDocumentiRes,
        aziendeDocumentiRes,
        simCardsRes,
      ] = await Promise.all([
        dbFrom("aziende").select("id,ragione_sociale").order("ragione_sociale", { ascending: true }),
        dbFrom("personale")
          .select("id,nome,cognome,azienda_id")
          .order("cognome", { ascending: true })
          .order("nome", { ascending: true }),
        dbFrom("personale_documenti")
          .select("id,personale_id,tipo_documento,data_scadenza,giorni_preavviso")
          .order("data_scadenza", { ascending: true }),
        dbFrom("aziende_documenti")
          .select("id,azienda_id,tipo_documento,data_scadenza,giorni_preavviso")
          .order("data_scadenza", { ascending: true }),
        dbFrom("sim_cards")
          .select("id,numero_telefono,intestatario,piano_attivo,operatore,data_scadenza,giorni_preavviso,attiva")
          .order("data_scadenza", { ascending: true }),
      ]);

      if (!active) return;

      const errors: string[] = [];
      if (aziendeRes.error) errors.push(`Errore caricamento aziende: ${aziendeRes.error.message}`);
      if (personeRes.error) errors.push(`Errore caricamento personale: ${personeRes.error.message}`);
      if (personaleDocumentiRes.error) {
        errors.push(`Errore caricamento documenti personale: ${personaleDocumentiRes.error.message}`);
      }
      if (aziendeDocumentiRes.error) {
        errors.push(`Errore caricamento documenti aziende: ${aziendeDocumentiRes.error.message}`);
      }
      if (simCardsRes.error) {
        errors.push(`Errore caricamento SIM: ${simCardsRes.error.message}`);
      }
      if (errors.length > 0) {
        setError(errors.join(" • "));
        setRows([]);
        setLoading(false);
        return;
      }

      const aziende = (((aziendeRes.data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
        id: String(row.id || ""),
        ragione_sociale: String(row.ragione_sociale || ""),
      })) as AziendaRow[];

      const personale = (((personeRes.data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
        id: String(row.id || ""),
        nome: String(row.nome || ""),
        cognome: String(row.cognome || ""),
        azienda_id: String(row.azienda_id || ""),
      })) as PersonaleRow[];

      const personaleDocumenti = (((personaleDocumentiRes.data as any[]) || []) as Array<Record<string, any>>).map(
        (row) => ({
          id: String(row.id || ""),
          personale_id: String(row.personale_id || ""),
          tipo_documento: String(row.tipo_documento || ""),
          data_scadenza: String(row.data_scadenza || ""),
          giorni_preavviso:
            row.giorni_preavviso == null || row.giorni_preavviso === ""
              ? ""
              : String(row.giorni_preavviso),
        })
      ) as PersonaleDocumentoRow[];

      const aziendeDocumenti = (((aziendeDocumentiRes.data as any[]) || []) as Array<Record<string, any>>).map(
        (row) => ({
          id: String(row.id || ""),
          azienda_id: String(row.azienda_id || ""),
          tipo_documento: String(row.tipo_documento || ""),
          data_scadenza: String(row.data_scadenza || ""),
          giorni_preavviso:
            row.giorni_preavviso == null || row.giorni_preavviso === ""
              ? ""
              : String(row.giorni_preavviso),
        })
      ) as AziendaDocumentoRow[];

      const simCards = (((simCardsRes.data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
        id: String(row.id || ""),
        numero_telefono: String(row.numero_telefono || ""),
        intestatario: String(row.intestatario || ""),
        piano_attivo: String(row.piano_attivo || ""),
        operatore: String(row.operatore || ""),
        data_scadenza: String(row.data_scadenza || ""),
        giorni_preavviso:
          row.giorni_preavviso == null || row.giorni_preavviso === ""
            ? ""
            : String(row.giorni_preavviso),
        attiva: row.attiva !== false,
      })) as SimCardRow[];

      const aziendaById = new Map(aziende.map((row) => [row.id, row.ragione_sociale]));
      const personaById = new Map(
        personale.map((row) => [
          row.id,
          {
            nomeCompleto: `${row.cognome} ${row.nome}`.trim(),
            aziendaNome: aziendaById.get(row.azienda_id) || "",
          },
        ])
      );

      const unifiedRows: UnifiedScadenzaRow[] = [];

      for (const doc of personaleDocumenti) {
        const scadenza = getDocumentoScadenzaState(doc);
        if (!scadenza) continue;
        const persona = personaById.get(doc.personale_id);
        unifiedRows.push({
          id: doc.id,
          tipo: "PERSONALE",
          nome: persona?.nomeCompleto || "—",
          tipo_documento: doc.tipo_documento || "—",
          data_scadenza: doc.data_scadenza,
          giorni_delta: scadenza.giorni_delta,
          stato_scadenza: scadenza.stato_scadenza,
          href: "/impostazioni/personale?filter=scadenze",
        });
      }

      for (const doc of aziendeDocumenti) {
        const scadenza = getDocumentoScadenzaState(doc);
        if (!scadenza) continue;
        unifiedRows.push({
          id: doc.id,
          tipo: "AZIENDA",
          nome: aziendaById.get(doc.azienda_id) || "—",
          tipo_documento: doc.tipo_documento || "—",
          data_scadenza: doc.data_scadenza,
          giorni_delta: scadenza.giorni_delta,
          stato_scadenza: scadenza.stato_scadenza,
          href: "/impostazioni/aziende?filter=scadenze",
        });
      }

      for (const sim of simCards) {
        if (!sim.attiva || !sim.data_scadenza) continue;
        const scadenza = getDocumentoScadenzaState(sim);
        if (!scadenza) continue;
        unifiedRows.push({
          id: sim.id,
          tipo: "SIM",
          nome: sim.numero_telefono || sim.intestatario || "—",
          tipo_documento: sim.operatore || sim.piano_attivo || "—",
          data_scadenza: sim.data_scadenza,
          giorni_delta: scadenza.giorni_delta,
          stato_scadenza: scadenza.stato_scadenza,
          href: "/sim",
        });
      }

      unifiedRows.sort((left, right) => {
        if (left.stato_scadenza !== right.stato_scadenza) {
          return left.stato_scadenza === "SCADUTO" ? -1 : 1;
        }
        return left.giorni_delta - right.giorni_delta;
      });

      setRows(unifiedRows);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const scaduti = rows.filter((row) => row.stato_scadenza === "SCADUTO").length;
    const inScadenza = rows.filter((row) => row.stato_scadenza === "IN_SCADENZA").length;
    return { scaduti, inScadenza };
  }, [rows]);

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px 48px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Scadenze documenti e corsi</h1>
          <div style={{ marginTop: 6, fontSize: 14, color: "#6b7280" }}>
            SCADUTI: {summary.scaduti} · IN SCADENZA: {summary.inScadenza}
          </div>
        </div>
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
          style={{
            display: "grid",
            gridTemplateColumns: "120px minmax(220px, 1.2fr) minmax(220px, 1fr) 140px 160px",
            gap: 12,
            padding: "14px 16px",
            fontSize: 12,
            fontWeight: 800,
            color: "#374151",
            background: "#f8fafc",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div>Tipo</div>
          <div>Nome</div>
          <div>Documento</div>
          <div>Scadenza</div>
          <div>Stato</div>
        </div>

        {loading ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Caricamento...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Nessuna scadenza rilevata.</div>
        ) : (
          rows.map((row) => {
            const isScaduto = row.stato_scadenza === "SCADUTO";
            return (
              <button
                key={`${row.tipo}-${row.id}`}
                type="button"
                onClick={() => router.push(row.href)}
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "120px minmax(220px, 1.2fr) minmax(220px, 1fr) 140px 160px",
                  gap: 12,
                  padding: "14px 16px",
                  border: "none",
                  borderBottom: "1px solid #f3f4f6",
                  background: isScaduto ? "#fff7f7" : "#fffaf5",
                  cursor: "pointer",
                  textAlign: "left",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>{row.tipo}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{row.nome}</div>
                <div style={{ fontSize: 14, color: "#374151" }}>{row.tipo_documento}</div>
                <div style={{ fontSize: 14, color: "#374151" }}>{formatDate(row.data_scadenza)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {renderBadge(row.stato_scadenza)}
                  <span style={{ fontSize: 12, color: isScaduto ? "#b91c1c" : "#ea580c", fontWeight: 700 }}>
                    {isScaduto
                      ? `scaduto da ${Math.abs(row.giorni_delta)} giorni`
                      : row.giorni_delta === 0
                        ? "scade oggi"
                        : `scade tra ${row.giorni_delta} giorni`}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
