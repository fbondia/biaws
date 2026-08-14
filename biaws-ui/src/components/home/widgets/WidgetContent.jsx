import { ApplicationHealthWidget } from "./ApplicationHealthWidget.jsx";
import { BreakdownWidget } from "./BreakdownWidget.jsx";
import { PendingTasksWidget } from "./PendingTasksWidget.jsx";
import { StatWidget } from "./StatWidget.jsx";

export function WidgetContent({
  canRequestMonitoringExecution,
  config,
  data,
  isMonitoringExecutionPending,
  onOpenRequestTask,
  onRequestMonitoringExecution,
  onSelectRuntime,
}) {
  if (!data) {
    return (
      <div className="homeWidgetPending">
        Salve a personalização para carregar este widget.
      </div>
    );
  }
  if (data.kind === "stat") return <StatWidget data={data} />;
  if (data.kind === "breakdown") return <BreakdownWidget data={data} />;
  if (data.kind === "tasks") {
    return <PendingTasksWidget data={data} onOpenTask={onOpenRequestTask} />;
  }
  if (data.kind === "health") {
    return (
      <ApplicationHealthWidget
        canRequestMonitoringExecution={canRequestMonitoringExecution}
        config={config}
        data={data}
        isMonitoringExecutionPending={isMonitoringExecutionPending}
        onSelectRuntime={onSelectRuntime}
        onRequestExecution={onRequestMonitoringExecution}
      />
    );
  }
  return <div className="homeWidgetEmpty">Widget indisponível.</div>;
}
