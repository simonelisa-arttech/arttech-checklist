export type SafetyStatus = "CONFORME" | "IN_SCADENZA" | "NON_CONFORME" | "NON_ASSEGNATO";

export type SafetyAziendaRow = {
  id: string;
  ragione_sociale: string;
  tipo: string | null;
  attiva?: boolean | null;
};

export type SafetyPersonaleRow = {
  id: string;
  nome: string;
  cognome: string;
  azienda_id: string | null;
  tipo: string | null;
  attivo?: boolean | null;
};

export type SafetyPersonaleDocumentoRow = {
  id: string;
  personale_id: string;
  tipo_documento: string;
  data_scadenza: string | null;
};

export type SafetyAziendaDocumentoRow = {
  id: string;
  azienda_id: string;
  tipo_documento: string;
  data_scadenza: string | null;
};

export type SafetyDataset = {
  aziende: SafetyAziendaRow[];
  personale: SafetyPersonaleRow[];
  personaleDocumenti: SafetyPersonaleDocumentoRow[];
  aziendeDocumenti: SafetyAziendaDocumentoRow[];
};

type DocCheck = {
  label: string;
  status: SafetyStatus;
  reason: string;
};

export type SafetyComplianceResult = {
  status: SafetyStatus;
  label: string;
  summary: string;
  tooltip: string;
  highlights: string[];
  matchedPersonale: string[];
  matchedAziende: string[];
  unknownAssignments: string[];
};

export type SafetyDocumentState = "PRESENTE_VALIDO" | "IN_SCADENZA" | "SCADUTO" | "MANCANTE";

export type SafetyExpectedDocumentItem = {
  key: string;
  label: string;
  required: boolean;
  state: SafetyDocumentState;
  detail: string;
};

const PERSONALE_REQUIRED = [
  { key: "VISITA_MEDICA", label: "Visita medica" },
  { key: "FORMAZIONE_GENERALE", label: "Formazione generale" },
  { key: "FORMAZIONE_SPECIFICA", label: "Formazione specifica" },
] as const;

export const PERSONALE_STANDARD_DOCUMENTS = [
  ...PERSONALE_REQUIRED,
  { key: "LAVORI_IN_QUOTA", label: "Lavori in quota" },
  { key: "PRIMO_SOCCORSO", label: "Primo soccorso" },
  { key: "ANTINCENDIO", label: "Antincendio" },
  { key: "PATENTE_PATENTINI", label: "Patente / patentini" },
] as const;

const AZIENDA_REQUIRED = [
  { key: "DURC", label: "DURC" },
  { key: "VISURA_CAMERALE", label: "Visura camerale" },
] as const;

export const AZIENDA_STANDARD_DOCUMENTS = [
  ...AZIENDA_REQUIRED,
  { key: "DVR", label: "DVR" },
  { key: "POS", label: "POS" },
  { key: "ASSICURAZIONE_IMPRESA", label: "Assicurazione / documento impresa" },
] as const;

const EXPIRING_DAYS = 30;

function normalizeText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateLabel(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "senza scadenza";
  const dt = new Date(`${raw}T00:00:00`);
  if (!Number.isFinite(dt.getTime())) return raw;
  return dt.toLocaleDateString("it-IT");
}

function classifyPersonaleDoc(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return "ALTRO";
  if (normalized.includes("visita medica") || normalized.includes("idoneita")) return "VISITA_MEDICA";
  if (normalized.includes("formazione") && normalized.includes("generale")) {
    return "FORMAZIONE_GENERALE";
  }
  if (normalized.includes("formazione") && normalized.includes("specifica")) {
    return "FORMAZIONE_SPECIFICA";
  }
  if (normalized.includes("quota")) return "LAVORI_IN_QUOTA";
  if (normalized.includes("primo soccorso")) return "PRIMO_SOCCORSO";
  if (normalized.includes("antincendio")) return "ANTINCENDIO";
  if (normalized.includes("patente") || normalized.includes("patentino")) return "PATENTE_PATENTINI";
  if (
    normalized.includes("abilit") ||
    normalized.includes("corso")
  ) {
    return "ABILITAZIONE";
  }
  return "ALTRO";
}

