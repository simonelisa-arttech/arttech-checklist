"use client";

import type { Dispatch, SetStateAction } from "react";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import PersonaleMultiSelect from "@/components/PersonaleMultiSelect";
import SafetyComplianceBadge from "@/components/SafetyComplianceBadge";
import {
  computeOperativiEndDate,
  estimatedMinutesToLegacyDays,
  hoursInputToMinutes,
  minutesToHoursInput,
} from "@/lib/operativiSchedule";

export type OperationalBlockEditorMeta = {
  updated_at?: string | null;
  updated_by_nome?: string | null;
};

export type OperationalBlockReferente = {
  id?: string;
  nome: string;
  contatto: string;
  ruolo: string;
};

export type OperationalBlockSlot = {
  id?: string;
  data_inizio: string;
  durata_prevista_minuti: number | null;
  orario: string;
};

export type OperationalBlockFormState = {
  slots: OperationalBlockSlot[];
  data_inizio: string;
  durata_giorni: string;
  personale_previsto: string;
  personale_ids: string[];
  mezzi: string;
  descrizione_attivita: string;
  indirizzo: string;
  orario: string;
  referenti_cliente: OperationalBlockReferente[];
  referente_cliente_nome: string;
  referente_cliente_contatto: string;
  commerciale_art_tech_nome: string;
  commerciale_art_tech_contatto: string;
};

export type OperationalBlockPlanningStatusOption = {
  value: string;
  label: string;
};

type OperationalBlockEditorProps = {
  title: string;
  attachmentTitle: string;
  attachmentEntityType: string;
  attachmentEntityId?: string | null;
  attachmentSlotId?: string | null;
  attachmentMode?: "block" | "slot" | "combined";
  form: OperationalBlockFormState;
  onChange: Dispatch<SetStateAction<OperationalBlockFormState>>;
  onSave?: () => void;
  saving?: boolean;
  meta?: OperationalBlockEditorMeta | null;
  errorMessage?: string | null;
  notice?: string | null;
  fallbackStartDate: string;
  warningMessage?: string | null;
  readOnly?: boolean;
  planningStatus?: string | null;
  planningStatusOptions?: OperationalBlockPlanningStatusOption[];
  onPlanningStatusChange?: (value: string) => void;
};

function createEmptyOperationalBlockSlot(): OperationalBlockSlot {
  return {
    data_inizio: "",
    durata_prevista_minuti: null,
    orario: "",
  };
}

function addSlot(list: OperationalBlockSlot[]) {
  return [...list, createEmptyOperationalBlockSlot()];
}

function removeSlot(list: OperationalBlockSlot[], index: number) {
  const next = list.filter((_, currentIndex) => currentIndex !== index);
  return next.length > 0 ? next : [createEmptyOperationalBlockSlot()];
}

function updateSlot<TField extends keyof Omit<OperationalBlockSlot, "id">>(
  list: OperationalBlockSlot[],
  index: number,
  field: TField,
  value: OperationalBlockSlot[TField]
) {
  return list.map((row, currentIndex) =>
    currentIndex === index ? { ...row, [field]: value } : row
  );
}

function addReferente(list: OperationalBlockReferente[]) {
  return [...list, { nome: "", contatto: "", ruolo: "" }];
}

function removeReferente(list: OperationalBlockReferente[], index: number) {
  const next = list.filter((_, currentIndex) => currentIndex !== index);
  return next.length > 0 ? next : [{ nome: "", contatto: "", ruolo: "" }];
}

function updateReferente(
  list: OperationalBlockReferente[],
  index: number,
  field: keyof Omit<OperationalBlockReferente, "id">,
  value: string
) {
  return list.map((row, currentIndex) =>
    currentIndex === index ? { ...row, [field]: value } : row
  );
}

function normalizeOperationalBlockSlot(
  value: Partial<OperationalBlockSlot> | null | undefined
): OperationalBlockSlot {
  return {
    ...(value?.id ? { id: String(value.id).trim() } : {}),
    data_inizio: String(value?.data_inizio || ""),
    durata_prevista_minuti:
      value?.durata_prevista_minuti == null || !Number.isFinite(Number(value.durata_prevista_minuti))
        ? null
        : Number(value.durata_prevista_minuti),
    orario: String(value?.orario || ""),
  };
}

