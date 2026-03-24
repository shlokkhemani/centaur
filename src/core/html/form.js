/**
 * Generates a self-contained HTML document for the questionnaire form.
 *
 * Layout: fixed viewport height, questions flow top-to-bottom in columns,
 * horizontal scroll when columns exceed viewport width.
 * Absolute-positioned vertical lines create a closed grid with item borders.
 */

import { escapeHtml } from "../utils.js";

function renderTextQuestion(q) {
  const placeholder = q.placeholder ? escapeHtml(q.placeholder) : "";
  const defaultVal = q.default_value ? escapeHtml(q.default_value) : "";
  return `<textarea class="txt" data-id="${escapeHtml(q.id)}" data-type="text" placeholder="${placeholder}" rows="2">${defaultVal}</textarea>`;
}

function renderChoiceQuestion(q) {
  const name = escapeHtml(q.id);
  let html = `<div class="opts" data-id="${name}" data-type="choice">`;
  for (const opt of q.options || []) {
    const val = escapeHtml(opt);
    const checked = q.default_value === opt ? " checked" : "";
    html += `<label><input type="radio" name="${name}" value="${val}"${checked}> ${val}</label>`;
  }
  if (q.allow_other !== false) {
    html += `<label><input type="radio" name="${name}" value="__other__"> Other: <input type="text" class="other" disabled></label>`;
  }
  html += `</div>`;
  return html;
}

function renderMultiChoiceQuestion(q) {
  const name = escapeHtml(q.id);
  const defaults = q.default_value ? q.default_value.split(",").map(s => s.trim()) : [];
  let html = `<div class="opts" data-id="${name}" data-type="multi_choice">`;
  for (const opt of q.options || []) {
    const val = escapeHtml(opt);
    const checked = defaults.includes(opt) ? " checked" : "";
    html += `<label><input type="checkbox" name="${name}" value="${val}"${checked}> ${val}</label>`;
  }
  if (q.allow_other !== false) {
    html += `<label><input type="checkbox" name="${name}" value="__other__"> Other: <input type="text" class="other" disabled></label>`;
  }
  html += `</div>`;
  return html;
}

function renderQuestion(q, index) {
  const num = index + 1;
  const hint = q.hint ? `<div class="hint">${escapeHtml(q.hint)}</div>` : "";

  let input;
  switch (q.type) {
    case "choice": input = renderChoiceQuestion(q); break;
    case "multi_choice": input = renderMultiChoiceQuestion(q); break;
    default: input = renderTextQuestion(q);
  }

  const ariaReq = q.required === true ? ` aria-required="true"` : "";
  return `<div class="q" data-question-id="${escapeHtml(q.id)}" data-required="${q.required === true}"${ariaReq}>
<div class="qlabel">${num}. ${escapeHtml(q.label)}</div>
${hint}${input}
<div class="err" role="alert" hidden>Required.</div>
</div>`;
}

export function buildFormHtml({ title, description, questions }) {
  const questionBlocks = questions.map((q, i) => renderQuestion(q, i)).join("\n");
  const totalQuestions = questions.length;
  const totalFields = totalQuestions + 1;

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

html[data-theme="dark"] {
  --bg: #1a1a1a;
  --bg-input: #111;
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
}
html[data-theme="light"] {
  --bg: #fafafa;
  --bg-input: #fff;
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
}

html, body { height: 100%; overflow: hidden; background: var(--bg); color: var(--fg); }
body { font: 13px/1.5 Menlo, Consolas, "Liberation Mono", monospace; display: flex; flex-direction: column; }

/* --- Top bar --- */
.topbar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bar-bg);
  z-index: 10;
}
.topbar-left { display: flex; align-items: baseline; gap: 16px; min-width: 0; }
.title { font-size: 13px; font-weight: bold; color: var(--fg-bold); white-space: nowrap; }
.desc { color: var(--fg-dim); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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

/* --- Column flow area --- */
.flow {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-content: flex-start;
  padding: 0;
  gap: 0;
  position: relative;
}
.q, .catchall {
  width: 360px;
  flex-shrink: 0;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
}
.q.col-last, .catchall.col-last { border-bottom: none; }

/* Absolute vertical grid lines */
.vline {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border);
  pointer-events: none;
  z-index: 1;
}

