"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dispatch, MutableRefObject, SetStateAction, UIEvent } from "react";
import PersonaleMultiSelect from "@/components/PersonaleMultiSelect";
import SafetyComplianceBadge from "@/components/SafetyComplianceBadge";
import { formatOperativiDateLabel } from "@/lib/operativiSchedule";

type TimelineRow = any;
type CronoMeta = any;
type CronoComment = any;
type OperativiFields = any;

type CronoprogrammaPanelProps = {
  fromDate: string;
  setFromDate: Dispatch<SetStateAction<string>>;
  toDate: string;
  setToDate: Dispatch<SetStateAction<string>>;
  clienteFilter: string;
  setClienteFilter: Dispatch<SetStateAction<string>>;
  kindFilter: "TUTTI" | "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO";
  setKindFilter: Dispatch<
    SetStateAction<"TUTTI" | "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO">
  >;
  q: string;
  setQ: Dispatch<SetStateAction<string>>;
  personaleFilter: string;
  setPersonaleFilter: Dispatch<SetStateAction<string>>;
  clienti: string[];
  quickRangeDays: 7 | 15 | 30 | null;
  applyQuickRange: (days: 7 | 15 | 30) => void;
  showFatto: boolean;
  setShowFatto: Dispatch<SetStateAction<boolean>>;
  showHidden: boolean;
  setShowHidden: Dispatch<SetStateAction<boolean>>;
  filteredSorted: TimelineRow[];
  onExportCsv: () => void;
  topScrollRef: MutableRefObject<HTMLDivElement | null>;
  mainScrollRef: MutableRefObject<HTMLDivElement | null>;
  bottomScrollRef: MutableRefObject<HTMLDivElement | null>;
  scrollContentRef: MutableRefObject<HTMLDivElement | null>;
  onTopScroll: (e: UIEvent<HTMLDivElement>) => void;
  onMainScroll: (e: UIEvent<HTMLDivElement>) => void;
  onBottomScroll: (e: UIEvent<HTMLDivElement>) => void;
  scrollContentWidth: number;
  loading: boolean;
  sortBy: "data_prevista" | "data_tassativa";
  sortDir: "asc" | "desc";
  toggleSort: (field: "data_prevista" | "data_tassativa") => void;
  metaByKey: Record<string, CronoMeta>;
  commentsByKey: Record<string, CronoComment[]>;
  noteDraftByKey: Record<string, string>;
  setNoteDraftByKey: Dispatch<SetStateAction<Record<string, string>>>;
  stateLoading: boolean;
  savingFattoKey: string | null;
  savingHiddenKey: string | null;
  savingCommentKey: string | null;
  savingOperativiKey: string | null;
  deletingCommentId: string | null;
  noteHistoryKey: string | null;
  setNoteHistoryKey: Dispatch<SetStateAction<string | null>>;
  operativiDraftByKey: Record<string, OperativiFields>;
  setOperativiDraftByKey: Dispatch<SetStateAction<Record<string, OperativiFields>>>;
  conflictByKey: Record<string, any>;
  rowByKey: Record<string, TimelineRow>;
  setFatto: (row: TimelineRow, fatto: boolean) => void;
  setHidden: (row: TimelineRow, hidden: boolean) => void;
  addComment: (row: TimelineRow) => void;
  saveOperativi: (row: TimelineRow) => void;
  deleteComment: (row: TimelineRow, commentId: string) => void;
  getRowKey: (kind: "INSTALLAZIONE" | "DISINSTALLAZIONE" | "INTERVENTO", rowRefId: string) => string;
  getRowSchedule: (row: TimelineRow, value?: any) => {
    data_inizio: string;
    data_fine: string;
    durata_giorni: number;
  };
  extractOperativi: (meta?: CronoMeta | null) => OperativiFields;
  buildConflictTooltip: (personale: string[], mezzi: string[]) => string;
  hasDefinedOperativi: (meta?: CronoMeta | null) => boolean;
  emptyOperativi: OperativiFields;
};

