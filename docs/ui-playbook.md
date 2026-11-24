# Playbook de Diseño UI, Animación y Calidad de Código para Agentes IA

> **Objetivo:** Evitar interfaces genéricas repetitivas y código desordenado en **Kalibre** (`saas3d`). Antes de construir o modificar una interfaz o funcionalidad, sigue este mapa de skills, referencias y reglas técnicas. En caso de conflicto de dominio o negocio, prevalece `onyx.md`.

---

## 1. Regla de Oro (Anti-Genérico)

Antes de escribir código de UI para un proyecto nuevo o una pantalla importante:
1. **No reutilices el mismo esquema por defecto** (tarjetas idénticas, gradientes genéricos, íconos planos sin criterio, animaciones `fade-up` repetidas en todo).
2. Define explícitamente antes de implementar:
   - **Dirección visual** (tono, densidad, tipografía y jerarquía).
   - **Sistema de color 60–30–10** expresado en tokens semánticos (`globals.css`: Arena cálido / Carbón & Crema / Azul eléctrico).
   - **Paquete de íconos y estilo de componentes** acorde al producto (ver Sección 6).
   - **1–2 detalles distintivos de interacción o scroll** con propósito real.

---

## 2. Mapa de Enrutamiento de Skills (1 titular por etapa)

Usa **un solo skill titular por etapa** en lugar de mezclar múltiples skills de diseño a la vez:

| Etapa / Tarea | Skill titular (instalado) | Cuándo invocarlo |
|---|---|---|
| **Diseñar UI desde cero (Web / App)** | `high-end-visual-design` *(o `frontend-design`)* | Al crear una app, dashboard o pantalla nueva para fijar estética, tipografía y espaciado. |
| **Landing cinematográfica / Hero** | `motionsites-web-builder` | Solo en landings de marketing/presentación de alto impacto visual. |
| **Mejorar UI existente que se ve genérica** | `redesign-existing-projects` *(o `refactoring-ui`)* | Cuando la pantalla ya funciona pero necesita mejor jerarquía, contraste y pulido visual. |
| **Criterio de UX y animación UI** | `emil-design-eng` | Siempre que diseñes microinteracciones, transiciones, modales, popovers o feedback táctil. |
| **Decidir qué animar y optimizar motion** | `find-animation-opportunities` + `improve-animations` / `animation-performance` | Para auditar qué sí/no animar y corregir animaciones lentas o pesadas. |
| **Animaciones ligadas al scroll** | `scroll-world` | Al implementar secciones sticky, text-reveal, scale-in o indicadores de lectura. |
| **Auditoría UX y accesibilidad** | `web-design-guidelines` | Antes de cerrar una pantalla: contraste, teclado, semántica y buenas prácticas web. |
| **Código limpio React / Next.js** | `vercel-react-best-practices` + `vercel-composition-patterns` + `next-best-practices` | Al estructurar componentes, estado, data fetching y evitar proliferación de props booleanas. |
| **Debugging, verificación y seguridad** | `systematic-debugging` + `verification-loop` + `security-review` | Ante bugs, antes de dar una tarea por terminada y al revisar auth/APIs/datos sensibles. |

### Skills externos open source recomendados (opcionales)
- **Seguridad profunda (antes de releases o PRs críticos):** `cloudflare/security-audit-skill` — auditoría multifase con estado en disco y verificación adversarial contra falsos positivos.
- **Limpieza final de "AI slop" en UI:** `felipebasurto/unslop-ui` — limpia copy y decoración típica de IA sin tocar lógica ni accesibilidad.
- **Especificaciones técnicas de componentes (handoff UI):** `enesozturk/dimensional-drawing` — genera planos técnicos con medidas, márgenes, radios y reglas `HUG`/`FILL`.

---

## 3. Filtro Anti-"AI Slop" (Obligatorio antes de entregar UI)

Aplica un pase sustractivo antes de cerrar cualquier pantalla o landing:
- **Eliminar etiquetas diminutas en mayúsculas (*eyebrow labels*)** encima de cada título si no aportan jerarquía real.
- **Eliminar prefijos numéricos decorativos** (`01 //`, `02 //`, `MOD-01`, `TOOL-01`) en listas que no son una secuencia real.
- **Eliminar subtítulos redundantes** que solo parafrasean el título principal.
- **Eliminar microcopy obvio** (*"Haz clic en el botón de arriba para continuar"*).
- **Prohibido poner indicadores falsos:** nada de puntos verdes `"LIVE"`, badges `"Synced"` o métricas inventadas que no estén conectados a un estado o dato real del código.
- **Nunca romper accesibilidad al limpiar:** preservar siempre `aria-label`, `alt`, labels visibles de formularios y estados de foco.

---

## 4. Sistema de Color (Regla 60–30–10 en Tokens)

No hardcodees colores hexadecimales sueltos por los componentes. Define siempre tokens semánticos:
- **60% Principal (`--color-canvas`):** superficie dominante limpia y descansada.
- **30% Secundaria (`--color-surface` / `--color-raised` / `--color-ink`):** estructura, tarjetas, tipografía y contraste base.
- **10% Impacto (`--color-primary`):** exclusivamente para CTAs principales, estados activos y foco visual.
- **Verificación WCAG:** si el color de acento es muy saturado o brillante, valida su contraste antes de usarlo en texto pequeño (úsalo en superficies/botones con texto contrastado o en íconos/bordes).

---

## 5. Principios de UX, Microinteracciones y Scroll

