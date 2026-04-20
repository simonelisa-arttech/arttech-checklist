"use client";

import Link from "next/link";
import DashboardTable from "@/app/components/DashboardTable";
import OperativeNotesPanel from "@/components/OperativeNotesPanel";
import type { ProjectFilterOption } from "@/lib/projectStatus";

type Props = {
  loading: boolean;
  itemsCount: number;
  q: string;
  setQ: (value: any) => void;
  saasServiceFilter: Record<string, boolean>;
  setSaasServiceFilter: (value: any) => void;
  projectStatusFilter: Record<string, boolean>;
  setProjectStatusFilter: (value: any) => void;
  projectStatusOptions: readonly ProjectFilterOption[];
  displayRows: any[];
  toggleSort: (key: any) => void;
  sortIcon: (key: any) => string;
  expandedDashboardNoteId: string | null;
  setExpandedDashboardNoteId: (value: any) => void;
  expandedSaasNoteId: string | null;
  setExpandedSaasNoteId: (value: any) => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  getChecklistM2: (row: any) => number | null;
  renderDashboardAddressCell: (value?: string | null) => React.ReactNode;
  saasLabelFromCode: (code?: string | null) => string;
  renderSlaBadge: (code?: string | null) => React.ReactNode;
  getExpiryStatus: (value?: string | null) => "ATTIVA" | "SCADUTA" | "—";
  renderBadge: (label: "ATTIVA" | "SCADUTA" | "—") => React.ReactNode;
  renderStatusBadge: (value?: string | null) => React.ReactNode;
  getProjectStatusLabel: (project: any) => string;
  getProjectNoleggioState: (project: any) => {
    isNoleggioAttivo: boolean;
    disinstallazioneImminente: boolean;
  };
  formatOperatoreRef: (refId?: string | null) => string;
};

const headerCellStyle = {
  textAlign: "left" as const,
  padding: "10px 12px",
  cursor: "pointer",
  position: "sticky" as const,
  top: 0,
  background: "white",
  zIndex: 2,
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
};

