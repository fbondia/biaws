import { Suspense, useEffect } from "react";

import { ActiveView } from "./components/ActiveView.jsx";
import { AppHeader } from "./components/AppHeader/index.jsx";
import { useApp } from "./hooks/useApp.js";
import { activeViewFromPath, resolveActiveView } from "./model.js";
import { navigate, useRoute } from "../navigation/location.js";
import { entityUrl, viewUrl } from "../navigation/model.js";

export default function App({ actor, onSignOut, onWorkspaceChange }) {
  const route = useRoute();
  const {
    activeView,
    setActiveView,
    availableNavigationGroups,
    availableViews,
    mobileMenuOpen,
    setMobileMenuOpen,
    issuesProps,
    loadRuntimeOptionLists,
    runtimeOptionsError,
    runtimeOptionsVersion,
  } = useApp(actor, activeViewFromPath(window.location.pathname));

  useEffect(() => {
    if (route.valid) setActiveView(resolveActiveView(actor, route.view));
  }, [actor, route.view, route.valid, setActiveView]);

  useEffect(() => {
    if (route.valid && !route.workspaceId && actor.workspaceId) {
      const url = new URL(window.location.href);
      url.searchParams.set("workspaceId", actor.workspaceId);
      navigate(`${url.pathname}${url.search}`, {
        replace: true,
      });
    }
  }, [route.valid, route.workspaceId, actor.workspaceId]);

  function selectActiveView(view) {
    const nextView = resolveActiveView(actor, view);
    navigate(viewUrl(nextView, actor.workspaceId));
    setActiveView(nextView);
  }

  function openRequestTask(task) {
    if (!task?.requestId || !task?.id) return;
    navigate(entityUrl("task", task, { view: "requests", selections: {}, workspaceId: actor.workspaceId }));
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
        onViewChange={selectActiveView}
        onWorkspaceChange={(workspaceId) => onWorkspaceChange(workspaceId, activeView)}
      />
      {runtimeOptionsError ? (
        <div className="errorBox" role="alert">
          <p>{runtimeOptionsError}</p>
          <button className="secondaryButton" onClick={() => loadRuntimeOptionLists().catch(() => {})} type="button">
            Tentar carregar opções novamente
          </button>
        </div>
      ) : null}
      {!route.valid || resolveActiveView(actor, route.view) !== route.view ? (
        <div className="errorBox" role="alert">
          {!route.valid ? "Endereço não encontrado." : "Você não tem permissão para acessar este recurso."}
        </div>
      ) : (
        <Suspense
          fallback={
            <div aria-busy="true" className="emptyState" role="status">
              Carregando visão…
            </div>
          }
        >
          <ActiveView
            activeView={route.view}
            actor={actor}
            issuesProps={issuesProps}
            loadRuntimeOptionLists={loadRuntimeOptionLists}
            onOpenRequestTask={openRequestTask}
            onSignOut={onSignOut}
            runtimeOptionsVersion={runtimeOptionsVersion}
          />
        </Suspense>
      )}
    </main>
  );
}
