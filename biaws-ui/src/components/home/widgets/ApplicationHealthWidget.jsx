import { Clock3, History, Play, Server } from "lucide-react";
import { useState } from "react";

import { MonitoringMetadataPresentation } from "../../shared/MonitoringEventDetails/index.jsx";
import { formatMonitoringDate } from "./widgetUtils.js";

function applicationRuntimes(application) {
  return (application?.components || []).flatMap((component) =>
    (component.deployments || []).flatMap((deployment) =>
      (deployment.runtimes || []).map((runtime) => ({
        ...runtime,
        applicationId: application.id,
        componentName: component.name,
        deploymentName: deployment.name,
      })),
    ),
  );
}

function HealthMetadataExplorer({
  applications,
  canRequestExecution,
  hideTabs,
  onRequestExecution,
  onSelectRuntime,
  selectedApplicationId,
  selectedRuntimeId,
}) {
  const [applicationId, setApplicationId] = useState(
    () => applications[0]?.id || "",
  );
  const [runtimeId, setRuntimeId] = useState("");
  const activeApplication =
    applications.find(({ id }) => id === selectedApplicationId) ||
    applications.find(({ id }) => id === applicationId) ||
    applications[0];
  const runtimes = applicationRuntimes(activeApplication);
  const activeRuntime =
    runtimes.find(({ id }) => id === selectedRuntimeId) ||
    runtimes.find(({ id }) => id === runtimeId) ||
    runtimes[0];

  function selectApplication(application) {
    setApplicationId(application.id);
    setRuntimeId(applicationRuntimes(application)[0]?.id || "");
  }

  if (!activeApplication || !activeRuntime) return null;
  const hasMetadata = Boolean(
    activeRuntime.latestSignal?.metadata &&
    Object.keys(activeRuntime.latestSignal.metadata).length,
  );

  return (
    <section className="homeHealthMetadataExplorer">
      {!hideTabs ? (
        <>
          <div
            aria-label="Aplicações monitoradas"
            className="homeHealthApplicationTabs"
            role="tablist"
          >
            {applications.map((application) => (
              <button
                aria-selected={application.id === activeApplication.id}
                className={
                  application.id === activeApplication.id
                    ? "isActive"
                    : undefined
                }
                key={application.id}
                onClick={() => selectApplication(application)}
                role="tab"
                type="button"
              >
                {application.name}
              </button>
            ))}
          </div>
          <div
            aria-label={`Runtimes de ${activeApplication.name}`}
            className="homeHealthRuntimeTabs"
            role="tablist"
          >
            {runtimes.map((runtime) => (
              <button
                aria-selected={runtime.id === activeRuntime.id}
                className={
                  runtime.id === activeRuntime.id ? "isActive" : undefined
                }
                key={runtime.id}
                onClick={() => setRuntimeId(runtime.id)}
                role="tab"
                type="button"
              >
                <span className="homeHealthRuntimeTabHeading">
                  <span>{runtime.name}</span>
                  {runtime.status !== "healthy" ? (
                    <span className="homeHealthRuntimeAlertBadge">Não OK</span>
                  ) : null}
                </span>
                <small>{runtime.deploymentName}</small>
              </button>
            ))}
          </div>
        </>
      ) : null}
      <div className="homeHealthMetadataPanel" role="tabpanel">
        <header>
          <div>
            <strong>{activeRuntime.name}</strong>
            <small>
              {activeRuntime.componentName} · {activeRuntime.deploymentName} ·{" "}
              {activeRuntime.server?.name || "Sem servidor associado"}
            </small>
          </div>
          <div className="homeHealthMetadataActions">
            {canRequestExecution?.(activeRuntime) ? (
              <button
                aria-label={`Executar monitor de ${activeRuntime.name}`}
                className="secondaryButton"
                onClick={() => onRequestExecution(activeRuntime)}
                title="Executar monitor agora"
                type="button"
              >
                <Play size={16} />
              </button>
            ) : null}
            <button
              aria-label={`Abrir histórico de ${activeRuntime.name}`}
              className="secondaryButton"
              onClick={() => onSelectRuntime(activeRuntime)}
              type="button"
            >
              <History size={18} />
            </button>
          </div>
        </header>
        <div className="homeHealthMetadataPanelContext">
          <span
            className={`catalogStatus catalogStatus-${activeRuntime.status}`}
          >
            {activeRuntime.status}
          </span>
          <span>
            Última entrada: {formatMonitoringDate(activeRuntime.observedAt)}
          </span>
        </div>
        {hasMetadata ? (
          <MonitoringMetadataPresentation
            event={activeRuntime.latestSignal}
            showRawFallback
          />
        ) : (
          <div className="homeHealthRuntimeMetadataEmpty">
            O último sinal não possui metadados.
          </div>
        )}
      </div>
    </section>
  );
}

