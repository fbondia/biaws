import { AccountView } from "../../components/auth/AccountView.jsx";
import { GroupsView } from "../../components/auth/GroupsView.jsx";
import { UsersView } from "../../components/auth/UsersView.jsx";
import { CatalogView } from "../../components/catalog/CatalogView/index.jsx";
import { ServersView } from "../../components/catalog/ServersView.jsx";
import { IssuesView } from "../../components/issues/IssuesView.jsx";
import { ProceduresView } from "../../components/procedures/ProceduresView/index.jsx";
import { RequestsView } from "../../components/requests/RequestsView/index.jsx";
import { OptionListsView } from "../../components/settings/OptionListsView/index.jsx";
import { SkillsView } from "../../components/skills/SkillsView/index.jsx";
import { IssueTaxonomyManager } from "../../components/taxonomy/IssueTaxonomyManager/index.jsx";
import { HomeView } from "../../components/home/HomeView.jsx";
import { WorkspaceAdminView } from "../../components/platform/WorkspaceAdminView.jsx";

export function ActiveView({
  activeView,
  actor,
  issuesProps,
  loadRuntimeOptionLists,
  onSignOut,
  runtimeOptionsVersion,
}) {
  if (activeView === "home") return <HomeView />;
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
      <RequestsView actor={actor} key={`requests-${runtimeOptionsVersion}`} />
    );
  if (activeView === "procedures") return <ProceduresView actor={actor} />;
  if (activeView === "taxonomy") return <IssueTaxonomyManager />;
  if (activeView === "skills") return <SkillsView />;
  if (activeView === "users") return <UsersView actor={actor} />;
  if (activeView === "groups") return <GroupsView actor={actor} />;
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
