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
  [
    "monitoring.signals.create",
    "Monitoramento",
    "Enviar sinais de saúde de runtimes",
  ],
  [
    "monitoring.active.execute",
    "Monitoramento",
    "Executar monitoramentos ativos de runtimes",
  ],

  ["issues.read", "Chamados", "Consultar chamados"],
  ["issues.create", "Chamados", "Criar chamados"],
  ["issues.update", "Chamados", "Alterar dados gerais de chamados"],
  ["issues.status.update", "Chamados", "Alterar o status de chamados"],
  ["issues.comment.create", "Chamados", "Adicionar comentários a chamados"],
  ["issues.comment.update", "Chamados", "Alterar comentários de chamados"],
  [
    "issues.classification.update",
    "Chamados",
    "Alterar a classificação de chamados",
  ],
  ["issues.import.eml", "Chamados", "Importar chamados a partir de EML"],
  ["issues.attachment.read", "Chamados", "Baixar anexos de chamados"],
  ["issues.attachment.create", "Chamados", "Adicionar anexos a chamados"],
  [
    "issues.attachment.update",
    "Chamados",
    "Alterar metadados de anexos de chamados",
  ],
  ["issues.attachment.delete", "Chamados", "Excluir anexos de chamados"],

  ["demands.read", "Melhorias", "Consultar melhorias"],
  ["demands.create", "Melhorias", "Criar melhorias"],
  ["demands.update", "Melhorias", "Alterar dados gerais de melhorias"],
  ["demands.delete", "Melhorias", "Excluir melhorias"],
  ["demands.reorder", "Melhorias", "Reordenar melhorias"],
  ["demands.note.create", "Melhorias", "Adicionar anotações a melhorias"],
  ["demands.note.update", "Melhorias", "Alterar anotações de melhorias"],
  ["demands.note.delete", "Melhorias", "Excluir anotações de melhorias"],
  [
    "demands.specification.update",
    "Melhorias",
    "Alterar especificações de melhorias",
  ],
  ["demands.attachment.read", "Melhorias", "Baixar anexos de melhorias"],
  ["demands.attachment.create", "Melhorias", "Adicionar anexos a melhorias"],
  [
    "demands.attachment.update",
    "Melhorias",
    "Alterar metadados de anexos de melhorias",
  ],
  ["demands.attachment.delete", "Melhorias", "Excluir anexos de melhorias"],

  ["tasks.create", "Tarefas", "Criar tarefas de melhorias"],
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
  ["documents.read", "Documentos", "Consultar documentos de conhecimento"],
  ["documents.create", "Documentos", "Criar documentos de conhecimento"],
  ["documents.update", "Documentos", "Alterar documentos de conhecimento"],
  ["documents.archive", "Documentos", "Arquivar documentos de conhecimento"],
  ["documents.attachment.read", "Documentos", "Baixar anexos de documentos"],
  [
    "documents.attachment.create",
    "Documentos",
    "Adicionar anexos a documentos",
  ],
  [
    "documents.attachment.update",
    "Documentos",
    "Alterar metadados de anexos de documentos",
  ],
  ["documents.attachment.delete", "Documentos", "Excluir anexos de documentos"],
  ["skills.read", "Skills", "Consultar e baixar skills"],
  ["skills.publish", "Skills", "Publicar versões de skills"],
  ["skills.deprecate", "Skills", "Descontinuar versões de skills"],
  ["option_lists.read", "Configurações", "Consultar listas de opções"],
  ["option_lists.manage", "Configurações", "Administrar listas de opções"],

  ["secrets.metadata.read", "Segredos", "Consultar metadados de segredos"],
  [
    "secrets.metadata.create",
    "Segredos",
    "Registrar metadados de segredos pendentes",
  ],
  ["secrets.create", "Segredos", "Criar segredos"],
  ["secrets.update", "Segredos", "Alterar metadados de segredos"],
  ["secrets.value.write", "Segredos", "Gravar novas versões de segredos"],
  ["secrets.value.reveal", "Segredos", "Revelar valores de segredos"],
  ["secrets.use", "Segredos", "Consumir segredos em integrações"],
  ["secrets.archive", "Segredos", "Arquivar segredos"],

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

const permissionSectionRules = [
  ["monitoring.active", "Execução ativa"],
  ["monitoring.signals", "Sinais"],
  ["issues.classification", "Fluxo e classificação"],
  ["issues.attachment", "Anexos"],
  ["issues.comment", "Comentários"],
  ["issues.import", "Importação"],
  ["issues.status", "Fluxo e classificação"],
  ["demands.specification", "Especificações"],
  ["demands.attachment", "Anexos"],
  ["demands.note", "Anotações"],
  ["tasks.attachment", "Anexos"],
  ["tasks.note", "Anotações"],
  ["tasks.status", "Status"],
  ["documents.attachment", "Anexos"],
  ["secrets.metadata", "Metadados"],
  ["secrets.value", "Valores"],
  ["workspaces", "Workspaces"],
  ["applications", "Aplicações"],
  ["integrations", "Integrações"],
  ["components", "Componentes"],
  ["repositories", "Repositórios"],
  ["servers", "Servidores"],
  ["deployments", "Deployments"],
  ["runtimes", "Runtimes"],
  ["issues", "Geral"],
  ["demands", "Geral"],
  ["tasks", "Geral"],
  ["taxonomy", "Taxonomia"],
  ["documents", "Geral"],
  ["skills", "Skills"],
  ["option_lists", "Listas de opções"],
  ["secrets.use", "Uso"],
  ["secrets", "Gestão"],
  ["users", "Usuários"],
  ["roles", "Grupos de permissões"],
  ["api_keys", "Chaves de API"],
  ["audit", "Auditoria"],
];

function permissionSection(id) {
  const rule = permissionSectionRules.find(
    ([prefix]) => id === prefix || id.startsWith(`${prefix}.`),
  );
  if (!rule) throw new Error(`Permission section is not configured: ${id}`);
  return rule[1];
}

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
  if (id.startsWith("documents.") || id.startsWith("secrets.")) return "hybrid";
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
      section: permissionSection(id),
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