export default function DashboardProjectsSection({
  loading,
  itemsCount,
  q,
  setQ,
  saasServiceFilter,
  setSaasServiceFilter,
  projectStatusFilter,
  setProjectStatusFilter,
  projectStatusOptions,
  displayRows,
  toggleSort,
  sortIcon,
  expandedDashboardNoteId,
  setExpandedDashboardNoteId,
  expandedSaasNoteId,
  setExpandedSaasNoteId,
  onOpenProject,
  onDeleteProject,
  getChecklistM2,
  renderDashboardAddressCell,
  saasLabelFromCode,
  renderSlaBadge,
  getExpiryStatus,
  renderBadge,
  renderStatusBadge,
  getProjectStatusLabel,
  getProjectNoleggioState,
  formatOperatoreRef,
}: Props) {
  return loading ? (
    <div>Caricamento…</div>
  ) : itemsCount === 0 ? (
    <div>Nessun PROGETTO presente</div>
  ) : (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginTop: 24,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca (cliente, nome, proforma, SAAS, scadenze…)"
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
            minWidth: 280,
          }}
        />

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            fontSize: 13,
            padding: "8px 10px",
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "white",
          }}
        >
          <span style={{ fontWeight: 700, opacity: 0.85 }}>SaaS</span>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={Object.values(saasServiceFilter).every(Boolean)}
              onChange={(e) => {
                const checked = e.target.checked;
                setSaasServiceFilter({
                  EVENTS: checked,
                  ULTRA: checked,
                  PREMIUM: checked,
                  PLUS: checked,
                });
              }}
            />
            Tutti
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={saasServiceFilter.EVENTS}
              onChange={(e) =>
                setSaasServiceFilter((prev: any) => ({ ...prev, EVENTS: e.target.checked }))
              }
            />
            Art Tech Events
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={saasServiceFilter.ULTRA}
              onChange={(e) =>
                setSaasServiceFilter((prev: any) => ({ ...prev, ULTRA: e.target.checked }))
              }
            />
            ULTRA
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={saasServiceFilter.PREMIUM}
              onChange={(e) =>
                setSaasServiceFilter((prev: any) => ({ ...prev, PREMIUM: e.target.checked }))
              }
            />
            PREMIUM
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={saasServiceFilter.PLUS}
              onChange={(e) =>
                setSaasServiceFilter((prev: any) => ({ ...prev, PLUS: e.target.checked }))
              }
            />
            PLUS
          </label>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            fontSize: 13,
            padding: "8px 10px",
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "white",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={projectStatusOptions.every((option) => projectStatusFilter[option.value])}
              onChange={(e) => {
                const checked = e.target.checked;
                setProjectStatusFilter(
                  Object.fromEntries(
                    projectStatusOptions.map((option) => [option.value, checked])
                  )
                );
              }}
            />
            Tutti stati
          </label>
          {projectStatusOptions.map((option) => (
            <label key={option.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={Boolean(projectStatusFilter[option.value])}
                onChange={(e) =>
                  setProjectStatusFilter((prev: any) => ({
                    ...prev,
                    [option.value]: e.target.checked,
                  }))
                }
              />
              {option.label}
            </label>
          ))}
        </div>

        <div style={{ fontSize: 12, opacity: 0.7 }}>Risultati: {displayRows.length}</div>
      </div>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 14,
          background: "white",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
        }}
      >
        <DashboardTable>
          <table
            style={{
              width: "max-content",
              minWidth: 1600,
              tableLayout: "fixed",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <colgroup>
              <col style={{ width: 170 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead>
              <tr>
                <th onClick={() => toggleSort("nome_checklist")} title="Ordina per Nome PROGETTO" style={headerCellStyle}>
                  PROGETTO
                  {sortIcon("nome_checklist")}
                </th>
                <th onClick={() => toggleSort("cliente")} title="Ordina per Cliente" style={headerCellStyle}>
                  Cliente
                  {sortIcon("cliente")}
                </th>
                <th onClick={() => toggleSort("proforma_doc")} title="Ordina per Proforma" style={headerCellStyle}>
                  Proforma
                  {sortIcon("proforma_doc")}
                </th>
                <th onClick={() => toggleSort("po")} title="Ordina per PO" style={headerCellStyle}>
                  PO
                  {sortIcon("po")}
                </th>
                <th onClick={() => toggleSort("data_prevista")} title="Ordina per Data installazione prevista" style={headerCellStyle}>
                  Data prevista
                  {sortIcon("data_prevista")}
                </th>
                <th onClick={() => toggleSort("data_tassativa")} title="Ordina per Data tassativa" style={headerCellStyle}>
                  Data tassativa
                  {sortIcon("data_tassativa")}
                </th>
                <th onClick={() => toggleSort("dimensioni")} title="Ordina per Dimensioni" style={headerCellStyle}>
                  Dimensioni
                  {sortIcon("dimensioni")}
                </th>
                <th onClick={() => toggleSort("passo")} title="Ordina per Passo" style={headerCellStyle}>
                  Passo
                  {sortIcon("passo")}
                </th>
                <th onClick={() => toggleSort("m2_calcolati")} title="Ordina per m2" style={{ ...headerCellStyle, textAlign: "right" }}>
                  m2
                  {sortIcon("m2_calcolati")}
                </th>
                <th onClick={() => toggleSort("tipo_impianto")} title="Ordina per Tipo impianto" style={headerCellStyle}>
                  Tipo impianto
                  {sortIcon("tipo_impianto")}
                </th>
                <th onClick={() => toggleSort("impianto_indirizzo")} title="Ordina per Indirizzo impianto" style={headerCellStyle}>
                  Indirizzo impianto
                  {sortIcon("impianto_indirizzo")}
                </th>
                <th onClick={() => toggleSort("data_installazione_reale")} title="Ordina per Installazione reale" style={headerCellStyle}>
                  Install. reale
                  {sortIcon("data_installazione_reale")}
                </th>
                <th onClick={() => toggleSort("codice")} title="Ordina per Codice" style={headerCellStyle}>
                  Codice
                  {sortIcon("codice")}
                </th>
                <th onClick={() => toggleSort("magazzino_importazione")} title="Ordina per Magazzino importazione" style={headerCellStyle}>
                  Magazzino
                  {sortIcon("magazzino_importazione")}
                </th>
                <th onClick={() => toggleSort("descrizione")} title="Ordina per Descrizione" style={headerCellStyle}>
                  Descrizione
                  {sortIcon("descrizione")}
                </th>
                <th onClick={() => toggleSort("saas_piano")} title="Ordina per SAAS" style={headerCellStyle}>
                  SAAS
                  {sortIcon("saas_piano")}
                </th>
                <th onClick={() => toggleSort("saas_scadenza")} title="Ordina per SAAS scadenza" style={headerCellStyle}>
                  SAAS scadenza
                  {sortIcon("saas_scadenza")}
                </th>
                <th onClick={() => toggleSort("saas_note")} title="Ordina per SAAS note" style={headerCellStyle}>
                  SAAS note
                  {sortIcon("saas_note")}
                </th>
                <th onClick={() => toggleSort("saas_stato")} title="Ordina per SAAS stato" style={{ ...headerCellStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                  SAAS stato
                  {sortIcon("saas_stato")}
                </th>
                <th onClick={() => toggleSort("garanzia_scadenza")} title="Ordina per Garanzia scadenza" style={{ ...headerCellStyle, whiteSpace: "nowrap" }}>
                  Garanzia
                  {sortIcon("garanzia_scadenza")}
                </th>
                <th onClick={() => toggleSort("licenze_attive")} title="Ordina per Licenze attive" style={headerCellStyle}>
                  Licenze # attive
                  {sortIcon("licenze_attive")}
                </th>
                <th onClick={() => toggleSort("licenze_prossima_scadenza")} title="Ordina per Licenze prossima scadenza" style={headerCellStyle}>
                  Licenze prossima scadenza
                  {sortIcon("licenze_prossima_scadenza")}
                </th>
                <th style={headerCellStyle}>Licenze dettaglio</th>
                <th onClick={() => toggleSort("stato_progetto")} title="Ordina per Stato progetto" style={headerCellStyle}>
                  Stato progetto
                  {sortIcon("stato_progetto")}
                </th>
                <th style={headerCellStyle}>Documenti</th>
                <th style={headerCellStyle}>Sezione 1</th>
                <th style={headerCellStyle}>Sezione 2</th>
                <th style={headerCellStyle}>Sezione 3</th>
                <th style={headerCellStyle}>Stato complessivo</th>
                <th onClick={() => toggleSort("pct_complessivo")} title="Ordina per % Stato complessivo" style={headerCellStyle}>
                  % Stato
                  {sortIcon("pct_complessivo")}
                </th>
                <th onClick={() => toggleSort("created_at")} title="Ordina per Data creazione" style={headerCellStyle}>
                  Creato
                  {sortIcon("created_at")}
                </th>
                <th onClick={() => toggleSort("updated_at")} title="Ordina per Data modifica" style={headerCellStyle}>
                  Modificato
                  {sortIcon("updated_at")}
                </th>
                <th style={headerCellStyle}>Creato da</th>
                <th style={headerCellStyle}>Modificato da</th>
                <th style={headerCellStyle}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((c) => {
                return (
                  <tr
                    key={c.id}
                    data-testid="project-row"
                    data-project-id={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenProject(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenProject(c.id);
                      }
                    }}
                    style={{
                      borderBottom: "1px solid #f7f7f7",
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div>{c.nome_checklist}</div>
                        <div
                          style={{
                            border: "1px solid #eef2f7",
                            borderRadius: 10,
                            padding: "8px 10px",
                            background: "#f9fafb",
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>Note operative</div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDashboardNoteId((prev: any) => (prev === c.id ? null : c.id));
                              }}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 8,
                                border: "1px solid #d1d5db",
                                background: "white",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {expandedDashboardNoteId === c.id ? "Chiudi" : "Apri"}
                            </button>
                          </div>
                          {expandedDashboardNoteId === c.id ? (
                            <OperativeNotesPanel
                              compact
                              items={[
                                {
                                  rowKind: "INSTALLAZIONE",
                                  rowRefId: c.id,
                                  label: "Installazione",
                                },
                                ...(String(c.noleggio_vendita || "").trim().toUpperCase() === "NOLEGGIO"
                                  ? [
                                      {
                                        rowKind: "DISINSTALLAZIONE" as const,
                                        rowRefId: c.id,
                                        label: "Disinstallazione",
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.7,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              —
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                      {c.cliente ? (
                        <Link
                          href={`/clienti/${encodeURIComponent(c.cliente)}`}
                          style={{
                            textDecoration: "underline",
                            fontWeight: 700,
                            color: "#2563eb",
                          }}
                          title="Apri scheda cliente"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {c.cliente}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                      {(() => {
                        const docs = (c.checklist_documents ?? []) as any[];
                        const proformaDocs = docs.filter((d) =>
                          String(d.tipo ?? "")
                            .toUpperCase()
                            .includes("PROFORMA")
                        );
                        const hasProforma = proformaDocs.length > 0;
                        const latest = proformaDocs[0];
                        const titleParts = [];
                        if (c.proforma) {
                          titleParts.push(`Proforma: ${c.proforma}`);
                        } else if (hasProforma) {
                          titleParts.push("Documento PROFORMA presente");
                        }
                        if (latest?.filename) {
                          titleParts.push(`File: ${latest.filename}`);
                        }
                        const title = titleParts.join(" | ");
                        return (
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span>{c.proforma ?? "—"}</span>
                            {hasProforma && (
                              <span title={title} style={{ cursor: "help" }}>
                                ✅
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.po ?? "—"}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                      {c.data_prevista ? new Date(c.data_prevista).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                      {c.data_tassativa ? new Date(c.data_tassativa).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.dimensioni ?? "—"}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.passo ?? "—"}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.85, textAlign: "right" }}>
                      {getChecklistM2(c) != null ? getChecklistM2(c)!.toFixed(2) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.tipo_impianto ?? "—"}</td>
                    <td
                      style={{
                        padding: "10px 12px",
                        opacity: 0.85,
                        width: 180,
                        maxWidth: 180,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {renderDashboardAddressCell(c.impianto_indirizzo)}
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                      {c.data_installazione_reale ? new Date(c.data_installazione_reale).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.codice ?? "—"}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.magazzino_importazione ?? "—"}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.descrizione ?? "—"}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                      {c.saas_piano ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span>{`${c.saas_piano} — ${saasLabelFromCode(c.saas_piano)}`}</span>
                          {renderSlaBadge(c.saas_piano)}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                      {c.saas_scadenza ? new Date(c.saas_scadenza).toLocaleDateString() : "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        opacity: 0.85,
                        cursor: c.saas_note ? "pointer" : "default",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!c.saas_note) return;
                        setExpandedSaasNoteId((prev: any) => (prev === c.id ? null : c.id));
                      }}
                    >
                      {c.saas_note ? (
                        <div style={{ display: "grid", gap: 4 }}>
                          <div
                            style={
                              expandedSaasNoteId === c.id
                                ? { whiteSpace: "pre-wrap" }
                                : {
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }
                            }
                          >
                            {c.saas_note}
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              opacity: 0.6,
                              userSelect: "none",
                            }}
                          >
                            {expandedSaasNoteId === c.id ? "clicca per chiudere" : "clicca per espandere"}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                      {renderBadge(getExpiryStatus(c.saas_scadenza))}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          alignItems: "flex-start",
                        }}
                      >
                        <span>{c.garanzia_scadenza ? new Date(c.garanzia_scadenza).toLocaleDateString() : "—"}</span>
                        <span>{renderBadge(getExpiryStatus(c.garanzia_scadenza))}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.licenze_attive != null ? c.licenze_attive : 0}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span>
                          {c.licenze_prossima_scadenza
                            ? new Date(c.licenze_prossima_scadenza).toLocaleDateString()
                            : "—"}
                        </span>
                        {renderBadge(getExpiryStatus(c.licenze_prossima_scadenza))}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{c.licenze_dettaglio ?? "—"}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        <span>{getProjectStatusLabel(c)}</span>
                        {getProjectNoleggioState(c).isNoleggioAttivo ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              background: "#dbeafe",
                              color: "#1d4ed8",
                            }}
                          >
                            NOLEGGIO ATTIVO
                          </span>
                        ) : null}
                        {getProjectNoleggioState(c).disinstallazioneImminente ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              background: "#ffedd5",
                              color: "#c2410c",
                            }}
                          >
                            ⚠ Disinstallazione imminente
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{renderStatusBadge(c.documenti)}</td>
                    <td style={{ padding: "10px 12px" }}>{renderStatusBadge(c.sezione_1)}</td>
                    <td style={{ padding: "10px 12px" }}>{renderStatusBadge(c.sezione_2)}</td>
                    <td style={{ padding: "10px 12px" }}>{renderStatusBadge(c.sezione_3)}</td>
                    <td style={{ padding: "10px 12px" }}>{renderStatusBadge(c.stato_complessivo)}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>
                      {c.pct_complessivo != null ? `${Math.round(c.pct_complessivo)}%` : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.75 }}>{new Date(c.created_at).toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.75 }}>
                      {c.updated_at ? new Date(c.updated_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{formatOperatoreRef(c.created_by_operatore)}</td>
                    <td style={{ padding: "10px 12px", opacity: 0.85 }}>{formatOperatoreRef(c.updated_by_operatore)}</td>
                    <td style={{ padding: "10px 12px", display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProject(c.id);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #2563eb",
                          background: "white",
                          color: "#2563eb",
                          cursor: "pointer",
                        }}
                      >
                        Apri
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(c.id);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #dc2626",
                          background: "white",
                          color: "#dc2626",
                          cursor: "pointer",
                        }}
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DashboardTable>

        {displayRows.length === 0 && <div style={{ padding: 14, opacity: 0.7 }}>Nessun risultato</div>}
      </div>
    </div>
  );
}
