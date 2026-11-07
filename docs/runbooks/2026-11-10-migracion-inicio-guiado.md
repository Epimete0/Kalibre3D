# Aplicar la migración del inicio guiado en producción

Migración: `20261110000000_guided_setup_costs`
Paquete: `scripts/production/20261110-apply-guided-setup-costs.sql`

## Qué cambia

Agrega 5 columnas con valor por defecto a `CenterSettings`: precio del kWh, watts de la impresora, comisión adicional, IVA y margen mínimo. También agrega un CHECK de rangos.

No modifica datos existentes, políticas RLS, grants ni funciones. Los talleres existentes quedan con IVA 0, comisión adicional 0 y margen 60 %, es decir, igual que hoy.

## Orden obligatorio

1. **Primero la base de datos.** El código nuevo lee estas columnas: si se despliega antes, el panel, Ajustes, Bobinas y el cotizador fallan.
2. **Después el código**, con `git push` a `main`, que despliega Vercel.

## Pasos

1. Abre Supabase → proyecto `umgxxtpekcjknhclojzo` → **SQL Editor** → **New query**.
2. Pega el contenido completo de `scripts/production/20261110-apply-guided-setup-costs.sql` y presiona **Run**.
3. Debe terminar con el aviso `VERIFY OK: columnas, CHECK, RLS y registro de la migración…` y sin errores.
4. Si aparece `ya está registrada`, la migración ya estaba aplicada: no se cambió nada y se puede seguir.
5. Recién después, sube el código.

## Qué hace el paquete

- **Antes de aplicar:** comprueba que estén las 4 migraciones previas, que no haya migraciones a medio aplicar y que esta no esté ya aplicada.
- **Al aplicar:** todo ocurre en una sola transacción. Si algo falla, no queda nada a medias.
- **Al registrar:** anota la migración en `_prisma_migrations` con el checksum SHA-256 LF que Prisma espera.
- **Al verificar:** confirma las 5 columnas, el CHECK y que RLS siga activo en `CenterSettings`.

Se probó en la base local `saas3d-local`: aplica bien, al reintentarlo se detiene sin cambios y `prisma migrate` lo reconoce como aplicado.
