import { CreateTopologyDiagramForm } from "./components/CreateTopologyDiagramForm.jsx";
import { TopologyDiagramCanvas } from "./components/TopologyDiagramCanvas.jsx";
import { TopologyDiagramToolbar } from "./components/TopologyDiagramToolbar.jsx";
import { TopologyDialogHeader } from "./components/TopologyDialogHeader.jsx";
import { useTopologyDiagram } from "./useTopologyDiagram.js";

export function TopologyDiagramDialog({ actor, context, onClose }) {
  const controller = useTopologyDiagram({ actor, context, onClose });

  return (
    <div
      className="dialogBackdrop topologyDiagramBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !controller.saving) {
          controller.actions.requestClose();
        }
      }}
    >
      <section
        aria-labelledby="topology-diagram-title"
        aria-modal="true"
        className="topologyDiagramDialog"
        role="dialog"
      >
        <TopologyDialogHeader
          applicationName={context.application.name}
          onClose={controller.actions.requestClose}
          saving={controller.saving}
        />
        <TopologyDiagramToolbar controller={controller} />
        {controller.creating ? (
          <CreateTopologyDiagramForm controller={controller} />
        ) : null}
        {controller.error ? (
          <div className="errorBox">{controller.error}</div>
        ) : null}
        {controller.integrationWarning ? (
          <div className="warningBox">{controller.integrationWarning}</div>
        ) : null}
        <TopologyDiagramCanvas controller={controller} />
      </section>
    </div>
  );
}