.qlabel { color: var(--fg-bold); font-weight: bold; margin-bottom: 3px; font-size: 12px; }
.hint { color: var(--fg-dim); margin-bottom: 4px; font-size: 11px; }
.catch-label { color: var(--fg-dim); margin-bottom: 3px; font-size: 12px; }
.txt {
  display: block;
  width: 100%;
  padding: 5px 7px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  resize: none;
}
.txt:focus { outline: 2px solid var(--border-focus); outline-offset: 1px; border-color: var(--border-focus); }
.txt::placeholder { color: var(--fg-ghost); }
.opts label {
  display: block;
  padding: 1px 0;
  cursor: pointer;
  color: var(--fg);
  font-size: 12px;
}
.opts input[type="radio"],
.opts input[type="checkbox"] {
  margin-right: 3px;
  accent-color: var(--accent);
}
.other {
  background: var(--bg-input);
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  padding: 1px 4px;
  width: 140px;
}
.other:disabled { opacity: 0.3; }
.other:focus { outline: 2px solid var(--border-focus); outline-offset: 1px; border-color: var(--border-focus); }
.err { color: var(--err); font-size: 11px; margin-top: 2px; }
.q.bad .txt { border-color: var(--err); }

/* --- Bottom bar --- */
.botbar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  border-top: 1px solid var(--border);
  background: var(--bar-bg);
  z-index: 10;
}
.botbar-right { display: flex; align-items: center; gap: 12px; }
.meta { color: var(--fg-faint); font-size: 11px; white-space: nowrap; }
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

