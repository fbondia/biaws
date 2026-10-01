import { resolveAttachmentImage } from "../attachmentImages.js";
import { parseInlineMarkdown, parseMarkdownBlocks, safeMarkdownHref, splitTableRow } from "../model.js";
import { MarkdownAttachmentImage } from "./MarkdownAttachmentImage.jsx";
import { MarkdownBlockViewer } from "./MarkdownBlockViewer.jsx";

export function MarkdownPreview({ value, attachments, onLoadAttachment }) {
  const blocks = markdownBlocks(value, { attachments, onLoadAttachment });

  if (!blocks.length) {
    return <div className="markdownPreview markdownPreviewEmpty">Conteúdo não informado.</div>;
  }

  return <div className="markdownPreview">{blocks}</div>;
}

function markdownBlocks(value, imageOptions) {
  return parseMarkdownBlocks(value).map((block, index) => (
    <MarkdownBlock block={block} imageOptions={imageOptions} key={`${block.type}-${index}`} />
  ));
}

function MarkdownBlock({ block, imageOptions }) {
  if (block.type === "code" && block.language === "mermaid")
    return <MarkdownBlockViewer source={block.text} type="mermaid" />;
  if (block.type === "code") return <MarkdownBlockViewer language={block.language} source={block.text} type="code" />;
  if (block.type === "heading") {
    const Tag = `h${block.level}`;
    return <Tag>{renderInlineMarkdown(block.text, imageOptions)}</Tag>;
  }
  if (block.type === "list") return <MarkdownList imageOptions={imageOptions} list={block.list} />;
  if (block.type === "horizontal-rule") return <hr />;
  if (block.type === "quote") return <blockquote>{renderMultilineInlineMarkdown(block.text, imageOptions)}</blockquote>;
  if (block.type === "table") return <MarkdownTable imageOptions={imageOptions} lines={block.lines} />;
  return <p>{renderInlineMarkdown(block.text, imageOptions)}</p>;
}

function renderMultilineInlineMarkdown(text, imageOptions) {
  return String(text || "")
    .split("\n")
    .map((line, index) => (
      <Fragment key={index}>
        {index ? <br /> : null}
        {renderInlineMarkdown(line, imageOptions)}
      </Fragment>
    ));
}

function MarkdownList({ list, imageOptions }) {
  const Tag = list.ordered ? "ol" : "ul";

  return (
    <Tag>
      {list.items.map((item, index) => (
        <li key={`${index}:${item.text}`}>
          {renderInlineMarkdown(item.text, imageOptions)}
          {item.children.map((child, childIndex) => (
            <MarkdownList imageOptions={imageOptions} key={`${childIndex}:${child.ordered}`} list={child} />
          ))}
        </li>
      ))}
    </Tag>
  );
}

function MarkdownTable({ lines, imageOptions }) {
  const header = splitTableRow(lines[0]);
  const body = lines.slice(2).map(splitTableRow);

  return (
    <div className="markdownTableWrap">
      <table>
        <thead>
          <tr>
            {header.map((cell, index) => (
              <th key={`${index}:${cell}`}>{renderInlineMarkdown(cell, imageOptions)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {header.map((_, cellIndex) => (
                <td key={cellIndex}>{renderInlineMarkdown(row[cellIndex] || "", imageOptions)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInlineMarkdown(text, { attachments, onLoadAttachment }) {
  return parseInlineMarkdown(text).map((token, index) => {
    if (token.type === "code") return <code key={index}>{token.text}</code>;
    if (token.type === "strong") return <strong key={index}>{token.text}</strong>;
    if (token.type === "emphasis") return <em key={index}>{token.text}</em>;
    if (token.type === "link")
      return (
        <a href={safeMarkdownHref(token.href)} key={index} rel="noreferrer" target="_blank">
          {token.text}
        </a>
      );
    if (token.type === "image" && onLoadAttachment) {
      const attachment = resolveAttachmentImage(token.reference, attachments);
      if (attachment)
        return (
          <MarkdownAttachmentImage
            alt={token.text}
            attachment={attachment}
            key={index}
            onLoadAttachment={onLoadAttachment}
          />
        );
    }
    return token.raw ?? token.text;
  });
}
import { Fragment } from "react";
