# Centaur

Browser-based UI companion for terminal coding agents.

When the terminal isn't enough — complex forms, document reviews, structured approvals — the agent opens a browser page where you can see, think, and respond. Then you step back into the terminal.

## Getting Started

**Prerequisites:** Node.js >= 18. For PDF export, Google Chrome or Chromium must be installed (or set `CHROME_PATH`).

```bash
git clone https://github.com/shlokkhemani/centaur.git
cd centaur
npm install
```

Then configure your agent (see [Install](#install) below).

## Primitives

| Tool | What it does | Input | Output |
|------|-------------|-------|--------|
| `review_document` | Open a document for inline human review | Title, markdown content or file path | Comments, questions, edit requests |
| `respond_to_review` | Reply to a question or edit request in an active review | Session ID, interaction ID, response | Next interaction or completion |
| `ask_questions` | Structured questionnaire (choices, text fields) | Title, questions | Key-value answers |
| `export_pdf` | Markdown → print-ready PDF | Title, markdown content or file path | PDF file path |

## Install

### Claude Code (MCP)

Add to your Claude Code MCP config (`~/.claude/settings.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "centaur": {
      "command": "node",
      "args": ["/absolute/path/to/centaur/bin/mcp-server.js"]
    }
  }
}
```

The MCP server communicates over stdio. Claude Code launches it automatically.

### Pi (Extension)

Symlink into pi's extension directory:

```bash
ln -s /absolute/path/to/centaur ~/.pi/agent/extensions/centaur
```

Pi auto-discovers the extension via the `pi.extensions` field in `package.json`. Pi handles TypeScript compilation at runtime — no build step needed.

### Any MCP Client

Centaur is a standard [MCP](https://modelcontextprotocol.io) server over stdio. Any client that supports MCP can use it:

```bash
node /absolute/path/to/centaur/bin/mcp-server.js
```

The server reads JSON-RPC from stdin, writes to stdout. Configure it in your client the same way you would any stdio-based MCP server — just point at `bin/mcp-server.js`.

## Usage

### `review_document` — the multi-turn review loop

This is the primary tool. The agent sends a document, the human reviews it in the browser, and they collaborate inline until the review is done.

**Opening a review:**

```json
{
  "title": "Migration Plan",
  "content": "## Phase 1\nDrop the legacy auth table..."
}
```

Or pass a file path instead:

```json
{
  "title": "Migration Plan",
  "file_path": "/path/to/plan.md"
}
```

**The response is one of three statuses:**

`status: "question"` — the human asked a question inline:
```json
{
  "status": "question",
  "session_id": "uuid-of-session",
  "interaction_id": "uuid-of-interaction",
  "section": "Phase 1",
  "selected_text": "Drop the legacy auth table",
  "question": "What happens to active sessions during the drop?",
  "comments_so_far": [...]
}
```

`status: "edit_request"` — the human wants a section rewritten:
```json
{
  "status": "edit_request",
  "session_id": "uuid-of-session",
  "interaction_id": "uuid-of-interaction",
  "section": "Phase 1",
  "selected_text": "Drop the legacy auth table",
  "instruction": "Add a rollback step before the drop"
}
```

`status: "complete"` — the human clicked Submit:
```json
{
  "status": "complete",
  "comments": [{ "section": "...", "selected_text": "...", "comment": "..." }],
  "questions": [{ "question": "...", "answer": "..." }],
  "edits": [{ "instruction": "...", "proposed_replacement": "...", "accepted": true }],
  "general_feedback": "Looks good overall.",
  "final_document": "## Phase 1\n..."
}
```

**Continuing the loop with `respond_to_review`:**

When you get `status: "question"`, answer it:
```json
{
  "session_id": "uuid-of-session",
  "interaction_id": "uuid-of-interaction",
  "type": "answer",
  "content": "Active sessions are migrated first — see Phase 0."
}
```

When you get `status: "edit_request"`, propose replacement text:
```json
{
  "session_id": "uuid-of-session",
  "interaction_id": "uuid-of-interaction",
  "type": "edit_proposal",
  "content": "## Phase 1\n1. Create rollback snapshot\n2. Drop the legacy auth table..."
}
```

Each `respond_to_review` call returns the next event (another question, another edit request, or `complete`). Keep calling until you get `status: "complete"` or `status: "session_closed"`.

### `ask_questions` — structured input

```json
{
  "title": "Project Setup",
  "description": "Help me configure your new project.",
  "questions": [
    {
      "id": "language",
      "type": "choice",
      "label": "Primary language?",
      "options": ["TypeScript", "Python", "Go", "Rust"]
    },
    {
      "id": "name",
      "type": "text",
      "label": "Project name",
      "placeholder": "my-project"
    },
    {
      "id": "features",
      "type": "multi_choice",
      "label": "Include which features?",
      "options": ["Auth", "Database", "CI/CD", "Docker"],
      "allow_other": true
    }
  ]
}
```

Returns key-value answers keyed by question `id`:
```json
{
  "language": "TypeScript",
  "name": "centaur",
  "features": ["Auth", "Database", "Logging"]
}
```

### `export_pdf` — markdown to PDF

```json
{
  "title": "Architecture Decision Record",
  "file_path": "/path/to/adr-001.md",
  "subtitle": "ADR-001 — Event sourcing"
}
```

Returns the absolute path to the generated PDF. Requires Chrome/Chromium — if not found at standard paths, set `CHROME_PATH` to the executable.

## Architecture

```
Agent calls tool
    │
    ▼
Adapter (MCP or Pi)          ← thin: schema + call core + format result
    │
    ▼
Core primitive                ← openForm() or openReview()
    │
    ├── HTML builder          ← self-contained browser UI
    └── Transport             ← temp HTTP server → browser → wait for submit
            │
            ▼
        User's browser        ← interact, submit
            │
            ▼
        JSON result → back to agent
```

The **core** is agent-agnostic — pure Node.js, zero framework dependencies. Each **adapter** is ~30 lines of glue that translates between the agent's tool system and the core functions.

### Transport details

Each tool invocation spins up a temporary HTTP server on `127.0.0.1` with an OS-assigned port (port 0). The server automatically opens the user's default browser. Once the user submits, the server shuts down and cleans up all connections.

- **Forms** (`ask_questions`): single request-response. Server dies after submit.
- **Reviews** (`review_document`): long-lived session with SSE for real-time updates. The browser and agent exchange events over `/events` (POST) and `/sse` (GET). Sessions time out after 1 hour of inactivity.
- **PDFs** (`export_pdf`): no server — uses headless Chrome via `puppeteer-core`.

Cross-platform browser opening: `open` (macOS), `xdg-open` (Linux), `start` (Windows).

## Project Structure

```
centaur/
├── src/
│   ├── core/                 # Agent-agnostic core
│   │   ├── form.js           # openForm(config) → Promise<answers>
│   │   ├── review.js         # openReview(config) → Promise<feedback>
│   │   ├── pdf.js            # markdownToPdf(config) → Promise<path>
│   │   ├── documents.js      # Markdown/file resolution, Chrome discovery
│   │   ├── sessions.js       # Review session registry
│   │   ├── transport/
│   │   │   ├── serve-html.js # serveHtmlAndWait() — one-shot form transport
│   │   │   ├── review-session.js # ReviewSession — long-lived SSE transport
│   │   │   ├── browser.js    # openBrowser() — cross-platform
│   │   │   ├── http.js       # Shared HTTP utilities
│   │   │   └── sse.js        # SSE event formatting
│   │   └── html/
│   │       ├── form.js       # Self-contained questionnaire HTML
│   │       ├── review.js     # Self-contained review HTML
│   │       └── pdf.js        # Print-ready HTML for PDF generation
│   ├── tools/
│   │   └── manifest.js       # Shared tool definitions (schema, validation, run)
│   ├── mcp/
│   │   ├── server.js         # Claude Code adapter (MCP SDK, stdio)
│   │   └── schema.js         # Manifest → Zod schema converter
│   └── pi/
│       ├── index.ts          # Pi adapter (TypeBox, extension API)
│       ├── schema.js         # Manifest → TypeBox schema converter
│       ├── payloads.ts       # Pi result formatting
│       └── renderers.ts      # Pi UI renderers
└── bin/
    └── mcp-server.js         # MCP entry point: #!/usr/bin/env node
```

## Adding a New Adapter

The core is agent-agnostic. To integrate with a new agent framework:

1. Import `toolDefinitions` from `src/tools/manifest.js`
2. For each tool: register it with your framework's tool API, converting `tool.input` to your schema format
3. In the handler: call `tool.run(params)`, format the result for your framework

See `src/mcp/server.js` (~80 lines) or `src/pi/index.ts` (~50 lines) as templates.

## Name

A centaur is half human, half horse — two natures fused into one creature that's stronger than either alone. That's the idea here: the terminal is where the agent lives, the browser is where the human thinks. Centaur fuses them.
