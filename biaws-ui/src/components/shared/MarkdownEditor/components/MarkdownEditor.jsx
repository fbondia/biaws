import { Check, Copy, Eye, FileText, Maximize2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { markdownToHtml } from "../model.js";
import { MarkdownPreview } from "./MarkdownPreview.jsx";

const MARKDOWN_TEXTAREA_MAX_HEIGHT = 420;

export function MarkdownEditor({
  value,
  onChange,
  allowFullscreen = true,
  fullscreen = false,
}) {
  const [mode, setMode] = useState("preview");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef(null);
  const copyResetTimerRef = useRef(null);

  useLayoutEffect(() => {
    if (mode === "text") resizeTextarea(textareaRef.current, fullscreen);
  }, [fullscreen, mode, value]);

  useEffect(() => {
    if (!isFullscreen) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setIsFullscreen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isFullscreen]);

  useEffect(() => () => window.clearTimeout(copyResetTimerRef.current), []);

  async function copyContent() {
    const markdown = String(value || "");

    if (mode === "preview") {
      const html = markdownToHtml(markdown);
      const plainText = htmlToPlainText(html);

      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      } else {
        await copyPlainText(plainText);
      }
    } else {
      await copyPlainText(markdown);
    }

    setCopied(true);
    window.clearTimeout(copyResetTimerRef.current);
    copyResetTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div
      className={
        allowFullscreen
          ? "markdownEditor"
          : "markdownEditor markdownEditorWithoutFullscreen"
      }
    >
      <div
        className="markdownEditorTabs"
        role="toolbar"
        aria-label="Ações do editor markdown"
      >
        <button
          aria-label="Editar texto"
          aria-pressed={mode === "text"}
          className={
            mode === "text"
              ? "markdownEditorTab activeMarkdownEditorTab"
              : "markdownEditorTab"
          }
          onClick={() => setMode("text")}
          title="Texto"
          type="button"
        >
          <FileText size={15} />
        </button>
        <button
          aria-label="Visualizar conteúdo"
          aria-pressed={mode === "preview"}
          className={
            mode === "preview"
              ? "markdownEditorTab activeMarkdownEditorTab"
              : "markdownEditorTab"
          }
          onClick={() => setMode("preview")}
          title="Visualização"
          type="button"
        >
          <Eye size={15} />
        </button>
        <button
          aria-label={copied ? "Conteúdo copiado" : "Copiar conteúdo"}
          className="markdownEditorTab"
          onClick={copyContent}
          title={
            copied
              ? "Copiado"
              : mode === "text"
                ? "Copiar Markdown"
                : "Copiar conteúdo formatado"
          }
          type="button"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
        {allowFullscreen ? (
          <button
            aria-label="Editar em tela cheia"
            className="markdownEditorTab"
            onClick={() => setIsFullscreen(true)}
            title="Editar em tela cheia"
            type="button"
          >
            <Maximize2 size={15} />
          </button>
        ) : null}
      </div>

      {mode === "text" ? (
        <textarea
          autoFocus={fullscreen}
          onChange={(event) => {
            resizeTextarea(event.currentTarget, fullscreen);
            onChange(event.target.value);
          }}
          ref={textareaRef}
          value={value}
        />
      ) : (
        <MarkdownPreview value={value} />
      )}

      {isFullscreen
        ? createPortal(
            <div className="dialogBackdrop markdownFullscreenBackdrop">
              <section
                aria-labelledby="markdownFullscreenTitle"
                aria-modal="true"
                className="markdownFullscreenDialog"
                role="dialog"
              >
                <header className="markdownFullscreenHeader">
                  <h3 id="markdownFullscreenTitle">Editar conteúdo</h3>
                  <button
                    aria-label="Fechar edição em tela cheia"
                    className="iconButton"
                    onClick={() => setIsFullscreen(false)}
                    title="Fechar"
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </header>
                <div className="markdownFullscreenBody">
                  <MarkdownEditor
                    allowFullscreen={false}
                    fullscreen
                    onChange={onChange}
                    value={value}
                  />
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function resizeTextarea(textarea, fullscreen) {
  if (!textarea) return;

  const maxHeight = fullscreen
    ? Math.max(window.innerHeight - 190, MARKDOWN_TEXTAREA_MAX_HEIGHT)
    : MARKDOWN_TEXTAREA_MAX_HEIGHT;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  textarea.style.overflowY =
    textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

async function copyPlainText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function htmlToPlainText(html) {
  return (
    new DOMParser().parseFromString(html, "text/html").body.textContent || ""
  );
}
