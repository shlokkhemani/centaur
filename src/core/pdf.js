import fs from "node:fs/promises";
import path from "node:path";
import { buildPdfHtml } from "./html/pdf.js";
import { log } from "./logger.js";

/**
 * Converts a markdown file (or raw content) to a beautiful PDF.
 *
 * Uses puppeteer-core + system Chrome. Same visual language as the
 * review tool but print-optimised — no interactivity.
 *
 * @param {{ title: string, content?: string, filePath?: string, outputPath?: string, subtitle?: string }} config
 * @returns {Promise<string>} Absolute path to the generated PDF
 */
export async function markdownToPdf({ title, content, filePath, outputPath, subtitle }) {
  log(`markdownToPdf: "${title}"`);

  let markdown = content;
  if (!markdown && filePath) {
    markdown = await fs.readFile(filePath, "utf-8");
  }
  if (!markdown) {
    throw new Error("Either content or filePath must be provided");
  }

  // Strip the first markdown heading if it matches the title (avoid double heading)
  const firstHeadingMatch = markdown.match(/^#\s+(.+)\n/);
  if (firstHeadingMatch) {
    const headingText = firstHeadingMatch[1].trim();
    // Fuzzy match — strip bold markers and compare
    const clean = (s) => s.replace(/\*\*/g, "").replace(/[—–-]+/g, " ").trim().toLowerCase();
    if (clean(headingText).includes(clean(title).slice(0, 20)) || clean(title).includes(clean(headingText).slice(0, 20))) {
      markdown = markdown.slice(firstHeadingMatch[0].length);
    }
  }

  // Determine output path
  let outPath = outputPath;
  if (!outPath && filePath) {
    outPath = filePath.replace(/\.md$/i, ".pdf");
  }
  if (!outPath) {
    outPath = path.join(process.cwd(), `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`);
  }
  outPath = path.resolve(outPath);

  // Build HTML
  const html = buildPdfHtml({ title, content: markdown, subtitle });

  // Find Chrome
  const chromePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];

  let executablePath = null;
  for (const p of chromePaths) {
    try {
      await fs.access(p);
      executablePath = p;
      break;
    } catch {}
  }

  if (!executablePath) {
    throw new Error("Chrome not found. Install Google Chrome or set CHROME_PATH env var.");
  }

  // Override with env var if set
  if (process.env.CHROME_PATH) {
    executablePath = process.env.CHROME_PATH;
  }

  // Launch headless Chrome via puppeteer-core
  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Set content and wait for marked.js to render
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });

    // Small delay to ensure marked.js has parsed
    await new Promise((r) => setTimeout(r, 500));

    // Generate PDF
    await page.pdf({
      path: outPath,
      format: "A4",
      margin: { top: "20mm", right: "18mm", bottom: "20mm", left: "18mm" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size:8px; font-family:Menlo,monospace; color:#999; width:100%; text-align:center; padding:0 20mm;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>`,
    });

    log(`PDF written: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}
