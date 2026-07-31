const definitions = [
  ["workspaces.read", "Catálogo", "Consultar workspaces"],
  ["workspaces.manage", "Catálogo", "Administrar workspaces"],
  ["applications.read", "Catálogo", "Consultar aplicações"],
  ["applications.create", "Catálogo", "Criar aplicações"],
  ["applications.update", "Catálogo", "Alterar aplicações"],
  ["applications.archive", "Catálogo", "Arquivar aplicações"],
  ["integrations.read", "Catálogo", "Consultar integrações"],
  ["integrations.create", "Catálogo", "Criar integrações"],
  ["integrations.update", "Catálogo", "Alterar integrações"],
  ["integrations.archive", "Catálogo", "Arquivar integrações"],
  ["components.read", "Catálogo", "Consultar componentes"],
  ["components.create", "Catálogo", "Criar componentes"],
  ["components.update", "Catálogo", "Alterar componentes"],
  ["components.archive", "Catálogo", "Arquivar componentes"],
  ["repositories.read", "Catálogo", "Consultar repositórios"],
  ["repositories.create", "Catálogo", "Criar repositórios"],
  ["repositories.update", "Catálogo", "Alterar repositórios"],
  ["repositories.archive", "Catálogo", "Arquivar repositórios"],
  ["servers.read", "Catálogo", "Consultar servidores"],
  ["servers.create", "Catálogo", "Criar servidores"],
  ["servers.update", "Catálogo", "Alterar servidores"],
  ["servers.archive", "Catálogo", "Arquivar servidores"],
  ["deployments.read", "Catálogo", "Consultar deployments"],
  ["deployments.create", "Catálogo", "Criar deployments"],
  ["deployments.update", "Catálogo", "Alterar deployments"],
  ["deployments.archive", "Catálogo", "Arquivar deployments"],
  ["runtimes.read", "Catálogo", "Consultar runtimes"],
  ["runtimes.create", "Catálogo", "Criar runtimes"],
  ["runtimes.update", "Catálogo", "Alterar runtimes"],
  ["runtimes.archive", "Catálogo", "Arquivar runtimes"],

  ["issues.read", "Issues", "Consultar issues"],
  ["issues.create", "Issues", "Criar issues"],
  ["issues.update", "Issues", "Alterar dados gerais de issues"],
  ["issues.status.update", "Issues", "Alterar o status de issues"],
  ["issues.comment.create", "Issues", "Adicionar comentários a issues"],
  ["issues.comment.update", "Issues", "Alterar comentários de issues"],
  [
    "issues.classification.update",
    "Issues",
    "Alterar a classificação de issues",
  ],
  ["issues.import.eml", "Issues", "Importar issues a partir de EML"],
  ["issues.attachment.read", "Issues", "Baixar anexos de issues"],
  ["issues.attachment.create", "Issues", "Adicionar anexos a issues"],
  [
    "issues.attachment.update",
    "Issues",
    "Alterar metadados de anexos de issues",
  ],
  ["issues.attachment.delete", "Issues", "Excluir anexos de issues"],

  ["demands.read", "Demandas", "Consultar demandas"],
  ["demands.create", "Demandas", "Criar demandas"],
  ["demands.update", "Demandas", "Alterar dados gerais de demandas"],
  ["demands.delete", "Demandas", "Excluir demandas"],
  ["demands.reorder", "Demandas", "Reordenar demandas"],
  ["demands.note.create", "Demandas", "Adicionar anotações a demandas"],
  ["demands.note.update", "Demandas", "Alterar anotações de demandas"],
  ["demands.note.delete", "Demandas", "Excluir anotações de demandas"],
  [
    "demands.specification.update",
    "Demandas",
    "Alterar especificações de demandas",
  ],
  ["demands.attachment.read", "Demandas", "Baixar anexos de demandas"],
  ["demands.attachment.create", "Demandas", "Adicionar anexos a demandas"],
  [
    "demands.attachment.update",
    "Demandas",
    "Alterar metadados de anexos de demandas",
  ],
  ["demands.attachment.delete", "Demandas", "Excluir anexos de demandas"],

  ["tasks.create", "Tarefas", "Criar tarefas de demandas"],
  ["tasks.update", "Tarefas", "Alterar dados gerais de tarefas"],
  ["tasks.status.update", "Tarefas", "Alterar o status de tarefas"],
  ["tasks.delete", "Tarefas", "Excluir tarefas"],
  ["tasks.note.create", "Tarefas", "Adicionar anotações a tarefas"],
  ["tasks.note.update", "Tarefas", "Alterar anotações de tarefas"],
  ["tasks.note.delete", "Tarefas", "Excluir anotações de tarefas"],
  ["tasks.attachment.read", "Tarefas", "Baixar anexos de tarefas"],
  ["tasks.attachment.create", "Tarefas", "Adicionar anexos a tarefas"],
  [
    "tasks.attachment.update",
    "Tarefas",
    "Alterar metadados de anexos de tarefas",
  ],
  ["tasks.attachment.delete", "Tarefas", "Excluir anexos de tarefas"],

  ["taxonomy.read", "Conhecimento", "Consultar a taxonomia"],
  ["taxonomy.manage", "Conhecimento", "Administrar a taxonomia"],
  ["procedures.read", "Procedimentos", "Consultar procedimentos"],
  ["procedures.create", "Procedimentos", "Criar procedimentos"],
  ["procedures.update", "Procedimentos", "Alterar procedimentos"],
  ["procedures.delete", "Procedimentos", "Excluir procedimentos"],
  [
    "procedures.attachment.read",
    "Procedimentos",
    "Baixar anexos de procedimentos",
  ],
  [
    "procedures.attachment.create",
    "Procedimentos",
    "Adicionar anexos a procedimentos",
  ],
  [
    "procedures.attachment.update",
    "Procedimentos",
    "Alterar metadados de anexos de procedimentos",
  ],
  [
    "procedures.attachment.delete",
    "Procedimentos",
    "Excluir anexos de procedimentos",
  ],
  ["skills.read", "Skills", "Consultar e baixar skills"],
  ["skills.publish", "Skills", "Publicar versões de skills"],
  ["skills.deprecate", "Skills", "Descontinuar versões de skills"],
  ["option_lists.read", "Configurações", "Consultar listas de opções"],
  ["option_lists.manage", "Configurações", "Administrar listas de opções"],

  ["users.read", "Administração", "Consultar usuários"],
  ["users.create", "Administração", "Criar usuários"],
  ["users.update", "Administração", "Alterar usuários"],
  ["users.disable", "Administração", "Ativar ou desativar usuários"],
  ["users.password.reset", "Administração", "Redefinir senhas de usuários"],
  ["roles.read", "Administração", "Consultar grupos de permissões"],
  ["roles.manage", "Administração", "Administrar grupos de permissões"],
  [
    "api_keys.manage.self",
    "Administração",
    "Administrar as próprias chaves de API",
  ],
  [
    "api_keys.manage.all",
    "Administração",
    "Administrar chaves de API de outros usuários",
  ],
  ["audit.read", "Administração", "Consultar a trilha de auditoria"],
];

