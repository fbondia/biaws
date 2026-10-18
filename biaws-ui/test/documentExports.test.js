import assert from "node:assert/strict";
import test from "node:test";

import { printableDocumentHtml } from "../src/components/knowledge/KnowledgeRecordsView/components/DocumentDetail/hooks/useDocumentExports.js";

test("printable document escapes metadata and preserves rendered markdown", () => {
  const html = printableDocumentHtml(
    {
      title: "Regra <principal>",
      summary: 'Resumo com "aspas" & contexto.',
    },
    "<h2>Conteúdo renderizado</h2>",
  );

  assert.match(html, /Regra &lt;principal&gt;/u);
  assert.match(html, /Resumo com &quot;aspas&quot; &amp; contexto\./u);
  assert.match(html, /<main><h2>Conteúdo renderizado<\/h2><\/main>/u);
  assert.match(html, /@page \{ size: A4/u);
});

test("Markdown export includes every catalog entry in order and escapes their titles", async () => {
  const { documentMarkdown } = await import("../../shared/documentContent.js");
  assert.equal(documentMarkdown({ documentType: "free-text", markdown: "# Livre\n\nTexto." }), "# Livre\n\nTexto.");
  assert.equal(
    documentMarkdown({
      documentType: "catalog",
      markdown: "Introdução",
      details: {
        items: [
          { title: "API <script>", description: "**Contrato**" },
          { title: "Segundo\nitem", description: "Descrição\n\n- Elemento" },
        ],
      },
    }),
    "Introdução\n\n## API \\<script\\>\n\n**Contrato**\n\n## Segundo item\n\nDescrição\n\n- Elemento",
  );
});
