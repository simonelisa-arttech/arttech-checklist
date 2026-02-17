import { isSupabaseConfigured } from "@/lib/supabaseClient";
import ConfigMancante from "@/components/ConfigMancante";
import LoginForm from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { redirect?: string };
}) {
  if (!isSupabaseConfigured) {
    return <ConfigMancante />;
  }

  const redirectTo = searchParams?.redirect || "/";
  return <LoginForm redirectTo={redirectTo} />;
}