function normalizeOperationalBlockReferente(
  value: Partial<OperationalBlockReferente> | null | undefined
): OperationalBlockReferente {
  return {
    ...(value?.id ? { id: String(value.id).trim() } : {}),
    nome: String(value?.nome || ""),
    contatto: String(value?.contatto || ""),
    ruolo: String(value?.ruolo || ""),
  };
}

function normalizeOperationalBlockForm(form: OperationalBlockFormState): OperationalBlockFormState {
  const slots = Array.isArray(form?.slots)
    ? form.slots.map((slot) => normalizeOperationalBlockSlot(slot))
    : [];
  const referentiCliente = Array.isArray(form?.referenti_cliente)
    ? form.referenti_cliente.map((referente) => normalizeOperationalBlockReferente(referente))
    : [];
  return {
    slots: slots.length > 0 ? slots : [createEmptyOperationalBlockSlot()],
    data_inizio: String(form?.data_inizio || ""),
    durata_giorni: String(form?.durata_giorni || ""),
    personale_previsto: String(form?.personale_previsto || ""),
    personale_ids: Array.isArray(form?.personale_ids)
      ? form.personale_ids.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
    mezzi: String(form?.mezzi || ""),
    descrizione_attivita: String(form?.descrizione_attivita || ""),
    indirizzo: String(form?.indirizzo || ""),
    orario: String(form?.orario || ""),
    referenti_cliente:
      referentiCliente.length > 0 ? referentiCliente : [{ nome: "", contatto: "", ruolo: "" }],
    referente_cliente_nome: String(form?.referente_cliente_nome || ""),
    referente_cliente_contatto: String(form?.referente_cliente_contatto || ""),
    commerciale_art_tech_nome: String(form?.commerciale_art_tech_nome || ""),
    commerciale_art_tech_contatto: String(form?.commerciale_art_tech_contatto || ""),
  };
}

