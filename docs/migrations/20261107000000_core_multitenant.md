# Migración `20261107000000_core_multitenant`

Migración fundacional de saas3d (tarea 0.4, `onyx.md` 18.1). Porta el núcleo
multi-tenant de Kurova en una sola migración:
[`prisma/migrations-postgres/20261107000000_core_multitenant/migration.sql`](../../prisma/migrations-postgres/20261107000000_core_multitenant/migration.sql).

> Requiere aprobación antes de aplicarse (RLS y datos). No ha sido aplicada ni
> probada contra PostgreSQL todavía.

## Qué contiene y de dónde viene

La autoridad es el volcado del estado final de Kurova (`kurova-core-tables.sql`,
`kurova-app-private.sql`); las migraciones de Kurova explican el porqué.

| Bloque | Contenido | Origen en Kurova |
|---|---|---|
| 1. Tablas | `Profile`, `Center`, `CenterMember`, `InvitationCode`, `OnboardingDismissal`: columnas, defaults, `CHECK` de roles, PK, `UNIQUE` y FK | Volcado final; `20260712190300_auth_centers_rls`, `20260712190600_onboarding_dismissals`, `20260721201000_center_archive` (`Center.active`), `20260829140000_center_time_zone` (`Center.timeZone`) |
| 2. Índices | `Center_active_idx`, `CenterMember_*_active_idx`, `InvitationCode_centerId_expiresAt_idx`, `OnboardingDismissal_centerId_idx` | Volcado final; mismas migraciones |
| 3. `app_private` | Esquema `AUTHORIZATION postgres` sin acceso para `PUBLIC`/`anon`/`authenticated`/`service_role`; `is_center_member(uuid)` y `has_center_role(uuid, text[])` (`SECURITY DEFINER`, `search_path = public`) con `EXECUTE` solo para `authenticated` | `kurova-app-private.sql`; `20260830120000_security_definer_private_schema`; cuerpos de `20260721201000`; ACL de función de `20260712190300` y `20260712190400_revoke_anon_rls_functions` |
| 4. RLS | `ENABLE ROW LEVEL SECURITY` en las 5 tablas y en `_prisma_migrations` | Volcado final |
| 5. Políticas | `profile_self_*`, `center_member_read`, `center_owner_archive`, `center_member_list`, `invitation_admin_*`, `onboarding_dismissal_self_*` (texto idéntico al volcado) | Volcado final; `20260722110000_split_invitation_onboarding_rls` |
| 6. Privilegios | `REVOKE ALL` y luego `GRANT` del conjunto final exacto; `_prisma_migrations` sin privilegios para la API | Volcado final + `20260722110000`, `20260831130000_harden_prisma_migrations_acl`, `20261106100000_revoke_excess_api_privileges` |
| 7. Último dueño | `public.guard_center_last_owner()` + constraint trigger diferido `CenterMember_last_owner_guard`; `EXECUTE` revocado a `PUBLIC`/`anon`/`authenticated` | `20260921100000_center_last_owner_guard`; bloque 4 de `20261106100000` |

Las funciones se crean directamente en `app_private`, en vez de crearlas en
`public` y moverlas después, y no hay paso intermedio con políticas `FOR ALL`.
La migración es idempotente donde es razonable: `IF NOT EXISTS`,
`CREATE OR REPLACE`, `DROP POLICY/TRIGGER IF EXISTS` y `REVOKE` seguido de `GRANT`.

## Qué se excluyó y por qué

- **Triggers `kurova_guard_row`/`kurova_guard_trunc` y el esquema `kurova_guard`.**
  Solo existen en una copia local de Kurova; no forman parte del producto.
- **`Center.nameChangedAt`, el trigger `Center_name_change_guard` y la función `guard_center_name_change`.**
  El límite de 30 días para renombrar no se porta.
- **`CenterMember.schedulable`.** Es una columna de la agenda de Kurova, y la
  agenda está fuera de alcance (`AGENTS.md`). Si se decide portarla, basta con
  `ALTER TABLE "CenterMember" ADD COLUMN schedulable boolean DEFAULT false NOT NULL`.
- **Objetos de tablas de dominio de Kurova.** Columnas `centerId` y políticas de
  `Supplier`, `Product`, `Client`, etc., y `prevent_service_quote_supplies`.
- **`ALTER DEFAULT PRIVILEGES`.** No se crean.
- **Diferencias del volcado que contradicen migraciones explícitas.** El volcado
  concede `DELETE` a `authenticated` en `InvitationCode` y `OnboardingDismissal`,
  y privilegios a `anon` y `authenticated` sobre `_prisma_migrations`. Las
  migraciones `20260722110000` y `20260831130000` los revocan. Es consistente
  con una copia local reconstruida con los privilegios por defecto de Supabase
  más `20261106100000`, así que aquí se aplica el estado que fijan esas
  migraciones.

## Lista de verificación esperada

RLS activado en las 6 tablas. `anon` y `PUBLIC` no tienen privilegios sobre
ninguna. `service_role` tiene `ALL` en las 5 tablas del núcleo; sobre
`_prisma_migrations` no se modifica. Ninguna tabla concede `TRUNCATE`,
`REFERENCES` ni `TRIGGER` a `anon` ni a `authenticated`. Con PostgreSQL 17 o
superior, `authenticated` también tiene `MAINTAIN` en las 5 tablas, como en el
volcado.

| Tabla | `anon` | `authenticated`: privilegios | `authenticated`: políticas |
|---|---|---|---|
| `Profile` | ninguno | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `profile_self_select` / `_insert` / `_update` (`id = auth.uid()`). Sin política `DELETE`, así que borra 0 filas |
| `Center` | ninguno | `SELECT`, `UPDATE` | `center_member_read` (miembro activo de un taller activo); `center_owner_archive` (solo un `OWNER` activo, solo `active` true → false) |
| `CenterMember` | ninguno | `SELECT` | `center_member_list` (filas propias o del taller donde es miembro activo) |
| `InvitationCode` | ninguno | `SELECT`, `INSERT`, `UPDATE` | `invitation_admin_select` / `_insert` / `_update` (`OWNER`/`ADMIN` activos) |
| `OnboardingDismissal` | ninguno | `SELECT`, `INSERT`, `UPDATE` | `onboarding_dismissal_self_select` / `_insert` / `_update` (`userId = auth.uid()` y miembro activo) |
| `_prisma_migrations` | ninguno | ninguno | ninguna (`SERVER_ONLY`) |

Funciones:

- [ ] `app_private`: `USAGE` solo para su dueño (`postgres`). Las funciones no se pueden llamar por RPC.
- [ ] `app_private.is_center_member` y `app_private.has_center_role`: `EXECUTE` solo para `authenticated`; nada para `PUBLIC`, `anon` ni `service_role`.
- [ ] `public.guard_center_last_owner`: sin `EXECUTE` para `PUBLIC`, `anon` ni `authenticated`.
- [ ] Quitar o degradar al último `OWNER` activo de un taller activo falla con `23514` al confirmar la transacción. En un taller archivado se permite.
