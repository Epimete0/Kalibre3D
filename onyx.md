# Onyx: Contexto Vivo del SaaS para makers 3D

> Nombre comercial **pendiente**. Identificador técnico interno: `saas3d` (paquete, carpeta y proyectos de Supabase/Vercel). Igual que en Kurova con `nexo`, el identificador técnico no se cambia solo para unificar nombres cuando se decida la marca.
>
> Este documento es la fuente principal de verdad del producto: qué se quiere hacer, cómo se construye, qué problemas aparecieron y qué se decidió. Arriba van las entradas fechadas de cada iteración (la más reciente primero). Abajo, las secciones estables numeradas. Ver la sección 17 para saber cómo actualizarlo.

---

## Fase 0 cerrada — Quality gate (tarea 0.7), 2026-11-06

- **`npm run quality:gate` → PASSED** (`scripts/quality-gate.ts`, adaptado del de Kurova sin sus excepciones de migraciones ni sus suites de dominio):
  - Unitarias 209/209 (32 archivos), lint, `next build`.
  - `prisma:migrate` + `prisma migrate status` ("Database schema is up to date", 1 migración).
  - `test:rls` 12/12, `test:s1` 3/3, `test:s3` 1/1, `test:transactions` 25/25.
- **Revisión de seguridad de la Fase 0:**
  - Ninguna tabla del núcleo es accesible por `anon`, y `authenticated` solo accede según membresía y rol (RLS probado).
  - Las funciones de `app_private` no son invocables por la API.
  - `_prisma_migrations` está cerrada.
  - Las Server Actions no importan Prisma y los servicios abren con su contexto (prueba de fronteras).
  - La app no usa `SUPABASE_SECRET_KEY` ni `service_role`.
  - `signup-profile` solo actúa sobre el `userId` que devuelve Supabase Auth en el servidor.
  - Riesgo abierto conocido: `proxy.ts` deja pasar las solicitudes si faltan las variables públicas de Supabase (mitigado por `requireAuthContext` en cada página privada).
- **Observación:** el desarrollo local y las pruebas comparten hoy la instancia `saas3d-test`. Las suites reales reinician el schema `public`, así que **cada quality gate borra los datos de desarrollo** (la cuenta QA de Auth sobrevive, pero su taller no). Pendiente: crear la instancia `saas3d-local` (54441/54442) para desarrollo.
- **Fase 0 completa.** Siguiente: Fase 1 (clientes, pedidos y dinero), con su plan detallado antes de implementar (sección 18.2).

## Fase 0 — Rutas de acceso, shell, perfil y legal (tarea 0.6), 2026-11-06

- **Rutas (copiadas de Kurova, solo lectura, y adaptadas):**
  - Públicas: `/` (portada provisional con "Crear mi cuenta" e "Iniciar sesión"), `/login`, `/registro`, `/join`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/terminos`, `/privacidad`, `robots.txt` y `sitemap.xml`, más las páginas de error y `not-found`.
  - Privadas: `/taller/nuevo` (la ruta `/centro/nuevo` de Kurova pasa a llamarse **`/taller/nuevo`**), `/dashboard`, `/profile` y `/team`.
- **Inicio (`/dashboard`):** estado sin taller ("Crear mi taller" / "Tengo un código de invitación") y bienvenida provisional ("Hola, {nombre} · Este es el inicio de {taller}"). El panel real es la Fase 3.
- **Mi taller (`/profile`):** cuenta (correo, cambio de correo que falla cerrado, nombre y contraseña) y datos del taller (nombre, zona horaria y cambio de taller activo). Se quitaron los precios, los gastos operativos y el límite de nombre de Kurova. La comprobación de membresía al cambiar de taller pasó de la Server Action a `account-service.resolveSelectableCenter`.
- **Equipo (`/team`):** existe pero **no aparece en la navegación** (MVP de un solo dueño). Se quitó "atiende citas" (`schedulable`) y el aviso de citas al desactivar.
- **Registro:** las consultas Prisma de `login/actions.ts` se movieron a `src/lib/signup-profile.ts` (`isInvitationUsable`, `profileExists` y `ensureProfile`), para cumplir que las acciones no importen Prisma.
- **Shell:** `AppShell`, `Sidebar` y `PrivateHeader` sin búsqueda ni alertas de stock. Navegación de la Fase 0: **Inicio** y **Mi taller** (menú lateral en computador y `MobileNav` inferior en celular). Se eliminaron `InventoryDisplay`, `CatalogControls`, `StockAlertsMenu`, `LandingMotion`, `MobileMoreMenu` y `InventoryMobileNav`. Se agregó `src/lib/theme.ts` (tema claro y oscuro).
- **Marca provisional "Taller 3D"** en metadata, menú y textos. El prefijo técnico `kurova-` pasa a `saas3d-` (clases CSS y tema). Términos y Privacidad fueron reescritos para el taller 3D (Gemini 3.8 Flash vía agy, revisados en la estructura) y **requieren revisión de la persona responsable** antes de publicar (`NEXT_PUBLIC_LEGAL_REVIEWED`).
- **Finales de línea:** todo `src/`, `tests/` y `scripts/` quedó con LF (los archivos copiados de Kurova venían con CRLF).
- **Desarrollo local:**
  - `.env.local` (ignorado por git) apunta a `saas3d-test` (loopback) con `SAAS3D_LOCAL_DEV=YES`, y además anula el `SUPABASE_URL` de la nube que está en `.env`. La guarda local rechaza (correctamente) cualquier dirección que no sea loopback.
  - Cuenta QA local en `.env.qa.local` (ignorado).
  - `next dev --webpack -p 3100` (puerto 3100 para no chocar con otros proyectos), con configuración en `.claude/launch.json`.
- **Verificación en navegador (contra `saas3d-test`):** registro → `/taller/nuevo` → crear "Surko QA" → `/dashboard` ("Hola, Benja") → `/profile` ("Tu rol: Dueño") → `/team` (200, sin textos de Kurova). En la base: taller `America/Santiago`, rol `OWNER` activo y perfil creado.
  - Con el panel del navegador oculto (ventana 0×0), React no revela el contenido cargado por partes porque `requestAnimationFrame` no corre. El contenido llega completo en el HTML: es una limitación del panel, no un error.
  - **Falta la revisión visual** a 390 px y en computador con el panel visible.
- **Resultados:** unitarias 209/209 (32 archivos), `test:rls` 12/12, `test:s1` 3/3, `test:s3` 1/1, `test:transactions` 25/25, lint y tipos limpios, `next build` OK (16 rutas y el proxy).
- **Pendiente:** 0.7 (quality gate), revisión visual con el panel visible, revisión de los textos legales y marca definitiva (paleta provisional de Kurova).

## Fase 0 — Autenticación y taller activo (tarea 0.5), 2026-11-06

- **Copiado de Kurova (solo lectura) a `src/lib`, con sus pruebas:** `supabase/{client,server}.ts`, `auth.ts` (`requireSessionUser`, `getSessionMembershipState`, `requireAuthContext`, `requireOperationalContext`, `requireCatalogContext`), `active-center.ts`, `auth-errors.ts`, `auth-settings.ts`, `action-errors.ts`, `action-failure.ts`, `safe-redirect.ts`, `transaction-conflict-retry.ts`, `unique-violation.ts`, `validation-errors.ts`, `persisted-entity-id.ts`, `form-draft.ts`, `site-url.ts`, `legal.ts`, `email-change.ts`, `account-service.ts`, `center-service.ts`, `center-creation.ts` y `center-creation-rules.ts`, `center-time-zone*.ts`, `invitation-service*.ts`, `invitation-admin-service.ts`, `center-archive-service*.ts`, `member-service.ts` y `team-rules.ts`. Además `src/proxy.ts`. Dependencias nuevas: `@supabase/ssr`, `@supabase/server`, `@supabase/supabase-js` y `@js-temporal/polyfill`.
- **Adaptaciones:**
  - Se quitaron `nameChangedAt`, el límite de 30 días y `center-name-rules`.
  - Se quitó `schedulable` al crear el taller y al desactivar miembros, y el conteo de citas (`booking`) en `setMemberActive`, que ahora devuelve `{ userId, active }`.
  - Identificadores técnicos: cookie `saas3d-center-id`, borradores `saas3d:draft:`, candado `saas3d:create-center:` y origen `saas3d.local` en `safe-redirect`.
  - **Lenguaje del producto** en los mensajes y pruebas: centro → taller, propietaria → dueño, administradora → administrador, profesional → ayudante, lectora → lector.
- **`auth-boundaries.test.ts` reescrito con reglas genéricas que recorren `src/`:**
  - Solo `dashboard` y `profile` usan `getSessionMembershipState`.
  - Ninguna `actions.ts` importa Prisma.
  - Toda función exportada de los servicios del núcleo abre con su contexto.
  - Crear un taller exige sesión y fija `OWNER` con candado.
  - El cambio de correo falla cerrado.
  - La aplicación no usa `SUPABASE_SECRET_KEY`, `SERVICE_ROLE_KEY` ni `service_role`.
- **Integración real nueva (`npm run test:transactions`):** `tests/center-creation.integration.test.ts` y `tests/team.integration.test.ts` (sin agenda: "desactivar no borra nada y se puede reactivar").
- **Resultados:** unitarias 196/196 (28 archivos), `test:transactions` 25/25, lint y tipos limpios. Las suites `test:rls`/`s1`/`s3` de la 0.4 no cambian.
- **Observación heredada:** si faltan `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `src/proxy.ts` deja pasar la solicitud, igual que Kurova. Las páginas privadas igualmente validan la sesión en el servidor con `requireAuthContext`. Revisar si conviene fallar cerrado.
- **Pendiente:** 0.6 (rutas de acceso, shell, perfil, equipo oculto, legal y landing provisional) y 0.7 (quality gate).

