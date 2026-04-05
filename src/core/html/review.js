/**
 * Generates a self-contained HTML document for plan/document review.
 *
 * Layout: CSS Grid body with 3 visual columns (TOC | Content | Margin).
 * Content + Margin share a scroll container so comment cards stay aligned
 * with their highlights. Full keyboard navigation via contenteditable.
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
  --hl-bg: rgba(136,136,136,0.2);
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
.btn:hover { background: var(--btn-hover); }
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
#md-content::selection { background: var(--hl-bg); }
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
  border-radius: 2px;
  position: relative;
  cursor: pointer;
}
mark.hl.hl-active { background: rgba(136,136,136,0.35); }
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
  background: var(--hl-bg);
}
.card-quote {
  color: var(--fg-faint);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-bottom: 4px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
  font-size: 10px;
}
.card-body { color: var(--fg); word-break: break-word; }
.card-kind {
  color: var(--fg-dim);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}
.card-answer {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
  color: var(--fg);
  white-space: pre-wrap;
}
.card-loading {
  margin-top: 6px;
  color: var(--fg-dim);
  font-style: italic;
}
.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  margin-top: 6px;
}
.card-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--fg-ghost);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  padding: 3px 6px;
  line-height: 1;
  transition: color 0.15s, border-color 0.15s;
}
.card-btn:hover { color: var(--fg-dim); border-color: var(--border); }
.card-btn.card-delete:hover { color: var(--err); border-color: var(--err); }

/* Card edit mode */
.card-edit-area {
  width: 100%;
  padding: 4px 6px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--fg);
  font: inherit;
  font-size: 11px;
  resize: vertical;
  min-height: 60px;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 4px;
}
.card-edit-area:focus { outline: 2px solid var(--border-focus); outline-offset: 1px; border-color: var(--border-focus); }
.card-edit-actions { display: flex; justify-content: flex-end; gap: 2px; }
.card-edit-actions .btn {
  padding: 3px 10px;
  font-size: 10px;
  background: none;
  border: 1px solid var(--border);
  color: var(--fg-dim);
  border-radius: 3px;
  transition: color 0.15s, border-color 0.15s;
}
.card-edit-actions .btn:hover { color: var(--fg-bold); border-color: var(--border-focus); background: none; }
.card-edit-actions .btn:active { background: none; }

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

