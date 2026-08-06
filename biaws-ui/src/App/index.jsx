import { ActiveView } from "./components/ActiveView.jsx";
import { AppHeader } from "./components/AppHeader.jsx";
import { useApp } from "./hooks/useApp.js";

export default function App({ actor, onSignOut, onWorkspaceChange }) {
  const {
    activeView,
    setActiveView,
    availableNavigationGroups,
    availableViews,
    mobileMenuOpen,
    setMobileMenuOpen,
    issuesProps,
    loadRuntimeOptionLists,
    runtimeOptionsVersion,
  } = useApp(actor);
  return (
    <main className="appShell">
      <AppHeader
        activeView={activeView}
        actor={actor}
        availableNavigationGroups={availableNavigationGroups}
        availableViews={availableViews}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuChange={setMobileMenuOpen}
        onViewChange={setActiveView}
        onWorkspaceChange={onWorkspaceChange}
      />
      <ActiveView
        activeView={activeView}
        actor={actor}
        issuesProps={issuesProps}
        loadRuntimeOptionLists={loadRuntimeOptionLists}
        onSignOut={onSignOut}
        runtimeOptionsVersion={runtimeOptionsVersion}
      />
    </main>
  );
}
