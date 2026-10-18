// Catalog entries are stored separately so each description stays editable.
// Flatten them only when exporting or copying into a different document type.
import { catalogChildren } from "./catalogTree.js";

export function escapeMarkdownTitle(title) {
  return String(title || "")
    .replaceAll(/\s+/gu, " ")
    .replaceAll(/[\\`*_{}\[\]()<>#!|]/gu, "\\$&");
}

export function catalogMarkdown(items = [], parentId = "", level = 2) {
  return catalogChildren(items, parentId)
    .map((item) =>
      [
        `${"#".repeat(Math.min(level, 6))} ${escapeMarkdownTitle(item.title)}\n\n${item.description}`,
        item.id ? catalogMarkdown(items, item.id, level + 1) : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    )
    .join("\n\n");
}

export function documentMarkdown(document = {}) {
  const markdown = document.markdown || "";
  if (document.documentType !== "catalog") return markdown;
  const items = document.details?.items || [];
  return [markdown, catalogMarkdown(items)].filter(Boolean).join("\n\n");
}
