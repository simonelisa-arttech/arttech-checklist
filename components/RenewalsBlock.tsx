"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type AnyRow = any;

type Props = {
  cliente?: string;
  rows: AnyRow[];
  checklistById?: Map<string, any>;
  rinnoviError?: string | null;
  rinnoviNotice?: string | null;
  setRinnoviNotice?: (value: string | null) => void;
  getWorkflowStato: (row: AnyRow) => string;
  actionsByTipo: Record<string, { avviso: boolean; conferma: boolean; non_rinnovato: boolean; fattura: boolean }>;
  alertStatsMap?: Map<string, any>;
  getAlertKeyForRow?: (row: AnyRow) => string;
  renderScadenzaBadge: (scadenza?: string | null) => ReactNode;
  renderTagliandoStatoBadge: (stato?: string | null) => ReactNode;
  renderAvvisatoBadge: (stats: any, ctx: any) => ReactNode;
  renderRinnovoStatoBadge: (stato?: string | null) => ReactNode;
  renderModalitaBadge: (modalita?: string | null) => ReactNode;
  onSendAlert: (row: AnyRow) => void;
  onSetDaFatturare: (row: AnyRow) => void;
  onSetFatturato: (row: AnyRow) => void;
  onSetConfermato: (row: AnyRow) => void;
  onSetNonRinnovato: (row: AnyRow) => void;
  onEdit: (row: AnyRow) => void;

  editOpen: boolean;
  editForm: any;
  setEditOpen: (open: boolean) => void;
  setEditForm: (next: any) => void;
  saveEdit: () => void;
  deleteEdit?: () => void;
  editSaving?: boolean;
  editError?: string | null;
  licenzaStati: string[];
  tagliandoStati: string[];
  tagliandoModalita: string[];
  rinnovoStati: string[];
};

