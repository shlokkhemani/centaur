/**
 * Generates a self-contained HTML document for plan/document review.
 *
 * Layout: CSS Grid body with 3 visual columns (TOC | Content | Margin).
 * Content + Margin share a scroll container so comment cards stay aligned
 * with their highlights. Full keyboard navigation uses a focusable document surface.
 */

import { escapeHtml, serializeForInlineScript } from "../utils.js";

export function buildReviewHtml({ title, description, content, contentHtml, hydration }) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review: ${escapeHtml(title)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

html[data-theme="dark"] {
  --bg: #1a1a1a;
  --bg-input: #111;
  --bg-code: #141414;
  --fg: #ccc;
  --fg-bold: #eee;
  --fg-dim: #888;
  --fg-faint: #555;
  --fg-ghost: #444;
  --border: #333;
  --border-focus: #555;
  --accent: #888;
  --err: #c44;
  --btn-bg: #333;
  --btn-border: #444;
  --btn-hover: #3a3a3a;
  --btn-active: #2a2a2a;
  --bar-bg: #1a1a1a;
  --overlay-bg: rgba(0,0,0,0.7);
  --hl-bg: rgba(160,160,160,0.25);
  --card-bg: #1e1e1e;
}
html[data-theme="light"] {
  --bg: #fafafa;
  --bg-input: #fff;
  --bg-code: #f4f4f4;
  --fg: #333;
  --fg-bold: #111;
  --fg-dim: #777;
  --fg-faint: #999;
  --fg-ghost: #bbb;
  --border: #ddd;
  --border-focus: #aaa;
  --accent: #666;
  --err: #c33;
  --btn-bg: #eee;
  --btn-border: #ccc;
  --btn-hover: #e4e4e4;
  --btn-active: #ddd;
  --bar-bg: #fafafa;
  --overlay-bg: rgba(255,255,255,0.85);
  --hl-bg: rgba(100,100,100,0.12);
  --card-bg: #fff;
}

html, body { height: 100%; overflow: hidden; background: var(--bg); color: var(--fg); }
body {
  font: 13px/1.5 Menlo, Consolas, "Liberation Mono", monospace;
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 200px 1fr;
  transition: grid-template-columns 0.15s ease;
}

/* --- Top bar --- */
.topbar {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bar-bg);
  z-index: 10;
}
.topbar-left { display: flex; align-items: baseline; gap: 16px; min-width: 0; }
.topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.theme-toggle {
  background: none; border: none; color: var(--fg-faint); font-size: 16px;
  cursor: pointer; padding: 2px 4px; line-height: 1;
}
.theme-toggle:hover { color: var(--fg); }
.title { font-size: 13px; font-weight: bold; color: var(--fg-bold); white-space: nowrap; }
.desc { color: var(--fg-dim); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta { color: var(--fg-faint); font-size: 11px; white-space: nowrap; }
.btn {
  padding: 5px 14px;
  background: var(--btn-bg);
  color: var(--fg-bold);
  border: 1px solid var(--btn-border);
  border-radius: 3px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.btn:hover:not(:disabled) { background: var(--btn-hover); }
.btn:active { background: var(--btn-active); }
.btn:disabled { opacity: 0.4; cursor: default; }

/* --- TOC sidebar --- */
.toc {
  grid-row: 2;
  grid-column: 1;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid var(--border);
  padding: 12px 0;
  min-width: 0;
  transition: opacity 0.15s ease;
}
.toc-link {
  display: block;
  padding: 3px 14px;
  color: var(--fg-dim);
  text-decoration: none;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.6;
}
.toc-link:hover { color: var(--fg); }
.toc-link.active { color: var(--fg-bold); font-weight: bold; }

/* --- Scroll area (content + margin) --- */
.scroll-area {
  grid-row: 2;
  grid-column: 2;
  overflow-y: auto;
  display: flex;
  position: relative;
}

/* --- Content column --- */
.content-col {
  flex: 1;
  padding: 20px 24px 80px;
  min-width: 0;
}

/* --- Margin column (comment cards) --- */
.margin-col {
  width: 260px;
  flex-shrink: 0;
  position: relative;
}

/* --- Markdown styles --- */
#md-content {
  line-height: 1.5;
  caret-color: var(--fg-bold);
}
#md-content:focus { outline: none; }
#md-content::selection { background: rgba(140,140,140,0.35); color: inherit; }
#md-content > *:last-child { margin-bottom: 0; }

/* Headings — generous top space separates sections, moderate bottom anchors to content */
#md-content h1 { font-size: 15px; font-weight: 700; color: var(--fg-bold); border-top: 1px solid var(--border); padding: 8px 24px 0; margin: 1.5em -24px 0.5em; }
#md-content h2 { font-size: 14px; font-weight: 700; color: var(--fg-bold); margin: 1.4em 0 0.4em; }
#md-content h3 { font-size: 13px; font-weight: 700; color: var(--fg-bold); margin: 1.2em 0 0.35em; }
#md-content h4, #md-content h5, #md-content h6 { font-size: 12px; font-weight: 700; color: var(--fg-bold); margin: 1em 0 0.25em; }
#md-content h1:first-child, #md-content h2:first-child { margin-top: 0; }

/* Paragraphs — enough bottom margin to see the break */
#md-content p { margin: 0 0 0.6em; }

/* Lists — breathing room from surrounding prose, slight item separation */
#md-content ul { margin: 0.3em 0 0.6em; padding-left: 20px; }
#md-content ol { margin: 0.3em 0 0.6em; padding-left: 22px; }
#md-content li { margin: 0 0 0.15em; padding: 0; }
#md-content li > p { margin: 0; }
#md-content li > p + p { margin-top: 0.3em; }
#md-content li > ul, #md-content li > ol { margin: 0.2em 0; }

/* Inline code */
#md-content code { background: var(--bg-code); padding: 2px 5px; border-radius: 2px; font-size: 12px; }

/* Code blocks — clear separation from prose */
#md-content pre { background: var(--bg-code); border: 1px solid var(--border); padding: 8px 12px; border-radius: 3px; overflow-x: auto; margin: 0.5em 0 0.7em; line-height: 1.4; }
#md-content pre code { background: none; padding: 0; border-radius: 0; font-size: 12px; }

/* Blockquotes — visually distinct: indented, dimmed, slightly smaller */
#md-content blockquote { border-left: 2px solid var(--accent); padding-left: 16px; margin-left: 2px; margin-right: 16px; color: var(--fg-dim); margin-top: 0.5em; margin-bottom: 0.7em; font-size: 12px; }
#md-content blockquote > p:last-child { margin-bottom: 0; }

/* Tables — clean grid, auto-width, comfortable padding */
#md-content table { border-collapse: collapse; margin: 0.5em 0 0.7em; font-size: 12px; }
#md-content th, #md-content td { border: 1px solid var(--border); padding: 5px 12px; text-align: left; white-space: nowrap; }
#md-content th { font-weight: 700; color: var(--fg-bold); background: var(--bg-code); }

/* Horizontal rules — generous separation */
#md-content hr { border: none; border-top: 1px solid var(--border); margin: 1.2em -20px; }

/* Inline elements */
#md-content a { color: var(--accent); text-decoration: underline; }
#md-content img { max-width: 100%; }
#md-content strong { color: var(--fg-bold); }

/* --- Highlights --- */
mark.hl {
  background: var(--hl-bg);
  color: inherit;
  border-radius: 2px;
  position: relative;
  cursor: pointer;
}
mark.hl.hl-active { background: rgba(136,136,136,0.35); }
mark.hl-edit {
  background: transparent;
  color: inherit;
  border-radius: 2px;
  position: relative;
  cursor: pointer;
  border-bottom: 1.5px dashed var(--fg-faint);
}
mark.hl-edit.hl-active { border-bottom-color: var(--accent); }
mark.hl-pending {
  background: var(--hl-bg);
  color: inherit;
  border-radius: 2px;
}
.diff-del {
  text-decoration: line-through;
  color: var(--fg-faint);
  opacity: 0.6;
}
.diff-ins {
  display: inline;
  margin-left: 4px;
  padding: 0 2px;
  background: rgba(100,180,100,0.08);
  border-bottom: 1px dashed rgba(100,180,100,0.4);
}
.badge {
  display: inline-block;
  background: var(--accent);
  color: var(--bg);
  font-size: 9px;
  line-height: 14px;
  min-width: 14px;
  text-align: center;
  border-radius: 7px;
  padding: 0 3px;
  margin-right: 1px;
  vertical-align: top;
  font-weight: bold;
}

/* --- Margin cards --- */
.margin-card {
  position: absolute;
  left: 10px;
  right: 10px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  padding: 8px 10px;
  font-size: 11px;
  line-height: 1.5;
  cursor: pointer;
  transition: border-color 0.15s;
}
.margin-card.active {
  border-color: var(--border-focus);
}
.card-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}
.card-head-main {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.card-head .badge {
  flex-shrink: 0;
  margin-right: 0;
}
.card-quote {
  color: var(--fg-faint);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  padding-bottom: 4px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
  font-size: 10px;
}
.card-toggle {
  background: none;
  border: none;
  color: var(--fg-ghost);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  line-height: 1;
  padding: 4px 6px;
  margin: -4px -6px;
  flex-shrink: 0;
  border-radius: 3px;
}
.card-toggle:hover { color: var(--fg-dim); background: var(--hl-bg); }
.card-body {
  color: var(--fg);
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 4px;
}
.card-collapsed-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
}
.card-collapsed-text,
.card-collapsed-meta {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-collapsed-text {
  min-width: 0;
  color: var(--fg);
  flex: 1;
}
.card-collapsed-meta {
  color: var(--fg-faint);
  flex-shrink: 0;
}
.thread-group + .thread-group {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.thread-question {
  color: var(--fg);
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 6px;
}
.thread-note {
  color: var(--fg-dim);
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 6px;
}
.thread-answer,
.card-loading {
  margin-top: 6px;
  margin-left: 12px;
  color: var(--fg-dim);
  white-space: pre-wrap;
  word-break: break-word;
}
.edit-summary {
  margin-top: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}
.edit-state {
  margin-top: 6px;
  color: var(--fg-dim);
}
.card-followup {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.inline-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: var(--fg-ghost);
  font-size: 11px;
}
.action-sep {
  color: var(--fg-ghost);
}
.text-action {
  background: none;
  border: none;
  color: var(--fg-ghost);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  padding: 0;
  line-height: 1;
  transition: color 0.15s;
}
.text-action:hover:not(:disabled) { color: var(--fg-dim); }
.text-action.primary {
  color: var(--fg-dim);
}
.text-action.primary:hover:not(:disabled) {
  color: var(--fg-bold);
}
.text-action:disabled {
  opacity: 0.45;
  cursor: default;
}
.text-action.action-delete:hover { color: var(--err); }
.followup-trigger {
  margin-top: 8px;
  color: var(--fg-ghost);
  cursor: pointer;
  font-size: 11px;
}
.followup-trigger:hover { color: var(--fg-dim); }

/* Card edit mode */
.card-edit-area {
  width: 100%;
  padding: 0 0 6px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--fg);
  font: inherit;
  font-size: 11px;
  resize: vertical;
  min-height: 44px;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 6px;
}
.card-edit-area:focus { outline: none; border-bottom-color: var(--border-focus); }

/* --- Section dividers --- */
.section-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--fg-dim);
  font-size: 12px;
  margin: 28px -20px 12px;
}
.section-divider::before,
.section-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

