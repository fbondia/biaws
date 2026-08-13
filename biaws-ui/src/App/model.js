import {
  Activity,
  ListChecks,
  BriefcaseBusiness,
  List,
  Tags,
  Layers3,
  Package,
  Users,
  ShieldCheck,
  Server,
  BookOpen,
  House,
  Settings,
  KeyRound,
  FileCode2,
} from "lucide-react";

export const APP_VIEWS = [
  {
    key: "home",
    label: "Início",
    icon: House,
    permission: null,
  },
];

export const NAVIGATION_GROUPS = [
  {
    key: "operation",
    label: "Operação",
    icon: Activity,
    sections: [
      {
        key: "work",
        label: "Trabalho",
        views: [
          {
            key: "issues",
            label: "Chamados",
            icon: ListChecks,
            permission: "issues.read",
          },
          {
            key: "requests",
            label: "Melhorias",
            icon: BriefcaseBusiness,
            permission: "demands.read",
          },
        ],
      },
      {
        key: "environment",
        label: "Ambiente",
        views: [
          {
            key: "catalog",
            label: "Aplicações",
            icon: Layers3,
            permission: "applications.read",
          },
          {
            key: "servers",
            label: "Servidores",
            icon: Server,
            permission: "servers.read",
          },
        ],
      },
      {
        key: "knowledge",
        label: "Conhecimento",
        views: [
          {
            key: "documents",
            label: "Documentação",
            icon: BookOpen,
            permission: "documents.read",
          },
          {
            key: "skills",
            label: "Skills",
            icon: Package,
            permission: "skills.read",
          },
        ],
      },
    ],
  },
  {
    key: "administration",
    label: "Administração",
    icon: Settings,
    sections: [
      {
        key: "classification",
        label: "Classificação",
        views: [
          {
            key: "option-lists",
            label: "Listas",
            icon: List,
            permission: "option_lists.read",
          },
          {
            key: "taxonomy",
            label: "Taxonomia",
            icon: Tags,
            permission: "taxonomy.read",
          },
          {
            key: "monitoring-templates",
            label: "Templates de monitoramento",
            icon: FileCode2,
            permission: "runtimes.read",
          },
        ],
      },
      {
        key: "access",
        label: "Acesso",
        views: [
          {
            key: "secrets",
            label: "Segredos",
            icon: KeyRound,
            permission: "secrets.metadata.read",
          },
          {
            key: "users",
            label: "Usuários",
            icon: Users,
            permission: "users.read",
          },
          {
            key: "groups",
            label: "Grupos",
            icon: ShieldCheck,
            permission: "roles.read",
          },
        ],
      },
    ],
  },
];

export const GROUPED_VIEWS = NAVIGATION_GROUPS.flatMap(({ sections }) =>
  sections.flatMap(({ views }) => views),
);

const VIEW_ROUTES = {
  account: "/account",
  catalog: "/catalog",
  documents: "/documents",
  groups: "/groups",
  home: "/",
  issues: "/issues",
  "option-lists": "/option-lists",
  "monitoring-templates": "/monitoring-templates",
  requests: "/requests",
  secrets: "/secrets",
  servers: "/servers",
  skills: "/skills",
  taxonomy: "/taxonomy",
  users: "/users",
  "workspace-admin": "/workspaces",
};

export function activeViewPath(view) {
  return VIEW_ROUTES[view] || VIEW_ROUTES.home;
}

export function activeViewFromPath(pathname) {
  const normalizedPath = `/${String(pathname || "")
    .split("/")
    .filter(Boolean)
    .join("/")}`;
  return Object.entries(VIEW_ROUTES).find(
    ([, route]) => route === normalizedPath,
  )?.[0];
}

export function resolveActiveView(actor, preferredView) {
  const canManageWorkspaces = actor?.platformPermissions?.includes(
    "platform.workspaces.manage",
  );

  if (preferredView === "account") return preferredView;
  if (preferredView === "workspace-admin" && canManageWorkspaces) {
    return preferredView;
  }

  if (!actor?.workspaceId) {
    return canManageWorkspaces ? "workspace-admin" : "account";
  }

  const preferredNavigationView = [...APP_VIEWS, ...GROUPED_VIEWS].find(
    ({ key }) => key === preferredView,
  );
  if (
    preferredNavigationView &&
    (!preferredNavigationView.permission ||
      actor.permissions?.includes(preferredNavigationView.permission)) &&
    (!preferredNavigationView.platformPermission ||
      actor.platformPermissions?.includes(
        preferredNavigationView.platformPermission,
      ))
  ) {
    return preferredView;
  }

  return (
    [...APP_VIEWS, ...GROUPED_VIEWS].find(
      ({ permission, platformPermission }) =>
        !platformPermission &&
        (!permission || actor.permissions?.includes(permission)),
    )?.key || "account"
  );
}

