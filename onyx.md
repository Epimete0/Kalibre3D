# Onyx: Contexto Vivo del SaaS para makers 3D

> Nombre comercial oficial: **Kalibre** (repositorio: `Kalibre3D`). Identificador técnico interno: `saas3d` (paquete, carpeta y proyectos de Supabase/Vercel). Igual que en Kurova con `nexo`, el identificador técnico se conserva sin cambios.
>
> Este documento es la fuente principal de verdad del producto: qué se quiere hacer, cómo se construye, qué problemas aparecieron y qué se decidió. Arriba van las entradas fechadas de cada iteración (la más reciente primero). Abajo, las secciones estables numeradas. Ver la sección 17 para saber cómo actualizarlo.

---

## Quality gate completo con PostgreSQL real e idempotencia de cobros y devoluciones — 2026-11-08

- **Primera ejecución completa del quality gate tras el despliegue:** fallaba la prueba real `tests/orders-payments-returns.integration.test.ts` (devolución atómica D6). Causa: el commit `bd4497d` agregó en `returnOrder` una revalidación de idempotencia que aceptaba **cualquier** `MoneyTransaction` con el mismo `operationId` (por ejemplo, un cobro) y respondía como si la devolución se hubiera hecho, sin cambiar el pedido.
- **Corrección (`src/lib/order-service.ts`):** `assertSameMoneyOperation` exige que el movimiento existente sea del mismo tipo, categoría y pedido (`EXPENSE/REFUNDS` para devoluciones, `INCOME/ORDER_PAYMENT` para cobros). Si no, se rechaza con `Esta operación ya se usó para otro movimiento. Recarga la página e intenta nuevamente.` Se aplicó también a `registerPayment`, que devolvía el movimiento de otro pedido si se reutilizaba un `operationId`.
- **Pruebas:** la prueba real D6 ahora verifica además que reintentar la misma devolución devuelve el mismo `transactionId` sin duplicar el gasto, y que ese `operationId` no se puede reutilizar como cobro; prueba unitaria nueva para `registerPayment` con `operationId` de otro pedido.
- **Resultado:** `npm run quality:gate` PASSED (332 unitarias, 13 RLS, 3 S1, 1 S3 y 55 de transacciones contra PostgreSQL real).
- **`.env` con BOM:** el archivo tenía un BOM UTF-8 que impedía a la CLI de Supabase leer la configuración y hacía que el gate creyera que Docker no estaba disponible. Se quitó el BOM sin cambiar ningún valor. Guardar `.env` siempre como UTF-8 **sin** BOM.
- **Certificado TLS en producción:** `SUPABASE_DB_CA_CERT` cargada en Vercel (Production) y redespliegue `dpl_9kyHQ2qMyYynG6iE2uLeUhf8K5q3`; el panel de Surko carga datos reales, así que la conexión ya verifica el certificado de Supabase (cadena hasta `Supabase Root 2021 CA`). Queda cerrado el pendiente de la entrada anterior.

---

## Corrección de la landing: ejemplo de costeo y desborde en celular — 2026-11-08

- **Ejemplo de costeo del Pedido #42 (`src/app/page.tsx`):** el texto mostraba "Filamento + Purga (64 g) $750", que en realidad eran solo los 50 g de pieza sin purga. Con `computePieceCost` (64 g × $15/g) el filamento cuesta **$960**, el costo total **$1.105**, la ganancia en venta directa **+$5.395** y en Mercado Libre **+$5.378** (antes $895, +$5.605 y +$5.588).
- **Prueba nueva `src/lib/landing-example.test.ts`:** recalcula el ejemplo con `computePieceCost` y `mercadoLibreNet` y exige que la landing contenga esas cifras, para que el marketing no se descuadre del cotizador.
- **Desborde horizontal del hero en celular (375 px):** la columna de la ficha "Pedido #42" ensanchaba la grilla de una columna (`1fr` = `minmax(auto, 1fr)`) y cortaba el párrafo principal. Se fijó `grid-cols-1` y `[&>*]:min-w-0` en la grilla del hero y en la escala de datos clave. Verificado en el navegador a 375 px (ningún elemento sobrepasa el ancho) y en escritorio.
- **Pendiente del lado del dueño (sin cambio de código):** cargar `SUPABASE_DB_CA_CERT` en Vercel para que `createPostgresTlsConfig` vuelva a verificar el certificado de Supabase (hoy, con `sslmode=require` y sin CA, usa `rejectUnauthorized: false`).
- Las pruebas reales de RLS y transacciones no se ejecutaron en esta revisión (Docker Desktop apagado); el cambio no toca datos, RLS ni autenticación.

---

## Despliegue en vivo (`kalibre3d.vercel.app`), Conexión Supabase/Vercel y Pulido Responsivo — 2026-11-08

- **Despliegue en producción y variables de entorno de la integración Vercel ↔ Supabase:**
  - `src/lib/prisma.ts`: soporte para `DATABASE_URL ?? POSTGRES_PRISMA_URL ?? POSTGRES_URL`.
  - `src/lib/supabase/client.ts` y `src/lib/supabase/server.ts`: soporte para `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - `src/lib/postgres-tls.ts`: compatibilidad con `sslmode=require` (formato inyectado por la integración oficial de Supabase en Vercel) cuando no se define `SUPABASE_DB_CA_CERT`, conservando verificación estricta cuando se provee certificado CA o `verify-full`.
  - Se aplicaron las 4 migraciones iniciales en el proyecto Supabase de producción (`umgxxtpekcjknhclojzo`) mediante `scripts/production/20261108-02-apply-initial-schema.sql`, quedando activo el primer taller real (**Surko**).
- **Experiencia de registro y autenticación (`AuthForm.tsx`, `PasswordForms.tsx`, `CreateCenterForm.tsx`):**
  - Botón interactivo para mostrar/ocultar contraseña (`aria-label` y `aria-pressed`) en inicio de sesión, registro y cambio/restablecimiento de contraseña.
  - Aclaración explícita en el campo `"Tu nombre"` (`"Tu nombre y apellido personal. El nombre de tu taller lo configurarás en el siguiente paso."`) y ejemplo `"Ej: Taller Fusión 3D"` al crear el taller.
- **Auditoría y corrección responsiva y de temas (`dashboard`, `quote`, `spools`, `products`, `orders/new`, `ui.tsx`):**
  - `/dashboard`: se rediseñaron las 4 tarjetas de carga operativa (`Cotizado`, `Confirmado`, `Imprimiendo`, `Listo`) en `grid-cols-2 lg:grid-cols-4` eliminando la duplicación lateral texto+badge que desbordaba en pantallas intermedias, y se ajustaron las tarjetas financieras mensuales a `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`.
  - `/quote` (`QuoteCalculator.tsx` y `quote/page.tsx`): se reemplazaron todas las clases oscuras fijas (`zinc-*`) por tokens semánticos del tema (`text-ink`, `text-muted`, `bg-raised`, `border-line`, `bg-primary-soft`) para garantizar contraste completo tanto en modo claro como oscuro.
  - `/spools` (`spools/page.tsx` y `spools/[id]/page.tsx`) y `globals.css`: se normalizaron los tokens de borde y texto activo en filtros y se añadieron alias semánticos en `@theme`.
  - `/products` (`ProductControls.tsx`): se corrigió la grilla de creación rápida (`sm:grid-cols-2 lg:grid-cols-12` con `lg:col-span-2` para el botón `"Agregar"`) y el desplazamiento horizontal limpio de la tabla en móvil.
  - `/orders/new` (`NewOrderForm.tsx`): la barra inferior de cobro pasó a ser `sticky bottom-20 lg:bottom-4` dentro del formulario para no superponerse con `MobileNav` ni con `Sidebar`.
  - `src/components/ui.tsx` y `src/components/MobileNav.tsx`: se reemplazó el color heredado `#8a6d24` del `Badge` `accent` por `text-accent` y se limpiaron las sombras vino/rosa residuales.

