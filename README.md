# Kalibre 🖨️📐

> **Gestión operativa y financiera con precisión milimétrica para makers y talleres de impresión 3D.**

**Kalibre** es una plataforma SaaS multi-taller diseñada específicamente para la operación interna de makers y talleres de impresión 3D en Latinoamérica. Resuelve el desorden de pedidos en múltiples canales, la incertidumbre en el costeo real por gramo y el control de inventario de bobinas y piezas terminadas.

---

## 🚀 Características principales

- **📦 Gestión de Pedidos Multi-canal:**
  - Seguimiento del ciclo de vida de cada encargo: `QUOTED` → `CONFIRMED` → `PRINTING` → `READY` → `DELIVERED`.
  - Integración nativa del impacto de comisiones de **Mercado Libre** vs. venta directa por WhatsApp o Instagram.
  - Historial inmutable de eventos por pedido (`OrderEvent`).

- **🎯 Cotizador en Vivo (`/quote`):**
  - Estimación instantánea del costo de pieza basado en gramos de filamento, horas de máquina, consumo eléctrico y depreciación.
  - Margen de ganancia configurable y comparación de precio directo vs. precio en Mercado Libre.
  - Conversión en 1 clic a pedido nuevo o a pieza de catálogo.

- **🧵 Bobinas y Filamento (`/spools`):**
  - Inventario por material (PLA, PETG, ABS, TPU, Resina, etc.), marca y color.
  - Trazabilidad inmutable de consumo por movimientos (`SpoolMovement`). Ninguna bobina queda en negativo.
  - Alertas automáticas de bobinas con filamento bajo (umbral configurable o < 150 g).

- **📦 Catálogo de Piezas y Stock (`/products`):**
  - Catálogo de piezas recurrentes con consumo estimado de filamento y tiempo de impresión.
  - Control de inventario terminado con transacciones atómicas y bloqueos de concurrencia (`SELECT ... FOR UPDATE`).

- **📊 Tablero Operativo y Financiero (`/dashboard`):**
  - Alertas en tiempo real: pedidos atrasados, bobinas críticas y piezas bajo stock mínimo.
  - Métricas del mes: ingresos brutos, costos reales de filamento, comisiones y utilidad neta.
  - Desglose por canal de venta y por categoría de producto para `OWNER` y `ADMIN`.

- **🛡️ Multi-taller y Roles:**
  - Aislamiento estricto de datos por taller (`centerId`) tanto a nivel de aplicación como en base de datos.
  - Roles definidos: **Dueño** (`OWNER`), **Administrador** (`ADMIN`), **Ayudante** (`PROFESSIONAL`) y **Solo Lectura** (`VIEWER`).

---

## 🛠️ Stack Tecnológico

- **Framework:** Next.js 16 (App Router, Server Components y Server Actions)
- **Frontend:** React 19, TypeScript, Tailwind CSS 4
- **Base de Datos & ORM:** PostgreSQL en Supabase, Prisma ORM 7
- **Autenticación:** Supabase Auth
- **Validación:** Zod
- **Testing:** Vitest (pruebas unitarias, RLS y pruebas de concurrencia/transacciones con PostgreSQL real)

---

## 💻 Desarrollo Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/Epimete0/Kalibre3D.git
cd Kalibre3D
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea tu archivo `.env` basado en `.env.example`:
```bash
cp .env.example .env
```

### 4. Iniciar base de datos local y migraciones
```bash
npm run local:start
npm run db:deploy
npm run local:demo   # Carga datos de prueba listos para usar
```

### 5. Iniciar el servidor de desarrollo
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🧪 Pruebas y Quality Gate

El proyecto cuenta con un quality gate exhaustivo que valida pruebas unitarias, linting, compilación, estado de migraciones y pruebas reales de RLS y transacciones contra PostgreSQL:

```bash
npm run quality:gate
```

---

## 📄 Licencia

Uso interno y comercial privado. Todos los derechos reservados.
