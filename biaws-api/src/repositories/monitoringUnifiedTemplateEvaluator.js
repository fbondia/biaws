import { evaluateJsonataIsolated } from "./monitoringJsonataEvaluator.js";
import { normalizeUnifiedMonitoringTemplateDefinition } from "./monitoringTemplateUnifiedDefinition.js";
import { validateUnifiedMonitoringTemplateResult } from "./monitoringTemplateResultValidator.js";

export async function evaluateUnifiedMonitoringTemplate(
  definition,
  input,
  options = {},
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
