# Runbook de Despliegue Inicial: Supabase + Vercel — Kalibre (`saas3d`)

Fecha: 2026-11-08  
Proyecto Supabase: `umgxxtpekcjknhclojzo` (`https://umgxxtpekcjknhclojzo.supabase.co`)  
Repositorio GitHub: `https://github.com/Epimete0/Kalibre3D`

---

## 1. Preparar la base de datos en Supabase (Paquetes SQL seguros)

En lugar de ejecutar migraciones sueltas sin control, se generaron los 4 paquetes SQL deterministas en `scripts/production/` a partir de las 4 migraciones reales (`20261107000000_core_multitenant`, `20261108000000_phase1_orders_money`, `20261108000100_fix_money_void_check` y `20261109000000_phase2_catalog_spools_stock`).

Abre el **SQL Editor** de tu proyecto en Supabase:  
👉 `https://supabase.com/dashboard/project/umgxxtpekcjknhclojzo/sql/new`

Ejecuta los archivos en este orden exacto:

1. **Preflight (solo lectura):**  
   Copia y ejecuta [`scripts/production/20261108-00-preflight-initial-schema.sql`](../../scripts/production/20261108-00-preflight-initial-schema.sql).  
   *Resultado esperado:* `PREFLIGHT OK: base limpia, privilegios administrativos verificados y sin bloqueos.`

2. **Dry-Run con `ROLLBACK` (ensayo sin persistir cambios):**  
   Copia y ejecuta [`scripts/production/20261108-01-dry-run-initial-schema.sql`](../../scripts/production/20261108-01-dry-run-initial-schema.sql).  
   *Resultado esperado:* aplica las 16 tablas, `app_private`, RLS, ACL y triggers, verifica todo (`POSTFLIGHT OK`), hace `ROLLBACK` y devuelve `center_ausente = true`, `order_ausente = true`, `spool_ausente = true`.

3. **Aplicación definitiva (`COMMIT` en una sola transacción):**  
   Copia y ejecuta [`scripts/production/20261108-02-apply-initial-schema.sql`](../../scripts/production/20261108-02-apply-initial-schema.sql).  
   *Resultado esperado:* devuelve las 4 migraciones con `terminada = true`.

4. **Verificación posterior (solo lectura):**  
   Copia y ejecuta [`scripts/production/20261108-03-verify-initial-schema.sql`](../../scripts/production/20261108-03-verify-initial-schema.sql).  
   *Resultado esperado:* verifica los checksums SHA-256 LF idénticos a Prisma CLI, las 16 tablas, RLS activo, `SERVER_ONLY` cerrado para `anon`/`authenticated` y los 8 triggers.

---

## 2. Configurar URLs de Autenticación en Supabase

En el panel de Supabase ve a **Authentication → URL Configuration**:  
👉 `https://supabase.com/dashboard/project/umgxxtpekcjknhclojzo/auth/url-configuration`

1. **Site URL:**  
   `https://kalibre3d.vercel.app` *(o tu dominio definitivo en Vercel)*
2. **Redirect URLs (Add URL):**
   - `https://kalibre3d.vercel.app/auth/callback`
   - `https://kalibre3d.vercel.app/reset-password`
   - `https://*-epimete0s-projects.vercel.app/**` *(opcional si usas previews de Vercel)*

---

## 3. Completar `.env` y Variables de Entorno en Vercel

El archivo `.env` local (ignorado por Git) ya quedó normalizado con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de tu proyecto `umgxxtpekcjknhclojzo`, y se eliminó `SUPABASE_SECRET_KEY` (la aplicación nunca usa `service_role` ni llaves secretas).

Para completar `.env` y cargar las variables en **Vercel → Project Settings → Environment Variables**:

| Variable | Valor / De dónde obtenerlo |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://umgxxtpekcjknhclojzo.supabase.co` *(ya en `.env`)* |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Tu clave `sb_publishable_...` *(ya en `.env`)* |
| `DATABASE_URL` | En Supabase haz clic arriba en **Connect → Transaction pooler (puerto 6543)** y reemplaza `<DB_PASSWORD>` por la contraseña de tu base de datos: `postgresql://postgres.umgxxtpekcjknhclojzo:<DB_PASSWORD>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | En Supabase **Connect → Session pooler (puerto 5432)**: `postgresql://postgres.umgxxtpekcjknhclojzo:<DB_PASSWORD>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=verify-full` |
| `SUPABASE_DB_CA_CERT` | En Supabase ve a **Database → Settings → SSL Configuration → Download Certificate (`prod-ca-2021.crt`)** y pega el contenido PEM completo (`-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----`). |
| `NEXT_PUBLIC_SITE_URL` | `https://kalibre3d.vercel.app` *(la URL pública que te asigne Vercel)* |
| `NEXT_PUBLIC_LEGAL_EMAIL` | Tu correo de contacto para consultas legales/privacidad. |
| `NEXT_PUBLIC_LEGAL_REVIEWED` | `"false"` mientras los textos legales sean borrador, o `"true"` una vez revisados. |

> **Importante:** No definas `SAAS3D_LOCAL_DEV` en Vercel. Esa variable es exclusiva para `.env.local` en tu computador.
