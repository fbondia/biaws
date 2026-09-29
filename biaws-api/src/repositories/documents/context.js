import { httpError } from "./support.js";

export function validateDetailsContext(document, context) {
  if (document.documentType !== "guideline") return;
  const scope = document.details.scope;
  if (scope === "workspace" && context.applicationId) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DETAILS",
      "Guidelines de workspace não podem estar associadas a uma aplicação",
    );
  }
  if (scope !== "workspace" && !context.applicationId) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DETAILS",
      "Guidelines de aplicação ou componente exigem applicationId",
    );
  }
  if (scope === "component" && !context.affectedComponentIds.length) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DETAILS",
      "Guidelines de componente exigem ao menos um componente afetado",
    );
  }
}
