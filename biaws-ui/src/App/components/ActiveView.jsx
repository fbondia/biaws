import { AccountView } from "../../components/auth/AccountView.jsx";
import { GroupsView } from "../../components/auth/GroupsView/index.jsx";
import { UsersView } from "../../components/auth/UsersView.jsx";
import { CatalogView } from "../../components/catalog/CatalogView/index.jsx";
import { ServersView } from "../../components/catalog/ServersView/index.jsx";
import { IssuesView } from "../../components/issues/IssuesView.jsx";
import { RequestsView } from "../../components/requests/RequestsView/index.jsx";
import { OptionListsView } from "../../components/settings/OptionListsView/index.jsx";
import { SkillsView } from "../../components/skills/SkillsView/index.jsx";
import { IssueTaxonomyManager } from "../../components/taxonomy/IssueTaxonomyManager/index.jsx";
import { HomeView } from "../../components/home/HomeView/index.jsx";
import { WorkspaceAdminView } from "../../components/platform/WorkspaceAdminView/index.jsx";
import { SecretsView } from "../../components/secrets/SecretsView/index.jsx";
import { KnowledgeRecordsView } from "../../components/knowledge/KnowledgeRecordsView/index.jsx";

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
