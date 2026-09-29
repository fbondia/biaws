import type { RepositoryQuery } from "../../../types/http.js";
import { evaluateJsonataIsolated } from "./jsonataEvaluator.js";
import { normalizeUnifiedMonitoringTemplateDefinition } from "./unifiedDefinition.js";
import { validateUnifiedMonitoringTemplateResult } from "./resultValidator.js";

export async function evaluateUnifiedMonitoringTemplate(
  definition: unknown,
  input: unknown,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
) {
  const normalizedDefinition =
    normalizeUnifiedMonitoringTemplateDefinition(definition);
  const transformed = await evaluateJsonataIsolated(
    normalizedDefinition.transformation.expression,
    input,
    options,
  );
  return {
    result: validateUnifiedMonitoringTemplateResult(
      normalizedDefinition,
      transformed,
    ),
    matchedRule: null,
    diagnostics: [],
  };
}
