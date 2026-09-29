import { optionalText } from "../../shared/topology/normalization.js";
import { evaluateMonitoringTemplateReference } from "../templates/evaluation.js";
import type {
  ActiveMonitorDocument,
  MonitorLease,
  MonitorTemplateRef,
} from "../../../types/monitoring.js";
import { isRecord } from "../../../helpers/records.js";
import { errorStatusCode } from "../../../helpers/error.js";

type ActiveObservationMonitor = ActiveMonitorDocument & { lease: MonitorLease };
type MonitoringEvaluation = NonNullable<
  Awaited<ReturnType<typeof evaluateMonitoringTemplateReference>>
>;
type TemplateFailure = Record<string, unknown> & { statusCode: number };

export async function evaluateActiveMonitoringTemplate(
  monitor: ActiveObservationMonitor,
  payload: Record<string, unknown>,
  templateRef: MonitorTemplateRef | null,
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
    if (errorStatusCode(error) !== 422 || !isRecord(error)) throw error;
    return { evaluation: null, evaluationFailure: error as TemplateFailure };
  }
}

function failedTemplateMetadata(evaluationFailure: TemplateFailure) {
  const details = isRecord(evaluationFailure.publicDetails)
    ? evaluationFailure.publicDetails
    : {};
  const diagnostic = isRecord(details.diagnostic) ? details.diagnostic : {};
  return {
    failure_kind: "template_evaluation",
    failure_stage: "template",
    diagnostic_code: String(
      diagnostic.code || evaluationFailure.code || "TEMPLATE_EVALUATION_FAILED",
    ).slice(0, 100),
  };
}

function activeObservationMetadata(
  payload: Record<string, unknown>,
  evaluation: MonitoringEvaluation | null,
  evaluationFailure: TemplateFailure | null,
) {
  if (evaluationFailure) return failedTemplateMetadata(evaluationFailure);
  if (evaluation) return evaluation.result.metadata;
  return payload.metadata;
}

export function activeObservationPayload(
  monitor: ActiveObservationMonitor,
  payload: Record<string, unknown>,
  evaluation: MonitoringEvaluation | null,
  evaluationFailure: TemplateFailure | null,
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
  monitor: ActiveObservationMonitor,
  templateRef: MonitorTemplateRef | null,
  evaluation: MonitoringEvaluation | null,
  evaluationFailure: TemplateFailure | null,
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
