"use client";

import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        router.replace("/login");
      }}
      style={{
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
