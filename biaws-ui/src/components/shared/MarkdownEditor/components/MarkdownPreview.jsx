import {
  parseMarkdownBlocks,
  safeMarkdownHref,
  splitTableRow,
} from "../model.js";
import { MermaidDiagram } from "./MermaidDiagram.jsx";

export function MarkdownPreview({ value }) {
  const blocks = markdownBlocks(value);

  if (!blocks.length) {
    return (
      <div className="markdownPreview markdownPreviewEmpty">
        Conteúdo não informado.
      </div>
    );
  }

  return <div className="markdownPreview">{blocks}</div>;
}

function markdownBlocks(value) {
  return parseMarkdownBlocks(value).map((block, index) => (
    <MarkdownBlock block={block} key={`${block.type}-${index}`} />
  ));
}

function MarkdownBlock({ block }) {
  if (block.type === "code" && block.language === "mermaid")
    return <MermaidDiagram definition={block.text} />;
  if (block.type === "code")
    return (
      <pre>
        <code>{block.text}</code>
      </pre>
    );
  if (block.type === "heading") {
    const Tag = `h${block.level}`;
    return <Tag>{renderInlineMarkdown(block.text)}</Tag>;
  }
  if (block.type === "list") return <MarkdownList list={block.list} />;
  if (block.type === "horizontal-rule") return <hr />;
  if (block.type === "quote")
    return <blockquote>{renderMultilineInlineMarkdown(block.text)}</blockquote>;
  if (block.type === "table") return <MarkdownTable lines={block.lines} />;
  return <p>{renderInlineMarkdown(block.text)}</p>;
}

function renderMultilineInlineMarkdown(text) {
  return String(text || "")
    .split("\n")
    .flatMap((line, index) => [
      ...(index ? [<br key={`break-${index}`} />] : []),
      ...renderInlineMarkdown(line),
    ]);
}

function MarkdownList({ list }) {
  const Tag = list.ordered ? "ol" : "ul";

  return (
    <Tag>
      {list.items.map((item, index) => (
        <li key={`${index}:${item.text}`}>
          {renderInlineMarkdown(item.text)}
          {item.children.map((child, childIndex) => (
            <MarkdownList key={`${childIndex}:${child.ordered}`} list={child} />
          ))}
        </li>
      ))}
    </Tag>
  );
}

function MarkdownTable({ lines }) {
  const header = splitTableRow(lines[0]);
  const body = lines.slice(2).map(splitTableRow);

  return (
    <div className="markdownTableWrap">
      <table>
        <thead>
          <tr>
            {header.map((cell, index) => (
              <th key={`${index}:${cell}`}>{renderInlineMarkdown(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {header.map((_, cellIndex) => (
                <td key={cellIndex}>
                  {renderInlineMarkdown(row[cellIndex] || "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInlineMarkdown(text) {
  const tokens = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/gu;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) tokens.push(text.slice(cursor, match.index));

    const token = match[0];
    const key = `${match.index}:${token}`;

    if (token.startsWith("`")) {
      tokens.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      tokens.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      tokens.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/u);
      tokens.push(
        <a
          href={safeMarkdownHref(link[2])}
          key={key}
          rel="noreferrer"
          target="_blank"
        >
          {link[1]}
        </a>,
      );
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) tokens.push(text.slice(cursor));

  return tokens;
}