/* --- Annotation summary items --- */
.annotation-item {
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  font-size: 12px;
}
.annotation-item:last-child { border-bottom: none; }
.annotation-item:hover { background: var(--hl-bg); margin: 0 -6px; padding: 6px 6px; border-radius: 3px; }
.annotation-header { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.annotation-section { color: var(--fg-dim); }
.annotation-quote { color: var(--fg-faint); font-style: italic; }
.annotation-body { padding-left: 20px; color: var(--fg); margin-top: 2px; }
.annotation-answer { padding-left: 20px; color: var(--fg-dim); margin-top: 4px; white-space: pre-wrap; }

/* --- Feedback --- */
.feedback-section { padding-bottom: 20px; }
.txt {
  display: block;
  width: 100%;
  padding: 8px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  resize: vertical;
}
.txt:focus { outline: 2px solid var(--border-focus); outline-offset: 1px; border-color: var(--border-focus); }
.txt::placeholder { color: var(--fg-ghost); }

/* --- Comment popup --- */
.popup {
  display: none;
  position: fixed;
  z-index: 50;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 10px;
  width: 320px;
}
.popup.visible { display: block; }
.popup-quote {
  font-size: 11px;
  color: var(--fg-dim);
  margin-bottom: 8px;
  max-height: 42px;
  overflow: hidden;
  text-overflow: ellipsis;
  border-left: 2px solid var(--border);
  padding-left: 8px;
  font-style: italic;
}
.popup-text {
  width: 100%;
  padding: 6px 8px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  resize: none;
  margin-bottom: 8px;
}
.popup-text:focus { outline: none; border-color: var(--border-focus); }
.popup-actions { display: flex; align-items: center; gap: 4px; }
.popup-actions .btn { background: none; border: none; color: var(--fg-faint); font-size: 11px; padding: 3px 8px; border-radius: 3px; }
.popup-actions .btn:hover:not(:disabled) { color: var(--fg-dim); background: var(--hl-bg); }
.popup-btn-cancel { }
.popup-btn-primary { color: var(--fg-dim) !important; }

/* --- Selection action button --- */
.sel-action {
  display: none;
  position: fixed;
  z-index: 45;
  background: var(--btn-bg);
  color: var(--fg-bold);
  border: 1px solid var(--btn-border);
  border-radius: 3px;
  font: inherit;
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.sel-action:hover { background: var(--hl-bg); }
.sel-action.visible { display: block; }

/* --- Bottom bar --- */
.botbar {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  border-top: 1px solid var(--border);
  background: var(--bar-bg);
  z-index: 10;
}
.kbd { color: var(--fg-faint); font-size: 11px; }

/* --- Overlay --- */
.overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 100;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--fg-dim);
}
.overlay b { color: var(--fg-bold); }

