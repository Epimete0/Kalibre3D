# Registro de Cambios (Changelog)

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato sigue las convenciones de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Añadido
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
