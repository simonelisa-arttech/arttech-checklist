export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOperatore } from "@/lib/adminAuth";

const COVER_BUCKET = "impianti-cover";

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

function sanitizeExtension(file: File) {
  const fileName = String(file.name || "").trim();
  const fromName = fileName.includes(".") ? fileName.split(".").pop() || "" : "";
  const safeFromName = fromName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (safeFromName) return safeFromName;

  const mime = String(file.type || "").trim().toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/avif") return "avif";
  return "bin";
}

function buildPublicUrl(path: string) {
  const baseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl) return null;
  const encodedPath = String(path || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  if (!encodedPath) return null;
  return `${baseUrl}/storage/v1/object/public/${COVER_BUCKET}/${encodedPath}`;
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

    const impiantoId = String(form.get("impianto_id") || "").trim();
    const file = form.get("file");
    if (!impiantoId) {
      return NextResponse.json({ ok: false, error: "impianto_id mancante" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "file mancante" }, { status: 400 });
    }
    if (!String(file.type || "").toLowerCase().startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Sono ammesse solo immagini" }, { status: 400 });
    }

    const ext = sanitizeExtension(file);
    const path = `${impiantoId}/${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const { error } = await supabaseAdmin.storage
      .from(COVER_BUCKET)
      .upload(path, Buffer.from(bytes), { upsert: true, contentType: file.type || undefined });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        path,
        publicUrl: buildPublicUrl(path),
      },
    });
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
    const path = String(body?.path || body?.storage_path || "").trim();
    if (!path) {
      return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.storage.from(COVER_BUCKET).remove([path]);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, path });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Storage remove error") },
      { status: 500 }
    );
  }
}
