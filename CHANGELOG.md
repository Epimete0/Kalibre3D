# Registro de Cambios (Changelog)

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato sigue las convenciones de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Añadido
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
