import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import AppShellHeader from "@/components/AppShellHeader";

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
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <AppShellHeader />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
