"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

      if (!tokenHash && !code) {
        if (active) {
          setError("Callback non valido: mancano token_hash e code.");
          setLoading(false);
        }
        return;
      }

      if (type === "recovery" && tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
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

      if (tokenHash) {
        if (type && type !== "recovery") {
          if (active) {
            setError("Tipo callback non supportato.");
            setLoading(false);
          }
          return;
        }
        // Fallback: se type non arriva ma c'e token_hash, prova comunque recovery.
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
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

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (active) {
            setError(error.message);
            setLoading(false);
          }
          return;
        }
        router.replace(redirect);
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
        {JSON.stringify(queryDebug, null, 2)}
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
