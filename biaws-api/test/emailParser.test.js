import assert from "node:assert/strict";
import test from "node:test";

import { parseEmlBuffer } from "../src/helpers/emailParser.js";
import { attachmentDedupeKey } from "../src/services/emlImportService.js";

test("EML attachments receive the default email tag", async () => {
  const eml = Buffer.from(
    [
      "From: remetente@example.com",
      "To: destino@example.com",
      "Subject: Teste com anexo",
      "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="test-boundary"',
      "",
      "--test-boundary",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Mensagem de teste.",
      "--test-boundary",
      'Content-Type: text/plain; name="evidencia.txt"',
      'Content-Disposition: attachment; filename="evidencia.txt"',
      "Content-Transfer-Encoding: base64",
      "",
      "Y29udGV1ZG8=",
      "--test-boundary--",
      "",
    ].join("\r\n"),
  );

  const parsed = await parseEmlBuffer(eml, { sourceFile: "teste.eml" });

  assert.equal(parsed.attachments.length, 1);
  assert.deepEqual(parsed.attachments[0].tags, ["Anexo E-Mail"]);
});

test("attachment deduplication prioritizes checksum and has a metadata fallback", () => {
  assert.equal(
    attachmentDedupeKey({ checksum: "ABC123", filename: "primeiro.txt" }),
    attachmentDedupeKey({ checksum: "abc123", filename: "segundo.txt" }),
  );
  assert.equal(
    attachmentDedupeKey({
      filename: " Evidência.TXT ",
      size: 10,
      contentType: "text/plain",
    }),
    attachmentDedupeKey({
      filename: "evidência.txt",
      size: 10,
      contentType: "TEXT/PLAIN",
    }),
  );
  assert.notEqual(
    attachmentDedupeKey({
      filename: "evidência.txt",
      size: 10,
      contentType: "text/plain",
    }),
    attachmentDedupeKey({
      filename: "evidência.txt",
      size: 11,
      contentType: "text/plain",
    }),
  );
});

test("EML sanitization rules can be configured for subject and body", async () => {
  const eml = Buffer.from(
    [
      "From: remetente@example.com",
      "To: destino@example.com",
      "Subject: AVISO: Assunto configurável",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Conteúdo útil.",
      "RODAPÉ PERSONALIZADO",
    ].join("\r\n"),
  );

  const parsed = await parseEmlBuffer(eml, {
    sourceFile: "configuravel.eml",
    sanitizationConfig: {
      subjectPrefixes: ["AVISO"],
      bodyRules: [
        {
          id: "custom-footer",
          label: "Rodapé personalizado",
          pattern: "RODAPÉ PERSONALIZADO",
          flags: "giu",
          enabled: true,
        },
      ],
      threadSeparators: [],
      options: {
        collapseBlankLines: true,
        trimLineEndings: true,
        replaceCidReferences: true,
      },
    },
  });

  assert.equal(parsed.title, "Assunto configurável");
  assert.equal(parsed.text, "Conteúdo útil.");
});

test("disabled EML sanitization rules remain in the resulting body", async () => {
  const eml = Buffer.from(
    [
      "Subject: Teste",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Texto",
      "NÃO REMOVER",
    ].join("\r\n"),
  );
  const parsed = await parseEmlBuffer(eml, {
    sanitizationConfig: {
      bodyRules: [
        {
          id: "disabled",
          label: "Desabilitada",
          pattern: "NÃO REMOVER",
          flags: "giu",
          enabled: false,
        },
      ],
    },
  });

  assert.match(parsed.text, /NÃO REMOVER/u);
});

test("EML issue type and code detection uses configured type metadata", async () => {
  const eml = Buffer.from(
    [
      "Subject: Encaminhamento CHG-00421 para produção",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Executar mudança.",
    ].join("\r\n"),
  );
  const parsed = await parseEmlBuffer(eml, {
    defaultType: "request",
    issueTypeItems: [
      {
        value: "change",
        active: true,
        order: 10,
        metadata: {
          emlImport: {
            enabled: true,
            subjectPatterns: [String.raw`\b(?<code>CHG-\d{5})\b`],
          },
        },
      },
      {
        value: "request",
        active: true,
        order: 20,
        metadata: {
          emlImport: { enabled: true, subjectPatterns: [] },
        },
      },
    ],
  });

  assert.equal(parsed.type, "change");
  assert.equal(parsed.idFromSubject, "CHG-00421");
});

test("EML detection prefers a code capture over a classification-only match", async () => {
  const eml = Buffer.from(
    [
      "Subject: Erro ao tratar REQ12345",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Detalhes.",
    ].join("\r\n"),
  );
  const parsed = await parseEmlBuffer(eml);

  assert.equal(parsed.type, "request");
  assert.equal(parsed.idFromSubject, "REQ12345");
});
