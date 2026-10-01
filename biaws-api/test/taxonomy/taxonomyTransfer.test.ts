import assert from "node:assert/strict";
import test from "node:test";

import { transferTaxonomyClassification } from "../../src/repositories/issues/taxonomyTransfer.js";

test("transfers a primary taxonomy and removes the destination from secondary taxonomies", () => {
  assert.deepEqual(
    transferTaxonomyClassification(
      {
        primaryTaxonomyId: "origem",
        secondaryTaxonomyIds: ["destino", "outro"],
        tags: { ambiente: ["producao"] },
      },
      "origem",
      "destino",
    ),
    {
      primaryTaxonomyId: "destino",
      secondaryTaxonomyIds: ["outro"],
      tags: { ambiente: ["producao"] },
    },
  );
});

test("transfers secondary taxonomies without duplicates or changing the primary taxonomy", () => {
  assert.deepEqual(
    transferTaxonomyClassification(
      {
        primaryTaxonomyId: "principal",
        secondaryTaxonomyIds: ["origem", "destino", "origem"],
      },
      "origem",
      "destino",
    ),
    {
      primaryTaxonomyId: "principal",
      secondaryTaxonomyIds: ["destino"],
    },
  );
});

test("removes a secondary source when its destination is already primary", () => {
  assert.deepEqual(
    transferTaxonomyClassification(
      {
        primaryTaxonomyId: "destino",
        secondaryTaxonomyIds: ["origem", "outro"],
      },
      "origem",
      "destino",
    ),
    {
      primaryTaxonomyId: "destino",
      secondaryTaxonomyIds: ["outro"],
    },
  );
});