- **Auditoría de seguridad y remediación (`docs/security/2026-11-08-auditoria-y-consideraciones-seguridad.md`):**
  - `[VULN-001]` Eliminación de lectura de `headers().get("origin")` en `src/app/login/actions.ts` y resolución estricta de `siteUrl()` (`src/lib/site-url.ts`) desde variables controladas por el servidor (`NEXT_PUBLIC_SITE_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL` o `localhost:3000` fuera de producción).
  - `[VULN-002]` Soporte de `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `src/proxy.ts` y `src/lib/auth-settings.ts`.
  - `[VULN-003]` Cookie `saas3d-center-id` centralizada con `CENTER_COOKIE_OPTIONS` (`secure: process.env.NODE_ENV === "production"`, `httpOnly: true`, `sameSite: "lax"`).
  - `[DEF-001]` Encabezados globales de seguridad HTTP en `next.config.ts` (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

---

## Definición de marca comercial: Kalibre (Kalibre3D) y Paquetes SQL de Producción — 2026-11-08

- **Investigación de nombres y verificación de colisiones:** Se verificaron múltiples opciones vía búsqueda web descartando colisiones reales en herramientas 3D (`Trama 3D`, `Estratos 3D`, `Brami3D`, `Infill: 3D Print Cost Calc`, etc.).
- **Decisión de marca aprobada:** **Kalibre** (con K).
  - Hace referencia a la herramienta de medición más representativa de los makers (calibre / pie de rey).
  - La "K" diferencia la marca del software de libros electrónicos (*Calibre*) y le otorga un carácter SaaS moderno, técnico y ágil.
- **Unificación de interfaz, identidad visual propia y Landing Page de Kalibre:**
  - Se reemplazó por completo la paleta provisional heredada de Kurova en `src/app/globals.css` y `src/app/layout.tsx` por el sistema de diseño técnico de **Kalibre**: tipografías `Space Grotesk` (display geométrica), `Hanken Grotesk` (interfaz) y `JetBrains Mono` (lecturas de gramos, milímetros y montos); paleta clara en aluminio anodizado (`#f3f5f7`), primario en naranja cobre de boquilla térmica (`#d9531e`), acento azul cian de calibración láser (`#0284c7`) y modo oscuro inspirado en cama PEI de carbono (`#0b0f17`) con retícula milimétrica.
  - Se construyó desde cero la **Landing Page de Kalibre (`src/app/page.tsx`)** con el instrumento en vivo del Pedido #42 (Emblema 13×9 PETG, 50 g + 14 g purga, desglose real de Mercado Libre $8.990 → neto $6.483 → ganancia +$5.378 y alerta de bobina baja), los 4 módulos operativos (`#pilares`), la comparativa Venta Directa vs. Mercado Libre (`#cotizador-real`) y el flujo de 3 pasos (`#flujo`).
  - Se rediseñó **`src/components/AuthLayout.tsx`** (acceso a `/login`, `/registro`, `/forgot-password`, `/taller/nuevo`) con un panel técnico de cama PEI con escala vernier milimétrica y telemetría de taller 3D, eliminando por completo los textos e identidad de Kurova.
  - Se actualizó el isotipo en `PublicShell.tsx` y `Sidebar.tsx` con un icono geométrico de calibre/boquilla y etiqueta `3D`.
- Se preserva `saas3d` como identificador técnico en base de datos, carpetas y configuración según el contrato de `AGENTS.md`.
- Se creó `README.md` completo para el repositorio en GitHub `https://github.com/Epimete0/Kalibre3D`.
- **Preparación de Supabase y Vercel (`scripts/production/` y `.env`):**
  - Se normalizó `.env` (ignorado por Git) para el proyecto de Supabase `umgxxtpekcjknhclojzo`: mapeo a `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, eliminación de `SUPABASE_SECRET_KEY`, y plantillas de `DATABASE_URL` (`:6543?pgbouncer=true`), `DIRECT_URL` (`:5432?sslmode=verify-full`) y `SUPABASE_DB_CA_CERT`.
  - Se creó el generador determinista `scripts/production/generate-20261108-initial-packages.mjs` y los 4 paquetes SQL para inicializar la base de Supabase en producción (`20261108-00-preflight-initial-schema.sql`, `20261108-01-dry-run-initial-schema.sql`, `20261108-02-apply-initial-schema.sql`, `20261108-03-verify-initial-schema.sql` y `20261108-manifest.json`), probados con `scripts/production/package-20261108.test.ts` (5/5) y ejecutados contra PostgreSQL real.
  - Se documentó el procedimiento paso a paso en `docs/runbooks/2026-11-08-despliegue-supabase-vercel.md`.

---

## ▶ Traspaso para continuar (otro agente, p. ej. Gemini en Antigravity) — 2026-11-08

**Estado:** Fase 0 cerrada (quality gate PASSED). Fase 1 cerrada (quality gate PASSED). Fase 2 cerrada (quality gate PASSED). **Fase 3 cerrada (3.1 a 3.3 hechas, quality gate PASSED — MVP Fases 0 a 3 completo)** — ver las entradas fechadas abajo y las casillas en la sección 18. **Siguiente: Fase 4 (Uso real por Surko durante 2 a 4 semanas, con correcciones, sección 18.5).**

**Reglas que NO se negocian:**
1. **KurovaV2 (`../KurovaV2`) es SOLO LECTURA** (está en producción con usuarios). Se puede leer y copiar desde ella; jamás escribir, instalar, migrar, hacer git ni levantar o detener sus contenedores `*_kurova-local`.
2. Seguir `AGENTS.md` (forma de trabajo de 12 pasos). Pedir aprobación antes de cambios de RLS, autenticación, datos o concurrencia. Toda función exportada de un servicio abre con `requireAuthContext`/`requireOperationalContext`/`requireCatalogContext`; las Server Actions no importan Prisma (lo verifica `src/lib/auth-boundaries.test.ts`).
3. **Nada en la nube** sin aprobación explícita. `.env` (nube) no se toca; el desarrollo usa `.env.local` (local).
4. Mensajes visibles en español (Taller, Dueño, Ayudante) y convención de mensajes de `AGENTS.md`. Montos enteros en unidad mínima (`src/lib/money-format.ts`).
5. Al terminar cada tarea: pruebas en verde, commit propio, casilla marcada en 18 y entrada fechada aquí arriba (sección 17).

**Cómo retomar:**
- `npx supabase start` (instancia de pruebas `saas3d-test`, puertos 5445x) y `npm run dev:db` + `npm run dev:migrate` + `npm run local:demo` (desarrollo `saas3d-local`, 5444x, con el taller "Taller QA").
- App: `npx next dev --webpack -p 3100`. Cuenta QA local en `.env.qa.local` (`qa-local@saas3d.local`, creada o actualizada por `npm run local:demo`).
- Verificación: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run test:transactions`, `npm run test:rls` y, al cerrar, `npm run quality:gate`.

---

## Fase 3 cerrada — Panel operativo y financiero del mes con alertas (tareas 3.1 a 3.3), 2026-11-08

- **Consultas agregadas del panel (`src/lib/dashboard-queries.ts` y `src/lib/dashboard-queries.test.ts`, tarea 3.1):**
  - `getDashboardOverview({ month })`: abre con `requireAuthContext()` y filtra datos según el rol del integrante:
    - `OWNER` y `ADMIN`: reciben `moneyView` (`getMonthlyMoneyView({ month })`), `pendingReceivableTotal` (suma de saldos pendientes de pedidos activos), conteo por etapas (`QUOTED`, `CONFIRMED`, `PRINTING`, `READY`), pedidos atrasados y próximos, y alertas de bobinas bajas (`lowSpools`) y piezas con stock bajo (`lowStockProducts`).
    - `PROFESSIONAL`: recibe carga operativa por etapas, pedidos atrasados/próximos y alertas de bobinas y stock, con `moneyView: null` y `pendingReceivableTotal: null`.
    - `VIEWER`: recibe carga operativa y pedidos sin invocar consultas de dinero ni configuraciones restringidas.
  - Pruebas unitarias en `src/lib/dashboard-queries.test.ts` (3/3).