### Límites numéricos y reglas técnicas duras
- **Doherty threshold:** feedback o respuesta inicial en **< 400 ms** (preferir consultas paralelas con `Promise.all`, resultados progresivos o *optimistic UI* frente a waterfalls lentos).
- **Timing de animaciones UI:** mantener transiciones en **< 300 ms** (rango ideal habitual: `150–220 ms`).
- **Frequency of use:** si el usuario ejecuta una acción decenas de veces al día (cambiar pestañas frecuentes, filtros, atajos de teclado), **omitir o acortar al mínimo la animación**.
- **Interruptible motion:** toda animación debe poder interrumpirse o revertirse a mitad de camino (usar transiciones CSS o *springs*; nunca bloquear clics esperando `onAnimationEnd`).
- **Origin awareness:** popovers, tooltips y menús deben nacer desde el elemento que los dispara (`transform-origin`), nunca escalar desde un centro arbitrario.
- **Slow in, slow out:** evitar `linear` en interfaces; usar curvas `ease-out` / `ease-in-out` o *springs*.
- **Rendimiento y accesibilidad:** animar solo propiedades compuestas por GPU (`transform`, `opacity`) y respetar siempre `prefers-reduced-motion` (tanto en `animation-duration` como en `transition-duration`).

### Principios UX y de movimiento de apoyo (usar con criterio)
- **UX:** *Fitts's law* (targets importantes más grandes y cercanos), *Hick's law* (reducir opciones simultáneas a lo esencial), *Von Restorff effect* (destacar visualmente la opción recomendada), *Peak-end rule* (cerrar flujos clave como confirmación de venta o guardado con feedback claro).
- **Motion:** *Staggering* (entrada escalonada sutil en grillas de landing), *Follow-through*, *Secondary action*, *Squash & stretch* (elasticidad sutil en pills/tabs), *Rubber banding*, *Anticipation*, *Exaggeration* (solo en alertas críticas), *Arcs* y *Solid drawing*.

### Catálogo de 8 estilos de scroll
Elegir **máximo 1–2 patrones protagonistas en una landing**; en apps/dashboards de uso diario, usar solo los marcados como sutiles:

| Patrón | Qué hace | Dónde conviene |
|---|---|---|
| **01 Fade up** | Bloques suben y aparecen al entrar al viewport | Landings y secciones de contenido (sutil) |
| **02 Parallax** | Capas a distinta velocidad para dar profundidad | Solo landings editoriales/marketing (evitar en apps) |
| **03 Sticky** | Sección fija (`position: sticky`) cuyo contenido cambia por pasos | Explicación de features paso a paso |
| **04 Horizontal scroll** | Scroll vertical que desplaza tarjetas lateralmente | *Case studies* o galerías visuales (siempre con indicador) |
| **05 Scale in** | Imagen o media que crece hasta ancho completo | Showcases de producto o colecciones |
| **06 Text reveal** | Palabras que se iluminan progresivamente al scrollear | Una frase clave o manifiesto (máx. 1 por página) |
| **07 Stagger** | Tarjetas de una grilla aterrizan una tras otra | Landings / grillas en carga inicial (sutil, `< 300 ms`) |
| **08 Progress bar** | Barra fina superior indicando avance de lectura | Landings largas, docs y flujos de onboarding (sutil) |

*(Implementación preferida: CSS Scroll-Driven Animations `animation-timeline: view()/scroll()` o `IntersectionObserver`; usar Framer Motion `useScroll`/`useTransform` solo cuando se requiera control vinculado fino).*

---

## 6. Banco de Referencias, Componentes e Íconos

Consulta estas fuentes cuando necesites inspiración real de componentes, microinteracciones o estilo visual antes de proponer una solución genérica:

| Recurso | URL | Categoría | Cuándo consultarlo / usarlo |
|---|---|---|---|
| **60fps.design** | https://60fps.design | Motion & Microinteracciones | Referencia de animaciones reales de apps top (`Shots`, `Motion`, `Snippets`, `Glossary`). |
| **Dqnamo Kitchen** | https://dqnamo.com/kitchen | Componentes React | Inspiración de componentes React componibles e interactivos (cards, listas con fade, microinteracciones). |
| **Oreo Doodle Icons** | https://oreoui.com/doodle-icons | Íconos | Cuando el producto busque una estética ilustrada, cercana o dibujada a mano (personalizable/animable). |
| **Shipframe** | https://getshipframe.com | Release / Tiendas | Al preparar screenshots profesionales para App Store y Google Play. |

### Paquetes de íconos preferidos
> **Instrucción para la IA:** No asumas siempre el mismo set de íconos por defecto. Revisa esta tabla y elige (o propone) el paquete que mejor encaje con la identidad del proyecto:

| Paquete / Fuente | Instalación / URL | Estilo visual | Ideal para |
|---|---|---|---|
| **SVG técnico a medida (`Sidebar.tsx`)** | Integrado en proyecto | Trazo técnico 1.7 px geométrico | Navegación e instrumentos propios de Kalibre 3D |
| **Oreo Doodle Icons** | https://oreoui.com/doodle-icons | Dibujado a mano / animado | Apps creativas, personales, educativas o con tono lúdico |

---

## 7. Checklist Final antes de Entregar Código

1. **Composición y mantenibilidad:** ¿Los componentes están bien separados, tipados y sin lógica duplicada ni exceso de props booleanas?
2. **Identidad visual:** ¿Tiene tokens semánticos (60–30–10), tipografía coherente y evita el esquema genérico de siempre?
3. **Anti-AI-slop:** ¿Se eliminaron subtítulos redundantes, labels decorativos inútiles y badges falsos?
4. **UX, Motion y Accesibilidad:** ¿Animaciones `< 300 ms`, interrumpibles, con `prefers-reduced-motion`, foco visible y contraste correcto?
5. **Verificación y seguridad:** ¿Se ejecutó build/tests y se revisaron permisos, validación de inputs y manejo de errores en rutas críticas?
