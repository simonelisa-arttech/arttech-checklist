"use client";

import { useEffect, useMemo, useState } from "react";
import { storageSignedUrl, storageUpload } from "@/lib/clientStorageApi";

type AttachmentRow = {
  id: string;
  source: "UPLOAD" | "LINK";
  provider: string | null;
  url: string | null;
  title: string;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
};

type Props = {
  entityType: string;
  entityId: string | null;
  title?: string;
  multiple?: boolean;
  storagePrefix?: string;
};

function detectProvider(url: string) {
  return url.toLowerCase().includes("drive.google.com") ? "GOOGLE_DRIVE" : "GENERIC";
}

function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

export default function AttachmentsPanel({
  entityType,
  entityId,
  title = "Allegati",
  multiple = false,
  storagePrefix,
}: Props) {
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const canUse = Boolean(entityId);

  async function load() {
    if (!canUse) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/attachments?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(
          String(entityId)
        )}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Errore caricamento allegati");
        setRows([]);
        return;
      }
      setRows((data?.rows as AttachmentRow[]) || []);
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
          body: JSON.stringify({
            source: "UPLOAD",
            entity_type: entityType,
            entity_id: entityId,
            title: file.name,
            storage_path: path,
            mime_type: file.type || null,
            size_bytes: file.size,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Errore salvataggio allegato");
      }
      setFiles([]);
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
        body: JSON.stringify({
          source: "LINK",
          entity_type: entityType,
          entity_id: entityId,
          title: titleToSave,
          url,
          provider: detectProvider(url),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Errore salvataggio link");
      setLinkTitle("");
      setLinkUrl("");
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
      const res = await fetch(`/api/attachments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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

  const canSave = canUse && !saving;
  const iconByRow = useMemo(
    () => (r: AttachmentRow) => (r.source === "LINK" ? (r.provider === "GOOGLE_DRIVE" ? "🟢" : "🔗") : "📄"),
    []
  );

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "white" }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {!canUse && (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
          Allegati disponibili dopo il salvataggio (ID non ancora presente).
        </div>
      )}
      {error && <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
        <input
          type="file"
          multiple={multiple}
          disabled={!canUse}
          onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
        />
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

      {loading ? (
        <div style={{ opacity: 0.7, fontSize: 12 }}>Caricamento allegati...</div>
      ) : rows.length === 0 ? (
        <div style={{ opacity: 0.7, fontSize: 12 }}>Nessun allegato</div>
      ) : (
        <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
          {rows.map((r) => (
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
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div style={{ opacity: 0.7, fontSize: 11 }}>
                  {r.source}
                  {r.provider ? ` · ${r.provider}` : ""}
                  {r.created_at ? ` · ${new Date(r.created_at).toLocaleString("it-IT")}` : ""}
                </div>
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
