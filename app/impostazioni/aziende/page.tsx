"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import SafetyExpectedDocumentsPanel from "@/components/SafetyExpectedDocumentsPanel";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { dbFrom } from "@/lib/clientDbBroker";

type AziendaRow = {
  id?: string;
  ragione_sociale: string;
  partita_iva: string;
  tipo: "INTERNA" | "ESTERNA";
  attiva: boolean;
  created_at?: string | null;
  isNew?: boolean;
};

type AziendaDocumentoRow = {
  id?: string;
  azienda_id: string;
  tipo_documento: string;
  data_scadenza: string;
  note: string;
  file_url: string;
  isNew?: boolean;
};

type DocumentTypeRow = {
  id: string;
  codice: string | null;
  nome: string | null;
};

const AZIENDA_TIPO_OPTIONS = ["INTERNA", "ESTERNA"] as const;

function createTempId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function AziendePage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [aziende, setAziende] = useState<AziendaRow[]>([]);
  const [documenti, setDocumenti] = useState<AziendaDocumentoRow[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeRow[]>([]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const [aziendeRes, documentiRes, typesRes] = await Promise.all([
      dbFrom("aziende").select("*").order("ragione_sociale", { ascending: true }),
      dbFrom("aziende_documenti")
        .select("*")
        .order("data_scadenza", { ascending: true })
        .order("tipo_documento", { ascending: true }),
      dbFrom("document_types").select("*").order("codice", { ascending: true }),
    ]);

    const errors: string[] = [];
    if (aziendeRes.error) errors.push(`Errore caricamento aziende: ${aziendeRes.error.message}`);
    if (documentiRes.error) errors.push(`Errore caricamento documenti aziende: ${documentiRes.error.message}`);
    if (typesRes.error) errors.push(`Errore caricamento tipi documento: ${typesRes.error.message}`);

    setAziende(
      (((aziendeRes.data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
        id: String(row.id || ""),
        ragione_sociale: String(row.ragione_sociale || ""),
        partita_iva: String(row.partita_iva || ""),
        tipo: String(row.tipo || "ESTERNA").toUpperCase() === "INTERNA" ? "INTERNA" : "ESTERNA",
        attiva: row.attiva !== false,
        created_at: row.created_at ?? null,
        isNew: false,
      }))
    );
    setDocumenti(
      (((documentiRes.data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
        id: String(row.id || ""),
        azienda_id: String(row.azienda_id || ""),
        tipo_documento: String(row.tipo_documento || ""),
        data_scadenza: String(row.data_scadenza || ""),
        note: String(row.note || ""),
        file_url: String(row.file_url || ""),
        isNew: false,
      }))
    );
    setDocumentTypes(((typesRes.data as any[]) || []) as DocumentTypeRow[]);
    setError(errors.length > 0 ? errors.join(" • ") : null);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const documentTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          documentTypes
            .flatMap((row) => [String(row.codice || "").trim(), String(row.nome || "").trim()])
            .filter(Boolean)
        )
      ),
    [documentTypes]
  );

  const docsByAzienda = useMemo(() => {
    const map = new Map<string, AziendaDocumentoRow[]>();
    for (const doc of documenti) {
      const key = String(doc.azienda_id || "");
      if (!key) continue;
      const bucket = map.get(key) || [];
      bucket.push(doc);
      map.set(key, bucket);
    }
    return map;
  }, [documenti]);

  function addAzienda() {
    setAziende((prev) => [
      {
        id: createTempId("azienda"),
        ragione_sociale: "",
        partita_iva: "",
        tipo: "ESTERNA",
        attiva: true,
        isNew: true,
      },
      ...prev,
    ]);
  }

  function updateAzienda(targetId: string | undefined, patch: Partial<AziendaRow>) {
    if (!targetId) return;
    setAziende((prev) =>
      prev.map((row) => (row.id === targetId ? { ...row, ...patch } : row))
    );
  }

  async function saveAzienda(row: AziendaRow) {
    const ragioneSociale = row.ragione_sociale.trim();
    if (!ragioneSociale) {
      setError("La ragione sociale è obbligatoria.");
      return;
    }
    setSavingKey(`azienda:${row.id || "new"}`);
    setError(null);
    setNotice(null);

    const payload = {
      ragione_sociale: ragioneSociale,
      partita_iva: row.partita_iva.trim() || null,
      tipo: row.tipo === "INTERNA" ? "INTERNA" : "ESTERNA",
      attiva: row.attiva,
    };

    const result = row.isNew
      ? await dbFrom("aziende").insert(payload)
      : await dbFrom("aziende").update(payload).eq("id", row.id || "");

    if (result.error) {
      setError(`Errore salvataggio azienda: ${result.error.message}`);
      setSavingKey(null);
      return;
    }

    await loadData();
    setNotice(`Azienda ${ragioneSociale} salvata.`);
    setSavingKey(null);
  }

  async function deleteAzienda(row: AziendaRow) {
    if (row.isNew) {
      setAziende((prev) => prev.filter((current) => current.id !== row.id));
      return;
    }
    const ok = window.confirm(`Eliminare l'azienda ${row.ragione_sociale || "selezionata"}?`);
    if (!ok) return;

    setSavingKey(`azienda:${row.id || ""}`);
    const result = await dbFrom("aziende").delete().eq("id", row.id || "");
    if (result.error) {
      setError(`Errore eliminazione azienda: ${result.error.message}`);
      setSavingKey(null);
      return;
    }
    await loadData();
    setNotice("Azienda eliminata.");
    setSavingKey(null);
  }

  function addDocumento(aziendaId: string) {
    setDocumenti((prev) => [
      {
        id: createTempId("azienda-doc"),
        azienda_id: aziendaId,
        tipo_documento: "",
        data_scadenza: "",
        note: "",
        file_url: "",
        isNew: true,
      },
      ...prev,
    ]);
  }

  function updateDocumento(targetId: string | undefined, patch: Partial<AziendaDocumentoRow>) {
    if (!targetId) return;
    setDocumenti((prev) =>
      prev.map((row) => (row.id === targetId ? { ...row, ...patch } : row))
    );
  }

  async function saveDocumento(row: AziendaDocumentoRow) {
    const tipoDocumento = row.tipo_documento.trim();
    if (!row.azienda_id) {
      setError("Salva prima l'azienda per associare documenti.");
      return;
    }
    if (!tipoDocumento) {
      setError("Il tipo documento è obbligatorio.");
      return;
    }

    setSavingKey(`azienda-doc:${row.id || "new"}`);
    setError(null);
    setNotice(null);

    const payload = {
      azienda_id: row.azienda_id,
      tipo_documento: tipoDocumento,
      data_scadenza: row.data_scadenza || null,
      note: row.note.trim() || null,
      file_url: row.file_url.trim() || null,
    };

    const result = row.isNew
      ? await dbFrom("aziende_documenti").insert(payload)
      : await dbFrom("aziende_documenti").update(payload).eq("id", row.id || "");

    if (result.error) {
      setError(`Errore salvataggio documento azienda: ${result.error.message}`);
      setSavingKey(null);
      return;
    }

    await loadData();
    setNotice(`Documento ${tipoDocumento} salvato.`);
    setSavingKey(null);
  }

  async function deleteDocumento(row: AziendaDocumentoRow) {
    if (row.isNew) {
      setDocumenti((prev) => prev.filter((current) => current.id !== row.id));
      return;
    }
    const ok = window.confirm(`Eliminare il documento ${row.tipo_documento || "selezionato"}?`);
    if (!ok) return;

    setSavingKey(`azienda-doc:${row.id || ""}`);
    const result = await dbFrom("aziende_documenti").delete().eq("id", row.id || "");
    if (result.error) {
      setError(`Errore eliminazione documento azienda: ${result.error.message}`);
      setSavingKey(null);
      return;
    }
    await loadData();
    setNotice("Documento azienda eliminato.");
    setSavingKey(null);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "24px auto", padding: 16, paddingBottom: 56 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>Aziende</h1>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            Anagrafiche aziende interne/esterne e documenti sicurezza.
          </div>
        </div>
        <Link
          href="/impostazioni/personale"
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
          Personale
        </Link>
        <Link
          href="/impostazioni"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ← Impostazioni
        </Link>
      </div>

      {error ? <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
      {notice ? <div style={{ marginTop: 12, color: "#166534", fontSize: 13 }}>{notice}</div> : null}

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={addAzienda}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
          }}
        >
          + Nuova azienda
        </button>
      </div>

      {loading ? (
        <div style={{ marginTop: 18, opacity: 0.7 }}>Caricamento...</div>
      ) : (
        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          {aziende.length === 0 ? (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "white" }}>
              Nessuna azienda configurata.
            </div>
          ) : (
            aziende.map((azienda) => {
              const docRows = docsByAzienda.get(String(azienda.id || "")) || [];
              return (
                <div
                  key={azienda.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    background: "white",
                    padding: 16,
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "minmax(220px, 1.7fr) minmax(180px, 1fr) 180px 120px",
                      alignItems: "end",
                    }}
                  >
                    <label style={{ display: "block", fontSize: 12 }}>
                      Ragione sociale
                      <input
                        value={azienda.ragione_sociale}
                        onChange={(e) => updateAzienda(azienda.id, { ragione_sociale: e.target.value })}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", fontSize: 12 }}>
                      Partita IVA
                      <input
                        value={azienda.partita_iva}
                        onChange={(e) => updateAzienda(azienda.id, { partita_iva: e.target.value })}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", fontSize: 12 }}>
                      Tipo
                      <select
                        value={azienda.tipo}
                        onChange={(e) =>
                          updateAzienda(azienda.id, {
                            tipo: e.target.value === "INTERNA" ? "INTERNA" : "ESTERNA",
                          })
                        }
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      >
                        {AZIENDA_TIPO_OPTIONS.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, paddingBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={azienda.attiva}
                        onChange={(e) => updateAzienda(azienda.id, { attiva: e.target.checked })}
                      />
                      Attiva
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      {azienda.isNew ? "Salva l'azienda per abilitare i documenti." : `${docRows.length} documenti collegati`}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => saveAzienda(azienda)}
                        disabled={savingKey === `azienda:${azienda.id || "new"}`}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #111",
                          background: "#111",
                          color: "white",
                          cursor: "pointer",
                          opacity: savingKey === `azienda:${azienda.id || "new"}` ? 0.7 : 1,
                        }}
                      >
                        {savingKey === `azienda:${azienda.id || "new"}` ? "Salvataggio..." : "Salva azienda"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAzienda(azienda)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        Elimina
                      </button>
                      <button
                        type="button"
                        onClick={() => (azienda.isNew ? null : addDocumento(String(azienda.id || "")))}
                        disabled={azienda.isNew}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #d1d5db",
                          background: "#f9fafb",
                          cursor: azienda.isNew ? "default" : "pointer",
                          opacity: azienda.isNew ? 0.55 : 1,
                        }}
                      >
                        + Documento azienda
                      </button>
                    </div>
                  </div>

                  <SafetyExpectedDocumentsPanel
                    kind="AZIENDA"
                    docs={docRows.map((doc) => ({
                      tipo_documento: doc.tipo_documento,
                      data_scadenza: doc.data_scadenza || null,
                    }))}
                  />

                  <div style={{ display: "grid", gap: 10 }}>
                    {docRows.length === 0 ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: "#6b7280",
                          border: "1px dashed #d1d5db",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        Nessun documento azienda registrato.
                      </div>
                    ) : (
                      docRows.map((doc) => (
                        <div
                          key={doc.id}
                          style={{
                            display: "grid",
                            gap: 10,
                            border: "1px solid #f1f5f9",
                            borderRadius: 12,
                            padding: 12,
                            background: "#fcfcfd",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gap: 10,
                              gridTemplateColumns:
                                "minmax(180px, 1.2fr) minmax(140px, 0.8fr) minmax(220px, 1.2fr)",
                            }}
                          >
                            <label style={{ display: "block", fontSize: 12 }}>
                              Tipo documento
                              <input
                                list="document-type-options-aziende"
                                value={doc.tipo_documento}
                                onChange={(e) => updateDocumento(doc.id, { tipo_documento: e.target.value })}
                                style={{ width: "100%", padding: 8, marginTop: 6 }}
                              />
                            </label>
                            <label style={{ display: "block", fontSize: 12 }}>
                              Data scadenza
                              <input
                                type="date"
                                value={doc.data_scadenza}
                                onChange={(e) => updateDocumento(doc.id, { data_scadenza: e.target.value })}
                                style={{ width: "100%", padding: 8, marginTop: 6 }}
                              />
                            </label>
                            <label style={{ display: "block", fontSize: 12 }}>
                              File URL
                              <input
                                value={doc.file_url}
                                onChange={(e) => updateDocumento(doc.id, { file_url: e.target.value })}
                                style={{ width: "100%", padding: 8, marginTop: 6 }}
                              />
                            </label>
                          </div>

                          <label style={{ display: "block", fontSize: 12 }}>
                            Note
                            <textarea
                              value={doc.note}
                              onChange={(e) => updateDocumento(doc.id, { note: e.target.value })}
                              rows={2}
                              style={{ width: "100%", padding: 8, marginTop: 6 }}
                            />
                          </label>

                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => saveDocumento(doc)}
                              disabled={savingKey === `azienda-doc:${doc.id || "new"}`}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                border: "1px solid #111",
                                background: "#111",
                                color: "white",
                                cursor: "pointer",
                                opacity: savingKey === `azienda-doc:${doc.id || "new"}` ? 0.7 : 1,
                              }}
                            >
                              {savingKey === `azienda-doc:${doc.id || "new"}` ? "Salvataggio..." : "Salva documento"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDocumento(doc)}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                border: "1px solid #ddd",
                                background: "white",
                                cursor: "pointer",
                              }}
                            >
                              Elimina
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <datalist id="document-type-options-aziende">
        {documentTypeOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}
