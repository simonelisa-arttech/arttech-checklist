import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import AuthHeaderActions from "@/components/AuthHeaderActions";


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
    <html lang="en">
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
            gap: 12,
          }}
        >
          <img
            src="/at-logo.png"
            alt="AT SYSTEM"
            style={{ height: 48, width: "auto", objectFit: "contain" }}
          />
          <AuthHeaderActions />
        </header>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
