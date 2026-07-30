import { Download, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { MarkdownPreview } from "./MarkdownEditor/index.jsx";

const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024;
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

function extension(filename) {
  return (
    String(filename || "")
      .toLowerCase()
      .split(".")
      .pop() || ""
  );
}

function previewKind(file) {
  const contentType = String(file.contentType || "")
    .toLowerCase()
    .split(";")[0];
  const fileExtension = extension(file.filename);
  if (IMAGE_TYPES.has(contentType)) return "image";
  if (contentType === "application/pdf" || fileExtension === "pdf")
    return "pdf";
  if (fileExtension === "md" || fileExtension === "markdown") return "markdown";
  if (
    contentType.startsWith("text/") ||
    ["application/json", "application/xml"].includes(contentType) ||
    TEXT_EXTENSIONS.has(fileExtension)
  )
    return "text";
  return "";
}

export function canPreviewFile(file) {
  return Boolean(previewKind(file));
}

export function FilePreview({
  blob,
  error,
  file,
  loading,
  onClose,
  onDownload,
}) {
  const [text, setText] = useState("");
  const [textError, setTextError] = useState("");
  const kind = previewKind(file);
  const objectUrl = useMemo(
    () =>
      blob && ["image", "pdf"].includes(kind) ? URL.createObjectURL(blob) : "",
    [blob, kind],
  );

  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );

  useEffect(() => {
    let active = true;
    setText("");
    setTextError("");
    if (!blob || !["text", "markdown"].includes(kind)) return () => {};
    if (blob.size > TEXT_PREVIEW_LIMIT) {
      setTextError(
        "O arquivo textual excede o limite de 2 MB para visualização.",
      );
      return () => {};
    }
    blob
      .text()
      .then((value) => {
        if (!active) return;
        if (extension(file.filename) === "json") {
          try {
            setText(JSON.stringify(JSON.parse(value), null, 2));
            return;
          } catch {
            // Invalid JSON is still useful as plain text.
          }
        }
        setText(value);
      })
      .catch((readError) => active && setTextError(readError.message));
    return () => {
      active = false;
    };
  }, [blob, file.filename, kind]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div
      className="dialogBackdrop filePreviewBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby="filePreviewTitle"
        aria-modal="true"
        className="filePreviewDialog"
        role="dialog"
      >
        <header className="filePreviewHeader">
          <div>
            <span>Visualização do arquivo</span>
            <h3 id="filePreviewTitle">{file.filename || "anexo"}</h3>
          </div>
          <div>
            <button
              className="secondaryButton"
              disabled={loading}
              onClick={onDownload}
              type="button"
            >
              <Download size={16} /> Baixar
            </button>
            <button
              aria-label="Fechar visualização"
              className="iconButton"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="filePreviewBody">
          {loading ? (
            <div className="loadingLine">Carregando arquivo...</div>
          ) : null}
          {error || textError ? (
            <div className="errorBox">{error || textError}</div>
          ) : null}
          {!loading && !error && blob && kind === "image" ? (
            <img alt={file.filename || "Imagem"} src={objectUrl} />
          ) : null}
          {!loading && !error && blob && kind === "pdf" ? (
            <iframe src={objectUrl} title={file.filename || "PDF"} />
          ) : null}
          {!loading && !error && blob && kind === "markdown" ? (
            <MarkdownPreview value={text} />
          ) : null}
          {!loading && !error && blob && kind === "text" ? (
            <pre>{text}</pre>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}
