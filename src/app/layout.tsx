import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ThemeBootstrap } from "@/components/ThemeBootstrap";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ variable: "--font-display-face", subsets: ["latin"], display: "swap" });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"], display: "swap" });

const title = "Kalibre — Gestión para makers y talleres de impresión 3D";
const description = "Pedidos, cotizador multicolor, neto de Mercado Libre, bobinas y ganancia real de tu taller de impresión 3D.";

/** Se calcula por solicitud: la dirección base sale del entorno en uso y no de lo que había al compilar. */
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    openGraph: { title, description, locale: "es_CL", type: "website", siteName: "Kalibre" },
  };
}

// themeColor coincide con --color-surface (claro/oscuro) para teñir la barra del navegador en móviles.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning className={`${spaceGrotesk.variable} ${hanken.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full">
        <ThemeBootstrap />
        {children}
      </body>
    </html>
  );
}
