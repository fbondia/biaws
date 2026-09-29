import {
  evaluateMonitoringTemplate,
  normalizeMonitoringTemplateDefinition,
  sanitizeMonitoringTemplateSample,
} from "./legacyEvaluator.js";
import { assertAllowedFields } from "../../shared/topology/normalization.js";
import { requireTemplate } from "./storage.js";
import {
  isUnifiedMonitoringTemplateDefinition,
  unifiedMonitoringTemplateSnapshot,
} from "./unifiedDefinition.js";
import { evaluateUnifiedMonitoringTemplate } from "./unifiedEvaluator.js";

export async function previewMonitoringTemplate(payload = {}) {
  assertAllowedFields(
    payload,
    ["definition", "sample"],
    "monitoring template preview",
  );
  const definition = normalizeMonitoringTemplateDefinition(payload.definition);
  const sample = sanitizeMonitoringTemplateSample(
    payload.sample ?? definition.input?.sample ?? {},
  );
  if (isUnifiedMonitoringTemplateDefinition(definition)) {
    return evaluateUnifiedMonitoringTemplate(definition, sample);
  }
  return evaluateMonitoringTemplate(definition, sample);
}

function monitoringTemplateContractResponse(template) {
  const definition = normalizeMonitoringTemplateDefinition(template.definition);
  const unified = isUnifiedMonitoringTemplateDefinition(definition);
  return {
    templateRef: { id: template.id, version: template.version },
    name: template.name,
    description: template.description,
    status: template.status,
    schemaVersion: unified ? definition.schemaVersion : "legacy",
    input: unified
      ? definition.input
      : {
          mediaType: "application/json",
          sample: {},
        },
    transformation: unified
      ? { language: definition.transformation.language }
      : { language: "declarative-rules" },
    output: unified ? definition.output : null,
    presentation: unified ? definition.presentation : null,
  };
}

export async function describeMonitoringTemplate(id, version, workspaceId) {
  const template = await requireTemplate(id, version, workspaceId);
  return monitoringTemplateContractResponse(template);
}

export async function validateMonitoringTemplateSample(
  id,
  version,
  payload = {},
  workspaceId,
) {
  assertAllowedFields(payload, ["sample"], "monitoring template validation");
  const sample = sanitizeMonitoringTemplateSample(payload.sample ?? {});
  const evaluation = await evaluateMonitoringTemplateReference(
    { id, version },
    sample,
    workspaceId,
  );
  return {
    templateRef: evaluation.templateRef,
    result: evaluation.result,
    diagnostics: evaluation.diagnostics,
  };
}

export async function evaluateMonitoringTemplateReference(
  templateRef,
  sample,
  workspaceId,
) {
  if (!templateRef) return null;
  const template = await requireTemplate(
    templateRef.id,
    templateRef.version,
    workspaceId,
  );
  const templateSnapshot = {
    id: template.id,
    version: template.version,
    name: template.name,
    description: template.description,
    definition: template.definition,
    ...unifiedMonitoringTemplateSnapshot(template),
  };
  let evaluation;
  try {
    evaluation = isUnifiedMonitoringTemplateDefinition(template.definition)
      ? await evaluateUnifiedMonitoringTemplate(
          template.definition,
          sample?.evidence ?? sample,
        )
      : evaluateMonitoringTemplate(template.definition, sample);
  } catch (error) {
    error.templateRef = { id: template.id, version: template.version };
    error.templateSnapshot = templateSnapshot;
    throw error;
  }
  return {
    ...evaluation,
    templateRef: { id: template.id, version: template.version },
    templateSnapshot,
  };
}
