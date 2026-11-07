# Registro de Cambios (Changelog)

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato sigue las convenciones de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Añadido
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
