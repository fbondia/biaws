import { bindTool } from "../../bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../contracts.js";
import { demandMutationTools as definitions } from "./schemas.js";
import {
  deleteDemandNote,
  updateDemand,
  updateDemandChecklist,
  updateDemandJourneys,
  updateDemandNote,
  updateDemandSpecification,
} from "./service.js";
const handlers: Record<string, ToolHandler> = {
  demands_update: bindTool("demands_update", updateDemand),
  demands_update_specification: bindTool(
    "demands_update_specification",
    updateDemandSpecification,
  ),
  demands_update_checklist: bindTool(
    "demands_update_checklist",
    updateDemandChecklist,
  ),
  demands_update_journeys: bindTool(
    "demands_update_journeys",
    updateDemandJourneys,
  ),
  demands_update_note: bindTool("demands_update_note", updateDemandNote),
  demands_delete_note: bindTool("demands_delete_note", deleteDemandNote),
};
export const demandMutationTools: (ToolDefinition & {
  handler: ToolHandler;
})[] = definitions.map((tool) => ({ ...tool, handler: handlers[tool.name] }));
