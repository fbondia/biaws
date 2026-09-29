export interface ResourceDefinition {
  uriTemplate: string;
  path: string;
  description: string;
  mimeType: string;
}
import catalog from "./resourceCatalog.json" with { type: "json" };
export const RESOURCE_CATALOG: ResourceDefinition[] = catalog;
