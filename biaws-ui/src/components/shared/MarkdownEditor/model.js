export function markdownToHtml(value) {
  return parseMarkdownBlocks(value).map(markdownBlockToHtml).join("\n");
}

export function parseMarkdownBlocks(value) {
  const lines = String(value || "").split(/\r?\n/u);
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
    } else {
      const block = readMarkdownBlock(lines, index);
      blocks.push(block.value);
      index = block.nextIndex;
    }
  }

  return blocks;
}

function readMarkdownBlock(lines, index) {
  const line = lines[index];
  if (line.trim().startsWith("```")) return readCodeBlock(lines, index);

  const heading = line.match(/^(#{1,6})\s+(.+)$/u);
  if (heading) {
    return {
      value: {
        type: "heading",
        level: Math.min(heading[1].length, 6),
        text: heading[2],
      },
      nextIndex: index + 1,
    };
  }
  if (isMarkdownListLine(line)) {
    const list = parseMarkdownList(lines, index);
    return { value: { type: "list", list }, nextIndex: list.nextIndex };
  }
  if (isMarkdownHorizontalRule(line)) {
    return { value: { type: "horizontal-rule" }, nextIndex: index + 1 };
  }
  if (/^\s*>\s?/u.test(line)) return readQuoteBlock(lines, index);
  if (isMarkdownTableStart(lines, index)) return readTableBlock(lines, index);
  return readParagraphBlock(lines, index);
}

function readCodeBlock(lines, startIndex) {
  const content = [];
  const language = lines[startIndex].trim().slice(3).trim().split(/\s+/u)[0];
  let index = startIndex + 1;
  while (index < lines.length && !lines[index].trim().startsWith("```")) {
    content.push(lines[index]);
    index += 1;
  }
  return {
    value: {
      type: "code",
      language: String(language || "").toLowerCase(),
      text: content.join("\n"),
    },
    nextIndex: index + 1,
  };
}

function readQuoteBlock(lines, startIndex) {
  const content = [];
  let index = startIndex;
  while (index < lines.length && /^\s*>\s?/u.test(lines[index])) {
    content.push(lines[index].replace(/^\s*>\s?/u, ""));
    index += 1;
  }
  return {
    value: { type: "quote", text: content.join("\n") },
    nextIndex: index,
  };
}

function readTableBlock(lines, startIndex) {
  const content = [];
  let index = startIndex;
  while (index < lines.length && isMarkdownTableLine(lines[index])) {
    content.push(lines[index]);
    index += 1;
  }
  return { value: { type: "table", lines: content }, nextIndex: index };
}

function isParagraphBoundary(lines, index) {
  const line = lines[index];
  return (
    !line.trim() ||
    line.trim().startsWith("```") ||
    /^(#{1,6})\s+(.+)$/u.test(line) ||
    isMarkdownListLine(line) ||
    isMarkdownHorizontalRule(line) ||
    /^\s*>\s?/u.test(line) ||
    isMarkdownTableStart(lines, index)
  );
}

function readParagraphBlock(lines, startIndex) {
  const content = [];
  let index = startIndex;
  while (index < lines.length && !isParagraphBoundary(lines, index)) {
    content.push(lines[index]);
    index += 1;
  }
  return {
    value: { type: "paragraph", text: content.join(" ") },
    nextIndex: index,
  };
}

function markdownBlockToHtml(block) {
  if (block.type === "code")
    return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
  if (block.type === "heading") {
    const level = Math.min(block.level + 2, 6);
    return `<h${level}>${renderInlineMarkdownHtml(block.text)}</h${level}>`;
  }
  if (block.type === "list") return markdownListToHtml(block.list);
  if (block.type === "horizontal-rule") return "<hr>";
  if (block.type === "quote")
    return `<blockquote>${block.text
      .split("\n")
      .map(renderInlineMarkdownHtml)
      .join("<br>")}</blockquote>`;
  if (block.type === "table") return markdownTableToHtml(block.lines);
  return `<p>${renderInlineMarkdownHtml(block.text)}</p>`;
}

export function isMarkdownListLine(line) {
  return /^(\s*)([-*]|\d+\.)\s+(.+)$/u.test(String(line || ""));
}

export function markdownListItem(line) {
  const match = String(line || "").match(/^(\s*)([-*]|\d+\.)\s+(.+)$/u);
  if (!match) return null;

  return {
    indent: match[1].replace(/\t/gu, "  ").length,
    ordered: /^\d/u.test(match[2]),
    text: match[3],
  };
}

export function parseMarkdownList(
  lines,
  startIndex,
  baseIndent = markdownListItem(lines[startIndex])?.indent ?? 0,
) {
  const firstItem = markdownListItem(lines[startIndex]);
  const list = {
    ordered: firstItem?.ordered || false,
    items: [],
    nextIndex: startIndex,
  };
  let index = startIndex;

  while (index < lines.length) {
    const item = markdownListItem(lines[index]);
    if (!item || item.indent < baseIndent) break;

    if (item.indent > baseIndent) {
      if (!list.items.length) break;
      const child = parseMarkdownList(lines, index, item.indent);
      list.items[list.items.length - 1].children.push(child);
      index = child.nextIndex;
      continue;
    }

    if (item.ordered !== list.ordered) break;
    list.items.push({ text: item.text, children: [] });
    index += 1;
  }

  list.nextIndex = index;
  return list;
}

export function markdownListToHtml(list) {
  const tag = list.ordered ? "ol" : "ul";
  const items = list.items
    .map(
      (item) =>
        `<li>${renderInlineMarkdownHtml(item.text)}${item.children.map(markdownListToHtml).join("")}</li>`,
    )
    .join("");
  return `<${tag}>${items}</${tag}>`;
}

export function isMarkdownHorizontalRule(line) {
  return /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/u.test(
    String(line || ""),
  );
}

export function isMarkdownTableStart(lines, index) {
  return (
    isMarkdownTableLine(lines[index]) &&
    isMarkdownTableSeparator(lines[index + 1])
  );
}

export function isMarkdownTableLine(line) {
  const trimmed = String(line || "").trim();
  return (
    trimmed.includes("|") &&
    trimmed.split("|").filter((cell) => cell.trim()).length >= 2
  );
}

export function isMarkdownTableSeparator(line) {
  if (!isMarkdownTableLine(line)) return false;

  return splitTableRow(line).every((cell) => /^:?-{3,}:?$/u.test(cell.trim()));
}

export function splitTableRow(line) {
  return String(line || "")
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function markdownTableToHtml(lines) {
  const header = splitTableRow(lines[0]);
  const body = lines.slice(2).map(splitTableRow);

  return [
    "<table>",
    "<thead>",
    `<tr>${header.map((cell) => `<th>${renderInlineMarkdownHtml(cell)}</th>`).join("")}</tr>`,
    "</thead>",
    "<tbody>",
    ...body.map(
      (row) =>
        `<tr>${header.map((_, cellIndex) => `<td>${renderInlineMarkdownHtml(row[cellIndex] || "")}</td>`).join("")}</tr>`,
    ),
    "</tbody>",
    "</table>",
  ].join("");
}

export function renderInlineMarkdownHtml(text) {
  let html = "";
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/gu;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor)
      html += escapeHtml(text.slice(cursor, match.index));

    const token = match[0];

    if (token.startsWith("`")) {
      html += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
    } else if (token.startsWith("**")) {
      html += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
    } else if (token.startsWith("*")) {
      html += `<em>${escapeHtml(token.slice(1, -1))}</em>`;
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/u);
      html += `<a href="${escapeHtmlAttribute(safeMarkdownHref(link[2]))}">${escapeHtml(link[1])}</a>`;
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) html += escapeHtml(text.slice(cursor));

  return html;
}

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

export function escapeHtmlAttribute(value) {
  return escapeHtml(value).replace(/`/gu, "&#96;");
}

export function safeMarkdownHref(value) {
  const href = String(value || "").trim();

  if (/^(https?:|mailto:|\/|#)/iu.test(href)) return href;

  return "#";
}
