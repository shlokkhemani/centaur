import { buildFormHtml } from "./html/form.js";
import { serveHtmlAndWait } from "./transport/server.js";
import { log } from "./logger.js";

/**
 * Opens a document-style questionnaire in the user's browser.
 * All questions are displayed on a single page so the user can read everything,
 * answer in any order, revise freely, and submit when ready.
 *
 * @param {{ title: string, description?: string, questions: object[] }} config
 * @returns {Promise<object>} Key-value answers keyed by question ID
 */
export async function openForm({ title, description, questions }) {
  log(`openForm: "${title}" with ${questions.length} question(s)`);
  const html = buildFormHtml({ title, description, questions });
  return serveHtmlAndWait(html);
}
