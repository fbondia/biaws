import { evaluateJsonataIsolated } from "./jsonataEvaluator.js";
import { normalizeUnifiedMonitoringTemplateDefinition } from "./unifiedDefinition.js";
import { validateUnifiedMonitoringTemplateResult } from "./resultValidator.js";

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
