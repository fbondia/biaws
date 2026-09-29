import type { ToolDefinition } from "../../mcp/tools/contracts.js";
export const auditTools = [
  {
    name: "audit_events_list",
    description:
      "Consulta os eventos mais recentes de auditoria de uma entidade, respeitando seu escopo e permissão de leitura. Retorna até 200 eventos; a API não oferece paginação deste histórico.",
    inputSchema: {
      type: "object",
      required: ["entityType", "entityId"],
      additionalProperties: false,
      properties: {
        entityType: {
          type: "string",
          enum: [
            "issue",
            "demand",
            "task",
            "document",
            "taxonomy",
            "skill",
            "application",
            "workspace",
            "component",
            "integration",
            "repository",
            "server",
            "deployment",
            "runtime",
          ],
        },
        entityId: {
          type: "string",
          minLength: 1,
          description: "ID da entidade usado pela API; códigos de melhorias não são resolvidos nesta ferramenta.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          default: 100,
        },
      },
    },
  },
] as const satisfies readonly ToolDefinition[];
