import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import LogoutButton from "@/components/LogoutButton";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AT SYSTEM",
  description: "AT SYSTEM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header
          style={{
            maxWidth: 1100,
            margin: "16px auto 0",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center" }}>
              <img
                src="/at-logo.png"
                alt="AT SYSTEM"
                style={{ height: 48, width: "auto", objectFit: "contain" }}
              />
            </Link>
            <nav
              aria-label="Navigazione principale"
              style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
            >
              <Link
                href="/"
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  textDecoration: "none",
                  color: "inherit",
                  background: "white",
                }}
              >
                Home
              </Link>
              <Link
                href="/dashboard"
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  textDecoration: "none",
                  color: "inherit",
                  background: "white",
                }}
              >
                Dashboard
              </Link>
              <Link
                href="/cronoprogramma"
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  textDecoration: "none",
                  color: "inherit",
                  background: "white",
                }}
              >
                Cronoprogramma
              </Link>
            </nav>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <LogoutButton />
          </div>
        </header>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
