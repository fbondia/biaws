import { useState } from "react";

import { ActiveView } from "./components/ActiveView.jsx";
import { AppHeader } from "./components/AppHeader.jsx";
import { useApp } from "./hooks/useApp.js";

export default function App({ actor, onSignOut, onWorkspaceChange }) {
  const [requestTaskTarget, setRequestTaskTarget] = useState(null);
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

  function openRequestTask(task) {
    if (!task?.requestId || !task?.id) return;
    setRequestTaskTarget({ requestId: task.requestId, taskId: task.id });
    setActiveView("requests");
  }

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
        onOpenRequestTask={openRequestTask}
        onRequestTaskTargetHandled={() => setRequestTaskTarget(null)}
        onSignOut={onSignOut}
        requestTaskTarget={requestTaskTarget}
        runtimeOptionsVersion={runtimeOptionsVersion}
      />
    </main>
  );
}
