import { previewKind } from "../filePreviewModel.js";

function decodeReference(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeCid(value) {
  return String(value || "")
    .trim()
    .replace(/^<|>$/gu, "");
}

export function resolveAttachment(reference, attachments = []) {
  const value = String(reference || "").trim();
  let matches;
  if (/^attachment:/iu.test(value)) {
    const id = decodeReference(value.slice("attachment:".length));
    matches = attachments.filter((file) => String(file.id ?? file.index) === id);
  } else if (/^cid:/iu.test(value)) {
    const cid = normalizeCid(decodeReference(value.slice("cid:".length)));
    matches = cid ? attachments.filter((file) => normalizeCid(file.cid) === cid) : [];
  } else {
    const filename = value.replace(/^anexo:\s*/iu, "").normalize("NFC");
    matches = attachments.filter((file) => String(file.filename || "").normalize("NFC") === filename);
    if (!matches.length) {
      const decoded = decodeReference(filename);
      matches = attachments.filter((file) => String(file.filename || "").normalize("NFC") === decoded);
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

export function resolveAttachmentImage(reference, attachments = []) {
  const attachment = resolveAttachment(reference, attachments);
  return attachment && previewKind(attachment) === "image" ? attachment : null;
}

export function attachmentLinkMarkdown(file) {
  const label =
    String(file.filename || "Anexo")
      .replace(/[\[\]\r\n]/gu, " ")
      .trim() || "Anexo";
  const id = encodeURIComponent(file.id ?? file.index).replace(/[()]/gu, (character) =>
    character === "(" ? "%28" : "%29",
  );
  return `[${label}](attachment:${id})`;
}

export function attachmentImageMarkdown(file) {
  return `!${attachmentLinkMarkdown({ ...file, filename: file.filename || "Imagem" })}`;
}
