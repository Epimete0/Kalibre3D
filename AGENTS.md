# Contrato de Agentes — saas3d

Este proyecto es un SaaS multi-taller para la operación interna de makers y
talleres de impresión 3D. `onyx.md` es la fuente principal de verdad del
dominio, las reglas de negocio, la arquitectura y las decisiones históricas.

## Orden de autoridad

1. Instrucción explícita del usuario.
2. `onyx.md`.
3. Este archivo (`AGENTS.md`).
4. Documentación y especificaciones relacionadas.

Si cualquier convención externa contradice `onyx.md`, prevalece `onyx.md`.

## Identidad del producto

- El nombre comercial del producto está pendiente.
- `saas3d` se conserva como identificador técnico interno del paquete, la
  carpeta y los proyectos de infraestructura.
- Los identificadores técnicos `Center`, `CenterMember`, `centerId` y los roles
  `OWNER`, `ADMIN`, `PROFESSIONAL` y `VIEWER` se conservan del núcleo de Kurova
  sin cambios en código ni base de datos; en la interfaz visible se dice
  **Taller** (en lugar de "centro") y **Ayudante** (en lugar de "profesional").
- No cambiar cookies, imports, migraciones históricas ni `package.json` solo
  para unificar nombres cuando se defina la marca comercial.

## Forma de trabajo obligatoria

Antes de implementar cualquier cambio funcional:

1. Leer `onyx.md` y la documentación relacionada.
2. Auditar el código real afectado.
3. Identificar dependencias, impacto y riesgos.
4. Presentar hallazgos concretos.
5. Proponer el diseño y el plan.
6. Esperar aprobación cuando el cambio sea arquitectónico, de seguridad, RLS,
   autenticación, datos o concurrencia.
7. Implementar el cambio mínimo.
8. Añadir o actualizar pruebas.
9. Ejecutar revisión de seguridad.
10. Ejecutar el quality gate completo.
11. Actualizar `onyx.md`.
12. Sincronizar `CHANGELOG.md` si el cambio es funcionalmente visible.

No afirmar que una tarea está completamente cerrada si las pruebas reales de
RLS o transacciones no pudieron ejecutarse.

## Arquitectura

- Next.js 16, React 19 y TypeScript.
- App Router.
- Server Components para lecturas.
- Server Actions para mutaciones.
- Prisma 7 con PostgreSQL en Supabase.
- Supabase Auth para autenticación.
- Zod para validación en límites del servidor.
- Tailwind CSS 4 para interfaz.
- Vitest para pruebas.
- Vercel para despliegue.

No existe API REST propia. No crear una salvo decisión explícita.

Estructura:

- `src/app/`: rutas, páginas y Server Actions.
- `src/components/`: componentes de interfaz.
- `src/lib/`: consultas, servicios y reglas de dominio.
- `prisma/`: esquema y migraciones.
- `tests/`: pruebas de integración reales.
- `docs/`: especificaciones, planes y mejoras.
- `onyx.md`: contexto vivo y fuente de verdad del producto.

## Multi-centro y autorización

- `centerId` es obligatorio en toda consulta y mutación operativa.
- Toda consulta Prisma operativa debe filtrar explícitamente por `centerId`.
- RLS no sustituye los filtros de Prisma porque la aplicación usa una conexión
  con privilegios propios.
- Validar sesión, membresía activa, centro (`centerId`) y rol en el servidor.
- Usar `requireAuthContext`, `requireCatalogContext` o
  `requireOperationalContext` según el caso.
- No confiar en datos enviados por el cliente para autorización.
- `VIEWER` solo consulta.
- `OWNER` y `ADMIN` administran configuración y catálogos.
- `PROFESSIONAL` solo puede ejecutar las operaciones permitidas por el dominio.

## RLS

- Toda tabla expuesta debe tener RLS habilitado.
- Las políticas de lectura deben separarse de las políticas de escritura.
- No usar `FOR ALL` en políticas de escritura.
- Definir políticas separadas para `SELECT`, `INSERT`, `UPDATE` y `DELETE`
  cuando correspondan.
- Las políticas `UPDATE` deben tener `USING` y `WITH CHECK`.
- Las políticas deben validar centro, membresía y rol.
- No usar `auth.role()` para autorización.
- No usar `user_metadata` para decisiones de autorización.
- Las funciones `SECURITY DEFINER` requieren auditoría de `auth.uid()`,
  `centerId`, `search_path`, grants y exposición mediante RPC.
- No crear `SECURITY DEFINER` para resolver errores de permisos.

Las restricciones de unicidad, normalización y negocio deben vivir también en
PostgreSQL mediante índices, constraints, funciones controladas y
`USING`/`WITH CHECK`. La Server Action no es la única defensa.

Antes de proponer cambios sobre RLS, autenticación, creación o eliminación de
datos, o piezas centrales de autorización como `requireAuthContext`, auditar el
código real y presentar hallazgos concretos antes de escribir.

## Eliminación y ciclo de vida

- No borrar físicamente registros históricos.
- Usar baja lógica con `active = false`.
- Un pedido con pagos o eventos no se borra: se cancela (`status = CANCELED`).
- No eliminar clientes, piezas de catálogo (`Product`), bobinas (`Spool`) o
  registros referenciados.
