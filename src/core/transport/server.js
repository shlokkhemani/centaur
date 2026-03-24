import http from "node:http";
import { openBrowser } from "./browser.js";
import { log, error as logError } from "../logger.js";

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const CLOSE_TIMEOUT_MS = 5000;

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
        let body = "";
        let bytes = 0;

        req.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_BODY_BYTES) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Request body too large" }));
            req.destroy();
            return;
          }
          body += chunk;
        });

        req.on("end", () => {
          if (bytes > MAX_BODY_BYTES) return;

          res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify({ ok: true }));

          if (!settled) {
            settled = true;
            try {
              const answers = JSON.parse(body);
              log("Submission received, shutting down server");
              cleanup();
              resolve(answers);
            } catch (err) {
              cleanup();
              reject(new Error(`Invalid JSON in submission: ${err.message}`));
            }
          }
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
