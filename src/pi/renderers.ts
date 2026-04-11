import { Text } from "@mariozechner/pi-tui";

type ToolRenderer = {
  renderCall: (args: any, theme: any) => Text;
  renderResult: (result: any, theme: any) => Text;
};

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

  if (details.status === "edit_request") {
    const lines = [theme.fg("accent", "Edit request from review")];
    if (details.section) {
      lines.push(theme.fg("dim", details.section));
    }
    if (details.selected_text) {
      lines.push(theme.fg("muted", `"${details.selected_text}"`));
    }
    lines.push(details.instruction || theme.fg("muted", "No edit instruction"));
    return new Text(lines.join("\n"), 0, 0);
  }

  if (details.status === "session_closed") {
    return new Text(theme.fg("muted", "Review session closed"), 0, 0);
  }

  const lines: string[] = [];
  if (details.status === "complete") {
    const comments = Array.isArray(details.comments) ? details.comments.length : 0;
    const asks = Array.isArray(details.questions)
      ? details.questions.filter((entry: any) => entry?.kind !== "note").length
      : 0;
    const edits = Array.isArray(details.edits) ? details.edits.length : 0;
    lines.push(theme.fg("accent", "Review complete"));
    lines.push(
      `${comments} comment${comments !== 1 ? "s" : ""} · ` +
      `${asks} ask${asks !== 1 ? "s" : ""} · ` +
      `${edits} edit${edits !== 1 ? "s" : ""}`
    );
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

export const renderers: Record<string, ToolRenderer> = {
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
