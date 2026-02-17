"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export default function AuthHeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) return null;
  if (pathname === "/login") return null;
  if (!hasSession) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        router.replace("/login");
      }}
      style={{
        marginLeft: "auto",
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #ddd",
        background: "white",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  );
}
