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
