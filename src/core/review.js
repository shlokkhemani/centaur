import fs from "node:fs/promises";
import { buildReviewHtml } from "./html/review.js";
import { serveHtmlAndWait } from "./transport/server.js";
import { log } from "./logger.js";

/**
 * Opens a document in the browser for inline review.
 * The user can read the rendered markdown, select text to add comments,
 * and submit structured feedback.
 *
 * @param {{ title: string, description?: string, content?: string, filePath?: string }} config
 * @returns {Promise<{ comments?: object[], general_feedback?: string }>}
 */
export async function openReview({ title, description, content, filePath }) {
  log(`openReview: "${title}"`);

  let markdown = content;
  if (!markdown && filePath) {
    markdown = await fs.readFile(filePath, "utf-8");
  }
  if (!markdown) {
    throw new Error("Either content or filePath must be provided");
  }

  const html = buildReviewHtml({ title, description, content: markdown });
  return serveHtmlAndWait(html);
}
