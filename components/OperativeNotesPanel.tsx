"use client";

import { useEffect, useMemo, useState } from "react";

type OperativeRowKind = "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO";

type OperativeNotesItem = {
  rowKind: OperativeRowKind;
  rowRefId: string;
  label: string;
};

type CronoMeta = {
  data_inizio?: string | null;
  durata_giorni?: number | null;
  personale_previsto?: string | null;
  mezzi?: string | null;
  descrizione_attivita?: string | null;
  indirizzo?: string | null;
  orario?: string | null;
  referente_cliente_nome?: string | null;
  referente_cliente_contatto?: string | null;
  commerciale_art_tech_nome?: string | null;
  commerciale_art_tech_contatto?: string | null;
  updated_at?: string | null;
  updated_by_nome?: string | null;
};

type CronoComment = {
  id: string;
  commento: string;
  created_at: string | null;
  created_by_nome: string | null;
};

type Props = {
  items: OperativeNotesItem[];
  compact?: boolean;
  title?: string | null;
  authReady?: boolean;
};

function rowKey(rowKind: OperativeRowKind, rowRefId: string) {
  return `${rowKind}:${rowRefId}`;
}

function normalizePreviewText(value?: string | null) {
  const raw = String(value || "")
    .replace(/[\u200B-\u200D\u2060\u00A0]/g, " ")
    .trim();
  if (!raw) return "";
  return raw.replace(/\s+/g, " ");
}

function normalizeOperativeNotesError(message: unknown, fallback: string) {
  const raw = String(message || "").trim();
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  if (normalized === "unauthorized" || normalized === "no auth cookie") {
    return fallback;
  }
  return raw;
}

async function fetchCronoprogramma(body: Record<string, unknown>) {
  const run = () =>
    fetch("/api/cronoprogramma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify(body),
    });

  let res = await run();
  if (res.status === 401) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    res = await run();
  }
  return res;
}

