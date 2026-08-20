import { Clock3, Server } from "lucide-react";
import { useState } from "react";

import {
  MonitoringExecutionButton,
  MonitoringHistoryButton,
} from "../../monitoring/components/MonitoringActions.jsx";
import { MonitoringObservation } from "../../monitoring/components/MonitoringObservation.jsx";
import { MonitoringStatusBadge } from "../../monitoring/components/MonitoringStatusBadge.jsx";
import { formatMonitoringDate } from "../../monitoring/formatters.js";

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
  isExecutionPending,
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
              <MonitoringExecutionButton
                disabled={isExecutionPending?.(activeRuntime)}
                onExecute={onRequestExecution}
                runtime={activeRuntime}
              />
            ) : null}
            <MonitoringHistoryButton
              onOpenHistory={onSelectRuntime}
              runtime={activeRuntime}
            />
          </div>
        </header>
        <div className="homeHealthMetadataPanelContext">
          <MonitoringStatusBadge status={activeRuntime.status} />
          <span>
            Última entrada: {formatMonitoringDate(activeRuntime.observedAt)}
          </span>
        </div>
        <MonitoringObservation
          emptyClassName="homeHealthRuntimeMetadataEmpty"
          emptyMessage="O último sinal não possui metadados."
          event={activeRuntime.latestSignal}
        />
      </div>
    </section>
  );
}

function HealthRuntimeCard({
  canRequestExecution,
  isExecutionPending,
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
        <MonitoringStatusBadge status={runtime.status} />
      </button>
      {canRequestExecution?.(runtime) ? (
        <MonitoringExecutionButton
          className="iconButton homeHealthRuntimeExecution"
          disabled={isExecutionPending?.(runtime)}
          iconSize={15}
          onExecute={onRequestExecution}
          runtime={runtime}
        />
      ) : null}
    </div>
  );
}

function HealthDeploymentSection({
  applicationId,
  canRequestExecution,
  deployment,
  isExecutionPending,
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
            isExecutionPending={isExecutionPending}
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
  isExecutionPending,
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
            isExecutionPending={isExecutionPending}
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
  isExecutionPending,
  onRequestExecution,
  onSelectRuntime,
}) {
  return (
    <section className="homeHealthApplication">
      <header>
        <div>
          <strong>{application.name}</strong>
        </div>
        <MonitoringStatusBadge status={application.status} />
      </header>
      <div className="homeHealthComponents">
        {application.components.map((component) => (
          <HealthComponentSection
            applicationId={application.id}
            canRequestExecution={canRequestExecution}
            component={component}
            isExecutionPending={isExecutionPending}
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
  isMonitoringExecutionPending,
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
          isExecutionPending={isMonitoringExecutionPending}
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
              isExecutionPending={isMonitoringExecutionPending}
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
