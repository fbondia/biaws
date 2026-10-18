// Catalog entries are stored separately so each description stays editable.
// Flatten them only when exporting or copying into a different document type.
export function documentMarkdown(document = {}) {
  const markdown = document.markdown || "";
  if (document.documentType !== "catalog") return markdown;
  const items = document.details?.items || [];
  return [
    markdown,
    ...items.map((item) => {
      const title = item.title.replaceAll(/\s+/gu, " ").replaceAll(/[\\`*_{}\[\]()<>#!|]/gu, "\\$&");
      return `## ${title}\n\n${item.description}`;
    }),
  ]
    .filter(Boolean)
    .join("\n\n");
}
