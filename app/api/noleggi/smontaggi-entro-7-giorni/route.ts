import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

export const runtime = "nodejs";

type ChecklistRowRaw = {
  id: string;
  cliente: string | null;
  nome_checklist: string | null;
  stato_progetto: string | null;
  noleggio_vendita: string | null;
  data_disinstallazione?: string | null;
};

function toIsoDay(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = await requireOperatore(request);
  if (!auth.ok) return auth.response;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  const inSevenDaysIso = inSevenDays.toISOString().slice(0, 10);

  let res: any = await auth.adminClient
    .from("checklists")
    .select("id, cliente, nome_checklist, stato_progetto, noleggio_vendita, data_disinstallazione")
    .eq("noleggio_vendita", "NOLEGGIO")
    .order("data_disinstallazione", { ascending: true, nullsFirst: false });

  let missingDataDisinstallazione = false;
  if (res.error && String(res.error.message || "").toLowerCase().includes("data_disinstallazione")) {
    missingDataDisinstallazione = true;
    res = await auth.adminClient
      .from("checklists")
      .select("id, cliente, nome_checklist, stato_progetto, noleggio_vendita")
      .eq("noleggio_vendita", "NOLEGGIO");
  }

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const rows = (Array.isArray(res.data) ? res.data : [])
    .map((row: any) => {
      const raw = row as ChecklistRowRaw;
      return {
        id: raw.id,
        cliente: raw.cliente || "—",
        nome_checklist: raw.nome_checklist || "—",
        stato_progetto: raw.stato_progetto || null,
        noleggio_vendita: raw.noleggio_vendita || null,
        data_disinstallazione: missingDataDisinstallazione ? null : toIsoDay(raw.data_disinstallazione ?? null),
      };
    })
    .filter((row) => row.data_disinstallazione && row.data_disinstallazione >= todayIso && row.data_disinstallazione <= inSevenDaysIso)
    .sort((a, b) => {
      const byDate = String(a.data_disinstallazione).localeCompare(String(b.data_disinstallazione));
      if (byDate !== 0) return byDate;
      return `${a.cliente} ${a.nome_checklist}`.localeCompare(`${b.cliente} ${b.nome_checklist}`);
    });

  return NextResponse.json(rows);
}
