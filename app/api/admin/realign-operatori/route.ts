export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

type OperatoreRow = {
  id: string;
  email: string | null;
  user_id: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const adminClient = auth.adminClient;
  const { data: operatori, error: opErr } = await adminClient
    .from("operatori")
    .select("id, email, user_id");

  if (opErr) {
    return NextResponse.json({ error: opErr.message }, { status: 500 });
  }

  const usersByEmail = new Map<string, string>();
  const usersById = new Set<string>();
  let page = 1;
  const perPage = 500;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage } as any);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const users = data?.users || [];
    for (const user of users) {
      const email = normalizeEmail((user as any)?.email);
      if (email && !usersByEmail.has(email)) {
        usersByEmail.set(email, (user as any).id);
      }
      if ((user as any)?.id) {
        usersById.add((user as any).id);
      }
    }
    if (users.length < perPage) break;
    page += 1;
  }

  const rows = (operatori || []) as OperatoreRow[];
  let scanned = 0;
  let updated = 0;
  let alreadyAligned = 0;
  let missingEmail = 0;
  let missingAuthUser = 0;
  let invalidUserId = 0;
  const updateErrors: { id: string; message: string }[] = [];

  for (const op of rows) {
    scanned += 1;
    const email = normalizeEmail(op.email);
    if (!email) {
      missingEmail += 1;
      continue;
    }
    const authUserId = usersByEmail.get(email) || null;
    if (!authUserId) {
      missingAuthUser += 1;
      continue;
    }

    const hasValidCurrentUserId = !!op.user_id && usersById.has(op.user_id);
    if (op.user_id && !hasValidCurrentUserId) {
      invalidUserId += 1;
    }

    if (op.user_id === authUserId) {
      alreadyAligned += 1;
      continue;
    }

    const { error: updErr } = await adminClient
      .from("operatori")
      .update({ user_id: authUserId })
      .eq("id", op.id);

    if (updErr) {
      updateErrors.push({ id: op.id, message: updErr.message });
      continue;
    }
    updated += 1;
  }

  return NextResponse.json({
    ok: true,
    scanned,
    updated,
    already_aligned: alreadyAligned,
    missing_email: missingEmail,
    missing_auth_user: missingAuthUser,
    invalid_user_id: invalidUserId,
    update_errors: updateErrors,
  });
}
