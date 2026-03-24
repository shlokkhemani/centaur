/**
 * Generates a self-contained HTML document for plan/document review.
 *
 * Layout: CSS Grid body with 3 visual columns (TOC | Content | Margin).
 * Content + Margin share a scroll container so comment cards stay aligned
 * with their highlights. Full keyboard navigation via contenteditable.
 */

import { escapeHtml } from "../utils.js";

export function buildReviewHtml({ title, description, content }) {
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

/* No TOC */
body.no-toc { grid-template-columns: 0px 1fr; }
body.no-toc .toc { opacity: 0; pointer-events: none; border-right-color: transparent; }
/* When there are literally no headings, skip the column entirely */
body.no-toc-empty { grid-template-columns: 1fr; }
body.no-toc-empty .toc { display: none; }
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-left">
    <div class="title">Review: ${escapeHtml(title)}</div>
    ${description ? `<div class="desc">${escapeHtml(description)}</div>` : ""}
  </div>
  <div class="topbar-right">
    <span class="meta" id="comment-count-top" aria-live="polite">0 comments</span>
    <button class="btn" id="toc-toggle" type="button" title="Toggle sidebar ([)">\u2261</button>
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
    <div class="feedback-section">
      <div class="section-divider"><span>Anything else?</span></div>
      <textarea class="txt" id="general-feedback" rows="3" placeholder="General feedback\u2026"></textarea>
    </div>
  </div>
  <div class="margin-col" id="margin-col" role="complementary"></div>
</div>

<div class="botbar">
  <span class="kbd">\u2318\u21B5 submit \u00b7 c comment \u00b7 n/p next/prev \u00b7 e edit \u00b7 d delete \u00b7 [ sidebar</span>
  <button class="btn" id="sub" type="button">Submit</button>
</div>

<div id="popup" class="popup">
  <button id="popup-btn" class="popup-trigger" type="button">Comment</button>
  <div id="popup-form" class="popup-form" hidden>
    <div class="popup-quote" id="popup-quote"></div>
    <textarea class="popup-text" id="popup-text" rows="2" placeholder="Your thought\u2026"></textarea>
    <div class="popup-actions">
      <button class="btn" id="popup-cancel" type="button">Cancel</button>
      <button class="btn" id="popup-add" type="button">Add</button>
    </div>
  </div>
</div>

<div class="overlay" id="overlay">
  <b>Submitted.</b>&nbsp;You can close this tab.
</div>

<script src="https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js" integrity="sha384-H+hy9ULve6xfxRkWIh/YOtvDdpXgV2fmAGQkIDTxIgZwNoaoBal14Di2YTMR6MzR" crossorigin="anonymous" onerror="window._mf=true"></script>
<script>
(function(){
  const raw = ${JSON.stringify(content)};

  // --- DOM refs ---
  const contentEl = document.getElementById("md-content");
  const tocEl = document.getElementById("toc");
  const scrollArea = document.getElementById("scroll-area");
  const contentCol = document.getElementById("content-col");
  const marginCol = document.getElementById("margin-col");
  const popup = document.getElementById("popup");
  const popupBtn = document.getElementById("popup-btn");
  const popupForm = document.getElementById("popup-form");
  const popupQuote = document.getElementById("popup-quote");
  const popupText = document.getElementById("popup-text");
  const popupAdd = document.getElementById("popup-add");
  const popupCancel = document.getElementById("popup-cancel");
  const commentsList = document.getElementById("comments-list");
  const commentsSection = document.getElementById("comments-section");
  const commentCountEl = document.getElementById("comment-count");
  const commentCountTop = document.getElementById("comment-count-top");
  const generalFeedback = document.getElementById("general-feedback");
  const overlay = document.getElementById("overlay");
  const toggle = document.getElementById("toggle");
  const sub = document.getElementById("sub");
  const subTop = document.getElementById("sub-top");

  // --- State ---
  let comments = [];
  let nextId = 1;
  let sent = false;
  let currentRange = null;
  let activeCommentId = null;

  // --- Utils ---
  function simpleHash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) + h) + s.charCodeAt(i);
      h = h & h;
    }
    return (h >>> 0).toString(16).padStart(8, "0").slice(0, 8);
  }
  const storageKey = "review_" + simpleHash(raw);

  function trunc(s, n) {
    return s.length > n ? s.slice(0, n) + "\\u2026" : s;
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // --- Theme ---
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

  // --- TOC toggle ---
  const tocToggle = document.getElementById("toc-toggle");
  let tocHidden = false;
  function setTocVisible(show) {
    tocHidden = !show;
    document.body.classList.toggle("no-toc", tocHidden);
    try { localStorage.setItem("wft-toc", tocHidden ? "0" : "1"); } catch(e) {}
    setTimeout(positionCards, 160);
  }
  tocToggle.addEventListener("click", function() { setTocVisible(tocHidden); });
  try { if (localStorage.getItem("wft-toc") === "0") setTocVisible(false); } catch(e) {}

  // --- Suppress contenteditable mutations ---
  contentEl.addEventListener("beforeinput", function(e) { e.preventDefault(); });
  contentEl.addEventListener("paste", function(e) { e.preventDefault(); });
  contentEl.addEventListener("cut", function(e) { e.preventDefault(); });
  contentEl.addEventListener("drop", function(e) { e.preventDefault(); });

  // --- Render Markdown ---
  try {
    if (window.marked && !window._mf) {
      var html = marked.parse(raw);
      // Strip newlines between tags (contenteditable renders them as blank lines)
      html = html.replace(/>\\n+</g, "><");
      // Strip trailing newline inside code blocks
      html = html.replace(/\\n<\\/code>/g, "</code>");
      contentEl.innerHTML = html;
    } else { throw 0; }
  } catch(e) {
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.wordBreak = "break-word";
    pre.textContent = raw;
    contentEl.appendChild(pre);
  }

  // Ensure all headings have IDs
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

  // --- TOC ---
  (function buildToc() {
    const headers = contentEl.querySelectorAll("h1,h2,h3,h4,h5,h6");
    if (!headers.length) { document.body.classList.add("no-toc-empty"); tocToggle.hidden = true; return; }
    let html = "";
    headers.forEach(function(h) {
      const level = parseInt(h.tagName[1]);
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

  // --- Character offset helpers ---
  function getCharOffset(container, offset) {
    const r = document.createRange();
    r.selectNodeContents(contentEl);
    r.setEnd(container, offset);
    return r.toString().length;
  }

  // --- Section detection ---
  function findSection(node) {
    let el = node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== contentEl) {
      let prev = el.previousElementSibling;
      while (prev) {
        if (/^H[1-6]$/.test(prev.tagName)) {
          const level = parseInt(prev.tagName[1]);
          return "#".repeat(level) + " " + prev.textContent.trim();
        }
        prev = prev.previousElementSibling;
      }
      el = el.parentNode;
    }
    return "";
  }

  // --- Highlighting ---
  function wrapMark(textNode, cid, isFirst) {
    const mark = document.createElement("mark");
    mark.className = "hl";
    mark.dataset.cid = cid;
    textNode.parentNode.insertBefore(mark, textNode);
    mark.appendChild(textNode);
    if (isFirst) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = cid;
      mark.insertBefore(badge, mark.firstChild);
    }
  }

  function highlightRange(range, cid) {
    let startC = range.startContainer;
    let endC = range.endContainer;
    let startO = range.startOffset;
    let endO = range.endOffset;

    // Normalize element-node endpoints to text-node boundaries.
    // When a user selects a whole element (e.g. a heading), the browser
    // may set the container to the element with child-index offsets.
    // The TreeWalker only visits text nodes, so it would never match
    // these element containers, leaving inRange stuck true forever.
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
      wrapMark(mid, cid, true);
      return;
    }

    let ancestor = range.commonAncestorContainer;
    if (ancestor.nodeType === 3) ancestor = ancestor.parentNode;

    const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let inRange = false;

    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.parentNode.classList && n.parentNode.classList.contains("badge")) continue;
      if (n === startC) {
        inRange = true;
        const info = { node: n, start: startO, end: n.textContent.length };
        if (n === endC) { info.end = endO; nodes.push(info); break; }
        nodes.push(info);
        continue;
      }
      if (n === endC) { nodes.push({ node: n, start: 0, end: endO }); break; }
      if (inRange) { nodes.push({ node: n, start: 0, end: n.textContent.length }); }
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

      wrapMark(target, cid, i === 0);
    }
  }

  function removeHighlight(cid) {
    const marks = contentEl.querySelectorAll('mark.hl[data-cid="' + cid + '"]');
    marks.forEach(function(m) {
      const badge = m.querySelector(".badge");
      if (badge) badge.remove();
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
  }

  function applyHighlightFromOffsets(startOff, endOff, cid) {
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let startNode, endNode, startNodeOff, endNodeOff;

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
        highlightRange(r, cid);
      } catch(e) {}
    }
  }

  // --- Margin Cards ---
  function renderCards() {
    marginCol.innerHTML = "";
    comments.forEach(function(c) {
      const card = document.createElement("div");
      card.className = "margin-card" + (c.id === activeCommentId ? " active" : "");
      card.dataset.cid = c.id;

      if (c._editing) {
        card.innerHTML = '<div class="card-quote">' + esc(trunc(c.selected_text, 40)) + '</div>'
          + '<textarea class="card-edit-area" rows="2">' + esc(c.comment) + '</textarea>'
          + '<div class="card-edit-actions">'
          + '<button class="btn card-save-btn" type="button">Save</button>'
          + '<button class="btn card-cancel-btn" type="button">Cancel</button>'
          + '</div>';
      } else {
        card.innerHTML = '<div class="card-quote">' + esc(trunc(c.selected_text, 40)) + '</div>'
          + '<div class="card-body">' + esc(c.comment) + '</div>'
          + '<div class="card-actions">'
          + '<button class="card-btn card-copy" title="Copy">copy</button>'
          + '<button class="card-btn card-edit" title="Edit">edit</button>'
          + '<button class="card-btn card-delete" title="Delete">del</button>'
          + '</div>';
      }
      marginCol.appendChild(card);
    });
    positionCards();
  }

  function positionCards() {
    const cards = marginCol.querySelectorAll(".margin-card");
    const positions = [];

    cards.forEach(function(card) {
      const cid = card.dataset.cid;
      const mark = contentEl.querySelector('mark.hl[data-cid="' + cid + '"]');
      if (mark) {
        positions.push({ card: card, top: mark.offsetTop });
      } else {
        positions.push({ card: card, top: 0 });
      }
    });

    positions.sort(function(a, b) { return a.top - b.top; });

    let prevBottom = 0;
    positions.forEach(function(p) {
      const top = Math.max(p.top, prevBottom);
      p.card.style.top = top + "px";
      prevBottom = top + p.card.offsetHeight + 8;
    });
  }

  function setActiveComment(cid) {
    if (activeCommentId === cid) return;
    activeCommentId = cid;

    marginCol.querySelectorAll(".margin-card").forEach(function(c) {
      c.classList.toggle("active", parseInt(c.dataset.cid) === cid);
    });

    contentEl.querySelectorAll("mark.hl").forEach(function(m) {
      m.classList.toggle("hl-active", parseInt(m.dataset.cid) === cid);
    });

    commentsList.querySelectorAll(".comment-item").forEach(function(item) {
      item.style.fontWeight = parseInt(item.dataset.cid) === cid ? "bold" : "";
    });
  }

  // --- Comments CRUD ---
  function addComment(info) {
    const id = nextId++;
    comments.push({
      id: id,
      section: info.section,
      selected_text: info.selectedText,
      comment: info.comment,
      startOffset: info.startOff,
      endOffset: info.endOff
    });
    highlightRange(info.range, id);
    setActiveComment(id);
    updateUI();
    saveState();
  }

  function deleteComment(cid) {
    comments = comments.filter(function(c) { return c.id !== cid; });
    removeHighlight(cid);
    if (activeCommentId === cid) activeCommentId = null;
    updateUI();
    saveState();
  }

  function editComment(cid) {
    const c = comments.find(function(c) { return c.id === cid; });
    if (!c) return;
    c._editing = true;
    renderCards();

    const card = marginCol.querySelector('.margin-card[data-cid="' + cid + '"]');
    if (card) {
      const ta = card.querySelector(".card-edit-area");
      if (ta) {
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight + 4, 300) + "px";
        ta.focus();
        ta.setSelectionRange(0, 0);
        ta.scrollTop = 0;
      }
    }
  }

  function placeCursorAtComment(cid) {
    const mark = contentEl.querySelector('mark.hl[data-cid="' + cid + '"]');
    if (mark) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(mark);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function saveEdit(cid) {
    const card = marginCol.querySelector('.margin-card[data-cid="' + cid + '"]');
    const ta = card && card.querySelector(".card-edit-area");
    const c = comments.find(function(c) { return c.id === cid; });
    if (!c || !ta) return;
    const val = ta.value.trim();
    if (val) { c.comment = val; }
    delete c._editing;
    updateUI();
    saveState();
    placeCursorAtComment(cid);
    contentEl.focus();
  }

  function cancelEdit(cid) {
    const c = comments.find(function(c) { return c.id === cid; });
    if (c) delete c._editing;
    renderCards();
    placeCursorAtComment(cid);
    contentEl.focus();
  }

  function updateUI() {
    const count = comments.length;
    commentCountEl.textContent = count;
    commentCountTop.textContent = count + " comment" + (count !== 1 ? "s" : "");
    commentsSection.hidden = count === 0;

    let html = "";
    comments.forEach(function(c) {
      html += '<div class="comment-item" data-cid="' + c.id + '">';
      html += '<div class="comment-header">';
      html += '<span class="badge">' + c.id + '</span>';
      if (c.section) {
        const sectionName = c.section.replace(/^#+\\s*/, "");
        html += ' <span class="comment-section">\\u00a7 ' + esc(trunc(sectionName, 30)) + '</span> \\u2014 ';
      }
      html += '<span class="comment-quote">\\u201c' + esc(trunc(c.selected_text, 50)) + '\\u201d</span>';
      html += '</div>';
      html += '<div class="comment-body">\\u2192 ' + esc(c.comment) + '</div>';
      html += '</div>';
    });
    commentsList.innerHTML = html;

    renderCards();
  }

  // --- Persistence ---
  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        comments: comments.map(function(c) {
          return {
            id: c.id,
            section: c.section,
            selected_text: c.selected_text,
            comment: c.comment,
            startOffset: c.startOffset,
            endOffset: c.endOffset
          };
        }),
        nextId: nextId,
        generalFeedback: generalFeedback.value
      }));
    } catch(e) {}
  }

  function loadState() {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey));
      if (!data) return;
      if (data.generalFeedback) generalFeedback.value = data.generalFeedback;
      if (data.comments && data.comments.length) {
        nextId = data.nextId || 1;
        data.comments.forEach(function(c) {
          comments.push(c);
          applyHighlightFromOffsets(c.startOffset, c.endOffset, c.id);
        });
        updateUI();
      }
    } catch(e) {}
  }

  // --- Popup ---
  function showPopupButton(range) {
    currentRange = range.cloneRange();
    const rect = range.getBoundingClientRect();
    popup.style.left = Math.min(rect.right + 4, window.innerWidth - 120) + "px";
    popup.style.top = (rect.bottom + 4) + "px";
    popupBtn.hidden = false;
    popupForm.hidden = true;
    popup.classList.add("visible");
  }

  function expandPopup() {
    if (!currentRange) return;
    const text = currentRange.toString().trim();
    if (!text) return;
    popupQuote.textContent = trunc(text, 120);
    popupBtn.hidden = true;
    popupForm.hidden = false;
    popupText.value = "";

    requestAnimationFrame(function() {
      const r = popup.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 8) popup.style.top = Math.max(8, window.innerHeight - r.height - 8) + "px";
      if (r.right > window.innerWidth - 8) popup.style.left = Math.max(8, window.innerWidth - r.width - 8) + "px";
      popupText.focus();
    });
  }

  function hidePopup(restoreSelection) {
    popup.classList.remove("visible");
    if (restoreSelection && currentRange) {
      try {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(currentRange);
      } catch(e) {}
    }
    currentRange = null;
  }

  function commitComment() {
    const text = popupText.value.trim();
    if (!text || !currentRange) return;

    const selectedText = currentRange.toString().trim();
    const section = findSection(currentRange.startContainer);
    const startOff = getCharOffset(currentRange.startContainer, currentRange.startOffset);
    const endOff = startOff + currentRange.toString().length;

    const savedScrollTop = scrollArea.scrollTop;

    addComment({
      section: section,
      selectedText: selectedText,
      comment: text,
      startOff: startOff,
      endOff: endOff,
      range: currentRange
    });

    const newId = comments[comments.length - 1].id;
    hidePopup(false);

    // Place cursor after the highlight so arrow keys continue from here
    const marks = contentEl.querySelectorAll('mark.hl[data-cid="' + newId + '"]');
    if (marks.length) {
      const lastMark = marks[marks.length - 1];
      const sel = window.getSelection();
      const range = document.createRange();
      range.setStartAfter(lastMark);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    scrollArea.scrollTop = savedScrollTop;
    contentEl.focus();
  }

  // --- Keyboard: navigate between comments ---
  function getCommentMarks() {
    const seen = {};
    const marks = [];
    contentEl.querySelectorAll("mark.hl").forEach(function(m) {
      const cid = m.dataset.cid;
      if (!seen[cid]) { seen[cid] = true; marks.push(m); }
    });
    return marks;
  }

  function jumpToComment(direction) {
    const marks = getCommentMarks();
    if (!marks.length) return;

    const sel = window.getSelection();
    const cursorNode = sel.focusNode;

    let currentIdx = -1;
    if (cursorNode) {
      let el = cursorNode.nodeType === 3 ? cursorNode.parentNode : cursorNode;
      while (el && el !== contentEl) {
        if (el.tagName === "MARK" && el.classList.contains("hl")) {
          const cid = el.dataset.cid;
          for (let i = 0; i < marks.length; i++) {
            if (marks[i].dataset.cid === cid) { currentIdx = i; break; }
          }
          break;
        }
        el = el.parentNode;
      }
    }

    let targetIdx;
    if (direction === "next") {
      targetIdx = currentIdx < marks.length - 1 ? currentIdx + 1 : 0;
    } else {
      targetIdx = currentIdx > 0 ? currentIdx - 1 : marks.length - 1;
    }

    const mark = marks[targetIdx];
    const cid = parseInt(mark.dataset.cid);

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
    setActiveComment(cid);
  }

  // --- Selection change: track active comment ---
  document.addEventListener("selectionchange", function() {
    if (document.activeElement !== contentEl) return;
    const sel = window.getSelection();
    if (!sel.focusNode) return;

    let el = sel.focusNode.nodeType === 3 ? sel.focusNode.parentNode : sel.focusNode;
    while (el && el !== contentEl) {
      if (el.tagName === "MARK" && el.classList.contains("hl")) {
        setActiveComment(parseInt(el.dataset.cid));
        return;
      }
      el = el.parentNode;
    }
    setActiveComment(null);
  });

  // --- Submit ---
  function submit() {
    if (sent) return;
    sent = true;
    sub.disabled = true;
    subTop.disabled = true;
    sub.textContent = "\\u2026";
    subTop.textContent = "\\u2026";

    const payload = {
      comments: comments.map(function(c) {
        const obj = { selected_text: c.selected_text, comment: c.comment };
        if (c.section) obj.section = c.section;
        return obj;
      }),
      general_feedback: generalFeedback.value.trim()
    };
    if (!payload.comments.length) delete payload.comments;
    if (!payload.general_feedback) delete payload.general_feedback;

    fetch("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok) throw new Error(res.status);
      overlay.style.display = "flex";
      try { localStorage.removeItem(storageKey); } catch(e) {}
      setTimeout(function() { try { window.close(); } catch(e) {} }, 600);
    })
    .catch(function(e) {
      sent = false;
      sub.disabled = false;
      subTop.disabled = false;
      sub.textContent = "Submit";
      subTop.textContent = "Submit";
      alert("Error: " + e.message);
    });
  }

  // --- Event Listeners ---

  // Selection -> popup button (mouse-based)
  contentEl.addEventListener("mouseup", function() {
    setTimeout(function() {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && contentEl.contains(sel.anchorNode)) {
        showPopupButton(sel.getRangeAt(0));
      }
    }, 10);
  });

  popupBtn.addEventListener("click", function(e) { e.stopPropagation(); expandPopup(); });
  popupAdd.addEventListener("click", function(e) { e.stopPropagation(); commitComment(); });
  popupCancel.addEventListener("click", function(e) { e.stopPropagation(); hidePopup(true); contentEl.focus(); });

  popupText.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); commitComment(); }
    if (e.key === "Escape") { e.preventDefault(); hidePopup(true); contentEl.focus(); }
  });

  // Click outside popup
  document.addEventListener("mousedown", function(e) {
    if (popup.classList.contains("visible") && !popup.contains(e.target)) hidePopup(true);
  });

  // Margin card events (delegated)
  marginCol.addEventListener("click", function(e) {
    const card = e.target.closest(".margin-card");
    if (!card) return;

    if (e.target.closest(".card-edit-area")) return;

    const cid = parseInt(card.dataset.cid);

    if (e.target.closest(".card-copy")) {
      const c = comments.find(function(c) { return c.id === cid; });
      if (c) {
        navigator.clipboard.writeText(c.comment).then(function() {
          const btn = card.querySelector(".card-copy");
          if (btn) { btn.textContent = "ok"; setTimeout(function() { btn.textContent = "copy"; }, 1200); }
        });
      }
      return;
    }

    if (e.target.closest(".card-delete")) { deleteComment(cid); contentEl.focus(); return; }
    if (e.target.closest(".card-edit")) { editComment(cid); return; }
    if (e.target.closest(".card-save-btn")) { saveEdit(cid); return; }
    if (e.target.closest(".card-cancel-btn")) { cancelEdit(cid); return; }

    // Click card body -> scroll to highlight
    const mark = contentEl.querySelector('mark.hl[data-cid="' + cid + '"]');
    if (mark) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveComment(cid);

      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(mark);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      contentEl.focus();
    }
  });

  // Card edit textarea keydown
  marginCol.addEventListener("keydown", function(e) {
    const ta = e.target.closest(".card-edit-area");
    if (!ta) return;
    const card = ta.closest(".margin-card");
    const cid = parseInt(card.dataset.cid);
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); saveEdit(cid); }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(cid); }
  });

  // Summary list click -> scroll to highlight + activate card
  commentsList.addEventListener("click", function(e) {
    const item = e.target.closest(".comment-item");
    if (!item) return;
    const cid = parseInt(item.dataset.cid);
    const mark = contentEl.querySelector('mark.hl[data-cid="' + cid + '"]');
    if (mark) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveComment(cid);
      placeCursorAtComment(cid);
      contentEl.focus();
    }
  });

  // General feedback persistence
  generalFeedback.addEventListener("input", function() { saveState(); });

  // Tab from content to general feedback
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

  // Global keyboard shortcuts
  document.addEventListener("keydown", function(e) {
    const inTextarea = e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT";
    const inCardEdit = e.target.closest(".card-edit-area");

    if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && contentEl.contains(sel.anchorNode)) {
        e.preventDefault();
        if (!currentRange) showPopupButton(sel.getRangeAt(0));
        expandPopup();
      }
    }

    if ((e.key === "n" || e.key === "p") && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      e.preventDefault();
      jumpToComment(e.key === "n" ? "next" : "prev");
    }

    if (e.key === "e" && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      if (activeCommentId) {
        e.preventDefault();
        editComment(activeCommentId);
      }
    }

    if ((e.key === "d" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey && !e.altKey && !inTextarea && !inCardEdit) {
      if (activeCommentId) {
        e.preventDefault();
        deleteComment(activeCommentId);
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
      else if (inCardEdit) { /* handled by card keydown */ }
      else { window.getSelection().removeAllRanges(); setActiveComment(null); }
    }
  });

  // Submit buttons
  sub.addEventListener("click", submit);
  subTop.addEventListener("click", submit);

  // Focus content on load for immediate keyboard nav
  contentEl.focus();

  // Reposition cards on resize
  window.addEventListener("resize", function() { positionCards(); });

  // --- Init ---
  loadState();
})();
</script>
</body>
</html>`;
}
