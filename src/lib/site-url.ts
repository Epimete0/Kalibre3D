/** Dirección pública del sitio (la misma `NEXT_PUBLIC_SITE_URL` que usa la autenticación). En desarrollo cae en localhost. */
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}
