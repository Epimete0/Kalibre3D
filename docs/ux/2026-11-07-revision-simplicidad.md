# Revisión de simplicidad — Kalibre

Fecha: 7 de noviembre de 2026. Recorrido en celular (375 px) en local, con una cuenta nueva y un taller vacío, como lo viviría alguien que recién llega.

**Objetivo del producto:** que ordenar el negocio sea fácil. La app debe ayudar a llegar a ese resultado, no sumar trabajo.

---

## Lo que ya funciona bien

- **Registro y creación del taller:** son 2 pantallas cortas, con textos claros. La zona horaria viene preseleccionada.
- **Venta rápida:** con solo 2 datos (qué vendiste y en cuánto) queda registrada, cobrada y entregada. WhatsApp viene marcado, el cliente es opcional y el monto cobrado se completa solo con el total.
- **Detalle del pedido:** muestra en una sola pantalla las piezas, los cobros, el historial y el saldo.

## Lo que corregí en esta revisión

| Problema | Impacto | Estado |
|---|---|---|
| **El panel fallaba la primera vez en cada taller nuevo** ("No pudimos cargar esta sección"). Varias consultas creaban la configuración del taller al mismo tiempo y chocaban. | **Crítico:** era lo primero que veía cualquier persona nueva. | Corregido, con prueba real contra PostgreSQL que reproducía la falla (7 de 8 lecturas fallaban). |
| Las piezas escritas a mano quedaban guardadas como **PLA** sin que nadie eligiera material. | Datos falsos en los pedidos (Surko usa PETG). | Corregido: si no se elige material, queda vacío. |
| La pestaña del navegador decía "saas3d" en Pedidos, Clientes y Dinero. | Marca inconsistente. | Corregido: dice "Kalibre". |
| El cotizador mostraba el código interno "(QUOTED)" en un botón. | Jerga técnica visible. | Corregido. |

## Propuestas para hacerla más simple (por orden de impacto)

### 1. Primeros pasos guiados en el panel (alto impacto) — ✅ implementado
Un taller nuevo ve el panel lleno de ceros y no sabe por dónde empezar. Mientras falten datos, propongo mostrar arriba una lista de 3 pasos que se marcan solos:
1. **Registra tu primera venta** → lleva a Nueva venta.
2. **Configura tus costos** (luz por hora, comisión y envío de Mercado Libre) → lleva a Ajustes. Hoy la luz queda en $0 y el cotizador calcula de menos sin avisar.
3. **Agrega tu primera bobina** → lleva a Bobinas.

La lista desaparece cuando los tres pasos están hechos.

### 2. Nueva venta más corta (alto impacto) — ✅ implementado
Para una venta rápida, en el celular se ven en orden: tipo de registro, 6 canales, cliente, piezas, descuento, notas, cobro y total. Propuesta:
- Mostrar primero **qué vendiste y en cuánto**, que es lo único obligatorio. Canal y cliente pueden ir después.
- **Descuento y notas** quedan ocultos tras un enlace "Más opciones".
- **Recordar el último canal usado** en vez de marcar siempre WhatsApp.

### 3. Lenguaje más cercano (impacto medio, poco esfuerzo)
- "Resumen del mes (2026-11)" → **"Noviembre 2026"**, y las flechas de mes con nombre ("← Octubre").
- El registro pide "Código de invitación" a todos, aunque casi nadie lo tiene. Mejor un enlace "¿Te invitaron a un taller?", como ya hace la pantalla de crear taller.

### 4. Material desde el catálogo (impacto medio)
Al elegir una pieza del catálogo en una venta, hoy no se copia su material. Conviene copiarlo, y también ofrecer un selector de material opcional en las piezas escritas a mano, para que el control de filamento tenga datos reales.

### 5. Accesibilidad de formularios (impacto bajo, mejora general)
Los campos de cantidad y precio en Nueva venta no tienen su etiqueta conectada al campo. Funcionan, pero los lectores de pantalla no los anuncian bien, y tocar la etiqueta no enfoca el campo.

---

**Siguiente paso sugerido:** implementar 1 y 2. Son los que más ayudan a que alguien nuevo ordene su negocio desde el primer día.

---

## Segunda revisión (9 de noviembre de 2026): que la app guíe sola

Recorrido completo en celular por todas las pantallas, con la pregunta: ¿alguien que nunca usó Kalibre sabría qué hacer sin que nadie le explique?

| Hallazgo | Estado |
|---|---|
| "Nueva venta", la acción más frecuente, no estaba en la barra inferior; el Cotizador quedaba escondido en "Más". | ✅ Botón central **Vender** y **Cotizar** en la barra. |
| Tres nombres para cosas parecidas: "Mi taller", "Ajustes del taller" y "Configuración". | ✅ Ahora son **Mi cuenta** y **Mis costos**. |
| Un pedido por encargo no decía en qué etapa iba ni qué hacer después. | ✅ Línea de etapas con "Ahora" y "Siguiente paso". |
| Los estados vacíos decían "No se encontraron…" sin explicar para qué sirve la sección. En el Catálogo, el mensaje quedaba cortado dentro de una tabla. | ✅ Explican la sección y el primer paso. |
| Fechas "2026-11-07" y meses "2026-11". | ✅ "7 nov 2026" y "noviembre 2026". |
| Los botones -20/-50/-100 g de las bobinas no decían qué hacían. | ✅ "¿Imprimiste algo? Descuenta lo que usaste". |
| El Catálogo pedía precio de Mercado Libre aunque el taller no venda por ahí. | ✅ Se oculta según el perfil. |

### Pendiente, propuesto para la siguiente vuelta

- **Material en Nueva venta y copia desde el catálogo** (propuesta 4 de la primera revisión).
- **Descontar filamento al vender o al marcar "Imprimiendo"**: hoy se descuenta a mano en Bobinas. Requiere diseño, porque toca movimientos de stock.
- **Ayuda contextual "¿Qué es esto?"** en Dinero (ganancia neta, por cobrar) y en el detalle del pedido (saldo, anular).
- **Insumos** (NFC, argollas, imanes), ya anotado en `onyx.md`.
