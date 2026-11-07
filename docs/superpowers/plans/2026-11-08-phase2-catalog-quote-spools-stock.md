# Fase 2: Catálogo de Piezas, Cotizador, Bobinas y Stock — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar los costos reales de impresión 3D (filamento por material, purga multicolor, electricidad y embalaje) y el inventario físico inmutable (stock de piezas y gramos de bobinas) con el flujo de ventas y dinero de la Fase 1.

**Architecture:** Evolución sobre el núcleo multi-tenant (`SERVER_ONLY`, RLS cerrado, claves foráneas compuestas `(centerId, id)`) de `saas3d`. El stock de piezas (`Product.currentStock`) y los gramos restantes de bobinas (`Spool.remainingGrams`) jamás se editan directamente: solo cambian dentro de transacciones PostgreSQL con bloqueo pesimista (`SELECT ... FOR UPDATE`), idempotencia por `(centerId, operationId)` y registro de movimientos inmutables (`ProductMovement` y `SpoolMovement`).

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript 5, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL (Supabase), Zod 4, Tailwind CSS 4, Vitest 4.

## Global Constraints

- `../KurovaV2` es **SOLO LECTURA**.
- `centerId` obligatorio en toda consulta y mutación Prisma.
- Ninguna `actions.ts` importa Prisma; toda función exportada de `*-service.ts` abre con `requireCatalogContext` o `requireOperationalContext` (`src/lib/auth-boundaries.test.ts`).
- `Product.currentStock` y `Spool.remainingGrams` nunca quedan en negativo (`CHECK >= 0`) y solo cambian mediante movimientos inmutables (`ProductMovement`, `SpoolMovement`) con `SELECT ... FOR UPDATE`.
- Antes de implementar defensas de concurrencia, seguir el procedimiento de `AGENTS.md`: describir intercalación, crear prueba real en PostgreSQL, observar fallo, corregir y verificar en verde.
- Nada en la nube sin autorización explícita; usar solo `saas3d-local` (5444x) y `saas3d-test` (5445x).
- Diseño móvil primero (~390 px, controles táctiles ≥ 44 px, menos de 30 segundos por operación).

---

## Decisiones de Diseño de la Fase 2 (D13–D19)

| # | Decisión | Propuesta |
|---|---|---|
| D13 | **Permisos por rol en Fase 2** | Crear/editar/desactivar piezas de catálogo (`Product`) y bobinas (`Spool`): `OWNER` y `ADMIN` (`requireCatalogContext`). Registrar movimientos de stock (`ProductMovement`), consumos de filamento (`SpoolMovement`) y usar el cotizador (`/quote`): `OWNER`, `ADMIN` y `PROFESSIONAL` (`requireOperationalContext`). `VIEWER` solo consulta sin costos ni márgenes. |
| D14 | **Ampliación de `Product` sin romper Fase 1** | Las piezas creadas en Fase 1 conservan su validez: las nuevas columnas técnicas (`material`, `grams`, `printMinutes`, `colorsCount`, `purgeGrams`, `currentStock`, `minStock`) tienen valores por defecto seguros (`'PETG'`, `0`, `0`, `1`, `0`, `0`, `0`) y `category` opcional. Si `grams > 0` o `printMinutes > 0`, se calcula y muestra el costo real y margen en vivo. |
| D15 | **Stock de piezas inmutable (`ProductMovement`)** | Tipos de movimiento: `INITIAL` (stock inicial opcional al crear la pieza), `ENTRY` (fabricación/entrada, `delta > 0`), `EXIT` (salida/entrega, `delta < 0`) y `ADJUST` (ajuste positivo o negativo, `delta <> 0`). Nunca deja `currentStock < 0`. Idempotente por `(centerId, operationId)`. |
| D16 | **Eliminación de `Product` con defensa en BD y servicio** | Según `AGENTS.md`, un `Product` solo puede eliminarse físicamente si `NOT EXISTS` en `OrderItem` y `NOT EXISTS` en `ProductMovement` con `kind <> 'INITIAL'`. Si solo tuvo movimiento `INITIAL` (o ningún movimiento) y 0 pedidos, puede borrarse; de lo contrario, se desactiva (`active = false`). |
| D17 | **Bobinas y gramos inmutables (`Spool` y `SpoolMovement`)** | Cada bobina registra `material` (`PLA`, `PETG`, `ASA`, `ABS`, `TPU`, `OTHER`), `color`, `brand`, `totalGrams > 0`, `remainingGrams >= 0`, `pricePaid >= 0` y `purchasedOn`. Al crearla con `remainingGrams > 0`, se crea su movimiento `INITIAL`. Los consumos (`CONSUME`, `deltaGrams < 0`) y ajustes (`ADJUST`, `deltaGrams <> 0`) usan `FOR UPDATE` e idempotencia por `(centerId, operationId)`. Opcionalmente, al dar de alta una bobina con `pricePaid > 0`, una casilla permite registrar en el mismo paso el gasto `FILAMENT` en `MoneyTransaction` (solo `OWNER`/`ADMIN`). |
| D18 | **Costo por gramo por material** | Para cada material, `costPerGram` es el promedio ponderado o simple de `pricePaid / totalGrams` de las bobinas activas de ese material en el taller (`Σ pricePaid / Σ totalGrams` de bobinas activas con ese material; si no hay bobinas activas de ese material, usa `CenterSettings.defaultCostPerKg / 1000`). |
| D19 | **Cotizador (`/quote`) conectado a Pedidos y Catálogo** | Calcula en vivo costo de material (con purga si `colorsCount > 1`), luz, embalaje, costo total, precio sugerido según margen objetivo y precio sugerido en Mercado Libre (compensando comisión y envío para conservar la ganancia). Permite en un toque **Crear pedido cotizado (`QUOTED`)** o **Guardar pieza en el catálogo**. |

