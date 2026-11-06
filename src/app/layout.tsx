import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taller 3D — Gestión para makers de impresión 3D",
  description:
    "Pedidos, dinero, costos y filamento de tu taller de impresión 3D en un solo lugar.",
};

// themeColor coincide con --color-surface (claro/oscuro) para teñir la barra del
// navegador en móviles según el tema activo.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffdfd" },
    { media: "(prefers-color-scheme: dark)", color: "#21171c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-theme="light"
      suppressHydrationWarning
      className={`${fraunces.variable} ${hanken.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