function classifyAziendaDoc(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return "ALTRO";
  if (normalized.includes("durc")) return "DURC";
  if (normalized.includes("visura") && normalized.includes("camer")) return "VISURA_CAMERALE";
  if (normalized.includes("dvr")) return "DVR";
  if (normalized.includes("pos")) return "POS";
  if (normalized.includes("assicurazione") || normalized.includes("impresa")) return "ASSICURAZIONE_IMPRESA";
  if (normalized.includes("sicurezza")) return "SICUREZZA_AZIENDA";
  return "ALTRO";
}

function getDateSeverity(value?: string | null): SafetyStatus {
  const raw = String(value || "").trim();
  if (!raw) return "CONFORME";
  const today = new Date();
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expiry = new Date(`${raw}T00:00:00`);
  if (!Number.isFinite(expiry.getTime())) return "NON_CONFORME";
  if (expiry < currentDay) return "NON_CONFORME";
  const limit = new Date(currentDay);
  limit.setDate(limit.getDate() + EXPIRING_DAYS);
  if (expiry <= limit) return "IN_SCADENZA";
  return "CONFORME";
}

function getDocumentState(value?: string | null): SafetyDocumentState {
  const severity = getDateSeverity(value);
  if (!String(value || "").trim()) return "PRESENTE_VALIDO";
  if (severity === "NON_CONFORME") return "SCADUTO";
  if (severity === "IN_SCADENZA") return "IN_SCADENZA";
  return "PRESENTE_VALIDO";
}

function toAssignmentTokens(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[\n,;|]+/g)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  );
}

function candidateSearchTerms(token: string) {
  const trimmed = token.trim();
  const parts = [
    trimmed,
    trimmed.split(" - ")[0] || "",
    trimmed.split("(")[0] || "",
    trimmed.split(":")[0] || "",
    trimmed.split("/")[0] || "",
  ];
  return Array.from(new Set(parts.map((part) => normalizeText(part)).filter(Boolean)));
}

function matchPersonaleToken(token: string, personale: SafetyPersonaleRow[]) {
  const candidates = candidateSearchTerms(token);
  if (!candidates.length) return null;
  return (
    personale.find((row) => {
      const fullName = normalizeText(`${row.nome} ${row.cognome}`);
      if (!fullName) return false;
      return candidates.some(
        (candidate) =>
          candidate === fullName ||
          candidate.includes(fullName) ||
          (candidate.length >= 5 && fullName.includes(candidate))
      );
    }) || null
  );
}

function matchAziendaToken(token: string, aziende: SafetyAziendaRow[]) {
  const candidates = candidateSearchTerms(token);
  if (!candidates.length) return null;
  return (
    aziende.find((row) => {
      const company = normalizeText(row.ragione_sociale);
      if (!company) return false;
      return candidates.some(
        (candidate) =>
          candidate === company ||
          candidate.includes(company) ||
          (candidate.length >= 5 && company.includes(candidate))
      );
    }) || null
  );
}

function buildDocCheck(label: string, expiry?: string | null): DocCheck {
  const severity = getDateSeverity(expiry);
  if (severity === "NON_CONFORME") {
    return { label, status: severity, reason: `${label} scaduto (${formatDateLabel(expiry)})` };
  }
  if (severity === "IN_SCADENZA") {
    return { label, status: severity, reason: `${label} in scadenza (${formatDateLabel(expiry)})` };
  }
  return { label, status: "CONFORME", reason: `${label} valido (${formatDateLabel(expiry)})` };
}

function selectPreferredDoc<T extends { data_scadenza: string | null }>(docs: T[]) {
  if (docs.length <= 1) return docs[0] || null;
  const withoutExpiry = docs.find((doc) => !String(doc.data_scadenza || "").trim());
  if (withoutExpiry) return withoutExpiry;
  return [...docs].sort((a, b) => String(b.data_scadenza || "").localeCompare(String(a.data_scadenza || "")))[0] || null;
}

