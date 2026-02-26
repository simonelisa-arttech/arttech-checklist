"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function parseHashParams(hashValue: string) {
  const raw = String(hashValue || "").replace(/^#/, "").trim();
  if (!raw) return new URLSearchParams();
  return new URLSearchParams(raw);
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const tokenHash = useMemo(
    () => searchParams.get("token_hash"),
    [searchParams]
  );
  const type = useMemo(() => searchParams.get("type"), [searchParams]);
  const code = useMemo(() => searchParams.get("code"), [searchParams]);
  const redirect = useMemo(
    () => searchParams.get("redirect") || "/reset-password",
    [searchParams]
  );
  const buildStamp = "AUTH BUILD PROD DOMAIN";
  const [hashDebug, setHashDebug] = useState<{
    token_hash: string | null;
    type: string | null;
    code: string | null;
    access_token: string | null;
    refresh_token: string | null;
    error_description: string | null;
  }>({
    token_hash: null,
    type: null,
    code: null,
    access_token: null,
    refresh_token: null,
    error_description: null,
  });
  const queryDebug = useMemo(
    () => ({
      token_hash: searchParams.get("token_hash"),
      type: searchParams.get("type"),
      code: searchParams.get("code"),
      redirect: searchParams.get("redirect"),
    }),
    [searchParams]
  );

  useEffect(() => {
    let active = true;

    const run = async () => {
      setError(null);
      setLoading(true);

      const hashParams = parseHashParams(
        typeof window !== "undefined" ? window.location.hash : ""
      );
      const tokenHashFinal = tokenHash || hashParams.get("token_hash");
      const typeFinal = type || hashParams.get("type");
      const codeFinal = code || hashParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const errorDescription = hashParams.get("error_description");

      if (active) {
        setHashDebug({
          token_hash: tokenHashFinal,
          type: typeFinal,
          code: codeFinal,
          access_token: accessToken,
          refresh_token: refreshToken,
          error_description: errorDescription,
        });
      }

      if (errorDescription) {
        if (active) {
          setError(errorDescription);
          setLoading(false);
        }
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          if (active) {
            setError(error.message);
            setLoading(false);
          }
          return;
        }
        router.replace("/reset-password");
        return;
      }

      if (typeFinal === "recovery" && tokenHashFinal) {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHashFinal,
        });
        if (error) {
          if (active) {
            setError(error.message);
            setLoading(false);
          }
          return;
        }
        router.replace("/reset-password");
        return;
      }

      if (tokenHashFinal) {
        if (typeFinal && typeFinal !== "recovery") {
          if (active) {
            setError("Tipo callback non supportato.");
            setLoading(false);
          }
          return;
        }
        // Fallback: se type non arriva ma c'e token_hash, prova comunque recovery.
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHashFinal,
        });
        if (error) {
          if (active) {
            setError(error.message);
            setLoading(false);
          }
          return;
        }
        router.replace("/reset-password");
        return;
      }

      if (codeFinal) {
        const { error } = await supabase.auth.exchangeCodeForSession(codeFinal);
        if (error) {
          if (active) {
            setError(error.message);
            setLoading(false);
          }
          return;
        }
        router.replace(redirect);
        return;
      }

      if (active) {
        setError("Callback non valido: mancano token_hash, code e session hash.");
        setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [code, redirect, router, tokenHash, type]);

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Verifica recupero password</h1>
      {loading && (
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Verifica in corso, attendi...
        </div>
      )}
      {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}
      <div style={{ marginTop: 12, fontSize: 11, opacity: 0.6 }}>
        Build: {buildStamp}
      </div>
      <pre
        style={{
          marginTop: 10,
          fontSize: 11,
          background: "#f4f4f5",
          border: "1px solid #e4e4e7",
          borderRadius: 8,
          padding: 10,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {JSON.stringify(
          {
            query: queryDebug,
            hash: hashDebug,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 420, margin: "80px auto", padding: 16 }}>
          <h1 style={{ marginBottom: 8 }}>Verifica recupero password</h1>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Caricamento callback...</div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