- **Interfaz del Panel del Mes (`src/app/(private)/dashboard/page.tsx`, tarea 3.2):**
  - Banda superior de **Alertas del taller** con tarjetas para **Pedidos atrasados**, **Bobinas por acabarse** (con enlaces a `/spools/[id]` y `/spools?onlyLow=1`) y **Piezas con stock bajo** (con enlaces a `/products/[id]` y `/products`).
  - Tarjetas táctiles de **Carga operativa por etapa** (`Cotizados`, `Confirmados`, `Imprimiendo`, `Listos`) enlazadas a `/orders?status=...`.
  - **Resumen financiero del mes** (`OWNER`/`ADMIN`) con selector táctil de mes (`←` / `→` vía `?month=AAAA-MM`), 4 indicadores (**Ingresos**, **Gastos**, **Ganancia neta** y **Por cobrar en pedidos activos**) y barras proporcionales de **Ingresos por canal** y **Gastos por categoría**.
- **Quality gate (`npm run quality:gate`, tarea 3.3) → PASSED:**
  - Unitarias: **323/323** (51 archivos).
  - Lint y tipos: 0 errores.
  - Build de producción Next.js 16: exitoso.
  - Integración real PostgreSQL: `test:rls` **13/13**, `test:s1` **3/3**, `test:s3` **1/1**, `test:transactions` **55/55** (12 suites).

---

## Fase 2 cerrada — Catálogo de piezas, Cotizador, Bobinas y Movimientos de Stock (tareas 2.1 a 2.6), 2026-11-08

- **Migración `20261109000000_phase2_catalog_spools_stock` (tarea 2.1):**
  - Ampliación de `Product` con `category`, `material` (`PLA`, `PETG`, `ASA`, `ABS`, `TPU`, `OTHER`), `grams`, `printMinutes`, `colorsCount` (`1..16`), `purgeGrams`, `currentStock` (`>= 0`) y `minStock` (`>= 0`).
  - Nuevas tablas `ProductMovement`, `Spool` y `SpoolMovement` (`SERVER_ONLY`, RLS habilitado con 0 políticas y `REVOKE ALL` a `PUBLIC, anon, authenticated`).
  - Claves foráneas compuestas `(centerId, productId)`, `(centerId, spoolId)`, `(centerId, orderId)` y `(centerId, actorUserId) → CenterMember`.
  - Triggers de integridad: `guard_product_movement()` (bloquea `UPDATE` y `DELETE` directos sobre `ProductMovement`), `guard_product_delete()` (permite borrar un `Product` solo si no tiene `OrderItem`s ni `ProductMovement`s con `kind <> 'INITIAL'`, limpiando los `INITIAL` en cascada interna), `guard_immutable_row()` en `SpoolMovement` y `guard_spool_delete()` en `Spool` (impide el borrado físico de bobinas).
- **Reglas puras de costeo y presentación (`src/lib/costing.ts` y `src/lib/catalog-presentation.ts`, tarea 2.2):**
  - `computeMaterialCostPerGram(spools, material, defaultCostPerKg)`: calcula el promedio ponderado (`Σ pricePaid / Σ totalGrams`) de las bobinas activas de ese material en el taller, o `defaultCostPerKg / 1000` si no hay bobinas activas de ese material (D18).
  - `suggestMlPriceForTargetNet({ targetNet, commissionPct, sellerShippingCost })`: calcula el precio entero a publicar en Mercado Libre para conservar el neto objetivo tras la comisión redondeada y el envío a cargo del vendedor.
  - Etiquetas y constantes cerradas `MATERIALS`, `MATERIAL_LABEL`, `PRODUCT_MOVEMENT_KINDS`, `PRODUCT_MOVEMENT_LABEL`, `SPOOL_MOVEMENT_KINDS` y `SPOOL_MOVEMENT_LABEL`.
- **Bobinas y movimientos de filamento (`/spools`, `/spools/[id]`, `src/lib/spool-service.ts`, `src/lib/spool-queries.ts`, tarea 2.3):**
  - `createSpool`, `updateSpool`, `setSpoolActive` (`requireCatalogContext`) y `recordSpoolMovement` (`requireOperationalContext`).
  - Al dar de alta una bobina con `pricePaid > 0`, opción de registrar en la misma transacción el gasto `FILAMENT` en `MoneyTransaction`.
  - `recordSpoolMovement` bloquea la fila de `Spool` con `SELECT ... FOR UPDATE`, verifica idempotencia por `(centerId, operationId)` y garantiza que `remainingGrams` nunca quede negativo.
  - Procedimiento de concurrencia `AGENTS.md` cumplido en `tests/spools.integration.test.ts`: se observó el fallo sin `FOR UPDATE` ante consumos simultáneos sobre una bobina y se verificó en verde tras aplicar el bloqueo.
- **Catálogo técnico de piezas y movimientos de stock (`/products`, `/products/[id]`, `src/lib/product-service.ts`, `src/lib/product-queries.ts`, tarea 2.4):**
  - `createProduct` y `updateProduct` con especificaciones técnicas completas y stock inicial opcional (generando `ProductMovement` `INITIAL`).
  - `recordProductMovement` (`ENTRY`, `EXIT`, `ADJUST`) con `SELECT ... FOR UPDATE` e idempotencia por `(centerId, operationId)`.
  - Procedimiento de concurrencia `AGENTS.md` cumplido en `tests/products.integration.test.ts`: tres salidas simultáneas de 6 unidades sobre stock 10 permiten exactamente una (quedando 4) y rechazan las otras dos con `DomainError`.
  - Cálculo en vivo de costo de fabricación y margen directo y en Mercado Libre (ocultos para `VIEWER`).
- **Cotizador interactivo (`/quote`, `QuoteCalculator.tsx`, `actions.ts`, tarea 2.5):**
  - Calculadora móvil y de escritorio con selección de material (usando el `costPerGram` real del taller), peso, tiempo, colores/purga, embalaje y margen objetivo.
  - Acciones en un toque para **Crear pedido cotizado (`QUOTED`)** (redirigiendo a `/orders/[id]`) o **Guardar como pieza en el catálogo**.
- **Navegación, semilla demo y quality gate (tarea 2.6):**
  - Enlaces a **Cotizador** (`/quote`), **Catálogo de piezas** (`/products`) y **Bobinas** (`/spools`) en `Sidebar.tsx` y `MobileNav.tsx`, más botón rápido `Cotizar pieza` en `/dashboard`.
  - `npm run local:demo` actualiza `"Taller QA"` con especificaciones técnicas, stock inicial y 4 bobinas PETG (incluyendo 1 bobina con `120 g <= 150 g` en alerta de poca bobina).
  - **Quality gate (`npm run quality:gate`) → PASSED:** 320/320 pruebas unitarias (50 archivos), 0 errores de lint, build de producción Next.js 16 exitoso, 4 migraciones aplicadas, `test:rls` 13/13, `test:s1` 3/3, `test:s3` 1/1 y `test:transactions` 55/55 (12 suites).

---

## Fase 1 cerrada — Navegación, inicio, datos demo y quality gate (tareas 1.9 y 1.10), 2026-11-08

- **Navegación (`src/components/Sidebar.tsx` y `src/components/MobileNav.tsx`):**
  - En computador (`Sidebar`): Inicio (`/dashboard`), Pedidos (`/orders`), Clientes (`/clients`), Dinero (`/money`, solo `OWNER`/`ADMIN`), Lista de piezas (`/products`, solo `OWNER`/`ADMIN`), Ajustes (`/settings`, solo `OWNER`/`ADMIN`) y Mi taller (`/profile`).
  - En celular (`MobileNav`): barra fija inferior con **Inicio, Pedidos, Clientes, Dinero** (solo `OWNER`/`ADMIN`) y botón **Más** que despliega un cajón táctil con Lista de piezas, Ajustes del taller y Mi taller.
