import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDemoClassifications,
  demoCatalogSkipReason,
} from "../src/scripts/seedDemo.js";

test("demo seed respects an intentionally archived demo catalog", () => {
  assert.equal(
    demoCatalogSkipReason({ status: "archived" }, { status: "active" }),
    "demo-application-archived",
  );
  assert.equal(
    demoCatalogSkipReason({ status: "active" }, { status: "archived" }),
    "demo-component-archived",
  );
  assert.equal(
    demoCatalogSkipReason({ status: "active" }, { status: "active" }),
    null,
  );
});

test("demo seed uses its default classification when it is applicable", () => {
  const result = buildDemoClassifications(
    {
      taxonomy: [
        {
          id: "operacao",
          children: [
            { id: "acesso" },
            { id: "integracao" },
            { id: "automacao" },
          ],
        },
      ],
      tagGroups: [
        { id: "ambiente", tags: ["local"] },
        { id: "tratamento", tags: ["analise", "documentacao"] },
      ],
    },
    "application-a",
  );

  assert.equal(result.issue.primaryTaxonomyId, "integracao");
  assert.deepEqual(result.issue.secondaryTaxonomyIds, ["automacao"]);
  assert.deepEqual(result.procedure.secondaryTaxonomyIds, ["acesso"]);
  assert.deepEqual(result.issue.tags, {
    ambiente: ["local"],
    tratamento: ["analise"],
  });
});

test("demo seed does not impose classifications on a custom taxonomy", () => {
  const result = buildDemoClassifications(
    {
      taxonomy: [{ id: "financeiro", children: [{ id: "cobranca" }] }],
      tagGroups: [{ id: "prioridade", tags: ["alta"] }],
    },
    "application-a",
  );

  assert.equal(result.issue, null);
  assert.deepEqual(result.procedure, {});
});

test("demo seed respects taxonomy application scope", () => {
  const result = buildDemoClassifications(
    {
      taxonomy: [
        {
          id: "operacao",
          applicationIds: ["application-b"],
          children: [{ id: "integracao" }],
        },
      ],
      tagGroups: [],
    },
    "application-a",
  );

  assert.equal(result.issue, null);
  assert.deepEqual(result.procedure, {});
});
