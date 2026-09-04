import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentinel IVMAP — Integrated Video Management & Analytics Platform",
  description:
    "Hybrid Model 1 + Model 3 platform: centralised CCTV registry with GIS mapping, federated VMS integration, ANPR analytics, watchlist correlation and real-time alerting for Gujarat's 26 government departments.",
};

export const viewport: Viewport = {
  themeColor: "#070a10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
