"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import OperativeNotesPanel from "@/components/OperativeNotesPanel";
import PersonaleMultiSelect from "@/components/PersonaleMultiSelect";
import SafetyComplianceBadge from "@/components/SafetyComplianceBadge";
import {
  getCanonicalInterventoEsitoFatturazione,
  getInterventoLifecycleStatus,
  type InterventoRow,
} from "@/lib/interventi";

export type InterventiChecklistOption = {
  id: string;
  nome_checklist: string | null;
  proforma: string | null;
  magazzino_importazione: string | null;
};

export type InterventiOperatore = {
  id: string;
  nome: string | null;
  ruolo?: string | null;
  email?: string | null;
  attivo?: boolean | null;
};

export type InterventoFormState = {
  data: string;
  dataTassativa: string;
  descrizione: string;
  ticketNo: string;
  incluso: boolean;
  checklistId: string;
  proforma: string;
  codiceMagazzino: string;
  fatturazioneStato: string;
  statoIntervento: string;
  esitoFatturazione: string;
  numeroFattura: string;
  fatturatoIl: string;
  note: string;
  noteTecniche: string;
  dataInizio: string;
  durataGiorni: string;
  modalitaAttivita: string;
  personalePrevisto: string;
  personaleIds: string[];
  mezzi: string;
  descrizioneAttivita: string;
  indirizzo: string;
  orario: string;
  referenteClienteNome: string;
  referenteClienteContatto: string;
  commercialeArtTechNome: string;
  commercialeArtTechContatto: string;
};

export type PendingInterventoLink = {
  title: string;
  url: string;
};

type ClienteReferente = {
  id: string;
  cliente_id: string;
  nome: string;
  telefono: string | null;
  email: string | null;
  ruolo: string | null;
  indirizzo_preferito?: string | null;
  attivo?: boolean | null;
};

type ChecklistReferentiContext = {
  clienteId: string | null;
  indirizzoProgetto: string | null;
  referenti: ClienteReferente[];
  loading: boolean;
};

type Props = {
  checklists: InterventiChecklistOption[];
  interventi: InterventoRow[];
  interventiInfo: string | null;
  interventiError: string | null;
  alertNotice: string | null;
  setInterventiNotice: (value: string | null) => void;
  includedUsed: number;
  includedTotal: number | null;
  includedResidual: number | null;
  includedSummaryOverride?: string | null;
  attachmentCounts?: Map<string, number>;
  onInterventoAttachmentCountChange?: (interventoId: string, count: number) => void;
  getOperatoreNome: (value?: string | null) => string;
  currentOperatoreRole: string | null;
  newIntervento: InterventoFormState;
  setNewIntervento: (value: InterventoFormState) => void;
  newInterventoFiles: File[];
  setNewInterventoFiles: (files: File[]) => void;
  newInterventoLinks: PendingInterventoLink[];
  setNewInterventoLinks: (links: PendingInterventoLink[]) => void;
  addIntervento: () => void;
  editInterventoId: string | null;
  setEditInterventoId: (value: string | null) => void;
  editIntervento: InterventoFormState;
  setEditIntervento: (value: InterventoFormState) => void;
  startEditIntervento: (row: InterventoRow) => void;
  saveEditIntervento: () => void;
  expandedInterventoId: string | null;
  setExpandedInterventoId: (value: string | null) => void;
  deleteIntervento: (id: string) => void;
  closeInterventoId: string | null;
  setCloseInterventoId: (value: string | null) => void;
  closeEsito: string;
  setCloseEsito: (value: string) => void;
  closeNote: string;
  setCloseNote: (value: string) => void;
  closeNoteAmministrazione: string;
  setCloseNoteAmministrazione: (value: string) => void;
  closeError: string | null;
  setCloseError: (value: string | null) => void;
  confirmCloseIntervento: () => void;
  alertInterventoId: string | null;
  setAlertInterventoId: (value: string | null) => void;
  alertDestinatarioId: string;
  setAlertDestinatarioId: (value: string) => void;
  alertMessaggio: string;
  setAlertMessaggio: (value: string) => void;
  alertSendEmail: boolean;
  setAlertSendEmail: (value: boolean) => void;
  sending: boolean;
  sendErr: string | null;
  sendOk: string | null;
  sendInterventoAlert: () => void;
  openAlertModal: (row: InterventoRow) => void;
  getAlertRecipients: () => InterventiOperatore[];
  bulkOpen: boolean;
  setBulkOpen: (value: boolean) => void;
  bulkToOperatoreId: string;
  setBulkToOperatoreId: (value: string) => void;
  bulkMsg: string;
  setBulkMsg: (value: string) => void;
  bulkSendEmail: boolean;
  setBulkSendEmail: (value: boolean) => void;
  bulkSending: boolean;
  bulkErr: string | null;
  bulkOk: string | null;
  sendBulkFatturaAlert: () => void;
  getFatturaAlertRecipients: () => InterventiOperatore[];
  bulkLastSentAt: string | null;
  bulkLastToOperatoreId: string | null;
  bulkLastMessage: string | null;
  bulkPreviewOpen: boolean;
  setBulkPreviewOpen: (value: boolean) => void;
  openBulkAlertModal: () => void;
  reopenIntervento: (id: string) => void;
  operatorSettingsHref?: string;
  currentProjectLabel?: string | null;
};

const FATTURAZIONE_MENU_OPTIONS = [
  "DA_FATTURARE",
  "INCLUSO",
  "NON_FATTURARE",
  "FATTURATO",
];

const MODALITA_ATTIVITA_OPTIONS = ["ONSITE", "REMOTO"] as const;
const INTERVENTI_TABLE_GRID =
  "minmax(250px,1.8fr) 92px 100px minmax(170px,1fr) 130px minmax(240px,1.2fr)";
const INTERVENTI_TABLE_MIN_WIDTH = 980;

