import { Clock3, Server } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MonitoringMetadataPresentation } from "../shared/MonitoringEventDetails.jsx";

function formatDate(value) {
  if (!value) return "Sem sinal recebido";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function applicationRuntimes(application) {
  return (application?.components || []).flatMap((component) =>
    (component.deployments || []).flatMap((deployment) =>
      (deployment.runtimes || []).map((runtime) => ({
        ...runtime,
        componentName: component.name,
        deploymentName: deployment.name,
      })),
    ),
  );
}

function MonitoringRuntimeButton({ activeRuntimeId, onSelect, runtime }) {
  return (
    <button
      aria-pressed={runtime.id === activeRuntimeId}
      className={runtime.id === activeRuntimeId ? "isActive" : ""}
      onClick={() => onSelect(runtime.id)}
      type="button"
    >
      <div>
        <strong>{runtime.name}</strong>
        <small>
          <Server size={13} />
          {runtime.server?.name || "Sem servidor associado"}
        </small>
      </div>
      <span className={`catalogStatus catalogStatus-${runtime.status}`}>
        {runtime.status}
      </span>
    </button>
  );
}

function MonitoringDeployment({ activeRuntimeId, deployment, onSelect }) {
  return (
    <div className="catalogMonitoringDeployment">
      <span>{deployment.name}</span>
      <div>
        {deployment.runtimes.map((runtime) => (
          <MonitoringRuntimeButton
            activeRuntimeId={activeRuntimeId}
            key={runtime.id}
            onSelect={onSelect}
            runtime={runtime}
          />
        ))}
      </div>
    </div>
  );
}

function MonitoringComponent({ activeRuntimeId, component, onSelect }) {
  return (
    <section>
      <header>
        <strong>{component.name}</strong>
      </header>
      {component.deployments.map((deployment) => (
        <MonitoringDeployment
          activeRuntimeId={activeRuntimeId}
          deployment={deployment}
          key={deployment.id}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}

export function CatalogApplicationMonitoring({ monitoringHealth }) {
  const application = monitoringHealth?.details?.items?.[0];
  const runtimes = useMemo(
    () => applicationRuntimes(application),
    [application],
  );
  const [runtimeId, setRuntimeId] = useState("");
  const activeRuntime =
    runtimes.find(({ id }) => id === runtimeId) || runtimes[0];

  useEffect(() => {
    if (!runtimes.some(({ id }) => id === runtimeId)) {
      setRuntimeId(runtimes[0]?.id || "");
    }
  }, [runtimeId, runtimes]);

  return (
    <article className="catalogOverviewCard catalogApplicationMonitoring">
      <header>
        <div>
          <h3>Monitoramento</h3>
          <p>Componentes e dados do último sinal recebido por runtime.</p>
        </div>
      </header>
      {!application || !runtimes.length ? (
        <div className="catalogColumnEmpty">
          Nenhum runtime com sinais de monitoramento.
        </div>
      ) : (
        <div className="catalogApplicationMonitoringLayout">
          <div className="catalogMonitoringTopology">
            {application.components.map((component) => (
              <MonitoringComponent
                activeRuntimeId={activeRuntime?.id}
                component={component}
                key={component.id}
                onSelect={setRuntimeId}
              />
            ))}
          </div>
          {activeRuntime ? (
            <section className="catalogMonitoringMetadataPanel">
              <header>
                <div>
                  <strong>{activeRuntime.name}</strong>
                  <small>
                    {activeRuntime.componentName} ·{" "}
                    {activeRuntime.deploymentName}
                  </small>
                </div>
                <span
                  className={`catalogStatus catalogStatus-${activeRuntime.status}`}
                >
                  {activeRuntime.status}
                </span>
              </header>
              <div className="catalogMonitoringLastSignal">
                <Clock3 size={14} />
                <span>
                  Última entrada: {formatDate(activeRuntime.observedAt)}
                  {activeRuntime.source ? ` · ${activeRuntime.source}` : ""}
                  {activeRuntime.message ? ` · ${activeRuntime.message}` : ""}
                </span>
              </div>
              {activeRuntime.latestSignal?.metadata &&
              Object.keys(activeRuntime.latestSignal.metadata).length ? (
                <MonitoringMetadataPresentation
                  event={activeRuntime.latestSignal}
                  showRawFallback
                />
              ) : (
                <div className="catalogColumnEmpty">
                  O último sinal não possui metadados.
                </div>
              )}
            </section>
          ) : null}
        </div>
      )}
    </article>
  );
}
