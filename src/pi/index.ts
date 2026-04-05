/**
 * Centaur — Pi extension adapter
 *
 * Registers browser-based UI primitives as pi tools.
 * The core (HTML builders + transport) is shared with the MCP adapter.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

// @ts-ignore -- JS module import
import { toolDefinitions } from "../tools/manifest.js";
import { buildPiParameters } from "./schema.js";

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function buildSuccessPayload(tool: any, result: any) {
  if (tool.resultKind === "pdfPath") {
    return {
      content: [{ type: "text" as const, text: `PDF generated: ${result}` }],
      details: { path: result },
    };
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    details: result,
  };
}

function buildErrorPayload(tool: any, message: string) {
  const payload: {
    content: Array<{ type: "text"; text: string }>;
    details: { error: string };
    isError?: boolean;
  } = {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    details: { error: message },
  };

  if (tool.piMarksError) {
    payload.isError = true;
  }

  return payload;
}

function renderAskQuestionsCall(args: any, theme: any) {
  const count = Array.isArray(args.questions) ? args.questions.length : 0;
  let text = theme.fg("toolTitle", theme.bold("ask_questions "));
  text += theme.fg("muted", `"${args.title}"`);
  text += theme.fg("dim", ` · ${count} question${count !== 1 ? "s" : ""}`);
  return new Text(text, 0, 0);
}

function renderAskQuestionsResult(result: any, theme: any) {
  const details = result.details;
  if (details?.error) {
    return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  }
  if (!details || typeof details !== "object") {
    const text = result.content?.[0];
    return new Text(text?.type === "text" ? text.text : "No response", 0, 0);
  }

  const keys = Object.keys(details).filter((key) => key !== "_catchall" || details[key]);
  const lines = keys.map((key) => {
    const value = details[key];
    const display = Array.isArray(value) ? value.join(", ") : String(value);
    return `${theme.fg("success", "✓ ")}${theme.fg("accent", key)}: ${display}`;
  });
  return new Text(lines.join("\n") || theme.fg("muted", "No answers"), 0, 0);
}

function renderReviewDocumentCall(args: any, theme: any) {
  let text = theme.fg("toolTitle", theme.bold("review_document "));
  text += theme.fg("muted", `"${args.title}"`);
  if (args.file_path) {
    text += theme.fg("dim", ` · ${args.file_path}`);
  }
  return new Text(text, 0, 0);
}

function renderReviewDocumentResult(result: any, theme: any) {
  const details = result.details;
  if (details?.error) {
    return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  }
  if (!details || typeof details !== "object") {
    const text = result.content?.[0];
    return new Text(text?.type === "text" ? text.text : "No response", 0, 0);
  }

  if (details.status === "question") {
    const lines = [theme.fg("accent", "Question from review")];
    if (details.section) {
      lines.push(theme.fg("dim", details.section));
    }
    if (details.selected_text) {
      lines.push(theme.fg("muted", `"${details.selected_text}"`));
    }
    lines.push(details.question || "No question");
    return new Text(lines.join("\n"), 0, 0);
  }

  if (details.status === "session_closed") {
    return new Text(theme.fg("muted", "Review session closed"), 0, 0);
  }

  const lines: string[] = [];
  if (details.status === "complete") {
    const comments = Array.isArray(details.comments) ? details.comments.length : 0;
    const questions = Array.isArray(details.questions) ? details.questions.length : 0;
    lines.push(theme.fg("accent", "Review complete"));
    lines.push(`${comments} comment${comments !== 1 ? "s" : ""} · ${questions} ask${questions !== 1 ? "s" : ""}`);
    if (details.general_feedback) {
      lines.push("");
      lines.push(theme.fg("accent", "General: ") + details.general_feedback);
    }
    return new Text(lines.join("\n"), 0, 0);
  }

  return new Text(JSON.stringify(details, null, 2), 0, 0);
}

function renderRespondToReviewCall(args: any, theme: any) {
  let text = theme.fg("toolTitle", theme.bold("respond_to_review "));
  text += theme.fg("muted", args.session_id ? args.session_id.slice(0, 8) : "session");
  if (args.type) {
    text += theme.fg("dim", ` · ${args.type}`);
  }
  return new Text(text, 0, 0);
}

function renderRespondToReviewResult(result: any, theme: any) {
  return renderReviewDocumentResult(result, theme);
}

function renderExportPdfCall(args: any, theme: any) {
  let text = theme.fg("toolTitle", theme.bold("export_pdf "));
  text += theme.fg("muted", `"${args.title}"`);
  if (args.file_path) {
    text += theme.fg("dim", ` · ${args.file_path}`);
  }
  return new Text(text, 0, 0);
}

function renderExportPdfResult(result: any, theme: any) {
  const details = result.details;
  if (details?.error) {
    return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  }
  if (details?.path) {
    return new Text(theme.fg("success", "✓ ") + theme.fg("muted", details.path), 0, 0);
  }
  const text = result.content?.[0];
  return new Text(text?.type === "text" ? text.text : "Done", 0, 0);
}

const renderers: Record<
  string,
  {
    renderCall: (args: any, theme: any) => Text;
    renderResult: (result: any, theme: any) => Text;
  }
> = {
  ask_questions: {
    renderCall: renderAskQuestionsCall,
    renderResult: renderAskQuestionsResult,
  },
  review_document: {
    renderCall: renderReviewDocumentCall,
    renderResult: renderReviewDocumentResult,
  },
  respond_to_review: {
    renderCall: renderRespondToReviewCall,
    renderResult: renderRespondToReviewResult,
  },
  export_pdf: {
    renderCall: renderExportPdfCall,
    renderResult: renderExportPdfResult,
  },
};

export default function centaur(pi: ExtensionAPI) {
  for (const tool of toolDefinitions) {
    const renderer = renderers[tool.name];

    pi.registerTool({
      name: tool.name,
      label: tool.label,
      description: tool.description,
      parameters: buildPiParameters(tool.input),

      async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
        try {
          if (tool.validateInput) {
            tool.validateInput(params);
          }

          const result = await tool.run(params);
          return buildSuccessPayload(tool, result);
        } catch (err) {
          return buildErrorPayload(tool, getErrorMessage(err));
        }
      },

      renderCall(args: any, theme: any) {
        return renderer.renderCall(args, theme);
      },

      renderResult(result: any, _options: any, theme: any) {
        return renderer.renderResult(result, theme);
      },
    });
  }
}
