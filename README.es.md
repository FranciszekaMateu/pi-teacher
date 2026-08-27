# Pi Teacher

**[Read this in English](README.md)**

Un tutor de IA uno-a-uno dentro de Obsidian. Pi Teacher sondea lo que ya sabes, planifica la lección como un grafo de dependencias y te guía paso a paso — con quizzes en cada paso, flashcards para repetición espaciada y notas de conocimiento guardadas en tu vault.

Ejecuta el harness de agente [pi](https://github.com/badlogic/pi-mono) localmente y usa los modelos y la autenticación que ya tengas configurados en Pi —incluidas suscripciones y proveedores con API key como OpenAI/ChatGPT u OpenCode.

> Solo escritorio (`isDesktopOnly: true`). Requiere Obsidian 1.5.7+.

## Cómo enseña

1. **Sondeo.** Dices qué quieres aprender; el profesor pregunta para descubrir tu nivel real en vez de asumirlo.
2. **Plan.** Construye un grafo de lección — conceptos y sus dependencias — y sigue tu progreso concepto por concepto en una barra de progreso.
3. **Caminata.** Un paso de razonamiento a la vez, con LaTeX y Mermaid renderizados igual que en tus notas.
4. **Quiz.** Quizzes interactivos de opción múltiple y de respuesta libre en cada paso.
5. **Refuerzo.** Propone mazos de flashcards para repetición espaciada y guarda resúmenes de lección como notas de conocimiento con mapa de conceptos en Mermaid.

## Funciones

- Panel lateral de chat con respuestas en streaming, aborto e historial de chats (con búsqueda y agrupado por fecha).
- Usa la configuración local compartida de Pi (`~/.pi/agent`), con sus proveedores autenticados y entradas personalizadas de `models.json`.
- Selectores de modelo y esfuerzo de razonamiento directamente en el compositor; muestra solo los modelos disponibles en Pi.
- Carga opcional de extensiones locales confiables de Pi cuando un proveedor adicional proviene de una extensión.
- Adjunta imágenes (pegar o archivo), la nota Markdown activa o PDFs (extracción de texto con rangos de páginas).
- Interfaz bilingüe: inglés y español, siguiendo el idioma de Obsidian por defecto.
- Herramientas con alcance al vault (read, write, edit, ls, find, grep) y un sandbox de bash opcional con lista de permitidos. Write y bash están **desactivados por defecto** y requieren opt-in explícito.
- Sesiones guardadas localmente como JSONL en `<vault>/.pi/agent/sessions/`.

## Instalación

### Desde un release de GitHub (recomendado)

1. Descarga **`pi-teacher-<versión>.zip`** del [último release](../../releases/latest).
2. Extrae el zip en la carpeta de plugins de tu vault. Debe quedar así:
   ```text
   <vault>/.obsidian/plugins/pi-teacher/
     main.js
     manifest.json
     styles.css
     pi-runtime.cjs
     pdf.worker.mjs
     runtime-assets/
   ```
3. Reinicia (o recarga) Obsidian y activa **Pi Teacher** en **Settings → Community plugins**.

> **¿Por qué no BRAT ni el directorio comunitario?** El plugin incluye archivos extra de runtime (`pi-runtime.cjs`, `pdf.worker.mjs`, `runtime-assets/`) además de los tres estándar, y ni BRAT ni el canal comunitario oficial distribuyen archivos extra. Usa el zip. Incluir el runtime dentro de `main.js` para poder entrar al directorio comunitario está en el roadmap.

### Desde el código fuente

```bash
git clone https://github.com/FranciszekaMateu/pi-teacher.git
cd pi-teacher
npm install
npm run build
```

Luego copia `main.js`, `manifest.json`, `styles.css`, `pi-runtime.cjs`, `pdf.worker.mjs` y `runtime-assets/` desde la raíz del repo a `<vault>/.obsidian/plugins/pi-teacher/`.

## Configuración

1. Abre **Settings → Pi Teacher**.
2. En Pi, inicia sesión o configura el proveedor que quieras usar. Pi Teacher reutiliza la configuración local de Pi en `~/.pi/agent`; no copia credenciales al vault.
3. Abre **Pi Teacher** y elige un modelo disponible desde los controles del compositor.
4. Si el proveedor viene de una extensión de Pi, activa antes **Load trusted Pi extensions** en los ajustes de Pi Teacher.
5. Opcionalmente configura el idioma de la interfaz (inglés, español o auto).
6. Abre el chat con el comando **Open pi chat**, el icono del bot en la ribbon, o **Teach me something** para entrar directo a una lección.

## Uso

- Escribe lo que quieres aprender, o toca un chip de sugerencia en la pantalla vacía.
- Responde los quizzes directamente en el chat (opciones o respuesta libre).
- **Save note** guarda una nota de conocimiento (resumen, quizzes, mapa de conceptos, fuentes) en tu vault.
- Usa **Chats** para explorar, buscar, reabrir o eliminar lecciones pasadas.
- Pulsa **Enter** para enviar, **Shift+Enter** para nueva línea.

## Privacidad y seguridad

- **Lo que se envía al proveedor del modelo:** tus prompts, el historial de conversación, el contenido del vault devuelto por herramientas y los resultados de herramientas. Nada más. Sin telemetría.
- **Lo que queda local:** las credenciales y configuración de proveedores de Pi permanecen en `~/.pi/agent`; las sesiones de chat siguen en `<vault>/.pi/agent/sessions/`. Pi Teacher no copia ni muestra credenciales.
- **El acceso al vault es de solo lectura por defecto.** Las herramientas de escritura y el bash (comandos en lista de permitidos, timeout por comando) requieren opt-in explícito en ajustes, y toda mutación pide confirmación por defecto.
- Las rutas de herramientas deben ser relativas al vault; se rechazan rutas absolutas y escapes con `..`, y los internos del plugin están fuera de alcance.

## Arquitectura

Pi Teacher ejecuta dos procesos:

```text
Renderer de Obsidian            Proceso hijo de Node
┌──────────────────┐  RPC JSONL  ┌──────────────────────────┐
│ Panel React       │ ──────────▶ │ pi-runtime.cjs            │
│ PiSessionService  │ ◀────────── │ (harness pi + herramientas│
└──────────────────┘             │  de vault + OAuth)        │
                                 └──────────────────────────┘
```

- `src/main.ts` — ciclo de vida del plugin, comandos, pestaña de ajustes.
- `src/pi/` — servicio de sesión, puente RPC, OAuth, parsers de protocolo (quiz, lección, visual, flashcards), prompt del profesor, sandbox de bash, herramienta PDF.
- `src/ui/` — panel de chat en React y utilidades (textos bilingües, iconos, render markdown/mates, historial).
- `src/vault/` — implementación de herramientas con alcance al vault.
- `src/runtime/pi-runtime.ts` — punto de entrada empaquetado como `pi-runtime.cjs` (el lado Node).

## Desarrollo

```bash
npm install     # instalar dependencias
npm run dev     # build en modo watch
npm test        # vitest
npm run lint    # eslint
npm run build   # typecheck + build de producción (+ copia assets de runtime)
```

Tras cada build, copia los artefactos listados arriba a la carpeta del plugin en tu vault y recarga Obsidian. `npm version` actualiza `manifest.json` y `versions.json` por ti.

Consulta [RELEASE.md](RELEASE.md) para el checklist de releases (en inglés).

## Solución de problemas

- **El plugin no carga:** revisa `<vault>/.obsidian/plugins/pi-teacher/load-error.txt` y la consola de desarrollador.
- **"Pi runtime is missing":** no se copió el zip completo (o el build) — `pi-runtime.cjs` debe estar junto a `main.js`.
- **Errores de modelo:** renueva el login o la configuración del proveedor en Pi y vuelve a abrir el chat para que Pi Teacher recargue los modelos disponibles.

## Créditos y licencia

Pi Teacher es un fork de [lhr0909/pi-obsidian](https://github.com/lhr0909/pi-obsidian) de Simon Liang, reconstruido sobre el [harness de agente pi](https://github.com/badlogic/pi-mono) de Mario Zechner. Gracias a ambos.

Licencia [0-BSD](LICENSE).
