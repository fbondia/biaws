import { useRef } from "react";

function safeFilename(title, extension) {
  const base = String(title || "documento")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLocaleLowerCase("pt-BR");
  return `${base || "documento"}.${extension}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function printableDocumentHtml(draft, renderedMarkdown) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(draft.title)}</title>
    <style>
      @page { size: A4; margin: 18mm 17mm 20mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #20242b; font: 11pt/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      header { margin-bottom: 22px; border-bottom: 1px solid #d9dee7; padding-bottom: 14px; }
      h1 { margin: 0 0 7px; font-size: 22pt; line-height: 1.2; }
      header p { margin: 0; color: #5d6675; font-size: 10pt; }
      h2 { margin: 22px 0 8px; font-size: 16pt; line-height: 1.3; break-after: avoid; }
      h3, h4 { margin: 18px 0 7px; line-height: 1.35; break-after: avoid; }
      p, ul, ol, blockquote, pre, table { margin: 0 0 12px; }
      img, svg { max-width: 100%; height: auto; break-inside: avoid; }
      pre { overflow-wrap: anywhere; border: 1px solid #d9dee7; border-radius: 6px; background: #f6f8fb; padding: 10px; white-space: pre-wrap; }
      code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 9pt; }
      :not(pre) > code { border-radius: 3px; background: #f1f3f6; padding: 1px 4px; }
      blockquote { border-left: 3px solid #2d6cdf; color: #4c5666; padding-left: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
      th, td { border: 1px solid #d9dee7; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #f3f5f8; }
      a { color: #1e58b0; text-decoration: none; }
      .markdownPreview { min-height: 0; border: 0; background: transparent; padding: 0; }
    </style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(draft.title)}</h1>
      <p>${escapeHtml(draft.summary)}</p>
    </header>
    <main>${renderedMarkdown}</main>
  </body>
</html>`;
}

function downloadBlob(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function useDocumentExports(draft) {
  const contentRef = useRef(null);

  function exportMarkdown() {
    downloadBlob(
      draft.markdown,
      "text/markdown;charset=utf-8",
      safeFilename(draft.title, "md"),
    );
  }

  function exportPdf() {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.border = "0";
    frame.onload = () => {
      frame.contentWindow.document.title = safeFilename(draft.title, "pdf");
      frame.contentWindow.focus();
      frame.contentWindow.print();
      frame.contentWindow.addEventListener("afterprint", () => frame.remove(), {
        once: true,
      });
      window.setTimeout(() => frame.remove(), 60_000);
    };
    frame.srcdoc = printableDocumentHtml(
      draft,
      contentRef.current?.innerHTML || "",
    );
    document.body.append(frame);
  }

  return { contentRef, exportMarkdown, exportPdf };
}
