"use client";

async function parseResponseSafe(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  let json: any = null;
  if (text && contentType.toLowerCase().includes("application/json")) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { json, text, contentType };
}

function buildReadableError(
  fallback: string,
  response: { status: number; statusText: string },
  parsed: { json: any; text: string; contentType: string }
) {
  const jsonError = String(parsed.json?.error || "").trim();
  if (jsonError) return jsonError;

  const textError = String(parsed.text || "").trim();
  if (textError) {
    const compact = textError.replace(/\s+/g, " ").trim();
    return `${fallback} (${response.status} ${response.statusText}): ${compact.slice(0, 240)}`;
  }

  return `${fallback} (${response.status} ${response.statusText})`;
}

const COVER_BUCKET = "impianti-cover";

function buildPublicBaseUrl() {
  const baseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl) return null;
  return `${baseUrl}/storage/v1/object/public/${COVER_BUCKET}`;
}

function encodeStoragePath(path: string) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function getImpiantoCoverPublicUrl(path: string) {
  const normalizedPath = String(path || "").trim();
  const baseUrl = buildPublicBaseUrl();
  if (!normalizedPath || !baseUrl) return null;
  return `${baseUrl}/${encodeStoragePath(normalizedPath)}`;
}

export async function uploadImpiantoCover(impiantoId: string, file: File) {
  const normalizedImpiantoId = String(impiantoId || "").trim();
  if (!normalizedImpiantoId) {
    return { data: null, error: { message: "Impianto cover mancante" } };
  }

  const form = new FormData();
  form.set("impianto_id", normalizedImpiantoId);
  form.set("file", file);

  const res = await fetch("/api/storage/impianti-cover", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const parsed = await parseResponseSafe(res);
  const json = parsed.json || {};

  if (!res.ok || json?.ok === false) {
    return {
      data: null,
      error: {
        message: buildReadableError(
          "Upload cover error",
          { status: res.status, statusText: res.statusText },
          parsed
        ),
      },
    };
  }

  return { data: json?.data || null, error: null };
}

export async function removeImpiantoCover(path: string) {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) {
    return { error: { message: "Path cover mancante" } };
  }

  const res = await fetch("/api/storage/impianti-cover", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ path: normalizedPath }),
  });
  const parsed = await parseResponseSafe(res);
  const json = parsed.json || {};

  if (!res.ok || json?.ok === false) {
    return {
      error: {
        message: buildReadableError(
          "Remove cover error",
          { status: res.status, statusText: res.statusText },
          parsed
        ),
      },
    };
  }

  return { error: null };
}
