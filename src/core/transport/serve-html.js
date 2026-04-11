import http from "node:http";
import { openBrowser } from "./browser.js";
import { log, error as logError } from "../logger.js";
import { parseRequestBody, closeServerGracefully } from "./http.js";

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
      if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        });
        res.end(html);
        return;
      }

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

      if (req.url === "/" || req.url === "/index.html" || req.url === "/submit") {
        res.writeHead(405, {
          "Content-Type": "text/plain",
          Allow: req.url === "/submit" ? "POST" : "GET",
        });
        res.end("Method Not Allowed");
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    function cleanup() {
      closeServerGracefully(server, {
        onForceClose() {
          log("Force-destroying lingering connections");
        },
        onClosed() {
          log("Server closed");
        },
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

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}`;
      log(`Server listening at ${url}`);
      openBrowser(url);
    });
  });
}
