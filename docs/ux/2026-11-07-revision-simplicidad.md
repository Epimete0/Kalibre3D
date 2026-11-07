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