function HealthRuntimeCard({
  canRequestExecution,
  onRequestExecution,
  onSelectRuntime,
  runtime,
}) {
  return (
    <div className="homeHealthRuntimeCard">
      <button
        className="homeHealthRuntime"
        onClick={() => onSelectRuntime(runtime)}
        type="button"
      >
        <div className="homeHealthRuntimeIdentity">
          <strong>{runtime.name}</strong>
          <span className="homeHealthServer">
            <Server size={13} />
            {runtime.server?.name || "Sem servidor associado"}
          </span>
          <span className="homeHealthLastSignal">
            <Clock3 size={13} />
            Última entrada: {formatMonitoringDate(runtime.observedAt)}
            {runtime.source ? ` · ${runtime.source}` : ""}
            {runtime.message ? ` · ${runtime.message}` : ""}
          </span>
        </div>
        <span className={`catalogStatus catalogStatus-${runtime.status}`}>
          {runtime.status}
        </span>
      </button>
      {canRequestExecution?.(runtime) ? (
        <button
          aria-label={`Executar monitor de ${runtime.name}`}
          className="iconButton homeHealthRuntimeExecution"
          onClick={() => onRequestExecution(runtime)}
          title="Executar monitor agora"
          type="button"
        >
          <Play size={15} />
        </button>
      ) : null}
    </div>
  );
}

function HealthDeploymentSection({
  applicationId,
  canRequestExecution,
  deployment,
  onRequestExecution,
  onSelectRuntime,
}) {
  return (
    <section>
      <header>
        <div>
          <strong>{deployment.name}</strong>
        </div>
      </header>
      <div className="homeHealthRuntimes">
        {deployment.runtimes.map((runtime) => (
          <HealthRuntimeCard
            canRequestExecution={canRequestExecution}
            key={runtime.id}
            onRequestExecution={onRequestExecution}
            onSelectRuntime={onSelectRuntime}
            runtime={{ ...runtime, applicationId }}
          />
        ))}
      </div>
    </section>
  );
}

function HealthComponentSection({
  applicationId,
  canRequestExecution,
  component,
  onRequestExecution,
  onSelectRuntime,
}) {
  return (
    <section>
      <header>
        <strong>{component.name}</strong>
      </header>
      <div className="homeHealthDeployments">
        {component.deployments.map((deployment) => (
          <HealthDeploymentSection
            applicationId={applicationId}
            canRequestExecution={canRequestExecution}
            deployment={deployment}
            key={deployment.id}
            onRequestExecution={onRequestExecution}
            onSelectRuntime={onSelectRuntime}
          />
        ))}
      </div>
    </section>
  );
}

function HealthApplicationSection({
  application,
  canRequestExecution,
  onRequestExecution,
  onSelectRuntime,
}) {
  return (
    <section className="homeHealthApplication">
      <header>
        <div>
          <strong>{application.name}</strong>
        </div>
        <span className={`catalogStatus catalogStatus-${application.status}`}>
          {application.status}
        </span>
      </header>
      <div className="homeHealthComponents">
        {application.components.map((component) => (
          <HealthComponentSection
            applicationId={application.id}
            canRequestExecution={canRequestExecution}
            component={component}
            key={component.id}
            onRequestExecution={onRequestExecution}
            onSelectRuntime={onSelectRuntime}
          />
        ))}
      </div>
    </section>
  );
}

export function ApplicationHealthWidget({
  canRequestMonitoringExecution,
  config,
  data,
  onRequestExecution,
  onSelectRuntime,
}) {
  const presentation =
    config?.runtimeId || config?.presentation === "tabs" ? "tabs" : "list";

  return (
    <div className="homeHealthWidget">
      {!data.items?.length ? (
        <div className="homeWidgetEmpty">
          Nenhum runtime com sinais de monitoramento.
        </div>
      ) : presentation === "tabs" ? (
        <HealthMetadataExplorer
          applications={data.items}
          canRequestExecution={canRequestMonitoringExecution}
          hideTabs={Boolean(config?.runtimeId)}
          onRequestExecution={onRequestExecution}
          onSelectRuntime={onSelectRuntime}
          selectedApplicationId={config?.applicationId}
          selectedRuntimeId={config?.runtimeId}
        />
      ) : (
        <div className="homeHealthApplications">
          {data.items.map((application) => (
            <HealthApplicationSection
              application={application}
              canRequestExecution={canRequestMonitoringExecution}
              key={application.id}
              onRequestExecution={onRequestExecution}
              onSelectRuntime={onSelectRuntime}
            />
          ))}
        </div>
      )}
    </div>
  );
}
