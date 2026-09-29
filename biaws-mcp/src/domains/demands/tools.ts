import { bindTool } from "../../mcp/tools/bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../mcp/tools/contracts.js";
import { demandTools as definitions } from "./schemas.js";
import {
  addDemandNote,
  addDemandTaskNote,
  createDemand,
  createDemandTask,
  deleteDemandTask,
  deleteDemandTaskNote,
  getDemand,
  getDemandDeadlines,
  getDemandImplementationContext,
  getJourneyCalendar,
  listDemands,
  listDemandTasks,
  updateDemandDescription,
  updateDemandTask,
  updateDemandTaskNote,
  updateDemandTaskStatus,
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
  demands_list: bindTool("demands_list", listDemands),
  demands_get: bindTool("demands_get", getDemand),
  demands_create: bindTool("demands_create", createDemand),
  demands_journey_calendar: bindTool(
    "demands_journey_calendar",
    getJourneyCalendar,
  ),
  demands_deadlines: bindTool("demands_deadlines", getDemandDeadlines),
  demands_implementation_context: bindTool(
    "demands_implementation_context",
    getDemandImplementationContext,
  ),
  demands_add_note: bindTool("demands_add_note", addDemandNote),
  demands_update_description: bindTool(
    "demands_update_description",
    updateDemandDescription,
  ),
  demands_list_tasks: bindTool("demands_list_tasks", listDemandTasks),
  demands_create_task: bindTool("demands_create_task", createDemandTask),
  demands_update_task: bindTool("demands_update_task", updateDemandTask),
  demands_update_task_status: bindTool(
    "demands_update_task_status",
    updateDemandTaskStatus,
  ),
  demands_delete_task: bindTool("demands_delete_task", deleteDemandTask),
  demands_add_task_note: bindTool("demands_add_task_note", addDemandTaskNote),
  demands_update_task_note: bindTool(
    "demands_update_task_note",
    updateDemandTaskNote,
  ),
  demands_delete_task_note: bindTool(
    "demands_delete_task_note",
    deleteDemandTaskNote,
  ),
};
export const demandTools: (ToolDefinition & {
  handler: ToolHandler;
})[] = definitions.map((tool) => ({ ...tool, handler: handlers[tool.name] }));