/* Scrollbar */
.flow { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.flow::-webkit-scrollbar { height: 6px; }
.flow::-webkit-scrollbar-track { background: transparent; }
.flow::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.flow::-webkit-scrollbar-thumb:hover { background: var(--border-focus); }
</style>
</head>
<body>

<div class="topbar" id="topbar">
  <div class="topbar-left">
    <div class="title">${escapeHtml(title)}</div>
    ${description ? `<div class="desc">${escapeHtml(description)}</div>` : ""}
  </div>
  <button class="btn" id="toggle" type="button">dark</button>
</div>

<div class="flow" id="flow">
${questionBlocks}
<div class="catchall" data-question-id="_catchall" data-required="false">
<div class="catch-label">Anything else?</div>
<textarea class="txt" data-id="_catchall" data-type="text" placeholder="Anything not covered above\u2026" rows="2"></textarea>
</div>
</div>

<div class="botbar" id="botbar">
  <span class="kbd">\u2318\u21B5 to submit</span>
  <div class="botbar-right">
    <span class="meta" id="meta">0/${totalFields} answered</span>
    <button class="btn" id="sub">Submit</button>
  </div>
</div>

<div class="overlay" id="overlay">
  <b>Submitted.</b>&nbsp;You can close this tab.
</div>

<script>
(function(){
  const flow = document.getElementById("flow");
  const overlay = document.getElementById("overlay");
  const sub = document.getElementById("sub");
  const meta = document.getElementById("meta");
  const toggle = document.getElementById("toggle");
  const total = ${totalFields};
  let sent = false;

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

  // --- Grid lines ---
  function computeGrid() {
    const items = document.querySelectorAll(".q, .catchall");
    if (!items.length) return;

    // clean up previous
    document.querySelectorAll(".vline").forEach(function(el) { el.remove(); });
    items.forEach(function(el) { el.classList.remove("col-last"); });

    // group items into columns by offsetLeft
    const cols = [];
    let curX = -1;
    items.forEach(function(el) {
      const x = el.offsetLeft;
      if (x !== curX) { cols.push([]); curX = x; }
      cols[cols.length - 1].push(el);
    });

    // mark last item in each column (no bottom border)
    cols.forEach(function(col) { col[col.length - 1].classList.add("col-last"); });

    // collect vertical line x-positions: left edge, between cols, right edge
    const xs = new Set();
    cols.forEach(function(col) {
      const el = col[0];
      xs.add(el.offsetLeft);
      xs.add(el.offsetLeft + el.offsetWidth);
    });

    // create vertical line elements
    xs.forEach(function(x) {
      const line = document.createElement("div");
      line.className = "vline";
      line.style.left = x + "px";
      flow.appendChild(line);
    });
  }
  computeGrid();

  // --- Input handlers ---
  document.querySelectorAll(".txt").forEach(function(ta) {
    ta.addEventListener("input", function() { updateCount(); });
  });

  document.querySelectorAll('.opts[data-type="choice"]').forEach(function(g) {
    const otherInput = g.querySelector(".other");
    if (!otherInput) return;
    g.querySelectorAll('input[type="radio"]').forEach(function(r) {
      r.addEventListener("change", function() {
        otherInput.disabled = r.value !== "__other__" || !r.checked;
        if (!otherInput.disabled) otherInput.focus();
        updateCount();
      });
    });
  });

  document.querySelectorAll('.opts[data-type="multi_choice"]').forEach(function(g) {
    const otherCheckbox = g.querySelector('input[value="__other__"]');
    const otherInput = g.querySelector(".other");
    if (!otherCheckbox || !otherInput) return;
    g.querySelectorAll('input[type="checkbox"]').forEach(function(c) {
      c.addEventListener("change", function() {
        otherInput.disabled = !otherCheckbox.checked;
        if (!otherInput.disabled) otherInput.focus();
        updateCount();
      });
    });
  });

  // --- Answers ---
  function allQuestions() {
    return document.querySelectorAll(".q, .catchall");
  }

  function getAnswer(el) {
    const ta = el.querySelector(".txt");
    if (ta) return ta.value.trim();

    const g = el.querySelector(".opts");
    if (!g) return "";

    if (g.dataset.type === "choice") {
      const checked = g.querySelector('input[type="radio"]:checked');
      if (!checked) return "";
      if (checked.value === "__other__") {
        const other = g.querySelector(".other");
        return other ? (other.value?.trim() || "") : "";
      }
      return checked.value;
    }

    if (g.dataset.type === "multi_choice") {
      const values = [];
      g.querySelectorAll('input[type="checkbox"]:checked').forEach(function(c) {
        if (c.value === "__other__") {
          const other = g.querySelector(".other");
          const otherVal = other ? other.value?.trim() : "";
          if (otherVal) values.push(otherVal);
        } else {
          values.push(c.value);
        }
      });
      return values;
    }

    return "";
  }

  function hasAnswer(el) {
    const a = getAnswer(el);
    return Array.isArray(a) ? a.length > 0 : a !== "";
  }

  function updateCount() {
    let n = 0;
    allQuestions().forEach(function(q) { if (hasAnswer(q)) n++; });
    meta.textContent = n + "/" + total + " answered";
  }

  function validate() {
    let valid = true;
    allQuestions().forEach(function(q) {
      q.classList.remove("bad");
      const errEl = q.querySelector(".err");
      if (errEl) {
        errEl.hidden = true;
        q.removeAttribute("aria-invalid");
      }
      if (q.dataset.required === "true" && !hasAnswer(q)) {
        valid = false;
        q.classList.add("bad");
        q.setAttribute("aria-invalid", "true");
        if (errEl) errEl.hidden = false;
      }
    });
    return valid;
  }

  function submitForm() {
    if (sent) return;

    if (!validate()) {
      const first = document.querySelector(".q.bad, .catchall.bad");
      if (first) first.scrollIntoView({ block: "center" });
      return;
    }

    sent = true;
    sub.disabled = true;
    sub.textContent = "...";

    const result = {};
    allQuestions().forEach(function(q) {
      result[q.dataset.questionId] = getAnswer(q);
    });

    fetch("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result)
    })
    .then(function(res) {
      if (!res.ok) throw new Error(res.status);
      overlay.style.display = "flex";
      setTimeout(function() { try { window.close(); } catch(e) {} }, 600);
    })
    .catch(function(e) {
      sent = false;
      sub.disabled = false;
      sub.textContent = "Submit";
      alert("Error: " + e.message);
    });
  }

  sub.addEventListener("click", submitForm);
  document.addEventListener("keydown", function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submitForm();
    }
  });
  updateCount();
})();
</script>
</body>
</html>`;
}
