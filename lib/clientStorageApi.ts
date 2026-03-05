"use client";

async function parseJsonSafe(res: Response) {
  return res.json().catch(() => ({} as any));
}

export async function storageUpload(path: string, file: File) {
  const form = new FormData();
  form.append("path", path);
  form.append("file", file);
  const res = await fetch("/api/storage/checklist-documents", {
    method: "POST",
    body: form,
    credentials: "include",
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || json?.ok === false) {
    return { error: { message: String(json?.error || "Upload error") } };
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
  const json = await parseJsonSafe(res);
  if (!res.ok || json?.ok === false) {
    return { data: null, error: { message: String(json?.error || "Signed URL error") } };
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
  const json = await parseJsonSafe(res);
  if (!res.ok || json?.ok === false) {
    return { error: { message: String(json?.error || "Remove error") } };
  }
  return { error: null };
}
