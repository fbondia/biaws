import { useEffect, useState } from "react";

import { ActiveView } from "./components/ActiveView.jsx";
import { AppHeader } from "./components/AppHeader/index.jsx";
import { useApp } from "./hooks/useApp.js";
import {
  activeViewFromPath,
  activeViewPath,
  resolveActiveView,
} from "./model.js";

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
  } = useApp(actor, activeViewFromPath(window.location.pathname));

  useEffect(() => {
    const expectedPath = activeViewPath(activeView);
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState(null, "", expectedPath);
    }
  }, [activeView]);

  useEffect(() => {
    function restoreViewFromHistory() {
      setActiveView(
        resolveActiveView(actor, activeViewFromPath(window.location.pathname)),
      );
    }

    window.addEventListener("popstate", restoreViewFromHistory);
    return () => window.removeEventListener("popstate", restoreViewFromHistory);
  }, [actor, setActiveView]);

  function selectActiveView(view) {
    const nextView = resolveActiveView(actor, view);
    const nextPath = activeViewPath(nextView);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
    setActiveView(nextView);
  }

  function openRequestTask(task) {
    if (!task?.requestId || !task?.id) return;
    setRequestTaskTarget({ requestId: task.requestId, taskId: task.id });
    selectActiveView("requests");
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
        onViewChange={selectActiveView}
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
