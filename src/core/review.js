import { buildReviewHtml } from "./html/review.js";
import { renderMarkdownToHtml, normalizeRenderedMarkdownHtml } from "./markdown.js";
import { log } from "./logger.js";
import { resolveMarkdownContent } from "./documents.js";
import { createReviewSession, getReviewSession } from "./sessions.js";

/**
 * Opens a document in the browser for inline review.
 * The user can read the rendered markdown, select text to add comments,
 * and submit structured feedback.
 *
 * @param {{ title: string, description?: string, content?: string, filePath?: string }} config
 * @returns {Promise<object>}
 */
export async function openReview({ title, description, content, filePath }) {
  log(`openReview: "${title}"`);

  const markdown = await resolveMarkdownContent({ content, filePath });
  let contentHtml = null;

  try {
    contentHtml = normalizeRenderedMarkdownHtml(await renderMarkdownToHtml(markdown));
  } catch {}

  const session = await createReviewSession({
    initialState: {
      markdown,
      comments: [],
      questions: [],
      edits: [],
      general_feedback: "",
      pending_interaction_id: null,
    },
    renderPage: (hydration) =>
      buildReviewHtml({
        title,
        description,
        content: markdown,
        contentHtml,
        hydration,
      }),
  });

  return session.waitForEvent();
}

export async function respondToReview({ sessionId, interactionId, type, content }) {
  const session = getReviewSession(sessionId);
  if (!session || session.isClosed()) {
    return {
      status: "session_closed",
      session_id: sessionId,
    };
  }

  session.sendResponse({
    interaction_id: interactionId,
    type,
    content,
  });

  return session.waitForEvent();
}
