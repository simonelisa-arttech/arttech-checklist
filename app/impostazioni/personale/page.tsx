"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import SafetyExpectedDocumentsPanel from "@/components/SafetyExpectedDocumentsPanel";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { dbFrom } from "@/lib/clientDbBroker";

type AziendaOption = {
  id: string;
  ragione_sociale: string;
};

type PersonaleRow = {
  id?: string;
  nome: string;
  cognome: string;
  azienda_id: string;
  tipo: "INTERNO" | "ESTERNO";
  telefono: string;
  email: string;
  attivo: boolean;
  created_at?: string | null;
  isNew?: boolean;
};

type PersonaleDocumentoRow = {
  id?: string;
  personale_id: string;
  tipo_documento: string;
  data_rilascio: string;
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

const PERSONALE_TIPO_OPTIONS = ["INTERNO", "ESTERNO"] as const;

function createTempId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function PersonalePage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [aziende, setAziende] = useState<AziendaOption[]>([]);
  const [persone, setPersone] = useState<PersonaleRow[]>([]);
  const [documenti, setDocumenti] = useState<PersonaleDocumentoRow[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeRow[]>([]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const [aziendeRes, personeRes, documentiRes, typesRes] = await Promise.all([
      dbFrom("aziende").select("id,ragione_sociale").eq("attiva", true).order("ragione_sociale", { ascending: true }),
      dbFrom("personale").select("*").order("cognome", { ascending: true }).order("nome", { ascending: true }),
      dbFrom("personale_documenti")
        .select("*")
        .order("data_scadenza", { ascending: true })
        .order("tipo_documento", { ascending: true }),
      dbFrom("document_types").select("*").order("codice", { ascending: true }),
    ]);

    const errors: string[] = [];
    if (aziendeRes.error) errors.push(`Errore caricamento aziende: ${aziendeRes.error.message}`);
    if (personeRes.error) errors.push(`Errore caricamento personale: ${personeRes.error.message}`);
    if (documentiRes.error) errors.push(`Errore caricamento documenti personale: ${documentiRes.error.message}`);
    if (typesRes.error) errors.push(`Errore caricamento tipi documento: ${typesRes.error.message}`);

    setAziende(
      (((aziendeRes.data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
        id: String(row.id || ""),
        ragione_sociale: String(row.ragione_sociale || ""),
      }))
    );
    setPersone(
      (((personeRes.data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
        id: String(row.id || ""),
        nome: String(row.nome || ""),
        cognome: String(row.cognome || ""),
        azienda_id: String(row.azienda_id || ""),
        tipo: String(row.tipo || "ESTERNO").toUpperCase() === "INTERNO" ? "INTERNO" : "ESTERNO",
        telefono: String(row.telefono || ""),
        email: String(row.email || ""),
        attivo: row.attivo !== false,
        created_at: row.created_at ?? null,
        isNew: false,
      }))
    );
    setDocumenti(
      (((documentiRes.data as any[]) || []) as Array<Record<string, any>>).map((row) => ({
        id: String(row.id || ""),
        personale_id: String(row.personale_id || ""),
        tipo_documento: String(row.tipo_documento || ""),
        data_rilascio: String(row.data_rilascio || ""),
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

  const companyById = useMemo(() => {
    const map = new Map<string, string>();
    for (const azienda of aziende) {
      map.set(azienda.id, azienda.ragione_sociale);
    }
    return map;
  }, [aziende]);

  const docsByPersonale = useMemo(() => {
    const map = new Map<string, PersonaleDocumentoRow[]>();
    for (const doc of documenti) {
      const key = String(doc.personale_id || "");
      if (!key) continue;
      const bucket = map.get(key) || [];
      bucket.push(doc);
      map.set(key, bucket);
    }
    return map;
  }, [documenti]);

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

  function addPersona() {
    setPersone((prev) => [
      {
        id: createTempId("personale"),
        nome: "",
        cognome: "",
        azienda_id: "",
        tipo: "ESTERNO",
        telefono: "",
        email: "",
        attivo: true,
        isNew: true,
      },
      ...prev,
    ]);
  }

  function updatePersona(targetId: string | undefined, patch: Partial<PersonaleRow>) {
    if (!targetId) return;
    setPersone((prev) =>
      prev.map((row) => (row.id === targetId ? { ...row, ...patch } : row))
    );
  }

  async function savePersona(row: PersonaleRow) {
    const nome = row.nome.trim();
    const cognome = row.cognome.trim();
    if (!nome || !cognome) {
      setError("Nome e cognome sono obbligatori.");
      return;
    }
    const email = row.email.trim();
    if (email && !email.includes("@")) {
      setError("Email non valida.");
      return;
    }

    setSavingKey(`personale:${row.id || "new"}`);
    setError(null);
    setNotice(null);

    const payload = {
      nome,
      cognome,
      azienda_id: row.azienda_id || null,
      tipo: row.tipo === "INTERNO" ? "INTERNO" : "ESTERNO",
      telefono: row.telefono.trim() || null,
      email: email || null,
      attivo: row.attivo,
    };

    const result = row.isNew
      ? await dbFrom("personale").insert(payload)
      : await dbFrom("personale").update(payload).eq("id", row.id || "");

    if (result.error) {
      setError(`Errore salvataggio personale: ${result.error.message}`);
      setSavingKey(null);
      return;
    }

    await loadData();
    setNotice(`Scheda ${nome} ${cognome} salvata.`);
    setSavingKey(null);
  }

  async function deletePersona(row: PersonaleRow) {
    if (row.isNew) {
      setPersone((prev) => prev.filter((current) => current.id !== row.id));
      return;
    }
    const ok = window.confirm(`Eliminare ${row.nome} ${row.cognome}?`);
    if (!ok) return;

    setSavingKey(`personale:${row.id || ""}`);
    const result = await dbFrom("personale").delete().eq("id", row.id || "");
    if (result.error) {
      setError(`Errore eliminazione personale: ${result.error.message}`);
      setSavingKey(null);
      return;
    }
    await loadData();
    setNotice("Scheda personale eliminata.");
    setSavingKey(null);
  }

  function addDocumento(personaleId: string) {
    setDocumenti((prev) => [
      {
        id: createTempId("personale-doc"),
        personale_id: personaleId,
        tipo_documento: "",
        data_rilascio: "",
        data_scadenza: "",
        note: "",
        file_url: "",
        isNew: true,
      },
      ...prev,
    ]);
  }

  function updateDocumento(targetId: string | undefined, patch: Partial<PersonaleDocumentoRow>) {
    if (!targetId) return;
    setDocumenti((prev) =>
      prev.map((row) => (row.id === targetId ? { ...row, ...patch } : row))
    );
  }

  async function saveDocumento(row: PersonaleDocumentoRow) {
    const tipoDocumento = row.tipo_documento.trim();
    if (!row.personale_id) {
      setError("Salva prima la persona per associare documenti.");
      return;
    }
    if (!tipoDocumento) {
      setError("Il tipo documento è obbligatorio.");
      return;
    }

    setSavingKey(`personale-doc:${row.id || "new"}`);
    setError(null);
    setNotice(null);

    const payload = {
      personale_id: row.personale_id,
      tipo_documento: tipoDocumento,
      data_rilascio: row.data_rilascio || null,
      data_scadenza: row.data_scadenza || null,
      note: row.note.trim() || null,
      file_url: row.file_url.trim() || null,
    };

    const result = row.isNew
      ? await dbFrom("personale_documenti").insert(payload)
      : await dbFrom("personale_documenti").update(payload).eq("id", row.id || "");

    if (result.error) {
      setError(`Errore salvataggio documento personale: ${result.error.message}`);
      setSavingKey(null);
      return;
    }

    await loadData();
    setNotice(`Documento ${tipoDocumento} salvato.`);
    setSavingKey(null);
  }

  async function deleteDocumento(row: PersonaleDocumentoRow) {
    if (row.isNew) {
      setDocumenti((prev) => prev.filter((current) => current.id !== row.id));
      return;
    }
    const ok = window.confirm(`Eliminare il documento ${row.tipo_documento || "selezionato"}?`);
    if (!ok) return;

    setSavingKey(`personale-doc:${row.id || ""}`);
    const result = await dbFrom("personale_documenti").delete().eq("id", row.id || "");
    if (result.error) {
      setError(`Errore eliminazione documento personale: ${result.error.message}`);
      setSavingKey(null);
      return;
    }
    await loadData();
    setNotice("Documento personale eliminato.");
    setSavingKey(null);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "24px auto", padding: 16, paddingBottom: 56 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>Personale</h1>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            Personale interno/esterno con collegamento azienda e documenti sicurezza.
          </div>
        </div>
        <Link
          href="/impostazioni/aziende"
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
          Aziende
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
          onClick={addPersona}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
          }}
        >
          + Nuova persona
        </button>
      </div>

      {loading ? (
        <div style={{ marginTop: 18, opacity: 0.7 }}>Caricamento...</div>
      ) : (
        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          {persone.length === 0 ? (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "white" }}>
              Nessuna persona configurata.
            </div>
          ) : (
            persone.map((persona) => {
              const docRows = docsByPersonale.get(String(persona.id || "")) || [];
              return (
                <div
                  key={persona.id}
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
                      gridTemplateColumns:
                        "minmax(150px, 1fr) minmax(150px, 1fr) minmax(200px, 1.4fr) 170px 160px 200px 100px",
                      alignItems: "end",
                    }}
                  >
                    <label style={{ display: "block", fontSize: 12 }}>
                      Nome
                      <input
                        value={persona.nome}
                        onChange={(e) => updatePersona(persona.id, { nome: e.target.value })}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", fontSize: 12 }}>
                      Cognome
                      <input
                        value={persona.cognome}
                        onChange={(e) => updatePersona(persona.id, { cognome: e.target.value })}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", fontSize: 12 }}>
                      Azienda
                      <select
                        value={persona.azienda_id}
                        onChange={(e) => updatePersona(persona.id, { azienda_id: e.target.value })}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      >
                        <option value="">— Nessuna azienda —</option>
                        {aziende.map((azienda) => (
                          <option key={azienda.id} value={azienda.id}>
                            {azienda.ragione_sociale}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "block", fontSize: 12 }}>
                      Tipo
                      <select
                        value={persona.tipo}
                        onChange={(e) =>
                          updatePersona(persona.id, {
                            tipo: e.target.value === "INTERNO" ? "INTERNO" : "ESTERNO",
                          })
                        }
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      >
                        {PERSONALE_TIPO_OPTIONS.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "block", fontSize: 12 }}>
                      Telefono
                      <input
                        value={persona.telefono}
                        onChange={(e) => updatePersona(persona.id, { telefono: e.target.value })}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label style={{ display: "block", fontSize: 12 }}>
                      Email
                      <input
                        value={persona.email}
                        onChange={(e) => updatePersona(persona.id, { email: e.target.value })}
                        style={{ width: "100%", padding: 8, marginTop: 6 }}
                      />
                    </label>
                    <label
                      style={{
                        display: "inline-flex",
                        gap: 8,
                        alignItems: "center",
                        justifySelf: "start",
                        alignSelf: "center",
                        fontSize: 12,
                        marginTop: 24,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={persona.attivo}
                        onChange={(e) => updatePersona(persona.id, { attivo: e.target.checked })}
                      />
                      Attivo
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      {persona.isNew
                        ? "Salva la persona per abilitare i documenti."
                        : `${companyById.get(persona.azienda_id) || "Nessuna azienda"} · ${docRows.length} documenti`}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => savePersona(persona)}
                        disabled={savingKey === `personale:${persona.id || "new"}`}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #111",
                          background: "#111",
                          color: "white",
                          cursor: "pointer",
                          opacity: savingKey === `personale:${persona.id || "new"}` ? 0.7 : 1,
                        }}
                      >
                        {savingKey === `personale:${persona.id || "new"}` ? "Salvataggio..." : "Salva persona"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePersona(persona)}
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
                        onClick={() => (persona.isNew ? null : addDocumento(String(persona.id || "")))}
                        disabled={persona.isNew}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #d1d5db",
                          background: "#f9fafb",
                          cursor: persona.isNew ? "default" : "pointer",
                          opacity: persona.isNew ? 0.55 : 1,
                        }}
                      >
                        + Documento persona
                      </button>
                    </div>
                  </div>

                  <SafetyExpectedDocumentsPanel
                    kind="PERSONALE"
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
                        Nessun documento personale registrato.
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
                                "minmax(180px, 1.1fr) minmax(140px, 0.8fr) minmax(140px, 0.8fr) minmax(220px, 1.2fr)",
                            }}
                          >
                            <label style={{ display: "block", fontSize: 12 }}>
                              Tipo documento
                              <input
                                list="document-type-options-personale"
                                value={doc.tipo_documento}
                                onChange={(e) => updateDocumento(doc.id, { tipo_documento: e.target.value })}
                                style={{ width: "100%", padding: 8, marginTop: 6 }}
                              />
                            </label>
                            <label style={{ display: "block", fontSize: 12 }}>
                              Data rilascio
                              <input
                                type="date"
                                value={doc.data_rilascio}
                                onChange={(e) => updateDocumento(doc.id, { data_rilascio: e.target.value })}
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
                              disabled={savingKey === `personale-doc:${doc.id || "new"}`}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                border: "1px solid #111",
                                background: "#111",
                                color: "white",
                                cursor: "pointer",
                                opacity: savingKey === `personale-doc:${doc.id || "new"}` ? 0.7 : 1,
                              }}
                            >
                              {savingKey === `personale-doc:${doc.id || "new"}` ? "Salvataggio..." : "Salva documento"}
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

      <datalist id="document-type-options-personale">
        {documentTypeOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}