- **Inicio operativo (`src/app/(private)/dashboard/page.tsx`):**
  - Conserva el flujo de bienvenida sin taller (`getSessionMembershipState` → Crear mi taller / Tengo un código de invitación).
  - Con taller activo: accesos rápidos táctiles (`+ Nueva venta`, `+ Registrar gasto`, `Ver pedidos`), tarjetas del mes en curso (Ingresos, Gastos y Ganancia neta, visibles solo para `OWNER`/`ADMIN`), bloque prioritario de **Pedidos atrasados** y listado de **Por fabricar / entregar** con enlace directo a cada ficha.
- **Datos demo locales (`scripts/seed-local-demo.ts` y `npm run local:demo`):**
  - Protegido por `assertLocalDevelopmentDatabaseConfig` (solo acepta loopback `saas3d-local` en 5444x, jamás nube).
  - Crea o actualiza la cuenta `qa-local@saas3d.local` y el taller **"Taller QA"** (`America/Santiago`, `CLP`) con:
    - 4 piezas en la lista de precios (Emblema Toyota 13x9 cm con precio ML $8.990, Emblema Hilux Negro Mate, Letras Tacoma Parrilla y Llavero Personalizado 3D).
    - 4 clientes de prueba con WhatsApp e Instagram.
    - 7 pedidos en todos los estados (`QUOTED`, `CONFIRMED` atrasado, `PRINTING`, `READY`, `DELIVERED` de Mercado Libre a $8.990 con comisión $1.708, envío $799 y neto **$6.483**, `RETURNED` con reembolso y `CANCELED`), con sus `OrderEvent`s y cobros.
    - Gasto manual de filamento PETG ($30.000) y venta de archivo STL en Cults3D (`DIGITAL_SALE`, $7.500).
- **Revisión de seguridad de la Fase 1 (tarea 1.10):**
  - Las 7 tablas nuevas (`CenterSettings`, `Product`, `Customer`, `Order`, `OrderItem`, `OrderEvent`, `MoneyTransaction`) son `SERVER_ONLY` (RLS habilitado, 0 políticas, sin privilegios para `anon` ni `authenticated`, verificado en `tests/rls.integration.test.ts` 13/13).
  - Toda función exportada de `center-settings-service.ts`, `product-service.ts`, `customer-service.ts`, `order-service.ts` y `money-service.ts` abre con `requireCatalogContext` o `requireOperationalContext` (verificado por `src/lib/auth-boundaries.test.ts`).
  - Ninguna `actions.ts` importa Prisma.
  - Permisos por rol (D1): `money-service`, `money-queries`, `registerPayment`, `voidMoneyTransaction`, `returnOrder`, `product-service` y `center-settings-service` exigen `OWNER`/`ADMIN` (`requireCatalogContext`). `VIEWER` no puede mutar y recibe montos enmascarados en consultas de clientes y pedidos; `/money`, `/products` y `/settings` renderizan `<NoPermission />` para `PROFESSIONAL` y `VIEWER`.
  - Concurrencia e integridad probadas contra PostgreSQL real (`tests/phase1-integrity.integration.test.ts`, `tests/orders-creation.integration.test.ts`, `tests/orders-status.integration.test.ts`, `tests/orders-payments-returns.integration.test.ts`, `tests/money.integration.test.ts`).
- **Quality gate (`npm run quality:gate`) → PASSED:**
  - Unitarias: **311/311** (48 archivos).
  - Lint: 0 errores, 0 advertencias.
  - Build de producción Next.js 16: exitoso (todas las rutas de Fase 0 y Fase 1).
  - Migraciones: 3 migraciones aplicadas, esquema al día.
  - Integración real PostgreSQL: `test:rls` **13/13**, `test:s1` **3/3**, `test:s3` **1/1**, `test:transactions` **48/48** (10 suites).

## Fase 1 — Dinero (tarea 1.8), 2026-11-08

- **Servicio y consultas (`src/lib/money-service.ts` y `src/lib/money-queries.ts`):**
  - `recordManualMoneyTransaction`: requiere `requireCatalogContext` (`OWNER`/`ADMIN`, D1). Registra ingresos sueltos (`DIGITAL_SALE`, `OTHER_INCOME`) y gastos manuales por categoría (`FILAMENT`, `PARTS`, `SHIPPING`, `ADVERTISING`, `FEES`, `UNEXPECTED`, `OTHER_EXPENSE`) con idempotencia por `(centerId, operationId)` y fecha calculada en la zona horaria del taller (`todayInTimeZone`).
  - `voidManualMoneyTransaction`: delega a `voidMoneyTransaction` (D5) exigiendo `requireCatalogContext`.
  - `getMonthlyMoneyView`: requiere `requireCatalogContext`, calcula el mes actual o solicitado en la zona del taller (`currentMonth`, `monthDateRange`, `shiftMonth`), obtiene los movimientos del mes con su pedido asociado y calcula el resumen con `monthlySummary` (ingresos, gastos, ganancia, ingresos por canal y gastos por categoría excluyendo anulados).
- **Interfaz (`/money` y `MoneyControls.tsx`):**
  - Restringida a `OWNER`/`ADMIN` (`<NoPermission />` para otros roles).
  - Selector táctil de mes (`←` / `→`), tarjetas de Ingresos, Gastos y Ganancia neta, formularios rápidos para registrar gastos o ingresos sueltos, desglose por canal y por categoría, y listado de movimientos con enlace a `Pedido #N` y anulación en línea.
- **Pruebas:**
  - Unitarias en `money-service.test.ts` (5/5) y `money-queries.test.ts` (2/2). Total unitarias: 310/310.
  - Integración real contra PostgreSQL en `tests/money.integration.test.ts` (1/1): comprueba que un movimiento registrado el `2026-11-01T01:30:00Z` cae en `2026-10-31` (`2026-10`) según `America/Santiago` y que los movimientos anulados no suman en el resumen.

---

## Fase 1 — Cobros, anulaciones y devoluciones (tarea 1.7), 2026-11-08

- **Servicio y concurrencia (`src/lib/order-service.ts`):**
  - `registerPayment`: exclusivo para `OWNER`/`ADMIN` (`requireCatalogContext`, D1). Bloquea el pedido con `SELECT ... FOR UPDATE`, verifica que no esté cancelado y garantiza idempotencia por `(centerId, operationId)` antes y dentro de la transacción.
  - `voidMoneyTransaction`: exclusivo para `OWNER`/`ADMIN` (`requireCatalogContext`, D5). Bloquea el movimiento con `SELECT ... FOR UPDATE`, comprueba `voidedAt === null` y registra fecha, autor y motivo obligatorio (1–300 caracteres). Rechaza dobles anulaciones con `DomainError`.
  - `returnOrder`: exclusivo para `OWNER`/`ADMIN` (`requireCatalogContext`, D6). En una sola transacción bloquea el pedido con `FOR UPDATE`, valida `version === expectedVersion` y `status === 'DELIVERED'`, actualiza el pedido a `RETURNED` (`version + 1`) conservando `deliveredAt`, escribe el `OrderEvent` y registra el gasto `EXPENSE` `REFUNDS`.
  - Procedimiento de concurrencia `AGENTS.md` cumplido: se observó el fallo en PostgreSQL antes de aplicar las defensas y luego se verificó en verde.
- **Interfaz (`/orders/[id]` y `OrderMoneyControls.tsx`):**
  - Panel táctil para registrar cobros con sugerencia automática del saldo pendiente (o neto de Mercado Libre) y método según el canal.
  - Acción en línea para anular cobros con confirmación y motivo obligatorio.
  - Formulario de devolución y reembolso cuando el pedido está en `DELIVERED`.