---

## Tareas de la Fase 2

### Tarea 2.1: Migración `20261109000000_phase2_catalog_spools_stock` (Requiere aprobación)
- **Archivos:**
  - Modificar: `prisma/schema.prisma`
  - Crear: `prisma/migrations-postgres/20261109000000_phase2_catalog_spools_stock/migration.sql`
  - Crear: `tests/phase2-integrity.integration.test.ts`
  - Modificar: `tests/rls.integration.test.ts`
- **Detalles:**
  - Ampliar `Product` con `category`, `material`, `grams`, `printMinutes`, `colorsCount`, `purgeGrams`, `currentStock`, `minStock` y sus `CHECK` (`grams >= 0`, `printMinutes >= 0`, `colorsCount BETWEEN 1 AND 16`, `purgeGrams >= 0`, `currentStock >= 0`, `minStock >= 0`, `material IN ('PLA','PETG','ASA','ABS','TPU','OTHER')`).
  - Crear tablas `ProductMovement`, `Spool` y `SpoolMovement` con claves compuestas `(centerId, ...)`, `UNIQUE (centerId, operationId)`, triggers de inmutabilidad (`guard_center_id_immutable`, `guard_product_movement_immutable`, `guard_product_delete`, `guard_immutable_row` en `SpoolMovement` y `guard_spool_delete`), `ENABLE ROW LEVEL SECURITY`, 0 políticas y `REVOKE ALL` a `PUBLIC, anon, authenticated`.
  - Pruebas reales en `tests/phase2-integrity.integration.test.ts` y `tests/rls.integration.test.ts`.

### Tarea 2.2: Reglas puras de costo por material, alertas de stock y presentación
- **Archivos:**
  - Modificar: `src/lib/costing.ts` y `src/lib/costing.test.ts`
  - Crear: `src/lib/catalog-presentation.ts` y actualizar `src/lib/presentation.test.ts`
- **Detalles:**
  - `computeMaterialCostPerGram(spools, material, defaultCostPerKg)`: calcula el costo por gramo de un material a partir de las bobinas activas de ese material (o `defaultCostPerKg / 1000` si no hay ninguna activa).
  - `suggestMlPriceForTargetNet(targetNet, commissionPct, sellerShippingCost)`: sugiere el precio a publicar en Mercado Libre para que después de comisión y envío quede el neto objetivo.
  - Etiquetas en español para materiales (`MATERIALS`, `MATERIAL_LABEL`), tipos de movimiento de stock (`PRODUCT_MOVEMENT_KINDS`, `PRODUCT_MOVEMENT_LABEL`) y de bobina (`SPOOL_MOVEMENT_KINDS`, `SPOOL_MOVEMENT_LABEL`).

### Tarea 2.3: Bobinas y movimientos de filamento (`Spool` y `SpoolMovement` — `/spools`, `/spools/[id]`)
- **Archivos:**
  - Crear: `src/lib/spool-service.ts`, `src/lib/spool-service.test.ts`
  - Crear: `src/lib/spool-queries.ts`, `src/lib/spool-queries.test.ts`
  - Modificar: `src/lib/auth-boundaries.test.ts`
  - Crear: `src/app/(private)/spools/actions.ts`, `src/app/(private)/spools/page.tsx`, `src/app/(private)/spools/SpoolControls.tsx`, `src/app/(private)/spools/[id]/page.tsx`
  - Crear: `tests/spools.integration.test.ts`
