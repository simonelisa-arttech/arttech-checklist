"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ClienteModal, { ClienteRecord } from "@/components/ClienteModal";
import ConfigMancante from "@/components/ConfigMancante";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

const PAGE_SIZE = 50;
const menuItemStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "none",
  background: "white",
  textAlign: "left",
  fontSize: 13,
  cursor: "pointer",
};

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
  const [includeInactive, setIncludeInactive] = useState(false);
  const [portalAccessByClienteId, setPortalAccessByClienteId] = useState<
    Record<string, { id?: string; email: string | null; attivo: boolean }>
  >({});
  const [portalActionKey, setPortalActionKey] = useState<string | null>(null);
  const [openActionsClienteId, setOpenActionsClienteId] = useState<string | null>(null);
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
        if (includeInactive) params.set("include_inactive", "1");
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
  }, [debounced, offset, includeInactive]);

  useEffect(() => {
    let active = true;
    const clienteIds = rows
      .map((row) => String(row.id || "").trim())
      .filter(Boolean);

    if (clienteIds.length === 0) {
      setPortalAccessByClienteId({});
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const params = new URLSearchParams();
        params.set("cliente_ids", clienteIds.join(","));
        const res = await fetch(`/api/clienti/portal-access?${params.toString()}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!active || !res.ok || !json?.ok) return;
        const nextMap: Record<string, { id?: string; email: string | null; attivo: boolean }> = {};
        for (const row of (json.data || []) as Array<any>) {
          const key = String(row?.cliente_id || "").trim();
          if (!key) continue;
          nextMap[key] = {
            id: row?.id ? String(row.id) : undefined,
            email: row?.email ? String(row.email) : null,
            attivo: row?.attivo !== false,
          };
        }
        setPortalAccessByClienteId(nextMap);
      } catch {
        if (!active) return;
      }
    })();

    return () => {
      active = false;
    };
  }, [rows]);

  useEffect(() => {
    if (!openActionsClienteId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-actions-root="cliente-actions"]')) return;
      setOpenActionsClienteId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [openActionsClienteId]);

  const countLabel = useMemo(() => {
    return loading ? "Caricamento..." : `Totale caricati: ${rows.length}`;
  }, [loading, rows.length]);

  return (
    <div style={{ maxWidth: 1320, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34 }}>AT SYSTEM</h1>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>ANAGRAFICA CLIENTI</div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca cliente, p.iva, CF, codice interno..."
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Mostra disattivi
        </label>
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

      <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 1240, borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "28%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.7 }}>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Denominazione</th>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Codice interno</th>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Comune</th>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Prov.</th>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>P.IVA</th>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Codice fiscale</th>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Email</th>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Telefono</th>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Stato</th>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={10} style={{ padding: 14, textAlign: "center" }}>
                  Nessun cliente trovato
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #f1f1f1" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600, verticalAlign: "top", wordBreak: "break-word" }}>
                  {row.denominazione}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", wordBreak: "break-word" }}>{row.codice_interno || "—"}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", wordBreak: "break-word" }}>{row.comune || "—"}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>{row.provincia || "—"}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", wordBreak: "break-word" }}>{row.piva || "—"}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", wordBreak: "break-word" }}>{row.codice_fiscale || "—"}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", wordBreak: "break-word" }}>{row.email || "—"}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", wordBreak: "break-word" }}>{row.telefono || "—"}</td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                  {row.attivo === false ? "Disattivo" : "Attivo"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                  <div style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.4 }}>
                    {(() => {
                      const portalAccess = portalAccessByClienteId[String(row.id || "")];
                      if (portalAccess?.attivo) {
                        return (
                          <span style={{ color: "#166534", fontWeight: 700 }}>
                            Accesso attivo
                            {portalAccess.email ? ` · ${portalAccess.email}` : ""}
                          </span>
                        );
                      }
                      if (portalAccess) {
                        return (
                          <span style={{ color: "#92400e", fontWeight: 700 }}>
                            Accesso presente
                          </span>
                        );
                      }
                      return (
                        <span style={{ color: "#64748b", fontWeight: 700 }}>
                          Accesso non creato
                        </span>
                      );
                    })()}
                  </div>
                  <div
                    data-actions-root="cliente-actions"
                    style={{ position: "relative", display: "inline-block" }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenActionsClienteId((prev) =>
                          prev === String(row.id || "") ? null : String(row.id || "")
                        )
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        background: "white",
                        cursor: "pointer",
                        minWidth: 82,
                      }}
                    >
                      Azioni
                    </button>
                    {openActionsClienteId === String(row.id || "") ? (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          right: 0,
                          zIndex: 20,
                          minWidth: 220,
                          background: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
                          padding: 6,
                          display: "grid",
                          gap: 4,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionsClienteId(null);
                            setEditing(row);
                            setModalOpen(true);
                          }}
                          style={menuItemStyle}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setOpenActionsClienteId(null);
                            const res = await fetch("/api/clienti", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: row.id,
                                attivo: row.attivo === false ? true : false,
                              }),
                            });
                            const json = await res.json();
                            if (!res.ok || !json?.ok) {
                              alert(json?.error || "Errore aggiornamento stato cliente");
                              return;
                            }
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, ...json.data } : r))
                            );
                          }}
                          style={menuItemStyle}
                        >
                          {row.attivo === false ? "Riattiva" : "Disattiva"}
                        </button>
                        {!portalAccessByClienteId[String(row.id || "")]?.attivo ? (
                          <button
                            type="button"
                            disabled={portalActionKey === `create:${String(row.id || "")}`}
                            onClick={async () => {
                              try {
                                setOpenActionsClienteId(null);
                                setPortalActionKey(`create:${String(row.id || "")}`);
                                const res = await fetch("/api/clienti/portal-access", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  credentials: "include",
                                  body: JSON.stringify({ cliente_id: row.id }),
                                });
                                const json = await res.json().catch(() => ({}));
                                if (!res.ok || !json?.ok) {
                                  alert(json?.error || "Errore creazione credenziali cliente");
                                  return;
                                }

                                setPortalAccessByClienteId((prev) => ({
                                  ...prev,
                                  [String(row.id || "")]: {
                                    id: json?.accesso?.id ? String(json.accesso.id) : undefined,
                                    email: String(json?.credenziali?.email || row.email || "").trim() || null,
                                    attivo: true,
                                  },
                                }));

                                alert(
                                  [
                                    "Credenziali area cliente create.",
                                    `Email: ${String(json?.credenziali?.email || row.email || "—")}`,
                                    `Password temporanea: ${String(json?.credenziali?.password_temporanea || "—")}`,
                                  ].join("\n")
                                );
                              } finally {
                                setPortalActionKey(null);
                              }
                            }}
                            style={menuItemStyle}
                          >
                            {portalActionKey === `create:${String(row.id || "")}`
                              ? "Creazione..."
                              : "Crea credenziali area cliente"}
                          </button>
                        ) : null}
                        {portalAccessByClienteId[String(row.id || "")] ? (
                          <button
                            type="button"
                            disabled={portalActionKey === `reset:${String(row.id || "")}`}
                            onClick={async () => {
                              try {
                                setOpenActionsClienteId(null);
                                setPortalActionKey(`reset:${String(row.id || "")}`);
                                const res = await fetch("/api/clienti/portal-access", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  credentials: "include",
                                  body: JSON.stringify({
                                    cliente_id: row.id,
                                    action: "reset_password",
                                  }),
                                });
                                const json = await res.json().catch(() => ({}));
                                if (!res.ok || !json?.ok) {
                                  alert(json?.error || "Errore rigenerazione password cliente");
                                  return;
                                }
                                alert(
                                  [
                                    "Password temporanea rigenerata.",
                                    `Email: ${String(json?.credenziali?.email || row.email || "—")}`,
                                    `Password temporanea: ${String(json?.credenziali?.password_temporanea || "—")}`,
                                  ].join("\n")
                                );
                              } finally {
                                setPortalActionKey(null);
                              }
                            }}
                            style={menuItemStyle}
                          >
                            {portalActionKey === `reset:${String(row.id || "")}`
                              ? "Rigenero..."
                              : "Rigenera password"}
                          </button>
                        ) : null}
                        {portalAccessByClienteId[String(row.id || "")]?.attivo ? (
                          <button
                            type="button"
                            disabled={portalActionKey === `deactivate:${String(row.id || "")}`}
                            onClick={async () => {
                              try {
                                setOpenActionsClienteId(null);
                                setPortalActionKey(`deactivate:${String(row.id || "")}`);
                                const res = await fetch("/api/clienti/portal-access", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  credentials: "include",
                                  body: JSON.stringify({
                                    cliente_id: row.id,
                                    action: "deactivate",
                                  }),
                                });
                                const json = await res.json().catch(() => ({}));
                                if (!res.ok || !json?.ok) {
                                  alert(json?.error || "Errore disattivazione accesso cliente");
                                  return;
                                }
                                setPortalAccessByClienteId((prev) => ({
                                  ...prev,
                                  [String(row.id || "")]: {
                                    id: json?.accesso?.id
                                      ? String(json.accesso.id)
                                      : prev[String(row.id || "")]?.id,
                                    email:
                                      String(
                                        json?.accesso?.email || prev[String(row.id || "")]?.email || ""
                                      ).trim() || null,
                                    attivo: false,
                                  },
                                }));
                              } finally {
                                setPortalActionKey(null);
                              }
                            }}
                            style={menuItemStyle}
                          >
                            {portalActionKey === `deactivate:${String(row.id || "")}`
                              ? "Disattivo accesso..."
                              : "Disattiva accesso"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
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
        onDeleted={(clienteId) => {
          setRows((prev) => prev.filter((r) => r.id !== clienteId));
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
