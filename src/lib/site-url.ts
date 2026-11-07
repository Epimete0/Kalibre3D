/**
 * Dirección pública del sitio resuelta exclusivamente desde variables controladas por el servidor.
 * Nunca lee encabezados HTTP del cliente (`Origin` / `Host`) para evitar envenenamiento de enlaces.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const vercelProdHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProdHost) {
    const withProtocol = /^https?:\/\//i.test(vercelProdHost) ? vercelProdHost : `https://${vercelProdHost}`;
    return withProtocol.replace(/\/+$/, "");
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    const withProtocol = /^https?:\/\//i.test(vercelHost) ? vercelHost : `https://${vercelHost}`;
    return withProtocol.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta NEXT_PUBLIC_SITE_URL para configurar la autenticación");
  }

  return "http://localhost:3000";
}
