"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { storageSignedUrl, storageUpload } from "@/lib/clientStorageApi";

type DocumentType = "GENERICO" | "CLIENTE" | "DRIVE" | "ODA_FORNITORE";
type DocumentTypeFilter = "ALL" | DocumentType;

type AttachmentRow = {
  id: string;
  source: "UPLOAD" | "LINK";
  provider: string | null;
  url: string | null;
  title: string;
  document_type?: DocumentType | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
  visibile_al_cliente?: boolean | null;
};

const DOCUMENT_TYPE_OPTIONS: Array<{ value: DocumentType; label: string }> = [
  { value: "GENERICO", label: "Generico" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "DRIVE", label: "Drive" },
  { value: "ODA_FORNITORE", label: "ODA fornitore" },
];

const DOCUMENT_TYPE_BADGES: Record<
  DocumentType,
  { label: string; background: string; color: string }
> = {
  GENERICO: { label: "Interno", background: "#f3f4f6", color: "#374151" },
  CLIENTE: { label: "Cliente", background: "#dbeafe", color: "#1d4ed8" },
  DRIVE: { label: "Drive", background: "#dcfce7", color: "#166534" },
  ODA_FORNITORE: { label: "ODA", background: "#fef3c7", color: "#92400e" },
};

const DOCUMENT_TYPE_FILTER_OPTIONS: Array<{ value: DocumentTypeFilter; label: string }> = [
  { value: "ALL", label: "Tutti" },
  { value: "GENERICO", label: "Interno" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "DRIVE", label: "Drive" },
  { value: "ODA_FORNITORE", label: "ODA" },
];

type Props = {
  entityType: string;
  entityId: string | null;
  title?: string;
  multiple?: boolean;
  storagePrefix?: string;
  onCountChange?: (count: number) => void;
};

function detectProvider(url: string) {
  return url.toLowerCase().includes("drive.google.com") ? "GOOGLE_DRIVE" : "GENERIC";
}

function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

function resolveDocumentType(row: AttachmentRow): DocumentType {
  if (row.document_type && DOCUMENT_TYPE_BADGES[row.document_type]) return row.document_type;
  if (row.provider === "GOOGLE_DRIVE") return "DRIVE";
  return "GENERICO";
}

function normalizeSearchText(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getAttachmentFileName(row: AttachmentRow) {
  const storageName = String(row.storage_path || "").split("/").filter(Boolean).pop() || "";
  const urlName = String(row.url || "")
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean)
    .pop() || "";
  return storageName || urlName || row.title || "";
}

