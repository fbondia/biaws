import { ArrowDown, ArrowUp, Check, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  normalizeSpecificationSectionTitle,
  REQUEST_SPECIFICATION_SECTION_TITLES,
} from "../requestUtils.js";
import {
  MarkdownEditor,
  MarkdownPreview,
  markdownToHtml,
} from "../../shared/MarkdownEditor/index.jsx";

export function RequestSpecificationTab({
  request,
  isEditing,
  onAddSpecificationSection,
  onAddMissingSpecificationSections,
  onMoveSpecificationSection,
  onRemoveSpecificationSection,
  onUpdateSpecificationSection,
}) {
  const [copiedSectionId, setCopiedSectionId] = useState("");
  const sections = request.specification?.sections || [];
  const existingTitles = new Set(
    sections.map((section) =>
      normalizeSpecificationSectionTitle(section.title),
    ),
  );
  const missingDefaultCount = REQUEST_SPECIFICATION_SECTION_TITLES.filter(
    (title) => !existingTitles.has(normalizeSpecificationSectionTitle(title)),
  ).length;

  return (
    <section className="requestPanel">
      <div className="panelHeader">
        <div>
          <h3>Especificação</h3>
          <span>{sections.length} seções da ET</span>
        </div>
        {isEditing ? (
          <div className="requestSpecificationHeaderActions">
            {missingDefaultCount ? (
              <button
                className="secondaryButton"
                onClick={onAddMissingSpecificationSections}
                type="button"
              >
                <Plus size={16} />
                Seções padrão
              </button>
            ) : null}
            <button
              className="secondaryButton"
              onClick={onAddSpecificationSection}
              type="button"
            >
              <Plus size={16} />
              Seção
            </button>
          </div>
        ) : null}
      </div>

      {sections.length ? (
        <div className="requestSpecificationSections">
          {sections.map((section, index) => (
            <article className="requestSpecificationSection" key={section.id}>
              {isEditing ? (
                <>
                  <div className="requestSpecificationSectionHeader">
                    <label className="field">
                      <span>Título da seção</span>
                      <input
                        onChange={(event) =>
                          onUpdateSpecificationSection(
                            section.id,
                            "title",
                            event.target.value,
                          )
                        }
                        type="text"
                        value={section.title}
                      />
                    </label>
                    <div className="requestSpecificationSectionActions">
                      <CopySectionButton
                        copied={copiedSectionId === section.id}
                        onCopy={() =>
                          copySectionContent(section, setCopiedSectionId)
                        }
                      />
                      <button
                        className="iconButton"
                        disabled={index === 0}
                        onClick={() =>
                          onMoveSpecificationSection(section.id, -1)
                        }
                        title="Mover para cima"
                        type="button"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        className="iconButton"
                        disabled={index === sections.length - 1}
                        onClick={() =>
                          onMoveSpecificationSection(section.id, 1)
                        }
                        title="Mover para baixo"
                        type="button"
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        className="iconButton dangerIconButton"
                        onClick={() => onRemoveSpecificationSection(section.id)}
                        title="Remover seção"
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <label className="field requestSpecificationContentField">
                    <MarkdownEditor
                      onChange={(value) =>
                        onUpdateSpecificationSection(
                          section.id,
                          "content",
                          value,
                        )
                      }
                      value={section.content}
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="requestSpecificationReadHeader">
                    <h4>{section.title}</h4>
                    <CopySectionButton
                      copied={copiedSectionId === section.id}
                      onCopy={() =>
                        copySectionContent(section, setCopiedSectionId)
                      }
                    />
                  </div>
                  <MarkdownPreview value={section.content} />
                </>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="emptyState compactEmpty">
          Nenhuma seção de especificação cadastrada.
        </div>
      )}
    </section>
  );
}

function CopySectionButton({ copied, onCopy }) {
  return (
    <button
      className="iconButton"
      onClick={onCopy}
      title={copied ? "Copiado" : "Copiar seção com formatação"}
      type="button"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

async function copySectionContent(section, setCopiedSectionId) {
  const content = section.content || "";

  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([markdownToHtml(content)], {
            type: "text/html",
          }),
          "text/plain": new Blob([content], { type: "text/plain" }),
        }),
      ]);
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
    } else {
      copyTextWithFallback(content);
    }

    setCopiedSectionId(section.id);
    window.setTimeout(
      () =>
        setCopiedSectionId((current) =>
          current === section.id ? "" : current,
        ),
      1800,
    );
  } catch {
    copyTextWithFallback(content);
    setCopiedSectionId(section.id);
    window.setTimeout(
      () =>
        setCopiedSectionId((current) =>
          current === section.id ? "" : current,
        ),
      1800,
    );
  }
}

function copyTextWithFallback(content) {
  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