/* --- Scrollbars --- */
.scroll-area, .toc { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.scroll-area::-webkit-scrollbar, .toc::-webkit-scrollbar { width: 6px; }
.scroll-area::-webkit-scrollbar-track, .toc::-webkit-scrollbar-track { background: transparent; }
.scroll-area::-webkit-scrollbar-thumb, .toc::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.scroll-area::-webkit-scrollbar-thumb:hover, .toc::-webkit-scrollbar-thumb:hover { background: var(--border-focus); }

/* --- Margin vertical border (always full height) --- */
body::after {
  content: "";
  grid-row: 2;
  grid-column: 2;
  justify-self: end;
  width: 260px;
  border-left: 1px solid var(--border);
  pointer-events: none;
  z-index: 2;
}

/* --- TOC toggle (leftmost in topbar) --- */
.toc-toggle {
  background: none;
  border: none;
  color: var(--fg-faint);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
  margin-right: 8px;
  transition: color 0.1s;
  flex-shrink: 0;
}
.toc-toggle:hover { color: var(--fg-bold); }

/* No TOC */
body.no-toc { grid-template-columns: 0px 1fr; }
body.no-toc .toc { opacity: 0; pointer-events: none; border-right-color: transparent; }
/* When there are literally no headings, skip the column entirely */
body.no-toc-empty { grid-template-columns: 1fr; }
body.no-toc-empty .toc { display: none; }
body.no-toc-empty .toc-toggle { display: none; }

/* --- Print --- */
@media print {
  .topbar, .botbar, .toc, .margin-col, .popup, .sel-action, #overlay,
  .feedback-section, #annotations-section { display: none !important; }
  body { display: block; }
  .scroll-area { overflow: visible; }
  .content-col { max-width: 100%; padding: 0; }
}
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-left">
    <button class="toc-toggle" id="toc-toggle" type="button" title="Toggle sidebar ([)">\u2261</button>
    <div class="title">Review: ${escapeHtml(title)}</div>
    ${description ? `<div class="desc">${escapeHtml(description)}</div>` : ""}
  </div>
  <div class="topbar-right">
    <button class="btn" id="export-pdf" type="button">Export PDF</button>
    <button class="theme-toggle" id="toggle" type="button" title="Toggle theme">◑</button>
  </div>
</div>

<nav class="toc" id="toc"></nav>

<div class="scroll-area" id="scroll-area">
  <div class="content-col" id="content-col">
    <div id="md-content" tabindex="0" role="document" aria-label="Document content" spellcheck="false"></div>
    <div id="annotations-section" hidden>
      <div class="section-divider"><span>Annotations (<span id="annotation-count">0</span>)</span></div>
      <div id="annotations-list"></div>
    </div>
    <div class="feedback-section">
      <div class="section-divider"><span>Anything else?</span></div>
      <textarea class="txt" id="general-feedback" rows="3" placeholder="General feedback\u2026"></textarea>
    </div>
  </div>
  <div class="margin-col" id="margin-col" role="complementary"></div>
</div>

<div class="botbar">
  <span class="kbd">\u2318\u21B5 submit \u00b7 c/a annotate \u00b7 \u2325\u21B5 edit \u00b7 y/n accept or reject edit \u00b7 n/p next/prev \u00b7 e edit \u00b7 d delete \u00b7 [ sidebar</span>
  <button class="btn" id="sub" type="button">Submit</button>
</div>

  <button id="sel-action" class="sel-action" type="button">Comment</button>
  <div id="popup" class="popup">
  <div class="popup-quote" id="popup-quote"></div>
  <textarea class="popup-text" id="popup-text" rows="2" placeholder="Write a note or question\u2026"></textarea>
  <div class="popup-actions">
    <button class="btn popup-btn-cancel" id="popup-cancel" type="button">Cancel</button>
    <span style="flex:1"></span>
    <button class="btn" id="popup-edit-action" type="button">Edit \u2325\u21B5</button>
    <button class="btn" id="popup-ask-action" type="button">Ask \u2318\u21B5</button>
    <button class="btn popup-btn-primary" id="popup-comment-action" type="button">Comment \u21B5</button>
  </div>
</div>

<div class="overlay" id="overlay">
  <b>Submitted.</b>&nbsp;You can close this tab.
</div>

<script>
(function(){
  const raw = ${serializeForInlineScript(content)};
  const renderedHtml = ${serializeForInlineScript(contentHtml ?? null)};
  const hydration = ${serializeForInlineScript(
    hydration ?? {
      session_id: null,
      comments: [],
      questions: [],
      edits: [],
      general_feedback: "",
      pending_interaction_id: null,
      pending_edit_id: null,
    }
  )};

  const contentEl = document.getElementById("md-content");
  const tocEl = document.getElementById("toc");
  const scrollArea = document.getElementById("scroll-area");
  const marginCol = document.getElementById("margin-col");
  const popup = document.getElementById("popup");
  const popupQuote = document.getElementById("popup-quote");
  const popupText = document.getElementById("popup-text");
  const popupEditAction = document.getElementById("popup-edit-action");
  const popupCommentAction = document.getElementById("popup-comment-action");
  const popupAskAction = document.getElementById("popup-ask-action");
  const popupCancel = document.getElementById("popup-cancel");
  const annotationsList = document.getElementById("annotations-list");
  const annotationsSection = document.getElementById("annotations-section");
  const annotationCountEl = document.getElementById("annotation-count");
  const generalFeedback = document.getElementById("general-feedback");
  const overlay = document.getElementById("overlay");
  const toggle = document.getElementById("toggle");
  const sub = document.getElementById("sub");
  const exportPdfBtn = document.getElementById("export-pdf");
  const selActionBtn = document.getElementById("sel-action");
  const MAX_SSE_FAILURES = 5;

  let comments = [];
  let questions = [];
  let edits = [];
  let sent = false;
  let currentRange = null;
  let activeInteractionId = null;
  function normalizePendingId(value) {
    const text = typeof value === "string" ? value.trim() : "";
    return text || null;
  }

  let pendingInteractionId = normalizePendingId(hydration.pending_interaction_id);
  let pendingEditId = normalizePendingId(hydration.pending_edit_id);
  let feedbackSyncTimer = null;
  let eventSource = null;
  let reviewClosed = false;
  let sseStopped = false;
  let sseFailureCount = 0;
  let connectionStatus = "";
  let nextCommentNumber = 1;
  let nextQuestionNumber = 1;
  let nextEditNumber = 1;

  function trunc(s, n) {
    return s.length > n ? s.slice(0, n) + "\\u2026" : s;
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return prefix + "-" + window.crypto.randomUUID();
    }
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function nextNumberFrom(items, prefix) {
    let max = 0;
    items.forEach(function(item) {
      const label = String(item.badge_label || "");
      const match = prefix
        ? label.match(new RegExp("^" + prefix + "(\\\\d+)$"))
        : label.match(/^(\\d+)$/);
      if (match) {
        max = Math.max(max, parseInt(match[1], 10));
      }
    });
    return max + 1;
  }

  function normalizeAnchor(anchor) {
    const start = Math.max(0, Number(anchor && anchor.offset_start) || 0);
    const end = Math.max(start, Number(anchor && anchor.offset_end) || start);
    return {
      offset_start: start,
      offset_end: end,
      surrounding_context: String(anchor?.surrounding_context ?? ""),
      selected_text: String(anchor?.selected_text ?? ""),
      section: String(anchor?.section ?? ""),
    };
  }

  function normalizeComment(comment) {
    return {
      interaction_id: String(comment && comment.interaction_id || makeId("comment")),
      badge_label: String(comment && comment.badge_label || nextCommentNumber++),
      anchor: normalizeAnchor(comment && comment.anchor),
      comment: String(comment?.comment ?? ""),
      _editing: false,
      _collapsed: false,
    };
  }

  function normalizeEdit(edit) {
    let status = String(edit && edit.status || "");
    const hasProposal =
      !!edit && Object.prototype.hasOwnProperty.call(edit, "proposed_replacement");
    if (!status) {
      if (edit && edit.accepted === true) status = "accepted";
      else if (edit && edit.accepted === false) status = "rejected";
      else if (hasProposal) status = "proposed";
      else status = "pending";
    }

    return {
      interaction_id: String(edit && edit.interaction_id || makeId("edit")),
      badge_label: String(edit && edit.badge_label || ("E" + nextEditNumber++)),
      anchor: normalizeAnchor(edit && edit.anchor),
      selected_text: String(edit && (edit.selected_text || edit.anchor && edit.anchor.selected_text) || ""),
      instruction: String(edit?.instruction ?? ""),
      proposed_replacement: String(edit?.proposed_replacement ?? ""),
      status: status,
      _collapsed: status === "accepted",
    };
  }

  function normalizeThreadEntry(entry, fallbackInteractionId) {
    const kind = entry && entry.kind === "note" ? "note" : "question";
    return {
      interaction_id: String(entry && entry.interaction_id || fallbackInteractionId || makeId("question")),
      parent_interaction_id: entry && entry.parent_interaction_id
        ? String(entry.parent_interaction_id)
        : null,
      kind: kind,
      question: kind === "question" ? String(entry ? (entry.question ?? entry.content) : "") : "",
      content: kind === "note" ? String(entry ? (entry.content ?? entry.question) : "") : "",
      answer: kind === "question" ? String(entry?.answer ?? "") : "",
    };
  }

  function normalizeQuestion(question) {
    const entries = Array.isArray(question && question.thread) && question.thread.length
      ? question.thread.map(function(entry, index) {
          return normalizeThreadEntry(
            entry,
            question && question.interaction_id && index === 0 ? question.interaction_id : null
          );
        })
      : [normalizeThreadEntry(question, question && question.interaction_id)];
    const interactionId = String(question && question.interaction_id || entries[0].interaction_id);
    entries[0].interaction_id = interactionId;
    entries[0].parent_interaction_id = null;

    return {
      interaction_id: interactionId,
      badge_label: String(question && question.badge_label || ("Q" + nextQuestionNumber++)),
      anchor: normalizeAnchor(question && question.anchor),
      thread: entries,
      _collapsed: false,
      _composerOpen: false,
      _composerValue: "",
    };
  }

  function getThreadEntryText(entry) {
    if (!entry) return "";
    return entry.kind === "note" ? String(entry.content ?? "") : String(entry.question ?? "");
  }

  function getFirstQuestionEntry(questionThread) {
    if (!questionThread || !Array.isArray(questionThread.thread)) return null;
    return questionThread.thread.find(function(entry) {
      return entry.kind === "question";
    }) || questionThread.thread[0] || null;
  }

  function getThreadMessageCount(questionThread) {
    if (!questionThread || !Array.isArray(questionThread.thread)) return 0;
    return questionThread.thread.reduce(function(total, entry) {
      if (entry.kind === "note") return total + 1;
      return total + 1 + (entry.answer ? 1 : 0);
    }, 0);
  }

  function isQuestionThreadPending(questionThread) {
    if (!questionThread || !Array.isArray(questionThread.thread)) return false;
    return questionThread.thread.some(function(entry) {
      return entry.kind === "question" && !entry.answer;
    });
  }

  function getQuestionThreadById(interactionId) {
    return questions.find(function(question) { return question.interaction_id === interactionId; }) || null;
  }

  function getQuestionThreadByEntryId(interactionId) {
    return questions.find(function(question) {
      return question.thread.some(function(entry) { return entry.interaction_id === interactionId; });
    }) || null;
  }

  function getQuestionEntryById(interactionId) {
    const questionThread = getQuestionThreadByEntryId(interactionId);
    if (!questionThread) return null;
    return questionThread.thread.find(function(entry) {
      return entry.interaction_id === interactionId;
    }) || null;
  }

  function normalizeQuestions(questionList) {
    const normalizedInput = Array.isArray(questionList) ? questionList : [];
    const normalized = [];
    const threadedQuestions = [];
    const flatEntries = [];
    const entryById = {};
    const rawById = {};

    normalizedInput.forEach(function(rawQuestion, index) {
      if (rawQuestion && Array.isArray(rawQuestion.thread)) {
        threadedQuestions.push(rawQuestion);
        return;
      }

      const entry = normalizeThreadEntry(rawQuestion, rawQuestion && rawQuestion.interaction_id);
      flatEntries.push({
        entry: entry,
        rawQuestion: rawQuestion,
        index: index,
      });
      entryById[entry.interaction_id] = entry;
      rawById[entry.interaction_id] = rawQuestion;
    });

    threadedQuestions.forEach(function(rawQuestion) {
      normalized.push(normalizeQuestion(rawQuestion));
    });

    const groupedEntries = {};

    flatEntries.forEach(function(item) {
      const visited = {};
      let rootId = item.entry.interaction_id;
      let currentEntry = item.entry;

      while (currentEntry.parent_interaction_id && !visited[currentEntry.interaction_id]) {
        visited[currentEntry.interaction_id] = true;
        rootId = currentEntry.parent_interaction_id;
        currentEntry = entryById[currentEntry.parent_interaction_id] || null;
      }

      groupedEntries[rootId] = groupedEntries[rootId] || [];
      groupedEntries[rootId].push({
        entry: item.entry,
        rawQuestion: item.rawQuestion,
        index: item.index,
      });
    });

    Object.keys(groupedEntries).forEach(function(rootId) {
      const entriesForRoot = groupedEntries[rootId];
      if (!entriesForRoot || !entriesForRoot.length) return;

      entriesForRoot.sort(function(a, b) {
        const aIsRoot = a.entry.interaction_id === rootId ? 0 : 1;
        const bIsRoot = b.entry.interaction_id === rootId ? 0 : 1;
        if (aIsRoot !== bIsRoot) return aIsRoot - bIsRoot;
        return a.index - b.index;
      });

      entriesForRoot.forEach(function(item) {
        if (item.entry.interaction_id === rootId) {
          item.entry.parent_interaction_id = null;
        }
      });

      const metaSource = rawById[rootId] || entriesForRoot[0].rawQuestion;
      normalized.push({
        interaction_id: String(rootId),
        badge_label: String(metaSource && metaSource.badge_label || ("Q" + nextQuestionNumber++)),
        anchor: normalizeAnchor(metaSource && metaSource.anchor),
        thread: entriesForRoot.map(function(item) { return item.entry; }),
        _collapsed: false,
        _composerOpen: false,
        _composerValue: "",
      });
    });

    return normalized;
  }

  function getDocumentText() {
    const clone = contentEl.cloneNode(true);
    clone.querySelectorAll(".badge, .diff-ins").forEach(function(el) { el.remove(); });
    return clone.textContent || "";
  }

  function getPlainRangeText(range) {
    const fragment = range.cloneContents();
    if (fragment.querySelectorAll) {
      fragment.querySelectorAll(".badge, .diff-ins").forEach(function(el) { el.remove(); });
    }
    return fragment.textContent || "";
  }

  function selectionTouchesContent(selection) {
    if (!selection || selection.rangeCount === 0) return false;
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode) return false;
    return contentEl.contains(anchorNode) || contentEl.contains(focusNode);
  }

  function isIgnoredTextNode(node) {
    let el = node && node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== contentEl) {
      if (el.classList && (el.classList.contains("badge") || el.classList.contains("diff-ins"))) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function getCommentById(interactionId) {
    return comments.find(function(comment) { return comment.interaction_id === interactionId; }) || null;
  }

  function getEditById(interactionId) {
    return edits.find(function(edit) { return edit.interaction_id === interactionId; }) || null;
  }

  function getActiveEditableComment() {
    if (!activeInteractionId) return null;
    return getCommentById(activeInteractionId);
  }

  function getActiveEditableEdit() {
    const edit = activeInteractionId ? getEditById(activeInteractionId) : null;
    if (!edit || edit.status !== "proposed") return null;
    return edit;
  }

  function getAllInteractions() {
    const items = [];
    comments.forEach(function(comment) {
      items.push({
        kind: "comment",
        interaction_id: comment.interaction_id,
        badge_label: comment.badge_label,
        anchor: comment.anchor,
        comment: comment.comment,
        editing: comment._editing === true,
      });
    });
    questions.forEach(function(question) {
      const firstEntry = getFirstQuestionEntry(question);
      items.push({
        kind: "question",
        interaction_id: question.interaction_id,
        badge_label: question.badge_label,
        anchor: question.anchor,
        thread: question.thread,
        collapsed: question._collapsed === true,
        question: firstEntry ? getThreadEntryText(firstEntry) : "",
        pending: isQuestionThreadPending(question),
      });
    });
    edits.forEach(function(edit) {
      items.push({
        kind: "edit",
        interaction_id: edit.interaction_id,
        badge_label: edit.badge_label,
        anchor: edit.anchor,
        selected_text: edit.selected_text,
        instruction: edit.instruction,
        proposed_replacement: edit.proposed_replacement,
        status: edit.status,
        collapsed: edit._collapsed === true,
      });
    });
    items.sort(function(a, b) {
      return a.anchor.offset_start - b.anchor.offset_start;
    });
    return items;
  }

  function canStartAsk() {
    return canStartAgentInteraction();
  }

  function canStartEdit() {
    return canStartAgentInteraction();
  }

  function hasPendingAgentInteraction() {
    return !!(pendingInteractionId || pendingEditId);
  }

  function canStartAgentInteraction() {
    return !reviewClosed && !hasPendingAgentInteraction() && !sseStopped;
  }

  function getBlockedActionReason() {
    if (reviewClosed) return "closed";
    if (hasPendingAgentInteraction()) return "waiting";
    if (sseStopped) return "offline";
    return "";
  }

  function updatePopupActions() {
    const askBlocked = getBlockedActionReason();
    const editBlocked = getBlockedActionReason();

    popupAskAction.disabled = !!askBlocked;
    popupEditAction.disabled = !!editBlocked;

    popupAskAction.textContent = askBlocked ? "Ask (" + askBlocked + ")" : "Ask \u2318\u21B5";
    popupEditAction.textContent = editBlocked ? "Edit (" + editBlocked + ")" : "Edit \u2325\u21B5";
  }

  async function postEvent(payload) {
    const res = await fetch("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let message = String(res.status);
      try {
        const data = await res.json();
        if (data && data.error) {
          message = data.error;
        }
      } catch {}
      throw new Error(message);
    }

    try {
      return await res.json();
    } catch {
      return { ok: true };
    }
  }

  function scheduleFeedbackSync() {
    if (feedbackSyncTimer) {
      clearTimeout(feedbackSyncTimer);
    }
    feedbackSyncTimer = setTimeout(function() {
      postEvent({
        type: "draft_feedback",
        general_feedback: generalFeedback.value,
      }).catch(function() {});
    }, 250);
  }

  function stopEventSource() {
    if (!eventSource) return;
    eventSource.onopen = null;
    eventSource.onmessage = null;
    eventSource.onerror = null;
    eventSource.close();
    eventSource = null;
  }

  function showOverlayMessage(title, message) {
    overlay.innerHTML = "<b>" + esc(title) + "</b>&nbsp;" + esc(message);
    overlay.style.display = "flex";
  }

  function connectEventSource() {
    if (eventSource || sseStopped || reviewClosed) return;

    eventSource = new EventSource("/sse");
    eventSource.onopen = function() {
      sseFailureCount = 0;
      if (connectionStatus) {
        connectionStatus = "";
        updateUI();
      }
    };
    eventSource.onmessage = function(event) {
      try {
        handleServerEvent(JSON.parse(event.data));
      } catch {}
    };
    eventSource.onerror = function() {
      if (reviewClosed || sent) {
        sseStopped = true;
        stopEventSource();
        return;
      }

      sseFailureCount += 1;
      if (sseFailureCount >= MAX_SSE_FAILURES) {
        sseStopped = true;
        connectionStatus = "connection lost";
        stopEventSource();
        updateUI();
      }
    };
  }

  function handleServerEvent(event) {
    if (event.type === "answer") {
      const questionThread = getQuestionThreadByEntryId(event.interaction_id);
      const questionEntry = getQuestionEntryById(event.interaction_id);
      if (!questionThread || !questionEntry) return;
      questionEntry.answer = String(event.content ?? "");
      questionThread._collapsed = false;
      questionThread._composerOpen = false;
      questionThread._composerValue = "";
      if (pendingInteractionId === questionEntry.interaction_id) {
        pendingInteractionId = null;
      }
      updateUI();
      return;
    }

    if (event.type === "edit_proposal") {
      const edit = getEditById(event.interaction_id);
      if (!edit) return;
      edit.proposed_replacement = String(event.content ?? "");
      edit.status = "proposed";
      edit._collapsed = false;
      if (pendingEditId === edit.interaction_id) {
        pendingEditId = null;
      }
      renderEditMarks(edit);
      updateUI();
      return;
    }

    if (event.type === "session_closed") {
      reviewClosed = true;
      sseStopped = true;
      pendingInteractionId = null;
      pendingEditId = null;
      connectionStatus = "";
      stopEventSource();
      sub.disabled = true;
      updateUI();
      if (!sent) {
        showOverlayMessage("Review session closed.", "You can close this tab.");
      }
    }
  }

  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    toggle.textContent = "\u25D1";
    try { localStorage.setItem("wft", t); } catch(e) {}
  }
  toggle.addEventListener("click", function() {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  });
  try { const saved = localStorage.getItem("wft"); if (saved) setTheme(saved); } catch(e) {}

  exportPdfBtn.addEventListener("click", function() { window.print(); });

  const tocToggle = document.getElementById("toc-toggle");
  let tocHidden = true;
  function setTocVisible(show) {
    tocHidden = !show;
    document.body.classList.toggle("no-toc", tocHidden);
    try { localStorage.setItem("wft-toc", tocHidden ? "0" : "1"); } catch(e) {}
    setTimeout(positionCards, 160);
  }
  tocToggle.addEventListener("click", function() { setTocVisible(tocHidden); });
  try { if (localStorage.getItem("wft-toc") === "1") setTocVisible(true); else setTocVisible(false); } catch(e) { setTocVisible(false); }

  try {
    if (!renderedHtml) throw 0;
    contentEl.innerHTML = renderedHtml;
  } catch(e) {
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.wordBreak = "break-word";
    pre.textContent = raw;
    contentEl.appendChild(pre);
  }

  const usedIds = {};
  contentEl.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(function(h) {
    if (!h.id) {
      const base = h.textContent.trim().toLowerCase().replace(/[^\\w]+/g, "-").replace(/^-|-$/g, "") || "heading";
      let id = base;
      let n = 1;
      while (usedIds[id]) { id = base + "-" + (++n); }
      h.id = id;
    }
    usedIds[h.id] = true;
  });

  (function buildToc() {
    const headers = contentEl.querySelectorAll("h1,h2,h3,h4,h5,h6");
    if (!headers.length) { document.body.classList.add("no-toc-empty"); tocToggle.hidden = true; return; }
    let html = "";
    headers.forEach(function(h) {
      const level = parseInt(h.tagName[1], 10);
      const indent = (level - 1) * 12;
      html += '<a class="toc-link" href="#' + h.id + '" style="padding-left:' + (14 + indent) + 'px" title="' + esc(h.textContent.trim()) + '">' + esc(h.textContent.trim()) + '</a>';
    });
    tocEl.innerHTML = html;

    const links = tocEl.querySelectorAll(".toc-link");
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          links.forEach(function(l) { l.classList.remove("active"); });
          const link = tocEl.querySelector('.toc-link[href="#' + entry.target.id + '"]');
          if (link) link.classList.add("active");
        }
      });
    }, { root: scrollArea, rootMargin: "0px 0px -80% 0px" });
    headers.forEach(function(h) { observer.observe(h); });

    tocEl.addEventListener("click", function(e) {
      const link = e.target.closest(".toc-link");
      if (!link) return;
      e.preventDefault();
      const target = document.getElementById(link.getAttribute("href").slice(1));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  })();

  function getCharOffset(container, offset) {
    const r = document.createRange();
    r.selectNodeContents(contentEl);
    r.setEnd(container, offset);
    const fragment = r.cloneContents();
    if (fragment.querySelectorAll) {
      fragment.querySelectorAll(".badge, .diff-ins").forEach(function(el) { el.remove(); });
    }
    return (fragment.textContent || "").length;
  }

  function findSection(node) {
    let el = node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== contentEl) {
      let prev = el.previousElementSibling;
      while (prev) {
        if (/^H[1-6]$/.test(prev.tagName)) {
          const level = parseInt(prev.tagName[1], 10);
          return "#".repeat(level) + " " + prev.textContent.trim();
        }
        prev = prev.previousElementSibling;
      }
      el = el.parentNode;
    }
    return "";
  }

  function buildAnchorFromRange(range) {
    const rawSelectedText = getPlainRangeText(range);
    const selectedText = rawSelectedText.trim();
    const startOff = getCharOffset(range.startContainer, range.startOffset);
    const endOff = startOff + rawSelectedText.length;
    if (!selectedText || endOff <= startOff) {
      return null;
    }
    const fullText = getDocumentText();
    return {
      offset_start: startOff,
      offset_end: endOff,
      surrounding_context: fullText.slice(Math.max(0, startOff - 50), Math.min(fullText.length, endOff + 50)),
      selected_text: selectedText,
      section: findSection(range.startContainer),
    };
  }

  function wrapMark(textNode, interactionId, badgeLabel, isFirst, className) {
    const mark = document.createElement("mark");
    mark.className = className;
    if (interactionId) {
      mark.dataset.key = interactionId;
    }
    textNode.parentNode.insertBefore(mark, textNode);
    mark.appendChild(textNode);
    if (isFirst && badgeLabel) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = badgeLabel;
      mark.insertBefore(badge, mark.firstChild);
    }
  }

  function getFirstTextNodeInSubtree(node) {
    if (!node) return null;
    if (node.nodeType === 3) {
      return isIgnoredTextNode(node) ? null : node;
    }

    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      if (!isIgnoredTextNode(textNode)) {
        return textNode;
      }
    }
    return null;
  }

  function getLastTextNodeInSubtree(node) {
    if (!node) return null;
    if (node.nodeType === 3) {
      return isIgnoredTextNode(node) ? null : node;
    }

    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let last = null;
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      if (!isIgnoredTextNode(textNode)) {
        last = textNode;
      }
    }
    return last;
  }

  function getNextTextNodeAfter(node) {
    if (!node) return null;
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      if (isIgnoredTextNode(textNode)) continue;
      if (node.contains && node.contains(textNode)) continue;
      if (node !== textNode && (node.compareDocumentPosition(textNode) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        return textNode;
      }
    }
    return null;
  }

  function getPreviousTextNodeBefore(node) {
    if (!node) return null;
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    let previous = null;
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      if (isIgnoredTextNode(textNode)) continue;
      if (node.contains && node.contains(textNode)) continue;
      if (node !== textNode && (node.compareDocumentPosition(textNode) & Node.DOCUMENT_POSITION_PRECEDING)) {
        previous = textNode;
      }
    }
    return previous;
  }

  function highlightRangeWithClass(range, interactionId, badgeLabel, className) {
    let startC = range.startContainer;
    let endC = range.endContainer;
    let startO = range.startOffset;
    let endO = range.endOffset;

    if (startC.nodeType !== 3) {
      const children = startC.childNodes;
      if (startO < children.length) {
        const first = getFirstTextNodeInSubtree(children[startO]);
        if (first) { startC = first; startO = 0; }
      } else {
        const next = getNextTextNodeAfter(startC);
        if (next) { startC = next; startO = 0; }
      }
    }
    if (endC.nodeType !== 3) {
      const children = endC.childNodes;
      if (endO > 0 && endO <= children.length) {
        const last = getLastTextNodeInSubtree(children[endO - 1]);
        if (last) { endC = last; endO = last.textContent.length; }
      } else if (endO === 0) {
        const previous = getPreviousTextNodeBefore(endC);
        if (previous) { endC = previous; endO = previous.textContent.length; }
      }
    }

    if (startC === endC && startC.nodeType === 3) {
      if (startO === endO) return;
      const mid = startC.splitText(startO);
      mid.splitText(endO - startO);
      wrapMark(mid, interactionId, badgeLabel, true, className);
      return;
    }

    let ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType === 3) ancestor = ancestor.parentNode;

    const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let inRange = false;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (isIgnoredTextNode(node)) continue;
      if (node === startC) {
        inRange = true;
        const info = { node: node, start: startO, end: node.textContent.length };
        if (node === endC) { info.end = endO; nodes.push(info); break; }
        nodes.push(info);
        continue;
      }
      if (node === endC) { nodes.push({ node: node, start: 0, end: endO }); break; }
      if (inRange) { nodes.push({ node: node, start: 0, end: node.textContent.length }); }
    }

    for (let i = nodes.length - 1; i >= 0; i--) {
      const info = nodes[i];
      const node = info.node;
      const s = info.start;
      const e = info.end;
      const nodeLen = node.textContent.length;
      if (s >= e || !nodeLen) continue;

      let target;
      if (s > 0) { target = node.splitText(s); } else { target = node; }
      if (e < nodeLen) { target.splitText(e - s); }
      wrapMark(target, interactionId, badgeLabel, i === 0, className);
    }
  }

  function removeHighlight(interactionId) {
    const marks = contentEl.querySelectorAll('mark.hl[data-key="' + interactionId + '"]');
    marks.forEach(function(mark) {
      const badge = mark.querySelector(".badge");
      if (badge) badge.remove();
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
  }

  function removeEditHighlight(interactionId) {
    const marks = contentEl.querySelectorAll('mark.hl-edit[data-key="' + interactionId + '"]');
    marks.forEach(function(mark) {
      const badge = mark.querySelector(".badge");
      if (badge) badge.remove();
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
  }

  function applyHighlightFromOffsets(startOff, endOff, interactionId, badgeLabel, className) {
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let startNode;
    let endNode;
    let startNodeOff;
    let endNodeOff;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (isIgnoredTextNode(node)) continue;
      const len = node.textContent.length;
      if (!startNode && pos + len > startOff) { startNode = node; startNodeOff = startOff - pos; }
      if (pos + len >= endOff) { endNode = node; endNodeOff = endOff - pos; break; }
      pos += len;
    }

    if (startNode && endNode) {
      try {
        const r = document.createRange();
        r.setStart(startNode, Math.min(startNodeOff, startNode.textContent.length));
        r.setEnd(endNode, Math.min(endNodeOff, endNode.textContent.length));
        highlightRangeWithClass(r, interactionId, badgeLabel, className || "hl");
      } catch(e) {}
    }
  }

  function highlightAnchor(anchor, interactionId, badgeLabel, className) {
    if (!anchor) return;
    applyHighlightFromOffsets(
      anchor.offset_start,
      anchor.offset_end,
      interactionId,
      badgeLabel,
      className || "hl"
    );
  }

  function restoreHighlights() {
    edits
      .slice()
      .sort(function(a, b) { return a.anchor.offset_start - b.anchor.offset_start; })
      .forEach(function(edit) {
        highlightAnchor(edit.anchor, edit.interaction_id, edit.badge_label, "hl-edit");
        renderEditMarks(edit);
      });
    comments.forEach(function(comment) {
      highlightAnchor(comment.anchor, comment.interaction_id, comment.badge_label, "hl");
    });
    questions.forEach(function(question) {
      highlightAnchor(question.anchor, question.interaction_id, question.badge_label, "hl");
    });
  }

  function placeCursorAtInteraction(interactionId) {
    const mark = contentEl.querySelector('mark[data-key="' + interactionId + '"]');
    if (!mark) return;
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(mark);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function setActiveInteraction(interactionId) {
    if (activeInteractionId === interactionId) return;
    activeInteractionId = interactionId;

    marginCol.querySelectorAll(".margin-card").forEach(function(card) {
      card.classList.toggle("active", card.dataset.key === interactionId);
    });

    contentEl.querySelectorAll("mark.hl, mark.hl-edit").forEach(function(mark) {
      mark.classList.toggle("hl-active", mark.dataset.key === interactionId);
    });

    annotationsList.querySelectorAll(".annotation-item").forEach(function(item) {
      item.style.fontWeight = item.dataset.key === interactionId ? "bold" : "";
    });
  }

  function positionCards() {
    const cards = marginCol.querySelectorAll(".margin-card");
    const positions = [];

    cards.forEach(function(card) {
      const interactionId = card.dataset.key;
      const mark = contentEl.querySelector('mark[data-key="' + interactionId + '"]');
      positions.push({ card: card, top: mark ? mark.offsetTop : 0 });
    });

    positions.sort(function(a, b) { return a.top - b.top; });

    let prevBottom = 0;
    positions.forEach(function(position) {
      const top = Math.max(position.top, prevBottom);
      position.card.style.top = top + "px";
      prevBottom = top + position.card.offsetHeight + 8;
    });

    // Re-position after layout settles (new cards may not have height yet)
    requestAnimationFrame(function() {
      let pb = 0;
      positions.forEach(function(position) {
        const interactionId = position.card.dataset.key;
        const mark = contentEl.querySelector('mark[data-key="' + interactionId + '"]');
        const markTop = mark ? mark.offsetTop : 0;
        const top = Math.max(markTop, pb);
        position.card.style.top = top + "px";
        pb = top + position.card.offsetHeight + 8;
      });
    });
  }

  function buildToggleMarkup(collapsed) {
    return '<button class="card-toggle" type="button" aria-label="' + (collapsed ? "Expand" : "Collapse") + '">' +
      (collapsed ? "\u25B8" : "\u25BE") +
      "</button>";
  }

  function getMarksForInteraction(interactionId, className) {
    return Array.from(contentEl.querySelectorAll('mark[data-key="' + interactionId + '"]')).filter(function(mark) {
      return !className || mark.classList.contains(className);
    });
  }

  function getMarkDisplayText(mark) {
    const clone = mark.cloneNode(true);
    clone.querySelectorAll(".badge, .diff-ins").forEach(function(el) { el.remove(); });
    return clone.textContent || "";
  }

  function replaceMarkContent(mark, buildChildren) {
    const badge = mark.querySelector(".badge");
    const badgeClone = badge ? badge.cloneNode(true) : null;
    while (mark.firstChild) {
      mark.removeChild(mark.firstChild);
    }
    if (badgeClone) {
      mark.appendChild(badgeClone);
    }
    buildChildren(mark);
  }

  function renderEditMarks(edit) {
    const marks = getMarksForInteraction(edit.interaction_id, "hl-edit");
    if (!marks.length) return;

    marks.forEach(function(mark) {
      mark.classList.remove("hl-edit-pending", "hl-edit-proposed", "hl-edit-accepted", "hl-edit-rejected");
    });

    if (edit.status === "accepted") {
      const firstMark = marks[0];
      replaceMarkContent(firstMark, function(mark) {
        mark.appendChild(document.createTextNode(edit.proposed_replacement ?? ""));
      });
      firstMark.classList.add("hl-edit-accepted");

      marks.slice(1).forEach(function(mark) {
        const parent = mark.parentNode;
        if (parent) {
          parent.removeChild(mark);
          parent.normalize();
        }
      });
      return;
    }

    marks.forEach(function(mark, index) {
      const originalText = getMarkDisplayText(mark);
      replaceMarkContent(mark, function(target) {
        if (edit.status === "proposed") {
          const deleted = document.createElement("span");
          deleted.className = "diff-del";
          deleted.textContent = originalText;
          target.appendChild(deleted);

          if (index === marks.length - 1 && edit.proposed_replacement) {
            const inserted = document.createElement("span");
            inserted.className = "diff-ins";
            inserted.textContent = edit.proposed_replacement;
            target.appendChild(inserted);
          }
          return;
        }

        target.appendChild(document.createTextNode(originalText));
      });

      mark.classList.add(
        edit.status === "rejected"
          ? "hl-edit-rejected"
          : edit.status === "proposed"
            ? "hl-edit-proposed"
            : "hl-edit-pending"
      );
    });
  }

  function getEditReplacementLabel(edit) {
    return edit.proposed_replacement ? edit.proposed_replacement : "[remove]";
  }

  function buildInlineActionMarkup(options) {
    const commentDisabled = options.commentDisabled ? " disabled" : "";
    const askDisabled = options.askDisabled ? " disabled" : "";
    return '<div class="inline-actions">' +
      '<button class="text-action primary ' + esc(options.commentClass) + '" type="button"' + commentDisabled + '>' + esc(options.commentLabel) + "</button>" +
      '<span class="action-sep">\u00b7</span>' +
      '<button class="text-action ' + esc(options.askClass) + '" type="button"' + askDisabled + '>' + esc(options.askLabel) + "</button>" +
      '<span class="action-sep">\u00b7</span>' +
      '<button class="text-action ' + esc(options.cancelClass) + '" type="button">' + esc(options.cancelLabel) + "</button>" +
      "</div>";
  }

  function buildCommentCardHtml(comment) {
    if (comment._collapsed) {
      return '<div class="card-collapsed-line">' +
        '<span class="badge">' + esc(comment.badge_label) + '</span>' +
        '<span class="card-collapsed-text">' + esc(trunc(comment.comment, 60)) + '</span>' +
        buildToggleMarkup(true) +
        "</div>";
    }

    if (comment._editing) {
      return '<div class="card-head">' +
        '<div class="card-head-main">' +
        '<span class="badge">' + esc(comment.badge_label) + '</span>' +
        '<div class="card-quote">' + esc(trunc(comment.anchor.selected_text, 40)) + '</div>' +
        "</div>" +
        buildToggleMarkup(false) +
        "</div>" +
        '<textarea class="card-edit-area" rows="2">' + esc(comment.comment) + "</textarea>" +
        '<div class="inline-actions">' +
        '<button class="text-action primary card-save-btn" type="button">Save</button>' +
        '<span class="action-sep">\u00b7</span>' +
        '<button class="text-action card-cancel-btn" type="button">Cancel</button>' +
        "</div>";
    }

    return '<div class="card-head">' +
      '<div class="card-head-main">' +
      '<span class="badge">' + esc(comment.badge_label) + '</span>' +
      '<div class="card-quote">' + esc(trunc(comment.anchor.selected_text, 40)) + '</div>' +
      "</div>" +
      buildToggleMarkup(false) +
      "</div>" +
      '<div class="card-body">' + esc(comment.comment) + "</div>" +
      '<div class="inline-actions">' +
      '<button class="text-action card-copy" type="button">Copy</button>' +
      '<span class="action-sep">\u00b7</span>' +
      '<button class="text-action card-edit" type="button">Edit</button>' +
      '<span class="action-sep">\u00b7</span>' +
      '<button class="text-action action-delete card-delete" type="button">Delete</button>' +
      "</div>";
  }

  function buildEditCardHtml(edit) {
    const canCollapse = edit.status === "accepted";
    const summary = edit.proposed_replacement
      ? trunc(edit.selected_text, 32) + " \u2192 " + trunc(edit.proposed_replacement, 32)
      : trunc(edit.selected_text, 32) + " \u2192 [remove]";

    if (edit._collapsed && canCollapse) {
      return '<div class="card-collapsed-line">' +
        '<span class="badge">' + esc(edit.badge_label) + '</span>' +
        '<span class="card-collapsed-text">' + esc(summary) + '</span>' +
        buildToggleMarkup(true) +
        "</div>";
    }

    let html = '<div class="card-head">' +
      '<div class="card-head-main">' +
      '<span class="badge">' + esc(edit.badge_label) + '</span>' +
      '<div class="card-quote">' + esc(trunc(edit.anchor.selected_text, 40)) + '</div>' +
      "</div>" +
      (canCollapse ? buildToggleMarkup(false) : "") +
      "</div>";

    if (edit.instruction) {
      html += '<div class="card-body">' + esc(edit.instruction) + "</div>";
    }

    if (edit.status === "pending") {
      html += '<div class="card-loading">Generating edit\u2026</div>';
      return html;
    }

    if (edit.status === "proposed") {
      html += '<div class="edit-summary"><span class="diff-del">' + esc(edit.selected_text) + '</span>' +
        (edit.proposed_replacement
          ? '<span class="diff-ins">' + esc(edit.proposed_replacement) + "</span>"
          : '<span class="edit-state">Remove selected text.</span>') +
        "</div>";
      html += '<div class="inline-actions">' +
        '<button class="text-action primary card-accept" type="button">Accept</button>' +
        '<span class="action-sep">\u00b7</span>' +
        '<button class="text-action action-delete card-reject" type="button">Reject</button>' +
        "</div>";
      return html;
    }

    if (edit.status === "accepted") {
      html += '<div class="edit-state">' + (edit.proposed_replacement ? "Applied." : "Removed.") + "</div>";
      html += '<div class="edit-summary">' +
        (edit.proposed_replacement
          ? '<span class="diff-ins">' + esc(edit.proposed_replacement) + "</span>"
          : '<span class="edit-state">Selected text removed.</span>') +
        "</div>";
      return html;
    }

    html += '<div class="edit-state">Rejected.</div>';
    html += '<div class="edit-summary"><span class="diff-del">' + esc(edit.selected_text) + "</span></div>";
    return html;
  }

  function buildThreadGroupHtml(entry) {
    if (entry.kind === "note") {
      return '<div class="thread-group"><div class="thread-note">' + esc(entry.content) + "</div></div>";
    }

    return '<div class="thread-group">' +
      '<div class="thread-question">' + esc(entry.question) + "</div>" +
      (entry.answer
        ? '<div class="thread-answer">' + esc(entry.answer) + "</div>"
        : '<div class="card-loading">Waiting for answer\u2026</div>') +
      "</div>";
  }

  function buildQuestionCardHtml(questionThread) {
    const firstEntry = getFirstQuestionEntry(questionThread);
    const messageCount = getThreadMessageCount(questionThread);
    const canCollapse = !isQuestionThreadPending(questionThread);

    if (questionThread._collapsed && canCollapse) {
      return '<div class="card-collapsed-line">' +
        '<span class="badge">' + esc(questionThread.badge_label) + '</span>' +
        '<span class="card-collapsed-text">' + esc(trunc(firstEntry ? getThreadEntryText(firstEntry) : "", 60)) + '</span>' +
        '<span class="card-collapsed-meta">' + esc(messageCount + " messages") + '</span>' +
        buildToggleMarkup(true) +
        "</div>";
    }

    let html = '<div class="card-head">' +
      '<div class="card-head-main">' +
      '<span class="badge">' + esc(questionThread.badge_label) + '</span>' +
      '<div class="card-quote">' + esc(trunc(questionThread.anchor.selected_text, 40)) + '</div>' +
      "</div>" +
      (canCollapse ? buildToggleMarkup(false) : "") +
      "</div>";

    html += questionThread.thread.map(buildThreadGroupHtml).join("");

    if (questionThread._composerOpen) {
      html += '<div class="card-followup">' +
        '<textarea class="card-edit-area card-followup-area" rows="2" placeholder="Write a note or question\u2026">' +
        esc(questionThread._composerValue || "") +
        "</textarea>" +
        buildInlineActionMarkup({
          commentClass: "card-followup-note",
          commentLabel: "Comment \u21B5",
          commentDisabled: false,
          askClass: "card-followup-ask",
          askLabel: "Ask \u2318\u21B5",
          askDisabled: !canStartAsk(),
          cancelClass: "card-followup-cancel",
          cancelLabel: "Cancel",
        }) +
        "</div>";
    } else if (!reviewClosed) {
      html += '<div class="followup-trigger card-followup-trigger">+ follow up</div>';
    }

    return html;
  }

  function renderCards() {
    marginCol.innerHTML = "";

    getAllInteractions().forEach(function(item) {
      const card = document.createElement("div");
      card.className = "margin-card " +
        (item.kind === "question" ? "thread-card" : item.kind === "edit" ? "edit-card" : "comment-card") +
        (item.interaction_id === activeInteractionId ? " active" : "");
      card.dataset.key = item.interaction_id;
      card.dataset.kind = item.kind;

      if (item.kind === "comment") {
        const comment = getCommentById(item.interaction_id);
        if (!comment) return;
        card.innerHTML = buildCommentCardHtml(comment);
      } else if (item.kind === "question") {
        const questionThread = getQuestionThreadById(item.interaction_id);
        if (!questionThread) return;
        card.innerHTML = buildQuestionCardHtml(questionThread);
      } else if (item.kind === "edit") {
        const edit = getEditById(item.interaction_id);
        if (!edit) return;
        card.innerHTML = buildEditCardHtml(edit);
      }

      marginCol.appendChild(card);
    });

    positionCards();
  }

  function buildAnnotationSummary(item) {
    if (item.kind === "comment") {
      return trunc(item.comment, 72);
    }

    if (item.kind === "edit") {
      if (item.status === "pending") {
        return "Generating edit\u2026";
      }
      if (item.status === "accepted") {
        return trunc(item.proposed_replacement ? "Applied: " + item.proposed_replacement : "Applied: [remove]", 96);
      }
      if (item.status === "rejected") {
        return trunc("Rejected: " + item.selected_text, 96);
      }
      return trunc(item.selected_text + " \u2192 " + getEditReplacementLabel(item), 96);
    }

    const questionThread = getQuestionThreadById(item.interaction_id);
    const firstEntry = getFirstQuestionEntry(questionThread);
    return trunc((firstEntry ? getThreadEntryText(firstEntry) : "") + " \u2192 " + getThreadMessageCount(questionThread) + " messages", 96);
  }

  function updateUI() {
    const annotations = getAllInteractions();
    const annotationCount = annotations.length;

    annotationCountEl.textContent = annotationCount;

    annotationsSection.hidden = annotationCount === 0;

    let annotationsHtml = "";
    annotations.forEach(function(item) {
      const sectionName = item.anchor.section ? item.anchor.section.replace(/^#+\\s*/, "") : "";
      annotationsHtml += '<div class="annotation-item" data-key="' + esc(item.interaction_id) + '">';
      annotationsHtml += '<div class="annotation-header">';
      annotationsHtml += '<span class="badge">' + esc(item.badge_label) + '</span>';
      if (sectionName) {
        annotationsHtml += ' <span class="annotation-section">§ ' + esc(trunc(sectionName, 30)) + '</span> — ';
      }
      annotationsHtml += '<span class="annotation-quote">“' + esc(trunc(item.anchor.selected_text, 50)) + '”</span>';
      annotationsHtml += '</div>';
      annotationsHtml += '<div class="annotation-body">→ ' + esc(buildAnnotationSummary(item)) + '</div>';
      if (item.kind === "question" && item.answer) {
        annotationsHtml += '<div class="annotation-answer">← ' + esc(trunc(item.answer, 120)) + '</div>';
      }
      annotationsHtml += "</div>";
    });
    annotationsList.innerHTML = annotationsHtml;

    renderCards();
    updatePopupActions();
  }

  function clearPendingHighlight() {
    contentEl.querySelectorAll("mark.hl-pending").forEach(function(mark) {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
  }

  function applyPendingHighlight(range) {
    try {
      const anchor = buildAnchorFromRange(range);
      highlightAnchor(anchor, null, null, "hl-pending");
    } catch(e) {}
  }

  function showPopup(range) {
    if (reviewClosed) return;
    hideSelAction();
    currentRange = range.cloneRange();
    const rect = range.getBoundingClientRect();
    popup.style.left = Math.min(rect.right + 4, window.innerWidth - 240) + "px";
    popup.style.top = (rect.bottom + 4) + "px";
    popupQuote.textContent = trunc(getPlainRangeText(currentRange).trim(), 120);
    popupText.value = "";
    updatePopupActions();
    applyPendingHighlight(currentRange);
    popup.classList.add("visible");
    requestAnimationFrame(function() {
      const rect = popup.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 8) popup.style.top = Math.max(8, window.innerHeight - rect.height - 8) + "px";
      if (rect.right > window.innerWidth - 8) popup.style.left = Math.max(8, window.innerWidth - rect.width - 8) + "px";
      popupText.focus();
    });
  }

  function hidePopup(restoreSelection) {
    popup.classList.remove("visible");
    popupText.value = "";
    clearPendingHighlight();
    if (restoreSelection && currentRange) {
      try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(currentRange);
      } catch(e) {}
    }
    currentRange = null;
  }

  function focusAfterInteraction(interactionId) {
    const marks = contentEl.querySelectorAll('mark[data-key="' + interactionId + '"]');
    if (!marks.length) return;
    const lastMark = marks[marks.length - 1];
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStartAfter(lastMark);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function addComment(range, text) {
    const anchor = buildAnchorFromRange(range);
    if (!anchor) return null;

    const comment = {
      interaction_id: makeId("comment"),
      badge_label: String(nextCommentNumber++),
      anchor: anchor,
      comment: text,
      _editing: false,
      _collapsed: false,
    };

    comments.push(comment);
    highlightAnchor(comment.anchor, comment.interaction_id, comment.badge_label, "hl");
    setActiveInteraction(comment.interaction_id);
    updateUI();
    return comment;
  }

  function saveCommentToServer(comment) {
    return postEvent({
      type: "comment_upsert",
      interaction_id: comment.interaction_id,
      badge_label: comment.badge_label,
      anchor: comment.anchor,
      comment: comment.comment,
    });
  }

  function deleteComment(interactionId) {
    comments = comments.filter(function(comment) { return comment.interaction_id !== interactionId; });
    removeHighlight(interactionId);
    if (activeInteractionId === interactionId) activeInteractionId = null;
    updateUI();
    postEvent({
      type: "comment_delete",
      interaction_id: interactionId,
    }).catch(function(err) {
      alert("Error: " + err.message);
    });
  }

  function autosizeCardTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight + 4, 300) + "px";
    positionCards();
  }

  function editComment(interactionId) {
    const comment = getCommentById(interactionId);
    if (!comment) return;
    comment._collapsed = false;
    comment._editing = true;
    renderCards();

    const card = marginCol.querySelector('.margin-card[data-key="' + interactionId + '"]');
    if (!card) return;
    const textarea = card.querySelector(".card-edit-area");
    if (!textarea) return;
    autosizeCardTextarea(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    textarea.scrollTop = 0;
  }

  function saveCommentEdit(interactionId) {
    const card = marginCol.querySelector('.margin-card[data-key="' + interactionId + '"]');
    const textarea = card && card.querySelector(".card-edit-area");
    const comment = getCommentById(interactionId);
    if (!comment || !textarea) return;
    const value = textarea.value.trim();
    if (value) {
      comment.comment = value;
    }
    delete comment._editing;
    updateUI();
    saveCommentToServer(comment).catch(function(err) {
      alert("Error: " + err.message);
    });
    placeCursorAtInteraction(interactionId);
    contentEl.focus();
  }

  function cancelCommentEdit(interactionId) {
    const comment = getCommentById(interactionId);
    if (comment) delete comment._editing;
    renderCards();
    placeCursorAtInteraction(interactionId);
    contentEl.focus();
  }

  function toggleCommentCollapse(interactionId) {
    const comment = getCommentById(interactionId);
    if (!comment || comment._editing) return;
    comment._collapsed = !comment._collapsed;
    renderCards();
    setActiveInteraction(interactionId);
  }

  function toggleQuestionThread(interactionId) {
    const questionThread = getQuestionThreadById(interactionId);
    if (!questionThread || isQuestionThreadPending(questionThread)) {
      scrollToInteraction(interactionId);
      return;
    }

    questionThread._collapsed = !questionThread._collapsed;
    renderCards();
    setActiveInteraction(interactionId);
  }

  function toggleEditCollapse(interactionId) {
    const edit = getEditById(interactionId);
    if (!edit || edit.status !== "accepted") {
      scrollToInteraction(interactionId);
      return;
    }

    edit._collapsed = !edit._collapsed;
    renderCards();
    setActiveInteraction(interactionId);
  }

  function focusFollowupComposer(interactionId) {
    const card = marginCol.querySelector('.margin-card[data-key="' + interactionId + '"]');
    if (!card) return;
    const textarea = card.querySelector(".card-followup-area");
    if (!textarea) return;
    autosizeCardTextarea(textarea);
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }

  function openFollowupComposer(interactionId) {
    const questionThread = getQuestionThreadById(interactionId);
    if (!questionThread || reviewClosed) return;
    questionThread._collapsed = false;
    questionThread._composerOpen = true;
    renderCards();
    setActiveInteraction(interactionId);
    focusFollowupComposer(interactionId);
  }

  function cancelFollowupComposer(interactionId) {
    const questionThread = getQuestionThreadById(interactionId);
    if (!questionThread) return;
    questionThread._composerOpen = false;
    questionThread._composerValue = "";
    renderCards();
    placeCursorAtInteraction(interactionId);
    contentEl.focus();
  }

  function submitFollowupAs(interactionId, mode) {
    const questionThread = getQuestionThreadById(interactionId);
    if (!questionThread || reviewClosed) return;
    if (mode === "question" && !canStartAsk()) return;

    const card = marginCol.querySelector('.margin-card[data-key="' + interactionId + '"]');
    const textarea = card && card.querySelector(".card-followup-area");
    const text = textarea ? textarea.value.trim() : "";
    if (!text) return;

    const parentInteractionId = questionThread.interaction_id;
    const followupInteractionId = makeId(mode === "question" ? "question" : "note");
    const threadEntry = {
      interaction_id: followupInteractionId,
      parent_interaction_id: parentInteractionId,
      kind: mode === "question" ? "question" : "note",
      question: mode === "question" ? text : "",
      content: mode === "note" ? text : "",
      answer: "",
    };

    questionThread.thread.push(threadEntry);
    questionThread._collapsed = false;
    questionThread._composerOpen = false;
    questionThread._composerValue = "";
    if (mode === "question") {
      pendingInteractionId = followupInteractionId;
    }
    updateUI();
    setActiveInteraction(interactionId);
    contentEl.focus();

    const payload = mode === "question"
      ? {
          type: "question",
          interaction_id: threadEntry.interaction_id,
          parent_interaction_id: threadEntry.parent_interaction_id,
          badge_label: questionThread.badge_label,
          anchor: questionThread.anchor,
          question: threadEntry.question,
        }
      : {
          type: "thread_note",
          interaction_id: threadEntry.interaction_id,
          parent_interaction_id: threadEntry.parent_interaction_id,
          badge_label: questionThread.badge_label,
          anchor: questionThread.anchor,
          content: threadEntry.content,
        };

    postEvent(payload).catch(function(err) {
      questionThread.thread = questionThread.thread.filter(function(entry) {
        return entry.interaction_id !== followupInteractionId;
      });
      questionThread._composerOpen = true;
      questionThread._composerValue = text;
      if (mode === "question") {
        pendingInteractionId = null;
      }
      updateUI();
      focusFollowupComposer(interactionId);
      alert("Error: " + err.message);
    });
  }

  function commitEdit() {
    if (!currentRange || !canStartEdit()) return;

    clearPendingHighlight();
    const anchor = buildAnchorFromRange(currentRange);
    if (!anchor) return;

    const interactionId = makeId("edit");
    const edit = {
      interaction_id: interactionId,
      badge_label: "E" + (nextEditNumber++),
      anchor: anchor,
      selected_text: anchor.selected_text,
      instruction: popupText.value.trim(),
      proposed_replacement: "",
      status: "pending",
      _collapsed: false,
    };

    edits.push(edit);
    pendingEditId = interactionId;
    highlightAnchor(edit.anchor, interactionId, edit.badge_label, "hl-edit");
    renderEditMarks(edit);
    setActiveInteraction(interactionId);
    updateUI();
    hidePopup(false);
    focusAfterInteraction(interactionId);
    contentEl.focus();

    postEvent({
      type: "edit_request",
      interaction_id: edit.interaction_id,
      badge_label: edit.badge_label,
      anchor: edit.anchor,
      selected_text: edit.selected_text,
      instruction: edit.instruction,
    }).catch(function(err) {
      edits = edits.filter(function(entry) { return entry.interaction_id !== interactionId; });
      pendingEditId = null;
      removeEditHighlight(interactionId);
      updateUI();
      alert("Error: " + err.message);
    });
  }

  function acceptEdit(interactionId) {
    const edit = getEditById(interactionId);
    if (!edit || edit.status !== "proposed") return;

    const previousStatus = edit.status;
    edit.status = "accepted";
    edit._collapsed = true;
    renderEditMarks(edit);
    updateUI();
    setActiveInteraction(interactionId);
    contentEl.focus();

    postEvent({
      type: "edit_accept",
      interaction_id: interactionId,
      final_document: getDocumentText(),
    }).catch(function(err) {
      edit.status = previousStatus;
      edit._collapsed = false;
      renderEditMarks(edit);
      updateUI();
      alert("Error: " + err.message);
    });
  }

  function rejectEdit(interactionId) {
    const edit = getEditById(interactionId);
    if (!edit || edit.status !== "proposed") return;

    const previousStatus = edit.status;
    edit.status = "rejected";
    edit._collapsed = false;
    renderEditMarks(edit);
    updateUI();
    setActiveInteraction(interactionId);
    contentEl.focus();

    postEvent({
      type: "edit_reject",
      interaction_id: interactionId,
      final_document: getDocumentText(),
    }).catch(function(err) {
      edit.status = previousStatus;
      renderEditMarks(edit);
      updateUI();
      alert("Error: " + err.message);
    });
  }

  function commitComment() {
    const text = popupText.value.trim();
    if (!text || !currentRange) return;

    clearPendingHighlight();
    const savedScrollTop = scrollArea.scrollTop;
    const comment = addComment(currentRange, text);
    if (!comment) return;

    hidePopup(false);
    focusAfterInteraction(comment.interaction_id);
    scrollArea.scrollTop = savedScrollTop;
    contentEl.focus();

    saveCommentToServer(comment).catch(function(err) {
      comments = comments.filter(function(entry) { return entry.interaction_id !== comment.interaction_id; });
      removeHighlight(comment.interaction_id);
      updateUI();
      alert("Error: " + err.message);
    });
  }

  function commitQuestion() {
    const text = popupText.value.trim();
    if (!text || !currentRange || !canStartAsk()) return;

    clearPendingHighlight();
    const anchor = buildAnchorFromRange(currentRange);
    if (!anchor) return;

    const interactionId = makeId("question");
    const threadEntry = {
      interaction_id: interactionId,
      parent_interaction_id: null,
      kind: "question",
      question: text,
      content: "",
      answer: "",
    };
    const question = {
      interaction_id: interactionId,
      badge_label: "Q" + (nextQuestionNumber++),
      anchor: anchor,
      thread: [threadEntry],
      _collapsed: false,
      _composerOpen: false,
      _composerValue: "",
    };

    questions.push(question);
    pendingInteractionId = interactionId;
    highlightAnchor(question.anchor, interactionId, question.badge_label, "hl");
    setActiveInteraction(interactionId);
    updateUI();
    hidePopup(false);
    focusAfterInteraction(interactionId);
    contentEl.focus();

    postEvent({
      type: "question",
      interaction_id: question.interaction_id,
      badge_label: question.badge_label,
      anchor: question.anchor,
      question: threadEntry.question,
    }).catch(function(err) {
      questions = questions.filter(function(entry) { return entry.interaction_id !== interactionId; });
      pendingInteractionId = null;
      removeHighlight(interactionId);
      updateUI();
      alert("Error: " + err.message);
    });
  }

  function getInteractionMarks() {
    const seen = {};
    const marks = [];
    contentEl.querySelectorAll("mark.hl, mark.hl-edit").forEach(function(mark) {
      const interactionId = mark.dataset.key;
      if (!seen[interactionId]) {
        seen[interactionId] = true;
        marks.push(mark);
      }
    });
    return marks;
  }

  function jumpToInteraction(direction) {
    const marks = getInteractionMarks();
    if (!marks.length) return;

    const sel = window.getSelection();
    const cursorNode = sel.focusNode;
    let currentIdx = -1;

    if (cursorNode) {
      let el = cursorNode.nodeType === 3 ? cursorNode.parentNode : cursorNode;
      while (el && el !== contentEl) {
        if (el.tagName === "MARK" && (el.classList.contains("hl") || el.classList.contains("hl-edit"))) {
          const interactionId = el.dataset.key;
          for (let i = 0; i < marks.length; i++) {
            if (marks[i].dataset.key === interactionId) { currentIdx = i; break; }
          }
          break;
        }
        el = el.parentNode;
      }
    }

    const targetIdx = direction === "next"
      ? (currentIdx < marks.length - 1 ? currentIdx + 1 : 0)
      : (currentIdx > 0 ? currentIdx - 1 : marks.length - 1);
    const mark = marks[targetIdx];
    const interactionId = mark.dataset.key;

    let textNode = mark.querySelector(".badge") ? mark.childNodes[1] || mark.firstChild : mark.firstChild;
    if (!textNode) textNode = mark;

    const range = document.createRange();
    if (textNode.nodeType === 3) {
      range.setStart(textNode, 0);
      range.collapse(true);
    } else {
      range.selectNodeContents(mark);
      range.collapse(true);
    }
    sel.removeAllRanges();
    sel.addRange(range);

    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    setActiveInteraction(interactionId);
  }

  function scrollToInteraction(interactionId) {
    const mark = contentEl.querySelector('mark[data-key="' + interactionId + '"]');
    if (!mark) return;
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    setActiveInteraction(interactionId);
    placeCursorAtInteraction(interactionId);
    contentEl.focus();
  }

  function submit() {
    if (sent || reviewClosed) return;
    if (pendingInteractionId) {
      const pendingQuestion = getQuestionEntryById(pendingInteractionId);
      const pendingText = pendingQuestion && pendingQuestion.question
        ? '"' + trunc(pendingQuestion.question, 140) + '"'
        : "this pending question";
      const shouldSubmit = window.confirm(
        "A question is still waiting for an answer:\\n\\n" +
          pendingText +
          "\\n\\nSubmit anyway? The unanswered question will still be included in the final review."
      );
      if (!shouldSubmit) {
        return;
      }
    }
    if (pendingEditId) {
      const pendingEdit = getEditById(pendingEditId);
      const pendingText = pendingEdit && pendingEdit.selected_text
        ? '"' + trunc(pendingEdit.selected_text, 140) + '"'
        : "this pending edit";
      const shouldSubmit = window.confirm(
        "An edit is still waiting for a proposal:\\n\\n" +
          pendingText +
          "\\n\\nSubmit anyway? The pending edit will still be included in the final review."
      );
      if (!shouldSubmit) {
        return;
      }
    }
    sent = true;
    sub.disabled = true;
    sub.textContent = "\\u2026";

    postEvent({
      type: "submit",
      general_feedback: generalFeedback.value.trim(),
      final_document: getDocumentText(),
    })
      .then(function() {
        reviewClosed = true;
        sseStopped = true;
        connectionStatus = "";
        stopEventSource();
        showOverlayMessage("Submitted.", "You can close this tab.");
        setTimeout(function() { try { window.close(); } catch(e) {} }, 600);
      })
      .catch(function(err) {
        sent = false;
        sub.disabled = false;
        sub.textContent = "Submit";
        alert("Error: " + err.message);
      });
  }

  comments = Array.isArray(hydration.comments) ? hydration.comments.map(normalizeComment) : [];
  questions = normalizeQuestions(hydration.questions);
  edits = Array.isArray(hydration.edits) ? hydration.edits.map(normalizeEdit) : [];
  nextCommentNumber = nextNumberFrom(comments, "") || 1;
  nextQuestionNumber = nextNumberFrom(questions, "Q") || 1;
  nextEditNumber = nextNumberFrom(edits, "E") || 1;
  generalFeedback.value = String(hydration.general_feedback ?? "");

  restoreHighlights();
  updateUI();
  connectEventSource();

  document.addEventListener("selectionchange", function() {
    const sel = window.getSelection();
    if (!selectionTouchesContent(sel)) {
      setActiveInteraction(null);
      return;
    }

    let el = sel.focusNode.nodeType === 3 ? sel.focusNode.parentNode : sel.focusNode;
    while (el && el !== contentEl) {
      if (el.tagName === "MARK" && (el.classList.contains("hl") || el.classList.contains("hl-edit"))) {
        setActiveInteraction(el.dataset.key);
        return;
      }
      el = el.parentNode;
    }
    setActiveInteraction(null);
  });

  function hideSelAction() { selActionBtn.classList.remove("visible"); }

  contentEl.addEventListener("mouseup", function() {
    if (reviewClosed) return;
    if (popup.classList.contains("visible")) return;
    setTimeout(function() {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && selectionTouchesContent(sel)) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        const btnWidth = 70;
        selActionBtn.style.left = Math.max(8, Math.min(rect.left + (rect.width - btnWidth) / 2, window.innerWidth - btnWidth - 8)) + "px";
        selActionBtn.style.top = Math.max(8, rect.top - 32) + "px";
        selActionBtn.classList.add("visible");
      } else {
        hideSelAction();
      }
    }, 10);
  });

  selActionBtn.addEventListener("mousedown", function(e) {
    e.preventDefault();
    e.stopPropagation();
  });
  selActionBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    hideSelAction();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && selectionTouchesContent(sel)) {
      showPopup(sel.getRangeAt(0));
    }
  });

  document.addEventListener("mousedown", function(e) {
    if (!selActionBtn.contains(e.target)) hideSelAction();
  });

  popupCommentAction.addEventListener("click", function(e) { e.stopPropagation(); commitComment(); });
  popupEditAction.addEventListener("click", function(e) {
    e.stopPropagation();
    if (canStartEdit()) {
      commitEdit();
    }
  });
  popupAskAction.addEventListener("click", function(e) {
    e.stopPropagation();
    if (canStartAsk()) {
      commitQuestion();
    }
  });
  popupCancel.addEventListener("click", function(e) { e.stopPropagation(); hidePopup(true); contentEl.focus(); });

  popupText.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (canStartAsk()) {
        commitQuestion();
      }
    }
    if (e.key === "Enter" && e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (canStartEdit()) {
        commitEdit();
      }
    }
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      commitComment();
    }
    if (e.key === "Escape") { e.preventDefault(); hidePopup(true); contentEl.focus(); }
  });

  document.addEventListener("mousedown", function(e) {
    if (popup.classList.contains("visible") && !popup.contains(e.target)) hidePopup(true);
  });

  marginCol.addEventListener("click", function(e) {
    const card = e.target.closest(".margin-card");
    if (!card) return;
    if (e.target.closest(".card-edit-area")) return;

    const interactionId = card.dataset.key;
    const kind = card.dataset.kind;

    if (kind === "comment" && e.target.closest(".card-copy")) {
      const comment = getCommentById(interactionId);
      if (comment) {
        navigator.clipboard.writeText(comment.comment).then(function() {
          const btn = card.querySelector(".card-copy");
          if (btn) { btn.textContent = "ok"; setTimeout(function() { btn.textContent = "copy"; }, 1200); }
        });
      }
      return;
    }

    if (e.target.closest(".card-toggle")) {
      if (kind === "comment") toggleCommentCollapse(interactionId);
      if (kind === "question") toggleQuestionThread(interactionId);
      if (kind === "edit") toggleEditCollapse(interactionId);
      return;
    }

    if (kind === "edit" && e.target.closest(".card-accept")) {
      acceptEdit(interactionId);
      return;
    }
    if (kind === "edit" && e.target.closest(".card-reject")) {
      rejectEdit(interactionId);
      return;
    }

    if (kind === "question" && e.target.closest(".card-followup-note")) {
      submitFollowupAs(interactionId, "note");
      return;
    }
    if (kind === "question" && e.target.closest(".card-followup-ask")) {
      if (canStartAsk()) {
        submitFollowupAs(interactionId, "question");
      }
      return;
    }
    if (kind === "question" && e.target.closest(".card-followup-cancel")) {
      cancelFollowupComposer(interactionId);
      return;
    }
    if (kind === "question" && e.target.closest(".card-followup-trigger")) {
      openFollowupComposer(interactionId);
      return;
    }

    if (kind === "comment" && e.target.closest(".card-delete")) { deleteComment(interactionId); contentEl.focus(); return; }
    if (kind === "comment" && e.target.closest(".card-edit")) { editComment(interactionId); return; }
    if (kind === "comment" && e.target.closest(".card-save-btn")) { saveCommentEdit(interactionId); return; }
    if (kind === "comment" && e.target.closest(".card-cancel-btn")) { cancelCommentEdit(interactionId); return; }

    if (kind === "question" && getQuestionThreadById(interactionId)?._collapsed) {
      toggleQuestionThread(interactionId);
      return;
    }
    if (kind === "edit" && getEditById(interactionId)?._collapsed) {
      toggleEditCollapse(interactionId);
      return;
    }
    if (kind === "comment" && getCommentById(interactionId)?._collapsed) {
      toggleCommentCollapse(interactionId);
      return;
    }

    scrollToInteraction(interactionId);
  });

  marginCol.addEventListener("keydown", function(e) {
    const followupTextarea = e.target.closest(".card-followup-area");
    if (followupTextarea) {
      const card = followupTextarea.closest(".margin-card");
      const interactionId = card.dataset.key;
      if (e.key === "Enter" && e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (canStartAsk()) {
          submitFollowupAs(interactionId, "question");
        }
      }
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        submitFollowupAs(interactionId, "note");
      }
      if (e.key === "Escape") { e.preventDefault(); cancelFollowupComposer(interactionId); }
      return;
    }

    const textarea = e.target.closest(".card-edit-area");
    if (!textarea) return;
    const card = textarea.closest(".margin-card");
    const interactionId = card.dataset.key;
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); saveCommentEdit(interactionId); }
    if (e.key === "Escape") { e.preventDefault(); cancelCommentEdit(interactionId); }
  });

  marginCol.addEventListener("input", function(e) {
    const textarea = e.target.closest(".card-edit-area");
    if (!textarea) return;
    autosizeCardTextarea(textarea);

    if (textarea.classList.contains("card-followup-area")) {
      const card = textarea.closest(".margin-card");
      const interactionId = card && card.dataset.key;
      const questionThread = interactionId ? getQuestionThreadById(interactionId) : null;
      if (questionThread) {
        questionThread._composerValue = textarea.value;
      }
    }
  });

  function handleSummaryClick(e) {
    const item = e.target.closest(".annotation-item");
    if (!item) return;
    scrollToInteraction(item.dataset.key);
  }

  annotationsList.addEventListener("click", handleSummaryClick);

  generalFeedback.addEventListener("input", scheduleFeedbackSync);

  contentEl.addEventListener("keydown", function(e) {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      generalFeedback.focus();
    }
  });
  generalFeedback.addEventListener("keydown", function(e) {
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      contentEl.focus();
    }
  });

  document.addEventListener("keydown", function(e) {
    const inTextarea = e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT";
    const inCardEdit = e.target.closest(".card-edit-area");

    if (!e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      const activeEdit = getActiveEditableEdit();
      if (activeEdit && e.key === "y") {
        e.preventDefault();
        acceptEdit(activeEdit.interaction_id);
        return;
      }
      if (activeEdit && e.key === "n") {
        e.preventDefault();
        rejectEdit(activeEdit.interaction_id);
        return;
      }
    }

    if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && selectionTouchesContent(sel)) {
        e.preventDefault();
        showPopup(sel.getRangeAt(0));
      }
    }

    if (e.key === "a" && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && selectionTouchesContent(sel)) {
        e.preventDefault();
        showPopup(sel.getRangeAt(0));
      }
    }

    if ((e.key === "n" || e.key === "p") && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      e.preventDefault();
      jumpToInteraction(e.key === "n" ? "next" : "prev");
    }

    if (e.key === "e" && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      const activeComment = getActiveEditableComment();
      if (activeComment) {
        e.preventDefault();
        editComment(activeComment.interaction_id);
      }
    }

    if ((e.key === "d" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      const activeComment = getActiveEditableComment();
      if (activeComment) {
        e.preventDefault();
        deleteComment(activeComment.interaction_id);
        contentEl.focus();
      }
    }

    if (e.key === "[" && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      e.preventDefault();
      setTocVisible(tocHidden);
    }

    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }

    if (e.key === "Escape") {
      if (popup.classList.contains("visible")) { hidePopup(true); contentEl.focus(); }
      else if (inCardEdit) { /* handled above */ }
      else { window.getSelection().removeAllRanges(); setActiveInteraction(null); }
    }
  });

  sub.addEventListener("click", submit);

  contentEl.focus();
  window.addEventListener("resize", function() { positionCards(); });
})();
</script>
</body>
</html>`;
}