const workspacePermissionIds = new Set([
  "workspaces.read",
  "workspaces.manage",
  "applications.create",
]);

const workspacePermissionPrefixes = [
  "servers.",
  "taxonomy.",
  "skills.",
  "option_lists.",
  "users.",
  "roles.",
  "api_keys.",
  "audit.",
];

function permissionScope(id) {
  if (id.startsWith("procedures.")) return "hybrid";
  if (
    workspacePermissionIds.has(id) ||
    workspacePermissionPrefixes.some((prefix) => id.startsWith(prefix))
  ) {
    return "workspace";
  }
  return "application";
}

export const PERMISSION_CATALOG = Object.freeze(
  definitions.map(([id, domain, description]) =>
    Object.freeze({
      id,
      domain,
      label: description,
      description,
      scope: permissionScope(id),
    }),
  ),
);

export const PERMISSIONS = Object.freeze(
  Object.fromEntries(
    PERMISSION_CATALOG.map((permission) => [
      permission.id.replaceAll(".", "_").toUpperCase(),
      permission.id,
    ]),
  ),
);

const permissionIds = new Set(PERMISSION_CATALOG.map(({ id }) => id));

export function isKnownPermission(permission) {
  return permissionIds.has(permission);
}

export function assertKnownPermissions(permissions) {
  const unknown = [...new Set(permissions)].filter(
    (permission) => !isKnownPermission(permission),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown permissions: ${unknown.join(", ")}`);
  }
}

export function getPermissionScope(permission) {
  return PERMISSION_CATALOG.find(({ id }) => id === permission)?.scope || null;
}