export default function AttachmentsPanel({
  entityType,
  entityId,
  title = "Allegati",
  multiple = false,
  storagePrefix,
  onCountChange,
}: Props) {
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("GENERICO");
  const [selectedDocumentTypeFilter, setSelectedDocumentTypeFilter] =
    useState<DocumentTypeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canUse = Boolean(entityId);

  async function load() {
    if (!canUse) {
      setRows([]);
      onCountChange?.(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/attachments?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(
          String(entityId)
        )}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Errore caricamento allegati");
        setRows([]);
        return;
      }
      const nextRows = ((data?.rows as AttachmentRow[]) || []);
      setRows(nextRows);
      onCountChange?.(nextRows.length);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function uploadSelected() {
    if (!canUse) return;
    if (!files.length) {
      setError("Seleziona almeno un file.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const file of files) {
        const safeName = file.name.replace(/\s+/g, "_");
        const path = `${storagePrefix || entityType.toLowerCase()}/${entityId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await storageUpload(path, file);
        if (upErr) throw new Error("Errore upload file: " + upErr.message);

        const res = await fetch("/api/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            source: "UPLOAD",
            entity_type: entityType,
            entity_id: entityId,
            title: file.name,
            document_type: documentType,
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Errore salvataggio allegato");
      }
      setFiles([]);
      setDocumentType("GENERICO");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function addLink() {
    if (!canUse) return;
    const url = linkUrl.trim();
    const titleToSave = linkTitle.trim() || url;
    if (!isHttpUrl(url)) {
      setError("URL non valido: usa http(s).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          source: "LINK",
          entity_type: entityType,
          entity_id: entityId,
          title: titleToSave,
          document_type: documentType,
          url,
          provider: detectProvider(url),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Errore salvataggio link");
      setLinkTitle("");
      setLinkUrl("");
      setDocumentType("GENERICO");
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: string) {
    if (!confirm("Eliminare allegato?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/attachments?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Errore eliminazione allegato");
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function openRow(row: AttachmentRow) {
    if (row.source === "LINK" && row.url) {
      window.open(row.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (row.storage_path) {
      const { data, error: urlErr } = await storageSignedUrl(row.storage_path);
      if (urlErr || !data?.signedUrl) {
        setError("Errore apertura allegato.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function copyLink(row: AttachmentRow) {
    const text = row.url || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Impossibile copiare il link.");
    }
  }

  async function updateVisibility(row: AttachmentRow, visibileAlCliente: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/attachments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: row.id,
          visibile_al_cliente: visibileAlCliente,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Errore aggiornamento visibilita allegato");
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...item, visibile_al_cliente: visibileAlCliente } : item
        )
      );
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  const canSave = canUse && !saving;
  const iconByRow = useMemo(
    () => (r: AttachmentRow) => (r.source === "LINK" ? (r.provider === "GOOGLE_DRIVE" ? "🟢" : "🔗") : "📄"),
    []
  );
  const filteredRows = useMemo(() => {
    const byDocumentType =
      selectedDocumentTypeFilter === "ALL"
        ? rows
        : rows.filter((row) => resolveDocumentType(row) === selectedDocumentTypeFilter);

    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) return byDocumentType;

    return byDocumentType.filter((row) => {
      const title = normalizeSearchText(row.title);
      const fileName = normalizeSearchText(getAttachmentFileName(row));
      const url = normalizeSearchText(row.url);
      return (
        title.includes(normalizedQuery) ||
        fileName.includes(normalizedQuery) ||
        url.includes(normalizedQuery)
      );
    });
  }, [rows, searchQuery, selectedDocumentTypeFilter]);

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "white" }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {!canUse && (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
          Allegati disponibili dopo il salvataggio (ID non ancora presente).
        </div>
      )}
      {error && <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 8, marginBottom: 8 }}>
        <select
          value={documentType}
          disabled={!canUse}
          onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", background: "white" }}
        >
          {DOCUMENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Tipo documento: {option.label}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            disabled={!canUse}
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
            style={{ display: "none" }}
          />
          <button
            type="button"
            disabled={!canUse}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
              cursor: canUse ? "pointer" : "not-allowed",
            }}
          >
            Seleziona file
          </button>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {files.length === 0
              ? "Nessun file selezionato"
              : files.length === 1
                ? files[0].name
                : `${files.length} file selezionati`}
          </div>
        </div>
        <button
          type="button"
          disabled={!canSave}
          onClick={uploadSelected}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #111", background: "#111", color: "white" }}
        >
          Carica file
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 12 }}>
        <input
          value={linkTitle}
          onChange={(e) => setLinkTitle(e.target.value)}
          placeholder="Titolo link (opzionale)"
          disabled={!canUse}
          style={{ padding: 8 }}
        />
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://drive.google.com/..."
          disabled={!canUse}
          style={{ padding: 8 }}
        />
        <button
          type="button"
          disabled={!canSave}
          onClick={addLink}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #111", background: "white" }}
        >
          Aggiungi link
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {DOCUMENT_TYPE_FILTER_OPTIONS.map((option) => {
          const active = selectedDocumentTypeFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedDocumentTypeFilter(option.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: active ? "1px solid #0f172a" : "1px solid #d1d5db",
                background: active ? "#0f172a" : "white",
                color: active ? "white" : "#334155",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cerca allegati..."
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
        />
      </div>

      {loading ? (
        <div style={{ opacity: 0.7, fontSize: 12 }}>Caricamento allegati...</div>
      ) : filteredRows.length === 0 ? (
        <div style={{ opacity: 0.7, fontSize: 12 }}>Nessun allegato</div>
      ) : (
        <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
          {filteredRows.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr auto",
                gap: 8,
                alignItems: "center",
                padding: "8px 10px",
                borderBottom: "1px solid #f3f4f6",
                fontSize: 13,
              }}
            >
              <div>{iconByRow(r)}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 600 }}>{r.title}</div>
                  {(() => {
                    const documentTypeBadge = DOCUMENT_TYPE_BADGES[resolveDocumentType(r)];
                    return (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: documentTypeBadge.background,
                          color: documentTypeBadge.color,
                        }}
                      >
                        {documentTypeBadge.label}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ opacity: 0.7, fontSize: 11 }}>
                  {r.source}
                  {r.provider ? ` · ${r.provider}` : ""}
                  {r.created_at ? ` · ${new Date(r.created_at).toLocaleString("it-IT")}` : ""}
                </div>
                <label
                  style={{
                    marginTop: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "#475569",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={r.visibile_al_cliente === true}
                    disabled={saving}
                    onChange={(e) => updateVisibility(r, e.target.checked)}
                  />
                  Visibile al cliente
                </label>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => openRow(r)} style={{ padding: "4px 8px" }}>
                  Apri
                </button>
                {r.source === "LINK" && (
                  <button type="button" onClick={() => copyLink(r)} style={{ padding: "4px 8px" }}>
                    Copia
                  </button>
                )}
                <button type="button" onClick={() => removeRow(r.id)} style={{ padding: "4px 8px", color: "#b91c1c" }}>
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
