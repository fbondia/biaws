const IMAGE_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const TEXT_EXTENSIONS = new Set([
  "csv",
  "ini",
  "json",
  "log",
  "properties",
  "sql",
  "txt",
  "xml",
  "yaml",
  "yml",
]);
const HTML_EXTENSIONS = new Set(["htm", "html"]);
const HTML_PREVIEW_CSP = [
  "default-src 'none'",
  "img-src data: blob:",
  "style-src 'unsafe-inline'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

function extension(filename) {
  return (
    String(filename || "")
      .toLowerCase()
      .split(".")
      .pop() || ""
  );
}

export function previewKind(file) {
  const contentType = String(file.contentType || "")
    .toLowerCase()
    .split(";")[0];
  const fileExtension = extension(file.filename);
  if (IMAGE_TYPES.has(contentType)) return "image";
  if (contentType === "application/pdf" || fileExtension === "pdf")
    return "pdf";
  if (fileExtension === "md" || fileExtension === "markdown") return "markdown";
  if (
    contentType === "text/html" ||
    contentType === "application/xhtml+xml" ||
    HTML_EXTENSIONS.has(fileExtension)
  )
    return "html";
  if (
    contentType.startsWith("text/") ||
    ["application/json", "application/xml"].includes(contentType) ||
    TEXT_EXTENSIONS.has(fileExtension)
  )
    return "text";
  return "";
}

export function htmlPreviewDocument(source) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_CSP}"></head><body>${source}</body></html>`;
}
