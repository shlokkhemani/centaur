import http from "node:http";
import { randomUUID } from "node:crypto";
import { openBrowser } from "./browser.js";
import { log, error as logError } from "../logger.js";
import {
  buildJsonError,
  parseRequestBody,
  closeServerGracefully,
  CLOSE_TIMEOUT_MS,
} from "./http.js";
import { writeSseEvent } from "./sse.js";

const REVIEW_SESSION_TIMEOUT_MS = 60 * 60 * 1000;

export class ReviewSession {
  constructor({ renderPage, initialState, timeoutMs = REVIEW_SESSION_TIMEOUT_MS, onClose }) {
    this.id = randomUUID();
    this.renderPage = renderPage;
    this.state = {
      markdown: initialState.markdown,
      comments: [...(initialState.comments || [])],
      questions: [...(initialState.questions || [])],
      edits: [...(initialState.edits || [])],
      general_feedback: initialState.general_feedback ?? "",
      pending_interaction_id: initialState.pending_interaction_id || null,
      pending_edit_id: initialState.pending_edit_id || null,
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
      pending_edit_id: this.state.pending_edit_id,
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
      surrounding_context: String(anchor?.surrounding_context ?? ""),
      selected_text: String(anchor?.selected_text ?? ""),
      section: String(anchor?.section ?? ""),
    };
  }

  hasPendingInteraction() {
    return !!(this.state.pending_interaction_id || this.state.pending_edit_id);
  }

  assertNoPendingInteraction() {
    if (this.hasPendingInteraction()) {
      throw buildJsonError("A review interaction is already pending", 409);
    }
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

  buildEditRequestResult(edit) {
    return {
      status: "edit_request",
      session_id: this.id,
      interaction_id: edit.interaction_id,
      anchor: edit.anchor,
      selected_text: edit.selected_text || edit.anchor.selected_text,
      section: edit.anchor.section,
      instruction: edit.instruction,
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
          answer: question.answer ?? "",
        };
      }),
      edits: this.state.edits.map((edit) => ({
        interaction_id: edit.interaction_id,
        badge_label: edit.badge_label || "",
        anchor: edit.anchor,
        section: edit.anchor.section,
        selected_text: edit.selected_text || edit.anchor.selected_text,
        instruction: edit.instruction ?? "",
        proposed_replacement: edit.proposed_replacement ?? "",
        status: edit.status || "pending",
        accepted:
          edit.status === "accepted"
            ? true
            : edit.status === "rejected"
              ? false
              : null,
      })),
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
      comment: String(payload.comment ?? ""),
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
    this.assertNoPendingInteraction();

    const question = {
      kind: "question",
      interaction_id: String(payload.interaction_id),
      parent_interaction_id: payload.parent_interaction_id
        ? String(payload.parent_interaction_id)
        : null,
      badge_label: String(payload.badge_label || ""),
      anchor: this.normalizeAnchor(payload.anchor),
      question: String(payload.question ?? "").trim(),
      answer: "",
    };

    if (!question.question) {
      throw buildJsonError("Question text is required", 400);
    }

    this.state.questions.push(question);
    this.state.pending_interaction_id = question.interaction_id;
    this.pushEvent(this.buildQuestionResult(question));
  }

  enqueueEditRequest(payload) {
    this.assertNoPendingInteraction();

    const edit = {
      interaction_id: String(payload.interaction_id),
      badge_label: String(payload.badge_label || ""),
      anchor: this.normalizeAnchor(payload.anchor),
      selected_text: String(payload.selected_text || payload.anchor?.selected_text || "").trim(),
      instruction: String(payload.instruction ?? "").trim(),
      proposed_replacement: "",
      status: "pending",
    };

    if (!edit.selected_text) {
      throw buildJsonError("Edit selection text is required", 400);
    }

    this.state.edits.push(edit);
    this.state.pending_edit_id = edit.interaction_id;
    this.pushEvent(this.buildEditRequestResult(edit));
  }

  acceptEdit(payload) {
    const interactionId = String(payload.interaction_id || "").trim();
    const edit = this.state.edits.find((entry) => entry.interaction_id === interactionId);
    if (!edit) {
      throw buildJsonError("Edit proposal not found", 404);
    }
    if (edit.status !== "proposed") {
      throw buildJsonError("Edit has no accepted proposal state", 409);
    }

    edit.status = "accepted";
    if (typeof payload.final_document === "string") {
      this.state.markdown = payload.final_document;
    }
  }

  rejectEdit(payload) {
    const interactionId = String(payload.interaction_id || "").trim();
    const edit = this.state.edits.find((entry) => entry.interaction_id === interactionId);
    if (!edit) {
      throw buildJsonError("Edit proposal not found", 404);
    }

    edit.status = "rejected";
    if (typeof payload.final_document === "string") {
      this.state.markdown = payload.final_document;
    }
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

    const content = String(payload.content ?? "").trim();
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

    if (!this.hasPendingInteraction()) {
      throw new Error("No review interaction is waiting for a response");
    }

    if (type === "answer") {
      if (this.state.pending_interaction_id !== interaction_id) {
        throw new Error("Response does not match the pending review interaction");
      }

      const question = this.state.questions.find(
        (entry) => entry.interaction_id === interaction_id
      );
      if (!question) {
        throw new Error("Question not found for the active review interaction");
      }

      question.answer = String(content ?? "");
      this.state.pending_interaction_id = null;
      this.broadcast({
        type: "answer",
        interaction_id,
        content: question.answer,
      });
      return;
    }

    if (type === "edit_proposal") {
      if (this.state.pending_edit_id !== interaction_id) {
        throw new Error("Response does not match the pending review interaction");
      }

      const edit = this.state.edits.find(
        (entry) => entry.interaction_id === interaction_id
      );
      if (!edit) {
        throw new Error("Edit request not found for the active review interaction");
      }

      edit.proposed_replacement = String(content ?? "");
      edit.status = "proposed";
      this.state.pending_edit_id = null;
      this.broadcast({
        type: "edit_proposal",
        interaction_id,
        content: edit.proposed_replacement,
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

        closeServerGracefully(server, {
          timeoutMs: CLOSE_TIMEOUT_MS,
          onClosed: () => {
            this.onClose?.(this);
            log(`Review session ${this.id} closed`);
          },
        });
      }, 0);
    }
  }

  async handleBrowserEvent(payload) {
    const type = String(payload?.type ?? "");

    switch (type) {
      case "comment_upsert":
        this.upsertComment(payload);
        return { ok: true };
      case "comment_delete":
        this.deleteComment(String(payload.interaction_id || ""));
        return { ok: true };
      case "draft_feedback":
        this.state.general_feedback = String(payload.general_feedback ?? "");
        return { ok: true };
      case "question":
        this.enqueueQuestion(payload);
        return { ok: true };
      case "edit_request":
        this.enqueueEditRequest(payload);
        return { ok: true };
      case "edit_accept":
        this.acceptEdit(payload);
        return { ok: true };
      case "edit_reject":
        this.rejectEdit(payload);
        return { ok: true };
      case "thread_note":
        this.appendThreadNote(payload);
        return { ok: true };
      case "submit":
        this.state.general_feedback = String(payload.general_feedback ?? "");
        if (typeof payload.final_document === "string") {
          this.state.markdown = payload.final_document;
        }
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
        Allow: requestUrl.pathname === "/events" ? "POST" : "GET",
      });
      res.end("Method Not Allowed");
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
}
