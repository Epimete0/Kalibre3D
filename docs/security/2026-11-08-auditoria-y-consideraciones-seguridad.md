# Auditoría de Seguridad y Guía de Continuidad — Kalibre (`saas3d`)

**Fecha:** 2026-11-08  
**Estado:** Aprobado por el usuario para remediación inmediata (`VULN-001` a `DEF-001`).  
**Propósito:** Documento de referencia y traspaso para que cualquier agente o desarrollador pueda verificar, continuar o auditar el estado de seguridad de **Kalibre (`saas3d`)** sin perder contexto.

---

## 1. Arquitectura de Seguridad y Fronteras Innegociables

1. **Aislamiento Multi-Taller (`centerId`) en Servidor:**
   - Toda consulta y mutación Prisma debe filtrar explícitamente por `centerId` resuelto en el servidor a partir de la membresía activa (`CenterMember.active = true` y `Center.active = true`).
   - La conexión de Prisma usa credenciales de servidor con privilegios propios; **RLS en PostgreSQL es defensa en profundidad y no reemplaza el filtro `where: { centerId }` en Prisma**.
2. **Frontera Server Actions → Servicios (`src/lib/*-service.ts`):**
   - Ninguna Server Action (`src/app/**/actions.ts`) puede importar `@/lib/prisma` ni `@/generated/prisma`.
   - Toda función exportada de los 10 servicios del núcleo (`account`, `center`, `center-settings`, `customer`, `invitation-admin`, `member`, `money`, `order`, `product`, `spool`) debe abrir obligatoriamente con `requireAuthContext()`, `requireCatalogContext()`, `requireOperationalContext()` o `requireSessionUser()`.
   - Verificado automáticamente por [`src/lib/auth-boundaries.test.ts`](../../src/lib/auth-boundaries.test.ts).
3. **Matriz de Roles (`OWNER`, `ADMIN`, `PROFESSIONAL`, `VIEWER`):**
   - `OWNER` y `ADMIN`: control total de catálogo, bobinas, cotizador, ajustes, equipo y módulo de Dinero (`/money` y resumen mensual en `/dashboard`).
   - `PROFESSIONAL` (Ayudante): opera pedidos, clientes, cotizador y movimientos de stock/bobinas (`requireOperationalContext`); **no** tiene acceso a `/money`, al resumen financiero mensual ni a `CenterSettings`.
   - `VIEWER`: solo lectura operativa; no ve costos, márgenes ni finanzas.
4. **PostgreSQL, RLS, Triggers y Concurrencia (`prisma/migrations-postgres/`):**
   - Las 11 tablas de `public` tienen `ENABLE ROW LEVEL SECURITY`.
   - Las tablas operativas (`Product`, `ProductMovement`, `Spool`, `SpoolMovement`, `Customer`, `Order`, `OrderItem`, `OrderEvent`, `MoneyTransaction`, `CenterSettings`, `InvitationCode`) son `SERVER_ONLY`: tienen `REVOKE ALL ON TABLE ... FROM PUBLIC, anon, authenticated`.
   - Las funciones `SECURITY DEFINER` en `app_private` (`is_active_member`, `has_center_role`) fijan `search_path = pg_catalog, public, app_private` y revocan ejecución a `PUBLIC` y `anon`.
   - Los movimientos de dinero (`MoneyTransaction`), eventos de pedido (`OrderEvent`), movimientos de stock (`ProductMovement`) y movimientos de filamento (`SpoolMovement`) son inmutables por trigger en PostgreSQL y usan bloqueo pesimista `SELECT ... FOR UPDATE` e idempotencia por `UNIQUE (centerId, operationId)`.
5. **Sanitización de Errores y Secretos:**
   - Toda Server Action devuelve errores a través de `safeActionError` / `actionFailure`: solo los `DomainError` controlados exponen su mensaje al usuario; cualquier error de Prisma, SQL o red devuelve un mensaje genérico en español.
   - Prohibido usar `SUPABASE_SECRET_KEY` o `SERVICE_ROLE_KEY` en el código de la aplicación (`src/`).

---

## 2. Hallazgos de la Auditoría (2026-11-08) y Plan de Remediación

### [VULN-001] Envenenamiento de `Origin` en enlaces de autenticación y fallback de `siteUrl()` (**High**)
- **Archivos afectados:**
  - `src/lib/site-url.ts`
  - `src/app/login/actions.ts`
