# Próximos Pasos y Consideraciones Futuras — Kalibre (`saas3d`)

**Fecha:** 2026-11-08  
**Estado actual:** MVP completo (Fases 0 a 3 cerradas), desplegado en vivo en **`https://kalibre3d.vercel.app`** con base de datos PostgreSQL activa en Supabase (`umgxxtpekcjknhclojzo`) y el primer taller real (**Surko**) creado.

---

## 1. Configuración y Endurecimiento Inmediato en Producción (Checklist de Infraestructura)

1. **Variables de Entorno en Vercel (`surko/kalibre3d`):**
   - Definir explícitamente `NEXT_PUBLIC_SITE_URL=https://kalibre3d.vercel.app` en Vercel (*Settings → Environment Variables*) para que los enlaces de confirmación de cuenta, recuperación de contraseña y cambio de correo apunten siempre al dominio principal sin depender de `VERCEL_PROJECT_PRODUCTION_URL`.
   - *(Opcional pero recomendado para TLS estricto)*: Cargar el certificado raíz de Supabase en la variable `SUPABASE_DB_CA_CERT` en Vercel y usar `?sslmode=verify-full` en `DIRECT_URL` / `DATABASE_URL` para activar verificación criptográfica completa del servidor PostgreSQL en [`src/lib/postgres-tls.ts`](../src/lib/postgres-tls.ts).
2. **Configuración de URLs en Supabase Auth (`Authentication → URL Configuration`):**
   - **Site URL:** `https://kalibre3d.vercel.app`
   - **Redirect URLs permitidas:** `https://kalibre3d.vercel.app/auth/callback`
   - Verificar que la confirmación de correo (*Confirm email*) esté habilitada si se desea utilizar el cambio de correo desde `/profile` ([`src/lib/auth-settings.ts`](../src/lib/auth-settings.ts) falla cerrado si `mailer_autoconfirm` está activo).
3. **Actualización de Dependencias (`[VULN-004]`):**
   - Actualizar `next` y `eslint-config-next` de `16.3.3` a `16.4.5+` para cerrar los avisos de `npm audit` sobre Next.js 16 (`GHSA-p3m5-59mp-jv5r`, `GHSA-2464-fhr4-w9xw`).
   - Ejecutar `npm run quality:gate` tras la actualización para confirmar que Turbopack, Server Actions y las 52 suites unitarias + integración siguen en verde.

---

## 2. Fase 4: Uso Real en el Taller "Surko" (Próximas 2 a 4 Semanas)

El objetivo de la Fase 4 (según la sección 18.5 de [`onyx.md`](../onyx.md)) es operar **Surko** todos los días desde el teléfono y computador sin agregar módulos grandes hasta validar la fricción real:

1. **Carga Inicial del Taller Real:**
   - Ajustar en **Ajustes (`/settings`)**: costo de electricidad por hora (`electricityCostPerHour`), costo de embalaje por defecto (`defaultPackagingCost`), gramos de purga por cambio de color (`defaultPurgeGrams`), comisión de Mercado Libre (`mlCommissionPercent`) y umbral de alerta de poca bobina (`lowSpoolThresholdGrams`).
   - Registrar en **Bobinas (`/spools`)** las bobinas actuales en uso (PETG, PLA, ASA, TPU) con su peso restante real y precio pagado.
   - Registrar en **Catálogo (`/products`)** las piezas recurrentes (emblemas, soportes, accesorios) con sus gramos, minutos de impresión, colores y stock actual.
2. **Fricciones Operativas a Observar Durante el Uso Diario:**
   - **Descuento automático vs. manual de stock/filamento al entregar un pedido:**
     - Hoy los movimientos de stock (`ProductMovement`) y de bobina (`SpoolMovement`) se descuentan con botones rápidos (`-1 u.`, `-20 g`, `-50 g`, `-100 g`) para no forzar qué bobina exacta se usó en cada impresión.
     - *Evaluar tras 2 semanas:* ¿Conviene ofrecer un botón opcional en la ficha del pedido (`/orders/[id]`) al pasar a `PRINTING` o `DELIVERED` para descontar en un toque el stock de la pieza vinculada (`productId`) o los gramos de una bobina seleccionada?
   - **Edición de líneas de un pedido en estado `QUOTED` o `CONFIRMED`:**
     - Actualmente un pedido se crea con sus líneas y, si cambia el alcance, se cancela y se recrea o se ajusta con notas/cobros.
     - *Evaluar tras 2 semanas:* Si los clientes piden modificar cantidades o agregar una pieza después de cotizar, diseñar una mutación transaccional de edición de ítems que recalcule `total`, bloquee con `FOR UPDATE`, incremente `version` y deje rastro en `OrderEvent`.
   - **Comprobante o Resumen Copiable para WhatsApp / Instagram:**
     - En `/quote` y `/orders/[id]`, agregar un botón `"Copiar resumen para WhatsApp"` que copie al portapapeles el texto formateado con las piezas, tiempo estimado, total y datos de pago del taller.

---

## 3. Calidad, Pruebas y Mantenimiento Técnico

1. **Quality Gate Completo con Docker Local (`npm run quality:gate`):**
   - Cuando se modifique cualquier regla de base de datos, RLS, triggers o transacciones (`order-service`, `product-service`, `spool-service`, `money-service`), levantar Docker Desktop y ejecutar:
     ```bash
     npm run quality:gate
     ```
   - Esto corre las 52 suites unitarias + linter + build + pruebas reales contra PostgreSQL (`test:rls` 13/13, `test:s1`, `test:s3` y `test:transactions` 55/55).
2. **Monitoreo de Errores en Producción:**
   - Revisar periódicamente `npx vercel logs` o el panel de Vercel/Supabase ante cualquier error inesperado capturado por `safeActionError`.
3. **Respaldo y Migraciones Futuras:**
   - Toda nueva migración SQL debe crearse en `prisma/migrations-postgres/`, incluir sus políticas RLS/grants explícitos y empaquetarse con un script de verificación (`scripts/production/`) antes de aplicarse en el SQL Editor de Supabase en producción.

---

## 4. Funcionalidades Fuera del Alcance Actual (Requieren Decisión Explícita)

Según el contrato de [`AGENTS.md`](../AGENTS.md), **no** implementar sin una decisión formal de producto:
- Integración automática con la API de Mercado Libre.
- Pasarela de cobro de suscripciones SaaS (Stripe / MercadoPago Subscriptions).
- Facturación electrónica o integración con el SII.
- Tienda pública online / carrito de compras para clientes finales.
- Automatizaciones con IA o CRM de marketing.
