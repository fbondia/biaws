import crypto from "crypto";
import { readFileSync } from "fs";
import { simpleParser } from "mailparser";
import { compileEmailSanitizationConfig } from "./emailSanitization.js";
import { detectIssueTypeFromSubject } from "./issueTypeDetection.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanupSubject(subject, config) {
  let cleaned = String(subject || "Sem assunto").trim();
  let prefixFound = true;

  while (prefixFound) {
    prefixFound = false;

    for (const prefix of config.subjectPrefixes) {
      const separator = prefix.startsWith("[") ? "[:\\s-]*" : "[:\\]\\s-]+";
      const regex = new RegExp(`^\\s*${escapeRegex(prefix)}${separator}`, "iu");
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, "").trim();
        prefixFound = true;
        break;
      }
    }
  }

  return cleaned || "Sem assunto";
}

function cleanupGarbage(text, config) {
  let cleaned = String(text || "");

  for (const rule of config.bodyRules) {
    if (rule.enabled) cleaned = cleaned.replace(rule.regex, "").trim();
  }

  if (config.options.collapseBlankLines) {
    cleaned = cleaned.replace(/(\r?\n){3,}/gu, "\n\n");
  }
  if (config.options.trimLineEndings) {
    cleaned = cleaned.replace(/[ \t]+\n/gu, "\n");
  }
  return cleaned.trim();
}

function splitMailBody(text, config) {
  const regexSeparator = config.threadSeparatorRegex;
  if (!regexSeparator) return [String(text || "").trim()].filter(Boolean);
  const indexes = [];
  let match;

  while ((match = regexSeparator.exec(text)) !== null) {
    indexes.push(match.index);
  }

  if (!indexes.length) {
    return [text.trim()].filter(Boolean);
  }

  const blocks = indexes.map((start, index) => {
    const end = indexes[index + 1] || text.length;
    return text.slice(start, end).trim();
  });
  const first = text.slice(0, indexes[0]).trim();

  return first ? [first, ...blocks] : blocks;
}

function extractHeaders(text) {
  const lines = String(text || "").split(/\r?\n/u);
  const bodyStartIndex = lines.findIndex((line, index) => {
    return line.trim() === "" || index > 50;
  });
  const headerEnd = bodyStartIndex >= 0 ? bodyStartIndex : 5;
  const headerLines = lines.slice(0, headerEnd);
  const headers = {};

  for (const line of headerLines) {
    const [rawKey, ...rest] = line.split(":");
    if (!rest.length) continue;

    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key.startsWith("from") || key.startsWith("de")) {
      headers.from = value;
    } else if (key.startsWith("to") || key.startsWith("para")) {
      headers.to = value;
    } else if (key.startsWith("cc")) {
      headers.cc = value;
    } else if (
      key.startsWith("sent") ||
      key.startsWith("enviada em") ||
      key.startsWith("enviado")
    ) {
      headers.date = value;
    }
  }

  const bodyStart = bodyStartIndex === 1 ? 0 : bodyStartIndex;
  const body = lines
    .slice(bodyStart >= 0 ? bodyStart : 0)
    .join("\n")
    .trim();

  return { headers, body };
}

function replaceCIDReferences(text, attachments) {
  const cidMap = Object.fromEntries(
    attachments
      .filter((attachment) => attachment.cid)
      .map((attachment) => [attachment.cid, attachment.filename]),
  );

  return String(text || "").replace(/\[cid:([^\]]+)\]/gu, (_, cid) => {
    const name = cidMap[cid];
    return name ? `[anexo: ${name}]` : `[cid:${cid}]`;
  });
}

function hashText(text) {
  return crypto
    .createHash("sha256")
    .update(String(text || ""))
    .digest("hex");
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function selectMainMessage(messages) {
  return messages[messages.length - 1] || messages[0] || null;
}

export async function parseEmlBuffer(
  content,
  {
    sourceFile = "",
    type,
    defaultType = "request",
    issueTypeItems = [],
    sanitizationConfig,
  } = {},
) {
  const config = compileEmailSanitizationConfig(sanitizationConfig);
  const parsed = await simpleParser(content);
  const body = parsed.text || parsed.html || "";
  const subject = cleanupSubject(parsed.subject, config);
  const attachments = (parsed.attachments || []).map((attachment, index) => ({
    index,
    filename: attachment.filename || "sem_nome",
    contentType: attachment.contentType,
    size: attachment.size,
    checksum: attachment.checksum || null,
    contentDisposition: attachment.contentDisposition || null,
    cid: attachment.cid || null,
    tags: ["Anexo E-Mail"],
  }));
  const attachmentContents = (parsed.attachments || []).map(
    (attachment, index) => ({
      index,
      filename: attachment.filename || "sem_nome",
      contentType: attachment.contentType,
      checksum: attachment.checksum || null,
      content: attachment.content,
    }),
  );
  const messages = splitMailBody(body, config).map((message, index) => {
    const { headers, body: messageBody } = extractHeaders(message);
    const sanitizedBody = cleanupGarbage(messageBody, config);
    const cleanedBody = config.options.replaceCidReferences
      ? replaceCIDReferences(sanitizedBody, attachments)
      : sanitizedBody;
    const date = parseDateValue(headers.date);

    return {
      index,
      hash: hashText(cleanedBody),
      text: cleanedBody,
      from: headers.from || "",
      to: headers.to || "",
      cc: headers.cc || "",
      date,
      rawDate: headers.date || "",
    };
  });
  const mainMessage = selectMainMessage(messages);
  const receivedEmailAt = parseDateValue(parsed.date);
  const firstThreadEmailAt =
    messages
      .map((message) => message.date)
      .filter(Boolean)
      .sort((left, right) => left.getTime() - right.getTime())[0] ||
    receivedEmailAt ||
    null;
  const detectedIssue = detectIssueTypeFromSubject(subject, issueTypeItems);

  return {
    sourceFile,
    sourceMessageId: parsed.messageId || "",
    sourceInReplyTo: parsed.inReplyTo || "",
    sourceReferences: parsed.references || [],
    idFromSubject: detectedIssue.code,
    type: type || detectedIssue.type || defaultType,
    title: subject,
    text: mainMessage?.text || cleanupGarbage(body, config),
    dates: {
      receivedEmailAt,
      firstThreadEmailAt,
      issueCreatedAt: new Date(),
      closedAt: null,
    },
    status: "open",
    messages,
    attachments,
    attachmentContents,
  };
}

export async function parseEmlFile(
  filePath,
  { type, defaultType, issueTypeItems, sanitizationConfig } = {},
) {
  return parseEmlBuffer(readFileSync(filePath), {
    sourceFile: filePath,
    type,
    defaultType,
    issueTypeItems,
    sanitizationConfig,
  });
}
