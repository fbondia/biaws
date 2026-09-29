import type { Collection } from "mongodb";
import type { GroupDocument, WorkspaceDocument } from "../../types/catalog.js";
import type { Actor } from "../../types/http.js";
import { permissionIds, permissionsStartingWith } from "./constants.js";
import { compareStrings, normalizedName } from "./support.js";

export const INITIAL_PERMISSION_GROUPS = Object.freeze([
  {
    id: "administration",
    name: "Administração",
    description:
      "Acesso integral à administração e aos domínios do Bondia Workspaces.",
    permissions: permissionIds,
  },
  {
    id: "incident-management",
    name: "Gestão de chamados",
    description: "Gerenciamento completo de chamados e seus anexos.",
    permissions: [
      "workspaces.read",
      "applications.read",
      "components.read",
      ...permissionsStartingWith("issues."),
    ],
  },
  {
    id: "demand-management",
    name: "Gestão de melhorias",
    description: "Gerenciamento completo de melhorias, tarefas e anexos.",
    permissions: permissionsStartingWith("demands.", "tasks."),
  },
  {
    id: "knowledge-management",
    name: "Gestão de conhecimento",
    description:
      "Gerenciamento de taxonomia, documentos de conhecimento e skills.",
    permissions: permissionsStartingWith(
      "taxonomy.",
      "documents.",
      "skills.",
    ).concat("applications.read", "components.read"),
  },
  {
    id: "support",
    name: "Chamados",
    description: "Consulta, comentários e atualização de status de chamados.",
    permissions: [
      "issues.read",
      "issues.status.update",
      "issues.comment.create",
      "issues.comment.update",
      "issues.attachment.read",
    ],
  },
  {
    id: "improvement-development",
    name: "Desenvolvimento de melhorias",
    description:
      "Leitura de melhorias e colaboração em tarefas e especificações.",
    permissions: [
      "demands.read",
      "demands.specification.update",
      "demands.attachment.read",
      "tasks.status.update",
      "tasks.note.create",
      "tasks.attachment.read",
      "tasks.attachment.create",
    ],
  },
  {
    id: "monitor-executor",
    name: "Executor de monitoramento",
    description:
      "Identidade técnica isolada que apenas adquire e publica execuções de monitoramento ativo.",
    permissions: ["monitoring.active.execute"],
  },
  {
    id: "agent-operator",
    name: "Agente operacional",
    description:
      "Operações estruturadas expostas pelo MCP, sem administração de identidades, permissões ou auditoria.",
    permissions: [
      "workspaces.read",
      "applications.read",
      "applications.create",
      "applications.update",
      "integrations.read",
      "integrations.create",
      "integrations.update",
      "components.read",
      "components.create",
      "components.update",
      "repositories.read",
      "repositories.create",
      "repositories.update",
      "servers.read",
      "servers.create",
      "servers.update",
      "deployments.read",
      "deployments.create",
      "deployments.update",
      "runtimes.read",
      "runtimes.create",
      "runtimes.update",
      "monitoring.signals.create",
      "issues.read",
      "issues.create",
      "issues.update",
      "issues.status.update",
      "issues.classification.update",
      "issues.comment.create",
      "issues.comment.update",
      "issues.attachment.read",
      "issues.attachment.create",
      "issues.attachment.update",
      "issues.attachment.delete",
      "issues.import.eml",
      "demands.read",
      "demands.create",
      "demands.update",
      "demands.note.create",
      "demands.specification.update",
      "demands.attachment.read",
      "demands.attachment.create",
      "demands.attachment.update",
      "demands.attachment.delete",
      "tasks.create",
      "tasks.update",
      "tasks.status.update",
      "tasks.delete",
      "tasks.note.create",
      "tasks.note.update",
      "tasks.note.delete",
      "tasks.attachment.read",
      "taxonomy.read",
      "taxonomy.manage",
      "documents.read",
      "documents.create",
      "documents.update",
      "documents.attachment.read",
      "documents.attachment.create",
      "documents.attachment.update",
      "documents.attachment.delete",
      "skills.read",
      "secrets.metadata.read",
      "secrets.metadata.create",
    ],
  },
]);

type SeedWorkspace = Pick<WorkspaceDocument, "id" | "default">;
type PermissionGroupSeed = (typeof INITIAL_PERMISSION_GROUPS)[number];

function systemGroupId(workspace: SeedWorkspace, groupId: string) {
  return workspace.default ? groupId : `${workspace.id}:${groupId}`;
}

export function buildSystemGroupSeedPipeline(
  group: PermissionGroupSeed,
  workspace: SeedWorkspace,
  actor: Partial<Actor> = {},
  now = new Date(),
) {
  const initialPermissions = [...group.permissions].sort(compareStrings);
  const preserveOrInitialize = (field: string, initialValue: unknown) => ({
    $ifNull: [`$${field}`, initialValue],
  });

  return [
    {
      $set: {
        name: preserveOrInitialize("name", group.name),
        normalizedName: preserveOrInitialize(
          "normalizedName",
          normalizedName(group.name),
        ),
        description: preserveOrInitialize("description", group.description),
        permissions: preserveOrInitialize("permissions", initialPermissions),
        workspaceId: workspace.id,
        scope: preserveOrInitialize("scope", {
          type: "workspace",
          applicationIds: [],
        }),
        active: preserveOrInitialize("active", true),
        system: true,
        systemKey: group.id,
        createdAt: preserveOrInitialize("createdAt", now),
        createdBy: preserveOrInitialize("createdBy", actor.userId || "system"),
        updatedAt: preserveOrInitialize("updatedAt", now),
        updatedBy: preserveOrInitialize("updatedBy", actor.userId || "system"),
      },
    },
  ];
}

export async function upsertInitialPermissionGroups(
  groups: Collection<GroupDocument>,
  workspace: SeedWorkspace,
  actor: Partial<Actor> = {},
) {
  const now = new Date();
  await Promise.all(
    INITIAL_PERMISSION_GROUPS.map((group) =>
      groups.updateOne(
        { _id: systemGroupId(workspace, group.id) },
        buildSystemGroupSeedPipeline(group, workspace, actor, now),
        { upsert: true },
      ),
    ),
  );
}
