/**
 * Generates a self-contained, print-ready HTML document from markdown.
 *
 * Same visual language as the review tool (monospace, clean grid, dark/light)
 * but stripped of all interactivity — no comments, no popup, no submit.
 * Optimised for puppeteer page.pdf().
 */

import { escapeHtml, serializeForInlineScript } from "../utils.js";

export function buildPdfHtml({ title, content, contentHtml, subtitle }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page {
  size: A4;
  margin: 20mm 18mm 20mm 18mm;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  background: #fff;
  color: #1a1a1a;
  font: 11px/1.65 Menlo, Consolas, "Liberation Mono", monospace;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* --- Cover header --- */
.cover {
  border-bottom: 2px solid #111;
  padding-bottom: 12px;
  margin-bottom: 20px;
}
.cover-title {
  font-size: 18px;
  font-weight: 700;
  color: #000;
  line-height: 1.3;
}
.cover-subtitle {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
}

/* --- Headings --- */
h1 {
  font-size: 14px;
  font-weight: 700;
  color: #000;
  border-top: 1px solid #ccc;
  padding-top: 10px;
  margin: 24px 0 8px;
  page-break-after: avoid;
}
h1:first-child { border-top: none; padding-top: 0; margin-top: 0; }
h2 { font-size: 12px; font-weight: 700; color: #111; margin: 18px 0 6px; page-break-after: avoid; }
h3 { font-size: 11px; font-weight: 700; color: #222; margin: 14px 0 4px; page-break-after: avoid; }
h4, h5, h6 { font-size: 10px; font-weight: 700; color: #333; margin: 10px 0 3px; page-break-after: avoid; }

/* --- Paragraphs --- */
p { margin: 0 0 8px; }

/* --- Lists --- */
ul { margin: 4px 0 8px; padding-left: 18px; }
ol { margin: 4px 0 8px; padding-left: 20px; }
li { margin: 0 0 2px; }
li > p { margin: 0; }
li > p + p { margin-top: 4px; }
li > ul, li > ol { margin: 2px 0; }

/* --- Inline code --- */
code {
  background: #f0f0f0;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 10px;
}

/* --- Code blocks --- */
pre {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 8px 10px;
  border-radius: 3px;
  overflow-x: auto;
  margin: 6px 0 10px;
  line-height: 1.45;
  font-size: 10px;
  page-break-inside: avoid;
}
pre code { background: none; padding: 0; border-radius: 0; font-size: 10px; }

/* --- Blockquotes --- */
blockquote {
  border-left: 2px solid #999;
  padding-left: 14px;
  margin: 6px 0 10px 2px;
  color: #555;
  font-size: 10px;
}
blockquote > p:last-child { margin-bottom: 0; }

/* --- Tables --- */
table {
  border-collapse: collapse;
  margin: 6px 0 10px;
  font-size: 10px;
  width: 100%;
  page-break-inside: avoid;
}
th, td {
  border: 1px solid #ccc;
  padding: 4px 8px;
  text-align: left;
}
th {
  font-weight: 700;
  color: #000;
  background: #f5f5f5;
}
tr:nth-child(even) td { background: #fafafa; }

/* --- Horizontal rules --- */
hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 16px 0;
}

/* --- Links --- */
a { color: #333; text-decoration: underline; }

/* --- Images --- */
img { max-width: 100%; }

/* --- Strong / emphasis --- */
strong { color: #000; }

/* --- Page break utility --- */
.page-break { page-break-before: always; }

/* --- Footer --- */
@media print {
  body { font-size: 10px; }
}
</style>
</head>
<body>

<div class="cover">
  <div class="cover-title">${escapeHtml(title)}</div>
  ${subtitle ? `<div class="cover-subtitle">${escapeHtml(subtitle)}</div>` : ""}
</div>

<div id="content"></div>

<script>
(function(){
  const raw = ${serializeForInlineScript(content)};
  const renderedHtml = ${serializeForInlineScript(contentHtml ?? null)};
  const el = document.getElementById("content");
  try {
    if (!renderedHtml) throw 0;
    el.innerHTML = renderedHtml;
  } catch(e) {
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.textContent = raw;
    el.appendChild(pre);
  }
})();
</script>
</body>
</html>`;
}