export default function CronoprogrammaPanel({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  clienteFilter,
  setClienteFilter,
  kindFilter,
  setKindFilter,
  q,
  setQ,
  personaleFilter,
  setPersonaleFilter,
  clienti,
  quickRangeDays,
  applyQuickRange,
  showFatto,
  setShowFatto,
  showHidden,
  setShowHidden,
  filteredSorted,
  onExportCsv,
  topScrollRef,
  mainScrollRef,
  bottomScrollRef,
  scrollContentRef,
  onTopScroll,
  onMainScroll,
  onBottomScroll,
  scrollContentWidth,
  loading,
  sortBy,
  sortDir,
  toggleSort,
  metaByKey,
  commentsByKey,
  noteDraftByKey,
  setNoteDraftByKey,
  stateLoading,
  savingFattoKey,
  savingHiddenKey,
  savingCommentKey,
  savingOperativiKey,
  deletingCommentId,
  noteHistoryKey,
  setNoteHistoryKey,
  operativiDraftByKey,
  setOperativiDraftByKey,
  conflictByKey,
  rowByKey,
  setFatto,
  setHidden,
  addComment,
  saveOperativi,
  deleteComment,
  getRowKey,
  getRowSchedule,
  extractOperativi,
  buildConflictTooltip,
  hasDefinedOperativi,
  emptyOperativi,
}: CronoprogrammaPanelProps) {
  const [openConflictKey, setOpenConflictKey] = useState<string | null>(null);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,minmax(140px,1fr))",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <label>
          Da
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
            }}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          A
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
            }}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Cliente
          <select
            value={clienteFilter}
            onChange={(e) => setClienteFilter(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          >
            <option value="TUTTI">Tutti</option>
            {clienti.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo evento
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as any)}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          >
            <option value="TUTTI">Tutti</option>
            <option value="INSTALLAZIONE">Installazioni</option>
            <option value="DISINSTALLAZIONE">Smontaggi noleggio</option>
            <option value="INTERVENTO">Interventi</option>
          </select>
        </label>
        <label>
          Cerca
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="cliente/progetto/ticket/descrizione"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", flex: 1 }}>
          <label style={{ minWidth: 220, flex: "1 1 240px" }}>
            Personale previsto
            <input
              value={personaleFilter}
              onChange={(e) => setPersonaleFilter(e.target.value)}
              placeholder="Nome o incarico"
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {[7, 15, 30].map((days) => {
              const active = quickRangeDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => applyQuickRange(days as 7 | 15 | 30)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: active ? "1px solid #111" : "1px solid #ddd",
                    background: active ? "#111" : "white",
                    color: active ? "white" : "#111",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {days} giorni
                </button>
              );
            })}
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 38 }}>
            <input type="checkbox" checked={showFatto} onChange={(e) => setShowFatto(e.target.checked)} />
            Mostra righe fatte
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 38 }}>
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Mostra righe nascoste
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          <div style={{ fontSize: 13, opacity: 0.8, whiteSpace: "nowrap" }}>Risultati: {filteredSorted.length}</div>
        <button
          type="button"
          onClick={onExportCsv}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "white",
            cursor: "pointer",
          }}
        >
          ⬇ Export CSV
        </button>
        </div>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div
          ref={topScrollRef}
          onScroll={onTopScroll}
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            borderBottom: "1px solid #eee",
            background: "#fafafa",
            height: 16,
          }}
          aria-label="Scrollbar orizzontale superiore cronoprogramma"
        >
          <div style={{ width: scrollContentWidth, height: 1 }} />
        </div>
        <div ref={mainScrollRef} onScroll={onMainScroll} style={{ overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ position: "relative" }}>
            <div
              ref={scrollContentRef}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "96px 96px 72px 140px 190px 180px 120px 240px 210px 240px 240px 128px 120px 240px 240px 220px 112px 104px 104px",
                gap: 12,
                padding: "10px 12px",
                fontWeight: 700,
                background: "#fafafa",
                borderBottom: "1px solid #eee",
                minWidth: 3270,
                position: "sticky",
                top: 0,
                zIndex: 3,
                boxShadow: "0 1px 0 #eee",
              }}
            >
              <button
                type="button"
                onClick={() => toggleSort("data_prevista")}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
                title="Ordina per data prevista"
              >
                Data inizio {sortBy === "data_prevista" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </button>
              <button
                type="button"
                onClick={() => toggleSort("data_tassativa")}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
                title="Ordina per data tassativa"
              >
                Data fine {sortBy === "data_tassativa" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </button>
              <div>Durata</div>
              <div style={{ paddingRight: 18, whiteSpace: "nowrap" }}>Evento</div>
              <div style={{ paddingLeft: 6 }}>Cliente</div>
              <div>Progetto</div>
              <div>Ticket/Pf</div>
              <div>Personale previsto / incarico</div>
              <div>Mezzi</div>
              <div>Descrizione attività</div>
              <div>Indirizzo</div>
              <div>Orario</div>
              <div>Referente cliente</div>
              <div>Commerciale Art Tech</div>
              <div>Note</div>
              <div>Fatto</div>
              <div>Nascosta</div>
              <div>Azioni</div>
            </div>
            {loading ? (
              <div style={{ padding: 12, opacity: 0.7 }}>Caricamento...</div>
            ) : filteredSorted.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.7 }}>Nessun risultato</div>
            ) : (
              filteredSorted.map((r) => {
              const key = getRowKey(r.kind, r.row_ref_id);
              const meta = metaByKey[key];
              const schedule = getRowSchedule(r, meta);
              const fatto = Boolean(meta?.fatto ?? r.fatto);
              const hidden = Boolean(meta?.hidden);
              const operativoDefinito = hasDefinedOperativi(meta);
              const comments = commentsByKey[key] || [];
              const conflict = conflictByKey[key];
              const conflictTitle = buildConflictTooltip(
                conflict?.conflictDetails.personale || [],
                conflict?.conflictDetails.mezzi || []
              );
              return (
                <div
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "96px 96px 72px 140px 190px 180px 120px 240px 210px 240px 240px 128px 120px 240px 240px 220px 112px 104px 104px",
                    gap: 12,
                    padding: "10px 12px",
                    borderBottom: "1px solid #f3f4f6",
                    alignItems: "start",
                    opacity: hidden && showHidden ? 0.6 : 1,
                    fontStyle: hidden && showHidden ? "italic" : "normal",
                    background: operativoDefinito ? "#f0fdf4" : "white",
                    boxShadow: "none",
                    minWidth: 3270,
                  }}
                  title={conflict?.hasConflict ? conflictTitle : undefined}
                >
                  <div>{schedule.data_inizio ? formatOperativiDateLabel(schedule.data_inizio) : "—"}</div>
                  <div>{schedule.data_fine ? formatOperativiDateLabel(schedule.data_fine) : "—"}</div>
                  <div>{schedule.durata_giorni} gg</div>
                  <div style={{ paddingRight: 18 }}>
                    <div style={{ whiteSpace: "nowrap" }}>{r.kind}</div>
                    {operativoDefinito ? (
                      <div
                        style={{
                          marginTop: 6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 999,
                          border: "1px solid #86efac",
                          background: "#f0fdf4",
                          color: "#166534",
                          padding: "3px 8px",
                          fontSize: 12,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Operativo definito
                      </div>
                    ) : null}
                  </div>
                  <div style={{ paddingLeft: 6 }}>{r.cliente}</div>
                  <div>
                    {r.checklist_id ? (
                      <Link
                        href={`/checklists/${r.checklist_id}`}
                        style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 600 }}
                      >
                        {r.progetto}
                      </Link>
                    ) : (
                      r.progetto
                    )}
                  </div>
                  <div>{r.ticket_no || r.proforma || "—"}</div>
                  <div
                    title={
                      (operativiDraftByKey[key]?.personale_previsto ??
                        extractOperativi(meta).personale_previsto) || undefined
                    }
                  >
                    <PersonaleMultiSelect
                      personaleIds={operativiDraftByKey[key]?.personale_ids ?? []}
                      legacyValue={
                        operativiDraftByKey[key]?.personale_previsto ?? extractOperativi(meta).personale_previsto
                      }
                      compact
                      onChange={({ personaleIds, personaleDisplay }) =>
                        setOperativiDraftByKey((prev) => ({
                          ...prev,
                          [key]: {
                            ...(prev[key] || emptyOperativi),
                            personale_ids: personaleIds,
                            personale_previsto: personaleDisplay,
                          },
                        }))
                      }
                    />
                    {conflict?.hasConflict ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setOpenConflictKey((prev) => (prev === key ? null : key))}
                          style={{
                            marginTop: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            borderRadius: 999,
                            border: "1px solid #fca5a5",
                            background: "#fff1f2",
                            color: "#b91c1c",
                            padding: "3px 8px",
                            fontSize: 12,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                            appearance: "none",
                          }}
                        >
                          ⚠ Conflitto
                        </button>
                        {openConflictKey === key ? (
                          <div
                            style={{
                              marginTop: 6,
                              border: "1px solid #fca5a5",
                              background: "white",
                              color: "#374151",
                              borderRadius: 10,
                              padding: "8px 10px",
                              fontSize: 12,
                              lineHeight: 1.45,
                            }}
                          >
                            {conflictTitle}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    <div style={{ marginTop: 6 }}>
                      <SafetyComplianceBadge
                        personaleIds={operativiDraftByKey[key]?.personale_ids ?? extractOperativi(meta).personale_ids}
                        personaleText={
                          operativiDraftByKey[key]?.personale_previsto ?? extractOperativi(meta).personale_previsto
                        }
                        showSummary={false}
                        detailsOnClick
                      />
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={operativiDraftByKey[key]?.mezzi ?? ""}
                      onChange={(e) =>
                        setOperativiDraftByKey((prev) => ({
                          ...prev,
                          [key]: { ...(prev[key] || emptyOperativi), mezzi: e.target.value },
                        }))
                      }
                      placeholder="Mezzi"
                      style={{ width: "100%", minHeight: 64, padding: 6, resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <textarea
                      value={operativiDraftByKey[key]?.descrizione_attivita ?? ""}
                      onChange={(e) =>
                        setOperativiDraftByKey((prev) => ({
                          ...prev,
                          [key]: { ...(prev[key] || emptyOperativi), descrizione_attivita: e.target.value },
                        }))
                      }
                      placeholder="Descrizione attività"
                      style={{ width: "100%", minHeight: 64, padding: 6, resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <textarea
                      value={operativiDraftByKey[key]?.indirizzo ?? ""}
                      onChange={(e) =>
                        setOperativiDraftByKey((prev) => ({
                          ...prev,
                          [key]: { ...(prev[key] || emptyOperativi), indirizzo: e.target.value },
                        }))
                      }
                      placeholder="Indirizzo"
                      style={{ width: "100%", minHeight: 64, padding: 6, resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <input
                      value={operativiDraftByKey[key]?.orario ?? ""}
                      onChange={(e) =>
                        setOperativiDraftByKey((prev) => ({
                          ...prev,
                          [key]: { ...(prev[key] || emptyOperativi), orario: e.target.value },
                        }))
                      }
                      placeholder="Orario"
                      style={{ width: "100%", padding: 6 }}
                    />
                  </div>
                  <div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <input
                        value={operativiDraftByKey[key]?.referente_cliente_nome ?? ""}
                        onChange={(e) =>
                          setOperativiDraftByKey((prev) => ({
                            ...prev,
                            [key]: { ...(prev[key] || emptyOperativi), referente_cliente_nome: e.target.value },
                          }))
                        }
                        placeholder="Nome referente cliente"
                        style={{ width: "100%", padding: 6 }}
                      />
                      <input
                        value={operativiDraftByKey[key]?.referente_cliente_contatto ?? ""}
                        onChange={(e) =>
                          setOperativiDraftByKey((prev) => ({
                            ...prev,
                            [key]: { ...(prev[key] || emptyOperativi), referente_cliente_contatto: e.target.value },
                          }))
                        }
                        placeholder="Contatto referente cliente"
                        style={{ width: "100%", padding: 6 }}
                      />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <input
                        value={operativiDraftByKey[key]?.commerciale_art_tech_nome ?? ""}
                        onChange={(e) =>
                          setOperativiDraftByKey((prev) => ({
                            ...prev,
                            [key]: { ...(prev[key] || emptyOperativi), commerciale_art_tech_nome: e.target.value },
                          }))
                        }
                        placeholder="Nome commerciale Art Tech"
                        style={{ width: "100%", padding: 6 }}
                      />
                      <input
                        value={operativiDraftByKey[key]?.commerciale_art_tech_contatto ?? ""}
                        onChange={(e) =>
                          setOperativiDraftByKey((prev) => ({
                            ...prev,
                            [key]: {
                              ...(prev[key] || emptyOperativi),
                              commerciale_art_tech_contatto: e.target.value,
                            },
                          }))
                        }
                        placeholder="Contatto commerciale Art Tech"
                        style={{ width: "100%", padding: 6 }}
                      />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={noteDraftByKey[key] || ""}
                        onChange={(e) => setNoteDraftByKey((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Aggiungi nota..."
                        style={{ width: "100%", padding: 6 }}
                      />
                      <button
                        type="button"
                        onClick={() => addComment(r)}
                        disabled={savingCommentKey === key || stateLoading}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #111",
                          background: "#111",
                          color: "white",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          opacity: savingCommentKey === key ? 0.7 : 1,
                        }}
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteHistoryKey(key)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          background: "white",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                        title="Storico note"
                      >
                        +
                      </button>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                      {comments[0] ? (
                        <div
                          style={{
                            background: "#f9fafb",
                            border: "1px solid #eef2f7",
                            borderRadius: 8,
                            padding: "6px 8px",
                          }}
                        >
                          <div style={{ whiteSpace: "pre-wrap" }}>{comments[0].commento}</div>
                          <div style={{ opacity: 0.7, marginTop: 4 }}>
                            {(comments[0].created_by_nome || "Operatore") +
                              " · " +
                              (comments[0].created_at
                                ? new Date(comments[0].created_at).toLocaleString("it-IT")
                                : "—")}
                          </div>
                        </div>
                      ) : (
                        <span style={{ opacity: 0.7 }}>Nessuna nota</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        checked={fatto}
                        onChange={(e) => setFatto(r, e.target.checked)}
                        disabled={savingFattoKey === key || stateLoading}
                      />
                      Fatto
                    </label>
                    {meta?.updated_at && (
                      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>
                        {meta.updated_by_nome || "Operatore"} · {new Date(meta.updated_at).toLocaleString("it-IT")}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        checked={hidden}
                        onChange={(e) => setHidden(r, e.target.checked)}
                        disabled={savingHiddenKey === key || stateLoading}
                      />
                      Nascosta
                    </label>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => saveOperativi(r)}
                      disabled={savingOperativiKey === key || stateLoading}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #111",
                        background: savingOperativiKey === key ? "#f3f4f6" : "#111",
                        color: savingOperativiKey === key ? "#111" : "white",
                        cursor: savingOperativiKey === key ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {savingOperativiKey === key ? "..." : "Salva"}
                    </button>
                  </div>
                </div>
              );
              })
            )}
          </div>
        </div>
        <div
          ref={bottomScrollRef}
          onScroll={onBottomScroll}
          style={{
            overflowX: "scroll",
            overflowY: "hidden",
            borderTop: "1px solid #eee",
            background: "#fafafa",
            height: 16,
          }}
          aria-label="Scrollbar orizzontale cronoprogramma"
        >
          <div style={{ width: scrollContentWidth, height: 1 }} />
        </div>
      </div>
      {noteHistoryKey && (
        <div
          onClick={() => setNoteHistoryKey(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(760px, 96vw)",
              maxHeight: "80vh",
              overflow: "auto",
              background: "white",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: 14,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}
            >
              <div style={{ fontWeight: 800 }}>Storico note</div>
              <button
                type="button"
                onClick={() => setNoteHistoryKey(null)}
                style={{
                  border: "1px solid #ddd",
                  background: "white",
                  borderRadius: 8,
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
              >
                Chiudi
              </button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
              {rowByKey[noteHistoryKey]?.progetto || "Riga"}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {(commentsByKey[noteHistoryKey] || []).length === 0 ? (
                <div style={{ opacity: 0.7 }}>Nessuna nota presente</div>
              ) : (
                (commentsByKey[noteHistoryKey] || []).map((c) => {
                  const row = rowByKey[noteHistoryKey];
                  return (
                    <div
                      key={c.id}
                      style={{ border: "1px solid #eef2f7", borderRadius: 8, padding: "8px 10px", background: "#f9fafb" }}
                    >
                      <div style={{ whiteSpace: "pre-wrap" }}>{c.commento}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                        {(c.created_by_nome || "Operatore") +
                          " · " +
                          (c.created_at ? new Date(c.created_at).toLocaleString("it-IT") : "—")}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => row && deleteComment(row, c.id)}
                          disabled={deletingCommentId === c.id || !row}
                          style={{
                            border: "1px solid #ef4444",
                            background: "white",
                            color: "#b91c1c",
                            borderRadius: 8,
                            padding: "4px 8px",
                            cursor: row ? "pointer" : "not-allowed",
                            opacity: deletingCommentId === c.id ? 0.7 : 1,
                          }}
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
