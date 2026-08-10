import { ApplicationHealthWidget } from "./ApplicationHealthWidget.jsx";
import { BreakdownWidget } from "./BreakdownWidget.jsx";
import { PendingTasksWidget } from "./PendingTasksWidget.jsx";
import { StatWidget } from "./StatWidget.jsx";

export function WidgetContent({
  config,
  data,
  onOpenRequestTask,
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
        config={config}
        data={data}
        onSelectRuntime={onSelectRuntime}
      />
    );
  }
  return <div className="homeWidgetEmpty">Widget indisponível.</div>;
}
