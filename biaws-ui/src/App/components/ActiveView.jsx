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
  if (activeView === "home") {
    return <HomeView onOpenRequestTask={onOpenRequestTask} />;
  }
  if (activeView === "workspace-admin") {
    return <WorkspaceAdminView actor={actor} />;
  }
  if (activeView === "catalog") return <CatalogView actor={actor} />;
  if (activeView === "servers") return <ServersView actor={actor} />;
  if (activeView === "issues")
    return (
      <IssuesView key={`issues-${runtimeOptionsVersion}`} {...issuesProps} />
    );
  if (activeView === "requests")
    return (
      <RequestsView
        actor={actor}
        initialTaskTarget={requestTaskTarget}
        key={`requests-${runtimeOptionsVersion}`}
        onInitialTaskTargetHandled={onRequestTaskTargetHandled}
      />
    );
  if (activeView === "documents") return <KnowledgeRecordsView actor={actor} />;
  if (activeView === "taxonomy") return <IssueTaxonomyManager />;
  if (activeView === "skills") return <SkillsView actor={actor} />;
  if (activeView === "users") return <UsersView actor={actor} />;
  if (activeView === "groups") return <GroupsView actor={actor} />;
  if (activeView === "secrets") return <SecretsView actor={actor} />;
  if (activeView === "option-lists") {
    return (
      <OptionListsView
        actor={actor}
        onRuntimeChanged={loadRuntimeOptionLists}
      />
    );
  }
  return <AccountView actor={actor} onSignOut={onSignOut} />;
}
