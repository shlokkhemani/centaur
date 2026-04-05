import http from "node:http";
import { randomUUID } from "node:crypto";
import { openBrowser } from "./browser.js";
import { log, error as logError } from "../logger.js";

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const CLOSE_TIMEOUT_MS = 5000;
const REVIEW_SESSION_TIMEOUT_MS = 60 * 60 * 1000;

function buildJsonError(message, status = 400) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function parseRequestBody(req, res) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;

    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large" }));
        req.destroy();
        reject(buildJsonError("Request body too large", 413));
        return;
      }
      body += chunk;
    });

    req.on("end", () => {
      if (bytes > MAX_BODY_BYTES) return;

      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(buildJsonError(`Invalid JSON in submission: ${err.message}`, 400));
      }
    });

    req.on("error", reject);
  });
}

function safeJson(value) {
  return JSON.stringify(value);
}

function writeSseEvent(res, event) {
  res.write(`id: ${event.id}\n`);
  res.write(`data: ${safeJson(event.data)}\n\n`);
}

/**
 * Starts a temporary HTTP server, opens the browser, and waits for the user
 * to submit a response. Returns a promise that resolves with the parsed JSON.
 * No timeout — the server stays alive until the user submits.
 *
 * @param {string} html - Complete HTML document to serve
 * @returns {Promise<object>} The submitted JSON payload
 */