export default function OperativeNotesPanel({
  items,
  compact = false,
  title,
  authReady = true,
}: Props) {
  const normalizedItems = useMemo(
    () =>
      items.filter((item) => String(item.rowRefId || "").trim()).map((item) => ({
        ...item,
        rowRefId: String(item.rowRefId || "").trim(),
      })),
    [items]
  );
  const itemsKey = normalizedItems.map((item) => rowKey(item.rowKind, item.rowRefId)).join("|");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaByKey, setMetaByKey] = useState<Record<string, CronoMeta>>({});
  const [commentsByKey, setCommentsByKey] = useState<Record<string, CronoComment[]>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [noteDraftByKey, setNoteDraftByKey] = useState<Record<string, string>>({});
  const [commentDraftByKey, setCommentDraftByKey] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [commentSavingKey, setCommentSavingKey] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [authGateTimedOut, setAuthGateTimedOut] = useState(false);

  useEffect(() => {
    if (authReady) {
      setAuthGateTimedOut(false);
      return;
    }
    const timeout = setTimeout(() => setAuthGateTimedOut(true), 1200);
    return () => clearTimeout(timeout);
  }, [authReady]);

  const canLoad = authReady || authGateTimedOut;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!canLoad) {
        if (!cancelled) {
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (normalizedItems.length === 0) {
        if (!cancelled) {
          setMetaByKey({});
          setCommentsByKey({});
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetchCronoprogramma({
          action: "load",
          rows: normalizedItems.map((item) => ({
            row_kind: item.rowKind,
            row_ref_id: item.rowRefId,
          })),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            normalizeOperativeNotesError(data?.error, "Errore caricamento note operative")
          );
        }
        if (cancelled) return;
        setMetaByKey((data?.meta || {}) as Record<string, CronoMeta>);
        setCommentsByKey((data?.comments || {}) as Record<string, CronoComment[]>);
      } catch (err: any) {
        if (!cancelled) {
          setError(
            normalizeOperativeNotesError(err?.message, "Errore caricamento note operative")
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [canLoad, itemsKey]);

  async function saveNote(item: OperativeNotesItem) {
    const key = rowKey(item.rowKind, item.rowRefId);
    const meta = metaByKey[key] || {};
    const descrizione_attivita = String(noteDraftByKey[key] ?? meta.descrizione_attivita ?? "").trim();
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetchCronoprogramma({
        action: "set_operativi",
        row_kind: item.rowKind,
        row_ref_id: item.rowRefId,
        data_inizio: meta.data_inizio || "",
        durata_giorni: meta.durata_giorni || "",
        personale_previsto: meta.personale_previsto || "",
        mezzi: meta.mezzi || "",
        descrizione_attivita,
        indirizzo: meta.indirizzo || "",
        orario: meta.orario || "",
        referente_cliente_nome: meta.referente_cliente_nome || "",
        referente_cliente_contatto: meta.referente_cliente_contatto || "",
        commerciale_art_tech_nome: meta.commerciale_art_tech_nome || "",
        commerciale_art_tech_contatto: meta.commerciale_art_tech_contatto || "",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          normalizeOperativeNotesError(data?.error, "Errore salvataggio nota operativa")
        );
      }
      setMetaByKey((prev) => ({ ...prev, [key]: (data?.meta || null) as CronoMeta }));
      setNoteDraftByKey((prev) => ({ ...prev, [key]: descrizione_attivita }));
      setEditingKey(null);
    } catch (err: any) {
      setError(
        normalizeOperativeNotesError(err?.message, "Errore salvataggio nota operativa")
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function addComment(item: OperativeNotesItem) {
    const key = rowKey(item.rowKind, item.rowRefId);
    const commento = String(commentDraftByKey[key] || "").trim();
    if (!commento) return;
    setCommentSavingKey(key);
    setError(null);
    try {
      const res = await fetchCronoprogramma({
        action: "add_comment",
        row_kind: item.rowKind,
        row_ref_id: item.rowRefId,
        commento,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          normalizeOperativeNotesError(data?.error, "Errore salvataggio nota storica")
        );
      }
      setCommentsByKey((prev) => ({
        ...prev,
        [key]: [data?.comment as CronoComment, ...(prev[key] || [])].filter(Boolean),
      }));
      setCommentDraftByKey((prev) => ({ ...prev, [key]: "" }));
    } catch (err: any) {
      setError(
        normalizeOperativeNotesError(err?.message, "Errore salvataggio nota storica")
      );
    } finally {
      setCommentSavingKey(null);
    }
  }

  if (normalizedItems.length === 0) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{
        display: "grid",
        gap: 8,
        marginTop: compact ? 6 : 0,
      }}
    >
      {title ? <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>{title}</div> : null}
      {!canLoad ? (
        <div style={{ fontSize: 12, opacity: 0.7 }}>Verifica sessione...</div>
      ) : null}
      {loading && Object.keys(metaByKey).length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.7 }}>Caricamento note...</div>
      ) : null}
      {error ? <div style={{ fontSize: 12, color: "#b91c1c" }}>{error}</div> : null}
      {normalizedItems.map((item) => {
        const key = rowKey(item.rowKind, item.rowRefId);
        const meta = metaByKey[key] || {};
        const comments = commentsByKey[key] || [];
        const latestComment = comments[0];
        const noteValue =
          noteDraftByKey[key] !== undefined
            ? noteDraftByKey[key]
            : String(meta.descrizione_attivita || "");
        const preview = normalizePreviewText(meta.descrizione_attivita);
        const latestPreview = normalizePreviewText(latestComment?.commento);
        const editing = editingKey === key;

        return (
          <div
            key={key}
            style={{
              border: compact ? "1px solid #eef2f7" : "1px solid #e5e7eb",
              borderRadius: 10,
              padding: compact ? "8px 10px" : 12,
              background: compact ? "#f9fafb" : "white",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800 }}>{item.label}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(editing ? null : key);
                    setNoteDraftByKey((prev) => ({
                      ...prev,
                      [key]:
                        prev[key] !== undefined ? prev[key] : String(meta.descrizione_attivita || ""),
                    }));
                  }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {editing ? "Chiudi" : "Modifica"}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryKey(key)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Storico
                </button>
              </div>
            </div>

            {editing ? (
              <div style={{ display: "grid", gap: 8 }}>
                <textarea
                  value={noteValue}
                  onChange={(e) =>
                    setNoteDraftByKey((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  rows={compact ? 3 : 4}
                  placeholder="Nota operativa"
                  style={{ width: "100%", padding: 8, resize: "vertical" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditingKey(null)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={savingKey === key}
                    onClick={() => saveNote(item)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      cursor: "pointer",
                      opacity: savingKey === key ? 0.7 : 1,
                    }}
                  >
                    Salva nota
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                <div
                  title={preview || "—"}
                  style={
                    compact
                      ? {
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }
                      : { whiteSpace: "pre-wrap", fontSize: 13 }
                  }
                >
                  {preview || "—"}
                </div>
                <div
                  title={latestPreview || "Nessuna nota storica"}
                  style={{
                    fontSize: 11,
                    opacity: 0.75,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Storico: {latestPreview || "—"}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {historyKey ? (
        <div
          onClick={() => setHistoryKey(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1400,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(760px, 96vw)",
              maxHeight: "80vh",
              overflow: "auto",
              background: "white",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 14,
              display: "grid",
              gap: 10,
            }}
          >
            {(() => {
              const activeItem = normalizedItems.find(
                (item) => rowKey(item.rowKind, item.rowRefId) === historyKey
              );
              if (!activeItem) return null;
              const comments = commentsByKey[historyKey] || [];
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>Storico note</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{activeItem.label}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHistoryKey(null)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      Chiudi
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <textarea
                      value={commentDraftByKey[historyKey] || ""}
                      onChange={(e) =>
                        setCommentDraftByKey((prev) => ({ ...prev, [historyKey]: e.target.value }))
                      }
                      rows={3}
                      placeholder="Aggiungi nota allo storico"
                      style={{ width: "100%", padding: 8, resize: "vertical" }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        disabled={commentSavingKey === historyKey}
                        onClick={() => addComment(activeItem)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #111",
                          background: "#111",
                          color: "white",
                          cursor: "pointer",
                          opacity: commentSavingKey === historyKey ? 0.7 : 1,
                        }}
                      >
                        Salva nello storico
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {comments.length === 0 ? (
                      <div style={{ opacity: 0.7 }}>Nessuna nota presente</div>
                    ) : (
                      comments.map((comment) => (
                        <div
                          key={comment.id}
                          style={{
                            border: "1px solid #eef2f7",
                            borderRadius: 8,
                            padding: "8px 10px",
                            background: "#f9fafb",
                          }}
                        >
                          <div style={{ whiteSpace: "pre-wrap" }}>{comment.commento}</div>
                          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                            {(comment.created_by_nome || "Operatore") +
                              " · " +
                              (comment.created_at
                                ? new Date(comment.created_at).toLocaleString("it-IT")
                                : "—")}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
