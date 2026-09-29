import { optionalText } from "../../shared/topology/normalization.js";
import { evaluateMonitoringTemplateReference } from "../templates/evaluation.js";

export async function evaluateActiveMonitoringTemplate(
  monitor,
  payload,
  templateRef,
) {
  if (!templateRef) return { evaluation: null, evaluationFailure: null };
  try {
    const evaluation = await evaluateMonitoringTemplateReference(
      templateRef,
      {
        context: {
          origin: "active",
          provider: monitor.provider,
          monitorId: monitor.id,
        },
        evidence: payload.payload || {},
        metadata: payload.metadata || {},
      },
      monitor.workspaceId,
    );
    return { evaluation, evaluationFailure: null };
  } catch (error) {
    if (error?.statusCode !== 422) throw error;
    return { evaluation: null, evaluationFailure: error };
  }
}

function failedTemplateMetadata(evaluationFailure) {
  return {
    failure_kind: "template_evaluation",
    failure_stage: "template",
    diagnostic_code: String(
      evaluationFailure.publicDetails?.diagnostic?.code ||
        evaluationFailure.code ||
        "TEMPLATE_EVALUATION_FAILED",
    ).slice(0, 100),
  };
}

function activeObservationMetadata(payload, evaluation, evaluationFailure) {
  if (evaluationFailure) return failedTemplateMetadata(evaluationFailure);
  if (evaluation) return evaluation.result.metadata;
  return payload.metadata;
}

export function activeObservationPayload(
  monitor,
  payload,
  evaluation,
  evaluationFailure,
) {
  return {
    signalId: `active:${monitor.id}:${monitor.lease.executionId}`,
    status: evaluationFailure
      ? "unknown"
      : evaluation?.result.status || payload.status,
    observedAt: payload.observedAt,
    source:
      optionalText(payload.source, "source", 160) ||
      `${monitor.provider}:${monitor.name}`,
    message: evaluationFailure
      ? "Monitoring template evaluation failed"
      : evaluation?.result.message || payload.message,
    metadata: activeObservationMetadata(payload, evaluation, evaluationFailure),
    metadataProfile:
      evaluation || evaluationFailure ? undefined : payload.metadataProfile,
    payload: monitor.provider === "shell" ? undefined : payload.payload,
  };
}

export function activeObservationEventContext(
  monitor,
  templateRef,
  evaluation,
  evaluationFailure,
) {
  return {
    monitorId: monitor.id,
    executionId: monitor.lease.executionId,
    scheduledFor: monitor.lease.scheduledFor,
    provider: monitor.provider,
    trigger: monitor.lease.trigger || "scheduled",
    ...(templateRef ? { templateRef: { ...templateRef } } : {}),
    ...(evaluation
      ? {
          templateSnapshot: evaluation.templateSnapshot,
          templateMatch: evaluation.matchedRule,
        }
      : {}),
    ...(evaluationFailure?.templateSnapshot
      ? { templateSnapshot: evaluationFailure.templateSnapshot }
      : {}),
  };
}
