import { catalogMarkdown, escapeMarkdownTitle } from "../../../../shared/documentContent.js";
import type { KnowledgeDocument } from "../../types/documents.js";
import { documentTypeConfig } from "./types.js";
import { httpError } from "./support.js";

const detailLabels: Record<string, string> = {
  ruleCode: "Código da regra",
  effectiveFrom: "Vigente desde",
  decidedAt: "Data da decisão",
  scope: "Escopo",
  enforcement: "Força da diretriz",
  maturity: "Maturidade",
  referenceKind: "Natureza da referência",
};

export function conversionMarkdown(document: KnowledgeDocument, additionalData: unknown) {
  if (additionalData !== "discard" && additionalData !== "append") {
    throw httpError(422, "INVALID_DOCUMENT_CONVERSION", "Escolha descartar ou incorporar os dados adicionais");
  }
  const markdown = document.markdown || "";
  if (additionalData === "discard") return markdown;
  const details = document.details || {};
  const extra =
    document.documentType === "catalog"
      ? catalogMarkdown(Array.isArray(details.items) ? details.items : [], "", 3)
      : Object.entries(details)
          .filter(([, value]) => value !== "" && value != null)
          .map(
            ([key, value]) =>
              `- **${detailLabels[key] || escapeMarkdownTitle(key)}:** ${escapeMarkdownTitle(typeof value === "object" ? JSON.stringify(value) : String(value))}`,
          )
          .join("\n");
  if (!extra) return markdown;
  return [markdown, `---\n\n## Dados adicionais — ${documentTypeConfig(document.documentType || "").label}\n\n${extra}`]
    .filter(Boolean)
    .join("\n\n");
}

export function documentConversionPayload(current: KnowledgeDocument, options: Record<string, unknown>) {
  const targetType = String(options.targetType || "");
  const target = documentTypeConfig(targetType);
  const source = documentTypeConfig(current.documentType || "");
  if (current.status === "archived" || targetType === current.documentType) {
    throw httpError(422, "INVALID_DOCUMENT_CONVERSION", "Escolha outro tipo para um documento não arquivado");
  }
  const applicationId = options.applicationId === undefined ? current.applicationId : options.applicationId;
  const affectedComponentIds = options.affectedComponentIds ?? current.affectedComponentIds ?? [];
  const details =
    targetType === "guideline"
      ? {
          scope: !applicationId
            ? "workspace"
            : Array.isArray(affectedComponentIds) && affectedComponentIds.length
              ? "component"
              : "application",
        }
      : {};
  const status = source.currentStatuses.includes(current.status || "")
    ? target.currentStatuses[0]
    : target.statuses.includes(current.status || "")
      ? current.status
      : target.defaultStatus;
  const markdown = conversionMarkdown(current, options.additionalData);
  return {
    documentType: targetType,
    details,
    status,
    applicationId: applicationId || null,
    affectedComponentIds,
    markdown: markdown || (targetType === "catalog" ? "" : `# ${escapeMarkdownTitle(current.title)}`),
    changeSummary: `Tipo alterado de ${source.label} para ${target.label}; dados adicionais ${options.additionalData === "append" ? "incorporados ao Markdown" : "descartados"}`,
  };
}

export function incorporatedDocumentItem(current: KnowledgeDocument, additionalData: unknown) {
  const original = `/documents/${encodeURIComponent(current.id || "")}?workspaceId=${encodeURIComponent(String(current.workspaceId || ""))}`;
  const content = conversionMarkdown(current, additionalData).replaceAll(
    /!?\[([^\]]*)\]\(attachment:[^)]+\)/gu,
    `[$1](${original})`,
  );
  return {
    id: `document-${current.id}`,
    title: current.title || "Documento",
    description: [content || current.summary || current.title, `[Documento original](${original})`]
      .filter(Boolean)
      .join("\n\n"),
  };
}