/* --- Comment summary items --- */
.comment-item {
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  font-size: 12px;
}
.comment-item:last-child { border-bottom: none; }
.comment-item:hover { background: var(--hl-bg); margin: 0 -6px; padding: 6px 6px; border-radius: 3px; }
.comment-header { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.comment-section { color: var(--fg-dim); }
.comment-quote { color: var(--fg-faint); font-style: italic; }
.comment-body { padding-left: 20px; color: var(--fg); margin-top: 2px; }
.comment-answer { padding-left: 20px; color: var(--fg-dim); margin-top: 4px; white-space: pre-wrap; }

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
  border-radius: 4px;
}
.popup.visible { display: block; }
.popup-mode-buttons {
  display: flex;
  gap: 6px;
  padding: 10px;
}
.popup-trigger {
  display: block;
  padding: 4px 10px;
  background: var(--btn-bg);
  color: var(--fg-bold);
  border: none;
  border-radius: 3px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.popup-trigger:hover { background: var(--btn-hover); }
.popup-trigger:disabled {
  opacity: 0.4;
  cursor: default;
}
.popup-form { padding: 10px; width: 320px; }
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
.popup-text:focus { outline: 2px solid var(--border-focus); outline-offset: 1px; border-color: var(--border-focus); }
.popup-actions { display: flex; justify-content: flex-end; gap: 6px; }

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
    <span class="meta" id="comment-count-top" aria-live="polite">0 comments</span>
    <button class="btn" id="toggle" type="button">dark</button>
    <button class="btn" id="sub-top" type="button">Submit</button>
  </div>
</div>

<nav class="toc" id="toc"></nav>

<div class="scroll-area" id="scroll-area">
  <div class="content-col" id="content-col">
    <div id="md-content" contenteditable="plaintext-only" aria-label="Document content" spellcheck="false"></div>
    <div id="comments-section" hidden>
      <div class="section-divider"><span>Comments (<span id="comment-count">0</span>)</span></div>
      <div id="comments-list"></div>
    </div>
    <div id="questions-section" hidden>
      <div class="section-divider"><span>Questions (<span id="question-count">0</span>)</span></div>
      <div id="questions-list"></div>
    </div>
    <div class="feedback-section">
      <div class="section-divider"><span>Anything else?</span></div>
      <textarea class="txt" id="general-feedback" rows="3" placeholder="General feedback\u2026"></textarea>
    </div>
  </div>
  <div class="margin-col" id="margin-col" role="complementary"></div>
</div>

<div class="botbar">
  <span class="kbd">\u2318\u21B5 submit \u00b7 c comment \u00b7 a ask \u00b7 n/p next/prev \u00b7 e edit \u00b7 d delete \u00b7 [ sidebar</span>
  <button class="btn" id="sub" type="button">Submit</button>
</div>

<div id="popup" class="popup">
  <div class="popup-mode-buttons" id="popup-mode-buttons">
    <button id="popup-comment-btn" class="popup-trigger" type="button">Comment</button>
    <button id="popup-ask-btn" class="popup-trigger" type="button">Ask</button>
  </div>
  <div id="popup-form" class="popup-form" hidden>
    <div class="popup-quote" id="popup-quote"></div>
    <textarea class="popup-text" id="popup-text" rows="2" placeholder="Your thought\u2026"></textarea>
    <div class="popup-actions">
      <button class="btn" id="popup-cancel" type="button">Cancel</button>
      <button class="btn" id="popup-submit" type="button">Add</button>
    </div>
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
    }
  )};

  const contentEl = document.getElementById("md-content");
  const tocEl = document.getElementById("toc");
  const scrollArea = document.getElementById("scroll-area");
  const marginCol = document.getElementById("margin-col");
  const popup = document.getElementById("popup");
  const popupModeButtons = document.getElementById("popup-mode-buttons");
  const popupCommentBtn = document.getElementById("popup-comment-btn");
  const popupAskBtn = document.getElementById("popup-ask-btn");
  const popupForm = document.getElementById("popup-form");
  const popupQuote = document.getElementById("popup-quote");
  const popupText = document.getElementById("popup-text");
  const popupSubmit = document.getElementById("popup-submit");
  const popupCancel = document.getElementById("popup-cancel");
  const commentsList = document.getElementById("comments-list");
  const commentsSection = document.getElementById("comments-section");
  const commentCountEl = document.getElementById("comment-count");
  const commentCountTop = document.getElementById("comment-count-top");
  const questionsList = document.getElementById("questions-list");
  const questionsSection = document.getElementById("questions-section");
  const questionCountEl = document.getElementById("question-count");
  const generalFeedback = document.getElementById("general-feedback");
  const overlay = document.getElementById("overlay");
  const toggle = document.getElementById("toggle");
  const sub = document.getElementById("sub");
  const subTop = document.getElementById("sub-top");
  const MAX_SSE_FAILURES = 5;

  let comments = [];
  let questions = [];
  let sent = false;
  let currentRange = null;
  let activeInteractionId = null;
  let popupMode = "comment";
  let pendingInteractionId = hydration.pending_interaction_id || null;
  let feedbackSyncTimer = null;
  let eventSource = null;
  let reviewClosed = false;
  let sseStopped = false;
  let sseFailureCount = 0;
  let connectionStatus = "";
  let nextCommentNumber = 1;
  let nextQuestionNumber = 1;

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
      surrounding_context: String(anchor && anchor.surrounding_context || ""),
      selected_text: String(anchor && anchor.selected_text || ""),
      section: String(anchor && anchor.section || ""),
    };
  }

  function normalizeComment(comment) {
    return {
      interaction_id: String(comment && comment.interaction_id || makeId("comment")),
      badge_label: String(comment && comment.badge_label || nextCommentNumber++),
      anchor: normalizeAnchor(comment && comment.anchor),
      comment: String(comment && comment.comment || ""),
      _editing: false,
    };
  }

  function normalizeQuestion(question) {
    return {
      interaction_id: String(question && question.interaction_id || makeId("question")),
      badge_label: String(question && question.badge_label || ("Q" + nextQuestionNumber++)),
      anchor: normalizeAnchor(question && question.anchor),
      question: String(question && question.question || ""),
      answer: String(question && question.answer || ""),
    };
  }

  function getDocumentText() {
    const clone = contentEl.cloneNode(true);
    clone.querySelectorAll(".badge").forEach(function(el) { el.remove(); });
    return clone.textContent || "";
  }

  function getPlainRangeText(range) {
    const fragment = range.cloneContents();
    if (fragment.querySelectorAll) {
      fragment.querySelectorAll(".badge").forEach(function(el) { el.remove(); });
    }
    return fragment.textContent || "";
  }

  function getCommentById(interactionId) {
    return comments.find(function(comment) { return comment.interaction_id === interactionId; }) || null;
  }

  function getQuestionById(interactionId) {
    return questions.find(function(question) { return question.interaction_id === interactionId; }) || null;
  }

  function getActiveEditableComment() {
    if (!activeInteractionId) return null;
    return getCommentById(activeInteractionId);
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
      items.push({
        kind: "question",
        interaction_id: question.interaction_id,
        badge_label: question.badge_label,
        anchor: question.anchor,
        question: question.question,
        answer: question.answer,
        pending: pendingInteractionId === question.interaction_id && !question.answer,
      });
    });
    items.sort(function(a, b) {
      return a.anchor.offset_start - b.anchor.offset_start;
    });
    return items;
  }

  function setAskDisabled() {
    let disabledLabel = "";
    if (reviewClosed) disabledLabel = "closed";
    else if (pendingInteractionId) disabledLabel = "waiting";
    else if (sseStopped) disabledLabel = "offline";

    popupAskBtn.disabled = !!disabledLabel;
    popupAskBtn.textContent = disabledLabel ? "Ask (" + disabledLabel + ")" : "Ask";
  }

  function canStartAsk() {
    return !reviewClosed && !pendingInteractionId && !sseStopped;
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
      const question = getQuestionById(event.interaction_id);
      if (!question) return;
      question.answer = String(event.content || "");
      if (pendingInteractionId === question.interaction_id) {
        pendingInteractionId = null;
      }
      updateUI();
      return;
    }

    if (event.type === "session_closed") {
      reviewClosed = true;
      sseStopped = true;
      pendingInteractionId = null;
      connectionStatus = "";
      stopEventSource();
      sub.disabled = true;
      subTop.disabled = true;
      updateUI();
      if (!sent) {
        showOverlayMessage("Review session closed.", "You can close this tab.");
      }
    }
  }

  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    toggle.textContent = t === "dark" ? "light" : "dark";
    try { localStorage.setItem("wft", t); } catch(e) {}
  }
  toggle.addEventListener("click", function() {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  });
  try { const saved = localStorage.getItem("wft"); if (saved) setTheme(saved); } catch(e) {}

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

  contentEl.addEventListener("beforeinput", function(e) { e.preventDefault(); });
  contentEl.addEventListener("paste", function(e) { e.preventDefault(); });
  contentEl.addEventListener("cut", function(e) { e.preventDefault(); });
  contentEl.addEventListener("drop", function(e) { e.preventDefault(); });

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
      fragment.querySelectorAll(".badge").forEach(function(el) { el.remove(); });
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

  function wrapMark(textNode, interactionId, badgeLabel, isFirst) {
    const mark = document.createElement("mark");
    mark.className = "hl";
    mark.dataset.key = interactionId;
    textNode.parentNode.insertBefore(mark, textNode);
    mark.appendChild(textNode);
    if (isFirst) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = badgeLabel;
      mark.insertBefore(badge, mark.firstChild);
    }
  }

  function highlightRange(range, interactionId, badgeLabel) {
    let startC = range.startContainer;
    let endC = range.endContainer;
    let startO = range.startOffset;
    let endO = range.endOffset;

    if (startC.nodeType !== 3) {
      const children = startC.childNodes;
      if (startO < children.length) {
        const tw = document.createTreeWalker(children[startO], NodeFilter.SHOW_TEXT);
        const first = tw.nextNode();
        if (first) { startC = first; startO = 0; }
      } else {
        const tw = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
        tw.currentNode = startC;
        const next = tw.nextNode();
        if (next) { startC = next; startO = 0; }
      }
    }
    if (endC.nodeType !== 3) {
      const children = endC.childNodes;
      if (endO > 0 && endO <= children.length) {
        const target = children[endO - 1];
        const tw = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
        let last = null;
        while (tw.nextNode()) last = tw.currentNode;
        if (last) { endC = last; endO = last.textContent.length; }
      } else if (endO === 0) {
        const tw = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
        tw.currentNode = endC;
        const next = tw.nextNode();
        if (next) { endC = next; endO = 0; }
      }
    }

    if (startC === endC && startC.nodeType === 3) {
      if (startO === endO) return;
      const mid = startC.splitText(startO);
      mid.splitText(endO - startO);
      wrapMark(mid, interactionId, badgeLabel, true);
      return;
    }

    let ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType === 3) ancestor = ancestor.parentNode;

    const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let inRange = false;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentNode.classList && node.parentNode.classList.contains("badge")) continue;
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
      wrapMark(target, interactionId, badgeLabel, i === 0);
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

  function applyHighlightFromOffsets(startOff, endOff, interactionId, badgeLabel) {
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let startNode;
    let endNode;
    let startNodeOff;
    let endNodeOff;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentNode.classList && node.parentNode.classList.contains("badge")) continue;
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
        highlightRange(r, interactionId, badgeLabel);
      } catch(e) {}
    }
  }

  function restoreHighlights() {
    comments.forEach(function(comment) {
      applyHighlightFromOffsets(
        comment.anchor.offset_start,
        comment.anchor.offset_end,
        comment.interaction_id,
        comment.badge_label
      );
    });
    questions.forEach(function(question) {
      applyHighlightFromOffsets(
        question.anchor.offset_start,
        question.anchor.offset_end,
        question.interaction_id,
        question.badge_label
      );
    });
  }

  function placeCursorAtInteraction(interactionId) {
    const mark = contentEl.querySelector('mark.hl[data-key="' + interactionId + '"]');
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

    contentEl.querySelectorAll("mark.hl").forEach(function(mark) {
      mark.classList.toggle("hl-active", mark.dataset.key === interactionId);
    });

    commentsList.querySelectorAll(".comment-item").forEach(function(item) {
      item.style.fontWeight = item.dataset.key === interactionId ? "bold" : "";
    });
    questionsList.querySelectorAll(".comment-item").forEach(function(item) {
      item.style.fontWeight = item.dataset.key === interactionId ? "bold" : "";
    });
  }

  function positionCards() {
    const cards = marginCol.querySelectorAll(".margin-card");
    const positions = [];

    cards.forEach(function(card) {
      const interactionId = card.dataset.key;
      const mark = contentEl.querySelector('mark.hl[data-key="' + interactionId + '"]');
      positions.push({ card: card, top: mark ? mark.offsetTop : 0 });
    });

    positions.sort(function(a, b) { return a.top - b.top; });

    let prevBottom = 0;
    positions.forEach(function(position) {
      const top = Math.max(position.top, prevBottom);
      position.card.style.top = top + "px";
      prevBottom = top + position.card.offsetHeight + 8;
    });
  }

  function renderCards() {
    marginCol.innerHTML = "";

    getAllInteractions().forEach(function(item) {
      const card = document.createElement("div");
      card.className = "margin-card" + (item.interaction_id === activeInteractionId ? " active" : "");
      card.dataset.key = item.interaction_id;
      card.dataset.kind = item.kind;

      if (item.kind === "comment" && item.editing) {
        card.innerHTML = '<div class="card-kind">Comment ' + esc(item.badge_label) + '</div>'
          + '<div class="card-quote">' + esc(trunc(item.anchor.selected_text, 40)) + '</div>'
          + '<textarea class="card-edit-area" rows="2">' + esc(item.comment) + '</textarea>'
          + '<div class="card-edit-actions">'
          + '<button class="btn card-save-btn" type="button">Save</button>'
          + '<button class="btn card-cancel-btn" type="button">Cancel</button>'
          + '</div>';
      } else if (item.kind === "comment") {
        card.innerHTML = '<div class="card-kind">Comment ' + esc(item.badge_label) + '</div>'
          + '<div class="card-quote">' + esc(trunc(item.anchor.selected_text, 40)) + '</div>'
          + '<div class="card-body">' + esc(item.comment) + '</div>'
          + '<div class="card-actions">'
          + '<button class="card-btn card-copy" title="Copy">copy</button>'
          + '<button class="card-btn card-edit" title="Edit">edit</button>'
          + '<button class="card-btn card-delete" title="Delete">del</button>'
          + '</div>';
      } else {
        card.innerHTML = '<div class="card-kind">Ask ' + esc(item.badge_label) + '</div>'
          + '<div class="card-quote">' + esc(trunc(item.anchor.selected_text, 40)) + '</div>'
          + '<div class="card-body">? ' + esc(item.question) + '</div>'
          + (item.answer
            ? '<div class="card-answer">' + esc(item.answer) + '</div>'
            : '<div class="card-loading">Waiting for answer\\u2026</div>');
      }

      marginCol.appendChild(card);
    });

    positionCards();
  }

  function updateUI() {
    const commentCount = comments.length;
    const questionCount = questions.length;

    commentCountEl.textContent = commentCount;
    questionCountEl.textContent = questionCount;
    let topText =
      commentCount + " comment" + (commentCount !== 1 ? "s" : "") +
      (questionCount ? " · " + questionCount + " ask" + (questionCount !== 1 ? "s" : "") : "");
    if (connectionStatus) {
      topText += " · " + connectionStatus;
    }
    commentCountTop.textContent = topText;

    commentsSection.hidden = commentCount === 0;
    questionsSection.hidden = questionCount === 0;

    let commentsHtml = "";
    comments.forEach(function(comment) {
      commentsHtml += '<div class="comment-item" data-key="' + esc(comment.interaction_id) + '">';
      commentsHtml += '<div class="comment-header">';
      commentsHtml += '<span class="badge">' + esc(comment.badge_label) + '</span>';
      if (comment.anchor.section) {
        const sectionName = comment.anchor.section.replace(/^#+\\s*/, "");
        commentsHtml += '<span class="comment-section">\\u00a7 ' + esc(trunc(sectionName, 30)) + '</span> \\u2014 ';
      }
      commentsHtml += '<span class="comment-quote">\\u201c' + esc(trunc(comment.anchor.selected_text, 50)) + '\\u201d</span>';
      commentsHtml += '</div>';
      commentsHtml += '<div class="comment-body">\\u2192 ' + esc(comment.comment) + '</div>';
      commentsHtml += '</div>';
    });
    commentsList.innerHTML = commentsHtml;

    let questionsHtml = "";
    questions.forEach(function(question) {
      questionsHtml += '<div class="comment-item" data-key="' + esc(question.interaction_id) + '">';
      questionsHtml += '<div class="comment-header">';
      questionsHtml += '<span class="badge">' + esc(question.badge_label) + '</span>';
      if (question.anchor.section) {
        const sectionName = question.anchor.section.replace(/^#+\\s*/, "");
        questionsHtml += '<span class="comment-section">\\u00a7 ' + esc(trunc(sectionName, 30)) + '</span> \\u2014 ';
      }
      questionsHtml += '<span class="comment-quote">\\u201c' + esc(trunc(question.anchor.selected_text, 50)) + '\\u201d</span>';
      questionsHtml += '</div>';
      questionsHtml += '<div class="comment-body">? ' + esc(question.question) + '</div>';
      questionsHtml += '<div class="comment-answer">' + esc(question.answer || "Waiting for answer\\u2026") + '</div>';
      questionsHtml += '</div>';
    });
    questionsList.innerHTML = questionsHtml;

    renderCards();
    setAskDisabled();
  }

  function showPopup(range) {
    currentRange = range.cloneRange();
    const rect = range.getBoundingClientRect();
    popup.style.left = Math.min(rect.right + 4, window.innerWidth - 240) + "px";
    popup.style.top = (rect.bottom + 4) + "px";
    popupModeButtons.hidden = false;
    popupForm.hidden = true;
    popup.classList.add("visible");
    setAskDisabled();
  }

  function expandPopup(mode) {
    if (!currentRange) return;
    if (mode === "ask" && !canStartAsk()) return;

    const text = getPlainRangeText(currentRange).trim();
    if (!text) return;

    popupMode = mode;
    popupQuote.textContent = trunc(text, 120);
    popupModeButtons.hidden = true;
    popupForm.hidden = false;
    popupText.value = "";
    popupText.placeholder = mode === "ask" ? "Ask about this selection\\u2026" : "Your thought\\u2026";
    popupSubmit.textContent = mode === "ask" ? "Ask" : "Add";

    requestAnimationFrame(function() {
      const rect = popup.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 8) popup.style.top = Math.max(8, window.innerHeight - rect.height - 8) + "px";
      if (rect.right > window.innerWidth - 8) popup.style.left = Math.max(8, window.innerWidth - rect.width - 8) + "px";
      popupText.focus();
    });
  }

  function hidePopup(restoreSelection) {
    popup.classList.remove("visible");
    popupModeButtons.hidden = false;
    popupForm.hidden = true;
    popupText.value = "";
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
    const marks = contentEl.querySelectorAll('mark.hl[data-key="' + interactionId + '"]');
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
    };

    comments.push(comment);
    highlightRange(range, comment.interaction_id, comment.badge_label);
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

  function editComment(interactionId) {
    const comment = getCommentById(interactionId);
    if (!comment) return;
    comment._editing = true;
    renderCards();

    const card = marginCol.querySelector('.margin-card[data-key="' + interactionId + '"]');
    if (!card) return;
    const textarea = card.querySelector(".card-edit-area");
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight + 4, 300) + "px";
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

  function commitComment() {
    const text = popupText.value.trim();
    if (!text || !currentRange) return;

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

    const anchor = buildAnchorFromRange(currentRange);
    if (!anchor) return;

    const interactionId = makeId("question");
    const question = {
      interaction_id: interactionId,
      badge_label: "Q" + (nextQuestionNumber++),
      anchor: anchor,
      question: text,
      answer: "",
    };

    questions.push(question);
    pendingInteractionId = interactionId;
    highlightRange(currentRange, interactionId, question.badge_label);
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
      question: question.question,
    }).catch(function(err) {
      questions = questions.filter(function(entry) { return entry.interaction_id !== interactionId; });
      pendingInteractionId = null;
      removeHighlight(interactionId);
      updateUI();
      alert("Error: " + err.message);
    });
  }

  function commitPopup() {
    if (popupMode === "ask") {
      commitQuestion();
      return;
    }
    commitComment();
  }

  function getInteractionMarks() {
    const seen = {};
    const marks = [];
    contentEl.querySelectorAll("mark.hl").forEach(function(mark) {
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
        if (el.tagName === "MARK" && el.classList.contains("hl")) {
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
    const mark = contentEl.querySelector('mark.hl[data-key="' + interactionId + '"]');
    if (!mark) return;
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    setActiveInteraction(interactionId);
    placeCursorAtInteraction(interactionId);
    contentEl.focus();
  }

  function submit() {
    if (sent || reviewClosed) return;
    if (pendingInteractionId) {
      const pendingQuestion = getQuestionById(pendingInteractionId);
      const pendingText = pendingQuestion?.question
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
    sent = true;
    sub.disabled = true;
    subTop.disabled = true;
    sub.textContent = "\\u2026";
    subTop.textContent = "\\u2026";

    postEvent({
      type: "submit",
      general_feedback: generalFeedback.value.trim(),
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
        subTop.disabled = false;
        sub.textContent = "Submit";
        subTop.textContent = "Submit";
        alert("Error: " + err.message);
      });
  }

  comments = Array.isArray(hydration.comments) ? hydration.comments.map(normalizeComment) : [];
  questions = Array.isArray(hydration.questions) ? hydration.questions.map(normalizeQuestion) : [];
  nextCommentNumber = nextNumberFrom(comments, "") || 1;
  nextQuestionNumber = nextNumberFrom(questions, "Q") || 1;
  generalFeedback.value = String(hydration.general_feedback || "");

  restoreHighlights();
  updateUI();
  connectEventSource();

  document.addEventListener("selectionchange", function() {
    if (document.activeElement !== contentEl) return;
    const sel = window.getSelection();
    if (!sel.focusNode) return;

    let el = sel.focusNode.nodeType === 3 ? sel.focusNode.parentNode : sel.focusNode;
    while (el && el !== contentEl) {
      if (el.tagName === "MARK" && el.classList.contains("hl")) {
        setActiveInteraction(el.dataset.key);
        return;
      }
      el = el.parentNode;
    }
    setActiveInteraction(null);
  });

  contentEl.addEventListener("mouseup", function() {
    setTimeout(function() {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && contentEl.contains(sel.anchorNode)) {
        showPopup(sel.getRangeAt(0));
      }
    }, 10);
  });

  popupCommentBtn.addEventListener("click", function(e) { e.stopPropagation(); expandPopup("comment"); });
  popupAskBtn.addEventListener("click", function(e) { e.stopPropagation(); expandPopup("ask"); });
  popupSubmit.addEventListener("click", function(e) { e.stopPropagation(); commitPopup(); });
  popupCancel.addEventListener("click", function(e) { e.stopPropagation(); hidePopup(true); contentEl.focus(); });

  popupText.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); commitPopup(); }
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

    if (kind === "comment" && e.target.closest(".card-delete")) { deleteComment(interactionId); contentEl.focus(); return; }
    if (kind === "comment" && e.target.closest(".card-edit")) { editComment(interactionId); return; }
    if (kind === "comment" && e.target.closest(".card-save-btn")) { saveCommentEdit(interactionId); return; }
    if (kind === "comment" && e.target.closest(".card-cancel-btn")) { cancelCommentEdit(interactionId); return; }

    scrollToInteraction(interactionId);
  });

  marginCol.addEventListener("keydown", function(e) {
    const textarea = e.target.closest(".card-edit-area");
    if (!textarea) return;
    const card = textarea.closest(".margin-card");
    const interactionId = card.dataset.key;
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); saveCommentEdit(interactionId); }
    if (e.key === "Escape") { e.preventDefault(); cancelCommentEdit(interactionId); }
  });

  function handleSummaryClick(e) {
    const item = e.target.closest(".comment-item");
    if (!item) return;
    scrollToInteraction(item.dataset.key);
  }

  commentsList.addEventListener("click", handleSummaryClick);
  questionsList.addEventListener("click", handleSummaryClick);

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

    if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && contentEl.contains(sel.anchorNode)) {
        e.preventDefault();
        if (!currentRange) showPopup(sel.getRangeAt(0));
        expandPopup("comment");
      }
    }

    if (e.key === "a" && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit && canStartAsk()) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && contentEl.contains(sel.anchorNode)) {
        e.preventDefault();
        if (!currentRange) showPopup(sel.getRangeAt(0));
        expandPopup("ask");
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
  subTop.addEventListener("click", submit);

  contentEl.focus();
  window.addEventListener("resize", function() { positionCards(); });
})();
</script>
</body>
</html>`;
}