export function serveHtmlAndWait(html) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const server = http.createServer((req, res) => {
      // --- GET / or /index.html ---
      if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        });
        res.end(html);
        return;
      }

      // --- POST /submit ---
      if (req.method === "POST" && req.url === "/submit") {
        parseRequestBody(req, res)
          .then((answers) => {
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify({ ok: true }));

            if (!settled) {
              settled = true;
              log("Submission received, shutting down server");
              cleanup();
              resolve(answers);
            }
          })
          .catch((err) => {
            if (err?.statusCode === 413) return;
            cleanup();
            reject(err instanceof Error ? err : new Error(String(err)));
          });
        return;
      }

      // --- Wrong method on known paths ---
      if (req.url === "/" || req.url === "/index.html" || req.url === "/submit") {
        res.writeHead(405, { "Content-Type": "text/plain", Allow: req.url === "/submit" ? "POST" : "GET" });
        res.end("Method Not Allowed");
        return;
      }

      // --- 404 for everything else ---
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    function cleanup() {
      const timer = setTimeout(() => {
        log("Force-destroying lingering connections");
        server.closeAllConnections?.();
      }, CLOSE_TIMEOUT_MS);

      server.close(() => {
        clearTimeout(timer);
        log("Server closed");
      });
    }

    server.on("error", (err) => {
      if (!settled) {
        settled = true;
        logError(`Server error: ${err.message}`);
        cleanup();
        reject(new Error(`Server failed: ${err.message}`));
      }
    });

    // Listen on port 0 (OS-assigned random port) on localhost only
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}`;
      log(`Server listening at ${url}`);
      openBrowser(url);
    });
  });
}

export class ReviewSession {
  constructor({ renderPage, initialState, timeoutMs = REVIEW_SESSION_TIMEOUT_MS, onClose }) {
    this.id = randomUUID();
    this.renderPage = renderPage;
    this.state = {
      markdown: initialState.markdown,
      comments: [...(initialState.comments || [])],
      questions: [...(initialState.questions || [])],
      edits: [...(initialState.edits || [])],
      general_feedback: initialState.general_feedback || "",
      pending_interaction_id: initialState.pending_interaction_id || null,
    };
    this.onClose = onClose;
    this.timeoutMs = timeoutMs;

    this.server = null;
    this.url = null;
    this.closed = false;
    this.closeReason = null;
    this.queue = [];
    this.waiter = null;
    this.sseClients = new Set();
    this.outboundEvents = [];
    this.lastOutboundEventId = 0;
    this.timeoutHandle = null;
    this.shutdownScheduled = false;

    this.handleRequest = this.handleRequest.bind(this);
  }

  async start() {
    if (this.server) return this.url;

    const server = http.createServer(this.handleRequest);
    this.server = server;

    server.on("error", (err) => {
      logError(`Review session ${this.id} server error: ${err.message}`);
      this.close("server_error");
    });

    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.removeListener("error", reject);
        const address = server.address();
        if (!address || typeof address === "string") {
          reject(new Error("Failed to determine review session address"));
          return;
        }
        this.url = `http://127.0.0.1:${address.port}`;
        log(`Review session ${this.id} listening at ${this.url}`);
        resolve();
      });
    });

    this.touch();
    openBrowser(this.url);
    return this.url;
  }

  isClosed() {
    return this.closed;
  }

  touch() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
    this.timeoutHandle = setTimeout(() => {
      log(`Review session ${this.id} timed out`);
      this.close("timeout");
    }, this.timeoutMs);
  }

  buildHydrationPayload() {
    return {
      session_id: this.id,
      comments: this.state.comments,
      questions: this.state.questions,
      edits: this.state.edits,
      general_feedback: this.state.general_feedback,
      pending_interaction_id: this.state.pending_interaction_id,
    };
  }

  waitForEvent() {
    this.touch();

    if (this.queue.length > 0) {
      return Promise.resolve(this.queue.shift());
    }

    if (this.closed) {
      return Promise.resolve({ status: "session_closed", session_id: this.id });
    }

    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }

  pushEvent(event) {
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve(event);
      return;
    }

    this.queue.push(event);
  }

  broadcast(data) {
    const event = {
      id: ++this.lastOutboundEventId,
      data,
    };

    this.outboundEvents.push(event);
    for (const client of this.sseClients) {
      writeSseEvent(client, event);
    }
  }

  normalizeAnchor(anchor) {
    const start = Math.max(0, Number(anchor?.offset_start) || 0);
    const end = Math.max(start, Number(anchor?.offset_end) || start);
    return {
      offset_start: start,
      offset_end: end,
      surrounding_context: String(anchor?.surrounding_context || ""),
      selected_text: String(anchor?.selected_text || ""),
      section: String(anchor?.section || ""),
    };
  }

  buildQuestionResult(question) {
    return {
      status: "question",
      session_id: this.id,
      interaction_id: question.interaction_id,
      parent_interaction_id: question.parent_interaction_id || null,
      anchor: question.anchor,
      selected_text: question.anchor.selected_text,
      section: question.anchor.section,
      question: question.question,
      comments_so_far: this.state.comments.map((comment) => ({
        section: comment.anchor.section,
        selected_text: comment.anchor.selected_text,
        comment: comment.comment,
      })),
    };
  }

  buildCompleteResult() {
    const result = {
      status: "complete",
      comments: this.state.comments.map((comment) => ({
        section: comment.anchor.section,
        selected_text: comment.anchor.selected_text,
        comment: comment.comment,
      })),
      questions: this.state.questions.map((question) => {
        if (question.kind === "note") {
          return {
            kind: "note",
            interaction_id: question.interaction_id,
            parent_interaction_id: question.parent_interaction_id || null,
            badge_label: question.badge_label || "",
            anchor: question.anchor,
            content: question.content,
          };
        }

        return {
          kind: "question",
          interaction_id: question.interaction_id,
          parent_interaction_id: question.parent_interaction_id || null,
          badge_label: question.badge_label || "",
          anchor: question.anchor,
          question: question.question,
          answer: question.answer || "",
        };
      }),
      edits: this.state.edits.map((edit) => ({ ...edit })),
      final_document: this.state.markdown,
    };

    if (this.state.general_feedback) {
      result.general_feedback = this.state.general_feedback;
    }

    return result;
  }

  upsertComment(payload) {
    const comment = {
      interaction_id: String(payload.interaction_id),
      badge_label: String(payload.badge_label || ""),
      anchor: this.normalizeAnchor(payload.anchor),
      comment: String(payload.comment || ""),
    };

    const existingIndex = this.state.comments.findIndex(
      (entry) => entry.interaction_id === comment.interaction_id
    );

    if (existingIndex >= 0) {
      this.state.comments[existingIndex] = comment;
    } else {
      this.state.comments.push(comment);
    }
  }

  deleteComment(interactionId) {
    this.state.comments = this.state.comments.filter(
      (comment) => comment.interaction_id !== interactionId
    );
  }

  enqueueQuestion(payload) {
    if (this.state.pending_interaction_id) {
      throw buildJsonError("A review interaction is already pending", 409);
    }

    const question = {
      kind: "question",
      interaction_id: String(payload.interaction_id),
      parent_interaction_id: payload.parent_interaction_id
        ? String(payload.parent_interaction_id)
        : null,
      badge_label: String(payload.badge_label || ""),
      anchor: this.normalizeAnchor(payload.anchor),
      question: String(payload.question || "").trim(),
      answer: "",
    };

    if (!question.question) {
      throw buildJsonError("Question text is required", 400);
    }

    this.state.questions.push(question);
    this.state.pending_interaction_id = question.interaction_id;
    this.pushEvent(this.buildQuestionResult(question));
  }

  appendThreadNote(payload) {
    const parentInteractionId = String(payload.parent_interaction_id || "").trim();
    if (!parentInteractionId) {
      throw buildJsonError("parent_interaction_id is required for thread notes", 400);
    }

    const parentEntry = this.state.questions.find(
      (entry) => entry.interaction_id === parentInteractionId
    );
    if (!parentEntry) {
      throw buildJsonError("Parent review interaction not found", 404);
    }

    const content = String(payload.content || "").trim();
    if (!content) {
      throw buildJsonError("Thread note content is required", 400);
    }

    this.state.questions.push({
      kind: "note",
      interaction_id: String(payload.interaction_id || randomUUID()),
      parent_interaction_id: parentInteractionId,
      badge_label: String(payload.badge_label || parentEntry.badge_label || ""),
      anchor: this.normalizeAnchor(payload.anchor || parentEntry.anchor),
      content,
    });
  }

  sendResponse({ interaction_id, type, content }) {
    this.touch();

    if (this.closed) {
      throw new Error("Review session is already closed");
    }

    if (!this.state.pending_interaction_id) {
      throw new Error("No review interaction is waiting for a response");
    }

    if (this.state.pending_interaction_id !== interaction_id) {
      throw new Error("Response does not match the pending review interaction");
    }

    if (type === "answer") {
      const question = this.state.questions.find(
        (entry) => entry.interaction_id === interaction_id
      );
      if (!question) {
        throw new Error("Question not found for the active review interaction");
      }

      question.answer = String(content || "");
      this.state.pending_interaction_id = null;
      this.broadcast({
        type: "answer",
        interaction_id,
        content: question.answer,
      });
      return;
    }

    throw new Error(`Unsupported review response type: ${type}`);
  }

  finish() {
    const result = this.buildCompleteResult();
    this.pushEvent(result);
    this.close("complete");
  }

  close(reason = "session_closed") {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.closeReason = reason;

    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    this.broadcast({
      type: "session_closed",
      session_id: this.id,
      reason,
    });

    if (reason !== "complete") {
      this.pushEvent({ status: "session_closed", session_id: this.id });
    }

    if (!this.shutdownScheduled) {
      this.shutdownScheduled = true;
      setTimeout(() => {
        for (const client of this.sseClients) {
          try {
            client.end();
          } catch {}
        }
        this.sseClients.clear();

        if (!this.server) {
          this.onClose?.(this);
          return;
        }

        const server = this.server;
        this.server = null;

        const timer = setTimeout(() => {
          server.closeAllConnections?.();
        }, CLOSE_TIMEOUT_MS);

        server.close(() => {
          clearTimeout(timer);
          this.onClose?.(this);
          log(`Review session ${this.id} closed`);
        });
      }, 0);
    }
  }

  async handleBrowserEvent(payload) {
    const type = String(payload?.type || "");

    switch (type) {
      case "comment_upsert":
        this.upsertComment(payload);
        return { ok: true };
      case "comment_delete":
        this.deleteComment(String(payload.interaction_id || ""));
        return { ok: true };
      case "draft_feedback":
        this.state.general_feedback = String(payload.general_feedback || "");
        return { ok: true };
      case "question":
        this.enqueueQuestion(payload);
        return { ok: true };
      case "thread_note":
        this.appendThreadNote(payload);
        return { ok: true };
      case "submit":
        this.state.general_feedback = String(payload.general_feedback || "");
        this.finish();
        return { ok: true };
      default:
        throw buildJsonError(`Unsupported review browser event: ${type}`, 400);
    }
  }

  async handleRequest(req, res) {
    this.touch();

    const requestUrl = new URL(req.url || "/", this.url || "http://127.0.0.1");

    if (req.method === "GET" && (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html")) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      });
      res.end(this.renderPage(this.buildHydrationPayload()));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/sse") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Connection: "keep-alive",
      });
      res.write("\n");

      const lastEventId = Number(req.headers["last-event-id"] || 0);
      if (lastEventId > 0) {
        for (const event of this.outboundEvents) {
          if (event.id > lastEventId) {
            writeSseEvent(res, event);
          }
        }
      }

      this.sseClients.add(res);
      req.on("close", () => {
        this.sseClients.delete(res);
      });
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/events") {
      try {
        const payload = await parseRequestBody(req, res);
        const result = await this.handleBrowserEvent(payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        if (err?.statusCode === 413) return;
        const statusCode = err?.statusCode || 500;
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    if (
      requestUrl.pathname === "/" ||
      requestUrl.pathname === "/index.html" ||
      requestUrl.pathname === "/sse" ||
      requestUrl.pathname === "/events"
    ) {
      res.writeHead(405, {
        "Content-Type": "text/plain",
        Allow:
          requestUrl.pathname === "/events"
            ? "POST"
            : "GET",
      });
      res.end("Method Not Allowed");
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
}