export const ISSUES_PER_PAGE = 25;
export const DEFAULT_ISSUE_SORT = "-date";

export function canOpenWorkspaceSwitcher(actor) {
  return Boolean(
    actor?.platformPermissions?.includes("platform.workspaces.manage") ||
    actor?.workspaces?.length > 1,
  );
}

export function currentWorkspaceName(actor) {
  return (
    actor?.workspaces?.find(({ id }) => id === actor.workspaceId)?.name ||
    "Workspaces"
  );
}

function shellQuote(value) {
  return `'${String(value || "").replaceAll("'", `'"'"'`)}'`;
}

export function buildLocalWorkspaceSetupCommand({
  client = "codex",
  instance,
  projectDirectory,
  workspaceId,
}) {
  const normalizedClient = client === "claude" ? "claude" : "codex";
  return `./scripts/setup-agent.sh \\
  --instance ${shellQuote(instance || "nome-da-instancia")} \\
  --client ${normalizedClient} \\
  --project ${shellQuote(projectDirectory || "/caminho/absoluto/do/projeto")} \\
  --workspace ${shellQuote(workspaceId)} \\
  --skip-bootstrap`;
}

function localInstanceEnvPath(instance) {
  return `instances/${instance || "nome-da-instancia"}/.env`;
}

function localSkillTarget(client, projectDirectory) {
  const project = String(
    projectDirectory || "/caminho/absoluto/do/projeto",
  ).replace(/\/+$/u, "");
  return `${project}/${client === "claude" ? ".claude" : ".agents"}/skills`;
}

function cliPrefix(instance) {
  return `BIAWS_ENV_FILE=${shellQuote(localInstanceEnvPath(instance))} \\
node biaws-cli/src/index.js`;
}

export function buildLocalDevelopmentCommands({
  client = "codex",
  instance,
  projectDirectory,
  workspaceId,
}) {
  const normalizedClient = client === "claude" ? "claude" : "codex";
  const prefix = cliPrefix(instance);
  const project = shellQuote(
    projectDirectory || "/caminho/absoluto/do/projeto",
  );
  const workspace = shellQuote(workspaceId);
  const target = shellQuote(
    localSkillTarget(normalizedClient, projectDirectory),
  );
  const skillDirectory = shellQuote(
    `${localSkillTarget(normalizedClient, projectDirectory)}/minha-skill`,
  );

  return {
    setup: buildLocalWorkspaceSetupCommand({
      client: normalizedClient,
      instance,
      projectDirectory,
      workspaceId,
    }),
    configure: `${prefix} \\
  agent configure ${normalizedClient} \\
  --project ${project} \\
  --workspace ${workspace}`,
    installSkills: `${prefix} \\
  skills install-all \\
  --target ${target} \\
  --workspace ${workspace}`,
    updateSkills: `${prefix} \\
  skills update \\
  --target ${target} \\
  --workspace ${workspace}`,
    publishSkill: `${prefix} \\
  skills publish \\
  --dir ${skillDirectory} \\
  --version 1.0.0 \\
  --workspace ${workspace}`,
    publishAllSkills: `${prefix} \\
  skills publish-all \\
  --dir ${target} \\
  --initial-version 1.0.0 \\
  --workspace ${workspace}`,
    doctor: `${prefix} \\
  agent doctor ${normalizedClient} \\
  --project ${project} \\
  --workspace ${workspace}`,
  };
}

export function compactSummaryParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    ),
  );
}

export function monthBounds(monthKey) {
  const [year, month] = String(monthKey || "")
    .split("-")
    .map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function buildMonthSummaryParams(filters, monthKey) {
  const bounds = monthBounds(monthKey);

  if (!bounds) return null;

  return compactSummaryParams({
    ...filters,
    from:
      filters.from && filters.from > bounds.from ? filters.from : bounds.from,
    to: filters.to && filters.to < bounds.to ? filters.to : bounds.to,
  });
}
