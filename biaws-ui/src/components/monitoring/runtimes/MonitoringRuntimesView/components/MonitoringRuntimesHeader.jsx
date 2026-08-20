import {
  LayoutDashboard,
  ListFilter,
  Network,
  RefreshCw,
  Settings2,
} from "lucide-react";

export function MonitoringRuntimesHeader({ controller }) {
  const { dashboard, loading, monitoredOnly, viewMode, workspace } = controller;
  return (
    <header className="monitoringCenterHero">
      <div>
        <span>{workspace?.name || "Monitoramento"}</span>
        <h1>Runtimes monitorados</h1>
        <p>
          Navegue pela topologia operacional e gerencie monitores sem alterar o
          catálogo.
        </p>
      </div>
      <div className="monitoringCenterHeroActions">
        <div
          aria-label="Modo da central de monitoramento"
          className="monitoringCenterModeSwitch"
          role="group"
        >
          <button
            aria-pressed={viewMode === "navigation"}
            onClick={() => controller.setViewMode("navigation")}
            type="button"
          >
            <Network size={16} /> Navegação
          </button>
          <button
            aria-pressed={viewMode === "dashboard"}
            onClick={() => controller.setViewMode("dashboard")}
            type="button"
          >
            <LayoutDashboard size={16} /> Painel
          </button>
        </div>

        {viewMode === "navigation" ? (
          <>
            <button
              aria-pressed={monitoredOnly}
              className={
                monitoredOnly
                  ? "secondaryButton monitoringRuntimeFilter active"
                  : "secondaryButton monitoringRuntimeFilter"
              }
              disabled={loading}
              onClick={controller.toggleMonitoredOnly}
              type="button"
            >
              <ListFilter size={16} /> Somente monitorados
            </button>
            <button
              aria-label="Atualizar navegação"
              className="iconButton"
              disabled={loading}
              onClick={controller.refreshNavigation}
              type="button"
            >
              <RefreshCw size={17} />
            </button>
          </>
        ) : null}

        {viewMode === "dashboard" ? (
          <>
            <button
              className="primaryButton"
              disabled={dashboard.loading}
              onClick={() => dashboard.ref.current?.configure()}
              type="button"
            >
              <Settings2 size={16} /> Configurar painel
            </button>
            <button
              aria-label="Atualizar painel"
              className="iconButton"
              disabled={dashboard.loading}
              onClick={() => dashboard.ref.current?.refresh()}
              type="button"
            >
              <RefreshCw
                className={dashboard.loading ? "spinIcon" : undefined}
                size={17}
              />
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
