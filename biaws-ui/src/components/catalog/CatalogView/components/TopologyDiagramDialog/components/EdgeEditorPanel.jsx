import { Panel } from "@xyflow/react";
import { Trash2 } from "lucide-react";

import {
  TOPOLOGY_CONNECTION_DIRECTIONS,
  TOPOLOGY_CONNECTION_LINE_TYPES,
  TOPOLOGY_CONNECTION_TYPES,
} from "../../../topologyDiagramModel.js";

export function EdgeEditorPanel({ controller }) {
  const { actions, canEdit, selectedEdge } = controller;

  return (
    <Panel className="topologyDiagramEdgeEditor" position="bottom-left">
      <strong>Conexão</strong>
      <label className="field">
        <span>Tipo</span>
        <select
          disabled={!canEdit}
          onChange={(event) =>
            actions.updateSelectedEdge("connectionType", event.target.value)
          }
          value={selectedEdge.data?.connectionType || "dependency"}
        >
          {TOPOLOGY_CONNECTION_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Formato da linha</span>
        <select
          disabled={!canEdit}
          onChange={(event) =>
            actions.updateSelectedEdge("lineType", event.target.value)
          }
          value={selectedEdge.type || "default"}
        >
          {TOPOLOGY_CONNECTION_LINE_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Direção da seta</span>
        <select
          disabled={!canEdit}
          onChange={(event) =>
            actions.updateSelectedEdge("direction", event.target.value)
          }
          value={selectedEdge.data?.direction || "forward"}
        >
          {TOPOLOGY_CONNECTION_DIRECTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Rótulo opcional</span>
        <input
          disabled={!canEdit}
          onChange={(event) =>
            actions.updateSelectedEdge("customLabel", event.target.value)
          }
          value={selectedEdge.data?.customLabel || ""}
        />
      </label>
      {canEdit ? (
        <button
          className="dangerButton"
          onClick={actions.removeSelectedEdge}
          type="button"
        >
          <Trash2 size={14} /> Remover conexão
        </button>
      ) : null}
    </Panel>
  );
}