- **Pruebas:**
  - Unitarias en `order-service.test.ts` (19/19). Total unitarias: 303/303.
  - Integración real contra PostgreSQL en `tests/orders-payments-returns.integration.test.ts` (3/3): cobro repetido en paralelo no se duplica, doble anulación simultánea o secuencial se rechaza con `DomainError`, y atomicidad de `returnOrder` (si falla el gasto, el pedido permanece en `DELIVERED`).
- **Resultados:** `quality:gate` PASSED (303 unitarias, 0 lint warnings, build exitoso, 13 RLS, 3 S1, 1 S3, 47 transacciones).

---

## Fase 1 — Listado, ficha y estados de pedidos (tarea 1.6), 2026-11-08

- **Servicio y concurrencia (`src/lib/order-service.ts`):**
  - `changeOrderStatus`: valida con Zod (`orderId`, `expectedVersion`, `to`), requiere `requireOperationalContext` (`OWNER`, `ADMIN`, `PROFESSIONAL`). Bloquea la fila con `SELECT ... FOR UPDATE`, compara `order.version === expectedVersion`, verifica `canTransition(currentStatus, to)`, incrementa `version` a `version + 1`, fija `deliveredAt` al pasar a `DELIVERED` y registra el `OrderEvent` inmutable en la misma transacción.
  - Procedimiento de concurrencia `AGENTS.md` cumplido: se describió la intercalación, se creó la prueba real en PostgreSQL, se observó el fallo sin `FOR UPDATE`, se aplicó la corrección y se verificó en verde.
- **Consultas (`src/lib/order-queries.ts`):**
  - `listOrders`: filtros por estado (`ALL`, `ACTIVE`, o estado específico), canal y búsqueda insensible a tildes por `#número`, nombre de cliente o descripción de pieza. Calcula `isOverdue` en la zona horaria del taller, `expectedReceivable` y `balance`, y ordena los pedidos **atrasados primero**. Enmascara montos para `VIEWER`.
  - `getOrderDetail`: obtiene la ficha completa del pedido con cliente, piezas, resumen financiero (incluyendo desglose de comisión, envío y neto real de Mercado Libre), cobros asociados e historial cronológico de `OrderEvent` con nombre del integrante (`Profile.displayName`).
- **Interfaz (`/orders` y `/orders/[id]`):**
  - `/orders`: buscador rápido, selector de canal y pestañas horizontales táctiles de estado; tarjetas móviles responsivas (390 px) con avance rápido en un toque y tabla en escritorio.
  - `/orders/[id]`: encabezado con estado, fecha comprometida y alerta de atraso, botones de avance de estado y cancelación con confirmación, accesos directos a WhatsApp e Instagram del cliente, desglose de piezas, resumen financiero con neto ML y línea de tiempo de eventos.
  - Números de pedido en `/clients/[id]` enlazados directamente a `/orders/[id]`.
- **Pruebas:**
  - Unitarias en `order-service.test.ts` (12/12) y `order-queries.test.ts` (6/6). Total unitarias: 296/296.
  - Integración real contra PostgreSQL en `tests/orders-status.integration.test.ts` (2/2): carrera simultánea con la misma versión donde gana exactamente uno y el otro rechaza con `DomainError`, y ciclo completo hasta `DELIVERED`.
- **Resultados:** `quality:gate` PASSED (296 unitarias, 0 lint warnings, build exitoso, 13 RLS, 3 S1, 1 S3, 44 transacciones).

---

## Fase 1 — Crear pedidos (tarea 1.5), 2026-11-08

- **Operación e Idempotencia (`src/lib/order-operation.ts`):**
  - `resolveNewOrderOperation`: genera `operationId` determinístico o único, preserva el borrador en caso de fallo y protege contra dobles envíos.
- **Servicio y consultas (`src/lib/order-service.ts` y `src/lib/order-queries.ts`):**
  - `createOrder`: valida con Zod (`CreateOrderInputSchema`), soporte de cliente opcional existente o al vuelo (`createNewCustomer`), asignación de consecutivo automático por taller bloqueando `Center` con `FOR UPDATE` (`UNIQUE (centerId, number)`), cálculo en servidor de total y neto de Mercado Libre, creación atómica de `Order`, `OrderItem`s y `OrderEvent` (`CREATED`).
  - Modalidades D12: `QUICK_SALE` queda automáticamente en `DELIVERED`, registra un `OrderEvent` adicional (`STATUS_CHANGED`), y si se especifica monto pagado, registra de inmediato la transacción de ingreso `MoneyTransaction` (`INCOME`, categoría `ORDER_PAYMENT`). `ORDER` queda en `QUOTED` o `CONFIRMED` y registra abono inicial opcional.
  - Mercado Libre (D4): calcula automáticamente la comisión con el porcentaje del taller y descuenta el envío acordado para el neto real.
  - `getOrderCreationDefaults`: obtiene la lista de productos activos y ajustes del taller (moneda, comisión ML y envío ML) para precargar el formulario.
- **Interfaz (`/orders/new` y navegación):**
  - Formulario adaptado a pantallas móviles (390 px): botones táctiles grandes (mínimo 44 px), selectores de canal en chips, alternancia entre Venta rápida y Pedido por encargo, selector de cliente con opción de alta al vuelo, selector de piezas de la lista o ingreso manual, control táctil de cantidad (`+`/`-`), fecha de entrega y resumen inferior pegajoso (*sticky*) con cálculo en vivo de total y neto de Mercado Libre.
  - Enlaces a `/orders` en `Sidebar.tsx` y `MobileNav.tsx`.
- **Pruebas:**
  - Unitarias en `order-operation.test.ts` (4/4), `order-service.test.ts` (6/6), `order-queries.test.ts` (2/2). Total suite unitaria: 286/286.
  - Integración real contra PostgreSQL en `tests/orders-creation.integration.test.ts` (2/2): dos pedidos simultáneos en hilos concurrentes obtienen números estrictamente consecutivos sin colisión, y un reintento con el mismo `operationId` no duplica el pedido ni sus ítems.
- **Resultados:** `quality:gate` PASSED (286 unitarias, 0 lint warnings, build exitoso, 13 RLS, 3 S1, 1 S3, 42 transacciones).

---

## Fase 1 — Clientes (tarea 1.4), 2026-11-08

- **Servicio y consultas (`src/lib/customer-service.ts` y `src/lib/customer-queries.ts`):**
  - `createCustomer`: valida con Zod (`name`, `phone`, `instagram`, `notes`), normaliza Instagram eliminando prefijos `@` y espacios, requiere `requireOperationalContext` (`OWNER`, `ADMIN`, `PROFESSIONAL`).
  - `updateCustomer`: actualiza datos de clientes garantizando filtro por `centerId`. Requiere `requireOperationalContext`.
  - `setCustomerActive`: activa o desactiva clientes manteniendo trazabilidad histórica.
  - `deleteCustomer`: requiere `requireCatalogContext` (`OWNER`/`ADMIN`). Valida conteo de pedidos (`order.count > 0` prohíbe el borrado físico: `DomainError("No se puede eliminar el cliente porque ya tiene pedidos registrados. Puedes desactivarlo para ocultarlo.")`). Si no tiene pedidos registrados, permite eliminación física `deleteMany`.
  - `normalizeSearchText`: función pura con descomposición Unicode NFD para eliminar tildes y diacríticos (`"García"` → `"garcia"`).
  - `listCustomers`: búsqueda insensible a tildes y mayúsculas por nombre, teléfono o Instagram; filtro por estado activo; cálculo de cantidad de pedidos, total comprado y saldo pendiente acumulado usando `orderTotals` / `orderBalance`. Enmascara montos de dinero para rol `VIEWER` (D1).
  - `getCustomerDetail`: ficha completa del cliente con lista de pedidos históricos, canal, estado, total, saldo y notas.
