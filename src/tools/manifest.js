import { openForm, openReview, markdownToPdf, respondToReview } from "../core/index.js";

function stringField(description, extra = {}) {
  return { kind: "string", description, ...extra };
}

function booleanField(description, extra = {}) {
  return { kind: "boolean", description, ...extra };
}

function enumField(values, description, extra = {}) {
  return { kind: "enum", values, description, ...extra };
}

function arrayField(items, description, extra = {}) {
  return { kind: "array", items, description, ...extra };
}

function objectField(fields, extra = {}) {
  return { kind: "object", fields, ...extra };
}

const questionSchema = objectField({
  id: stringField("Unique key for this question in the response object"),
  type: enumField(["text", "choice", "multi_choice"], "Input type"),
  label: stringField("The question text (rendered as a heading)"),
  hint: stringField("Helper text shown below the question", { optional: true }),
  required: booleanField("Whether an answer is required", { optional: true, default: false }),
  options: arrayField(stringField(), "Options for choice/multi_choice types", { optional: true }),
  allow_other: booleanField('Show an "Other" free-text option', { optional: true, default: true }),
  placeholder: stringField("Placeholder text for text inputs", { optional: true }),
  default_value: stringField("Pre-filled value", { optional: true }),
});

function validateAskQuestionsInput({ questions }) {
  for (const question of questions) {
    if (
      question.type !== "text" &&
      (!Array.isArray(question.options) || question.options.length === 0)
    ) {
      throw new Error("choice and multi_choice questions must have a non-empty options array");
    }
  }
}

export const toolDefinitions = [
  {
    name: "ask_questions",
    label: "Ask Questions",
    description:
      "Opens a structured questionnaire in the user's browser with all questions on one page. " +
      "Use when you need the human to make choices or fill in multiple fields — e.g. project preferences, " +
      "config options, prioritisation. Supports text, single-choice, and multi-choice inputs. " +
      "If the main goal is to share a document for the human to read and comment on, use review_document instead.",
    input: objectField({
      title: stringField("Document heading shown at top of page"),
      description: stringField("Context paragraph displayed below the heading", {
        optional: true,
      }),
      questions: arrayField(questionSchema, "Array of questions to display", {
        minItems: 1,
      }),
    }),
    resultKind: "json",
    piMarksError: false,
    validateInput: validateAskQuestionsInput,
    run: async (params) => openForm(params),
  },
  {
    name: "review_document",
    label: "Review Document",
    description:
      "Opens a document in the browser for the human to read, comment on, and collaborate with you inline. " +
      "This is your default tool for sharing plans, specs, reports, proposals, and other prose documents " +
      "with the human before proceeding. Prefer this over dumping long text into chat. " +
      "Multi-turn: the human can leave inline comments, ask questions, and request edits. " +
      "If the result has status='question', answer it via respond_to_review with type='answer'. " +
      "If status='edit_request', propose replacement text via respond_to_review with type='edit_proposal'. " +
      "Continue the loop until status='complete' or status='session_closed'.",
    input: objectField({
      title: stringField("Document heading"),
      content: stringField("Raw markdown text to review", { optional: true }),
      file_path: stringField("Path to a .md file to review (alternative to content)", {
        optional: true,
      }),
      description: stringField("Context shown below the title", { optional: true }),
    }),
    resultKind: "json",
    piMarksError: false,
    run: async ({ title, content, file_path, description }) =>
      openReview({
        title,
        description,
        content,
        filePath: file_path,
      }),
  },
  {
    name: "respond_to_review",
    label: "Respond To Review",
    description:
      "Sends your answer or edit proposal back to an active review session and waits for the next interaction. " +
      "Called after review_document returns status='question' or status='edit_request'. " +
      "Keep responses concise — a few sentences unless the question demands depth.",
    input: objectField({
      session_id: stringField("Active review session ID"),
      interaction_id: stringField("Interaction ID returned by review_document"),
      type: enumField(
        ["answer", "edit_proposal"],
        "Type of response being sent back to the review session"
      ),
      content: stringField("Answer or proposal content to display in the review UI"),
    }),
    resultKind: "json",
    piMarksError: false,
    run: async ({ session_id, interaction_id, type, content }) =>
      respondToReview({
        sessionId: session_id,
        interactionId: interaction_id,
        type,
        content,
      }),
  },
  {
    name: "export_pdf",
    label: "Export PDF",
    description:
      "Converts markdown to a print-ready PDF with clean typography, tables, code blocks, and page numbers. " +
      "Use when the human wants a shareable document file. Accepts a .md file path or raw markdown content.",
    input: objectField({
      title: stringField("Document title (shown at top of PDF)"),
      file_path: stringField("Path to a .md file to convert", { optional: true }),
      content: stringField("Raw markdown text (alternative to file_path)", { optional: true }),
      output_path: stringField(
        "Where to save the PDF (defaults to same dir as .md file)",
        { optional: true }
      ),
      subtitle: stringField("Subtitle shown below title", { optional: true }),
    }),
    resultKind: "pdfPath",
    piMarksError: true,
    run: async ({ title, content, file_path, output_path, subtitle }) =>
      markdownToPdf({
        title,
        content,
        filePath: file_path,
        outputPath: output_path,
        subtitle,
      }),
  },
];
