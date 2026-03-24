/**
 * Centaur — Pi extension adapter
 *
 * Registers browser-based UI primitives as pi tools.
 * The core (HTML builders + transport) is shared with the MCP adapter.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text, truncateToWidth } from "@mariozechner/pi-tui";

// @ts-ignore — JS module import
import { openForm, openReview, markdownToPdf } from "../core/index.js";

// --- Schemas ---

const QuestionSchema = Type.Object({
  id: Type.String({ description: "Unique key for this question in the response object" }),
  type: StringEnum(["text", "choice", "multi_choice"] as const, {
    description: "Input type",
  }),
  label: Type.String({ description: "The question text (rendered as a heading)" }),
  hint: Type.Optional(Type.String({ description: "Helper text shown below the question" })),
  required: Type.Optional(Type.Boolean({ description: "Whether an answer is required" })),
  options: Type.Optional(Type.Array(Type.String(), { description: "Options for choice/multi_choice types" })),
  allow_other: Type.Optional(Type.Boolean({ description: 'Show an "Other" free-text option (default: true)' })),
  placeholder: Type.Optional(Type.String({ description: "Placeholder text for text inputs" })),
  default_value: Type.Optional(Type.String({ description: "Pre-filled value" })),
});

// --- Extension ---

export default function centaur(pi: ExtensionAPI) {
  // --- ask_questions ---

  pi.registerTool({
    name: "ask_questions",
    label: "Ask Questions",
    description:
      "Opens a document-style questionnaire in the user's browser. " +
      "All questions are displayed on a single page so the user can read everything, " +
      "answer in any order, revise freely, and submit when ready. " +
      "Use this instead of asking questions one at a time when you have multiple questions or need detailed answers.",
    parameters: Type.Object({
      title: Type.String({ description: "Document heading shown at top of page" }),
      description: Type.Optional(Type.String({ description: "Context paragraph displayed below the heading" })),
      questions: Type.Array(QuestionSchema, { description: "Array of questions to display", minItems: 1 }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const answers = await openForm(params);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(answers, null, 2) }],
          details: answers,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },

    renderCall(args: any, theme: any) {
      const count = Array.isArray(args.questions) ? args.questions.length : 0;
      let text = theme.fg("toolTitle", theme.bold("ask_questions "));
      text += theme.fg("muted", `"${args.title}"`);
      text += theme.fg("dim", ` · ${count} question${count !== 1 ? "s" : ""}`);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, options: any, theme: any) {
      const details = result.details;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }
      if (!details || typeof details !== "object") {
        const text = result.content?.[0];
        return new Text(text?.type === "text" ? text.text : "No response", 0, 0);
      }

      const keys = Object.keys(details).filter((k) => k !== "_catchall" || details[k]);
      const lines = keys.map((key) => {
        const val = details[key];
        const display = Array.isArray(val) ? val.join(", ") : String(val);
        return `${theme.fg("success", "✓ ")}${theme.fg("accent", key)}: ${display}`;
      });
      return new Text(lines.join("\n") || theme.fg("muted", "No answers"), 0, 0);
    },
  });

  // --- review_document ---

  pi.registerTool({
    name: "review_document",
    label: "Review Document",
    description:
      "Opens a document in the browser for inline review. " +
      "The user can read the rendered markdown, select text to add comments, " +
      "and submit structured feedback. Use when the user wants to review a plan, document, or any long-form content you've generated.",
    parameters: Type.Object({
      title: Type.String({ description: "Document heading" }),
      content: Type.Optional(Type.String({ description: "Raw markdown text to review" })),
      file_path: Type.Optional(Type.String({ description: "Path to a .md file to review (alternative to content)" })),
      description: Type.Optional(Type.String({ description: "Context shown below the title" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const feedback = await openReview({
          title: params.title,
          description: params.description,
          content: params.content,
          filePath: params.file_path,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(feedback, null, 2) }],
          details: feedback,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },

    renderCall(args: any, theme: any) {
      let text = theme.fg("toolTitle", theme.bold("review_document "));
      text += theme.fg("muted", `"${args.title}"`);
      if (args.file_path) {
        text += theme.fg("dim", ` · ${args.file_path}`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result: any, options: any, theme: any) {
      const details = result.details;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }
      if (!details || typeof details !== "object") {
        const text = result.content?.[0];
        return new Text(text?.type === "text" ? text.text : "No response", 0, 0);
      }

      const lines: string[] = [];
      const comments = details.comments;
      if (Array.isArray(comments) && comments.length > 0) {
        lines.push(theme.fg("accent", `${comments.length} comment${comments.length !== 1 ? "s" : ""}:`));
        for (const c of comments) {
          const quote = c.selected_text
            ? `"${c.selected_text.length > 40 ? c.selected_text.slice(0, 40) + "…" : c.selected_text}"`
            : "";
          const section = c.section ? theme.fg("dim", `§${c.section.replace(/^#+\s*/, "")} `) : "";
          lines.push(`  ${section}${theme.fg("muted", quote)}`);
          lines.push(`  ${theme.fg("success", "→ ")}${c.comment}`);
        }
      }
      if (details.general_feedback) {
        if (lines.length > 0) lines.push("");
        lines.push(theme.fg("accent", "General: ") + details.general_feedback);
      }
      if (lines.length === 0) {
        lines.push(theme.fg("muted", "No comments or feedback"));
      }
      return new Text(lines.join("\n"), 0, 0);
    },
  });

  // --- export_pdf ---

  pi.registerTool({
    name: "export_pdf",
    label: "Export PDF",
    description:
      "Converts a markdown file to a beautifully formatted PDF. " +
      "Uses the same visual language as the review tool — monospace, clean tables, " +
      "proper headings, code blocks. Output is print-ready with page numbers. " +
      "Use when the user wants to share a report, plan, or document as a PDF.",
    parameters: Type.Object({
      title: Type.String({ description: "Document title (shown at top of PDF)" }),
      file_path: Type.Optional(Type.String({ description: "Path to a .md file to convert" })),
      content: Type.Optional(Type.String({ description: "Raw markdown text (alternative to file_path)" })),
      output_path: Type.Optional(Type.String({ description: "Where to save the PDF (defaults to same dir as .md file)" })),
      subtitle: Type.Optional(Type.String({ description: "Subtitle shown below title" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const pdfPath = await markdownToPdf({
          title: params.title,
          content: params.content,
          filePath: params.file_path,
          outputPath: params.output_path,
          subtitle: params.subtitle,
        });
        return {
          content: [{ type: "text" as const, text: `PDF generated: ${pdfPath}` }],
          details: { path: pdfPath },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          details: { error: err.message },
          isError: true,
        };
      }
    },

    renderCall(args: any, theme: any) {
      let text = theme.fg("toolTitle", theme.bold("export_pdf "));
      text += theme.fg("muted", `"${args.title}"`);
      if (args.file_path) {
        text += theme.fg("dim", ` · ${args.file_path}`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result: any, _options: any, theme: any) {
      const details = result.details;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }
      if (details?.path) {
        return new Text(theme.fg("success", "✓ ") + theme.fg("muted", details.path), 0, 0);
      }
      const text = result.content?.[0];
      return new Text(text?.type === "text" ? text.text : "Done", 0, 0);
    },
  });
}
