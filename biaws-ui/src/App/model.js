import {
  ClipboardList,
  ListChecks,
  CheckSquare,
  FileText,
  BriefcaseBusiness,
  List,
  Tags,
  Layers3,
  Package,
  Users,
  ShieldCheck,
  Server,
  BookOpen,
  LifeBuoy,
  House,
} from "lucide-react";

export const APP_VIEWS = [
  {
    key: "home",
    label: "Início",
    icon: House,
    permission: null,
  },
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
  {
    key: "procedures",
    label: "Procedimentos",
    icon: BookOpen,
    permission: "procedures.read",
  },
];

export const SETTINGS_VIEWS = [
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
  {
    key: "option-lists",
    label: "Listas de Opções",
    icon: List,
    permission: "option_lists.read",
  },
  {
    key: "taxonomy",
    label: "Taxonomia",
    icon: Tags,
    permission: "taxonomy.read",
  },
  { key: "skills", label: "Skills", icon: Package, permission: "skills.read" },
  { key: "users", label: "Usuários", icon: Users, permission: "users.read" },
  {
    key: "groups",
    label: "Grupos",
    icon: ShieldCheck,
    permission: "roles.read",
  },
];

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
