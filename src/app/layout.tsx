import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { ThemeBootstrap } from "@/components/ThemeBootstrap";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap" });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], display: "swap" });

const title = "Taller 3D — Gestión para makers de impresión 3D";
const description = "Pedidos, dinero, costos y filamento de tu taller de impresión 3D en un solo lugar.";

/** Se calcula por solicitud: la dirección base sale del entorno en uso y no de lo que había al compilar. */
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    openGraph: { title, description, locale: "es_CL", type: "website", siteName: "Taller 3D" },
  };
}

// themeColor coincide con --color-surface (claro/oscuro) para teñir la barra del navegador en móviles.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffdfd" },
    { media: "(prefers-color-scheme: dark)", color: "#21171c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning className={`${fraunces.variable} ${hanken.variable} h-full`}>
      <body className="min-h-full">
        <ThemeBootstrap />
        {children}
      </body>
    </html>
  );
}
