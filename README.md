# Centaur

Browser-based UI companion for terminal coding agents.

When the terminal isn't enough — complex forms, document reviews, structured approvals — the agent opens a browser page where you can see, think, and respond. Then you step back into the terminal.

## Primitives

| Tool | What it does | Input | Output |
|------|-------------|-------|--------|
| `ask_questions` | Document-style questionnaire | Title, questions (text/choice/multi-choice) | Key-value answers |
| `review_document` | Markdown review with inline comments | Title, markdown content or file path | Inline comments + feedback |
| `export_pdf` | Markdown → print-ready PDF | Title, markdown content or file path | PDF file path |

## Install

### Claude Code (MCP)

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "centaur": {
      "command": "node",
      "args": ["/path/to/centaur/bin/mcp-server.js"]
    }
  }
}
```

### Pi (Extension)

Symlink into pi's extension directory:

```bash
ln -s /path/to/centaur ~/.pi/agent/extensions/centaur
```

Pi auto-discovers the extension via the `pi.extensions` field in `package.json`.

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

## Project Structure

```
centaur/
├── src/
│   ├── core/                 # Agent-agnostic
│   │   ├── form.js           # openForm(config) → Promise<answers>
│   │   ├── review.js         # openReview(config) → Promise<feedback>
│   │   ├── pdf.js            # markdownToPdf(config) → Promise<path>
│   │   ├── transport/
│   │   │   ├── server.js     # serveHtmlAndWait() — the universal pattern
│   │   │   └── browser.js    # openBrowser()
│   │   ├── html/
│   │   │   ├── form.js       # Self-contained questionnaire HTML
│   │   │   ├── review.js     # Self-contained review HTML
│   │   │   └── pdf.js        # Print-ready HTML for PDF generation
│   │   ├── logger.js
│   │   └── utils.js
│   ├── mcp/
│   │   └── server.js         # Claude Code adapter (Zod schemas, MCP SDK)
│   └── pi/
│       └── index.ts          # Pi adapter (TypeBox schemas, pi extension API)
└── bin/
    └── mcp-server.js         # MCP entry point
```

## Name

A centaur is half human, half horse — two natures fused into one creature that's stronger than either alone. That's the idea here: the terminal is where the agent lives, the browser is where the human thinks. Centaur fuses them.
