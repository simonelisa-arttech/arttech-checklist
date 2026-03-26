export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

async function requireStorageAuth(request: Request) {
  const auth = await requireOperatore(request);
  if (auth.ok) return auth;

  const status = auth.response.status || 401;
  const payload = await auth.response.json().catch(() => ({} as any));
  return {
    ok: false as const,
    response: NextResponse.json(
      { ok: false, error: String(payload?.error || "Unauthorized") },
      { status }
    ),
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireStorageAuth(request);
    if (!auth.ok) return auth.response;
    const supabaseAdmin = auth.adminClient;
    const { searchParams } = new URL(request.url);
    const path = String(searchParams.get("path") || "").trim();
    if (!path) {
      return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from("checklist-documents")
      .createSignedUrl(path, 60);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Storage signed URL error") },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireStorageAuth(request);
    if (!auth.ok) return auth.response;
    const supabaseAdmin = auth.adminClient;
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ ok: false, error: "Invalid multipart form data" }, { status: 400 });
    }

    const path = String(form.get("path") || "").trim();
    const file = form.get("file");
    if (!path || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing path/file" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const { error } = await supabaseAdmin.storage
      .from("checklist-documents")
      .upload(path, Buffer.from(bytes), { upsert: true, contentType: file.type || undefined });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, path });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Storage upload error") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireStorageAuth(request);
    if (!auth.ok) return auth.response;
    const supabaseAdmin = auth.adminClient;
    const body = await request.json().catch(() => ({} as any));
    const path = String(body?.path || "").trim();
    if (!path) {
      return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.storage.from("checklist-documents").remove([path]);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, path });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Storage remove error") },
      { status: 500 }
    );
  }
}