export function evaluatePersonaleExpectedDocuments(
  docs: Array<{ tipo_documento: string; data_scadenza: string | null }>
): SafetyExpectedDocumentItem[] {
  return PERSONALE_STANDARD_DOCUMENTS.map((item) => {
    const matching = docs.filter((doc) => classifyPersonaleDoc(doc.tipo_documento) === item.key);
    const selected = selectPreferredDoc(matching);
    if (!selected) {
      return {
        key: item.key,
        label: item.label,
        required: PERSONALE_REQUIRED.some((required) => required.key === item.key),
        state: "MANCANTE",
        detail: `${item.label} mancante`,
      };
    }
    const state = getDocumentState(selected.data_scadenza);
    return {
      key: item.key,
      label: item.label,
      required: PERSONALE_REQUIRED.some((required) => required.key === item.key),
      state,
      detail:
        state === "SCADUTO"
          ? `${item.label} scaduto (${formatDateLabel(selected.data_scadenza)})`
          : state === "IN_SCADENZA"
          ? `${item.label} in scadenza (${formatDateLabel(selected.data_scadenza)})`
          : `${item.label} valido (${formatDateLabel(selected.data_scadenza)})`,
    };
  });
}

export function evaluateAziendaExpectedDocuments(
  docs: Array<{ tipo_documento: string; data_scadenza: string | null }>
): SafetyExpectedDocumentItem[] {
  return AZIENDA_STANDARD_DOCUMENTS.map((item) => {
    const matching = docs.filter((doc) => classifyAziendaDoc(doc.tipo_documento) === item.key);
    const selected = selectPreferredDoc(matching);
    if (!selected) {
      return {
        key: item.key,
        label: item.label,
        required: AZIENDA_REQUIRED.some((required) => required.key === item.key),
        state: "MANCANTE",
        detail: `${item.label} mancante`,
      };
    }
    const state = getDocumentState(selected.data_scadenza);
    return {
      key: item.key,
      label: item.label,
      required: AZIENDA_REQUIRED.some((required) => required.key === item.key),
      state,
      detail:
        state === "SCADUTO"
          ? `${item.label} scaduto (${formatDateLabel(selected.data_scadenza)})`
          : state === "IN_SCADENZA"
          ? `${item.label} in scadenza (${formatDateLabel(selected.data_scadenza)})`
          : `${item.label} valido (${formatDateLabel(selected.data_scadenza)})`,
    };
  });
}

function pickWorstStatus(values: SafetyStatus[]) {
  if (values.includes("NON_CONFORME")) return "NON_CONFORME" as const;
  if (values.includes("IN_SCADENZA")) return "IN_SCADENZA" as const;
  if (values.includes("CONFORME")) return "CONFORME" as const;
  return "NON_ASSEGNATO" as const;
}

