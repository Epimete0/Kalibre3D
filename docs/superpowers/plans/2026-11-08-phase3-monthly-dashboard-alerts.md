# Fase 3: Panel Operativo y Financiero del Mes con Alertas — Plan de Implementación

**Goal:** Transformar `/dashboard` en el panel integral del taller 3D: el mes de un vistazo (ingresos, gastos, ganancia, desglose por canal y categoría, y total por cobrar), carga operativa por estado (`QUOTED`, `CONFIRMED`, `PRINTING`, `READY`), pedidos atrasados y por entregar, y alertas accionables de **bobinas por acabarse** y **piezas con stock bajo**.

**Architecture:** Módulo de lectura `src/lib/dashboard-queries.ts` protegido con `requireAuthContext()` y filtrado estricto por `centerId`, respetando permisos por rol (`OWNER`/`ADMIN` ven finanzas y márgenes; `PROFESSIONAL` ve operación, stock y bobinas; `VIEWER` ve operación sin montos ni costos). Sin cambios de esquema ni de RLS.

---

## Tareas de la Fase 3

### Tarea 3.1: Consultas agregadas del panel (`src/lib/dashboard-queries.ts` y `src/lib/dashboard-queries.test.ts`)
- Crear `getDashboardOverview({ month?: string })`:
  - Obtiene pedidos activos (`listOrders({ status: "ACTIVE" })`), separa atrasados (`isOverdue`) y próximos, y calcula conteos por estado (`QUOTED`, `CONFIRMED`, `PRINTING`, `READY`) y saldo total pendiente por cobrar (`pendingReceivableTotal`, solo `OWNER`/`ADMIN`).
  - Obtiene alertas de inventario para roles operativos (`OWNER`, `ADMIN`, `PROFESSIONAL`):
    - Bobinas activas con `remainingGrams <= lowSpoolThresholdGrams`.
    - Piezas activas con `minStock > 0 && currentStock <= minStock`.
  - Obtiene el resumen financiero del mes seleccionado (`getMonthlyMoneyView({ month })`) exclusivamente para `OWNER` y `ADMIN`.
- Pruebas unitarias en `src/lib/dashboard-queries.test.ts` verificando el aislamiento por rol (`OWNER`, `PROFESSIONAL`, `VIEWER`), conteos por estado, alertas de stock/filamento y cálculo de saldo por cobrar.

### Tarea 3.2: Interfaz móvil y de escritorio del Panel del Mes (`src/app/(private)/dashboard/page.tsx`)
- Selector táctil de mes (`←` / `→` con `?month=AAAA-MM`) para `OWNER`/`ADMIN`.
- Tarjetas financieras (Ingresos, Gastos, Ganancia del mes y Por cobrar en pedidos activos).
- Barras proporcionales de **Ingresos por canal** y **Gastos por categoría** en el mes seleccionado (`OWNER`/`ADMIN`).
- Banda de **Alertas del taller** (Pedidos atrasados, Bobinas bajas y Piezas con stock bajo) con enlaces directos a `/orders`, `/spools/[id]` y `/products/[id]`.
- Resumen táctil de **Carga del taller por etapa** (`Cotizados`, `Confirmados`, `Imprimiendo`, `Listos`).
- Listados de **Pedidos atrasados** y **Por fabricar / entregar**.

### Tarea 3.3: Revisión de seguridad, `quality:gate` y cierre documental (`onyx.md`, `CHANGELOG.md`)
- Ejecutar `npm run quality:gate` completo y actualizar `onyx.md` y `CHANGELOG.md`.
