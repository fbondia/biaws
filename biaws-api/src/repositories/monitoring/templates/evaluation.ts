import type {
  MonitoringTemplateDocument,
  MonitorTemplateRef,
} from "../../../types/monitoring.js";
import { isRecord } from "../../../helpers/records.js";
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
import { Document, ObjectId } from "mongodb";

export async function previewMonitoringTemplate(
  payload: Record<string, unknown> = {},
) {
  assertAllowedFields(
    payload,
    ["definition", "sample"],
    "monitoring template preview",
  );
  const definition = normalizeMonitoringTemplateDefinition(payload.definition);
  const defaultSample = isUnifiedMonitoringTemplateDefinition(definition)
    ? definition.input.sample
    : {};
  const sample = sanitizeMonitoringTemplateSample(
    payload.sample ?? defaultSample,
  );
  if (isUnifiedMonitoringTemplateDefinition(definition)) {
    return evaluateUnifiedMonitoringTemplate(definition, sample);
  }
  return evaluateMonitoringTemplate(definition, sample);
}

function monitoringTemplateContractResponse(
  template:
    MonitoringTemplateDocument | Omit<MonitoringTemplateDocument, "_id">,
) {
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

export async function describeMonitoringTemplate(
  id: string | string[],
  version: string | string[],
  workspaceId: string | null | undefined,
) {
  const template = await requireTemplate(id, version, workspaceId);
  return monitoringTemplateContractResponse(template);
}

export async function validateMonitoringTemplateSample(
  id: string | string[],
  version: string | string[],
  payload: Record<string, unknown> = {},
  workspaceId: string | null | undefined,
) {
  assertAllowedFields(payload, ["sample"], "monitoring template validation");
  const sample = sanitizeMonitoringTemplateSample(payload.sample ?? {});
  const evaluation = await evaluateMonitoringTemplateReference(
    { id: String(id), version: String(version) },
    sample,
    workspaceId,
  );
  if (!evaluation) throw new Error("Template evaluation is unavailable");
  return {
    templateRef: evaluation.templateRef,
    result: evaluation.result,
    diagnostics: evaluation.diagnostics,
  };
}

export async function evaluateMonitoringTemplateReference(
  templateRef: MonitorTemplateRef | null,
  sample: unknown,
  workspaceId: string | null | undefined,
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
          isRecord(sample) ? (sample.evidence ?? sample) : sample,
        )
      : evaluateMonitoringTemplate(template.definition, sample);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
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