export default function OperationalBlockEditor({
  title,
  attachmentTitle,
  attachmentEntityType,
  attachmentEntityId,
  attachmentSlotId,
  attachmentMode = "block",
  form,
  onChange,
  onSave,
  saving = false,
  meta,
  errorMessage,
  notice,
  fallbackStartDate,
  warningMessage,
  readOnly = false,
  planningStatus,
  planningStatusOptions,
  onPlanningStatusChange,
}: OperationalBlockEditorProps) {
  const normalizedForm = normalizeOperationalBlockForm(form);
  const normalizedPlanningStatusOptions = Array.isArray(planningStatusOptions)
    ? planningStatusOptions
    : [];
  const normalizedAttachmentEntityId = String(attachmentEntityId || "").trim();
  const normalizedAttachmentEntityType = String(attachmentEntityType || "").trim();
  const normalizedAttachmentSlotId = String(attachmentSlotId || "").trim() || null;
  const resolvedAttachmentMode =
    attachmentMode === "combined"
      ? normalizedAttachmentSlotId
        ? "combined"
        : "block"
      : attachmentMode === "slot"
        ? normalizedAttachmentSlotId
          ? "slot"
          : null
        : "block";

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        background: "#fff",
      }}
    >
      <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        {warningMessage ? (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #fdba74",
              background: "#fff7ed",
              color: "#9a3412",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {warningMessage}
          </div>
        ) : null}
        <SafetyComplianceBadge
          personaleText={normalizedForm.personale_previsto}
          personaleIds={normalizedForm.personale_ids}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(280px, 1fr))",
          gap: 10,
        }}
      >
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>Giornate attività</div>
          <div style={{ display: "grid", gap: 8 }}>
            {normalizedForm.slots.map((slot, index) => {
              const computedEndDate = computeOperativiEndDate(
                slot.data_inizio || fallbackStartDate,
                estimatedMinutesToLegacyDays(slot.durata_prevista_minuti)
              );
              return (
                <div
                  key={slot.id || `slot-${index}`}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 8,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto",
                      gap: 8,
                      alignItems: "end",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>Data attività</div>
                      <input
                        type="date"
                        value={slot.data_inizio}
                        disabled={readOnly}
                        onChange={(e) =>
                          onChange((prev) => ({
                            ...prev,
                            slots: updateSlot(normalizeOperationalBlockForm(prev).slots, index, "data_inizio", e.target.value),
                          }))
                        }
                        style={{ width: "100%", padding: 8 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>Ore previste</div>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={minutesToHoursInput(slot.durata_prevista_minuti)}
                        disabled={readOnly}
                        onChange={(e) =>
                          onChange((prev) => ({
                            ...prev,
                            slots: updateSlot(
                              normalizeOperationalBlockForm(prev).slots,
                              index,
                              "durata_prevista_minuti",
                              hoursInputToMinutes(e.target.value)
                            ),
                          }))
                        }
                        placeholder="8"
                        style={{ width: "100%", padding: 8 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>Orario</div>
                      <input
                        value={slot.orario}
                        disabled={readOnly}
                        onChange={(e) =>
                          onChange((prev) => ({
                            ...prev,
                            slots: updateSlot(normalizeOperationalBlockForm(prev).slots, index, "orario", e.target.value),
                          }))
                        }
                        style={{ width: "100%", padding: 8 }}
                      />
                    </div>
                    {!readOnly ? (
                      <button
                        type="button"
                        onClick={() =>
                          onChange((prev) => ({
                            ...prev,
                            slots: removeSlot(normalizeOperationalBlockForm(prev).slots, index),
                          }))
                        }
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          background: "#fff",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          height: 38,
                        }}
                      >
                        Rimuovi
                      </button>
                    ) : null}
                  </div>
                  {!slot.data_inizio && fallbackStartDate && index === 0 ? (
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      Fallback automatico: {new Date(fallbackStartDate).toLocaleDateString("it-IT")}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    Data fine: {computedEndDate ? new Date(computedEndDate).toLocaleDateString("it-IT") : "—"}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      slots: addSlot(normalizeOperationalBlockForm(prev).slots),
                    }))
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  + Aggiungi giornata
                </button>
              ) : null}
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                Totale ore previste:{" "}
                {minutesToHoursInput(
                  normalizedForm.slots.reduce((total, slot) => total + (slot.durata_prevista_minuti ?? 0), 0)
                ) || "0"}
              </span>
            </div>
          </div>
        </div>
        {normalizedPlanningStatusOptions.length > 0 && onPlanningStatusChange ? (
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Stato operativo</div>
            <select
              value={planningStatus || ""}
              disabled={readOnly}
              onChange={(e) => onPlanningStatusChange(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">Seleziona stato</option>
              {normalizedPlanningStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Personale previsto / incarico</div>
          <PersonaleMultiSelect
            personaleIds={normalizedForm.personale_ids}
            legacyValue={normalizedForm.personale_previsto}
            onChange={({ personaleIds, personaleDisplay }) =>
              onChange((prev) => ({
                ...prev,
                personale_ids: personaleIds,
                personale_previsto: personaleDisplay,
              }))
            }
            disabled={readOnly}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Mezzi</div>
          <textarea
            value={normalizedForm.mezzi}
            disabled={readOnly}
            onChange={(e) => onChange((prev) => ({ ...prev, mezzi: e.target.value }))}
            style={{ width: "100%", minHeight: 70, padding: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Descrizione attività</div>
          <textarea
            value={normalizedForm.descrizione_attivita}
            disabled={readOnly}
            onChange={(e) => onChange((prev) => ({ ...prev, descrizione_attivita: e.target.value }))}
            style={{ width: "100%", minHeight: 70, padding: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Indirizzo</div>
          <textarea
            value={normalizedForm.indirizzo}
            disabled={readOnly}
            onChange={(e) => onChange((prev) => ({ ...prev, indirizzo: e.target.value }))}
            style={{ width: "100%", minHeight: 70, padding: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Referente cliente</div>
          <div style={{ display: "grid", gap: 8 }}>
            {normalizedForm.referenti_cliente.map((referente, index) => (
              <div
                key={referente.id || `referente-${index}`}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 8,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                    gap: 8,
                  }}
                >
                  <input
                    value={referente.nome}
                    disabled={readOnly}
                    onChange={(e) =>
                      onChange((prev) => {
                        const referentiCliente = updateReferente(
                          normalizeOperationalBlockForm(prev).referenti_cliente,
                          index,
                          "nome",
                          e.target.value
                        );
                        return {
                          ...prev,
                          referenti_cliente: referentiCliente,
                          referente_cliente_nome: referentiCliente[0]?.nome || "",
                        };
                      })
                    }
                    placeholder="Nome"
                    style={{ width: "100%", padding: 8 }}
                  />
                  <input
                    value={referente.contatto}
                    disabled={readOnly}
                    onChange={(e) =>
                      onChange((prev) => {
                        const referentiCliente = updateReferente(
                          normalizeOperationalBlockForm(prev).referenti_cliente,
                          index,
                          "contatto",
                          e.target.value
                        );
                        return {
                          ...prev,
                          referenti_cliente: referentiCliente,
                          referente_cliente_contatto: referentiCliente[0]?.contatto || "",
                        };
                      })
                    }
                    placeholder="Contatto"
                    style={{ width: "100%", padding: 8 }}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    value={referente.ruolo}
                    disabled={readOnly}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        referenti_cliente: updateReferente(
                          normalizeOperationalBlockForm(prev).referenti_cliente,
                          index,
                          "ruolo",
                          e.target.value
                        ),
                      }))
                    }
                    placeholder="es. Sicurezza / Elettrico / Permessi"
                    style={{ width: "100%", padding: 8 }}
                  />
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() =>
                        onChange((prev) => {
                          const referentiCliente = removeReferente(
                            normalizeOperationalBlockForm(prev).referenti_cliente,
                            index
                          );
                          return {
                            ...prev,
                            referenti_cliente: referentiCliente,
                            referente_cliente_nome: referentiCliente[0]?.nome || "",
                            referente_cliente_contatto: referentiCliente[0]?.contatto || "",
                          };
                        })
                      }
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        background: "#fff",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Rimuovi
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!readOnly ? (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      referenti_cliente: addReferente(
                        normalizeOperationalBlockForm(prev).referenti_cliente
                      ),
                    }))
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  + Aggiungi referente
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Commerciale Art Tech</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              value={normalizedForm.commerciale_art_tech_nome}
              disabled={readOnly}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, commerciale_art_tech_nome: e.target.value }))
              }
              placeholder="Nome"
              style={{ width: "100%", padding: 8 }}
            />
            <input
              value={normalizedForm.commerciale_art_tech_contatto}
              disabled={readOnly}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, commerciale_art_tech_contatto: e.target.value }))
              }
              placeholder="Contatto"
              style={{ width: "100%", padding: 8 }}
            />
          </div>
        </div>
      </div>
      {onSave ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || readOnly}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #111",
              background: saving || readOnly ? "#f3f4f6" : "#111",
              color: saving || readOnly ? "#111" : "white",
              cursor: saving || readOnly ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {saving ? "Salvataggio..." : "Salva dati operativi"}
          </button>
          {meta?.updated_at ? (
            <span style={{ fontSize: 12, opacity: 0.75 }}>
              Ultimo aggiornamento: {new Date(meta.updated_at).toLocaleString("it-IT")}
              {meta.updated_by_nome ? ` · ${meta.updated_by_nome}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
      {errorMessage ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>{errorMessage}</div>
      ) : null}
      {notice ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#166534" }}>{notice}</div>
      ) : null}
      {normalizedAttachmentEntityId && normalizedAttachmentEntityType && resolvedAttachmentMode ? (
        <div style={{ marginTop: 12 }}>
          <AttachmentsPanel
            title={attachmentTitle}
            entityType={normalizedAttachmentEntityType}
            entityId={normalizedAttachmentEntityId}
            slotId={normalizedAttachmentSlotId}
            mode={resolvedAttachmentMode}
            multiple
            storagePrefix="checklist-operativi"
            allowUploads={false}
          />
        </div>
      ) : null}
    </div>
  );
}
