"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ClienteModal, { ClienteRecord } from "@/components/ClienteModal";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

const PAGE_SIZE = 50;

export default function ClientiPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<ClienteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClienteRecord | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setDebounced(query.trim());
      setOffset(0);
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debounced) params.set("q", debounced);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));
        const res = await fetch(`/api/clienti?${params.toString()}`);
        const json = await res.json();
        if (!active) return;
        if (res.ok && json?.ok) {
          const data = (json.data || []) as ClienteRecord[];
          setHasMore(data.length === PAGE_SIZE);
          setRows(offset === 0 ? data : [...rows, ...data]);
        } else {
          setRows(offset === 0 ? [] : rows);
          setHasMore(false);
        }
      } catch {
        if (!active) return;
        setRows(offset === 0 ? [] : rows);
        setHasMore(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [debounced, offset]);

  const countLabel = useMemo(() => {
    return loading ? "Caricamento..." : `Totale caricati: ${rows.length}`;
  }, [loading, rows.length]);

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>CLIENTI</div>
        </div>
        <Link
          href="/"
          style={{
            marginLeft: "auto",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ← Dashboard
        </Link>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca cliente, p.iva, CF, codice interno..."
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
        >
          + Nuovo cliente
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>{countLabel}</div>

      <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.7 }}>
              <th style={{ padding: "10px 12px" }}>Denominazione</th>
              <th style={{ padding: "10px 12px" }}>Codice interno</th>
              <th style={{ padding: "10px 12px" }}>Comune</th>
              <th style={{ padding: "10px 12px" }}>Prov.</th>
              <th style={{ padding: "10px 12px" }}>P.IVA</th>
              <th style={{ padding: "10px 12px" }}>Codice fiscale</th>
              <th style={{ padding: "10px 12px" }}>Email</th>
              <th style={{ padding: "10px 12px" }}>Telefono</th>
              <th style={{ padding: "10px 12px" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={9} style={{ padding: 14, textAlign: "center" }}>
                  Nessun cliente trovato
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #f1f1f1" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                  {row.denominazione}
                </td>
                <td style={{ padding: "10px 12px" }}>{row.codice_interno || "—"}</td>
                <td style={{ padding: "10px 12px" }}>{row.comune || "—"}</td>
                <td style={{ padding: "10px 12px" }}>{row.provincia || "—"}</td>
                <td style={{ padding: "10px 12px" }}>{row.piva || "—"}</td>
                <td style={{ padding: "10px 12px" }}>{row.codice_fiscale || "—"}</td>
                <td style={{ padding: "10px 12px" }}>{row.email || "—"}</td>
                <td style={{ padding: "10px 12px" }}>{row.telefono || "—"}</td>
                <td style={{ padding: "10px 12px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(row);
                      setModalOpen(true);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    Modifica
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            disabled={loading}
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
            }}
          >
            {loading ? "Caricamento..." : "Carica altri"}
          </button>
        </div>
      )}

      <ClienteModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={(cliente) => {
          setRows((prev) => {
            const exists = prev.find((r) => r.id === cliente.id);
            if (exists) {
              return prev.map((r) => (r.id === cliente.id ? { ...r, ...cliente } : r));
            }
            return [cliente, ...prev];
          });
        }}
      />
    </div>
  );
}
