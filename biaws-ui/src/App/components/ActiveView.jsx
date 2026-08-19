import { lazy } from "react";

function lazyNamed(loader, exportName) {
  return lazy(() =>
    loader().then((module) => ({ default: module[exportName] })),
  );
}

const AccountView = lazyNamed(
  () => import("../../components/auth/AccountView.jsx"),
  "AccountView",
);
const GroupsView = lazyNamed(
  () => import("../../components/auth/GroupsView/index.jsx"),
  "GroupsView",
);
const UsersView = lazyNamed(
  () => import("../../components/auth/UsersView.jsx"),
  "UsersView",
);
const CatalogView = lazyNamed(
  () => import("../../components/catalog/CatalogView/index.jsx"),
  "CatalogView",
);
const ServersView = lazyNamed(
  () => import("../../components/catalog/ServersView/index.jsx"),
  "ServersView",
);
const IssuesView = lazyNamed(
  () => import("../../components/issues/IssuesView.jsx"),
  "IssuesView",
);
const RequestsView = lazyNamed(
  () => import("../../components/requests/RequestsView/index.jsx"),
  "RequestsView",
);
const OptionListsView = lazyNamed(
  () => import("../../components/settings/OptionListsView/index.jsx"),
  "OptionListsView",
);
const MonitoringTemplatesView = lazyNamed(
  () => import("../../components/monitoring/index.js"),
  "MonitoringTemplatesView",
);
const MonitoringRuntimesView = lazyNamed(
  () => import("../../components/monitoring/index.js"),
  "MonitoringRuntimesView",
);
const PublicationsView = lazyNamed(
  () => import("../../components/publications/PublicationsView.jsx"),
  "PublicationsView",
);
const SkillsView = lazyNamed(
  () => import("../../components/skills/SkillsView/index.jsx"),
  "SkillsView",
);
const IssueTaxonomyManager = lazyNamed(
  () => import("../../components/taxonomy/IssueTaxonomyManager/index.jsx"),
  "IssueTaxonomyManager",
);
const HomeView = lazyNamed(
  () => import("../../components/home/HomeView/index.jsx"),
  "HomeView",
);
const WorkspaceAdminView = lazyNamed(
  () => import("../../components/platform/WorkspaceAdminView/index.jsx"),
  "WorkspaceAdminView",
);
const SecretsView = lazyNamed(
  () => import("../../components/secrets/SecretsView/index.jsx"),
  "SecretsView",
);
const KnowledgeRecordsView = lazyNamed(
  () => import("../../components/knowledge/KnowledgeRecordsView/index.jsx"),
  "KnowledgeRecordsView",
);

export function ActiveView({
  activeView,
  actor,
  issuesProps,
  loadRuntimeOptionLists,
  onOpenRequestTask,
  onRequestTaskTargetHandled,
  onSignOut,
  requestTaskTarget,
  runtimeOptionsVersion,
}) {
  switch (activeView) {
    case "home":
      return <HomeView actor={actor} onOpenRequestTask={onOpenRequestTask} />;
    case "workspace-admin":
      return <WorkspaceAdminView actor={actor} />;
    case "catalog":
      return <CatalogView actor={actor} />;
    case "servers":
      return <ServersView actor={actor} />;
    case "issues":
      return (
        <IssuesView key={`issues-${runtimeOptionsVersion}`} {...issuesProps} />
      );
    case "requests":
      return (
        <RequestsView
          actor={actor}
          initialTaskTarget={requestTaskTarget}
          key={`requests-${runtimeOptionsVersion}`}
          onInitialTaskTargetHandled={onRequestTaskTargetHandled}
        />
      );
    case "documents":
      return <KnowledgeRecordsView actor={actor} />;
    case "taxonomy":
      return <IssueTaxonomyManager />;
    case "skills":
      return <SkillsView actor={actor} />;
    case "users":
      return <UsersView actor={actor} />;
    case "groups":
      return <GroupsView actor={actor} />;
    case "secrets":
      return <SecretsView actor={actor} />;
    case "option-lists":
      return (
        <OptionListsView
          actor={actor}
          onRuntimeChanged={loadRuntimeOptionLists}
        />
      );
    case "monitoring-templates":
      return <MonitoringTemplatesView actor={actor} />;
    case "monitoring-runtimes":
      return <MonitoringRuntimesView actor={actor} />;
    case "publications":
      return <PublicationsView actor={actor} />;
    default:
      return <AccountView actor={actor} onSignOut={onSignOut} />;
  }
}
