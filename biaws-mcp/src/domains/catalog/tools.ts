import { bindTool } from "../../mcp/tools/bindTool.js";
import type { ToolDefinition, ToolHandler } from "../../mcp/tools/contracts.js";
import { catalogTools as definitions } from "./schemas.js";
import {
  createApplication,
  createComponent,
  createDeployment,
  createIntegration,
  createRepository,
  createRuntime,
  createServer,
  getApplicationContext,
  listApplications,
  listComponents,
  listDeployments,
  listIntegrations,
  listRepositories,
  listRuntimes,
  listServers,
  recordDeploymentPublication,
  updateApplication,
  updateComponent,
  updateDeployment,
  updateIntegration,
  updateRepository,
  updateRuntime,
  updateServer,
} from "./service.js";
const handlers: Record<string, ToolHandler> = {
  applications_list: bindTool("applications_list", listApplications),

  applications_get_context: bindTool(
    "applications_get_context",
    getApplicationContext,
  ),
  components_list: bindTool("components_list", listComponents),

  integrations_list: bindTool("integrations_list", listIntegrations),

  repositories_list: bindTool("repositories_list", listRepositories),

  servers_list: bindTool("servers_list", listServers),

  deployments_list: bindTool("deployments_list", listDeployments),

  runtimes_list: bindTool("runtimes_list", listRuntimes),

  applications_create: bindTool("applications_create", createApplication),
  applications_update: bindTool("applications_update", updateApplication),
  components_create: bindTool("components_create", createComponent),
  components_update: bindTool("components_update", updateComponent),
  integrations_create: bindTool("integrations_create", createIntegration),
  integrations_update: bindTool("integrations_update", updateIntegration),
  repositories_create: bindTool("repositories_create", createRepository),
  repositories_update: bindTool("repositories_update", updateRepository),
  servers_create: bindTool("servers_create", createServer),
  servers_update: bindTool("servers_update", updateServer),
  deployments_create: bindTool("deployments_create", createDeployment),
  deployments_update: bindTool("deployments_update", updateDeployment),
  deployments_record_publication: bindTool(
    "deployments_record_publication",
    recordDeploymentPublication,
  ),
  runtimes_create: bindTool("runtimes_create", createRuntime),
  runtimes_update: bindTool("runtimes_update", updateRuntime),
};
export const catalogTools: (ToolDefinition & { handler: ToolHandler })[] =
  definitions.map((tool) => ({ ...tool, handler: handlers[tool.name] }));
