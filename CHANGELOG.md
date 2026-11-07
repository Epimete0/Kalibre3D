# Registro de Cambios (Changelog)

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato sigue las convenciones de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Corregido
- **Landing:** las cifras del ejemplo del Pedido #42 ahora coinciden con el cotizador (filamento $960, costo total $1.105, ganancia +$5.395 en venta directa y +$5.378 en Mercado Libre), y el texto principal ya no se corta en celulares de 375 px.

### Añadido
- **Despliegue en Producción (`kalibre3d.vercel.app`), Visibilidad de Contraseña y Corrección Responsiva Integral:**
  - Botón para mostrar/ocultar contraseña en `/login`, `/registro`, `/reset-password` y `/profile`, más guía contextual diferenciando el nombre personal del usuario y el nombre del taller (`/taller/nuevo`).
  - Compatibilidad automática con las variables de la integración oficial Supabase ↔ Vercel (`POSTGRES_PRISMA_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `sslmode=require`).
  - Rediseño responsivo de las tarjetas de estado y KPIs mensuales en `/dashboard` para evitar desbordamientos en móviles y tablets (`390 px` a `1024 px`).
  - Adaptación completa del Cotizador 3D (`/quote`) a los tokens semánticos del tema claro y oscuro de Kalibre.
  - Corrección de grillas, filtros táctiles y barra inferior pegajosa en `/products`, `/spools` y `/orders/new` sin colisión con la barra de navegación móvil (`MobileNav`) ni la barra lateral (`Sidebar`).
  - **Endurecimiento de Seguridad (`docs/security/2026-11-08-auditoria-y-consideraciones-seguridad.md`):** Eliminación del uso de `Origin` del cliente en enlaces de autenticación (`site-url.ts`), soporte de `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `proxy.ts` y `auth-settings.ts`, atributo `secure` en producción para la cookie `saas3d-center-id` y encabezados HTTP de seguridad en `next.config.ts`.
- **Definición de Marca Comercial Oficial (`Kalibre` / `Kalibre3D`) y Paquetes SQL de Producción (`scripts/production/`):**
  - Adopción de la marca **Kalibre** para el producto comercial.
  - Creación del repositorio oficial en GitHub (`https://github.com/Epimete0/Kalibre3D`).
  - Creación de `README.md` completo documentando la propuesta de valor, arquitectura, características principales y guía de desarrollo local.
  - Actualización de la marca visible en la aplicación: landing page, cabecera pública y pie de página (`PublicShell`), barra lateral (`Sidebar`), barra superior móvil (`PrivateHeader`), vistas de autenticación (`AuthLayout`, `AuthForm`), documentos legales (`/terminos`, `/privacidad`), pantallas de error y metadata de rutas.
  - **Identidad visual propia y nueva Landing Page (`src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/AuthLayout.tsx`):** Reemplazo completo de la paleta y tipografía provisionales heredadas de Kurova por el sistema técnico de **Kalibre** (aluminio anodizado `#f3f5f7`, cama PEI de carbono `#0b0f17`, naranja cobre térmico `#d9531e`, azul calibración `#0284c7`, tipografías `Space Grotesk` + `JetBrains Mono`), nueva Landing Page con ficha de calibración y neto de Mercado Libre en vivo, y nuevo panel técnico de inicio de sesión/registro con escala vernier.
  - Generador y paquetes SQL de despliegue inicial en Supabase (`scripts/production/20261108-00-preflight-initial-schema.sql`, `20261108-01-dry-run-initial-schema.sql`, `20261108-02-apply-initial-schema.sql`, `20261108-03-verify-initial-schema.sql`), pruebas de integridad (`scripts/production/package-20261108.test.ts`) y runbook de despliegue (`docs/runbooks/2026-11-08-despliegue-supabase-vercel.md`).
- **Fase 3: Panel Operativo y Financiero del Mes con Alertas (`/dashboard`, `src/lib/dashboard-queries.ts`) (Tareas 3.1 a 3.3):**
  - Banda superior de **Alertas del taller** con indicadores y accesos directos a **Pedidos atrasados**, **Bobinas por acabarse** (`remainingGrams <= lowSpoolThresholdGrams`) y **Piezas con stock bajo** (`currentStock <= minStock`).
  - Tarjetas táctiles de **Carga operativa por etapa** (`Cotizados`, `Confirmados`, `Imprimiendo`, `Listos`) enlazadas a `/orders?status=...`.
  - **Panel financiero del mes** en `/dashboard` (exclusivo para `OWNER` y `ADMIN`) con selector de mes (`←` / `→`), tarjetas de **Ingresos**, **Gastos**, **Ganancia neta** y **Por cobrar en pedidos activos**, y barras proporcionales de **Ingresos por canal** y **Gastos por categoría**.
  - Aislamiento por rol en `getDashboardOverview` (`OWNER`/`ADMIN` ven finanzas y alertas; `PROFESSIONAL` ve alertas y operación; `VIEWER` ve operación sin montos ni costos).
- **Fase 2: Catálogo Técnico de Piezas, Cotizador 3D, Bobinas y Movimientos de Stock (`/products`, `/spools`, `/quote`) (Tareas 2.1 a 2.6):**
  - **Bobinas de filamento (`/spools` y `/spools/[id]`) (Tarea 2.3):**
    - Gestión de bobinas por material (`PLA`, `PETG`, `ASA`, `ABS`, `TPU`, `OTHER`), color, marca, peso total, gramos restantes, precio pagado y fecha de compra.
    - Opción al crear una bobina para registrar en el mismo paso el gasto `FILAMENT` en el módulo de Dinero (`MoneyTransaction`).
    - Barra visual de filamento restante y alerta de **Poca bobina** cuando los gramos restantes bajan del umbral configurado en Ajustes (`lowSpoolThresholdGrams`).
    - Consumo rápido (`-25 g`, `-50 g`, `-100 g` o personalizado) y ajuste de gramos con movimientos inmutables (`SpoolMovement`), idempotencia por `operationId` y bloqueo transaccional `SELECT ... FOR UPDATE`.
  - **Catálogo técnico de piezas y stock inmutable (`/products` y `/products/[id]`) (Tarea 2.4):**
    - Ampliación de cada pieza con categoría, material, gramos de pieza, minutos de impresión, cantidad de colores (`1–16`), gramos de purga multicolor, stock actual y stock mínimo de alerta.
    - Cálculo automático de costo real de fabricación (filamento según promedio de bobinas activas del material + electricidad + embalaje) y margen estimado en venta directa y en Mercado Libre.
    - Control de stock por movimientos inmutables (`ProductMovement`: `INITIAL`, `ENTRY`, `EXIT`, `ADJUST`) con bloqueo `SELECT ... FOR UPDATE` e idempotencia.
    - Eliminación física restringida en servicio y base de datos (`guard_product_delete`) exclusivamente a piezas sin pedidos y sin movimientos reales (`kind <> 'INITIAL'`).
  - **Cotizador interactivo de impresión 3D (`/quote`) (Tarea 2.5):**
    - Calculadora en vivo para teléfonos móviles y computador con selección de material (usando el costo por gramo real de las bobinas activas del taller), peso, tiempo, colores/purga, embalaje y margen objetivo.
    - Comparativa en tiempo real entre **Venta directa** y **Mercado Libre** (calculando el precio a publicar para conservar la ganancia neta tras comisión y envío).
    - Conversión en un toque en **Pedido cotizado (`QUOTED`)** (con cliente existente o nuevo) o en **Pieza del catálogo**.
  - **Navegación y semilla de demostración (`Sidebar`, `MobileNav`, `npm run local:demo`) (Tarea 2.6):**
    - Accesos a **Cotizador** (`/quote`), **Catálogo de piezas** (`/products`) y **Bobinas** (`/spools`) en barra lateral y menú móvil **Más**, más acceso rápido `Cotizar pieza` en `/dashboard`.
    - Semilla `npm run local:demo` ampliada con 4 bobinas PETG (incluyendo alerta de bobina baja), movimientos de filamento y especificaciones técnicas + stock en las piezas de `"Taller QA"`.
- **Navegación móvil, Inicio operativo y Datos Demo (`MobileNav`, `/dashboard`, `npm run local:demo`) (Tareas 1.9 y 1.10 — Cierre Fase 1):**
  - Barra inferior móvil (`MobileNav`) optimizada para pantallas de 390 px con accesos principales (**Inicio, Pedidos, Clientes y Dinero**) y cajón desplegable **Más** con Lista de piezas, Ajustes del taller y Mi taller.
  - Barra lateral de computador (`Sidebar`) sincronizada con acceso a Dinero (`/money`) restringido a `OWNER` y `ADMIN`.
  - Pantalla de Inicio (`/dashboard`) operativa con acciones rápidas en un toque (`+ Nueva venta`, `+ Registrar gasto`), tarjetas del mes en curso (Ingresos, Gastos y Ganancia neta para `OWNER`/`ADMIN`), sección destacada de **Pedidos atrasados** y listado de **Por fabricar / entregar**.
  - Comando `npm run local:demo` (`scripts/seed-local-demo.ts`) para poblar de forma determinista el taller `"Taller QA"` en `saas3d-local` con piezas, clientes, 7 pedidos en todos los estados (incluyendo el caso real de Mercado Libre de $8.990 con neto $6.483), devolución, gasto de filamento y venta digital en Cults3D.
- **Módulo de Dinero y Resumen Mensual (`/money`) (Tarea 1.8):**
  - Panel mensual exclusivo para dueños y administradores del taller (`OWNER`/`ADMIN`) con cálculo exacto en la zona horaria del taller (`America/Santiago`).
  - Indicadores principales del mes: ingresos totales, gastos totales y ganancia neta real (excluyendo movimientos anulados).
  - Desglose de ingresos por canal de venta (Mercado Libre, WhatsApp, Instagram, en persona, archivo digital) y gastos por categoría.
  - Registro rápido e idempotente de gastos del taller (filamento, repuestos, envíos, publicidad, comisiones, imprevistos) e ingresos sueltos (venta de archivos digitales en Cults3D u otros).
  - Listado mensual de movimientos con enlace directo a la venta asociada y opción de anulación con motivo obligatorio.
- **Cobros, anulaciones y devoluciones de ventas (`/orders/[id]`) (Tarea 1.7):**
  - Registro de cobros adicionales o abonos con sugerencia automática del saldo pendiente o del monto neto de Mercado Libre e idempotencia por `operationId`.
  - Anulación controlada de movimientos de dinero con motivo obligatorio (D5), preservando la trazabilidad histórica sin borrado físico.
  - Flujo de devolución atómica (D6) desde ventas entregadas (`DELIVERED` → `RETURNED`), registrando en la misma transacción el cambio de estado, el evento de auditoría y el gasto de reembolso (`REFUNDS`).
- **Listado, ficha de pedido y control de estados (`/orders` y `/orders/[id]`) (Tarea 1.6):**
  - Listado de pedidos y ventas con priorización automática de **pedidos atrasados primero** según la zona horaria del taller.
  - Filtros en vivo por estado (Todos, Pendientes, Cotizados, Confirmados, Imprimiendo, Listos, Entregados, Cancelados), por canal de venta y búsqueda insensible a tildes por `#número`, cliente o pieza.
  - Vista responsiva de tarjetas táctiles en teléfonos móviles (390 px) con botón rápido para avanzar al siguiente estado en un toque y vista de tabla en computador.
  - Ficha detallada de pedido (`/orders/[id]`): piezas, desglose transparente de comisión, envío y neto real de Mercado Libre, cobros recibidos, saldo pendiente y accesos rápidos a WhatsApp e Instagram del cliente.
  - Avance y cancelación de estados con control de concurrencia pesimista/optimista (`FOR UPDATE` + `version`) y registro inmutable en la línea de tiempo (`OrderEvent`).
- **Creación de pedidos y ventas rápidas (`/orders/new`) (Tarea 1.5):**
  - Formulario de alta rápida de pedidos diseñado para teléfonos móviles (390 px) para registrar ventas en menos de 30 segundos.
  - Soporte de dos modalidades operativas: **Venta rápida** (se entrega y cobra en el acto en un solo paso, con registro de ingreso inmediato) y **Pedido por encargo** (pasa por el ciclo de fabricación y entrega con anticipo opcional).
  - Casilla de **Mercado Libre**: activa precios ML de la lista de piezas, calcula comisión porcentual y costo de envío, y exhibe el monto neto real en vivo.
  - Selección de cliente existente con búsqueda o creación de cliente al vuelo en el mismo formulario.
  - Numeración consecutiva automática por taller (`#1`, `#2`…) con bloqueo determinístico en PostgreSQL para evitar colisiones bajo concurrencia.
  - Idempotencia garantizada por `operationId` para prevenir cobros y pedidos duplicados por doble envío en mala conexión.
  - Enlace de acceso directo a Pedidos en barra lateral y navegación móvil.
- **Módulo de Clientes (`/clients` y `/clients/[id]`) (Tarea 1.4):**
  - Directorio y gestión de clientes del taller con nombre, teléfono/WhatsApp, Instagram y notas internas.
  - Búsqueda en vivo insensible a tildes, diacríticos y mayúsculas.
  - Formulario de alta rápida en línea y modal de edición de datos.
  - Accesos directos para contactar por WhatsApp y ver perfil de Instagram.
  - Métricas de cliente: cantidad de pedidos, total comprado y saldo pendiente acumulado.
  - Ficha de cliente con historial completo de pedidos, estado, canal y saldos.
  - Regla de eliminación estricta: borrado físico permitido exclusivamente si el cliente no tiene pedidos registrados; de lo contrario, se desactiva para preservar la trazabilidad.
  - Ocultamiento de montos y saldos para roles de solo lectura (`VIEWER`).
  - Acceso directo a Clientes añadido en la barra lateral y menú móvil.
- **Lista de precios mínima (`/products`) (Tarea 1.3b):**
  - Gestión de piezas del taller con precio de venta y precio de Mercado Libre opcional.
  - Creación rápida de piezas en línea con validación de nombre único por taller.
  - Edición en línea de nombres y precios.
  - Activación y desactivación de piezas para mantener catálogo limpio sin perder historial.
  - Eliminación permitida exclusivamente para piezas que nunca han formado parte de pedidos registrados.
  - Enlace de acceso en la barra lateral y menú móvil para administradores y dueños del taller.
- **Ajustes del taller (`/settings`) (Tarea 1.3):**
  - Configuración centralizada de moneda, zona horaria y parámetros de Mercado Libre (comisión y envío por defecto).
  - Parámetros de costo base: costo de electricidad por hora, costo de embalaje por defecto, costo promedio de filamento y purga multicolor.
  - Bloqueo preventivo de cambio de moneda una vez registrados movimientos de dinero en el taller.
