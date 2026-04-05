import { marked } from "marked";

export async function renderMarkdownToHtml(markdown) {
  return await marked.parse(markdown);
}

export function normalizeRenderedMarkdownHtml(html) {
  return html.replace(/>\n+</g, "><").replace(/\n<\/code>/g, "</code>");
}