## Fase 0 — Base, Prisma y núcleo multi-tenant (tareas 0.1 a 0.4), 2026-11-06

- **Repositorio:** `git init` en `main`. `AGENTS.md` (contrato adaptado del de Kurova, sin graphify/ECC/opencode), `CLAUDE.md` (`@AGENTS.md`) y `.gitignore` (copia del de Kurova).
- **Base (0.2):** Next.js `16.3.3`, React `19.2.4`, Zod 4, Tailwind 4, Vitest 4, con las mismas versiones y configuración que Kurova (`tsconfig`, `next.config`, `eslint`, `postcss`, `vitest`, `vercel.json`). `globals.css` usa la paleta de Kurova de forma **provisional** hasta definir la marca. Hay un layout y una portada provisionales ("Taller 3D").
- **Prisma y entorno local (0.3):** Prisma `7.10.0` (`@prisma/adapter-pg`), con `prisma.ts`, `prisma-client-factory.ts`, `postgres-tls.ts`, `local-development.ts` (`SAAS3D_LOCAL_DEV`), `scripts/local-postgres.ts` y `run-local-prisma-migrate.ts` copiados de Kurova con sus pruebas. `supabase/config.toml` define la instancia de pruebas **`saas3d-test`** (API 54451, DB 54452, studio 54453, pooler 54459, shadow 54450, inspector 8185), separada de `kurova-local`.
- **Migración `20261107000000_core_multitenant` (0.4), aplicada solo en `saas3d-test`:**
  - Contenido: `Profile`, `Center`, `CenterMember`, `InvitationCode` y `OnboardingDismissal`; `app_private.is_center_member`/`has_center_role` (`SECURITY DEFINER`, sin `USAGE` del schema para la API); RLS y políticas idénticas al estado final de Kurova; permisos revocados y concedidos de forma explícita; `_prisma_migrations` con RLS y sin privilegios para la API; guarda diferida de último dueño, con el mensaje "El taller debe conservar al menos un dueño activo.".
  - Origen: un volcado `pg_dump --schema-only` (solo lectura) de la base local de Kurova, más sus migraciones. Detalle en `docs/migrations/20261107000000_core_multitenant.md`.
  - **Excluido:** `kurova_guard` (exclusivo de la copia local de Kurova), `nameChangedAt` y el límite de 30 días, `CenterMember.schedulable` (agenda) y los objetos de dominio de Kurova.
  - **Más estricto que la copia local de Kurova:** sin `DELETE` en `InvitationCode` ni `OnboardingDismissal`, y sin acceso de la API a `_prisma_migrations`, tal como dictan las migraciones de Kurova. La copia local de Kurova tenía permisos más amplios. No se verificó producción de Kurova y no se tocó.
