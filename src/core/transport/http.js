const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
export const CLOSE_TIMEOUT_MS = 5000;

export function buildJsonError(message, status = 400) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

export function parseRequestBody(req, res) {
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

export function closeServerGracefully(server, { timeoutMs = CLOSE_TIMEOUT_MS, onForceClose, onClosed } = {}) {
  const timer = setTimeout(() => {
    onForceClose?.();
    server.closeAllConnections?.();
  }, timeoutMs);

  server.close(() => {
    clearTimeout(timer);
    onClosed?.();
  });
}