export function evaluateSafetyCompliance(
  rawAssignments: string | null | undefined,
  dataset: SafetyDataset
): SafetyComplianceResult {
  const tokens = toAssignmentTokens(rawAssignments);
  if (!tokens.length) {
    return {
      status: "NON_ASSEGNATO",
      label: "Safety non assegnato",
      summary: "Nessun personale o azienda assegnata.",
      tooltip: "Nessun personale o azienda assegnata.",
      highlights: [],
      matchedPersonale: [],
      matchedAziende: [],
      unknownAssignments: [],
    };
  }

  const matchedPersonale: SafetyPersonaleRow[] = [];
  const matchedAziende: SafetyAziendaRow[] = [];
  const unknownAssignments: string[] = [];

  for (const token of tokens) {
    const person = matchPersonaleToken(token, dataset.personale);
    if (person) {
      if (!matchedPersonale.some((row) => row.id === person.id)) matchedPersonale.push(person);
      continue;
    }
    const company = matchAziendaToken(token, dataset.aziende);
    if (company) {
      if (!matchedAziende.some((row) => row.id === company.id)) matchedAziende.push(company);
      continue;
    }
    unknownAssignments.push(token);
  }

  const personaleDocsById = new Map<string, SafetyPersonaleDocumentoRow[]>();
  for (const row of dataset.personaleDocumenti) {
    const bucket = personaleDocsById.get(row.personale_id) || [];
    bucket.push(row);
    personaleDocsById.set(row.personale_id, bucket);
  }

  const aziendaDocsById = new Map<string, SafetyAziendaDocumentoRow[]>();
  for (const row of dataset.aziendeDocumenti) {
    const bucket = aziendaDocsById.get(row.azienda_id) || [];
    bucket.push(row);
    aziendaDocsById.set(row.azienda_id, bucket);
  }

  const checks: DocCheck[] = [];

  for (const person of matchedPersonale) {
    const docs = personaleDocsById.get(person.id) || [];
    for (const required of PERSONALE_REQUIRED) {
      const found = docs.find((doc) => classifyPersonaleDoc(doc.tipo_documento) === required.key) || null;
      if (!found) {
        checks.push({
          label: `${person.nome} ${person.cognome}: ${required.label}`,
          status: "NON_CONFORME",
          reason: `${person.nome} ${person.cognome}: ${required.label} mancante`,
        });
        continue;
      }
      const base = buildDocCheck(required.label, found.data_scadenza);
      checks.push({
        ...base,
        label: `${person.nome} ${person.cognome}: ${required.label}`,
        reason: `${person.nome} ${person.cognome}: ${base.reason}`,
      });
    }

    for (const doc of docs.filter((row) => classifyPersonaleDoc(row.tipo_documento) === "ABILITAZIONE")) {
      const base = buildDocCheck(doc.tipo_documento, doc.data_scadenza);
      checks.push({
        ...base,
        label: `${person.nome} ${person.cognome}: ${doc.tipo_documento}`,
        reason: `${person.nome} ${person.cognome}: ${base.reason}`,
      });
    }
  }

  for (const company of matchedAziende) {
    const docs = aziendaDocsById.get(company.id) || [];
    for (const required of AZIENDA_REQUIRED) {
      const found = docs.find((doc) => classifyAziendaDoc(doc.tipo_documento) === required.key) || null;
      if (!found) {
        checks.push({
          label: `${company.ragione_sociale}: ${required.label}`,
          status: "NON_CONFORME",
          reason: `${company.ragione_sociale}: ${required.label} mancante`,
        });
        continue;
      }
      const base = buildDocCheck(required.label, found.data_scadenza);
      checks.push({
        ...base,
        label: `${company.ragione_sociale}: ${required.label}`,
        reason: `${company.ragione_sociale}: ${base.reason}`,
      });
    }

    for (const doc of docs.filter((row) => classifyAziendaDoc(row.tipo_documento) === "SICUREZZA_AZIENDA")) {
      const base = buildDocCheck(doc.tipo_documento, doc.data_scadenza);
      checks.push({
        ...base,
        label: `${company.ragione_sociale}: ${doc.tipo_documento}`,
        reason: `${company.ragione_sociale}: ${base.reason}`,
      });
    }
  }

  for (const unknown of unknownAssignments) {
    checks.push({
      label: unknown,
      status: "NON_CONFORME",
      reason: `Assegnazione non riconosciuta: ${unknown}`,
    });
  }

  const status = pickWorstStatus(checks.map((check) => check.status));
  const label =
    status === "CONFORME"
      ? "Safety conforme"
      : status === "IN_SCADENZA"
      ? "Safety in scadenza"
      : "Safety non conforme";

  const missingOrExpired = checks.filter((check) => check.status === "NON_CONFORME").length;
  const expiring = checks.filter((check) => check.status === "IN_SCADENZA").length;
  const matchedNames = matchedPersonale.map((row) => `${row.nome} ${row.cognome}`);
  const matchedCompanies = matchedAziende.map((row) => row.ragione_sociale);

  const summaryParts = [
    matchedNames.length ? `Persone: ${matchedNames.join(", ")}` : "",
    matchedCompanies.length ? `Aziende: ${matchedCompanies.join(", ")}` : "",
    missingOrExpired > 0 ? `Non conformità: ${missingOrExpired}` : "",
    expiring > 0 ? `In scadenza: ${expiring}` : "",
  ].filter(Boolean);

  return {
    status,
    label,
    summary:
      summaryParts.join(" · ") ||
      (status === "CONFORME"
        ? "Documenti safety validi."
        : status === "IN_SCADENZA"
        ? "Presenti documenti in scadenza."
        : "Documenti mancanti o scaduti."),
    tooltip: checks.map((check) => check.reason).join("\n") || "Nessun controllo disponibile",
    highlights: (
      checks.filter((check) => check.status !== "CONFORME").map((check) => check.reason).slice(0, 3)
    ),
    matchedPersonale: matchedNames,
    matchedAziende: matchedCompanies,
    unknownAssignments,
  };
}