- La única excepción actual es el producto nunca usado.
- El producto solo puede eliminarse si comprobaciones `NOT EXISTS` confirman
  que no tiene pedidos ni movimientos reales.
- El movimiento de stock inicial no cuenta como uso real.
- Toda nueva excepción requiere documentación en `onyx.md`, defensa en
  Server Action y defensa en base de datos/RLS.

## Stock, filamento y transacciones

- Ninguna pantalla modifica `Product.currentStock` ni `Spool.remainingGrams`
  directamente.
- El stock de piezas (`Product`) y los gramos de bobina (`Spool`) solo cambian
  mediante movimientos inmutables (`ProductMovement`, `SpoolMovement`).
- Los movimientos son inmutables y ninguna pieza ni bobina queda en negativo.
- Las correcciones se representan con movimientos compensatorios o ajustes.
- Las operaciones que modifican stock o filamento deben usar transacciones y
  bloquear filas con `FOR UPDATE` cuando exista riesgo de carrera (ordenando los
  bloqueos determinísticamente cuando se bloqueen varios registros).
- Los cambios de estado en pedidos (`Order`) exigen la `version` actual,
  bloquean el pedido con `FOR UPDATE`, incrementan `version` y registran un
  `OrderEvent` inmutable en la misma transacción.
- Crear pedido, registrar pago y registrar movimientos de stock o filamento son
  operaciones idempotentes por `operationId` (`UNIQUE (centerId, operationId)`).
- El costo por gramo de un material es el promedio de sus bobinas activas (o
  `defaultCostPerKg / 1000` si no hay bobinas activas).

## Concurrencia

Antes de corregir cualquier problema concurrente:

1. Describir la intercalación exacta de operaciones.
2. Crear una prueba real contra PostgreSQL.
3. Ejecutarla y observar el fallo.
4. Aplicar la corrección.
5. Ejecutar nuevamente la prueba para demostrar la corrección.

No considerar suficiente una prueba unitaria simulada para carreras de base de
datos.

## Validación y errores

- Validar toda entrada externa con Zod.
- Revalidar en el servidor entidades, centro, estado y permisos.
- No confiar en valores calculados por la UI.
- Usar `notFound()` para recursos inexistentes.
- Devolver mensajes de error comprensibles en español.
- No exponer credenciales, SQL interno, stack traces ni datos de otros centros.
- No introducir HTML sin sanitización explícita.

### Convención de mensajes

- Los mensajes visibles comienzan con mayúscula y terminan con punto.
- Los errores de dominio describen la regla concreta y, cuando corresponde,
  la acción que debe realizar la persona.
- Los errores inesperados usan el patrón `No fue posible {acción}. Intenta
  nuevamente.` y nunca exponen `Error.message`, SQL, stack traces ni detalles
  de proveedores externos.
- Los mensajes de éxito usan `{Recurso} {acción} correctamente.` o `Estado de
  {recurso} actualizado correctamente.`
- Los textos de carga pueden usar puntos suspensivos, por ejemplo `Guardando…`;
  los mensajes persistentes no.
- Si varias validaciones afectan el mismo campo, se muestran en el orden de
  Zod separadas por ` · `; los errores asociados a líneas conservan su índice.

## Alcance

No proponer como funcionalidad normal:

- Integración con la API de Mercado Libre.
- Cobro de suscripción o pagos.
- Facturación o integración con el SII.
- Tienda online.
- Agenda.
- IA.
- Marketing.
- CRM avanzado.

Cualquiera de estas áreas requiere una decisión explícita del producto.

## MCP

### Supabase

Usar para consultar esquema, funciones, grants, advisors, migraciones, logs y
diagnósticos SQL. No ejecutar automáticamente borrados, cambios de RLS,
cambios de Auth, revocación de grants ni migraciones destructivas.

### Vercel

Usar para revisar deployments, previews, errores y logs. No desplegar a
producción sin autorización explícita.

## Hooks

No hay hooks locales de `saas3d` y no se agregan hooks modificadores por ahora.
No activar formateo automático, fixes automáticos, migraciones automáticas ni
aplicación automática de cambios de seguridad. Los hooks informativos, como
avisos de secretos o recordatorios del quality gate, quedan para una fase futura.

## Quality gate

El comando único de validación es:

```bash
npm run quality:gate
```

Ejecuta tests, lint, build, estado de migraciones y, si Supabase local está
disponible, las pruebas reales de RLS y transacciones.

Si Docker Desktop o Supabase local no están disponibles, ejecuta las
validaciones locales, informa las pruebas omitidas y termina con estado no
exitoso. La tarea queda incompleta para efectos de seguridad y transacciones.
No usar la base remota normal para pruebas destructivas.

## Documentación obligatoria

Todo cambio funcional relevante debe actualizar:

- `onyx.md`: alcance, modelo, reglas, migraciones y pruebas afectadas.
- `CHANGELOG.md`: cambios visibles para producto o usuarios.
- Especificaciones o planes relacionados, si existen.
