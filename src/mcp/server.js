import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { openForm, openReview } from "../core/index.js";
import { log, error as logError } from "../core/logger.js";

const server = new McpServer({
  name: "centaur",
  version: "0.1.0",
});

// --- Question schema ---

const questionSchema = z.object({
  id: z.string().describe("Unique key for this question in the response object"),
  type: z.enum(["text", "choice", "multi_choice"]).describe("Input type"),
  label: z.string().describe("The question text (rendered as a heading)"),
  hint: z.string().optional().describe("Helper text shown below the question"),
  required: z.boolean().optional().default(false).describe("Whether an answer is required"),
  options: z.array(z.string()).optional().describe("Options for choice/multi_choice types"),
  allow_other: z.boolean().optional().default(true).describe('Show an "Other" free-text option'),
  placeholder: z.string().optional().describe("Placeholder text for text inputs"),
  default_value: z.string().optional().describe("Pre-filled value"),
}).refine(
  (q) => q.type === "text" || (Array.isArray(q.options) && q.options.length > 0),
  { message: "choice and multi_choice questions must have a non-empty options array" }
);

// --- Tools ---

server.registerTool(
  "ask_questions",
  {
    description:
      "Opens a document-style questionnaire in the user's browser. " +
      "All questions are displayed on a single page so the user can read everything, " +
      "answer in any order, revise freely, and submit when ready. " +
      "Use this instead of asking questions one at a time when you have multiple questions or need detailed answers.",
    inputSchema: {
      title: z.string().describe("Document heading shown at top of page"),
      description: z
        .string()
        .optional()
        .describe("Context paragraph displayed below the heading"),
      questions: z
        .array(questionSchema)
        .min(1)
        .describe("Array of questions to display"),
    },
  },
  async ({ title, description, questions }) => {
    try {
      const answers = await openForm({ title, description, questions });
      return {
        content: [{ type: "text", text: JSON.stringify(answers, null, 2) }],
      };
    } catch (err) {
      logError(`ask_questions failed: ${err.message}`);
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "review_document",
  {
    description:
      "Opens a document in the browser for inline review. " +
      "The user can read the rendered markdown, select text to add comments, " +
      "and submit structured feedback. Use when the user wants to review a plan, document, or any long-form content you've generated.",
    inputSchema: {
      title: z.string().describe("Document heading"),
      content: z
        .string()
        .optional()
        .describe("Raw markdown text to review"),
      file_path: z
        .string()
        .optional()
        .describe("Path to a .md file to review (alternative to content)"),
      description: z
        .string()
        .optional()
        .describe("Context shown below the title"),
    },
  },
  async ({ title, content, file_path, description }) => {
    try {
      const feedback = await openReview({
        title,
        description,
        content,
        filePath: file_path,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(feedback, null, 2) }],
      };
    } catch (err) {
      logError(`review_document failed: ${err.message}`);
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("Centaur MCP server running on stdio");
}

main().catch((err) => {
  logError(`Fatal: ${err.message}`);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    log(`Received ${signal}, shutting down`);
    process.exit(0);
  });
}
