import { Panel } from "@xyflow/react";

export function CommentsPanel({ controller }) {
  const { actions, canEdit, comments } = controller;

  return (
    <Panel className="topologyDiagramComments" position="bottom-right">
      <label>
        <strong>Comentários</strong>
        <textarea
          className="nodrag nopan"
          disabled={!canEdit}
          onChange={(event) => {
            actions.setComments(event.target.value);
            actions.setDirty(true);
          }}
          placeholder="Registre observações sobre este gráfico…"
          rows={5}
          value={comments}
        />
      </label>
    </Panel>
  );
}