- **Detalles:**
  - `createSpool`: crea la bobina, registra su `SpoolMovement` `INITIAL` y opcionalmente crea el gasto `FILAMENT` en `MoneyTransaction` en la misma transacción.
  - `recordSpoolMovement`: consume (`CONSUME`) o ajusta (`ADJUST`) gramos bloqueando la bobina con `SELECT ... FOR UPDATE`, verificando idempotencia por `(centerId, operationId)` y que `resultingGrams >= 0`.
  - Procedimiento de concurrencia `AGENTS.md`: dos consumos simultáneos sobre una bobina de 500 g por 300 g cada uno → gana uno (queda en 200 g) y el segundo se rechaza con `DomainError` sin dejar gramos negativos.
  - UI móvil y escritorio en `/spools` y `/spools/[id]` con barra de progreso visual de gramos restantes, alerta si `remainingGrams <= lowSpoolThresholdGrams` y botón rápido de descontar gramos en un toque.

### Tarea 2.4: Catálogo completo de piezas y movimientos de stock (`Product` y `ProductMovement` — `/products`, `/products/[id]`)
- **Archivos:**
  - Modificar: `src/lib/product-service.ts`, `src/lib/product-service.test.ts`
  - Modificar: `src/lib/product-queries.ts`, `src/lib/product-queries.test.ts`
  - Modificar: `src/app/(private)/products/actions.ts`, `src/app/(private)/products/page.tsx`, `src/app/(private)/products/ProductsClient.tsx`
  - Crear: `src/app/(private)/products/[id]/page.tsx`, `src/app/(private)/products/[id]/ProductDetailControls.tsx`
  - Modificar: `tests/products.integration.test.ts`
- **Detalles:**
  - Ampliar `createProduct` y `updateProduct` con `category`, `material`, `grams`, `printMinutes`, `colorsCount`, `purgeGrams`, `minStock` y `initialStock` (solo al crear, generando `ProductMovement` `INITIAL`).
  - `recordProductMovement`: registra `ENTRY`, `EXIT` o `ADJUST` con `SELECT ... FOR UPDATE`, idempotencia por `(centerId, operationId)` y validación `resultingStock >= 0`.
  - Actualizar `deleteProduct` para verificar `NOT EXISTS` tanto en `OrderItem` como en `ProductMovement` con `kind <> 'INITIAL'`.
  - Prueba real de concurrencia en `tests/products.integration.test.ts`: dos salidas (`EXIT`) simultáneas no dejan stock negativo y se respeta la regla de eliminación con y sin movimientos reales.
  - UI en `/products` y `/products/[id]`: muestra stock actual, costo de fabricación, ganancia estimada directa y en ML, y controles táctiles para sumar/restar stock (`+ Fabricar`, `- Salida`, `Ajustar`).

### Tarea 2.5: Cotizador interactivo (`/quote`)
- **Archivos:**
  - Crear: `src/app/(private)/quote/page.tsx`, `src/app/(private)/quote/QuoteCalculator.tsx`, `src/app/(private)/quote/actions.ts`
- **Detalles:**
  - Calculadora móvil y de escritorio con parámetros precargados del taller y costo por gramo real por material según las bobinas activas.
  - Desglose en vivo de gramos (pieza + purga multicolor), costo de filamento, costo de electricidad, embalaje, costo total, precio sugerido según margen y precio sugerido para Mercado Libre.
  - Acciones en un toque:
    1. **Crear pedido cotizado (`QUOTED`)**: crea el pedido con `createOrder` y redirige a `/orders/[id]`.
    2. **Guardar en catálogo de piezas**: crea la pieza en `Product` con todos sus datos técnicos y precios.

### Tarea 2.6: Navegación, datos demo de Fase 2 y cierre (`quality:gate`)
- **Archivos:**
  - Modificar: `src/components/Sidebar.tsx`, `src/components/MobileNav.tsx`
  - Modificar: `scripts/seed-local-demo.ts`
  - Modificar: `onyx.md`, `CHANGELOG.md`
- **Detalles:**
  - Añadir enlaces a **Bobinas** (`/spools`) y **Cotizador** (`/quote`) en `Sidebar` y en el cajón **Más** de `MobileNav`.
  - Ampliar `npm run local:demo` para que el "Taller QA" incluya bobinas PETG (negro, blanco, rojo y gris, incluyendo una bobina con pocos gramos bajo el umbral de alerta), movimientos de filamento y piezas con gramos, tiempos de impresión y stock inicial.
  - Ejecutar revisión de seguridad y `npm run quality:gate` → PASSED.