function renderInterventoBadge(label: "INCLUSO" | "EXTRA") {
  const bg = label === "INCLUSO" ? "#dcfce7" : "#fee2e2";
  const color = label === "INCLUSO" ? "#166534" : "#991b1b";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function renderFatturazioneBadge(label: string) {
  const upper = String(label || "").toUpperCase();
  let bg = "#e5e7eb";
  let color = "#374151";
  if (upper === "DA_FATTURARE") {
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (upper === "INCLUSO") {
    bg = "#dbeafe";
    color = "#1d4ed8";
  } else if (upper === "NON_FATTURARE") {
    bg = "#e5e7eb";
    color = "#4b5563";
  } else if (upper === "FATTURATO") {
    bg = "#dcfce7";
    color = "#166534";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {upper || "—"}
    </span>
  );
}

function renderStatoInterventoBadge(label: string) {
  const upper = String(label || "").toUpperCase();
  let bg = "#f3f4f6";
  let color = "#374151";
  if (upper === "CHIUSO") {
    bg = "#dcfce7";
    color = "#166534";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {upper || "—"}
    </span>
  );
}

function getInterventoStato(i: InterventoRow): "APERTO" | "CHIUSO" {
  return getInterventoLifecycleStatus(i);
}

function getEsitoFatturazione(i: InterventoRow): string | null {
  return getCanonicalInterventoEsitoFatturazione(i);
}

function canReopenIntervento(currentRole: string | null) {
  const role = String(currentRole || "").toUpperCase();
  return role === "SUPERVISORE" || role === "PM";
}

function isFatturaDaEmettere(i: InterventoRow) {
  return getEsitoFatturazione(i) === "DA_FATTURARE";
}

function getChecklistMeta(row: InterventoRow, checklists: InterventiChecklistOption[]) {
  if (row.checklist) {
    return {
      id: row.checklist.id,
      nome: row.checklist.nome_checklist,
      proforma: row.checklist.proforma,
      codMag: row.checklist.magazzino_importazione,
    };
  }
  const found = checklists.find((item) => String(item.id) === String(row.checklist_id || ""));
  return {
    id: found?.id ?? row.checklist_id ?? null,
    nome: found?.nome_checklist ?? null,
    proforma: found?.proforma ?? null,
    codMag: found?.magazzino_importazione ?? null,
  };
}

function renderOperativiFields(
  form: InterventoFormState,
  setForm: (value: InterventoFormState) => void,
  options?: {
    showModalitaAttivita?: boolean;
    referentiContext?: ChecklistReferentiContext;
    selectedReferenteId?: string;
    onSelectReferente?: (value: string) => void;
  }
) {
  const showModalitaAttivita = Boolean(options?.showModalitaAttivita);
  const isRemote = form.modalitaAttivita === "REMOTO";
  const fallbackStartDate = form.dataTassativa || form.data;
  const referentiContext = options?.referentiContext;
  const referenti = referentiContext?.referenti || [];
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Dati operativi intervento</div>
          <SafetyComplianceBadge
            personaleText={form.personalePrevisto}
            personaleIds={form.personaleIds}
          />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(280px, 1fr))",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Data inizio</div>
          <input
            type="date"
            value={form.dataInizio}
            onChange={(e) => setForm({ ...form, dataInizio: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          />
          {!form.dataInizio && fallbackStartDate ? (
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>
              Fallback automatico: {new Date(fallbackStartDate).toLocaleDateString("it-IT")}
            </div>
          ) : null}
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Ore previste</div>
          <input
            type="number"
            min={0}
            step={0.5}
            value={form.durataGiorni}
            onChange={(e) => setForm({ ...form, durataGiorni: e.target.value })}
            placeholder="2"
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <div>
          <div
            style={{
              border: isRemote ? "1px solid #c7d2fe" : undefined,
              background: isRemote ? "#eef2ff" : undefined,
              borderRadius: isRemote ? 10 : undefined,
              padding: isRemote ? 10 : undefined,
            }}
          >
            <div style={{ fontSize: 12, marginBottom: 4, fontWeight: isRemote ? 700 : undefined }}>
              {isRemote ? "Operatore remoto" : "Personale previsto / incarico"}
            </div>
            {isRemote ? (
              <div style={{ fontSize: 11, color: "#4338ca", marginBottom: 6 }}>
                Indica l’operatore interno che segue il collegamento remoto.
              </div>
            ) : null}
            <PersonaleMultiSelect
              personaleIds={form.personaleIds}
              legacyValue={form.personalePrevisto}
              onChange={({ personaleIds, personaleDisplay }) =>
                setForm({
                  ...form,
                  personaleIds,
                  personalePrevisto: personaleDisplay,
                })
              }
            />
          </div>
        </div>
        {showModalitaAttivita ? (
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Modalita attivita</div>
            <select
              value={form.modalitaAttivita === "REMOTO" ? "REMOTO" : "ONSITE"}
              onChange={(e) => setForm({ ...form, modalitaAttivita: e.target.value })}
              style={{ width: "100%", padding: 8 }}
            >
              {MODALITA_ATTIVITA_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Mezzi</div>
          <textarea
            value={form.mezzi}
            onChange={(e) => setForm({ ...form, mezzi: e.target.value })}
            style={{ width: "100%", minHeight: 70, padding: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Descrizione attivita / note operative</div>
          <textarea
            value={form.descrizioneAttivita}
            onChange={(e) => setForm({ ...form, descrizioneAttivita: e.target.value })}
            style={{ width: "100%", minHeight: 70, padding: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Indirizzo</div>
          <textarea
            value={form.indirizzo}
            onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
            style={{ width: "100%", minHeight: 70, padding: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Orario</div>
          <input
            value={form.orario}
            onChange={(e) => setForm({ ...form, orario: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <div>
          <div
            style={{
              border: isRemote ? "1px solid #c7d2fe" : undefined,
              background: isRemote ? "#eef2ff" : undefined,
              borderRadius: isRemote ? 10 : undefined,
              padding: isRemote ? 10 : undefined,
            }}
          >
            <div style={{ fontSize: 12, marginBottom: 4, fontWeight: isRemote ? 700 : undefined }}>
              {isRemote ? "Referente tecnico cliente" : "Referente cliente"}
            </div>
            {isRemote ? (
              <div style={{ fontSize: 11, color: "#4338ca", marginBottom: 6 }}>
                Inserisci il contatto cliente da coinvolgere durante l’assistenza remota.
              </div>
            ) : null}
            {options?.onSelectReferente ? (
              <div style={{ marginBottom: 8 }}>
                <select
                  value={options.selectedReferenteId || ""}
                  onChange={(e) => options.onSelectReferente?.(e.target.value)}
                  disabled={!form.checklistId || referentiContext?.loading}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">
                    {!form.checklistId
                      ? "Seleziona prima il progetto"
                      : referentiContext?.loading
                      ? "Caricamento referenti..."
                      : referenti.length === 0
                      ? "Nessun referente registrato"
                      : "Seleziona referente cliente"}
                  </option>
                  {referenti.map((referente) => (
                    <option key={referente.id} value={referente.id}>
                      {[
                        referente.nome || "—",
                        referente.ruolo || null,
                        referente.telefono || referente.email || null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              value={form.referenteClienteNome}
              onChange={(e) => setForm({ ...form, referenteClienteNome: e.target.value })}
              placeholder={isRemote ? "Referente tecnico" : "Nome"}
              style={{ width: "100%", padding: 8 }}
            />
            <input
              value={form.referenteClienteContatto}
              onChange={(e) => setForm({ ...form, referenteClienteContatto: e.target.value })}
              placeholder={isRemote ? "Telefono o email" : "Contatto"}
              style={{ width: "100%", padding: 8 }}
            />
          </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Commerciale Art Tech</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              value={form.commercialeArtTechNome}
              onChange={(e) => setForm({ ...form, commercialeArtTechNome: e.target.value })}
              placeholder="Nome"
              style={{ width: "100%", padding: 8 }}
            />
            <input
              value={form.commercialeArtTechContatto}
              onChange={(e) => setForm({ ...form, commercialeArtTechContatto: e.target.value })}
              placeholder="Contatto"
              style={{ width: "100%", padding: 8 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InterventiBlock({
  checklists,
  interventi,
  interventiInfo,
  interventiError,
  alertNotice,
  setInterventiNotice,
  includedUsed,
  includedTotal,
  includedResidual,
  includedSummaryOverride,
  attachmentCounts,
  onInterventoAttachmentCountChange,
  getOperatoreNome,
  currentOperatoreRole,
  newIntervento,
  setNewIntervento,
  newInterventoFiles,
  setNewInterventoFiles,
  newInterventoLinks,
  setNewInterventoLinks,
  addIntervento,
  editInterventoId,
  setEditInterventoId,
  editIntervento,
  setEditIntervento,
  startEditIntervento,
  saveEditIntervento,
  expandedInterventoId,
  setExpandedInterventoId,
  deleteIntervento,
  closeInterventoId,
  setCloseInterventoId,
  closeEsito,
  setCloseEsito,
  closeNote,
  setCloseNote,
  closeNoteAmministrazione,
  setCloseNoteAmministrazione,
  closeError,
  setCloseError,
  confirmCloseIntervento,
  alertInterventoId,
  setAlertInterventoId,
  alertDestinatarioId,
  setAlertDestinatarioId,
  alertMessaggio,
  setAlertMessaggio,
  alertSendEmail,
  setAlertSendEmail,
  sending,
  sendErr,
  sendOk,
  sendInterventoAlert,
  openAlertModal,
  getAlertRecipients,
  bulkOpen,
  setBulkOpen,
  bulkToOperatoreId,
  setBulkToOperatoreId,
  bulkMsg,
  setBulkMsg,
  bulkSendEmail,
  setBulkSendEmail,
  bulkSending,
  bulkErr,
  bulkOk,
  sendBulkFatturaAlert,
  getFatturaAlertRecipients,
  bulkLastSentAt,
  bulkLastToOperatoreId,
  bulkLastMessage,
  bulkPreviewOpen,
  setBulkPreviewOpen,
  openBulkAlertModal,
  reopenIntervento,
  operatorSettingsHref = "/impostazioni/operatori",
  currentProjectLabel,
}: Props) {
  const fattureDaEmettere = interventi.filter((item) => isFatturaDaEmettere(item));
  const topScrollbarRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [topScrollbarWidth, setTopScrollbarWidth] = useState(1410);
  const [hoveredInterventoId, setHoveredInterventoId] = useState<string | null>(null);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newReferenteId, setNewReferenteId] = useState("");
  const [editReferenteId, setEditReferenteId] = useState("");
  const [referentiContextByChecklistId, setReferentiContextByChecklistId] = useState<
    Record<string, ChecklistReferentiContext>
  >({});
  const editInterventoEsitoFatturazione = String(
    editIntervento.esitoFatturazione || editIntervento.fatturazioneStato || ""
  ).toUpperCase();
  const editInterventoIsFatturato = editInterventoEsitoFatturazione === "FATTURATO";

  function isHttpUrl(url: string) {
    return /^https?:\/\//i.test(String(url || "").trim());
  }

  function addPendingLink() {
    const url = newLinkUrl.trim();
    const title = newLinkTitle.trim() || url;
    if (!isHttpUrl(url)) {
      setInterventiNotice("URL link non valido: usa http(s).");
      return;
    }
    setNewInterventoLinks([...newInterventoLinks, { title, url }]);
    setNewLinkTitle("");
    setNewLinkUrl("");
    setInterventiNotice(null);
  }

  function removePendingLink(index: number) {
    setNewInterventoLinks(newInterventoLinks.filter((_, current) => current !== index));
  }

  async function ensureReferentiContext(checklistId: string) {
    const normalizedChecklistId = String(checklistId || "").trim();
    if (!normalizedChecklistId) return;

    const existing = referentiContextByChecklistId[normalizedChecklistId];
    if (existing?.loading || existing) return;

    setReferentiContextByChecklistId((prev) => ({
      ...prev,
      [normalizedChecklistId]: {
        clienteId: null,
        indirizzoProgetto: null,
        referenti: [],
        loading: true,
      },
    }));

    try {
      const checklistRes = await fetch(`/api/checklists/${encodeURIComponent(normalizedChecklistId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const checklistJson = await checklistRes.json().catch(() => ({} as any));
      if (!checklistRes.ok || checklistJson?.ok === false) {
        throw new Error(String(checklistJson?.error || "Errore caricamento progetto"));
      }
      const checklistData = (checklistJson?.data || {}) as any;
      const clienteId = String(checklistData?.cliente_id || "").trim() || null;
      const indirizzoProgetto = String(checklistData?.impianto_indirizzo || "").trim() || null;

      let referenti: ClienteReferente[] = [];
      if (clienteId) {
        const referentiRes = await fetch(`/api/clienti/${encodeURIComponent(clienteId)}/referenti`, {
          cache: "no-store",
          credentials: "include",
        });
        const referentiJson = await referentiRes.json().catch(() => ({} as any));
        if (!referentiRes.ok || referentiJson?.ok === false) {
          throw new Error(String(referentiJson?.error || "Errore caricamento referenti cliente"));
        }
        referenti = ((referentiJson?.referenti || []) as ClienteReferente[]).filter(
          (item) => item?.attivo !== false
        );
      }

      setReferentiContextByChecklistId((prev) => ({
        ...prev,
        [normalizedChecklistId]: {
          clienteId,
          indirizzoProgetto,
          referenti,
          loading: false,
        },
      }));
    } catch {
      setReferentiContextByChecklistId((prev) => ({
        ...prev,
        [normalizedChecklistId]: {
          clienteId: null,
          indirizzoProgetto: null,
          referenti: [],
          loading: false,
        },
      }));
    }
  }

  function applyReferenteSelection(
    form: InterventoFormState,
    setForm: (value: InterventoFormState) => void,
    checklistId: string,
    referenteId: string,
    setSelectedReferenteId: (value: string) => void
  ) {
    setSelectedReferenteId(referenteId);
    if (!referenteId) return;

    const context = referentiContextByChecklistId[String(checklistId || "").trim()];
    const referente = context?.referenti?.find((item) => item.id === referenteId);
    if (!referente) return;

    const contatto = String(referente.telefono || "").trim() || String(referente.email || "").trim();
    const indirizzo =
      String(context?.indirizzoProgetto || "").trim() ||
      String(referente.indirizzo_preferito || "").trim();

    setForm({
      ...form,
      referenteClienteNome: referente.nome || form.referenteClienteNome,
      referenteClienteContatto: contatto || form.referenteClienteContatto,
      indirizzo: indirizzo || form.indirizzo,
    });
  }

  useEffect(() => {
    const tableEl = tableScrollRef.current;
    if (!tableEl) return;

    const syncWidth = () => {
      setTopScrollbarWidth(Math.max(tableEl.scrollWidth, INTERVENTI_TABLE_MIN_WIDTH));
    };

    syncWidth();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            syncWidth();
          })
        : null;

    if (observer) {
      observer.observe(tableEl);
      const firstChild = tableEl.firstElementChild;
      if (firstChild instanceof HTMLElement) observer.observe(firstChild);
    } else {
      window.addEventListener("resize", syncWidth);
    }

    return () => {
      if (observer) observer.disconnect();
      else window.removeEventListener("resize", syncWidth);
    };
  }, [interventi, expandedInterventoId, editInterventoId]);

  useEffect(() => {
    const checklistId = String(newIntervento.checklistId || "").trim();
    if (!checklistId) {
      setNewReferenteId("");
      return;
    }
    void ensureReferentiContext(checklistId);
  }, [newIntervento.checklistId]);

  useEffect(() => {
    const checklistId = String(editIntervento.checklistId || "").trim();
    if (!checklistId) {
      setEditReferenteId("");
      return;
    }
    void ensureReferentiContext(checklistId);
  }, [editIntervento.checklistId]);

  function syncHorizontalScroll(source: "top" | "bottom") {
    const topEl = topScrollbarRef.current;
    const tableEl = tableScrollRef.current;
    if (!topEl || !tableEl) return;
    if (source === "top") {
      if (tableEl.scrollLeft !== topEl.scrollLeft) tableEl.scrollLeft = topEl.scrollLeft;
    } else if (topEl.scrollLeft !== tableEl.scrollLeft) {
      topEl.scrollLeft = tableEl.scrollLeft;
    }
  }

  return (
    <>
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 34, fontWeight: 800 }}>Interventi</h2>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Inclusi usati: {includedUsed}
            {includedSummaryOverride != null ? (
              <>{includedSummaryOverride}</>
            ) : includedTotal == null ? (
              <> / Totale inclusi: ∞ (illimitato)</>
            ) : (
              <> / Totale inclusi: {includedTotal} / Residui: {includedResidual}</>
            )}
            {currentProjectLabel ? (
              <>
                {" "}
                / Progetto: <span style={{ fontWeight: 700 }}>{currentProjectLabel}</span>
              </>
            ) : null}
            {includedResidual != null && includedResidual <= 0 && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: "#fee2e2",
                  color: "#991b1b",
                  fontWeight: 700,
                }}
              >
                Inclusi finiti
              </span>
            )}
          </div>
        </div>

        {interventiInfo && <div style={{ marginTop: 6, color: "#166534", fontSize: 12 }}>{interventiInfo}</div>}
        {interventiError && <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{interventiError}</div>}
        {alertNotice && <div style={{ marginTop: 6, color: "#555", fontSize: 12 }}>{alertNotice}</div>}
        {bulkLastSentAt && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#166534", fontWeight: 600 }}>
            Ultimo alert fatturazione (bulk): {new Date(bulkLastSentAt).toLocaleString()}
            {bulkLastToOperatoreId ? ` — a ${getOperatoreNome(bulkLastToOperatoreId)}` : ""}
          </div>
        )}
        {bulkLastMessage && (
          <div style={{ marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setBulkPreviewOpen(true)}
              style={{
                padding: 0,
                border: "none",
                background: "transparent",
                color: "#2563eb",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Mostra recap
            </button>
          </div>
        )}

        <div
          id="add-intervento"
          style={{
            marginTop: 10,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "white",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Aggiungi intervento</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label>
              Data<br />
              <input
                type="date"
                value={newIntervento.data}
                onChange={(e) => setNewIntervento({ ...newIntervento, data: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label>
              Data tassativa<br />
              <input
                type="date"
                value={newIntervento.dataTassativa}
                onChange={(e) => setNewIntervento({ ...newIntervento, dataTassativa: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label>
              Descrizione<br />
              <input
                value={newIntervento.descrizione}
                onChange={(e) => setNewIntervento({ ...newIntervento, descrizione: e.target.value })}
                style={{ width: "100%", padding: 8 }}
                placeholder="Assistenza, aggiornamento..."
              />
            </label>
            <label>
              Ticket n°<br />
              <input
                value={newIntervento.ticketNo}
                onChange={(e) => setNewIntervento({ ...newIntervento, ticketNo: e.target.value })}
                style={{ width: "100%", padding: 8 }}
                placeholder="es. 1234"
              />
            </label>
            <label>
              Incluso / Extra<br />
              <select
                value={newIntervento.incluso ? "INCLUSO" : "EXTRA"}
                onChange={(e) => setNewIntervento({ ...newIntervento, incluso: e.target.value === "INCLUSO" })}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="INCLUSO">INCLUSO</option>
                <option value="EXTRA">EXTRA</option>
              </select>
            </label>
            <label>
              PROGETTO<br />
              <select
                value={newIntervento.checklistId}
                onChange={(e) => setNewIntervento({ ...newIntervento, checklistId: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="">—</option>
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_checklist ?? c.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Proforma<br />
              <input
                value={newIntervento.proforma}
                onChange={(e) => setNewIntervento({ ...newIntervento, proforma: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label>
              Cod. magazzino<br />
              <input
                value={newIntervento.codiceMagazzino}
                onChange={(e) => setNewIntervento({ ...newIntervento, codiceMagazzino: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
            <label>
              Fatturazione<br />
              <select
                value={newIntervento.fatturazioneStato}
                onChange={(e) => {
                  const next = e.target.value;
                  setNewIntervento({
                    ...newIntervento,
                    fatturazioneStato: next,
                    fatturatoIl:
                      next === "FATTURATO" && !newIntervento.fatturatoIl
                        ? new Date().toISOString().slice(0, 10)
                        : newIntervento.fatturatoIl,
                  });
                }}
                style={{ width: "100%", padding: 8 }}
              >
                {FATTURAZIONE_MENU_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            {newIntervento.statoIntervento === "CHIUSO" && newIntervento.fatturazioneStato === "FATTURATO" && (
              <>
                <label>
                  Numero fattura<br />
                  <input
                    value={newIntervento.numeroFattura}
                    onChange={(e) => setNewIntervento({ ...newIntervento, numeroFattura: e.target.value })}
                    style={{ width: "100%", padding: 8 }}
                  />
                </label>
                <label>
                  Fatturato il<br />
                  <input
                    type="date"
                    value={newIntervento.fatturatoIl}
                    onChange={(e) => setNewIntervento({ ...newIntervento, fatturatoIl: e.target.value })}
                    style={{ width: "100%", padding: 8 }}
                  />
                </label>
              </>
            )}
          </div>

          <div style={{ marginTop: 10 }}>
            <label>
              Dettaglio intervento<br />
              <textarea
                value={newIntervento.note}
                onChange={(e) => setNewIntervento({ ...newIntervento, note: e.target.value })}
                rows={4}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          </div>

          {renderOperativiFields(newIntervento, setNewIntervento, {
            referentiContext:
              referentiContextByChecklistId[String(newIntervento.checklistId || "").trim()] || {
                clienteId: null,
                indirizzoProgetto: null,
                referenti: [],
                loading: false,
              },
            selectedReferenteId: newReferenteId,
            onSelectReferente: (referenteId) =>
              applyReferenteSelection(
                newIntervento,
                setNewIntervento,
                newIntervento.checklistId,
                referenteId,
                setNewReferenteId
              ),
          })}

          <div style={{ marginTop: 10 }}>
            <label>
              Allegati (opzionale)<br />
              <input
                type="file"
                multiple
                onChange={(e) => setNewInterventoFiles(e.target.files ? Array.from(e.target.files) : [])}
              />
            </label>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
              Dopo il primo salvataggio il pannello dettagli resta riutilizzabile per link Drive e altri allegati.
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Link allegati (opzionale)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 8 }}>
              <input
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
                placeholder="Titolo link (opzionale)"
                style={{ width: "100%", padding: 8 }}
              />
              <input
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                style={{ width: "100%", padding: 8 }}
              />
              <button
                type="button"
                onClick={addPendingLink}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "white",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Aggiungi link
              </button>
            </div>
            {newInterventoLinks.length > 0 ? (
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {newInterventoLinks.map((link, index) => (
                  <div
                    key={`${link.url}-${index}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      alignItems: "center",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: "8px 10px",
                      background: "#fcfcfd",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{link.title || link.url}</div>
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.7,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {link.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingLink(index)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={addIntervento}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                cursor: "pointer",
              }}
            >
              Aggiungi intervento
            </button>
          </div>
        </div>

        {interventi.length === 0 ? (
          <div style={{ opacity: 0.7, marginTop: 8 }}>Nessun intervento trovato</div>
        ) : (
          <>
            <div
              style={{
                marginTop: 10,
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
                background: "#fafafa",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Fatture da emettere x interventi</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{fattureDaEmettere.length} interventi</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (fattureDaEmettere.length === 0) {
                    setInterventiNotice("Nessuna fattura da emettere.");
                    return;
                  }
                  openBulkAlertModal();
                }}
                disabled={bulkSending}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "white",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  opacity: bulkSending ? 0.6 : 1,
                }}
              >
                Invia alert ora (fatturazione)
              </button>
            </div>
            <div
              style={{
                marginTop: 10,
                border: "1px solid #eee",
                borderRadius: 12,
                width: "100%",
                background: "white",
                overflow: "hidden",
              }}
            >
              <div
                ref={topScrollbarRef}
                onScroll={() => syncHorizontalScroll("top")}
                style={{
                  overflowX: "auto",
                  overflowY: "hidden",
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  background: "#fafafa",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ width: topScrollbarWidth, height: 14 }} />
              </div>
              <div
                ref={tableScrollRef}
                onScroll={() => syncHorizontalScroll("bottom")}
                style={{
                  overflowX: "auto",
                  overflowY: "hidden",
                  width: "100%",
                }}
              >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: INTERVENTI_TABLE_GRID,
                  columnGap: 8,
                  padding: "8px 8px",
                  fontWeight: 800,
                  background: "#fafafa",
                  borderBottom: "1px solid #eee",
                  fontSize: 12,
                  minWidth: INTERVENTI_TABLE_MIN_WIDTH,
                  tableLayout: "fixed",
                }}
              >
                <div
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    background: "#fafafa",
                    paddingRight: 8,
                  }}
                >
                  Ticket / data
                </div>
                <div style={{ whiteSpace: "nowrap" }}>Tipo</div>
                <div style={{ whiteSpace: "nowrap" }}>Stato</div>
                <div style={{ whiteSpace: "nowrap" }}>Proforma / codice</div>
                <div style={{ whiteSpace: "nowrap" }}>Fatturazione</div>
                <div style={{ whiteSpace: "nowrap" }}>AZIONI</div>
              </div>
              {interventi.map((row, index) => {
                const expanded = expandedInterventoId === row.id;
                const editing = editInterventoId === row.id;
                const stato = getInterventoStato(row);
                const checklistMeta = getChecklistMeta(row, checklists);
                const isHovered = hoveredInterventoId === row.id;
                const rowBackground = isHovered ? "#f8fafc" : index % 2 === 0 ? "#ffffff" : "#fbfdff";
                return (
                  <div
                    key={row.id}
                    onMouseEnter={() => setHoveredInterventoId(row.id)}
                    onMouseLeave={() => setHoveredInterventoId((current) => (current === row.id ? null : current))}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      background: rowBackground,
                      transition: "background-color 120ms ease",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: INTERVENTI_TABLE_GRID,
                        columnGap: 8,
                        padding: "9px 8px",
                        alignItems: "center",
                        fontSize: 12,
                        minWidth: INTERVENTI_TABLE_MIN_WIDTH,
                        tableLayout: "fixed",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gap: 5,
                          minWidth: 0,
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          background: rowBackground,
                          paddingRight: 8,
                        }}
                      >
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, color: "#0f172a" }}>{row.ticket_no || "—"}</span>
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            {row.data ? new Date(row.data).toLocaleDateString("it-IT") : "—"}
                          </span>
                        </div>
                        <div
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontWeight: 700,
                            color: "#1e293b",
                          }}
                          title={checklistMeta.nome || undefined}
                        >
                          {checklistMeta.nome
                            ? checklistMeta.nome
                            : checklistMeta.id
                              ? String(checklistMeta.id).slice(0, 8)
                              : "—"}
                        </div>
                        <div
                          style={{
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                            color: "#475569",
                            fontSize: 11,
                            lineHeight: 1.35,
                          }}
                        >
                          {row.descrizione || "—"}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        {renderInterventoBadge(row.incluso ? "INCLUSO" : "EXTRA")}
                      </div>
                      <div style={{ whiteSpace: "nowrap" }}>{renderStatoInterventoBadge(stato)}</div>
                      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <div
                          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                          title={row.proforma || checklistMeta.proforma || undefined}
                        >
                          <span style={{ fontSize: 11, color: "#64748b" }}>PF:</span>{" "}
                          {row.proforma || checklistMeta.proforma || "—"}
                        </div>
                        <div
                          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                          title={row.codice_magazzino || checklistMeta.codMag || undefined}
                        >
                          <span style={{ fontSize: 11, color: "#64748b" }}>COD:</span>{" "}
                          {row.codice_magazzino || checklistMeta.codMag || "—"}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, whiteSpace: "nowrap" }}>
                        {getEsitoFatturazione(row) ? (
                          <>{renderFatturazioneBadge(getEsitoFatturazione(row) || "—")}</>
                        ) : stato === "APERTO" ? (
                          <>
                            <div>—</div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>da chiudere</div>
                          </>
                        ) : (
                          <div>—</div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          alignItems: "center",
                          minWidth: 0,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedInterventoId(expanded ? null : row.id)}
                          style={{
                            padding: "3px 6px",
                            borderRadius: 6,
                            border: "1px solid #d1d5db",
                            background: "#f8fafc",
                            cursor: "pointer",
                            minWidth: 0,
                            fontSize: 12,
                          }}
                          title="Apri allegati intervento"
                        >
                          📎 File ({attachmentCounts?.get(row.id) ?? 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedInterventoId(expanded ? null : row.id)}
                          style={{
                            padding: "3px 6px",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "white",
                            cursor: "pointer",
                            minWidth: 0,
                            fontSize: 12,
                          }}
                        >
                          Dettagli
                        </button>
                        {stato === "APERTO" && (
                          <button
                            type="button"
                            onClick={() => {
                              setCloseInterventoId(row.id);
                              setCloseEsito("DA_FATTURARE");
                              setCloseNote("");
                              setCloseNoteAmministrazione("");
                              setCloseError(null);
                            }}
                            style={{
                              padding: "3px 6px",
                              borderRadius: 6,
                              border: "1px solid #111",
                              background: "white",
                              cursor: "pointer",
                              minWidth: 0,
                              fontSize: 12,
                            }}
                          >
                            Chiudi
                          </button>
                        )}
                        {stato === "CHIUSO" && getEsitoFatturazione(row) === "DA_FATTURARE" && (
                          <button
                            type="button"
                            onClick={() => openAlertModal(row)}
                            style={{
                              padding: "3px 6px",
                              borderRadius: 6,
                              border: "1px solid #111",
                              background: "white",
                              cursor: "pointer",
                              minWidth: 0,
                              fontSize: 12,
                            }}
                          >
                            Invia alert fattura
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEditIntervento(row)}
                          style={{
                            padding: "3px 6px",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "white",
                            cursor: "pointer",
                            minWidth: 0,
                            fontSize: 12,
                          }}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteIntervento(row.id)}
                          style={{
                            padding: "3px 6px",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "white",
                            cursor: "pointer",
                            minWidth: 0,
                            fontSize: 12,
                          }}
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                    {editing && (
                      <div style={{ padding: "10px 12px 14px", background: "#fafafa", borderTop: "1px solid #eee" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>Stato intervento</div>
                          {renderStatoInterventoBadge(stato)}
                          {stato === "CHIUSO" && canReopenIntervento(currentOperatoreRole) && (
                            <button
                              type="button"
                              onClick={() => reopenIntervento(row.id)}
                              style={{
                                marginLeft: "auto",
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #111",
                                background: "white",
                              }}
                            >
                              Riapri
                            </button>
                          )}
                        </div>
                        {stato === "CHIUSO" && (
                          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>Esito fatturazione</div>
                            {renderFatturazioneBadge(getEsitoFatturazione(row) || "—")}
                            <div style={{ fontSize: 12, opacity: 0.7, marginLeft: 8 }}>Chiuso da</div>
                            <div style={{ fontSize: 12 }}>{getOperatoreNome(row.chiuso_da_operatore)}</div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>Chiuso il</div>
                            <div style={{ fontSize: 12 }}>
                              {row.chiuso_il ? new Date(row.chiuso_il).toLocaleDateString("it-IT") : "—"}
                            </div>
                          </div>
                        )}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 140px 1fr 1fr 1fr",
                            gap: 10,
                          }}
                        >
                          <label>
                            Data<br />
                            <input
                              type="date"
                              value={editIntervento.data}
                              onChange={(e) => setEditIntervento({ ...editIntervento, data: e.target.value })}
                              style={{ width: "100%", padding: 8 }}
                            />
                          </label>
                          <label>
                            Data tassativa<br />
                            <input
                              type="date"
                              value={editIntervento.dataTassativa}
                              onChange={(e) =>
                                setEditIntervento({ ...editIntervento, dataTassativa: e.target.value })
                              }
                              style={{ width: "100%", padding: 8 }}
                            />
                          </label>
                          <label>
                            Descrizione<br />
                            <input
                              value={editIntervento.descrizione}
                              onChange={(e) =>
                                setEditIntervento({ ...editIntervento, descrizione: e.target.value })
                              }
                              style={{ width: "100%", padding: 8 }}
                            />
                          </label>
                          <label>
                            Tipo<br />
                            <select
                              value={editIntervento.incluso ? "INCLUSO" : "EXTRA"}
                              onChange={(e) =>
                                setEditIntervento({ ...editIntervento, incluso: e.target.value === "INCLUSO" })
                              }
                              disabled={editIntervento.noteTecniche.includes("Auto-EXTRA")}
                              style={{ width: "100%", padding: 8 }}
                            >
                              <option value="INCLUSO">INCLUSO</option>
                              <option value="EXTRA">EXTRA</option>
                            </select>
                          </label>
                          <label>
                            Ticket n°<br />
                            <input
                              value={editIntervento.ticketNo}
                              onChange={(e) => setEditIntervento({ ...editIntervento, ticketNo: e.target.value })}
                              style={{ width: "100%", padding: 8 }}
                            />
                          </label>
                          <label>
                            Proforma<br />
                            <input
                              value={editIntervento.proforma}
                              onChange={(e) => setEditIntervento({ ...editIntervento, proforma: e.target.value })}
                              style={{ width: "100%", padding: 8 }}
                            />
                          </label>
                          <label>
                            Cod. magazzino<br />
                            <input
                              value={editIntervento.codiceMagazzino}
                              onChange={(e) =>
                                setEditIntervento({ ...editIntervento, codiceMagazzino: e.target.value })
                              }
                              style={{ width: "100%", padding: 8 }}
                            />
                          </label>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr 1fr",
                            gap: 10,
                            marginTop: 10,
                          }}
                        >
                          <label>
                            Esito fatturazione<br />
                            <select
                              value={editIntervento.fatturazioneStato}
                              onChange={(e) => {
                                const next = e.target.value;
                                setEditIntervento({
                                  ...editIntervento,
                                  fatturazioneStato: next,
                                  esitoFatturazione: next,
                                });
                              }}
                              style={{ width: "100%", padding: 8 }}
                            >
                              {FATTURAZIONE_MENU_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Numero fattura<br />
                            <input
                              value={editIntervento.numeroFattura}
                              onChange={(e) =>
                                setEditIntervento({ ...editIntervento, numeroFattura: e.target.value })
                              }
                              disabled={!editInterventoIsFatturato}
                              style={{ width: "100%", padding: 8 }}
                            />
                          </label>
                          <label>
                            Fatturato il<br />
                            <input
                              type="date"
                              value={editIntervento.fatturatoIl}
                              onChange={(e) =>
                                setEditIntervento({ ...editIntervento, fatturatoIl: e.target.value })
                              }
                              disabled={!editInterventoIsFatturato}
                              style={{ width: "100%", padding: 8 }}
                            />
                          </label>
                          {editIntervento.statoIntervento !== "CHIUSO" && (
                            <div style={{ gridColumn: "1 / span 3", fontSize: 12, opacity: 0.7 }}>
                              Intervento aperto: lo stato economico resta modificabile e verrà confermato alla chiusura.
                            </div>
                          )}
                          <label>
                            Dettaglio intervento<br />
                            <textarea
                              value={editIntervento.note}
                              onChange={(e) => setEditIntervento({ ...editIntervento, note: e.target.value })}
                              rows={3}
                              style={{ width: "100%", padding: 8 }}
                            />
                          </label>
                        </div>
                        {renderOperativiFields(editIntervento, setEditIntervento, {
                          showModalitaAttivita: true,
                          referentiContext:
                            referentiContextByChecklistId[String(editIntervento.checklistId || "").trim()] || {
                              clienteId: null,
                              indirizzoProgetto: null,
                              referenti: [],
                              loading: false,
                            },
                          selectedReferenteId: editReferenteId,
                          onSelectReferente: (referenteId) =>
                            applyReferenteSelection(
                              editIntervento,
                              setEditIntervento,
                              editIntervento.checklistId,
                              referenteId,
                              setEditReferenteId
                            ),
                        })}
                        <div style={{ marginTop: 10 }}>
                          <AttachmentsPanel
                            title="Allegati intervento (upload + link Drive)"
                            entityType="INTERVENTO"
                            entityId={row.id}
                            multiple
                            storagePrefix="intervento"
                            onCountChange={(count) =>
                              onInterventoAttachmentCountChange?.(row.id, count)
                            }
                          />
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            type="button"
                            onClick={() => setEditInterventoId(null)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid #ddd",
                              background: "white",
                            }}
                          >
                            Annulla
                          </button>
                          <button
                            type="button"
                            onClick={saveEditIntervento}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid #111",
                              background: "#111",
                              color: "white",
                            }}
                          >
                            Salva modifiche
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          </>
        )}
      </div>

      {expandedInterventoId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setExpandedInterventoId(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const row = interventi.find((item) => item.id === expandedInterventoId);
              if (!row) return null;
              const checklistMeta = getChecklistMeta(row, checklists);
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>Dettaglio intervento</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {row.data ? new Date(row.data).toLocaleDateString("it-IT") : "—"} ·{" "}
                        {checklistMeta.nome ?? (checklistMeta.id ? String(checklistMeta.id).slice(0, 8) : "—")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedInterventoId(null)}
                      style={{
                        marginLeft: "auto",
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                      }}
                    >
                      Chiudi
                    </button>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Ticket</div>
                        <div>{row.ticket_no || "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Tipo</div>
                        <div>{row.incluso ? "INCLUSO" : "EXTRA"}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Proforma</div>
                        <div>{row.proforma || checklistMeta.proforma || "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Codice</div>
                        <div>{row.codice_magazzino || checklistMeta.codMag || "—"}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Descrizione</div>
                    <div>{row.descrizione || "—"}</div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Dettaglio</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{row.note || "—"}</div>
                    {row.note_tecniche && (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>Note tecniche: {row.note_tecniche}</div>
                    )}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <OperativeNotesPanel
                      title="Note operative intervento"
                      items={[
                        {
                          rowKind: "INTERVENTO",
                          rowRefId: row.id,
                          label: "Intervento",
                        },
                      ]}
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Allegati</div>
                    <AttachmentsPanel
                      title="Allegati intervento (upload + link Drive)"
                      entityType="INTERVENTO"
                      entityId={row.id}
                      multiple
                      storagePrefix="intervento"
                      onCountChange={(count) =>
                        onInterventoAttachmentCountChange?.(row.id, count)
                      }
                    />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {closeInterventoId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setCloseInterventoId(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Chiudi intervento</div>
              <button
                type="button"
                onClick={() => setCloseInterventoId(null)}
                style={{
                  marginLeft: "auto",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                Chiudi
              </button>
            </div>
            {closeError && <div style={{ marginTop: 8, color: "crimson", fontSize: 12 }}>{closeError}</div>}
            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", marginBottom: 10 }}>
                Esito fatturazione<br />
                <select value={closeEsito} onChange={(e) => setCloseEsito(e.target.value)} style={{ width: "100%", padding: 8 }}>
                  <option value="">—</option>
                  {FATTURAZIONE_MENU_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 10 }}>
                Note tecniche<br />
                <textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value)} rows={3} style={{ width: "100%", padding: 8 }} />
              </label>
              <label style={{ display: "block", marginBottom: 10 }}>
                Note per amministrazione<br />
                <textarea
                  value={closeNoteAmministrazione}
                  onChange={(e) => setCloseNoteAmministrazione(e.target.value)}
                  rows={3}
                  placeholder="Note per amministrazione (fatturazione, extra, anomalie...)"
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setCloseInterventoId(null)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "white" }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmCloseIntervento}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #111", background: "#111", color: "white" }}
              >
                Conferma chiusura
              </button>
            </div>
          </div>
        </div>
      )}

      {alertInterventoId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setAlertInterventoId(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Invia alert fattura</div>
              <button
                type="button"
                onClick={() => setAlertInterventoId(null)}
                style={{
                  marginLeft: "auto",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                Chiudi
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 10, fontSize: 12 }}>
                <Link href={operatorSettingsHref} style={{ color: "#2563eb", textDecoration: "underline" }}>
                  ⚙ Regole invio automatico
                </Link>
              </div>
              <label style={{ display: "block", marginBottom: 10 }}>
                Destinatario<br />
                <select value={alertDestinatarioId} onChange={(e) => setAlertDestinatarioId(e.target.value)} style={{ width: "100%", padding: 8 }}>
                  <option value="">—</option>
                  {getAlertRecipients().map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nome ?? "—"}
                      {op.ruolo ? ` — ${op.ruolo}` : ""}
                      {op.email ? ` — ${op.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {getAlertRecipients().length === 0 && (
                <div style={{ marginTop: -6, marginBottom: 10, fontSize: 12, color: "#b91c1c" }}>
                  Nessun operatore attivo disponibile
                </div>
              )}
              <label style={{ display: "block", marginBottom: 10 }}>
                Messaggio (opzionale)<br />
                <textarea value={alertMessaggio} onChange={(e) => setAlertMessaggio(e.target.value)} rows={4} style={{ width: "100%", padding: 8 }} />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input type="checkbox" checked={alertSendEmail} onChange={(e) => setAlertSendEmail(e.target.checked)} />
                Invia email
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setAlertInterventoId(null)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "white" }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={sendInterventoAlert}
                disabled={sending || !alertDestinatarioId}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  opacity: sending || !alertDestinatarioId ? 0.6 : 1,
                }}
              >
                {sending ? "Invio..." : "Invia"}
              </button>
            </div>
            {sendErr && <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>{sendErr}</div>}
            {sendOk && <div style={{ marginTop: 6, fontSize: 12, color: "#166534" }}>{sendOk}</div>}
          </div>
        </div>
      )}

      {bulkOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setBulkOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Invia alert fatture</div>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                style={{
                  marginLeft: "auto",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                Chiudi
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 10, fontSize: 12 }}>
                <Link href={operatorSettingsHref} style={{ color: "#2563eb", textDecoration: "underline" }}>
                  ⚙ Regole invio automatico
                </Link>
              </div>
              <label style={{ display: "block", marginBottom: 10 }}>
                Destinatario<br />
                <select value={bulkToOperatoreId} onChange={(e) => setBulkToOperatoreId(e.target.value)} style={{ width: "100%", padding: 8 }}>
                  <option value="">—</option>
                  {getFatturaAlertRecipients().map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.nome ?? "—"}
                      {op.ruolo ? ` — ${op.ruolo}` : ""}
                      {op.email ? ` — ${op.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {getFatturaAlertRecipients().length === 0 && (
                <div style={{ marginTop: -6, marginBottom: 10, fontSize: 12, color: "#b91c1c" }}>
                  Nessun operatore attivo disponibile
                </div>
              )}
              <label style={{ display: "block", marginBottom: 10 }}>
                Messaggio<br />
                <textarea value={bulkMsg} onChange={(e) => setBulkMsg(e.target.value)} rows={8} style={{ width: "100%", padding: 8 }} />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input type="checkbox" checked={bulkSendEmail} onChange={(e) => setBulkSendEmail(e.target.checked)} />
                Invia email
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "white" }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={sendBulkFatturaAlert}
                disabled={bulkSending || !bulkToOperatoreId}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  opacity: bulkSending || !bulkToOperatoreId ? 0.6 : 1,
                }}
              >
                {bulkSending ? "Invio..." : "Invia"}
              </button>
            </div>
            {bulkErr && <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>{bulkErr}</div>}
            {bulkOk && <div style={{ marginTop: 6, fontSize: 12, color: "#166534" }}>{bulkOk}</div>}
          </div>
        </div>
      )}

      {bulkPreviewOpen && bulkLastMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setBulkPreviewOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Recap ultimo alert bulk</div>
              <button
                type="button"
                onClick={() => setBulkPreviewOpen(false)}
                style={{
                  marginLeft: "auto",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                Chiudi
              </button>
            </div>
            <textarea readOnly value={bulkLastMessage} rows={12} style={{ width: "100%", marginTop: 10, padding: 10, fontSize: 12 }} />
          </div>
        </div>
      )}
    </>
  );
}
