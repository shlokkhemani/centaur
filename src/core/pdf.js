import { buildPdfHtml } from "./html/pdf.js";
import { log } from "./logger.js";
import {
  resolveChromeExecutable,
  resolveMarkdownContent,
  resolvePdfOutputPath,
  stripLeadingTitleHeading,
} from "./documents.js";
import { renderMarkdownToHtml } from "./markdown.js";

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

  const markdown = stripLeadingTitleHeading(
    await resolveMarkdownContent({ content, filePath }),
    title
  );
  const outPath = resolvePdfOutputPath({ title, filePath, outputPath });
  let contentHtml = null;

  try {
    contentHtml = await renderMarkdownToHtml(markdown);
  } catch {}

  const html = buildPdfHtml({ title, content: markdown, contentHtml, subtitle });
  const executablePath = await resolveChromeExecutable();

  // Launch headless Chrome via puppeteer-core
  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Set content and wait for the page to finish loading
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });

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
