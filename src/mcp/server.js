import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log, error as logError } from "../core/logger.js";
import { buildMcpInputSchema } from "./schema.js";
import { toolDefinitions } from "../tools/manifest.js";

const server = new McpServer({
  name: "centaur",
  version: "0.1.0",
});

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
