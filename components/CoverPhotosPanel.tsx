"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dbFrom } from "@/lib/clientDbBroker";
import {
  getImpiantoCoverPublicUrl,
  removeImpiantoCover,
  uploadImpiantoCover,
} from "@/lib/coverStorage";

type CoverAttachmentRow = {
  id: string;
  title: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
};

type Props = {
  impiantoId: string | null;
  createdById?: string | null;
  readOnly?: boolean;
  onCountChange?: (count: number) => void;
};

function sanitizeExtension(file: File) {
  const name = String(file.name || "").trim();
  const fromName = name.includes(".") ? name.split(".").pop() || "" : "";
  const normalizedFromName = fromName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (normalizedFromName) return normalizedFromName;

  const mime = String(file.type || "").trim().toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/avif") return "avif";
  return "bin";
}

export default function CoverPhotosPanel({
  impiantoId,
  createdById = null,
  readOnly = false,
  onCountChange,
}: Props) {
  const [rows, setRows] = useState<CoverAttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canUse = Boolean(impiantoId);
  const canUpload = canUse && !readOnly && Boolean(createdById);

  async function load() {
    if (!impiantoId) {
      setRows([]);
      onCountChange?.(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: loadError } = await dbFrom("attachments")
        .select("id, title, storage_path, mime_type, size_bytes, created_at")
        .eq("entity_type", "IMPIANTO_COVER")
        .eq("entity_id", impiantoId)
        .order("created_at", { ascending: false });
      if (loadError) throw new Error(loadError.message || "Errore caricamento cover");
      const nextRows = ((data || []) as CoverAttachmentRow[]).filter(
        (row) => String(row.storage_path || "").trim() !== ""
      );
      setRows(nextRows);
      onCountChange?.(nextRows.length);
    } catch (e: any) {
      setRows([]);
      onCountChange?.(0);
      setError(String(e?.message || e || "Errore caricamento cover"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impiantoId]);

  const previewRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        publicUrl: getImpiantoCoverPublicUrl(String(row.storage_path || "").trim()),
      })),
    [rows]
  );

  async function uploadSelected(files: FileList | null) {
    if (!canUpload || !impiantoId) return;
    const list = Array.from(files || []);
    if (list.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const file of list) {
        if (!String(file.type || "").toLowerCase().startsWith("image/")) {
          throw new Error(`File non valido: ${file.name}. Sono ammesse solo immagini.`);
        }
        const ext = sanitizeExtension(file);
        const path = `${impiantoId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await uploadImpiantoCover(path, file);
        if (uploadError) {
          throw new Error("Errore upload cover: " + uploadError.message);
        }

        const payload = {
          source: "UPLOAD",
          provider: null,
          url: null,
          title: file.name,
          document_type: "COPERTINA",
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          entity_type: "IMPIANTO_COVER",
          entity_id: impiantoId,
          slot_id: null,
          visibile_al_cliente: true,
          created_by: createdById,
        };
        const { error: insertError } = await dbFrom("attachments").insert(payload);
        if (insertError) {
          await removeImpiantoCover(path);
          throw new Error("Errore salvataggio cover: " + insertError.message);
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (e: any) {
      setError(String(e?.message || e || "Errore upload cover"));
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: CoverAttachmentRow) {
    if (!canUse || readOnly) return;
    if (!confirm("Eliminare la cover impianto?")) return;
    setSaving(true);
    setError(null);
    try {
      const storagePath = String(row.storage_path || "").trim();
      if (storagePath) {
        const { error: removeError } = await removeImpiantoCover(storagePath);
        if (removeError) {
          throw new Error("Errore eliminazione file cover: " + removeError.message);
        }
      }
      const { error: deleteError } = await dbFrom("attachments").delete().eq("id", row.id);
      if (deleteError) {
        throw new Error("Errore eliminazione record cover: " + deleteError.message);
      }
      await load();
    } catch (e: any) {
      setError(String(e?.message || e || "Errore eliminazione cover"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #dbeafe",
        borderRadius: 10,
        padding: 12,
        background: "#f8fbff",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 800, color: "#1d4ed8" }}>Foto copertina impianto</div>
        {!readOnly ? (
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #bfdbfe",
              background: canUpload && !saving ? "white" : "#e5e7eb",
              color: canUpload && !saving ? "#1d4ed8" : "#6b7280",
              cursor: canUpload && !saving ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              disabled={!canUpload || saving}
              onChange={(e) => void uploadSelected(e.target.files)}
              style={{ display: "none" }}
            />
            {saving ? "Upload..." : "+ Carica cover"}
          </label>
        ) : null}
      </div>

      {!impiantoId ? (
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Salva prima l&apos;impianto per abilitare le cover pubbliche.
        </div>
      ) : null}

      {impiantoId && !createdById && !readOnly ? (
        <div style={{ fontSize: 13, color: "#92400e" }}>
          Operatore non ancora risolto: upload cover temporaneamente disabilitato.
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            color: "#b91c1c",
            fontSize: 12,
            padding: "8px 10px",
            borderRadius: 8,
            background: "#fff1f2",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ fontSize: 13, color: "#64748b" }}>Caricamento cover...</div>
      ) : previewRows.length === 0 ? (
        <div style={{ fontSize: 13, color: "#64748b" }}>Nessuna cover caricata.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {previewRows.map((row) => (
            <div
              key={row.id}
              style={{
                border: "1px solid #dbeafe",
                borderRadius: 10,
                background: "white",
                overflow: "hidden",
                display: "grid",
              }}
            >
              {row.publicUrl ? (
                <a href={row.publicUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={row.publicUrl}
                    alt={row.title || "Cover impianto"}
                    style={{
                      display: "block",
                      width: "100%",
                      height: 150,
                      objectFit: "cover",
                      background: "#e5e7eb",
                    }}
                  />
                </a>
              ) : (
                <div
                  style={{
                    height: 150,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#e5e7eb",
                    color: "#6b7280",
                    fontSize: 13,
                  }}
                >
                  Anteprima non disponibile
                </div>
              )}
              <div style={{ padding: 10, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", overflowWrap: "anywhere" }}>
                  {row.title || "Cover"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => void removeRow(row)}
                    disabled={saving}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #fecaca",
                      background: "#fff1f2",
                      color: "#b91c1c",
                      cursor: saving ? "wait" : "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Elimina
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
