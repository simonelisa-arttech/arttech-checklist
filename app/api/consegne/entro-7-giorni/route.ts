import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";
import { getEffectiveProjectStatus } from "@/lib/projectStatus";

export const runtime = "nodejs";

type ChecklistRow = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  data_prevista: string | null;
  data_tassativa: string | null;
  stato_progetto: string | null;
};

function toIsoDay(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function getConsegnaDate(row: ChecklistRow) {
  return toIsoDay(row.data_tassativa) || toIsoDay(row.data_prevista);
}

function isExcludedStatus(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
  return normalized === "CONSEGNATO" || normalized === "CHIUSO" || normalized === "ANNULLATO";
}

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const overdueOnly = url.searchParams.get("overdue") === "1";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  const inSevenDaysIso = inSevenDays.toISOString().slice(0, 10);

  const { data, error } = await auth.adminClient
    .from("checklists")
    .select("id, cliente, nome_checklist, data_prevista, data_tassativa, stato_progetto")
    .order("data_tassativa", { ascending: true, nullsFirst: false })
    .order("data_prevista", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data || []) as ChecklistRow[])
    .map((row) => {
      const dataConsegna = getConsegnaDate(row);
      return {
        id: row.id,
        cliente: row.cliente || "—",
        nome_checklist: row.nome_checklist || "—",
        data_consegna: dataConsegna,
        stato_progetto: getEffectiveProjectStatus({ stato_progetto: row.stato_progetto }) || null,
      };
    })
    .filter((row) => !isExcludedStatus(row.stato_progetto))
    .filter((row) =>
      overdueOnly
        ? !!row.data_consegna && row.data_consegna < todayIso
        : !!row.data_consegna && row.data_consegna >= todayIso && row.data_consegna <= inSevenDaysIso
    )
    .sort((a, b) => {
      const byDate = String(a.data_consegna).localeCompare(String(b.data_consegna));
      if (byDate !== 0) return byDate;
      return `${a.cliente} ${a.nome_checklist}`.localeCompare(`${b.cliente} ${b.nome_checklist}`);
    });

  return NextResponse.json(rows);
}
