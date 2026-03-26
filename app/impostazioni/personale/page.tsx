"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfigMancante from "@/components/ConfigMancante";
import SafetyExpectedDocumentsPanel from "@/components/SafetyExpectedDocumentsPanel";
import { storageSignedUrl, storageUpload } from "@/lib/clientStorageApi";
import { PERSONALE_STANDARD_DOCUMENTS } from "@/lib/safetyCompliance";
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
  giorni_preavviso: string;
  alert_frequenza: string;
  alert_stato: string;
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
const PERSONALE_DOCUMENTI_STORAGE_PREFIX = "personale-documenti";
const PERSONALE_DOCUMENTI_STORAGE_SCHEME = "storage://checklist-documents/";

function createTempId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildDocumentTypeCode(label: string) {
  return label
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getDocumentTypeLabel(row: DocumentTypeRow) {
  const nome = String(row.nome || "").trim();
  if (nome) return nome;
  return String(row.codice || "")
    .trim()
    .replace(/^PERSONALE_+/i, "")
    .replace(/^AZIENDA_+/i, "")
    .replace(/_/g, " ")
    .trim();
}

function buildPersonaleDocumentTypeOptions(documentTypes: DocumentTypeRow[]) {
  return Array.from(
    new Set([
      ...PERSONALE_STANDARD_DOCUMENTS.map((item) => item.label),
      ...documentTypes.map((row) => getDocumentTypeLabel(row)),
    ].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "it"));
}

function isHttpUrl(value?: string | null) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isStorageDocumentUrl(value?: string | null) {
  return String(value || "").startsWith(PERSONALE_DOCUMENTI_STORAGE_SCHEME);
}

function getStoragePathFromDocumentUrl(value?: string | null) {
  const raw = String(value || "");
  if (!raw.startsWith(PERSONALE_DOCUMENTI_STORAGE_SCHEME)) return "";
  return raw.slice(PERSONALE_DOCUMENTI_STORAGE_SCHEME.length);
}

function parseDateOnly(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDocumentoBadgeState(doc: PersonaleDocumentoRow) {
  const expiry = parseDateOnly(doc.data_scadenza);
  if (!expiry) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (expiry < today) return "SCADUTO" as const;

  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const preavvisoRaw = String(doc.giorni_preavviso || "").trim();
  const preavviso = preavvisoRaw ? Number(preavvisoRaw) : 30;
  if (Number.isFinite(preavviso) && diffDays <= preavviso) return "IN_SCADENZA" as const;

  return null;
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
  const [search, setSearch] = useState("");
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [editingDocumentoId, setEditingDocumentoId] = useState<string | null>(null);
  const [documentFileById, setDocumentFileById] = useState<Record<string, File | null>>({});
  const [documentRowErrorById, setDocumentRowErrorById] = useState<Record<string, string | null>>({});
  const [newDocumentTypeOpen, setNewDocumentTypeOpen] = useState(false);
  const [newDocumentTypeName, setNewDocumentTypeName] = useState("");

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
        giorni_preavviso:
          row.giorni_preavviso == null || row.giorni_preavviso === ""
            ? ""
            : String(row.giorni_preavviso),
        alert_frequenza: String(row.alert_frequenza || ""),
        alert_stato: String(row.alert_stato || ""),
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
    () => buildPersonaleDocumentTypeOptions(documentTypes),
    [documentTypes]
  );

  const filteredPersone = useMemo(() => {
    const query = normalizeText(search);
    if (!query) return persone;
    return persone.filter((persona) =>
      normalizeText(`${persona.nome} ${persona.cognome}`).includes(query)
    );
  }, [persone, search]);

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
    const tempId = createTempId("personale-doc");
    if (!documentTypeOptions.length) {
      setError("Aggiungi prima almeno un tipo documento standard.");
      return;
    }
    setDocumenti((prev) => [
      {
        id: tempId,
        personale_id: personaleId,
        tipo_documento: "",
        data_rilascio: "",
        data_scadenza: "",
        giorni_preavviso: "",
        alert_frequenza: "",
        alert_stato: "",
        note: "",
        file_url: "",
        isNew: true,
      },
      ...prev,
    ]);
    setEditingDocumentoId(tempId);
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
      giorni_preavviso: row.giorni_preavviso.trim() ? Number(row.giorni_preavviso) : null,
      alert_frequenza: row.alert_frequenza.trim() || null,
      alert_stato: row.alert_stato.trim() || null,
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
    setEditingDocumentoId(null);
    setSavingKey(null);
  }

  async function uploadDocumentoFile(row: PersonaleDocumentoRow) {
    const rowId = String(row.id || "");
    const file = documentFileById[rowId];
    if (!file) {
      setDocumentRowErrorById((prev) => ({ ...prev, [rowId]: "Seleziona prima un file." }));
      return;
    }
    if (row.isNew || !rowId) {
      setDocumentRowErrorById((prev) => ({
        ...prev,
        [rowId]: "Salva prima il documento, poi carica il file associato.",
      }));
      return;
    }

    setSavingKey(`personale-doc-upload:${rowId}`);
    setDocumentRowErrorById((prev) => ({ ...prev, [rowId]: null }));
    setError(null);
    setNotice(null);

    const safeName = file.name.replace(/\s+/g, "_");
    const storagePath = `${PERSONALE_DOCUMENTI_STORAGE_PREFIX}/${row.personale_id}/${rowId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await storageUpload(storagePath, file);
    if (uploadError) {
      setDocumentRowErrorById((prev) => ({
        ...prev,
        [rowId]: `Errore upload file: ${uploadError.message}`,
      }));
      setSavingKey(null);
      return;
    }

    setDocumenti((prev) =>
      prev.map((current) =>
        current.id === rowId
          ? { ...current, file_url: `${PERSONALE_DOCUMENTI_STORAGE_SCHEME}${storagePath}` }
          : current
      )
    );
    setDocumentFileById((prev) => ({ ...prev, [rowId]: null }));
    setNotice(`File caricato per ${row.tipo_documento || "documento"}. Salva il documento per confermare il link.`);
    setSavingKey(null);
  }

  async function openDocumentoFile(row: PersonaleDocumentoRow) {
    const rowId = String(row.id || "");
    const rawUrl = String(row.file_url || "").trim();
    if (!rawUrl) {
      setDocumentRowErrorById((prev) => ({ ...prev, [rowId]: "Nessun file o link associato." }));
      return;
    }
    if (isHttpUrl(rawUrl)) {
      window.open(rawUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const storagePath = getStoragePathFromDocumentUrl(rawUrl);
    if (!storagePath) {
      setDocumentRowErrorById((prev) => ({ ...prev, [rowId]: "URL file non valido." }));
      return;
    }
    const { data, error: signedUrlError } = await storageSignedUrl(storagePath);
    if (signedUrlError || !data?.signedUrl) {
      setDocumentRowErrorById((prev) => ({
        ...prev,
        [rowId]: `Errore apertura file: ${signedUrlError?.message || "URL non disponibile"}`,
      }));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDocumento(row: PersonaleDocumentoRow) {
    if (row.isNew) {
      setDocumenti((prev) => prev.filter((current) => current.id !== row.id));
      if (editingDocumentoId === row.id) setEditingDocumentoId(null);
      setDocumentFileById((prev) => {
        const next = { ...prev };
        delete next[String(row.id || "")];
        return next;
      });
      setDocumentRowErrorById((prev) => {
        const next = { ...prev };
        delete next[String(row.id || "")];
        return next;
      });
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
    if (editingDocumentoId === row.id) setEditingDocumentoId(null);
    setSavingKey(null);
  }

  async function addDocumentType() {
    const nome = newDocumentTypeName.trim();
    if (!nome) {
      setError("Inserisci il nome del nuovo tipo documento.");
      return;
    }
    if (documentTypeOptions.some((option) => normalizeText(option) === normalizeText(nome))) {
      setError("Questo tipo documento esiste già.");
      return;
    }

    setSavingKey("document-type:personale");
    setError(null);
    setNotice(null);

    const result = await dbFrom("document_types").insert({
      codice: buildDocumentTypeCode(nome),
      nome,
    });

    if (result.error) {
      setError(`Errore salvataggio tipo documento: ${result.error.message}`);
      setSavingKey(null);
      return;
    }

    await loadData();
    setNewDocumentTypeName("");
    setNewDocumentTypeOpen(false);
    setNotice(`Tipo documento ${nome} aggiunto.`);
    setSavingKey(null);
  }

  function updateDocumentType(targetId: string, patch: Partial<DocumentTypeRow>) {
    setDocumentTypes((prev) =>
      prev.map((row) => (row.id === targetId ? { ...row, ...patch } : row))
    );
  }

  async function saveDocumentType(row: DocumentTypeRow) {
    const nome = String(row.nome || "").trim();
    if (!nome) {
      setError("Il nome del tipo documento è obbligatorio.");
      return;
    }
    if (
      documentTypes.some(
        (option) => option.id !== row.id && normalizeText(getDocumentTypeLabel(option)) === normalizeText(nome)
      )
    ) {
      setError("Esiste già un tipo documento con questo nome.");
      return;
    }

    setSavingKey(`document-type:${row.id}`);
    setError(null);
    setNotice(null);

    const result = await dbFrom("document_types")
      .update({
        nome,
        codice: buildDocumentTypeCode(nome),
      })
      .eq("id", row.id);

    if (result.error) {
      setError(`Errore aggiornamento tipo documento: ${result.error.message}`);
      setSavingKey(null);
      return;
    }

    await loadData();
    setNotice(`Tipo documento ${nome} aggiornato.`);
    setSavingKey(null);
  }

  async function deleteDocumentType(row: DocumentTypeRow) {
    const label = getDocumentTypeLabel(row) || "selezionato";
    const ok = window.confirm(`Eliminare il tipo documento ${label}?`);
    if (!ok) return;

    setSavingKey(`document-type:${row.id}`);
    setError(null);
    setNotice(null);

    const result = await dbFrom("document_types").delete().eq("id", row.id);
    if (result.error) {
      setError(`Errore eliminazione tipo documento: ${result.error.message}`);
      setSavingKey(null);
      return;
    }

    await loadData();
    setNotice(`Tipo documento ${label} eliminato.`);
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
        <button
          type="button"
          onClick={() => setNewDocumentTypeOpen((prev) => !prev)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            cursor: "pointer",
          }}
        >
          + Documento
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca nome o cognome"
          style={{
            marginLeft: "auto",
            minWidth: 240,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
          }}
        />
      </div>

      {newDocumentTypeOpen ? (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "white",
            padding: 12,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 6, minWidth: 280, fontSize: 12 }}>
              Nuovo tipo documento necessario
              <input
                value={newDocumentTypeName}
                onChange={(e) => setNewDocumentTypeName(e.target.value)}
                placeholder="Es. PLE / patentino speciale"
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <button
              type="button"
              onClick={addDocumentType}
              disabled={savingKey === "document-type:personale"}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                cursor: "pointer",
                opacity: savingKey === "document-type:personale" ? 0.7 : 1,
              }}
            >
              {savingKey === "document-type:personale" ? "Salvataggio..." : "Salva tipo"}
            </button>
          </div>

          {documentTypes.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                Tipi documento aggiunti
              </div>
              {documentTypes.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "minmax(240px, 1fr) auto auto",
                    alignItems: "center",
                  }}
                >
                  <input
                    value={row.nome || getDocumentTypeLabel(row)}
                    onChange={(e) => updateDocumentType(row.id, { nome: e.target.value })}
                    placeholder="Nome tipo documento"
                    style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                  <button
                    type="button"
                    onClick={() => saveDocumentType(row)}
                    disabled={savingKey === `document-type:${row.id}`}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      cursor: "pointer",
                      opacity: savingKey === `document-type:${row.id}` ? 0.7 : 1,
                    }}
                  >
                    {savingKey === `document-type:${row.id}` ? "Salvataggio..." : "Salva"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDocumentType(row)}
                    disabled={savingKey === `document-type:${row.id}`}
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
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 18, opacity: 0.7 }}>Caricamento...</div>
      ) : (
        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          {filteredPersone.length === 0 ? (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "white" }}>
              {persone.length === 0 ? "Nessuna persona configurata." : "Nessun risultato per la ricerca."}
            </div>
          ) : (
            filteredPersone.map((persona) => {
              const personId = String(persona.id || "");
              const docRows = docsByPersonale.get(personId) || [];
              const isExpanded = expandedPersonId === personId;
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
                        onClick={() =>
                          setExpandedPersonId((prev) => (prev === personId ? null : personId))
                        }
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #d1d5db",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        Elenco
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
                        onClick={() => (persona.isNew ? null : addDocumento(personId))}
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

                  {isExpanded ? (
                    <>
                      <SafetyExpectedDocumentsPanel
                        kind="PERSONALE"
                        extraDocumentLabels={documentTypeOptions}
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
                          docRows.map((doc) => {
                            const docTypeChoices =
                              doc.tipo_documento && !documentTypeOptions.includes(doc.tipo_documento)
                                ? [doc.tipo_documento, ...documentTypeOptions]
                                : documentTypeOptions;
                            const isEditing = doc.isNew || editingDocumentoId === doc.id;
                            const rowId = String(doc.id || "");
                            const hasFileUrl =
                              isHttpUrl(doc.file_url.trim()) || isStorageDocumentUrl(doc.file_url.trim());
                            const rowError = documentRowErrorById[rowId];
                            const selectedFile = documentFileById[rowId];
                            const badgeState = getDocumentoBadgeState(doc);
                            const badgeStyle =
                              badgeState === "SCADUTO"
                                ? {
                                    background: "#fee2e2",
                                    color: "#991b1b",
                                    border: "1px solid #fecaca",
                                  }
                                : badgeState === "IN_SCADENZA"
                                  ? {
                                      background: "#ffedd5",
                                      color: "#c2410c",
                                      border: "1px solid #fdba74",
                                    }
                                  : null;
                            return (
                              <div
                                key={doc.id}
                                style={{
                                  display: "grid",
                                  gap: 10,
                                  border:
                                    badgeState === "SCADUTO"
                                      ? "1px solid #fecaca"
                                      : badgeState === "IN_SCADENZA"
                                        ? "1px solid #fdba74"
                                        : "1px solid #f1f5f9",
                                  borderRadius: 12,
                                  padding: 12,
                                  background:
                                    badgeState === "SCADUTO"
                                      ? "#fff7f7"
                                      : badgeState === "IN_SCADENZA"
                                        ? "#fffaf5"
                                        : "#fcfcfd",
                                }}
                              >
                                {rowError ? (
                                  <div style={{ fontSize: 12, color: "#b91c1c" }}>{rowError}</div>
                                ) : null}
                                {isEditing ? (
                                  <>
                                    <div
                                      style={{
                                        display: "grid",
                                        gap: 10,
                                        gridTemplateColumns:
                                          "minmax(180px, 1.1fr) minmax(140px, 0.8fr) minmax(140px, 0.8fr) minmax(120px, 0.7fr) minmax(150px, 0.8fr) minmax(150px, 0.8fr) minmax(220px, 1.2fr)",
                                      }}
                                    >
                                      <label style={{ display: "block", fontSize: 12 }}>
                                        Tipo documento
                                        <select
                                          value={doc.tipo_documento}
                                          onChange={(e) => updateDocumento(doc.id, { tipo_documento: e.target.value })}
                                          style={{ width: "100%", padding: 8, marginTop: 6 }}
                                        >
                                          <option value="">— Seleziona —</option>
                                          {docTypeChoices.map((option) => (
                                            <option key={option} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                        </select>
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
                                        Preavviso
                                        <input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={doc.giorni_preavviso}
                                          onChange={(e) =>
                                            updateDocumento(doc.id, { giorni_preavviso: e.target.value })
                                          }
                                          placeholder="giorni"
                                          style={{ width: "100%", padding: 8, marginTop: 6 }}
                                        />
                                      </label>
                                      <label style={{ display: "block", fontSize: 12 }}>
                                        Frequenza alert
                                        <select
                                          value={doc.alert_frequenza}
                                          onChange={(e) =>
                                            updateDocumento(doc.id, { alert_frequenza: e.target.value })
                                          }
                                          style={{ width: "100%", padding: 8, marginTop: 6 }}
                                        >
                                          <option value="">—</option>
                                          <option value="ONCE">ONCE</option>
                                          <option value="DAILY">DAILY</option>
                                          <option value="WEEKLY">WEEKLY</option>
                                        </select>
                                      </label>
                                      <label style={{ display: "block", fontSize: 12 }}>
                                        Stato alert
                                        <select
                                          value={doc.alert_stato}
                                          onChange={(e) =>
                                            updateDocumento(doc.id, { alert_stato: e.target.value })
                                          }
                                          style={{ width: "100%", padding: 8, marginTop: 6 }}
                                        >
                                          <option value="">—</option>
                                          <option value="ATTIVO">ATTIVO</option>
                                          <option value="SOSPESO">SOSPESO</option>
                                          <option value="COMPLETATO">COMPLETATO</option>
                                        </select>
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
                                      <input
                                        type="file"
                                        onChange={(e) =>
                                          setDocumentFileById((prev) => ({
                                            ...prev,
                                            [rowId]: e.target.files?.[0] || null,
                                          }))
                                        }
                                        style={{ maxWidth: 260 }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => uploadDocumentoFile(doc)}
                                        disabled={savingKey === `personale-doc-upload:${rowId}`}
                                        style={{
                                          padding: "8px 12px",
                                          borderRadius: 10,
                                          border: "1px solid #d1d5db",
                                          background: "white",
                                          cursor: "pointer",
                                          opacity: savingKey === `personale-doc-upload:${rowId}` ? 0.7 : 1,
                                        }}
                                      >
                                        {savingKey === `personale-doc-upload:${rowId}` ? "Caricamento..." : "Carica file"}
                                      </button>
                                      <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center", marginRight: "auto" }}>
                                        {selectedFile?.name || (hasFileUrl ? "File già associato" : "Nessun file selezionato")}
                                      </div>
                                      {!doc.isNew ? (
                                        <button
                                          type="button"
                                          onClick={() => setEditingDocumentoId(null)}
                                          style={{
                                            padding: "8px 12px",
                                            borderRadius: 10,
                                            border: "1px solid #d1d5db",
                                            background: "white",
                                            cursor: "pointer",
                                          }}
                                        >
                                          Annulla
                                        </button>
                                      ) : null}
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
                                  </>
                                ) : (
                                  <>
                                    <div
                                      style={{
                                        display: "grid",
                                        gap: 10,
                                        gridTemplateColumns:
                                          "minmax(180px, 1.1fr) minmax(140px, 0.8fr) minmax(140px, 0.8fr) minmax(120px, 0.7fr) minmax(150px, 0.8fr) minmax(150px, 0.8fr) minmax(220px, 1.2fr)",
                                      }}
                                    >
                                      <div style={{ display: "grid", gap: 6 }}>
                                        <div style={{ fontSize: 12, color: "#6b7280" }}>Tipo documento</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                          <span style={{ fontWeight: 600 }}>{doc.tipo_documento || "—"}</span>
                                          {badgeState && badgeStyle ? (
                                            <span
                                              style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                padding: "2px 8px",
                                                borderRadius: 999,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                ...badgeStyle,
                                              }}
                                            >
                                              {badgeState === "SCADUTO" ? "SCADUTO" : "IN SCADENZA"}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                      <div style={{ display: "grid", gap: 6 }}>
                                        <div style={{ fontSize: 12, color: "#6b7280" }}>Data rilascio</div>
                                        <div>{doc.data_rilascio || "—"}</div>
                                      </div>
                                      <div style={{ display: "grid", gap: 6 }}>
                                        <div style={{ fontSize: 12, color: "#6b7280" }}>Data scadenza</div>
                                        <div>{doc.data_scadenza || "—"}</div>
                                      </div>
                                      <div style={{ display: "grid", gap: 6 }}>
                                        <div style={{ fontSize: 12, color: "#6b7280" }}>Preavviso</div>
                                        <div>
                                          {doc.giorni_preavviso ? `Preavviso: ${doc.giorni_preavviso} giorni` : "—"}
                                        </div>
                                      </div>
                                      <div style={{ display: "grid", gap: 6 }}>
                                        <div style={{ fontSize: 12, color: "#6b7280" }}>Frequenza alert</div>
                                        <div>{doc.alert_frequenza || "—"}</div>
                                      </div>
                                      <div style={{ display: "grid", gap: 6 }}>
                                        <div style={{ fontSize: 12, color: "#6b7280" }}>Stato alert</div>
                                        <div>{doc.alert_stato || "—"}</div>
                                      </div>
                                      <div style={{ display: "grid", gap: 6 }}>
                                        <div style={{ fontSize: 12, color: "#6b7280" }}>File / link</div>
                                        <div
                                          style={{
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                          }}
                                          title={doc.file_url || undefined}
                                        >
                                          {doc.file_url || "—"}
                                        </div>
                                      </div>
                                    </div>

                                    <div style={{ display: "grid", gap: 6 }}>
                                      <div style={{ fontSize: 12, color: "#6b7280" }}>Note</div>
                                      <div style={{ whiteSpace: "pre-wrap" }}>{doc.note || "—"}</div>
                                    </div>

                                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                      <button
                                        type="button"
                                        onClick={() => setEditingDocumentoId(doc.id || null)}
                                        style={{
                                          padding: "8px 12px",
                                          borderRadius: 10,
                                          border: "1px solid #d1d5db",
                                          background: "white",
                                          cursor: "pointer",
                                        }}
                                      >
                                        Modifica
                                      </button>
                                      {hasFileUrl ? (
                                        <button
                                          type="button"
                                          onClick={() => void openDocumentoFile(doc)}
                                          style={{
                                            padding: "8px 12px",
                                            borderRadius: 10,
                                            border: "1px solid #d1d5db",
                                            background: "white",
                                            cursor: "pointer",
                                          }}
                                        >
                                          Apri
                                        </button>
                                      ) : null}
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
                                  </>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
