import { entityUrl } from "../../../navigation/model.js";

export function documentLinkMarkdown(document, workspaceId) {
  if (!workspaceId || !document?.id || (document.workspaceId && document.workspaceId !== workspaceId)) {
    throw new Error("Documento indisponível no workspace atual.");
  }
  const title =
    String(document.title || document.identifier || "Documento")
      .replace(/\s+/gu, " ")
      .trim() || "Documento";
  const label = title.replace(/[\\[\]]/gu, "\\$&");
  const url = entityUrl("document", document, { view: "documents", selections: {}, workspaceId })
    .replaceAll("(", "%28")
    .replaceAll(")", "%29");
  return `[${label}](${url})`;
}

export function insertMarkdownReference(value, reference, selection = {}) {
  const text = String(value || "");
  const start = Math.max(0, Math.min(text.length, selection.start ?? text.length));
  const end = Math.max(start, Math.min(text.length, selection.end ?? start));
  return { value: `${text.slice(0, start)}${reference}${text.slice(end)}`, cursor: start + reference.length };
}
