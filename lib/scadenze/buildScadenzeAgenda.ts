export type ScadenzaAgendaTipo =
  | "GARANZIA"
  | "TAGLIANDO"
  | "LICENZA"
  | "SAAS"
  | "RINNOVO"
  | "SIM";
export type ScadenzaAgendaOrigine =
  | "rinnovi_servizi"
  | "tagliandi"
  | "licenses"
  | "checklists"
  | "saas_contratti"
  | "sim_cards";
export type ScadenzaAgendaSource =
  | "rinnovi"
  | "tagliandi"
  | "licenze"
  | "saas"
  | "garanzie"
  | "saas_contratto"
  | "sim";
export type ScadenzaAgendaWorkflowStato =
  | "DA_AVVISARE"
  | "AVVISATO"
  | "CONFERMATO"
  | "DA_FATTURARE"
  | "FATTURATO"
  | "NON_RINNOVATO";

export type ScadenzaAgendaRow = {
  id: string;
  origine: ScadenzaAgendaOrigine;
  source: ScadenzaAgendaSource;
  cliente: string | null;
  cliente_id: string | null;
  checklist_id: string | null;
  sim_id?: string | null;
  progetto: string | null;
  tipo: ScadenzaAgendaTipo;
  sottotipo: string | null;
  riferimento: string | null;
  descrizione: string | null;
  scadenza: string | null;
  stato: string | null;
  workflow_stato: ScadenzaAgendaWorkflowStato | null;
  fatturazione: string | null;
  note: string | null;
  raw_id: string | null;
};

export type ScadenzeAgendaFilters = {
  from?: string | null;
  to?: string | null;
  cliente?: string | null;
  cliente_id?: string | null;
  checklist_id?: string | null;
  tipo?: string | null;
  progetto?: string | null;
  stato?: string | null;
};

type ChecklistBaseRow = {
  id: string;
  cliente: string | null;
  cliente_id: string | null;
  nome_checklist: string | null;
  noleggio_vendita: string | null;
  garanzia_scadenza: string | null;
  garanzia_stato: string | null;
  saas_piano: string | null;
  saas_scadenza: string | null;
  saas_note: string | null;
  saas_tipo: string | null;
};

type LicenseRow = {
  id: string;
  checklist_id: string | null;
  tipo: string | null;
  scadenza: string | null;
  stato?: string | null;
  status?: string | null;
  note: string | null;
  ref_univoco?: string | null;
  telefono?: string | null;
  intestatario?: string | null;
  intestata_a?: string | null;
  gestore?: string | null;
  fornitore?: string | null;
};

type TagliandoRow = {
  id: string;
  cliente?: string | null;
  checklist_id?: string | null;
  scadenza?: string | null;
  stato?: string | null;
  note?: string | null;
  modalita?: string | null;
};

type RinnovoServizioRow = {
  id: string;
  cliente?: string | null;
  item_tipo?: string | null;
  subtipo?: string | null;
  sim_id?: string | null;
  riferimento?: string | null;
  descrizione?: string | null;
  checklist_id?: string | null;
  scadenza?: string | null;
  stato?: string | null;
  proforma?: string | null;
  cod_magazzino?: string | null;
  note_tecniche?: string | null;
};

type ContrattoRow = {
  id: string;
  cliente: string | null;
  piano_codice: string | null;
  scadenza: string | null;
  interventi_annui: number | null;
  illimitati: boolean | null;
};

type SimCardRow = {
  id: string;
  checklist_id: string | null;
  numero_telefono: string | null;
  intestatario: string | null;
  operatore: string | null;
  piano_attivo: string | null;
  device_installato: string | null;
  data_attivazione: string | null;
  data_scadenza: string | null;
  attiva: boolean | null;
};

type SimRechargeRow = {
  id: string;
  sim_id: string;
  data_ricarica: string | null;
};