export default function RenewalsBlock({
  cliente,
  rows,
  checklistById,
  rinnoviError,
  rinnoviNotice,
  setRinnoviNotice,
  getWorkflowStato,
  actionsByTipo,
  alertStatsMap,
  getAlertKeyForRow,
  renderScadenzaBadge,
  renderTagliandoStatoBadge,
  renderAvvisatoBadge,
  renderRinnovoStatoBadge,
  renderModalitaBadge,
  onSendAlert,
  onSetDaFatturare,
  onSetFatturato,
  onSetConfermato,
  onSetNonRinnovato,
  onEdit,
  editOpen,
  editForm,
  setEditOpen,
  setEditForm,
  saveEdit,
  deleteEdit,
  editSaving,
  editError,
  licenzaStati,
  tagliandoStati,
  tagliandoModalita,
  rinnovoStati,
}: Props) {
  const tableGrid = "minmax(250px,1.8fr) minmax(180px,1.2fr) 130px 170px minmax(260px,1.3fr)";
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  return (
    <>
      {rinnoviError && <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>{rinnoviError}</div>}
      {rinnoviNotice && <div style={{ marginTop: 6, color: "#166534", fontSize: 12 }}>{rinnoviNotice}</div>}

      {rows.length === 0 ? (
        <div style={{ marginTop: 8, opacity: 0.7 }}>Nessuna scadenza/rinnovo trovato</div>
      ) : (
        <div
          data-testid="renewals-table"
          style={{
            marginTop: 10,
            border: "1px solid #eee",
            borderRadius: 12,
            overflowX: "auto",
            overflowY: "hidden",
            background: "white",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: tableGrid,
              padding: "12px 12px",
              fontWeight: 800,
              background: "#fafafa",
              borderBottom: "1px solid #eee",
              fontSize: 12,
              columnGap: 10,
              minWidth: 980,
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
              Cliente / Progetto
            </div>
            <div>Tipo rinnovo</div>
            <div style={{ textAlign: "center" }}>Scadenza</div>
            <div style={{ textAlign: "center" }}>Stato</div>
            <div style={{ textAlign: "center" }}>Azioni</div>
          </div>

          {rows.map((r, index) => {
            const checklist = r.checklist_id ? checklistById?.get(r.checklist_id) : null;
            const checklistName = checklist?.nome_checklist ?? r.checklist_id?.slice(0, 8);
            const stato = getWorkflowStato(r);
            const isTagliando = r.source === "tagliandi" || r.source === "tagliando";
            const isLicenza = r.source === "licenze" || r.source === "licenza";
            const isGaranzia = r.source === "garanzie" || r.source === "garanzia";
            const tipoUpper = String(r.item_tipo || r.tipo || "").toUpperCase();
            const actions = actionsByTipo[tipoUpper] || {
              avviso: !isGaranzia,
              conferma: !isGaranzia,
              non_rinnovato: !isGaranzia,
              fattura: !isGaranzia,
            };
            const hasScadenza = Boolean(r.scadenza);
            const canStage1 = actions.avviso && (isLicenza ? hasScadenza : ["DA_AVVISARE", "AVVISATO"].includes(stato));
            const canConfirm = actions.conferma
              ? isTagliando
                ? !["DA_FATTURARE", "FATTURATO", "SCADUTO"].includes(stato)
                : !["CONFERMATO", "DA_FATTURARE", "FATTURATO", "NON_RINNOVATO"].includes(stato)
              : false;
            const canStage2 = actions.fattura
              ? !["FATTURATO", "NON_RINNOVATO", "SCADUTO"].includes(stato)
              : false;
            const canNonRinnovato = actions.non_rinnovato
              ? isTagliando
                ? !["FATTURATO", "SCADUTO"].includes(stato)
                : !["FATTURATO", "NON_RINNOVATO"].includes(stato)
              : false;
            const canFatturato = actions.fattura ? stato === "DA_FATTURARE" : false;
            const alertStats = getAlertKeyForRow ? alertStatsMap?.get(getAlertKeyForRow(r)) || null : null;
            const lastSent = alertStats?.last_sent_at ? new Date(alertStats.last_sent_at).toLocaleString() : "—";
            const lastSentTooltip = alertStats
              ? `Totale invii: ${alertStats.n_avvisi}\nUltimo invio: ${lastSent}`
              : "Nessun invio";
            const rowKey = String(r.id || r.key || "");
            const isHovered = hoveredRowId === rowKey;
            const rowBackground = isHovered ? "#f8fafc" : index % 2 === 0 ? "#ffffff" : "#fbfdff";

            return (
              <div
                key={r.id || r.key}
                data-testid="renewal-row"
                data-item-tipo={String(r.item_tipo || r.tipo || "").toUpperCase()}
                data-source={String(r.source || "")}
                onMouseEnter={() => setHoveredRowId(rowKey)}
                onMouseLeave={() => setHoveredRowId((current) => (current === rowKey ? null : current))}
                style={{
                  display: "grid",
                  gridTemplateColumns: tableGrid,
                  padding: "12px 12px",
                  borderBottom: "1px solid #dbe4ee",
                  alignItems: "center",
                  fontSize: 12,
                  columnGap: 10,
                  minWidth: 980,
                  background: rowBackground,
                  transition: "background-color 120ms ease",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: 4,
                    minWidth: 0,
                    position: "sticky",
                    left: 0,
                    zIndex: 1,
                    background: rowBackground,
                    paddingRight: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#0f172a",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      lineHeight: 1.35,
                    }}
                  >
                    {r.cliente || cliente || "—"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      lineHeight: 1.35,
                    }}
                  >
                    {checklistName || "—"}
                  </div>
                  {r.checklist_id && (
                    <Link
                      href={`/checklists/${r.checklist_id}`}
                      style={{ fontSize: 11, color: "#2563eb", textDecoration: "none", whiteSpace: "normal" }}
                    >
                      Apri progetto
                    </Link>
                  )}
                </div>
                <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                  <div>{renderRinnovoStatoBadge(String(r.item_tipo || r.tipo || "—").toUpperCase())}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#475569",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      lineHeight: 1.35,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Rif:</span> {r.riferimento ?? r.descrizione ?? "—"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" }}>
                  <div>{r.scadenza ? new Date(r.scadenza).toLocaleDateString() : "—"}</div>
                  {renderScadenzaBadge(r.scadenza)}
                </div>
                <div style={{ overflow: "visible", display: "grid", gap: 6, justifyItems: "center", textAlign: "center" }}>
                  <div data-testid="workflow-badge">
                    {isTagliando
                      ? renderTagliandoStatoBadge(r.stato)
                      : stato === "AVVISATO"
                      ? renderAvvisatoBadge(alertStats, {
                          cliente,
                          checklist_id: r.checklist_id ?? null,
                          tipo: r.item_tipo ?? null,
                        })
                      : renderRinnovoStatoBadge(stato)}
                  </div>
                  <div title={lastSentTooltip} style={{ fontSize: 11, color: "#64748b" }}>
                    {lastSent}
                  </div>
                  <div>{isTagliando ? renderModalitaBadge(r.modalita) : "—"}</div>
                </div>
                <div
                  data-testid="workflow-actions-btn"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 6,
                    width: "100%",
                  }}
                >
                  {actions.avviso && (
                    <>
                      <button
                        type="button"
                        data-testid="send-alert-btn"
                        data-status-target="AVVISATO"
                        onClick={() => onSendAlert(r)}
                        disabled={!canStage1}
                        style={{
                          padding: "0 6px",
                          minWidth: 84,
                          height: 38,
                          borderRadius: 6,
                          border: "1px solid #111",
                          background: "white",
                          cursor: canStage1 ? "pointer" : "not-allowed",
                          fontSize: 10,
                          fontWeight: 700,
                          opacity: canStage1 ? 1 : 0.5,
                          textAlign: "center",
                          whiteSpace: "normal",
                          lineHeight: 1.1,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {stato === "AVVISATO" ? "Invia nuovo avviso" : "Invia avviso"}
                      </button>
                      {actions.fattura && (
                        <button
                          type="button"
                          data-testid="set-status-DA_FATTURARE"
                          onClick={() => {
                            if (stato === "DA_FATTURARE") setRinnoviNotice?.("Riga già in stato DA_FATTURARE.");
                            else onSetDaFatturare(r);
                          }}
                          disabled={!canStage2}
                          style={{
                            padding: "0 6px",
                            minWidth: 84,
                            height: 38,
                            borderRadius: 6,
                            border: "1px solid #111",
                            background: "white",
                            cursor: canStage2 ? "pointer" : "not-allowed",
                            fontSize: 10,
                            fontWeight: 700,
                            opacity: canStage2 ? 1 : 0.5,
                            textAlign: "center",
                            whiteSpace: "normal",
                            lineHeight: 1.1,
                            overflowWrap: "anywhere",
                          }}
                        >
                          DA_FATTURARE
                        </button>
                      )}
                      {actions.fattura && (
                        <button
                          type="button"
                          data-testid="set-status-FATTURATO"
                          onClick={() => onSetFatturato(r)}
                          disabled={!canFatturato}
                          style={{
                            padding: "0 6px",
                            minWidth: 84,
                            height: 38,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "#f9fafb",
                            cursor: canFatturato ? "pointer" : "not-allowed",
                            fontSize: 10,
                            opacity: canFatturato ? 1 : 0.5,
                            textAlign: "center",
                            whiteSpace: "normal",
                            lineHeight: 1.1,
                            overflowWrap: "anywhere",
                          }}
                        >
                          FATTURATO
                        </button>
                      )}
                    </>
                  )}
                  {(actions.conferma || actions.non_rinnovato || actions.fattura) && (
                    <>
                      {actions.conferma && (
                        <button
                          type="button"
                          data-testid="set-status-CONFERMATO"
                          onClick={() => onSetConfermato(r)}
                          disabled={!canConfirm}
                          style={{
                            padding: "0 6px",
                            minWidth: 84,
                            height: 38,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "#f9fafb",
                            cursor: canConfirm ? "pointer" : "not-allowed",
                            fontSize: 10,
                            opacity: canConfirm ? 1 : 0.5,
                            textAlign: "center",
                            whiteSpace: "normal",
                            lineHeight: 1.1,
                            overflowWrap: "anywhere",
                          }}
                        >
                          Confermato
                        </button>
                      )}
                      {actions.non_rinnovato && (
                        <button
                          type="button"
                          data-testid="set-status-NON_RINNOVATO"
                          onClick={() => onSetNonRinnovato(r)}
                          disabled={!canNonRinnovato}
                          style={{
                            padding: "0 6px",
                            minWidth: 84,
                            height: 38,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: "#f9fafb",
                            cursor: canNonRinnovato ? "pointer" : "not-allowed",
                            fontSize: 10,
                            opacity: canNonRinnovato ? 1 : 0.5,
                            textAlign: "center",
                            whiteSpace: "normal",
                            lineHeight: 1.1,
                            overflowWrap: "anywhere",
                          }}
                        >
                          NON_RINNOVATO
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="edit-expiry-btn"
                        onClick={() => onEdit(r)}
                        style={{
                          padding: "0 6px",
                          minWidth: 84,
                          height: 38,
                          borderRadius: 6,
                          border: "1px solid #111",
                          background: "white",
                          cursor: "pointer",
                          fontSize: 10,
                          fontWeight: 700,
                          textAlign: "center",
                          whiteSpace: "normal",
                          lineHeight: 1.1,
                          overflowWrap: "anywhere",
                        }}
                      >
                        Modifica
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editOpen && editForm && (
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
          onClick={() => setEditOpen(false)}
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
              <div style={{ fontWeight: 800, fontSize: 18 }}>Modifica {editForm.tipo}</div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: "white" }}
              >
                Chiudi
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <label>
                Scadenza<br />
                <input
                  type="date"
                  value={editForm.scadenza || ""}
                  onChange={(e) => setEditForm({ ...editForm, scadenza: e.target.value })}
                  style={{ width: "100%", padding: 8 }}
                />
              </label>

              {editForm.tipo === "SAAS" && (
                <label>
                  Piano<br />
                  <input
                    value={editForm.saas_piano || "—"}
                    readOnly
                    style={{ width: "100%", padding: 8, background: "#f9fafb" }}
                  />
                </label>
              )}
              {editForm.tipo === "SAAS_ULTRA" && (
                <label>
                  Piano ULTRA<br />
                  <input
                    value={editForm.saas_piano || "—"}
                    readOnly
                    style={{ width: "100%", padding: 8, background: "#f9fafb" }}
                  />
                </label>
              )}

              {editForm.tipo === "LICENZA" && (
                <>
                  <label>
                    Classe voce<br />
                    <select
                      value={editForm.licenza_class || "LICENZA"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          licenza_class: (e.target.value as "LICENZA" | "GARANZIA") || "LICENZA",
                        })
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="LICENZA">LICENZA</option>
                      <option value="GARANZIA">GARANZIA (converte questa voce)</option>
                    </select>
                  </label>
                  <label>
                    Tipo / Piano<br />
                    <input
                      value={editForm.licenza_tipo || ""}
                      onChange={(e) => setEditForm({ ...editForm, licenza_tipo: e.target.value })}
                      disabled={editForm.licenza_class === "GARANZIA"}
                      style={{
                        width: "100%",
                        padding: 8,
                        background: editForm.licenza_class === "GARANZIA" ? "#f9fafb" : "white",
                      }}
                    />
                  </label>
                  {editForm.licenza_class === "GARANZIA" && (
                    <div style={{ fontSize: 12, color: "#92400e" }}>
                      Al salvataggio la licenza verrà rimossa e sarà impostata la scadenza garanzia sul progetto.
                    </div>
                  )}
                  <label>
                    Stato<br />
                    <select
                      value={editForm.stato || ""}
                      onChange={(e) => setEditForm({ ...editForm, stato: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    >
                      {licenzaStati.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Fornitore<br />
                    <input
                      value={editForm.fornitore || ""}
                      onChange={(e) => setEditForm({ ...editForm, fornitore: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                  <label>
                    Intestato a<br />
                    <input
                      value={editForm.intestato_a || ""}
                      onChange={(e) => setEditForm({ ...editForm, intestato_a: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                  <label>
                    Note<br />
                    <input
                      value={editForm.note || ""}
                      onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                </>
              )}

              {editForm.tipo === "TAGLIANDO" && (
                <>
                  <label>
                    Stato<br />
                    <select
                      value={editForm.stato || ""}
                      onChange={(e) => setEditForm({ ...editForm, stato: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    >
                      {tagliandoStati.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Modalità<br />
                    <select
                      value={editForm.modalita || ""}
                      onChange={(e) => setEditForm({ ...editForm, modalita: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="">—</option>
                      {tagliandoModalita.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Note<br />
                    <input
                      value={editForm.note || ""}
                      onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                </>
              )}

              {editForm.tipo === "RINNOVO" && (
                <>
                  <label>
                    Stato<br />
                    <select
                      value={editForm.stato || ""}
                      onChange={(e) => setEditForm({ ...editForm, stato: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    >
                      {rinnovoStati.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Descrizione<br />
                    <input
                      value={editForm.descrizione || ""}
                      onChange={(e) => setEditForm({ ...editForm, descrizione: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </label>
                </>
              )}

              {editForm.tipo === "SAAS" && (
                <label>
                  Note<br />
                  <input
                    value={editForm.note || ""}
                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                    style={{ width: "100%", padding: 8 }}
                  />
                </label>
              )}
              {editForm.tipo === "SAAS_ULTRA" && (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Modifica solo la data di scadenza.</div>
              )}
              {editForm.tipo === "GARANZIA" && (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Modifica solo la data di scadenza.</div>
              )}
            </div>

            {editError && <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>{editError}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
              {deleteEdit &&
                ["LICENZA", "TAGLIANDO", "RINNOVO", "SAAS_ULTRA", "SAAS", "GARANZIA"].includes(
                  String(editForm.tipo || "")
                ) && (
                <button
                  type="button"
                  onClick={deleteEdit}
                  disabled={!!editSaving}
                  style={{ marginRight: "auto", padding: "8px 12px", borderRadius: 8, border: "1px solid #b91c1c", background: "white", color: "#b91c1c", opacity: editSaving ? 0.6 : 1 }}
                >
                  Elimina voce
                </button>
              )}
              <button type="button" onClick={() => setEditOpen(false)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "white" }}>
                Annulla
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={!!editSaving}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #111", background: "#111", color: "white", opacity: editSaving ? 0.6 : 1 }}
              >
                {editSaving ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
