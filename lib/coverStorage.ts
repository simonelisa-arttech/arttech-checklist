"use client";

import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const COVER_BUCKET = "impianti-cover";

function missingConfigError(message: string) {
  return { message };
}

async function ensureSupabaseSession() {
  if (!isSupabaseConfigured) {
    return { error: missingConfigError("Supabase non configurato") };
  }
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) return { error: { message: error.message } };
  if (!session?.access_token) {
    return { error: missingConfigError("Sessione Supabase non disponibile") };
  }
  return { error: null };
}

export function getImpiantoCoverPublicUrl(path: string) {
  if (!isSupabaseConfigured) return null;
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return null;
  const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(normalizedPath);
  return String(data?.publicUrl || "").trim() || null;
}

export async function uploadImpiantoCover(path: string, file: File) {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) {
    return { error: { message: "Path cover mancante" } };
  }
  const auth = await ensureSupabaseSession();
  if (auth.error) return auth;

  const { error } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(normalizedPath, file, { upsert: true, contentType: file.type || undefined });
  return { error: error ? { message: error.message } : null };
}

export async function removeImpiantoCover(path: string) {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) {
    return { error: { message: "Path cover mancante" } };
  }
  const auth = await ensureSupabaseSession();
  if (auth.error) return auth;

  const { error } = await supabase.storage.from(COVER_BUCKET).remove([normalizedPath]);
  return { error: error ? { message: error.message } : null };
}
