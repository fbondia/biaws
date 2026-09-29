import { errorCode } from "../../src/helpers/error.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { Db } from "mongodb";

import {
  integratedMonitoringTemplateSeeds,
  migrateIntegratedMonitoringProfiles,
} from "../../src/repositories/monitoring/metadataProfiles/templateSeeds.js";
import { normalizeMonitoringTemplateDefinition } from "../../src/repositories/monitoring/templates/legacyEvaluator.js";

test("integrated profiles become complete unified template definitions", () => {
  const seeds = integratedMonitoringTemplateSeeds();
  assert.deepEqual(
    seeds.map(({ id, version, legacyMetadataProfile }) => ({
      id,
      version,
      legacyMetadataProfile,
    })),
    [
      {
        id: "sgmp-health",
        version: "1",
        legacyMetadataProfile: "sgmp-health/v1",
      },
      {
        id: "sgmp-api-health",
        version: "1",
        legacyMetadataProfile: "sgmp-api-health/v1",
      },
    ],
  );
  for (const seed of seeds) {
    assert.equal(seed.status, "active");
    assert.equal(seed.definition.schemaVersion, "1");
    assert.equal(seed.definition.transformation.language, "jsonata");
    assert.equal(seed.definition.input.mediaType, "application/json");
    assert.equal(seed.definition.output.status.required, true);
    assert.equal(seed.definition.output.metadata.additionalProperties, false);
    assert.ok(seed.definition.presentation.fields.length > 0);
  }
});

test("unified template definitions reject sensitive and undeclared presentation keys", () => {
  const definition = integratedMonitoringTemplateSeeds()[0].definition;
  assert.throws(
    () =>
      normalizeMonitoringTemplateDefinition({
        ...definition,
        output: {
          ...definition.output,
          metadata: {
            ...definition.output.metadata,
            fields: [...definition.output.metadata.fields, { key: "api_token", type: "string", required: false }],
          },
        },
      }),
    (error) => errorCode(error) === "INVALID_MONITORING_TEMPLATE",
  );
  assert.throws(
    () =>
      normalizeMonitoringTemplateDefinition({
        ...definition,
        presentation: {
          ...definition.presentation,
          fields: [
            ...definition.presentation.fields,
            {
              key: "not_declared",
              label: "Unknown",
              format: "text",
              visualization: "value",
            },
          ],
        },
      }),
    (error) => errorCode(error) === "INVALID_MONITORING_TEMPLATE",
  );
});

test("integrated profile migration is workspace-scoped and idempotent", async () => {
  const documents: Array<{ workspaceId: string; id: string; version: string }> = [];
  const database = {
    collection(name: string) {
      if (name === "runtimeMonitoringSignals") {
        return {
          aggregate() {
            return {
              sort() {
                return this;
              },
              async toArray() {
                return [{ _id: "workspace-used", profiles: ["sgmp-health/v1"] }];
              },
            };
          },
        };
      }
      if (name === "runtimeMonitoringTemplates") {
        return {
          async createIndex() {},
          async countDocuments(filter: { workspaceId: string; id: string; version: string }) {
            return documents.some(
              (document) =>
                document.workspaceId === filter.workspaceId &&
                document.id === filter.id &&
                document.version === filter.version,
            )
              ? 1
              : 0;
          },
          async updateOne(
            filter: { workspaceId: string; id: string; version: string },
            update: {
              $setOnInsert: {
                workspaceId: string;
                id: string;
                version: string;
              };
            },
          ) {
            if (await this.countDocuments(filter)) return { upsertedCount: 0 };
            documents.push(update.$setOnInsert);
            return { upsertedCount: 1 };
          },
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };

  const first = await migrateIntegratedMonitoringProfiles(database as unknown as Db, {
    apply: true,
  });
  const second = await migrateIntegratedMonitoringProfiles(database as unknown as Db, {
    apply: true,
  });
  assert.equal(first.templatesCreated, 2);
  assert.equal(second.templatesCreated, 0);
  assert.equal(second.existingTemplates, 2);
  assert.equal(documents.length, 2);
  assert.ok(documents.every(({ workspaceId }) => workspaceId === "workspace-used"));
});
