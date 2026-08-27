# Pi Teacher

**[Lee esto en español](README.es.md)**

A one-to-one AI tutor inside Obsidian. Pi Teacher probes what you already know, plans the lesson as a dependency graph, and walks you through it one step at a time — quizzing you at every step, proposing flashcards for spaced repetition, and saving what you learned as knowledge notes in your vault.

It runs the [pi](https://github.com/badlogic/pi-mono) agent harness locally and uses the models and authentication you have already configured in Pi — including subscriptions and API-key providers such as OpenAI/ChatGPT and OpenCode.

> Desktop only (`isDesktopOnly: true`). Requires Obsidian 1.5.7+.

## How it teaches

1. **Probe.** You say what you want to learn; the teacher asks questions to find your real level instead of assuming it.
2. **Plan.** It builds a lesson graph — concepts and their dependencies — and tracks your progress concept by concept in a progress bar.
3. **Walk.** One reasoning step at a time, with LaTeX and Mermaid rendered exactly like in your notes.
4. **Quiz.** Interactive multiple-choice and free-form quizzes at every step.
5. **Reinforce.** Flashcard decks are proposed and saved for spaced repetition; lesson summaries are saved as knowledge notes with a Mermaid concept map.

## Features

- Chat side panel with streaming responses, abort, and chat history (searchable, grouped by date).
- Uses Pi's shared local configuration (`~/.pi/agent`), including its authenticated providers and custom `models.json` entries.
- Model and thinking-effort selectors right in the composer; it lists only models currently available in Pi.
- Optional loading of trusted local Pi extensions when an additional provider is supplied by an extension.
- Attach images (paste or file), the active Markdown note, or PDFs (text extraction with page ranges).
- Bilingual interface: English and Spanish, following Obsidian's language by default.
- Vault-scoped tools (read, write, edit, ls, find, grep) with an optional, allowlisted bash sandbox. Write and bash are **off by default** and require explicit opt-in.
- Sessions stored locally as JSONL under `<vault>/.pi/agent/sessions/`.

## Installation

### From a GitHub release (recommended)

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest).
2. Create the following folder in your vault and place those files inside it:
   ```text
   <vault>/.obsidian/plugins/pi-teacher/
     main.js
     manifest.json
     styles.css
   ```
3. Restart Obsidian (or reload it) and enable **Pi Teacher** in **Settings → Community plugins**.

> Pi Teacher is ready for installation from the Obsidian Community directory and through BRAT: its runtime and required static assets are bundled into `main.js`.

### From source

```bash
git clone https://github.com/FranciszekaMateu/pi-teacher.git
cd pi-teacher
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` from the repo root into `<vault>/.obsidian/plugins/pi-teacher/`.

## Setup

1. Open **Settings → Pi Teacher**.
2. In Pi, sign in or configure the provider you want to use. Pi Teacher reuses the local Pi configuration at `~/.pi/agent`; it never copies credentials into the vault.
3. Open **Pi Teacher** and select an available model from the composer controls.
4. If the provider comes from a Pi extension, enable **Load trusted Pi extensions** in the Pi Teacher settings first.
5. Optionally set the interface language (English, Spanish, or auto).
6. Open the chat with the **Open pi chat** command, the ribbon bot icon, or **Teach me something** to jump straight into a lesson.

## Usage

- Type what you want to learn, or tap a suggestion chip on the empty screen.
- Answer quizzes directly in the chat (options or free-form).
- **Save note** writes a knowledge note (summary, quizzes, concept map, sources) into your vault.
- Use **Chats** to browse, search, reopen, or delete past lessons.
- Press **Enter** to send, **Shift+Enter** for a new line.

## Privacy and security

- **What is sent to the model provider:** your prompts, the conversation history, vault content returned by tools, and tool results. Nothing else. No telemetry.
- **What stays local:** Pi credentials and provider configuration remain in `~/.pi/agent`; chat sessions remain under `<vault>/.pi/agent/sessions/`. Pi Teacher does not copy or display credentials.
- **Vault access is read-only by default.** Write/edit tools and the bash tool (allowlisted commands, per-command timeout) require explicit opt-in in settings, and every mutation asks for confirmation by default.
- Tool paths must be vault-relative; absolute paths and `..` escapes are rejected, and the plugin's own internals are off-limits.

## Architecture

Pi Teacher runs two processes:

```text
Obsidian renderer                 Node child process
┌──────────────────┐  JSONL RPC   ┌──────────────────────────┐
│ React chat panel  │ ───────────▶ │ bundled Node RPC runtime   │
│ PiSessionService  │ ◀─────────── │ (pi agent harness +       │
└──────────────────┘              │  vault tools + OAuth)     │
                                  └──────────────────────────┘
```

- `src/main.ts` — plugin lifecycle, commands, settings tab.
- `src/pi/` — session service, RPC bridge, OAuth, protocol parsers (quiz, lesson, visual, flashcards), teacher prompt, bash sandbox, PDF tool.
- `src/ui/` — React chat panel and helpers (bilingual strings, icons, markdown/math rendering, history).
- `src/vault/` — vault-scoped tool implementations.
- `src/runtime/pi-runtime.ts` — Node-side entry point, statically bundled into `main.js`.

## Development

```bash
npm install     # install dependencies
npm run dev     # watch build
npm test        # vitest
npm run lint    # eslint
npm run build   # typecheck + production build
```

After each build, copy `main.js`, `manifest.json`, and `styles.css` into your vault's plugin folder and reload Obsidian. `npm version` bumps `manifest.json` and `versions.json` for you.

See [RELEASE.md](RELEASE.md) for the release checklist.

## Troubleshooting

- **Plugin fails to load:** check `<vault>/.obsidian/plugins/pi-teacher/load-error.txt` and the developer console.
- **Model errors:** refresh the provider login or configuration in Pi, then reopen the chat so Pi Teacher reloads its available models.

## Credits and license

Pi Teacher is a fork of [lhr0909/pi-obsidian](https://github.com/lhr0909/pi-obsidian) by Simon Liang, rebuilt around the [pi agent harness](https://github.com/badlogic/pi-mono) by Mario Zechner. Thank you both.

Licensed under [0-BSD](LICENSE).
