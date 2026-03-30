"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import { dbFrom } from "@/lib/clientDbBroker";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type DocumentCatalogRow = {
  id: string;
  nome: string;
  target: string;
  categoria: string;
  has_scadenza: boolean;
  validita_mesi: number | null;
  required_default: boolean;
  attivo: boolean;
  sort_order: number | null;
};

function renderBooleanBadge(value: boolean, trueLabel: string, falseLabel: string) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: value ? "#dcfce7" : "#f3f4f6",
        color: value ? "#166534" : "#4b5563",
        whiteSpace: "nowrap",
      }}
    >
      {value ? trueLabel : falseLabel}
    </span>
  );
}

export default function DocumentiPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DocumentCatalogRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);

      const { data, error: loadError } = await dbFrom("document_catalog")
        .select(
          "id,nome,target,categoria,has_scadenza,validita_mesi,required_default,attivo,sort_order"
        )
        .order("sort_order", { ascending: true })
        .order("nome", { ascending: true });

      if (!active) return;

      if (loadError) {
        setRows([]);
        setError(`Errore caricamento catalogo documenti: ${loadError.message}`);
        setLoading(false);
        return;
      }

      setRows(
        (((data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
          id: String(row.id || ""),
          nome: String(row.nome || ""),
          target: String(row.target || ""),
          categoria: String(row.categoria || ""),
          has_scadenza: row.has_scadenza !== false,
          validita_mesi:
            typeof row.validita_mesi === "number"
              ? row.validita_mesi
              : row.validita_mesi == null || row.validita_mesi === ""
                ? null
                : Number(row.validita_mesi),
          required_default: row.required_default === true,
          attivo: row.attivo !== false,
          sort_order:
            typeof row.sort_order === "number"
              ? row.sort_order
              : row.sort_order == null || row.sort_order === ""
                ? null
                : Number(row.sort_order),
        }))
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: 1280, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Documenti</h1>
          <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
            Catalogo documenti e corsi usato come base del sistema.
          </div>
        </div>
        <Link
          href="/impostazioni"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            color: "inherit",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← Impostazioni
        </Link>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 16,
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
          marginTop: 18,
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
            gridTemplateColumns:
              "minmax(220px,1.4fr) 120px 150px 130px 120px 130px 100px 90px",
            gap: 12,
            padding: "14px 16px",
            fontSize: 12,
            fontWeight: 800,
            color: "#374151",
            background: "#f8fafc",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div>Nome</div>
          <div>Target</div>
          <div>Categoria</div>
          <div>Scadenza</div>
          <div>Validita mesi</div>
          <div>Required default</div>
          <div>Attivo</div>
          <div>Ordine</div>
        </div>

        {loading ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Caricamento...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Nessun documento presente nel catalogo.</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(220px,1.4fr) 120px 150px 130px 120px 130px 100px 90px",
                gap: 12,
                padding: "14px 16px",
                fontSize: 14,
                borderBottom: "1px solid #f3f4f6",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>{row.nome || "—"}</div>
              <div>{row.target || "—"}</div>
              <div>{row.categoria || "—"}</div>
              <div>{renderBooleanBadge(row.has_scadenza, "SI", "NO")}</div>
              <div>{row.validita_mesi == null ? "—" : row.validita_mesi}</div>
              <div>{renderBooleanBadge(row.required_default, "SI", "NO")}</div>
              <div>{renderBooleanBadge(row.attivo, "SI", "NO")}</div>
              <div>{row.sort_order == null ? "—" : row.sort_order}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
