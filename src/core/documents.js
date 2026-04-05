import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_CONTENT_ERROR = "Either content or filePath must be provided";
const DEFAULT_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

export async function resolveMarkdownContent({ content, filePath }) {
  let markdown = content;

  if (!markdown && filePath) {
    markdown = await fs.readFile(filePath, "utf-8");
  }

  if (!markdown) {
    throw new Error(DEFAULT_CONTENT_ERROR);
  }

  return markdown;
}

export function stripLeadingTitleHeading(markdown, title) {
  const firstHeadingMatch = markdown.match(/^#\s+(.+)\n/);
  if (!firstHeadingMatch) {
    return markdown;
  }

  const headingText = firstHeadingMatch[1].trim();
  const clean = (value) =>
    value.replace(/\*\*/g, "").replace(/[—–-]+/g, " ").trim().toLowerCase();

  if (
    clean(headingText).includes(clean(title).slice(0, 20)) ||
    clean(title).includes(clean(headingText).slice(0, 20))
  ) {
    return markdown.slice(firstHeadingMatch[0].length);
  }

  return markdown;
}

export function resolvePdfOutputPath({ title, filePath, outputPath, cwd = process.cwd() }) {
  let outPath = outputPath;

  if (!outPath && filePath) {
    outPath = filePath.replace(/\.md$/i, ".pdf");
  }

  if (!outPath) {
    outPath = path.join(cwd, `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`);
  }

  return path.resolve(outPath);
}

export async function resolveChromeExecutable({ env = process.env } = {}) {
  let executablePath = null;

  for (const candidate of DEFAULT_CHROME_PATHS) {
    try {
      await fs.access(candidate);
      executablePath = candidate;
      break;
    } catch {}
  }

  if (env.CHROME_PATH) {
    return env.CHROME_PATH;
  }

  if (executablePath) {
    return executablePath;
  }

  throw new Error("Chrome not found. Install Google Chrome or set CHROME_PATH env var.");
}
