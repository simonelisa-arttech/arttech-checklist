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
          personaleText={form.personale_previsto}
          personaleIds={form.personale_ids}
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
            {form.slots.map((slot, index) => {
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
                            slots: updateSlot(prev.slots, index, "data_inizio", e.target.value),
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
                              prev.slots,
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
                            slots: updateSlot(prev.slots, index, "orario", e.target.value),
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
                            slots: removeSlot(prev.slots, index),
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
                      slots: addSlot(prev.slots),
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
                  form.slots.reduce((total, slot) => total + (slot.durata_prevista_minuti ?? 0), 0)
                ) || "0"}
              </span>
            </div>
          </div>
        </div>
        {planningStatusOptions?.length && onPlanningStatusChange ? (
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Stato operativo</div>
            <select
              value={planningStatus || ""}
              disabled={readOnly}
              onChange={(e) => onPlanningStatusChange(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">Seleziona stato</option>
              {planningStatusOptions.map((option) => (
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
            personaleIds={form.personale_ids}
            legacyValue={form.personale_previsto}
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
            value={form.mezzi}
            disabled={readOnly}
            onChange={(e) => onChange((prev) => ({ ...prev, mezzi: e.target.value }))}
            style={{ width: "100%", minHeight: 70, padding: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Descrizione attività</div>
          <textarea
            value={form.descrizione_attivita}
            disabled={readOnly}
            onChange={(e) => onChange((prev) => ({ ...prev, descrizione_attivita: e.target.value }))}
            style={{ width: "100%", minHeight: 70, padding: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Indirizzo</div>
          <textarea
            value={form.indirizzo}
            disabled={readOnly}
            onChange={(e) => onChange((prev) => ({ ...prev, indirizzo: e.target.value }))}
            style={{ width: "100%", minHeight: 70, padding: 8 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Referente cliente</div>
          <div style={{ display: "grid", gap: 8 }}>
            {form.referenti_cliente.map((referente, index) => (
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
                          prev.referenti_cliente,
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
                          prev.referenti_cliente,
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
                          prev.referenti_cliente,
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
                          const referentiCliente = removeReferente(prev.referenti_cliente, index);
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
                      referenti_cliente: addReferente(prev.referenti_cliente),
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
              value={form.commerciale_art_tech_nome}
              disabled={readOnly}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, commerciale_art_tech_nome: e.target.value }))
              }
              placeholder="Nome"
              style={{ width: "100%", padding: 8 }}
            />
            <input
              value={form.commerciale_art_tech_contatto}
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
      {attachmentEntityId ? (
        <div style={{ marginTop: 12 }}>
          <AttachmentsPanel
            title={attachmentTitle}
            entityType={attachmentEntityType}
            entityId={attachmentEntityId}
            slotId={attachmentSlotId}
            mode={attachmentMode}
            multiple
            storagePrefix="checklist-operativi"
            allowUploads={false}
          />
        </div>
      ) : null}
    </div>
  );
}