- **Causa raíz:**
  - `authRedirect()` en `src/app/login/actions.ts` usaba `process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin")`. Si `NEXT_PUBLIC_SITE_URL` no está definida en producción (en Vercel existen `VERCEL_PROJECT_PRODUCTION_URL` y `VERCEL_URL`), confiaba en el encabezado HTTP `Origin` enviado por el cliente para armar `emailRedirectTo` en registro y recuperación de contraseña.
  - Por su parte, `siteUrl()` en `src/lib/site-url.ts` caía directamente en `"http://localhost:3000"`, rompiendo el enlace de confirmación de cambio de correo en producción cuando `NEXT_PUBLIC_SITE_URL` no estaba definida.
- **Remediación:**
  - En `src/lib/site-url.ts`: resolver la URL base exclusivamente desde variables de entorno del servidor en este orden:
    1. `process.env.NEXT_PUBLIC_SITE_URL`
    2. `process.env.VERCEL_PROJECT_PRODUCTION_URL` (`https://${...}`)
    3. `process.env.VERCEL_URL` (`https://${...}`)
    4. `"http://localhost:3000"` únicamente cuando `process.env.NODE_ENV !== "production"`. En producción, si ninguna variable está disponible, lanzar error controlado.
  - En `src/app/login/actions.ts`: usar `siteUrl()` dentro de `authRedirect(path)` y eliminar la lectura de `(await headers()).get("origin")`.

### [VULN-002] Soporte de `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `src/proxy.ts` y `src/lib/auth-settings.ts` (**Medium**)
- **Archivos afectados:**
  - `src/proxy.ts`
  - `src/lib/auth-settings.ts`
- **Causa raíz:**
  - La integración de Supabase en Vercel inyecta `NEXT_PUBLIC_SUPABASE_ANON_KEY` en lugar de `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  - `src/proxy.ts` y `src/lib/auth-settings.ts` solo leían `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, provocando que el middleware de Next.js omitiera la verificación/refresco de sesión en el borde y que `readAuthAutoconfirm()` devolviera siempre `null`.
- **Remediación:**
  - Leer `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` tanto en `src/proxy.ts` como en `src/lib/auth-settings.ts`.

### [VULN-003] Atributo `secure` en la cookie `saas3d-center-id` (`CENTER_COOKIE`) (**Medium**)
- **Archivos afectados:**
  - `src/lib/auth.ts`
  - `src/app/login/actions.ts`
  - `src/app/taller/nuevo/actions.ts`
  - `src/app/join/actions.ts`
  - `src/app/(private)/profile/actions.ts`
- **Causa raíz:**
  - Al fijar `CENTER_COOKIE`, las opciones eran `{ httpOnly: true, sameSite: "lax", path: "/" }` sin `secure: process.env.NODE_ENV === "production"`.
- **Remediación:**
  - Exportar `CENTER_COOKIE_OPTIONS` desde `src/lib/auth.ts` con `{ httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" }` y utilizarla en todas las Server Actions que asignan `CENTER_COOKIE`.

### [DEF-001] Encabezados HTTP de Seguridad en `next.config.ts` (**Low / Defensa en profundidad**)
- **Archivo afectado:**
  - `next.config.ts`
- **Remediación:**
  - Agregar `headers()` globales para todas las rutas (`/:path*`):
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 3. Consideraciones Adicionales para Producción (Vercel + Supabase)

1. **Configuración recomendada en el Dashboard de Supabase (`Authentication → URL Configuration`):**
   - **Site URL:** `https://kalibre3d.vercel.app`
   - **Redirect URLs permitidas:** `https://kalibre3d.vercel.app/auth/callback` (evitar comodines amplios como `https://*.vercel.app/**` si no se requieren previews con autenticación por correo).
2. **Certificado TLS de PostgreSQL (`SUPABASE_DB_CA_CERT`):**
   - Actualmente `src/lib/postgres-tls.ts` permite `sslmode=require` (cifrado TLS activo sin fijación de CA local) para funcionar con las variables automáticas de la integración Vercel ↔ Supabase (`POSTGRES_PRISMA_URL`).
   - Para activar `sslmode=verify-full` estricto contra MITM en producción, basta con cargar el certificado raíz de Supabase en la variable de entorno `SUPABASE_DB_CA_CERT` en Vercel; `createPostgresTlsConfig` activará automáticamente `rejectUnauthorized: true` con esa CA.
3. **Comandos de verificación al retomar:**
   ```bash
   npm test -- --run
   npm run lint
   npm run build
   ```
