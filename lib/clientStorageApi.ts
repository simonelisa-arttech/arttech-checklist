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

export async function storageUpload(path: string, file: File) {
  const form = new FormData();
  form.set("path", path);
  form.set("file", file);

  const res = await fetch("/api/storage/checklist-documents", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const parsed = await parseResponseSafe(res);
  const json = parsed.json || {};

  if (!res.ok || json?.ok === false) {
    return {
      error: {
        message: buildReadableError(
          "Upload error",
          { status: res.status, statusText: res.statusText },
          parsed
        ),
      },
    };
  }

  return { error: null };
}

export async function storageSignedUrl(path: string) {
  const res = await fetch(
    `/api/storage/checklist-documents?path=${encodeURIComponent(path)}`,
    {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    }
  );
  const parsed = await parseResponseSafe(res);
  const json = parsed.json || {};
  if (!res.ok || json?.ok === false) {
    return {
      data: null,
      error: {
        message: buildReadableError(
          "Signed URL error",
          { status: res.status, statusText: res.statusText },
          parsed
        ),
      },
    };
  }
  return { data: json?.data || null, error: null };
}

export async function storageRemove(path: string) {
  const res = await fetch("/api/storage/checklist-documents", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ path }),
  });
  const parsed = await parseResponseSafe(res);
  const json = parsed.json || {};
  if (!res.ok || json?.ok === false) {
    return {
      error: {
        message: buildReadableError("Remove error", { status: res.status, statusText: res.statusText }, parsed),
      },
    };
  }
  return { error: null };
}
