import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import ConfigMancante from "@/components/ConfigMancante";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