- **Interfaz (`/clients` y `/clients/[id]`):**
  - `/clients`: formulario desplegable para alta rápida de clientes, barra de búsqueda sin acentos en vivo, selector de activos/todos, tabla responsiva (tarjetas en móvil, tabla en escritorio) con enlaces directos a WhatsApp e Instagram, estado, saldo y acciones.
  - `/clients/[id]`: encabezado con accesos directos de contacto, métricas de pedidos, total comprado y saldo pendiente, notas, modal para edición de datos, alternancia de estado y eliminación controlada (solo si tiene 0 ventas). Tabla de historial de pedidos con estado, canal, total y saldo.
  - Server Actions en `src/app/(private)/clients/actions.ts` sin importaciones de Prisma.
  - Navegación: enlace a Clientes añadido en `Sidebar.tsx` y `MobileNav.tsx` accesible para todos los roles del taller.
  - Servicio registrado en `coreServices` de `auth-boundaries.test.ts`.
- **Pruebas:**
  - Unitarias en `customer-service.test.ts` (15/15) y `customer-queries.test.ts` (6/6).
  - Integración real contra PostgreSQL en `tests/customers.integration.test.ts` (2/2): aislamiento multi-taller, búsqueda sin acentos en base de datos real y bloqueo físico de eliminación si existen pedidos asociados.
- **Resultados:** Unitarias 274/274, RLS 13/13, S1 3/3, S3 1/1, transacciones 40/40. `quality:gate` PASSED.

---

## Fase 1 — Lista de precios mínima (tarea 1.3b), 2026-11-08

- **Servicio y consultas (`src/lib/product-service.ts` y `src/lib/product-queries.ts`):**
  - `createProduct`: valida con Zod (`name`, `salePrice >= 0`, `mlPrice >= 0` opcional). Valida `requireCatalogContext` (`OWNER`/`ADMIN`). Traduce el índice único `Product_centerId_name_key` mediante `unique-violation.ts` a `"Ya existe una pieza con ese nombre."`.
  - `updateProduct`: valida campos y actualiza pieza conservando aislamiento multi-taller.
  - `setProductActive`: activa o desactiva la pieza (`active = true / false`).
  - `deleteProduct`: defensas estrictas de trazabilidad del dominio y ciclo de vida. Si la pieza tiene ventas registradas (`orderItem.count > 0`), prohíbe el borrado físico (`DomainError("No se puede eliminar la pieza porque ya tiene pedidos registrados. Puedes desactivarla para ocultarla.")`). Si nunca fue utilizada en ningún pedido, permite el borrado físico (`deleteMany({ where: { centerId, id } })`).
  - `listProducts`: lista piezas activas o todas con ordenamiento alfabético insensible a mayúsculas.
  - `findProductById`: obtiene pieza asegurando filtro `centerId`.
- **Interfaz (`/products`):**
  - Pantalla `/products` (`page.tsx`) protegida para `OWNER` y `ADMIN` (`requireCatalogContext`).
  - Formulario en línea para creación rápida con selector de moneda configurada en el taller.
  - Tabla de piezas con edición rápida en línea, alternancia de estado activo/inactivo y botón para eliminar piezas que nunca fueron usadas.
  - Server Actions en `src/app/(private)/products/actions.ts` sin importaciones de Prisma.
  - Enlace agregado a la navegación en `Sidebar.tsx` y `MobileNav.tsx` visible para `OWNER`/`ADMIN`.
  - Servicio registrado en `coreServices` de `auth-boundaries.test.ts`.
- **Pruebas:**
  - Unitarias en `product-service.test.ts` (11/11) y `product-queries.test.ts` (3/3).
  - Integración real contra PostgreSQL en `tests/products.integration.test.ts` (2/2): aislamiento estricto de unicidad de nombres entre talleres y protección física contra eliminación de piezas con pedidos asociados.
- **Resultados:** Unitarias 253/253, RLS 13/13, S1 3/3, S3 1/1, transacciones 38/38. `quality:gate` PASSED.

---

## Fase 1 — Ajustes del taller (tarea 1.3), 2026-11-08

- **Ajustes y zona horaria (`src/lib/center-settings-service.ts` y `/settings`):**
  - `getCenterSettings`: recupera o crea con `upsert` los valores por defecto del taller (`CLP`, `19%` ML, etc.), la zona horaria del `Center` y determina `currencyLocked` si existe alguna transacción en `MoneyTransaction`.
  - `updateCenterSettings`: valida con Zod (`currency`, `timeZone`, montos enteros ≥ 0, comisión entre 0 y 100%), requiere `OWNER`/`ADMIN` (`requireCatalogContext`) y **bloquea el cambio de moneda si ya existen movimientos de dinero en el taller (D9)**. Actualiza `CenterSettings` y `Center.timeZone` en una sola transacción atómica.
  - Zona horaria trasladada: en `/profile` (`account-service.ts`) se conserva únicamente el nombre del taller. La zona horaria se administra centralizadamente en `/settings` (D8/D10).
  - Interfaz: pantalla `/settings` protegida para `OWNER`/`ADMIN`, formulario `SettingsForm.tsx` con moneda deshabilitada si está bloqueada, selectores organizados y Server Action en `src/app/(private)/settings/actions.ts` (`saveCenterSettingsAction` sin importar Prisma).
  - Navegación: acceso a Ajustes en `Sidebar.tsx` y `MobileNav.tsx` visible para `OWNER`/`ADMIN`.
  - Servicio registrado en `coreServices` de `auth-boundaries.test.ts`.
- **Pruebas:**
  - Unitarias en `center-settings-service.test.ts` (9/9).
  - Integración real contra PostgreSQL en `tests/center-settings.integration.test.ts` (2/2): un único registro por taller (`centerId` PK) y bloqueo físico de cambio de moneda ante movimientos de dinero.
- **Resultados:** Unitarias 239/239, RLS 13/13, S1 3/3, S3 1/1, transacciones 36/36. `quality:gate` PASSED.

---

## Fase 1 — Reglas puras (tarea 1.2), 2026-11-08

- **Módulos puros en `src/lib`, sin base de datos, con TDD (las pruebas se vieron en rojo antes de implementar):**
  - `costing.ts`: costo de pieza, purga multicolor, precio sugerido por margen, comisión ML sugerida y neto ML.
  - `order-status.ts`: estados, canales y tipos, transiciones y estados cerrados.
  - `order-totals.ts`: subtotal, total con descuento, monto esperado (neto en ML), saldo sin anulados, **precio ML de la lista (D4)** y atraso en la zona del taller.
  - `money-summary.ts`: resumen mensual por canal y categoría sin anulados, hoy y mes en la zona del taller, rango del mes y navegación entre meses.
  - `money-format.ts`: monedas de D9, decimales ISO (CLP/PYG 0, el resto 2), formato `Intl` y conversión de lo escrito a unidad mínima.
  - `order-presentation.ts` y `money-presentation.ts`: etiquetas en español; categorías manuales separadas de las que nacen de una venta.
- **Pruebas:** `costing.test.ts` (incluye el caso real .990 → .483), `order-status.test.ts`, `order-totals.test.ts` (incluye atraso con la frontera del día en Santiago), `money-summary.test.ts`, `money-format.test.ts` y `presentation.test.ts`. Esta última verifica que cada valor tenga su etiqueta y que los valores de TypeScript coincidan **literalmente** con los `CHECK` de la migración.
- **Resultados:** unitarias 230/230 (38 archivos), lint y tipos limpios.

## Fase 1 — Base de desarrollo y migración de ventas y dinero (tareas 1.0 y 1.1), 2026-11-08

