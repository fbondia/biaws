import { Check, Copy, Maximize2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MermaidDiagram } from "./MermaidDiagram.jsx";

export function MarkdownBlockViewer({ language, source, type }) {
  const dialogTitleId = useId();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const copyResetTimerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => () => window.clearTimeout(copyResetTimerRef.current), []);

  async function copyCode() {
    await copyPlainText(source);
    setCopied(true);
    window.clearTimeout(copyResetTimerRef.current);
    copyResetTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  const isMermaid = type === "mermaid";
  const title = isMermaid ? "Diagrama Mermaid" : "Bloco de código";

  return (
    <div
      className={`markdownExpandableBlock ${
        isMermaid ? "markdownExpandableMermaid" : "markdownExpandableCode"
      }`}
    >
      <button
        aria-label={`Abrir ${title.toLocaleLowerCase("pt-BR")} em tela cheia`}
        className="markdownBlockExpandButton"
        onClick={() => setOpen(true)}
        title="Abrir em tela cheia"
        type="button"
      >
        <Maximize2 size={16} />
      </button>

      <MarkdownBlockContent language={language} source={source} type={type} />

      {open
        ? createPortal(
            <div
              className="dialogBackdrop markdownBlockDialogBackdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <section
                aria-labelledby={dialogTitleId}
                aria-modal="true"
                className="markdownBlockDialog"
                role="dialog"
              >
                <header className="markdownBlockDialogHeader">
                  <div>
                    <h3 id={dialogTitleId}>{title}</h3>
                    {!isMermaid && language ? <span>{language}</span> : null}
                  </div>
                  <div className="markdownBlockDialogActions">
                    {!isMermaid ? (
                      <button
                        aria-label={copied ? "Código copiado" : "Copiar código"}
                        className="secondaryButton"
                        onClick={copyCode}
                        title={copied ? "Copiado" : "Copiar código"}
                        type="button"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                    ) : null}
                    <button
                      aria-label={`Fechar ${title.toLocaleLowerCase("pt-BR")}`}
                      className="iconButton"
                      onClick={() => setOpen(false)}
                      title="Fechar"
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </header>
                <div className="markdownBlockDialogBody">
                  <MarkdownBlockContent
                    language={language}
                    source={source}
                    type={type}
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

function MarkdownBlockContent({ language, source, type }) {
  if (type === "mermaid") return <MermaidDiagram definition={source} />;

  return (
    <pre>
      <code className={language ? `language-${language}` : undefined}>
        {source}
      </code>
    </pre>
  );
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
