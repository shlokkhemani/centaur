import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log, error as logError } from "../core/logger.js";
import { buildMcpInputSchema } from "./schema.js";
import { toolDefinitions } from "../tools/manifest.js";

const server = new McpServer(
  {
    name: "centaur",
    version: "0.1.0",
  },
  {
    instructions: [
      "Centaur opens browser pages so the human can see, review, and respond to your work visually.",
      "",
      "Default tool: review_document.",
      "Whenever you produce or revise a plan, spec, report, proposal, or any prose document the human",
      "should read before you proceed — send it through review_document.",
      "The human can leave inline comments, ask questions, and request edits directly on the rendered",
      "document; you then respond via respond_to_review until the review is complete.",
      "Do not paste long documents into chat — open a review instead.",
      "",
      "Use ask_questions only when you need structured input (choices, multiple fields) and there is",
      "no document to review. For a handful of simple questions, regular chat is fine.",
      "",
      "Use export_pdf when the human wants a shareable, print-ready document.",
    ].join("\n"),
  }
);

function formatSuccessText(tool, result) {
  switch (tool.resultKind) {
    case "pdfPath":
      return `PDF generated: ${result}`;
    case "json":
    default:
      return JSON.stringify(result, null, 2);
  }
}

function getErrorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

for (const tool of toolDefinitions) {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: buildMcpInputSchema(tool.input),
    },
    async (params) => {
      try {
        if (tool.validateInput) {
          tool.validateInput(params);
        }

        const result = await tool.run(params);
        return {
          content: [{ type: "text", text: formatSuccessText(tool, result) }],
        };
      } catch (err) {
        const message = getErrorMessage(err);
        logError(`${tool.name} failed: ${message}`);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Centaur MCP server running on stdio");
}

main().catch((err) => {
  logError(`Fatal: ${getErrorMessage(err)}`);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    log(`Received ${signal}, shutting down`);
    process.exit(0);
  });
}