- **Pruebas de integración reales (portadas y recortadas al núcleo):** `tests/rls.integration.test.ts` (12: aislamiento entre talleres, anon, Profile, roles, invitaciones, DELETE rechazado, onboarding, canje único bajo concurrencia, `_prisma_migrations`, archivado solo por OWNER, último dueño y RLS en todas las tablas), `tests/security-definer-private-schema.integration.test.ts` (S1, 3) y `tests/prisma-migrations-acl.integration.test.ts` (S3, 1; ahora recarga el caché de PostgREST antes de medir). Se eliminó del harness el mapa `c4b3` de tablas de Kurova.
- **Resultados:** unitarias 59/59, `test:rls` 12/12, `test:s1` 3/3, `test:s3` 1/1, lint y tipos limpios, build OK (0.2).
- **Ejecución con agy:** las copias exactas las hace Claude con `cp`; agy escribió el contrato, el `package.json`, el layout y la migración. La cuota de los modelos Claude y GPT de agy se agotó (vuelve en ~93 h, desde el 2026-11-06) y Gemini 4 Argon está en su límite. Las pruebas de la 0.4 las adaptó Claude en esta sesión.
- **Regla permanente:** **KurovaV2 es de solo lectura** (app en producción con usuarios). Solo se lee y se copia desde ella, nunca se modifica.
- **Pendiente:** 0.5 (autenticación y taller activo), 0.6 (rutas, shell y legal), 0.7 (quality gate). Completar el `.env` del proyecto Supabase en la nube (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_DB_CA_CERT` y `NEXT_PUBLIC_*`) y sacar de ahí `SUPABASE_SECRET_KEY`. Nada se ha aplicado en la nube.

## Definición del producto y plan de construcción sobre el núcleo de Kurova, 2026-11-06

- **Origen:** análisis del negocio Surko (impresión 3D en Talca, emblemas para vehículos) hecho con datos reales de Mercado Libre, Mercado Pago, Instagram, la web `surko.vercel.app` y Cults3D. Hallazgos: 92 ventas en ML desde el 19-mar-2026 (~$1,29 M bruto, ~$800 k neto estimado), devoluciones y cancelaciones que subieron del 11% al 21% desde julio, ingresos repartidos en 6 canales sin registro, y dinero personal mezclado con el del negocio. Conclusión: el problema no es la demanda sino la falta de un sistema. De ahí nace este SaaS.
- **Decisión de producto:** construir un SaaS en español para makers y talleres chicos de impresión 3D de Latinoamérica, validando primero con Surko y luego con 5 a 10 makers en una beta gratis (sección 15).
- **Decisión de arquitectura:** se construye sobre el **núcleo multi-tenant de Kurova** (`KurovaV2/onyx.md`, sección 18.3), ya probado en producción: Prisma 7 + PostgreSQL de Supabase, `Center`/`Profile`/`CenterMember`/`InvitationCode`, esquema `app_private`, tablas de dominio `SERVER_ONLY` con RLS cerrado, claves foráneas compuestas `(centerId, id)`, guardas `requireAuthContext()` y `quality:gate`. Reemplaza un primer borrador de plan basado en supabase-js directo, que quedó descartado.
- **Identificadores técnicos heredados sin cambio:** `Center`, `CenterMember`, `centerId` y los roles `OWNER`/`ADMIN`/`PROFESSIONAL`/`VIEWER` se mantienen como en Kurova para poder copiar el núcleo y sus pruebas casi sin tocar. En la interfaz se habla de **Taller** (no "centro") y de **Ayudante** (no "profesional").
- **Estado:** nada construido todavía. La carpeta `saas3D` contiene solo este documento. Siguiente paso: Fase 0 (sección 18.1).

---

## 1. Qué es

Aplicación web para la operación de un taller de impresión 3D. Conecta **pedidos, ventas, dinero, costos y filamento** para responder con datos:

- Qué pedidos hay, en qué estado van y cuáles están atrasados.
- Cuánto entró y salió cada mes, por canal y por categoría, y cuánto se ganó de verdad.
- Cuánto cuesta realmente una pieza: filamento, purga multicolor, luz y embalaje.
- Cuánto deja realmente una venta de Mercado Libre después de la comisión, el envío y las devoluciones.
- Cuánto filamento queda por material y color, y qué piezas hay en stock.

Funciona como SaaS multi-taller: cada persona tiene su cuenta, un taller activo y permisos verificados en el servidor.

**Primer usuario:** Surko. Imprime todo en PETG ($15.000/kg), con emblemas de 20 a 70 g (lo típico es 50 g) y una Anycubic Kobra X de 4 colores con ACE Gen 2. Vende en Mercado Libre, por WhatsApp, Instagram y en persona, y vende archivos en Cults3D. Diseña en Fusion 360 con modelos paramétricos y apoyo de IA. Las cajas de envío le salen gratis por un convenio de Mercado Libre con Chilexpress.

## 2. Alcance Actual

### Implementado

- **Fase 0 (2026-11-06):**
  - Núcleo multi-tenant (`Profile`, `Center`, `CenterMember`, `InvitationCode` y `OnboardingDismissal`, con RLS y `app_private`).
  - Registro, inicio de sesión, recuperación de contraseña, unirse por invitación y crear taller (`/taller/nuevo`).
  - Inicio provisional, Mi taller (`/profile`), Equipo (`/team`, oculto en la navegación), términos y privacidad (pendientes de revisión), portada provisional.
  - `npm run quality:gate` en verde.

### MVP planificado (Fases 0 a 3)

- **Núcleo (Fase 0):** registro, inicio de sesión, recuperación de contraseña, crear el taller, perfil, términos y privacidad, todo heredado de Kurova.
- **Pedidos (Fase 1):** clientes, pedidos con piezas y colores, canales (WhatsApp, Instagram, en persona, Mercado Libre, archivo digital y otro), estados, fecha de entrega, abonos, devoluciones y neto de Mercado Libre.
- **Dinero (Fase 1):** ingresos y gastos por categoría y método, y resumen mensual por canal y por categoría.
- **Costos y filamento (Fase 2):** catálogo de piezas, cotizador, bobinas por material y color, y stock de piezas. El stock solo cambia por movimientos.
- **Panel (Fase 3):** el mes de un vistazo, pedidos pendientes y atrasados, y alertas.

### Decisiones de alcance tomadas

| Tema | Decisión |
|---|---|
| Mercado Libre | Las ventas se registran **a mano**, como pedido con canal `mercadolibre` |
| Dispositivos | Celular y computador **por igual** |
| Usuarios | El núcleo soporta miembros e invitaciones, pero en el MVP **solo se usa el dueño (`OWNER`)**. La pantalla de Equipo queda oculta |
| Cobro | **Beta gratis**, sin integración de pagos |
| Base técnica | Núcleo de Kurova (sección 3) |

### Fuera de alcance por ahora

- Conexión automática con la API de Mercado Libre.
- Pantalla de equipo y ayudantes con permisos (el núcleo ya lo soporta; solo falta exponerlo).
- Cobro de suscripción (Mercado Pago o Stripe).
- Boletas, facturas y SII.
- Tienda o catálogo público.
- Seguimiento de impresoras y colas de impresión.
- Calculadora pública de costo de impresión 3D sin cuenta. Es una buena candidata para atraer makers, como las calculadoras públicas de Kurova, y queda para después del MVP.

## 3. Stack y Arquitectura

Mismas versiones que KurovaV2 al 2026-11-06:

| Capa | Tecnología | Uso |
|---|---|---|
| Aplicación | Next.js 16 (`16.3.3`), React 19 (`19.2.4`), TypeScript 5 | App Router, Server Components para lecturas y Server Actions para mutaciones |
| Persistencia | Prisma 7 (`7.10.0`, `@prisma/adapter-pg`) + PostgreSQL de Supabase | Datos, migraciones PostgreSQL, transacciones y bloqueos `FOR UPDATE` |
| Autenticación | Supabase Auth (`@supabase/ssr` 0.12, `@supabase/server`) | Sesiones SSR, recuperación de contraseña y aislamiento por membresía activa |
| Validación | Zod 4 | Formularios y reglas de dominio en los límites del servidor |
| Interfaz | Tailwind CSS 4 | Sistema visual heredado de Kurova y adaptado a la marca; responsive con modo claro y oscuro |
| Pruebas | Vitest 4 + Testing Library + harness PostgreSQL | Unitarias, de componentes e integración real (RLS y transacciones) |
| Despliegue | Vercel | `vercel-build` → `next build` |

**Reglas de arquitectura (heredadas de Kurova):**

- No existe API REST. Las lecturas van por Server Components con funciones `src/lib/*-queries.ts` y las mutaciones por Server Actions.
- **La autorización vive en los servicios** (`src/lib/*-service.ts`). Toda función exportada de un servicio abre con su guarda (`requireAuthContext`, `requireOperationalContext` o `requireCatalogContext`). Las Server Actions solo delegan y no importan Prisma. Lo verifica `src/lib/auth-boundaries.test.ts`.
- **Toda consulta y mutación Prisma incluye `centerId`** en su `where` o `data`.
- **El stock (piezas y filamento) nunca se modifica directamente:** todo cambio crea un movimiento.
- El layout raíz solo define el documento, las fuentes y los estilos. Las rutas operativas están bajo `(private)`, cuyo layout obtiene la cuenta y renderiza `AppShell`. Las rutas públicas no cargan el shell.
- Los modelos de lectura que se pasan a Client Components son explícitos y serializables.

**Estructura (igual a Kurova):**

```text
src/app/                 rutas, páginas y Server Actions
src/components/          formularios y componentes de interfaz
src/lib/                 servicios de dominio, consultas, reglas puras y Prisma
prisma/                  schema.prisma y migrations-postgres/
tests/                   integración real contra PostgreSQL/RLS y aceptación estática
scripts/                 quality gate, runners locales, QA local y paquetes de producción
docs/                    especificaciones, planes y runbooks
```

## 4. Módulos y Rutas

| Módulo | Rutas | Estado |
|---|---|---|
| Landing | `/` | Implementado (provisional): propuesta de valor y acceso |
| Acceso | `/login`, `/registro`, `/join`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/taller/nuevo` | Implementado (Fase 0), heredado de Kurova |
| Legal | `/terminos`, `/privacidad` | Implementado (Fase 0); textos pendientes de revisión |
| Perfil / Mi taller | `/profile` | Implementado (Fase 0): cuenta, contraseña y datos del taller |
| Inicio | `/dashboard` | Implementado (provisional): estado sin taller y bienvenida. Fase 3: panel del mes |
| Clientes | `/clients`, `/clients/new`, `/clients/[id]` | Planificado (Fase 1) |
| Pedidos | `/orders`, `/orders/new`, `/orders/[id]` | Planificado (Fase 1) |
| Dinero | `/money` | Planificado (Fase 1) |
| Ajustes del taller | `/settings` | Planificado (Fase 1): moneda, luz, comisión ML, embalaje, costo por kilo y purga |
| Catálogo y cotizador | `/products`, `/products/new`, `/products/[id]`, `/quote` | Planificado (Fase 2) |
| Filamento | `/spools`, `/spools/[id]` | Planificado (Fase 2) |
| Equipo | `/team` | Implementado, **oculto en la navegación del MVP** |

Las rutas usan inglés técnico, como Kurova. Los textos visibles van en español.

**Navegación:** en el celular, una barra inferior con Inicio, Pedidos, Dinero, Clientes y Más. En el computador, un menú lateral con los mismos destinos más Catálogo, Filamento y Ajustes.

## 5. Modelo de Dominio

### Núcleo multi-tenant (copiado de Kurova 18.3, sin cambios de nombre)

`Profile`, `Center` (el taller), `CenterMember` (roles `OWNER`, `ADMIN`, `PROFESSIONAL`, `VIEWER`), `InvitationCode` y `OnboardingDismissal`. Las definiciones exactas están en `KurovaV2/onyx.md` 18.3 §2.1. Para este producto, `Center` además usa `timeZone` (por defecto `America/Santiago`).

### Dominio del taller

Todas las tablas llevan `centerId UUID NOT NULL`. Las tablas padre exponen `UNIQUE ("centerId", "id")`. Las referencias entre tablas del taller usan **claves foráneas compuestas** `("centerId", "<padreId>")`, y los autores usan `("centerId", "<userId>") → CenterMember`. **Los montos son enteros** en la unidad mínima de la moneda (CLP no tiene decimales). Los gramos son enteros.

**Fase 1:**

| Tabla | Campos |
|---|---|
| `CenterSettings` | `centerId` (único), `currency` (configurable, D9; por defecto `CLP`), `electricityCostPerHour`, `mlCommissionPercent DECIMAL(5,2)` (19), `mlDefaultShippingCost` (0), `defaultPackagingCost` (0), `defaultCostPerKg` (15000), `defaultPurgeGrams` (0), `lowSpoolThresholdGrams` (150) |
| `Product` (mínimo, D11) | `id`, `centerId`, `name`, `salePrice`, `mlPrice?`, `active`, `createdAt` (en la Fase 2 se suman gramos, minutos, colores, purga, stock y costos) |
| `Customer` | `id`, `centerId`, `name`, `phone`, `instagram` (sin `@`), `notes`, `active`, `createdAt` |
| `Order` | `id`, `centerId`, `number` (automático, D2), `operationId UUID` (`UNIQUE (centerId, operationId)`), `customerId?` (opcional, D7), `kind` (`QUICK_SALE`/`ORDER`, D12), `channel` (la casilla ML de D4 = canal `MERCADOLIBRE`), `status`, `version INT`, `dueDate DATE?`, `discount`, `total`, `mlOrderRef?`, `mlCommission`, `mlShippingCost`, `notes`, `createdByUserId`, `createdAt`, `deliveredAt?` |
| `OrderItem` | `id`, `centerId`, `orderId`, `position`, `productId?` (lista de precios, D11), `description`, `qty`, `unitPrice`, `material?`, `grams?`, `colorsCount` |
| `OrderEvent` | Historial **inmutable**: `id`, `centerId`, `orderId`, `version`, `fromStatus`, `toStatus`, `actorUserId`, `occurredAt` (patrón `BookingEvent` de Kurova) |
| `MoneyTransaction` | `id`, `centerId`, `operationId` (único por taller), `type` (`INCOME`/`EXPENSE`), `category`, `amount > 0`, `date`, `method`, `orderId?`, `notes`, `recordedByUserId`, `createdAt` |

**Fase 2:**

| Tabla | Campos |
|---|---|
| `Product` | Pieza de catálogo: `name`, `category`, `material`, `grams`, `printMinutes`, `colorsCount`, `purgeGrams`, `salePrice`, `currentStock`, `minStock`, `active` |
| `ProductMovement` | `ENTRY`/`EXIT`/`ADJUST` inmutable con `resultingStock` (patrón `InventoryMovement`) |
| `Spool` | Bobina: `material`, `color`, `brand`, `totalGrams`, `remainingGrams`, `pricePaid`, `purchasedAt`, `active` |
| `SpoolMovement` | Consumo o ajuste de gramos, inmutable |

**Valores cerrados (`CHECK`):**
- `channel`: `WHATSAPP`, `INSTAGRAM`, `IN_PERSON`, `MERCADOLIBRE`, `DIGITAL`, `OTHER`
- `status`: `QUOTED`, `CONFIRMED`, `PRINTING`, `READY`, `DELIVERED`, `CANCELED`, `RETURNED`
- `material`: `PLA`, `PETG`, `ASA`, `ABS`, `TPU`, `OTHER`
- Categorías de ingreso: `ORDER_PAYMENT`, `DIGITAL_SALE`, `OTHER_INCOME`
- Categorías de gasto: `FILAMENT`, `PARTS`, `SHIPPING`, `ADVERTISING`, `FEES`, `REFUNDS`, `UNEXPECTED`, `OTHER_EXPENSE`
- `method`: `TRANSFER`, `CASH`, `MERCADOPAGO`, `MERCADOLIBRE`, `OTHER`

Las etiquetas en español viven en `src/lib/*-presentation.ts`.

## 6. Reglas de Negocio

### Pedidos

- **Estados:** `QUOTED → CONFIRMED → PRINTING → READY → DELIVERED`. Desde cualquier estado anterior a `DELIVERED` se puede pasar a `CANCELED`. Solo un pedido `DELIVERED` puede pasar a `RETURNED`. `CANCELED` y `RETURNED` son finales.
- Cada cambio de estado incrementa `version`, exige la versión que la persona veía (si cambió entretanto, se rechaza), bloquea el pedido con `FOR UPDATE` y escribe un `OrderEvent`. Al pasar a `DELIVERED` se fija `deliveredAt`.
- `total = max(0, Σ qty × unitPrice − discount)`, calculado en el servidor.
- **Monto esperado:** en canales directos es `total`. En Mercado Libre es `total − mlCommission − mlShippingCost`. La comisión sugerida es `round(total × mlCommissionPercent / 100)`.
- `saldo = monto esperado − Σ pagos (INCOME con ese orderId)`.
- **Devolución:** pasa el pedido a `RETURNED` y registra un `EXPENSE` de categoría `REFUNDS` vinculado al pedido, en la misma transacción.
- Un pedido con pagos o eventos no se borra: se cancela.
- Crear un pedido es idempotente por `operationId`, para evitar el doble envío desde el celular.

### Dinero

- Registrar un abono crea un `INCOME` de categoría `ORDER_PAYMENT` unido al pedido.
- Las ventas de archivos (Cults y similares) son `INCOME` de categoría `DIGITAL_SALE` sin pedido.
- Resumen mensual: ingresos − gastos = ganancia. Los ingresos se agrupan por canal: el del pedido o, si no hay pedido, `DIGITAL` u `OTHER`. Los gastos se agrupan por categoría.
- Los meses se calculan en la zona horaria del taller.
- Solo `OWNER`/`ADMIN` ven costos, utilidad y totales de dinero, como en Kurova.

### Stock y filamento (Fase 2)

- El stock de piezas y los gramos de bobina solo cambian mediante movimientos inmutables. Ninguna bobina ni pieza queda en negativo.
- El costo por gramo de un material es el promedio de sus bobinas activas. Si no hay bobinas, se usa `defaultCostPerKg / 1000`.

## 7. Cálculo de Costos y Precios

Módulo puro `src/lib/costing.ts` (sin base de datos) con pruebas unitarias.

```
gramosTotales  = gramosPieza + (colores > 1 ? gramosPurga : 0)
costoMaterial  = round(gramosTotales × costoPorGramo)
costoLuz       = round(minutosImpresion / 60 × costoLuzPorHora)
costoTotal     = costoMaterial + costoLuz + embalaje + otros
precioSugerido = ceil(costoTotal / (1 − margenObjetivo))      // margen en [0, 1)
comisionML     = round(precioVenta × comisionPct / 100)
netoML         = precioVenta − comisionML − envioVendedor
```

**Caso de referencia (real, Surko):** emblema Toyota 13x9 vendido a $8.990, comisión $1.708 y envío a cargo del vendedor $799, deja un neto de **$6.483**. Con 50 g de PETG ($750) más la luz, la ganancia queda cerca de $5.600. Este caso es una prueba unitaria obligatoria.

## 8. Seguridad, RLS y Privilegios

Se aplica la matriz de tres niveles de Kurova (18.3 §4):

| Nivel | Tablas |
|---|---|
| `DIRECT_RLS_AUTHENTICATED` | `Profile`, `Center`, `CenterMember`, `InvitationCode`, `OnboardingDismissal` |
| `SERVER_ONLY` (RLS activado, **0 políticas**, `REVOKE ALL` a `PUBLIC`/`anon`/`authenticated`) | Todas las tablas del dominio del taller (sección 5) y `_prisma_migrations` |

- Las funciones `app_private.is_center_member` y `app_private.has_center_role` son `SECURITY DEFINER` y no se pueden invocar por RPC.
- Las claves compuestas same-center impiden físicamente mezclar datos de dos talleres. Un trigger impide cambiar `centerId` después de crear la fila.
- Se aplica la regla de "último dueño" (`center_last_owner_guard`) y la revocación de privilegios excesivos de la API (`20261106100000_revoke_excess_api_privileges` de Kurova).
- No se usa `SUPABASE_SERVICE_ROLE_KEY` en la aplicación.

## 9. Validación, Errores y Concurrencia

- Zod valida en el servidor los identificadores, montos, fechas, cantidades y largos máximos. Todos los mensajes van en español.
- Las Server Actions devuelven errores en español y conservan lo que la persona escribió. Usan `revalidatePath` y/o `redirect`. Los recursos inexistentes usan `notFound`.
- **Idempotencia por `operationId`** en crear pedido, registrar pago y registrar movimiento, más un cerrojo de formulario (`useRef`) contra el doble clic.
- `retryTransactionConflicts` reintenta ante `40001`/`40P01`/`P2034`. Los cambios de estado y los movimientos usan `FOR UPDATE`.
- Las violaciones de unicidad se traducen a mensajes claros (`unique-violation.ts`).
- Borradores de formulario en el navegador (`form-draft.ts`) para pedidos largos.
- Cada registro clave debe poder hacerse **en menos de 30 segundos desde el celular**.

## 10. Base de Datos y Migraciones

- Prisma 7 con migraciones en `prisma/migrations-postgres/`, aplicadas en local por `npm run prisma:migrate` (`scripts/run-local-prisma-migrate.ts`), que solo acepta hosts loopback.
- **Migración fundacional:** consolida en una sola migración el núcleo de Kurova a partir de estas migraciones de KurovaV2: `20260712190300_auth_centers_rls`, `20260712190400_revoke_anon_rls_functions`, `20260712190600_onboarding_dismissals`, `20260721201000_center_archive`, `20260722110000_split_invitation_onboarding_rls`, `20260829140000_center_time_zone`, `20260830120000_security_definer_private_schema`, `20260831130000_harden_prisma_migrations_acl`, `20260921100000_center_last_owner_guard` y `20261106100000_revoke_excess_api_privileges`. Se revisa línea por línea y se descarta todo lo que toque tablas de Kurova que no existen aquí.
- **Variables de entorno** (como Kurova): `DATABASE_URL` (pooler `:6543`), `DIRECT_URL` (`:5432`, `sslmode=verify-full`), `SUPABASE_DB_CA_CERT`, `NODE_EXTRA_CA_CERTS`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_LEGAL_EMAIL`, `NEXT_PUBLIC_LEGAL_REVIEWED` y `SAAS3D_LOCAL_DEV=YES` (equivalente a `KUROVA_LOCAL_DEV`).
- **Puertos locales distintos de Kurova**, para poder tener ambos proyectos levantados: instancia principal `saas3d-local` en API 54441 / DB 54442, e instancia de pruebas `saas3d-test` en API 54451 / DB 54452. Kurova usa 54421/54422 y 54431/54432.

## 11. Datos Demo y Comandos

- **Dos instancias locales (desde la tarea 1.0):** `saas3d-test` (`supabase/`, puertos 5445x) para pruebas y quality gate, y `saas3d-local` (`supabase-local/`, puertos 5444x) para desarrollo. Arranque del desarrollo: `npm run dev:db` y `npm run dev:migrate`; después `npx next dev --webpack -p 3100`. `.env.local` apunta a `saas3d-local`. Las suites reales reinician solo `saas3d-test` (verificado: un taller creado en `saas3d-local` sobrevive a `test:rls`).

- `npm run local:demo` creará el usuario `qa-local@saas3d.local`, el taller "Taller QA" (`America/Santiago`) y datos deterministas: clientes, pedidos en todos los estados (incluido uno de ML de $8.990 con neto $6.483), pagos, una devolución y gastos. Se escribe en la Fase 1.
- Comandos previstos: `dev`, `build`, `lint`, `test`, `quality:gate`, `test:rls`, `test:s1`, `test:s3`, `test:transactions`, `prisma:generate`, `prisma:migrate` y `local:demo`.

## 12. Pruebas y Quality Gate

- **Unitarias** (`src/lib/**/*.test.ts`): costos, transiciones de estado, totales, saldo, neto ML, resumen mensual y validaciones.
- **Fronteras de autorización:** `auth-boundaries.test.ts` (las actions no importan Prisma y los servicios abren con su guarda).
- **Integración real contra PostgreSQL** (instancia `saas3d-test`):
  - RLS y ACL: ninguna tabla de dominio es accesible por `anon` ni `authenticated`.
  - Same-center: no se puede usar un cliente o pedido de otro taller.
  - Transacciones: dos cambios de estado simultáneos producen exactamente un evento por versión, el `operationId` repetido no duplica nada y los pagos y devoluciones son atómicos.
- **`npm run quality:gate`** es obligatorio para cerrar una iteración: unitarias, lint, build, `prisma migrate status`, RLS, S1, S3 y transacciones. No se declara cerrada una tarea si las pruebas reales de RLS o de transacciones no pudieron ejecutarse.
- **Navegador:** cada pantalla se revisa en 390 px y en computador, sin desborde horizontal.

## 13. Despliegue

- Vercel (`vercel.json` → `npm run vercel-build`) y un proyecto de Supabase propio en la región São Paulo.
- Producción: Auth con registro habilitado; Site URL y redirecciones a la URL de Vercel; `NEXT_PUBLIC_SITE_URL` definida antes de compilar.
- Cambios de base en producción: **paquetes SQL** en `scripts/production/` con preflight, ensayo con reversión, aplicación en una transacción y verificación, más un backup previo. Siempre los ejecuta la persona responsable, como en Kurova.

## 14. Pendientes Priorizados y Decisiones Abiertas

1. **Nombre comercial** del producto y dominio.
2. Crear el repositorio en GitHub (nombre y cuenta) y los proyectos de Supabase y Vercel.
3. Valor real de `defaultPurgeGrams` para la Kobra X: se mide en las primeras impresiones multicolor.
4. Revisar con la persona responsable los textos legales (términos y privacidad) del nuevo producto.
5. Más adelante: API de Mercado Libre, cobro de suscripción, pantalla de equipo y calculadora pública.

## 15. Contexto de Negocio, Mercado y Validación

**Competencia** (todas en inglés y pensadas para Etsy y Shopify): SpoolDeck (pedidos y costo real por pedido, desde US$15 al mes, dentro de Shopify), Craftybase (filamento y costo por gramo), LayerFlow3D, 3DPCC y MakerQuote (cotizaciones), FoxTrack e Inventora. **No se encontró ninguna en español ni con Mercado Libre.**

**Nicho:** español y monedas locales; flujo basado en WhatsApp, Instagram, venta en persona y Mercado Libre; neto real de ML; purga multicolor; ventas de archivos digitales.

**Estrategia:** que Surko lo use de 2 a 4 semanas, luego una beta gratis con 5 a 10 makers de Chile, y medir antes de cobrar.

**Criterios de éxito:**
- Surko registra todo durante 4 semanas.
- Al menos 5 makers cargan datos reales.
- Al menos 3 siguen usándolo cada semana después de un mes.
- Al menos 3 dicen que pagarían (referencia: US$5 a US$15 al mes).

**Riesgos:** baja disposición a pagar, construir de más, la complejidad de la API de ML y que la carga manual sea lenta.

## 16. Documentación Relacionada

- `C:\Users\healt\OneDrive\Escritorio\Proyectos\KurovaV2\onyx.md`: sección 18.3 (plantilla del núcleo multi-tenant), 18.1 (procedimiento de base de datos) y "Quality gate: resuelto (2026-11-06)" (instancia de pruebas separada).
- `AGENTS.md` y `CLAUDE.md` de este repositorio (se crean en la Fase 0, adaptados de Kurova).

## 17. Guía para Actualizar Este Documento

Al terminar una iteración:

1. Agregar arriba una entrada fechada (`## <Módulo> V<n> — <tema>, AAAA-MM-DD`) con rutas, reglas, migraciones, pruebas, verificaciones y pendientes.
2. Actualizar las secciones de alcance, rutas, modelo y reglas afectadas.
3. Mover los pendientes resueltos fuera de la sección 14.
4. Registrar las migraciones, reglas de negocio nuevas y comandos adicionales.
5. Indicar las pruebas nuevas y el resultado del quality gate.
6. Sincronizar `CHANGELOG.md` si hubo un cambio visible.

## Referencia de Seguridad: OWASP Top 10:2025

Se heredan los controles de Kurova: control de acceso en el servidor por membresía y rol, RLS cerrado en el dominio, funciones privilegiadas fuera de la API, TLS `verify-full` hacia PostgreSQL, redirecciones locales seguras (`safe-redirect.ts`), validación Zod en los límites, sin secretos en el cliente y sin service role en la app. Cada iteración que toque autenticación, RLS, datos o concurrencia incluye una revisión de seguridad antes del quality gate.

---

## 18. Plan de Construcción

> Forma de trabajo (de `AGENTS.md` de Kurova): leer onyx.md, auditar el código afectado, presentar hallazgos, proponer el diseño, **esperar aprobación** en cambios de arquitectura, seguridad, RLS, autenticación, datos o concurrencia, implementar lo mínimo, probar, revisar la seguridad, ejecutar el quality gate y actualizar onyx.md.

### 18.1 Fase 0 — Núcleo multi-tenant desde Kurova

**Objetivo:** un proyecto vacío que permite registrarse, crear un taller, entrar y salir, con RLS y el quality gate en verde. Todavía sin módulos del taller.

- [x] **0.1 Repositorio y contrato.** `git init`. Crear `AGENTS.md` adaptado del de Kurova (producto, orden de autoridad onyx.md → AGENTS.md, forma de trabajo obligatoria, arquitectura) y `CLAUDE.md` con `@AGENTS.md`. `.gitignore` con `.env*`, `backup/`, `node_modules/` y `src/generated/`. Commit inicial con onyx.md.
- [x] **0.2 Base del proyecto.** Copiar de KurovaV2 y adaptar: `package.json` (nombre `saas3d`, mismas versiones; scripts solo de las suites que existan), `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `vercel.json`, `.env.example`, `src/app/layout.tsx` y `globals.css`. `npm install`. Verificar: `npm run lint`, `npm test` y `npm run build`.
- [x] **0.3 Prisma y Supabase local.** Copiar `prisma.config.ts`, `src/lib/{prisma,prisma-client-factory,postgres-tls,local-development}.ts` (con `SAAS3D_LOCAL_DEV`), `scripts/{local-postgres,run-local-prisma-migrate}.ts` y sus pruebas. Crear las instancias `saas3d-local` (54441/54442) y `saas3d-test` (54451/54452). Verificar: `npx supabase start` en ambas y que `prisma:migrate` rechace hosts que no sean loopback.
- [x] **0.4 Migración fundacional.** `prisma/schema.prisma` con `Profile`, `Center`, `CenterMember`, `InvitationCode` y `OnboardingDismissal`. Migración `20261107000000_core_multitenant` consolidada desde las 10 migraciones de Kurova de la sección 10. Copiar y recortar al núcleo: `tests/postgres-test-harness.ts`, `rls.integration.test.ts`, `security-definer-private-schema.integration.test.ts`, `prisma-migrations-acl.integration.test.ts` y `center-creation.integration.test.ts`, con sus runners `scripts/run-{rls,s1,s3}-tests.ts`. **Requiere aprobación antes de aplicar** (RLS y datos). Verificar: `test:rls`, `test:s1` y `test:s3` en verde.
- [x] **0.5 Autenticación y taller activo.** Copiar de `src/lib`: `supabase/{client,server}.ts`, `auth.ts`, `active-center.ts` (cookie `saas3d-center-id`), `auth-errors.ts`, `auth-settings.ts`, `action-errors.ts`, `action-failure.ts`, `safe-redirect.ts`, `transaction-conflict-retry.ts`, `unique-violation.ts`, `validation-errors.ts`, `persisted-entity-id.ts`, `form-draft.ts`, `site-url.ts`, `legal.ts`, `account-service.ts`, `center-service.ts`, `center-creation*.ts`, `center-name-rules.ts`, `center-time-zone*.ts`, `invitation-service*.ts`, `center-archive-service*.ts`, `member-service.ts` y `team-rules.ts`, con todas sus pruebas. Más `proxy.ts` en la raíz. Quitar todo lo que dependa de agenda, inventario o servicios de Kurova. Verificar: `npm test` (incluye `auth-boundaries.test.ts` y `auth-c4c1.test.ts`).
- [x] **0.6 Rutas de acceso, shell y legal.** Copiar `src/app/{login,registro,join,forgot-password,reset-password,auth/callback,terminos,privacidad}`, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `robots.ts`, `sitemap.ts`, `(private)/layout.tsx`, `(private)/dashboard` (solo el estado sin taller y un inicio provisional), `(private)/profile` y `(private)/team` (oculto en la navegación). Copiar de `src/components`: `AppShell`, `Sidebar`, `PrivateHeader`, `AccountMenu`, `MobileMoreMenu`, la navegación móvil, `AuthForm`, `AuthLayout`, `PasswordForms`, `JoinInvitationForm`, `PublicShell`, `LegalPage`, `Dialog`, `FormButtons`, `FormDraft`, `AsyncActionButton`, `NoPermission`, `ThemeBootstrap`, `ThemeToggle` y `ui.tsx`. Reescribir textos: Taller, Ayudante, marca provisional. Landing provisional. Verificar en el navegador: registro → crear taller → inicio → salir, a 390 px y en computador.
- [x] **0.7 Quality gate y cierre.** Copiar `scripts/quality-gate.ts` recortado a las suites existentes y ejecutar `npm run quality:gate` → PASSED. Revisión de seguridad. Entrada fechada en este documento y commit.

### 18.2 Fase 1 — Clientes, pedidos y dinero (plan detallado, 2026-11-06)

**Objetivo:** que Surko registre en menos de 30 segundos desde el celular cada pedido (WhatsApp, Instagram, en persona o Mercado Libre), su cobro y cada gasto, y vea cuánto ganó en el mes.

**Base:** la Fase 0 cerrada (núcleo, guardas y quality gate). Se siguen los patrones de Kurova: `operationId` para idempotencia (como `new-purchase-operation`), `FOR UPDATE` con versión (como `Booking`), eventos inmutables (como `BookingEvent`), tablas `SERVER_ONLY` y claves compuestas `(centerId, id)`.

#### Decisiones de diseño (se aprueban con este plan)

| # | Decisión | Propuesta |
|---|---|---|
| D1 | **Permisos por rol** | Clientes y pedidos (crear, editar y avanzar estado): `OWNER`, `ADMIN` y `PROFESSIONAL` (`requireOperationalContext`). Cobros, devoluciones, dinero y ajustes: solo `OWNER`/`ADMIN` (`requireCatalogContext`). `VIEWER` solo consulta pedidos y clientes, sin montos de dinero. |
| D2 | **Número de pedido automático** | Nadie lo escribe: el sistema asigna el siguiente número del taller (`Pedido #1`, `#2`…) al guardar, para mencionarlo por WhatsApp. Se asigna en la transacción bloqueando la fila del `Center` (patrón 18.3 §6.4 de Kurova), con `UNIQUE (centerId, number)`. |
| D3 | **Total del pedido** | Lo calcula el servicio (no la UI), dentro de la transacción: `max(0, Σ qty × unitPrice − discount)`. La base exige `total >= 0` y `discount >= 0`. Las piezas solo se editan mientras el pedido está en `QUOTED` o `CONFIRMED`. |
| D4 | **Mercado Libre como opción de la venta** | Casilla "Venta por Mercado Libre" en cada venta. Al marcarla, cada pieza de la lista de precios cambia a **su precio ML** (definido antes por el usuario, ver D11) y se calculan solos la comisión (`mlCommissionPercent` de Ajustes) y el envío a cargo del vendedor (`mlDefaultShippingCost` de Ajustes); ambos quedan editables y se muestra el **neto**. Al desmarcarla vuelven los precios normales. Las piezas escritas a mano mantienen el precio que se escribió. El cobro de ML se registra como `INCOME` por el neto con método `MERCADOLIBRE`. |
| D5 | **Movimientos de dinero** | No se borran: se **anulan** (`voidedAt`, `voidedByUserId`, `voidReason`). Lo anulado no cuenta en saldos ni resúmenes. Aplica a cobros y gastos. |
| D6 | **Devolución** | Una sola transacción: el pedido pasa a `RETURNED` (con versión), se registra un `EXPENSE` `REFUNDS` por el monto devuelto y un `OrderEvent`. Solo desde `DELIVERED`. |
| D7 | **Cliente opcional** | Una venta **no necesita cliente**: por defecto queda "Sin cliente". Si se quiere, un interruptor "Asignar a un cliente" permite elegir uno existente o crearlo al vuelo (solo nombre, y opcionalmente WhatsApp e Instagram). Los clientes se desactivan, nunca se borran si tienen ventas. |
| D8 | **Mes y fechas** | El mes del resumen y "atrasado" se calculan en la zona horaria del taller (`@js-temporal/polyfill`, como Kurova). La **zona horaria se cambia en Ajustes** (se traslada desde Mi taller). `dueDate` es una fecha sin hora. |
| D9 | **Moneda configurable** | Se elige en Ajustes entre monedas de la región (CLP, ARS, MXN, COP, PEN, UYU, BOB, PYG, USD y EUR). Los montos se guardan como enteros en la **unidad mínima** de la moneda (CLP sin decimales; USD en centavos) y se muestran con `Intl`. Para no mezclar monedas, **solo se puede cambiar mientras el taller no tenga movimientos de dinero**; después se bloquea con un aviso. |
| D10 | **Ajustes del taller** (`/settings`) | Moneda, zona horaria, comisión ML (%), envío ML por defecto, luz por hora, embalaje por defecto, costo por kilo y purga. Mi taller (`/profile`) queda con la cuenta y el nombre del taller. Se crea con valores por defecto al primer uso. |
| D11 | **Lista de precios mínima en esta fase** | Tabla `Product` con lo justo para vender rápido: nombre, **precio normal**, **precio ML** (opcional) y activo. Al vender se elige una pieza de la lista (o se escribe una a mano). Gramos, costos y stock se agregan sobre la misma tabla en la Fase 2. |
| D12 | **Venta rápida y pedido por encargo** | Dos formas de registrar: **venta rápida** (se entregó y se cobró en el momento: queda `DELIVERED` con su cobro en un solo paso) y **pedido** (se fabrica o entrega después y pasa por los estados). Ambas comparten la misma tabla `Order` y el mismo número. |

#### Tareas

- [x] **1.0 Instancia de desarrollo `saas3d-local`.** Crear una segunda configuración de Supabase local (carpeta `supabase-local/`, `project_id = "saas3d-local"`, API 54441, DB 54442) para que el quality gate no borre los datos de desarrollo. `.env.local` pasa a apuntar a 54441/54442. Documentar el arranque en la sección 11. *Verificación:* la cuenta QA y su taller sobreviven a un `quality:gate`.

- [ ] **1.1 Migración `20261108000000_phase1_orders_money`** (**requiere aprobación antes de aplicar**):
  - Tablas `CenterSettings`, `Customer`, `Order`, `OrderItem`, `OrderEvent` y `MoneyTransaction` (sección 5), más `Order.number` (D2), `voidedAt`/`voidedByUserId`/`voidReason` (D5) y `Customer.active`.
  - Integridad: `UNIQUE (centerId, id)` en las tablas padre; claves compuestas `(centerId, customerId)`, `(centerId, orderId)` y `(centerId, userId) → CenterMember` para autores; `CHECK` de enums, montos (`>= 0`; `amount > 0`), `qty > 0` y `colorsCount >= 1`; `UNIQUE (centerId, operationId)` en `Order` y `MoneyTransaction`; `UNIQUE (centerId, number)`.
  - Triggers: inmutabilidad de `centerId` en todas; `OrderEvent` inmutable (sin `UPDATE`/`DELETE`); `MoneyTransaction` sin `DELETE` y solo con `UPDATE` permitido para anular una vez; `Order` sin `DELETE` si tiene eventos o movimientos.
  - Seguridad: RLS activado, **0 políticas** y `REVOKE ALL` a `PUBLIC`/`anon`/`authenticated` en las 6 tablas (`SERVER_ONLY`).
  - *Pruebas reales nuevas* (`tests/phase1-integrity.integration.test.ts`, en `test:transactions`): la base rechaza mezclar talleres (cliente o pedido de otro taller), modificar eventos, borrar movimientos, anular dos veces y cambiar `centerId`. En `rls.integration.test.ts`: las 6 tablas son inaccesibles por la API para todos los roles.

- [ ] **1.2 Reglas puras (TDD, sin base de datos)** en `src/lib`:
  - `costing.ts`: `computePieceCost`, `suggestPrice`, `mercadoLibreNet` (caso obligatorio: $8.990 con 19% y $799 deja $6.483).
  - `order-status.ts`: transiciones de la sección 6; `canTransition` y `nextStatuses`.
  - `order-totals.ts`: total, monto esperado (directo o neto ML), saldo e "isOverdue" en la zona del taller.
  - `money-summary.ts`: resumen del mes (ingresos, gastos, ganancia, por canal y por categoría), excluyendo lo anulado.
  - `order-presentation.ts` y `money-presentation.ts`: etiquetas en español de canales, estados, categorías y métodos.

- [ ] **1.3 Ajustes del taller.** `center-settings-service.ts` (`getCenterSettings` crea los valores por defecto; `updateCenterSettings` solo `OWNER`/`ADMIN`, rechaza cambiar la moneda si ya hay movimientos de dinero) y `/settings` con moneda, zona horaria (trasladada desde Mi taller), comisión y envío ML, luz, embalaje, costo por kilo y purga. *Pruebas:* unitarias de validación; reales de "un registro por taller" y "la moneda se bloquea con movimientos".

- [ ] **1.3b Lista de precios (D11).** `product-service.ts` y `product-queries.ts`: crear, editar, desactivar y buscar piezas con precio normal y precio ML. Pantalla `/products` simple (nombre, precio y precio ML, alta en una línea). *Pruebas:* unitarias, fronteras y aislamiento entre talleres.

- [ ] **1.4 Clientes (opcionales, D7).** `customer-service.ts` (crear, editar, desactivar y reactivar) y `customer-queries.ts` (búsqueda sin acentos, ficha con sus ventas y saldo). Pantallas `/clients` y `/clients/[id]`; el alta normal ocurre al vuelo desde la venta. *Pruebas:* unitarias, fronteras y aislamiento entre talleres.

- [ ] **1.5 Crear pedidos.** **Incluye D4 (casilla Mercado Libre que cambia a precios ML y calcula comisión, envío y neto), D7 (sin cliente por defecto) y D12 (venta rápida que queda entregada y cobrada en un paso, o pedido por encargo).** `order-operation.ts` (`resolveNewOrderOperation`, como `new-purchase-operation`) y `order-service.createOrder`: valida con Zod, crea el cliente al vuelo si corresponde, bloquea el `Center`, asigna el número, calcula el total, sugiere la comisión ML y registra el evento `CREATED`. Pantalla `/orders/new`: cliente existente o nuevo, canal, piezas (descripción, cantidad, precio, colores y material), descuento, fecha de entrega, campos ML y resumen en vivo (total, neto ML); con borrador local (`FormDraft`) y cerrojo contra doble envío. *Pruebas reales:* el mismo `operationId` dos veces crea un solo pedido; dos pedidos simultáneos reciben números distintos y consecutivos.

- [ ] **1.6 Listado, ficha y estados.** `order-queries.ts` (filtros por estado y canal, atrasados primero, búsqueda por número o cliente) y `order-service.changeOrderStatus(orderId, expectedVersion, to)`: `FOR UPDATE`, compara la versión, valida la transición, incrementa la versión, fija `deliveredAt` y escribe `OrderEvent`. Pantallas `/orders` (lista en tarjetas en celular y tabla en computador) y `/orders/[id]` (piezas, totales, neto ML, cobros, saldo, historial de estados y botones de avance). *Pruebas reales (concurrencia, AGENTS.md):* dos cambios con la misma versión → gana uno y queda exactamente un evento. Se describe la intercalación y se observa el fallo antes de corregir.

- [ ] **1.7 Cobros y devoluciones.** `order-service.registerPayment` (idempotente por `operationId`; sugiere el saldo o el neto ML), `voidMoneyTransaction` (D5) y `returnOrder` (D6). *Pruebas reales:* pago repetido no se duplica; la devolución es atómica (si falla el gasto, el pedido no cambia de estado); anular dos veces se rechaza.

- [ ] **1.8 Dinero.** `money-service.ts` (ingresos sueltos como `DIGITAL_SALE`/`OTHER_INCOME` y gastos por categoría; solo `OWNER`/`ADMIN`) y `money-queries.ts` (mes en la zona del taller). Pantalla `/money`: selector de mes, ingresos, gastos y ganancia, por canal y por categoría, lista de movimientos con anulación y alta rápida de gasto o ingreso. *Pruebas:* unitarias del resumen (incluye anulados) y una real de que el mes respeta `America/Santiago` en los bordes del día.

- [ ] **1.9 Navegación, inicio y datos demo.**
  - Menú: **Inicio, Pedidos, Clientes y Dinero**, con Ajustes y Mi taller en "Más" en el celular. Dinero solo para `OWNER`/`ADMIN`.
  - Inicio provisional con "Nuevo pedido", "Registrar gasto", pedidos atrasados y por entregar.
  - `npm run local:demo` (solo en `saas3d-local`, con la guarda local): crea "Taller QA" con clientes y pedidos en todos los estados, uno de ML de $8.990 con neto $6.483, cobros, una devolución, gastos de filamento y una venta de archivo de Cults.

- [ ] **1.10 Cierre.** `npm run quality:gate` en verde, revisión de seguridad (permisos por rol en servicios y páginas, sin dinero para `PROFESSIONAL`/`VIEWER`), revisión en el navegador a 390 px y en computador con el panel visible, y entrada fechada en onyx.md.

#### Orden y puntos de aprobación

1.0 → **1.1 (aprobación de la migración)** → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8 → 1.9 → 1.10. Cada tarea termina con sus pruebas en verde y su propio commit. Las tareas de 1.5 a 1.7 tocan concurrencia y siguen el procedimiento de AGENTS.md (describir la intercalación, prueba real, observar el fallo, corregir y volver a probar).

#### Fuera de esta fase

Catálogo de piezas, cotizador, bobinas y stock (Fase 2); panel del mes (Fase 3); API de Mercado Libre, cobro de suscripción y pantalla de equipo visible.

### 18.3 Fases siguientes

- **Fase 2:** catálogo de piezas, cotizador (crea pedidos `QUOTED`), bobinas y movimientos de stock y filamento.
- **Fase 3:** panel del mes (ingresos, gastos, ganancia, canales, pendientes, atrasados y alertas).
- **Fase 4:** uso real por Surko durante 2 a 4 semanas, con correcciones.
- **Fase 5:** beta con 5 a 10 makers y entrevistas.
- **Fase 6:** según lo que pida la beta: API de ML, cobro, equipo y calculadora pública.
