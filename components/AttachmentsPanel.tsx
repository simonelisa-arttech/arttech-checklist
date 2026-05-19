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
  slot_id?: string | null;
  visibile_al_cliente?: boolean | null;
};

type AttachmentPanelMode = "block" | "slot" | "combined";
type AttachmentScope = "block" | "slot";

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
  slotId?: string | null;
  mode?: AttachmentPanelMode;
  title?: string;
  multiple?: boolean;
  storagePrefix?: string;
  allowUploads?: boolean;
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
  slotId = null,
  mode = "block",
  title = "Allegati",
  multiple = false,
  storagePrefix,
  allowUploads = true,
  onCountChange,
}: Props) {
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockFiles, setBlockFiles] = useState<File[]>([]);
  const [slotFiles, setSlotFiles] = useState<File[]>([]);
  const [blockLinkTitle, setBlockLinkTitle] = useState("");
  const [slotLinkTitle, setSlotLinkTitle] = useState("");
  const [blockLinkUrl, setBlockLinkUrl] = useState("");
  const [slotLinkUrl, setSlotLinkUrl] = useState("");
  const [blockDocumentType, setBlockDocumentType] = useState<DocumentType>("GENERICO");
  const [slotDocumentType, setSlotDocumentType] = useState<DocumentType>("GENERICO");
  const [selectedDocumentTypeFilter, setSelectedDocumentTypeFilter] =
    useState<DocumentTypeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const blockFileInputRef = useRef<HTMLInputElement | null>(null);
  const slotFileInputRef = useRef<HTMLInputElement | null>(null);

  const canUse = Boolean(entityId);
  const canUseSlot = Boolean(entityId && slotId);
  const shouldShowBlock = mode === "block" || mode === "combined";
  const shouldShowSlot = mode === "slot" || mode === "combined";

  async function load() {
    if (!canUse) {
      setRows([]);
      onCountChange?.(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: String(entityId),
        mode,
      });
      if (slotId) params.set("slot_id", slotId);
      const res = await fetch(
        `/api/attachments?${params.toString()}`,
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
  }, [entityType, entityId, slotId, mode]);

  function getScopeDocumentType(scope: AttachmentScope) {
    return scope === "slot" ? slotDocumentType : blockDocumentType;
  }

  function setScopeDocumentType(scope: AttachmentScope, value: DocumentType) {
    if (scope === "slot") {
      setSlotDocumentType(value);
      return;
    }
    setBlockDocumentType(value);
  }

  function getScopeFiles(scope: AttachmentScope) {
    return scope === "slot" ? slotFiles : blockFiles;
  }

  function setScopeFiles(scope: AttachmentScope, nextFiles: File[]) {
    if (scope === "slot") {
      setSlotFiles(nextFiles);
      return;
    }
    setBlockFiles(nextFiles);
  }

  function getScopeLinkTitle(scope: AttachmentScope) {
    return scope === "slot" ? slotLinkTitle : blockLinkTitle;
  }

  function setScopeLinkTitle(scope: AttachmentScope, value: string) {
    if (scope === "slot") {
      setSlotLinkTitle(value);
      return;
    }
    setBlockLinkTitle(value);
  }

  function getScopeLinkUrl(scope: AttachmentScope) {
    return scope === "slot" ? slotLinkUrl : blockLinkUrl;
  }

  function setScopeLinkUrl(scope: AttachmentScope, value: string) {
    if (scope === "slot") {
      setSlotLinkUrl(value);
      return;
    }
    setBlockLinkUrl(value);
  }

  function getScopeFileInputRef(scope: AttachmentScope) {
    return scope === "slot" ? slotFileInputRef : blockFileInputRef;
  }

  function getScopeSlotId(scope: AttachmentScope) {
    return scope === "slot" ? slotId : null;
  }

  function canUseScope(scope: AttachmentScope) {
    return scope === "slot" ? canUseSlot : canUse;
  }

  async function uploadSelected(scope: AttachmentScope) {
    if (!canUseScope(scope)) return;
    const files = getScopeFiles(scope);
    if (!files.length) {
      setError("Seleziona almeno un file.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const file of files) {
        const safeName = file.name.replace(/\s+/g, "_");
        const scopeSlotId = getScopeSlotId(scope);
        const path = scopeSlotId
          ? `${storagePrefix || entityType.toLowerCase()}/${entityId}/${scopeSlotId}/${Date.now()}_${safeName}`
          : `${storagePrefix || entityType.toLowerCase()}/${entityId}/${Date.now()}_${safeName}`;
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
            slot_id: scopeSlotId,
            title: file.name,
            document_type: getScopeDocumentType(scope),
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Errore salvataggio allegato");
      }
      setScopeFiles(scope, []);
      setScopeDocumentType(scope, "GENERICO");
      const fileInputRef = getScopeFileInputRef(scope);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function addLink(scope: AttachmentScope) {
    if (!canUseScope(scope)) return;
    const url = getScopeLinkUrl(scope).trim();
    const titleToSave = getScopeLinkTitle(scope).trim() || url;
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
          slot_id: getScopeSlotId(scope),
          title: titleToSave,
          document_type: getScopeDocumentType(scope),
          url,
          provider: detectProvider(url),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Errore salvataggio link");
      setScopeLinkTitle(scope, "");
      setScopeLinkUrl(scope, "");
      setScopeDocumentType(scope, "GENERICO");
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

  const blockRows = useMemo(
    () => filteredRows.filter((row) => !row.slot_id),
    [filteredRows]
  );
  const slotRows = useMemo(
    () => filteredRows.filter((row) => row.slot_id && row.slot_id === slotId),
    [filteredRows, slotId]
  );

  function getScopeRows(scope: AttachmentScope) {
    return scope === "slot" ? slotRows : blockRows;
  }

  function renderRowsList(list: AttachmentRow[]) {
    if (loading) {
      return <div style={{ opacity: 0.7, fontSize: 12 }}>Caricamento allegati...</div>;
    }
    if (list.length === 0) {
      return <div style={{ opacity: 0.7, fontSize: 12 }}>Nessun allegato</div>;
    }
    return (
      <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
        {list.map((r) => (
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
              <button
                type="button"
                onClick={() => removeRow(r.id)}
                style={{ padding: "4px 8px", color: "#b91c1c" }}
              >
                Elimina
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderScopeSection(scope: AttachmentScope, sectionTitle?: string) {
    const currentCanUse = canUseScope(scope);
    const currentCanSave = currentCanUse && !saving;
    const currentRows = getScopeRows(scope);
    const currentDocumentType = getScopeDocumentType(scope);
    const currentFiles = getScopeFiles(scope);
    const currentLinkTitle = getScopeLinkTitle(scope);
    const currentLinkUrl = getScopeLinkUrl(scope);
    const fileInputRef = getScopeFileInputRef(scope);
    const showMissingSlotMessage = scope === "slot" && !slotId;

    return (
      <div
        style={{
          border: mode === "combined" ? "1px solid #e5e7eb" : undefined,
          borderRadius: mode === "combined" ? 10 : undefined,
          padding: mode === "combined" ? 12 : 0,
          display: "grid",
          gap: 12,
        }}
      >
        {sectionTitle ? <div style={{ fontWeight: 700, fontSize: 13 }}>{sectionTitle}</div> : null}
        {!currentCanUse ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {showMissingSlotMessage
              ? "Allegati giornata disponibili dopo il salvataggio della giornata."
              : "Allegati disponibili dopo il salvataggio (ID non ancora presente)."}
          </div>
        ) : null}

        {allowUploads ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr auto",
              gap: 8,
            }}
          >
            <select
              value={currentDocumentType}
              disabled={!currentCanUse}
              onChange={(e) => setScopeDocumentType(scope, e.target.value as DocumentType)}
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
                disabled={!currentCanUse}
                onChange={(e) =>
                  setScopeFiles(scope, e.target.files ? Array.from(e.target.files) : [])
                }
                style={{ display: "none" }}
              />
              <button
                type="button"
                disabled={!currentCanUse}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: currentCanUse ? "pointer" : "not-allowed",
                }}
              >
                Seleziona file
              </button>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {currentFiles.length === 0
                  ? "Nessun file selezionato"
                  : currentFiles.length === 1
                    ? currentFiles[0].name
                    : `${currentFiles.length} file selezionati`}
              </div>
            </div>
            <button
              type="button"
              disabled={!currentCanSave}
              onClick={() => uploadSelected(scope)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "white",
              }}
            >
              Carica file
            </button>
          </div>
        ) : (
          <div>
            <select
              value={currentDocumentType}
              disabled={!currentCanUse}
              onChange={(e) => setScopeDocumentType(scope, e.target.value as DocumentType)}
              style={{
                width: "100%",
                maxWidth: 260,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
              }}
            >
              {DOCUMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Tipo documento: {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
          <input
            value={currentLinkTitle}
            onChange={(e) => setScopeLinkTitle(scope, e.target.value)}
            placeholder="Titolo link (opzionale)"
            disabled={!currentCanUse}
            style={{ padding: 8 }}
          />
          <input
            value={currentLinkUrl}
            onChange={(e) => setScopeLinkUrl(scope, e.target.value)}
            placeholder="https://drive.google.com/..."
            disabled={!currentCanUse}
            style={{ padding: 8 }}
          />
          <button
            type="button"
            disabled={!currentCanSave}
            onClick={() => addLink(scope)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #111",
              background: "white",
            }}
          >
            Aggiungi link
          </button>
        </div>

        {renderRowsList(currentRows)}
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "white" }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {!canUse && mode === "block" && (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
          Allegati disponibili dopo il salvataggio (ID non ancora presente).
        </div>
      )}
      {error && <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>{error}</div>}

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

      <div style={{ display: "grid", gap: 12 }}>
        {shouldShowBlock ? renderScopeSection("block", mode === "combined" ? "Allegati generali" : undefined) : null}
        {shouldShowSlot ? renderScopeSection("slot", mode === "combined" ? "Allegati giornata" : undefined) : null}
      </div>
    </div>
  );
}
