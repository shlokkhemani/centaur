import { execFile } from "node:child_process";
import { warn } from "../logger.js";

/**
 * Opens a URL in the default browser.
 *
 * Detects the current OS via `process.platform` and uses the appropriate
 * command: `open` on macOS, `xdg-open` on Linux, `start` on Windows.
 *
 * @param {string} url - The URL to open
 */
export function openBrowser(url) {
  let cmd;
  let args;

  switch (process.platform) {
    case "darwin":
      cmd = "open";
      args = [url];
      break;
    case "win32":
      cmd = "cmd";
      args = ["/c", "start", "", url];
      break;
    default:
      cmd = "xdg-open";
      args = [url];
      break;
  }

  execFile(cmd, args, (err) => {
    if (err) {
      warn(`Failed to open browser: ${err.message}`);
      warn(`Please open manually: ${url}`);
    }
  });
}
