import assert from "node:assert/strict";
import { COLLECTION_NAMES } from "../../../src/database/collectionNames.js";
import {
  integratedMonitoringTemplateSeeds,
  migrateIntegratedMonitoringProfiles,
} from "../../../src/repositories/monitoring/metadataProfiles/templateSeeds.js";

export async function templateValidation(scenarioContext) {
  const { database, request, adminCookie, workspace, runtime, signalRoute } = scenarioContext;
  const invalidMonitorResponse = await request(`/api/monitoring/runtimes/${runtime.id}/active-monitors`, {
    cookie: adminCookie,
    method: "POST",
    body: {
      name: "Unsafe active monitor",
      provider: "rest",
      intervalSeconds: 30,
      timeoutSeconds: 31,
      configuration: {},
    },
    origin: true,
  });

  assert.equal(invalidMonitorResponse.status, 422);

  await database.collection(COLLECTION_NAMES.RUNTIME_MONITORING_TEMPLATES).insertOne({
    id: "foreign-template",
    version: "v1",
    workspaceId: "other-workspace",
    status: "active",
  });

  const foreignTemplateResponse = await request(`/api/monitoring/runtimes/${runtime.id}/active-monitors`, {
    cookie: adminCookie,
    method: "POST",
    body: {
      name: "Foreign template",
      provider: "rest",
      configuration: {},
      templateRef: { id: "foreign-template", version: "v1" },
    },
    origin: true,
  });

  assert.equal(foreignTemplateResponse.status, 422);

  assert.equal((await foreignTemplateResponse.json()).error.code, "INVALID_MONITORING_TEMPLATE");

  const shellTemplateResponse = await request(`/api/monitoring/runtimes/${runtime.id}/active-monitors`, {
    cookie: adminCookie,
    method: "POST",
    body: {
      name: "Unsupported templated shell",
      provider: "shell",
      configuration: { scriptId: "worker-health" },
      templateRef: { id: "health", version: "1" },
    },
    origin: true,
  });

  assert.equal(shellTemplateResponse.status, 422);

  assert.equal((await shellTemplateResponse.json()).error.code, "SHELL_TEMPLATE_NOT_SUPPORTED");

  const unifiedDefinition = integratedMonitoringTemplateSeeds()[0].definition;

  const unifiedTemplateResponse = await request("/api/monitoring/templates", {
    cookie: adminCookie,
    method: "POST",
    body: {
      name: "Unified external health",
      description: "Unified contract integration template",
      definition: unifiedDefinition,
    },
    origin: true,
  });

  assert.equal(unifiedTemplateResponse.status, 201);

  const unifiedTemplate = (await unifiedTemplateResponse.json()).template;

  assert.equal(unifiedTemplate.definition.schemaVersion, "1");

  const unifiedVersionResponse = await request(`/api/monitoring/templates/${unifiedTemplate.id}`, {
    cookie: adminCookie,
    method: "PATCH",
    body: {
      name: unifiedTemplate.name,
      description: "Second immutable unified version",
      definition: {
        ...unifiedDefinition,
        transformation: {
          ...unifiedDefinition.transformation,
          expression: '{"status": status, "message": message, "metadata": metadata}',
        },
      },
    },
    origin: true,
  });

  assert.equal(unifiedVersionResponse.status, 201);

  const unifiedVersion = (await unifiedVersionResponse.json()).template;

  assert.equal(unifiedVersion.version, "2");

  assert.equal(unifiedVersion.derivedFromVersion, "1");

  const unifiedActivationResponse = await request(
    `/api/monitoring/templates/${unifiedTemplate.id}/versions/2/activate`,
    { cookie: adminCookie, method: "POST", body: {}, origin: true },
  );

  assert.equal(unifiedActivationResponse.status, 200);

  assert.equal((await unifiedActivationResponse.json()).template.status, "active");

  const unifiedContractResponse = await request(`/api/monitoring/templates/${unifiedTemplate.id}/versions/2/contract`, {
    cookie: adminCookie,
  });

  assert.equal(unifiedContractResponse.status, 200);

  const unifiedContract = (await unifiedContractResponse.json()).contract;

  assert.deepEqual(unifiedContract.templateRef, {
    id: unifiedTemplate.id,
    version: "2",
  });

  assert.equal(unifiedContract.transformation.language, "jsonata");

  assert.deepEqual(unifiedContract.input.sample, unifiedDefinition.input.sample);

  const unifiedValidationResponse = await request(
    `/api/monitoring/templates/${unifiedTemplate.id}/versions/2/validate`,
    {
      cookie: adminCookie,
      method: "POST",
      body: { sample: unifiedDefinition.input.sample },
      origin: true,
    },
  );

  assert.equal(unifiedValidationResponse.status, 200);

  assert.equal((await unifiedValidationResponse.json()).validation.result.status, "healthy");

  const unifiedSignalResponse = await request(signalRoute, {
    cookie: adminCookie,
    method: "POST",
    body: {
      signalId: "monitor:unified:1",
      status: "unavailable",
      observedAt: "2026-07-31T14:30:00.000Z",
      source: "unified-external-monitor",
      message: "client result must be ignored",
      metadata: { client_result: "ignored" },
      payload: unifiedDefinition.input.sample,
      templateRef: { id: unifiedTemplate.id, version: "2" },
    },
    origin: true,
  });

  assert.equal(unifiedSignalResponse.status, 201);

  const unifiedSignal = (await unifiedSignalResponse.json()).signal;

  assert.equal(unifiedSignal.status, "healthy");

  assert.equal(unifiedSignal.message, "Monitoramento concluído.");

  assert.equal(unifiedSignal.metadata.service_up, true);

  assert.equal(unifiedSignal.metadata.client_result, undefined);

  assert.deepEqual(unifiedSignal.templateRef, {
    id: unifiedTemplate.id,
    version: "2",
  });

  assert.equal(unifiedSignal.templateSnapshot.schemaVersion, "1");

  assert.deepEqual(unifiedSignal.metadataPresentation, unifiedSignal.templateSnapshot.presentation);

  const persistedUnifiedTemplate = await (
    await request(`/api/monitoring/templates/${unifiedTemplate.id}`, {
      cookie: adminCookie,
    })
  ).json();

  assert.equal(persistedUnifiedTemplate.template.versions.length, 2);

  assert.equal(persistedUnifiedTemplate.template.version, "2");

  const invalidJsonataTemplateResponse = await request("/api/monitoring/templates", {
    cookie: adminCookie,
    method: "POST",
    body: {
      name: "Invalid JSONata draft",
      description: "Compilation must fail before activation",
      definition: {
        ...unifiedDefinition,
        transformation: {
          language: "jsonata",
          expression: "not valid [",
        },
      },
    },
    origin: true,
  });

  assert.equal(invalidJsonataTemplateResponse.status, 201);

  const invalidJsonataTemplate = (await invalidJsonataTemplateResponse.json()).template;

  const invalidJsonataActivation = await request(
    `/api/monitoring/templates/${invalidJsonataTemplate.id}/versions/1/activate`,
    { cookie: adminCookie, method: "POST", body: {}, origin: true },
  );

  assert.equal(invalidJsonataActivation.status, 422);

  assert.equal((await invalidJsonataActivation.json()).error.code, "MONITORING_TEMPLATE_EVALUATION_FAILED");
  return {
    ...scenarioContext,
    invalidMonitorResponse,
    foreignTemplateResponse,
    shellTemplateResponse,
    unifiedDefinition,
    unifiedTemplateResponse,
    unifiedTemplate,
    unifiedVersionResponse,
    unifiedVersion,
    unifiedActivationResponse,
    unifiedContractResponse,
    unifiedContract,
    unifiedValidationResponse,
    unifiedSignalResponse,
    unifiedSignal,
    persistedUnifiedTemplate,
    invalidJsonataTemplateResponse,
    invalidJsonataTemplate,
    invalidJsonataActivation,
  };
}