function parseLocalDay(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    dt.setHours(0, 0, 0, 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function formatDateOnlyValue(date?: Date | null) {
  if (!date || !Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addOneYearToDate(value?: string | null) {
  const source = parseLocalDay(value);
  if (!source) return "";
  const next = new Date(source.getTime());
  next.setFullYear(next.getFullYear() + 1);
  if (next.getMonth() !== source.getMonth()) {
    next.setDate(0);
  }
  return formatDateOnlyValue(next);
}

function getLatestSimRechargeRow(rows: SimRechargeRow[]) {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const aTime = parseLocalDay(a.data_ricarica)?.getTime() || 0;
    const bTime = parseLocalDay(b.data_ricarica)?.getTime() || 0;
    return bTime - aTime;
  })[0] || null;
}

function getEffectiveSimScadenza(
  row: Pick<SimCardRow, "data_attivazione" | "data_scadenza">,
  latestRecharge?: Pick<SimRechargeRow, "data_ricarica"> | null
) {
  const activation = parseLocalDay(row.data_attivazione);
  const lastRecharge = parseLocalDay(latestRecharge?.data_ricarica);
  const baseDate =
    activation && lastRecharge
      ? activation.getTime() >= lastRecharge.getTime()
        ? row.data_attivazione
        : latestRecharge?.data_ricarica || ""
      : activation
        ? row.data_attivazione
        : lastRecharge
          ? latestRecharge?.data_ricarica || ""
          : "";
  if (baseDate) return addOneYearToDate(baseDate);
  return normalizeString(row.data_scadenza) || null;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getExpiryStatus(value?: string | null) {
  const dt = parseLocalDay(value);
  if (!dt) return null;
  return dt < startOfToday() ? "SCADUTA" : "ATTIVA";
}

function normalizeString(value?: string | null) {
  return String(value || "").trim();
}

function normalizeUpper(value?: string | null) {
  return normalizeString(value).toUpperCase();
}

function isSimLicenseType(value?: string | null) {
  return normalizeUpper(value) === "SIM";
}

function isNoleggioChecklist(value?: string | null) {
  return normalizeUpper(value) === "NOLEGGIO";
}

function normalizeTipo(
  itemTipo?: string | null,
  subtipo?: string | null
): { tipo: ScadenzaAgendaTipo; sottotipo: string | null } {
  const tipo = normalizeUpper(itemTipo);
  const sub = normalizeUpper(subtipo) || null;
  if (tipo === "SIM") return { tipo: "SIM", sottotipo: null };
  if (tipo === "GARANZIA") return { tipo: "GARANZIA", sottotipo: null };
  if (tipo === "TAGLIANDO") return { tipo: "TAGLIANDO", sottotipo: null };
  if (tipo === "LICENZA") return { tipo: "LICENZA", sottotipo: null };
  if (tipo === "SAAS" && sub === "ULTRA") return { tipo: "SAAS", sottotipo: "ULTRA" };
  if (tipo === "SAAS_ULTRA") return { tipo: "SAAS", sottotipo: "ULTRA" };
  if (tipo === "SAAS") return { tipo: "SAAS", sottotipo: null };
  return { tipo: "RINNOVO", sottotipo: sub };
}

function buildRinnovoReference(r: RinnovoServizioRow) {
  return (
    normalizeString(r.descrizione) ||
    normalizeUpper(r.item_tipo) ||
    normalizeString(r.id) ||
    null
  );
}

async function fetchRinnoviRows(supabase: any) {
  return supabase
    .from("rinnovi_servizi")
    .select("id, cliente, item_tipo, subtipo, sim_id, descrizione, checklist_id, scadenza, stato");
}

function buildLicenseReference(l: LicenseRow) {
  return (
    [
      l.intestata_a ? `Intestata: ${l.intestata_a}` : null,
      l.ref_univoco,
      l.telefono,
      l.intestatario,
      l.gestore,
      l.fornitore,
      l.note,
    ]
      .filter(Boolean)
      .join(" · ") ||
    l.tipo ||
    "Licenza"
  );
}

function getChecklistMaps(checklists: ChecklistBaseRow[]) {
  const byId = new Map<string, ChecklistBaseRow>();
  const byCliente = new Map<string, ChecklistBaseRow[]>();
  for (const row of checklists) {
    const id = normalizeString(row.id);
    if (id) byId.set(id, row);
    const cliente = normalizeString(row.cliente).toLowerCase();
    if (!cliente) continue;
    const current = byCliente.get(cliente) || [];
    current.push(row);
    byCliente.set(cliente, current);
  }
  return { byId, byCliente };
}

function getChecklistContext(
  maps: ReturnType<typeof getChecklistMaps>,
  checklistId?: string | null,
  cliente?: string | null
) {
  const id = normalizeString(checklistId);
  if (id) {
    const row = maps.byId.get(id);
    if (row) return row;
  }
  const clienteKey = normalizeString(cliente).toLowerCase();
  if (!clienteKey) return null;
  return (maps.byCliente.get(clienteKey) || [])[0] || null;
}

function getRinnovoMatch(
  item: {
    source: ScadenzaAgendaSource;
    item_tipo?: string | null;
    sim_id?: string | null;
    checklist_id?: string | null;
    scadenza?: string | null;
    cliente?: string | null;
  },
  rinnovi: RinnovoServizioRow[]
) {
  if (item.source === "rinnovi") {
    return (
      rinnovi.find((x) => normalizeString(x.id) === normalizeString((item as any).id)) || null
    );
  }
  const tipo = normalizeUpper(item.item_tipo);
  if (tipo === "SIM") {
    const simId = normalizeString(item.sim_id);
    if (!simId) return null;
    return rinnovi.find((x) => normalizeUpper(x.item_tipo) === "SIM" && normalizeString(x.sim_id) === simId) || null;
  }
  if (tipo === "SAAS_ULTRA") {
    return (
      rinnovi.find(
        (x) =>
          (normalizeUpper(x.item_tipo) === "SAAS_ULTRA" ||
            (normalizeUpper(x.item_tipo) === "SAAS" && normalizeUpper(x.subtipo) === "ULTRA")) &&
          normalizeString(x.checklist_id) === "" &&
          normalizeString(x.scadenza) === normalizeString(item.scadenza) &&
          normalizeString(x.cliente) === normalizeString(item.cliente)
      ) || null
    );
  }
  if (tipo === "GARANZIA") {
    return (
      rinnovi.find(
        (x) =>
          normalizeUpper(x.item_tipo) === "GARANZIA" &&
          normalizeString(x.checklist_id) === normalizeString(item.checklist_id)
      ) || null
    );
  }
  if (tipo === "SAAS") {
    return (
      rinnovi.find(
        (x) =>
          normalizeUpper(x.item_tipo) === "SAAS" &&
          normalizeUpper(x.subtipo) !== "ULTRA" &&
          normalizeString(x.checklist_id) === normalizeString(item.checklist_id)
      ) || null
    );
  }
  if (!normalizeString(item.checklist_id)) return null;
  return (
    rinnovi.find(
      (x) =>
        normalizeUpper(x.item_tipo) === tipo &&
        normalizeString(x.checklist_id) === normalizeString(item.checklist_id)
    ) || null
  );
}

function getWorkflowStato(
  item: {
    source: ScadenzaAgendaSource;
    item_tipo?: string | null;
    sim_id?: string | null;
    stato?: string | null;
    checklist_id?: string | null;
    scadenza?: string | null;
    cliente?: string | null;
  },
  rinnovi: RinnovoServizioRow[]
): ScadenzaAgendaWorkflowStato | null {
  const tipo = normalizeUpper(item.item_tipo);
  const raw = normalizeUpper(item.stato);
  if (item.source === "tagliandi") {
    const match = getRinnovoMatch(item, rinnovi);
    const stato = normalizeUpper(match?.stato);
    if (stato) return stato as ScadenzaAgendaWorkflowStato;
    if (raw === "ATTIVA") return "DA_AVVISARE";
    if (raw === "OK") return "CONFERMATO";
  }
  if (tipo === "SIM") {
    const match = getRinnovoMatch(item, rinnovi);
    return normalizeUpper(match?.stato) as ScadenzaAgendaWorkflowStato | null;
  }
  if (tipo === "SAAS" || tipo === "GARANZIA" || tipo === "SAAS_ULTRA") {
    const match = getRinnovoMatch(item, rinnovi);
    return normalizeUpper(match?.stato || "DA_AVVISARE") as ScadenzaAgendaWorkflowStato;
  }
  if (tipo === "LICENZA") {
    if (raw === "ATTIVA") return "DA_AVVISARE";
    if (raw === "OK") return "CONFERMATO";
  }
  const allowed = new Set([
    "DA_AVVISARE",
    "AVVISATO",
    "CONFERMATO",
    "DA_FATTURARE",
    "FATTURATO",
    "NON_RINNOVATO",
  ]);
  return allowed.has(raw) ? (raw as ScadenzaAgendaWorkflowStato) : null;
}

function normalizeDateFilter(value?: string | null) {
  const raw = normalizeString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function countRowsBySource(rows: Array<Pick<ScadenzaAgendaRow, "source">>) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = normalizeString(row.source) || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getOptionalColumnError(error: any, optionalColumns: string[]) {
  const message = String(error?.message || "").toLowerCase();
  if (!message) return null;
  return (
    optionalColumns.find((column) => {
      const normalized = column.toLowerCase();
      return (
        message.includes(normalized) ||
        message.includes(`column "${normalized}"`) ||
        message.includes(`'${normalized}'`)
      );
    }) || null
  );
}

async function selectWithOptionalColumns(
  supabase: any,
  table: string,
  requiredColumns: string[],
  optionalColumns: string[]
) {
  let enabledOptional = [...optionalColumns];

  while (true) {
    const selectColumns = [...requiredColumns, ...enabledOptional].join(", ");
    const res = await supabase.from(table).select(selectColumns);
    const missingColumn = getOptionalColumnError(res.error, enabledOptional);
    if (!res.error || !missingColumn) {
      const rows = ((res.data as any[]) || []).map((row) => {
        const normalized = { ...(row || {}) };
        for (const column of optionalColumns) {
          if (!(column in normalized)) normalized[column] = null;
        }
        return normalized;
      });
      return {
        data: res.error ? null : rows,
        error: res.error,
      };
    }
    enabledOptional = enabledOptional.filter((column) => column !== missingColumn);
  }
}

export async function buildScadenzeAgenda(
  supabase: any,
  filters: ScadenzeAgendaFilters = {}
): Promise<ScadenzaAgendaRow[]> {
  const [
    { data: checklists, error: checklistsErr },
    { data: rinnovi, error: rinnoviErr },
    { data: tagliandi, error: tagliandiErr },
    { data: licenses, error: licensesErr },
    { data: simCards, error: simCardsErr },
    { data: simRecharges, error: simRechargesErr },
    { data: contratti, error: contrattiErr },
  ] = await Promise.all([
    supabase
      .from("checklists")
      .select(
        "id, cliente, cliente_id, nome_checklist, noleggio_vendita, garanzia_scadenza, garanzia_stato, saas_piano, saas_scadenza, saas_note, saas_tipo"
      ),
    fetchRinnoviRows(supabase),
    selectWithOptionalColumns(
      supabase,
      "tagliandi",
      ["id", "cliente", "checklist_id", "scadenza", "stato", "note"],
      ["modalita"]
    ),
    selectWithOptionalColumns(
      supabase,
      "licenses",
      ["id", "checklist_id", "tipo", "scadenza", "note"],
      ["stato", "status", "ref_univoco", "telefono", "intestatario", "intestata_a", "gestore", "fornitore"]
    ),
    supabase
      .from("sim_cards")
      .select(
        "id, checklist_id, numero_telefono, intestatario, operatore, piano_attivo, device_installato, data_attivazione, data_scadenza, attiva"
      ),
    supabase.from("sim_recharges").select("id, sim_id, data_ricarica"),
    supabase
      .from("saas_contratti")
      .select("id, cliente, piano_codice, scadenza, interventi_annui, illimitati"),
  ]);

  const firstErr =
    checklistsErr ||
    rinnoviErr ||
    tagliandiErr ||
    licensesErr ||
    simCardsErr ||
    simRechargesErr ||
    contrattiErr;
  if (firstErr) throw firstErr;

  const checklistRows = (checklists || []) as ChecklistBaseRow[];
  const rinnoviRows = (rinnovi || []) as RinnovoServizioRow[];
  const tagliandiRows = (tagliandi || []) as TagliandoRow[];
  const licenseRows = (licenses || []) as LicenseRow[];
  const simCardRows = (simCards || []) as SimCardRow[];
  const simRechargeRows = (simRecharges || []) as SimRechargeRow[];
  const contrattiRows = (contratti || []) as ContrattoRow[];
  const noleggioChecklistIds = new Set(
    checklistRows
      .filter((row) => isNoleggioChecklist(row.noleggio_vendita))
      .map((row) => normalizeString(row.id))
      .filter(Boolean)
  );
  const maps = getChecklistMaps(checklistRows);

  const rinnoviMapped: ScadenzaAgendaRow[] = rinnoviRows
    .filter((r) => normalizeUpper(r.item_tipo) !== "LICENZA")
    .filter((r) => !noleggioChecklistIds.has(normalizeString(r.checklist_id)))
    .map((r) => {
      const ctx = getChecklistContext(maps, r.checklist_id, r.cliente);
      const normalizedTipo = normalizeTipo(r.item_tipo, r.subtipo);
      const source: ScadenzaAgendaSource =
        normalizedTipo.tipo === "SAAS" && normalizedTipo.sottotipo === "ULTRA"
          ? "saas_contratto"
          : "rinnovi";
      return {
        id: `rinnovi:${r.id}`,
        origine: "rinnovi_servizi",
        source,
        cliente: normalizeString(r.cliente) || ctx?.cliente || null,
        cliente_id: ctx?.cliente_id || null,
        checklist_id: r.checklist_id || null,
        progetto: ctx?.nome_checklist || null,
        tipo: normalizedTipo.tipo,
        sottotipo: normalizedTipo.sottotipo,
        riferimento: buildRinnovoReference(r),
        descrizione: r.descrizione || null,
        scadenza: r.scadenza || null,
        stato: r.stato || null,
        workflow_stato: getWorkflowStato(
          {
            source,
            item_tipo: normalizedTipo.sottotipo === "ULTRA" ? "SAAS_ULTRA" : r.item_tipo,
            stato: r.stato,
            checklist_id: r.checklist_id,
            scadenza: r.scadenza,
            cliente: r.cliente,
          },
          rinnoviRows
        ),
        fatturazione: r.proforma || null,
        note: r.note_tecniche || null,
        raw_id: r.id,
      };
    });

  const rinnoviGaranziaChecklistIds = new Set(
    rinnoviRows
      .filter((r) => normalizeUpper(r.item_tipo) === "GARANZIA")
      .map((r) => normalizeString(r.checklist_id))
      .filter(Boolean)
  );

  const garanzieMapped: ScadenzaAgendaRow[] = checklistRows
    .filter((c) => !isNoleggioChecklist(c.noleggio_vendita))
    .filter((c) => normalizeString(c.garanzia_scadenza))
    .filter((c) => !rinnoviGaranziaChecklistIds.has(normalizeString(c.id)))
    .map((c) => ({
      id: `garanzia:${c.id}`,
      origine: "checklists",
      source: "garanzie",
      cliente: c.cliente || null,
      cliente_id: c.cliente_id || null,
      checklist_id: c.id,
      progetto: c.nome_checklist || null,
      tipo: "GARANZIA",
      sottotipo: null,
      riferimento: "Garanzia impianto",
      descrizione: null,
      scadenza: c.garanzia_scadenza || null,
      stato: c.garanzia_stato || getExpiryStatus(c.garanzia_scadenza),
      workflow_stato: getWorkflowStato(
        {
          source: "garanzie",
          item_tipo: "GARANZIA",
          stato: c.garanzia_stato || getExpiryStatus(c.garanzia_scadenza),
          checklist_id: c.id,
          scadenza: c.garanzia_scadenza,
          cliente: c.cliente,
        },
        rinnoviRows
      ),
      fatturazione: null,
      note: null,
      raw_id: c.id,
    }));

  const saasMapped: ScadenzaAgendaRow[] = checklistRows
    .filter((c) => !isNoleggioChecklist(c.noleggio_vendita))
    .filter((c) => {
      const piano = normalizeUpper(c.saas_piano);
      return !!piano && !piano.startsWith("SAAS-UL");
    })
    .map((c) => ({
      id: `saas:${c.id}`,
      origine: "checklists",
      source: "saas",
      cliente: c.cliente || null,
      cliente_id: c.cliente_id || null,
      checklist_id: c.id,
      progetto: c.nome_checklist || null,
      tipo: "SAAS",
      sottotipo: normalizeString(c.saas_tipo) || null,
      riferimento: c.saas_piano || "SaaS",
      descrizione: c.saas_note || null,
      scadenza: c.saas_scadenza || null,
      stato: getExpiryStatus(c.saas_scadenza),
      workflow_stato: getWorkflowStato(
        {
          source: "saas",
          item_tipo: "SAAS",
          stato: getExpiryStatus(c.saas_scadenza),
          checklist_id: c.id,
          scadenza: c.saas_scadenza,
          cliente: c.cliente,
        },
        rinnoviRows
      ),
      fatturazione: null,
      note: c.saas_note || null,
      raw_id: c.id,
    }));

  const tagliandiMapped: ScadenzaAgendaRow[] = tagliandiRows
    .filter((t) => !noleggioChecklistIds.has(normalizeString(t.checklist_id)))
    .map((t) => {
      const ctx = getChecklistContext(maps, t.checklist_id, t.cliente);
      return {
        id: `tagliandi:${t.id}`,
        origine: "tagliandi",
        source: "tagliandi",
        cliente: normalizeString(t.cliente) || ctx?.cliente || null,
        cliente_id: ctx?.cliente_id || null,
        checklist_id: t.checklist_id || null,
        progetto: ctx?.nome_checklist || null,
        tipo: "TAGLIANDO",
        sottotipo: null,
        riferimento: t.note || "Tagliando annuale",
        descrizione: t.note || null,
        scadenza: t.scadenza || null,
        stato: t.stato || null,
        workflow_stato: getWorkflowStato(
          {
            source: "tagliandi",
            item_tipo: "TAGLIANDO",
            stato: t.stato,
            checklist_id: t.checklist_id,
            scadenza: t.scadenza,
            cliente: t.cliente,
          },
          rinnoviRows
        ),
        fatturazione: t.modalita || null,
        note: t.note || null,
        raw_id: t.id,
      };
    });

  const licenzeMapped: ScadenzaAgendaRow[] = licenseRows
    .filter((l) => !noleggioChecklistIds.has(normalizeString(l.checklist_id)))
    .filter((l) => !isSimLicenseType(l.tipo))
    .map((l) => {
      const ctx = getChecklistContext(maps, l.checklist_id, null);
      const stato = l.status || l.stato || (l.scadenza ? "DA_AVVISARE" : null);
      return {
        id: `licenses:${l.id}`,
        origine: "licenses",
        source: "licenze",
        cliente: ctx?.cliente || null,
        cliente_id: ctx?.cliente_id || null,
        checklist_id: l.checklist_id || null,
        progetto: ctx?.nome_checklist || null,
        tipo: "LICENZA",
        sottotipo: normalizeString(l.tipo) || null,
        riferimento: buildLicenseReference(l),
        descrizione: l.note || null,
        scadenza: l.scadenza || null,
        stato,
        workflow_stato: getWorkflowStato(
          {
            source: "licenze",
            item_tipo: "LICENZA",
            stato,
            checklist_id: l.checklist_id,
            scadenza: l.scadenza,
            cliente: ctx?.cliente,
          },
          rinnoviRows
        ),
        fatturazione: null,
        note: l.note || null,
        raw_id: l.id,
      };
    });

  const simRechargesBySimId = new Map<string, SimRechargeRow[]>();
  for (const recharge of simRechargeRows) {
    const simId = normalizeString(recharge.sim_id);
    if (!simId) continue;
    const bucket = simRechargesBySimId.get(simId) || [];
    bucket.push(recharge);
    simRechargesBySimId.set(simId, bucket);
  }

  const simMapped: ScadenzaAgendaRow[] = simCardRows.map((sim) => {
    const latestRecharge = getLatestSimRechargeRow(
      simRechargesBySimId.get(normalizeString(sim.id)) || []
    );
    const scadenza = getEffectiveSimScadenza(sim, latestRecharge);
    const ctx = getChecklistContext(maps, sim.checklist_id, null);
    const riferimento =
      normalizeString(sim.numero_telefono) ||
      normalizeString(sim.intestatario) ||
      normalizeString(sim.id) ||
      "SIM";
    const descrizione = [sim.operatore, sim.piano_attivo, sim.device_installato]
      .map((value) => normalizeString(value))
      .filter(Boolean)
      .join(" · ");
    const stato = sim.attiva === false ? "OFF" : getExpiryStatus(scadenza);
    return {
      id: `sim_cards:${sim.id}`,
      origine: "sim_cards",
      source: "sim",
      cliente: ctx?.cliente || null,
      cliente_id: ctx?.cliente_id || null,
      checklist_id: sim.checklist_id || null,
      sim_id: sim.id,
      progetto: ctx?.nome_checklist || null,
      tipo: "SIM",
      sottotipo: null,
      riferimento,
      descrizione: descrizione || null,
      scadenza,
      stato,
      workflow_stato: getWorkflowStato(
        {
          source: "sim",
          item_tipo: "SIM",
          sim_id: sim.id,
          stato,
          checklist_id: sim.checklist_id,
          scadenza,
          cliente: ctx?.cliente,
        },
        rinnoviRows
      ),
      fatturazione: null,
      note: null,
      raw_id: sim.id,
    };
  });

  const contrattiMapped: ScadenzaAgendaRow[] = contrattiRows.map((c) => {
    const normalizedTipo = normalizeTipo("SAAS_ULTRA", "ULTRA");
    return {
      id: `saas_contratti:${c.id}`,
      origine: "saas_contratti",
      source: "saas_contratto",
      cliente: c.cliente || null,
      cliente_id: getChecklistContext(maps, null, c.cliente)?.cliente_id || null,
      checklist_id: null,
      progetto: null,
      tipo: normalizedTipo.tipo,
      sottotipo: normalizedTipo.sottotipo,
      riferimento: c.piano_codice || "ULTRA",
      descrizione: "Contratto ULTRA cliente",
      scadenza: c.scadenza || null,
      stato: getExpiryStatus(c.scadenza),
      workflow_stato: getWorkflowStato(
        {
          source: "saas_contratto",
          item_tipo: "SAAS_ULTRA",
          stato: getExpiryStatus(c.scadenza),
          checklist_id: null,
          scadenza: c.scadenza,
          cliente: c.cliente,
        },
        rinnoviRows
      ),
      fatturazione: null,
      note: null,
      raw_id: c.id,
    };
  });

  const tipoFilter = normalizeUpper(filters.tipo);
  const tipoFilters = tipoFilter
    ? Array.from(
        new Set(
          tipoFilter
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        )
      )
    : [];
  const statoFilter = normalizeUpper(filters.stato || "TUTTI");
  const clienteFilter = normalizeString(filters.cliente).toLowerCase();
  const progettoFilter = normalizeString(filters.progetto).toLowerCase();
  const clienteIdFilter = normalizeString(filters.cliente_id);
  const checklistIdFilter = normalizeString(filters.checklist_id);
  const from = normalizeDateFilter(filters.from);
  const to = normalizeDateFilter(filters.to);

  let rows = [
    ...rinnoviMapped,
    ...tagliandiMapped,
    ...licenzeMapped,
    ...simMapped,
    ...saasMapped,
    ...contrattiMapped,
    ...garanzieMapped,
  ];

  console.info("[scadenze] query_counts", {
    filters,
    checklists: checklistRows.length,
    rinnovi_servizi: rinnoviRows.length,
    tagliandi: tagliandiRows.length,
    licenses: licenseRows.length,
    garanzie_candidate: checklistRows.filter((c) => !isNoleggioChecklist(c.noleggio_vendita)).filter((c) => normalizeString(c.garanzia_scadenza)).length,
  });
  console.info("[scadenze] mapped_counts_before_filters", {
    totale: rows.length,
    by_source: countRowsBySource(rows),
  });

  if (from) {
    const fromDate = parseLocalDay(from);
    if (fromDate) {
      const before = rows;
      rows = rows.filter((row) => {
        const dt = parseLocalDay(row.scadenza);
        return dt != null && dt >= fromDate;
      });
      console.info("[scadenze] after_from_filter", {
        from,
        before: before.length,
        after: rows.length,
        by_source_before: countRowsBySource(before),
        by_source_after: countRowsBySource(rows),
      });
    }
  }
  if (to) {
    const toDate = parseLocalDay(to);
    if (toDate) {
      const before = rows;
      rows = rows.filter((row) => {
        const dt = parseLocalDay(row.scadenza);
        return dt != null && dt <= toDate;
      });
      console.info("[scadenze] after_to_filter", {
        to,
        before: before.length,
        after: rows.length,
        by_source_before: countRowsBySource(before),
        by_source_after: countRowsBySource(rows),
      });
    }
  }
  if (clienteFilter) {
    rows = rows.filter((row) => normalizeString(row.cliente).toLowerCase().includes(clienteFilter));
  }
  if (clienteIdFilter) {
    rows = rows.filter((row) => normalizeString(row.cliente_id) === clienteIdFilter);
  }
  if (checklistIdFilter) {
    rows = rows.filter((row) => normalizeString(row.checklist_id) === checklistIdFilter);
  }
  if (progettoFilter) {
    rows = rows.filter((row) => normalizeString(row.progetto).toLowerCase().includes(progettoFilter));
  }
  if (tipoFilters.length > 0) {
    rows = rows.filter((row) => tipoFilters.includes(normalizeUpper(row.tipo)));
  }
  if (statoFilter === "DA_AVVISARE") {
    rows = rows.filter((row) => row.workflow_stato === "DA_AVVISARE");
  } else if (statoFilter === "SCADUTO") {
    const today = startOfToday();
    rows = rows.filter((row) => {
      const dt = parseLocalDay(row.scadenza);
      return dt != null && dt < today;
    });
  }

  console.info("[scadenze] final_counts", {
    filters: {
      from,
      to,
      cliente: clienteFilter || null,
      cliente_id: clienteIdFilter || null,
      checklist_id: checklistIdFilter || null,
      progetto: progettoFilter || null,
      tipo: tipoFilters,
      stato: statoFilter,
    },
    totale: rows.length,
    by_source: countRowsBySource(rows),
  });

  return rows.sort((a, b) => {
    const scadenzaCmp = normalizeString(a.scadenza).localeCompare(normalizeString(b.scadenza));
    if (scadenzaCmp !== 0) return scadenzaCmp;
    const clienteCmp = normalizeString(a.cliente).localeCompare(normalizeString(b.cliente));
    if (clienteCmp !== 0) return clienteCmp;
    return normalizeString(a.progetto).localeCompare(normalizeString(b.progetto));
  });
}