- **1.0:** instancia de desarrollo `saas3d-local` (`supabase-local/`, 5444x) con `npm run dev:db` y `npm run dev:migrate` (`scripts/migrate-dev.ts`, solo loopback). `.env.local` apunta a ella. Verificado: un taller de `saas3d-local` sobrevive a las suites que reinician `saas3d-test`.
- **1.1, migración `20261108000000_phase1_orders_money` (aprobada y aplicada solo en las dos instancias locales):**
  - Tablas `CenterSettings`, `Product` (lista de precios mínima), `Customer`, `Order`, `OrderItem`, `OrderEvent` y `MoneyTransaction`. Todas `SERVER_ONLY` (RLS, 0 políticas, sin privilegios para la API).
  - Claves compuestas same-center y `CHECK` de enums, montos, número > 0, campos ML solo en el canal `MERCADOLIBRE` y `deliveredAt` presente exactamente en `DELIVERED`/`RETURNED`.
  - Únicos: `(centerId, number)`, `(centerId, operationId)` y nombre de producto por taller sin distinguir mayúsculas ni espacios.
  - Triggers: `centerId` inmutable, `OrderEvent` inmutable, `MoneyTransaction` sin borrado y con una sola anulación (fecha, autor y motivo), y `Order` sin borrado si tiene historial o dinero.
  - **Cambio respecto al modelo previo:** la casilla de Mercado Libre (D4) no es una columna `isMercadoLibre`: es el canal `MERCADOLIBRE`, para no tener dos datos que puedan contradecirse.
  - Ensayo previo en una transacción revertida (7 tablas, 0 políticas y 0 acceso de la API).
- **Error encontrado por las pruebas y corregido:** `MoneyTransaction_void_check` aceptaba anular sin motivo, porque `char_length(NULL) BETWEEN 1 AND 300` es NULL y PostgreSQL deja pasar un `CHECK` NULL. La prueba se observó en rojo y se corrigió con la migración **`20261108000100_fix_money_void_check`** (no se editó la ya aplicada). Se revisaron los demás `CHECK` de la migración: no tienen esta trampa.
- **Pruebas reales nuevas:** `tests/phase1-integrity.integration.test.ts` (9, en `test:transactions`) y un caso en `rls.integration.test.ts` (las 7 tablas son inaccesibles por la API para anon, OWNER, ADMIN, PROFESSIONAL y VIEWER).
- **Resultados:** `test:transactions` 34/34, `test:rls` 13/13, `test:s1` 3/3, `test:s3` 1/1.
- **Nada aplicado en la nube.**

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
- **Fase 1 (2026-11-08):**
  - Instancia de desarrollo independiente `saas3d-local` (5444x) y comando `npm run local:demo` con el taller "Taller QA".
  - Ajustes del taller (`/settings`): moneda configurable (bloqueada tras el primer movimiento de dinero), zona horaria, comisión y envío ML, electricidad, embalaje, costo por kilo y purga.
  - Lista de precios mínima (`/products`): piezas con precio normal y precio de Mercado Libre opcional.
  - Clientes (`/clients`, `/clients/[id]`): directorio con búsqueda sin tildes, alta rápida y ficha con historial y saldo.
  - Pedidos y ventas rápidas (`/orders`, `/orders/new`, `/orders/[id]`): numeración consecutiva automática por taller, modalidad venta rápida o pedido por encargo, casilla Mercado Libre con cálculo de comisión y neto real, control de concurrencia en estados (`FOR UPDATE` + `version`), cobros idempotentes, anulaciones con motivo y devoluciones atómicas.
  - Dinero (`/money`): resumen mensual en la zona horaria del taller, ingresos por canal, gastos por categoría y registro manual de gastos e ingresos sueltos.
  - Inicio operativo (`/dashboard`) y navegación móvil (`MobileNav` con cajón "Más") y de escritorio (`Sidebar`).
  - `npm run quality:gate` en verde (311 unitarias, 13 RLS, 3 S1, 1 S3, 48 transacciones).

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
| Inicio | `/dashboard` | Implementado (Fase 1): accesos rápidos, resumen mensual (`OWNER`/`ADMIN`), pedidos atrasados y por entregar. Fase 3: panel completo con alertas |
| Clientes | `/clients`, `/clients/[id]` | Implementado (Fase 1): lista con búsqueda sin tildes, alta rápida y ficha con saldo |
| Pedidos | `/orders`, `/orders/new`, `/orders/[id]` | Implementado (Fase 1): alta rápida, listado con filtros y atrasados, ficha y estados |
| Dinero | `/money` | Implementado (Fase 1): resumen mensual, ingresos/gastos manuales y anulación |
| Ajustes del taller | `/settings` | Implementado (Fase 1): moneda, zona horaria, comisión y envío ML, luz, embalaje, costo por kilo y purga |
| Catálogo y cotizador | `/products` (lista de precios mínima, Fase 1); `/products/new`, `/products/[id]`, `/quote` | Implementado `/products` (Fase 1); cotizador planificado (Fase 2) |
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

- [x] **1.1 Migración `20261108000000_phase1_orders_money`** (**requiere aprobación antes de aplicar**):
  - Tablas `CenterSettings`, `Customer`, `Order`, `OrderItem`, `OrderEvent` y `MoneyTransaction` (sección 5), más `Order.number` (D2), `voidedAt`/`voidedByUserId`/`voidReason` (D5) y `Customer.active`.
  - Integridad: `UNIQUE (centerId, id)` en las tablas padre; claves compuestas `(centerId, customerId)`, `(centerId, orderId)` y `(centerId, userId) → CenterMember` para autores; `CHECK` de enums, montos (`>= 0`; `amount > 0`), `qty > 0` y `colorsCount >= 1`; `UNIQUE (centerId, operationId)` en `Order` y `MoneyTransaction`; `UNIQUE (centerId, number)`.
  - Triggers: inmutabilidad de `centerId` en todas; `OrderEvent` inmutable (sin `UPDATE`/`DELETE`); `MoneyTransaction` sin `DELETE` y solo con `UPDATE` permitido para anular una vez; `Order` sin `DELETE` si tiene eventos o movimientos.
  - Seguridad: RLS activado, **0 políticas** y `REVOKE ALL` a `PUBLIC`/`anon`/`authenticated` en las 6 tablas (`SERVER_ONLY`).
  - *Pruebas reales nuevas* (`tests/phase1-integrity.integration.test.ts`, en `test:transactions`): la base rechaza mezclar talleres (cliente o pedido de otro taller), modificar eventos, borrar movimientos, anular dos veces y cambiar `centerId`. En `rls.integration.test.ts`: las 6 tablas son inaccesibles por la API para todos los roles.

- [x] **1.2 Reglas puras (TDD, sin base de datos)** en `src/lib`:
  - `costing.ts`: `computePieceCost`, `suggestPrice`, `mercadoLibreNet` (caso obligatorio: $8.990 con 19% y $799 deja $6.483).
  - `order-status.ts`: transiciones de la sección 6; `canTransition` y `nextStatuses`.
  - `order-totals.ts`: total, monto esperado (directo o neto ML), saldo e "isOverdue" en la zona del taller.
  - `money-summary.ts`: resumen del mes (ingresos, gastos, ganancia, por canal y por categoría), excluyendo lo anulado.
  - `order-presentation.ts` y `money-presentation.ts`: etiquetas en español de canales, estados, categorías y métodos.

- [x] **1.3 Ajustes del taller.** `center-settings-service.ts` (`getCenterSettings` crea los valores por defecto; `updateCenterSettings` solo `OWNER`/`ADMIN`, rechaza cambiar la moneda si ya hay movimientos de dinero) y `/settings` con moneda, zona horaria (trasladada desde Mi taller), comisión y envío ML, luz, embalaje, costo por kilo y purga. *Pruebas:* unitarias de validación; reales de "un registro por taller" y "la moneda se bloquea con movimientos".

- [x] **1.3b Lista de precios (D11).** `product-service.ts` y `product-queries.ts`: crear, editar, desactivar y buscar piezas con precio normal y precio ML. Pantalla `/products` simple (nombre, precio y precio ML, alta en una línea). *Pruebas:* unitarias, fronteras y aislamiento entre talleres.

