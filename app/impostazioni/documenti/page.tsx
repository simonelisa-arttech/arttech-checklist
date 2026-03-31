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

type NewDocumentFormState = {
  nome: string;
  target: "PERSONALE" | "AZIENDA" | "ENTRAMBI";
  categoria: string;
  has_scadenza: boolean;
  validita_mesi: string;
  required_default: boolean;
  attivo: boolean;
  sort_order: string;
};

const EMPTY_NEW_DOCUMENT_FORM: NewDocumentFormState = {
  nome: "",
  target: "PERSONALE",
  categoria: "",
  has_scadenza: true,
  validita_mesi: "",
  required_default: false,
  attivo: true,
  sort_order: "",
};

type EditDocumentFormState = NewDocumentFormState;

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
  const [notice, setNotice] = useState<string | null>(null);
  const [rows, setRows] = useState<DocumentCatalogRow[]>([]);
  const [newDocumentOpen, setNewDocumentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDocumentForm, setNewDocumentForm] = useState<NewDocumentFormState>(EMPTY_NEW_DOCUMENT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditDocumentFormState | null>(null);

  async function loadRows() {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await dbFrom("document_catalog")
      .select(
        "id,nome,target,categoria,has_scadenza,validita_mesi,required_default,attivo,sort_order"
      )
      .order("sort_order", { ascending: true })
      .order("nome", { ascending: true });

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
  }

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await loadRows();
    })();
    return () => {
      active = false;
    };
  }, []);

  async function createDocument() {
    const nome = newDocumentForm.nome.trim();
    if (!nome) {
      setError("Il nome del documento e obbligatorio.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const result = await dbFrom("document_catalog").insert({
      nome,
      target: newDocumentForm.target,
      categoria: newDocumentForm.categoria.trim() || null,
      has_scadenza: newDocumentForm.has_scadenza,
      validita_mesi: newDocumentForm.validita_mesi.trim()
        ? Number(newDocumentForm.validita_mesi)
        : null,
      required_default: newDocumentForm.required_default,
      attivo: newDocumentForm.attivo,
      sort_order: newDocumentForm.sort_order.trim() ? Number(newDocumentForm.sort_order) : null,
    });

    setSaving(false);

    if (result.error) {
      setError(`Errore salvataggio documento: ${result.error.message}`);
      return;
    }

    setNewDocumentForm(EMPTY_NEW_DOCUMENT_FORM);
    setNewDocumentOpen(false);
    setNotice(`Documento ${nome} creato.`);
    await loadRows();
  }

  function startEdit(row: DocumentCatalogRow) {
    setEditingId(row.id);
    setEditForm({
      nome: row.nome,
      target: (row.target === "AZIENDA" || row.target === "ENTRAMBI" ? row.target : "PERSONALE") as EditDocumentFormState["target"],
      categoria: row.categoria || "",
      has_scadenza: row.has_scadenza,
      validita_mesi: row.validita_mesi == null ? "" : String(row.validita_mesi),
      required_default: row.required_default,
      attivo: row.attivo,
      sort_order: row.sort_order == null ? "" : String(row.sort_order),
    });
    setError(null);
    setNotice(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(rowId: string) {
    if (!editForm) return;
    const nome = editForm.nome.trim();
    if (!nome) {
      setError("Il nome del documento e obbligatorio.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const result = await dbFrom("document_catalog")
      .update({
        nome,
        target: editForm.target,
        categoria: editForm.categoria.trim() || null,
        has_scadenza: editForm.has_scadenza,
        validita_mesi: editForm.validita_mesi.trim() ? Number(editForm.validita_mesi) : null,
        required_default: editForm.required_default,
        attivo: editForm.attivo,
        sort_order: editForm.sort_order.trim() ? Number(editForm.sort_order) : null,
      })
      .eq("id", rowId);

    setSaving(false);

    if (result.error) {
      setError(`Errore aggiornamento documento: ${result.error.message}`);
      return;
    }

    setNotice(`Documento ${nome} aggiornato.`);
    cancelEdit();
    await loadRows();
  }

  async function toggleDocumentoAttivo(row: DocumentCatalogRow) {
    setSaving(true);
    setError(null);
    setNotice(null);

    const nextAttivo = !row.attivo;
    const result = await dbFrom("document_catalog")
      .update({ attivo: nextAttivo })
      .eq("id", row.id);

    setSaving(false);

    if (result.error) {
      setError(`Errore aggiornamento stato documento: ${result.error.message}`);
      return;
    }

    setNotice(`Documento ${row.nome} ${nextAttivo ? "riattivato" : "disattivato"}.`);
    if (editingId === row.id) cancelEdit();
    await loadRows();
  }

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

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            setNewDocumentOpen((prev) => !prev);
            setError(null);
            setNotice(null);
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          + Nuovo documento
        </button>
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

      {notice ? (
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            fontSize: 14,
          }}
        >
          {notice}
        </div>
      ) : null}

      {newDocumentOpen ? (
        <div
          style={{
            marginTop: 18,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#fff",
            padding: 16,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800 }}>Nuovo documento / corso</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
              Nome
              <input
                value={newDocumentForm.nome}
                onChange={(e) => setNewDocumentForm((prev) => ({ ...prev, nome: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
              Target
              <select
                value={newDocumentForm.target}
                onChange={(e) =>
                  setNewDocumentForm((prev) => ({
                    ...prev,
                    target: e.target.value as NewDocumentFormState["target"],
                  }))
                }
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
              >
                <option value="PERSONALE">PERSONALE</option>
                <option value="AZIENDA">AZIENDA</option>
                <option value="ENTRAMBI">ENTRAMBI</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
              Categoria
              <input
                value={newDocumentForm.categoria}
                onChange={(e) => setNewDocumentForm((prev) => ({ ...prev, categoria: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
              Validita mesi
              <input
                type="number"
                min={0}
                step={1}
                value={newDocumentForm.validita_mesi}
                onChange={(e) =>
                  setNewDocumentForm((prev) => ({ ...prev, validita_mesi: e.target.value }))
                }
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
              Sort order
              <input
                type="number"
                step={1}
                value={newDocumentForm.sort_order}
                onChange={(e) =>
                  setNewDocumentForm((prev) => ({ ...prev, sort_order: e.target.value }))
                }
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={newDocumentForm.has_scadenza}
                onChange={(e) =>
                  setNewDocumentForm((prev) => ({ ...prev, has_scadenza: e.target.checked }))
                }
              />
              Ha scadenza
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={newDocumentForm.required_default}
                onChange={(e) =>
                  setNewDocumentForm((prev) => ({ ...prev, required_default: e.target.checked }))
                }
              />
              Required default
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={newDocumentForm.attivo}
                onChange={(e) =>
                  setNewDocumentForm((prev) => ({ ...prev, attivo: e.target.checked }))
                }
              />
              Attivo
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void createDocument()}
              disabled={saving}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid #111827",
                background: "#111827",
                color: "white",
                fontWeight: 800,
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.8 : 1,
              }}
            >
              {saving ? "Salvataggio..." : "Salva documento"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNewDocumentOpen(false);
                setNewDocumentForm(EMPTY_NEW_DOCUMENT_FORM);
              }}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Annulla
            </button>
          </div>
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
              "minmax(220px,1.4fr) 120px 150px 130px 120px 130px 100px 90px 160px",
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
          <div>Azioni</div>
        </div>

        {loading ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Caricamento...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 18, color: "#6b7280" }}>Nessun documento presente nel catalogo.</div>
        ) : (
          rows.map((row) => {
            const isEditing = editingId === row.id && editForm;
            return (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(220px,1.4fr) 120px 150px 130px 120px 130px 100px 90px 160px",
                  gap: 12,
                  padding: "14px 16px",
                  fontSize: 14,
                  borderBottom: "1px solid #f3f4f6",
                  alignItems: "center",
                  background: row.attivo ? "#fff" : "#f8fafc",
                  opacity: row.attivo ? 1 : 0.72,
                }}
              >
                {isEditing ? (
                  <>
                    <input
                      value={editForm.nome}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, nome: e.target.value } : prev))}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                    />
                    <select
                      value={editForm.target}
                      onChange={(e) =>
                        setEditForm((prev) =>
                          prev ? { ...prev, target: e.target.value as EditDocumentFormState["target"] } : prev
                        )
                      }
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                    >
                      <option value="PERSONALE">PERSONALE</option>
                      <option value="AZIENDA">AZIENDA</option>
                      <option value="ENTRAMBI">ENTRAMBI</option>
                    </select>
                    <input
                      value={editForm.categoria}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, categoria: e.target.value } : prev))}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={editForm.has_scadenza}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, has_scadenza: e.target.checked } : prev))
                        }
                      />
                      Ha scadenza
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={editForm.validita_mesi}
                      onChange={(e) =>
                        setEditForm((prev) => (prev ? { ...prev, validita_mesi: e.target.value } : prev))
                      }
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={editForm.required_default}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, required_default: e.target.checked } : prev))
                        }
                      />
                      Required
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={editForm.attivo}
                        onChange={(e) =>
                          setEditForm((prev) => (prev ? { ...prev, attivo: e.target.checked } : prev))
                        }
                      />
                      Attivo
                    </label>
                    <input
                      type="number"
                      step={1}
                      value={editForm.sort_order}
                      onChange={(e) =>
                        setEditForm((prev) => (prev ? { ...prev, sort_order: e.target.value } : prev))
                      }
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db" }}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => void saveEdit(row.id)}
                        disabled={saving}
                        style={{
                          height: 40,
                          padding: "0 12px",
                          borderRadius: 10,
                          border: "1px solid #111827",
                          background: "#111827",
                          color: "white",
                          fontWeight: 800,
                          cursor: saving ? "wait" : "pointer",
                          opacity: saving ? 0.8 : 1,
                        }}
                      >
                        {saving ? "Salvataggio..." : "Salva"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{
                          height: 40,
                          padding: "0 12px",
                          borderRadius: 10,
                          border: "1px solid #d1d5db",
                          background: "#fff",
                          color: "#111827",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Annulla
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 700 }}>{row.nome || "—"}</div>
                    <div>{row.target || "—"}</div>
                    <div>{row.categoria || "—"}</div>
                    <div>{renderBooleanBadge(row.has_scadenza, "SI", "NO")}</div>
                    <div>{row.validita_mesi == null ? "—" : row.validita_mesi}</div>
                    <div>{renderBooleanBadge(row.required_default, "SI", "NO")}</div>
                    <div>{renderBooleanBadge(row.attivo, "SI", "NO")}</div>
                    <div>{row.sort_order == null ? "—" : row.sort_order}</div>
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          style={{
                            height: 40,
                            padding: "0 12px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            color: "#111827",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleDocumentoAttivo(row)}
                          disabled={saving}
                          style={{
                            height: 40,
                            padding: "0 12px",
                            borderRadius: 10,
                            border: row.attivo ? "1px solid #fecaca" : "1px solid #bbf7d0",
                            background: row.attivo ? "#fff1f2" : "#f0fdf4",
                            color: row.attivo ? "#991b1b" : "#166534",
                            fontWeight: 700,
                            cursor: saving ? "wait" : "pointer",
                            opacity: saving ? 0.8 : 1,
                          }}
                        >
                          {row.attivo ? "Disattiva" : "Riattiva"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
