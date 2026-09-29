export interface ResourceDefinition {
  uriTemplate: string;
  path: string;
  description: string;
  mimeType: string;
}
// Share the static catalog with API contract tests without requiring a TS runtime.
import catalog from "./resourceCatalog.json" with { type: "json" };
export const RESOURCE_CATALOG: ResourceDefinition[] = catalog;