- [x] **1.4 Clientes (opcionales, D7).** `customer-service.ts` (crear, editar, desactivar y reactivar) y `customer-queries.ts` (búsqueda sin acentos, ficha con sus ventas y saldo). Pantallas `/clients` y `/clients/[id]`; el alta normal ocurre al vuelo desde la venta. *Pruebas:* unitarias, fronteras y aislamiento entre talleres.

- [x] **1.5 Crear pedidos.** **Incluye D4 (casilla Mercado Libre que cambia a precios ML y calcula comisión, envío y neto), D7 (sin cliente por defecto) y D12 (venta rápida que queda entregada y cobrada en un paso, o pedido por encargo).** `order-operation.ts` (`resolveNewOrderOperation`, como `new-purchase-operation`) y `order-service.createOrder`: valida con Zod, crea el cliente al vuelo si corresponde, bloquea el `Center`, asigna el número, calcula el total, sugiere la comisión ML y registra el evento `CREATED`. Pantalla `/orders/new`: cliente existente o nuevo, canal, piezas (descripción, cantidad, precio, colores y material), descuento, fecha de entrega, campos ML y resumen en vivo (total, neto ML); con borrador local (`FormDraft`) y cerrojo contra doble envío. *Pruebas reales:* el mismo `operationId` dos veces crea un solo pedido; dos pedidos simultáneos reciben números distintos y consecutivos.

- [x] **1.6 Listado, ficha y estados.** `order-queries.ts` (filtros por estado y canal, atrasados primero, búsqueda por número o cliente) y `order-service.changeOrderStatus(orderId, expectedVersion, to)`: `FOR UPDATE`, compara la versión, valida la transición, incrementa la versión, fija `deliveredAt` y escribe `OrderEvent`. Pantallas `/orders` (lista en tarjetas en celular y tabla en computador) y `/orders/[id]` (piezas, totales, neto ML, cobros, saldo, historial de estados y botones de avance). *Pruebas reales (concurrencia, AGENTS.md):* dos cambios con la misma versión → gana uno y queda exactamente un evento. Se describe la intercalación y se observa el fallo antes de corregir.

- [x] **1.7 Cobros y devoluciones.** `order-service.registerPayment` (idempotente por `operationId`; sugiere el saldo o el neto ML), `voidMoneyTransaction` (D5) y `returnOrder` (D6). *Pruebas reales:* pago repetido no se duplica; la devolución es atómica (si falla el gasto, el pedido no cambia de estado); anular dos veces se rechaza.

- [x] **1.8 Dinero.** `money-service.ts` (ingresos sueltos como `DIGITAL_SALE`/`OTHER_INCOME` y gastos por categoría; solo `OWNER`/`ADMIN`) y `money-queries.ts` (mes en la zona del taller). Pantalla `/money`: selector de mes, ingresos, gastos y ganancia, por canal y por categoría, lista de movimientos con anulación y alta rápida de gasto o ingreso. *Pruebas:* unitarias del resumen (incluye anulados) y una real de que el mes respeta `America/Santiago` en los bordes del día.

- [x] **1.9 Navegación, inicio y datos demo.**
  - Menú: **Inicio, Pedidos, Clientes y Dinero**, con Ajustes y Mi taller en "Más" en el celular. Dinero solo para `OWNER`/`ADMIN`.
  - Inicio provisional con "Nuevo pedido", "Registrar gasto", pedidos atrasados y por entregar.
  - `npm run local:demo` (solo en `saas3d-local`, con la guarda local): crea "Taller QA" con clientes y pedidos en todos los estados, uno de ML de $8.990 con neto $6.483, cobros, una devolución, gastos de filamento y una venta de archivo de Cults.

- [x] **1.10 Cierre.** `npm run quality:gate` en verde, revisión de seguridad (permisos por rol en servicios y páginas, sin dinero para `PROFESSIONAL`/`VIEWER`), revisión en el navegador a 390 px y en computador con el panel visible, y entrada fechada en onyx.md.

#### Orden y puntos de aprobación

1.0 → **1.1 (aprobación de la migración)** → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8 → 1.9 → 1.10. Cada tarea termina con sus pruebas en verde y su propio commit. Las tareas de 1.5 a 1.7 tocan concurrencia y siguen el procedimiento de AGENTS.md (describir la intercalación, prueba real, observar el fallo, corregir y volver a probar).

#### Fuera de esta fase

Catálogo de piezas, cotizador, bobinas y stock (Fase 2); panel del mes (Fase 3); API de Mercado Libre, cobro de suscripción y pantalla de equipo visible.

### 18.3 Fase 2 — Catálogo de piezas, cotizador, bobinas y movimientos de stock y filamento (cerrada, 2026-11-08)

- [x] **2.1 Migración `20261109000000_phase2_catalog_spools_stock`.** Columnas técnicas y de stock en `Product`; tablas `ProductMovement`, `Spool` y `SpoolMovement` (`SERVER_ONLY`, RLS habilitado, 0 políticas, `REVOKE ALL`, claves compuestas y triggers `guard_product_movement`, `guard_product_delete`, `guard_immutable_row`, `guard_spool_delete`).
- [x] **2.2 Reglas puras de costo por material y presentación.** `computeMaterialCostPerGram`, `suggestMlPriceForTargetNet` y `catalog-presentation.ts`.
- [x] **2.3 Bobinas y movimientos de filamento (`/spools`, `/spools/[id]`).** `spool-service.ts`, `spool-queries.ts`, consumo concurrente con `SELECT ... FOR UPDATE`, registro opcional de gasto `FILAMENT` y barra de progreso con alerta de bobina baja.
- [x] **2.4 Catálogo completo de piezas y movimientos de stock (`/products`, `/products/[id]`).** `product-service.ts`, `product-queries.ts`, movimientos de stock con `SELECT ... FOR UPDATE`, costo y margen en vivo y regla de eliminación física restringida.
- [x] **2.5 Cotizador interactivo (`/quote`).** Calculadora móvil y de escritorio conectada al costo real por material de las bobinas activas, con creación en un toque de pedidos `QUOTED` o piezas de catálogo.
- [x] **2.6 Navegación, datos demo de Fase 2 y cierre (`quality:gate`).** Enlaces en `Sidebar`, `MobileNav` y `/dashboard`, semilla `npm run local:demo` actualizada y `npm run quality:gate` → PASSED.

### 18.4 Fase 3 — Panel operativo y financiero del mes con alertas (cerrada, 2026-11-08)

- [x] **3.1 Consultas agregadas del panel (`src/lib/dashboard-queries.ts` y `src/lib/dashboard-queries.test.ts`).** `getDashboardOverview({ month })` con aislamiento por rol (`OWNER`/`ADMIN`, `PROFESSIONAL`, `VIEWER`), conteo por etapas, total pendiente por cobrar y alertas de bobinas bajas y piezas con stock bajo.
- [x] **3.2 Interfaz móvil y de escritorio del Panel del Mes (`src/app/(private)/dashboard/page.tsx`).** Banda de alertas accionables, carga operativa por etapa, selector de mes, KPIs financieros (`Ingresos`, `Gastos`, `Ganancia neta`, `Por cobrar`) y barras proporcionales por canal y por categoría.
- [x] **3.3 Revisión de seguridad, `quality:gate` y cierre documental (`onyx.md`, `CHANGELOG.md`).** `npm run quality:gate` → PASSED (323 unitarias, 13 RLS, 3 S1, 1 S3, 55 transacciones).

### 18.5 Fases siguientes

- **Fase 4:** uso real por Surko durante 2 a 4 semanas, con correcciones.
- **Fase 5:** beta con 5 a 10 makers y entrevistas.
- **Fase 6:** según lo que pida la beta: API de ML, cobro, equipo y calculadora pública.
