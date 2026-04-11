# Centaur

Browser-based UI companion for terminal coding agents. Formerly Atrium. See IDEAS.md #15 for the product vision.

## Quick orientation

Four tools: `review_document`, `respond_to_review`, `ask_questions`, `export_pdf`.
Two adapters: MCP (`src/mcp/`) for Claude Code, Pi (`src/pi/`) for Pi.
One shared core: `src/core/` — agent-agnostic, pure Node.js, no frameworks.

All tool schemas, descriptions, validation, and `run()` functions live in **`src/tools/manifest.js`**. Both adapters import from there — this is the single source of truth for tool behavior.

## How to run

```bash
npm install                # one-time
node bin/mcp-server.js     # starts MCP server on stdio (for testing / debugging)
```

For integration, configure the MCP server path or Pi symlink per `README.md`.

## Architecture at a glance

```
tools/manifest.js  →  defines all tools (schema + run function)
    ↓
mcp/server.js      →  registers tools with MCP SDK (Zod schemas, stdio)
pi/index.ts        →  registers tools with Pi extension API (TypeBox schemas)
    ↓
core/form.js       →  openForm(): builds HTML, serves on random port, waits for submit
core/review.js     →  openReview(): creates ReviewSession, SSE-based multi-turn loop
core/pdf.js        →  markdownToPdf(): headless Chrome via puppeteer-core
    ↓
core/transport/    →  HTTP server, browser opening, SSE, request parsing
core/html/         →  self-contained HTML builders (no external assets)
```

## Key patterns to know

- **Transport:** Every browser interaction uses a temporary HTTP server on `127.0.0.1:0` (OS-assigned port). Forms use one-shot `serveHtmlAndWait()`. Reviews use `ReviewSession` with SSE for bidirectional communication.
- **HTML is self-contained:** Each HTML builder produces a complete document with inline CSS and JS. No bundler, no external CDN, no asset pipeline.
- **Tool manifest is the source of truth:** `src/tools/manifest.js` defines tool names, descriptions, input schemas (using a simple `{ kind, description, optional }` DSL), validation, and run functions. Adapters convert this to their framework's schema format.
- **Review sessions are stateful:** `src/core/sessions.js` holds a `Map<id, ReviewSession>`. Sessions auto-close after 1 hour of inactivity or when the user clicks Submit.

## How to add or modify a tool

1. Define the tool in `src/tools/manifest.js` — add an entry to the `toolDefinitions` array with `name`, `description`, `input` schema, and `run` function.
2. Implement the core function in `src/core/` — it should be agent-agnostic.
3. Both adapters pick it up automatically since they iterate `toolDefinitions`.

## How to add a new adapter

1. Import `toolDefinitions` from `src/tools/manifest.js`.
2. For each tool: register with the framework's API, converting `tool.input` to the framework's schema format.
3. In the handler: call `tool.run(params)` and format the result.

See `src/mcp/server.js` (~80 lines) or `src/pi/index.ts` (~50 lines) as templates.

## Gotchas

- **`export_pdf` requires Chrome/Chromium.** It uses `puppeteer-core` (not `puppeteer`), so it won't download a browser. The code looks in standard paths (`/Applications/Google Chrome.app/...`, `/usr/bin/chromium`, etc.) or reads `CHROME_PATH`.
- **Pi adapter is TypeScript.** Pi handles TS compilation at runtime — no build step needed.
- **No test suite yet.** Verify changes manually by running the MCP server and calling tools.
- **`review_document` is multi-turn.** It doesn't return once — the first response may be a `question` or `edit_request` that requires `respond_to_review`. Loop until `status: "complete"` or `status: "session_closed"`.

## Arena

Project: **Centaur** in team ATHN.
