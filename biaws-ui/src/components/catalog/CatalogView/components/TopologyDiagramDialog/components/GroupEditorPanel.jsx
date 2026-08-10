import { Panel } from "@xyflow/react";
import { Trash2 } from "lucide-react";

export function GroupEditorPanel({ controller }) {
  const { actions, canEdit, groupableNodes, selectedGroup } = controller;

  return (
    <Panel className="topologyDiagramGroupEditor" position="bottom-left">
      <strong>Grupo</strong>
      <label className="field">
        <span>Título</span>
        <input
          aria-describedby="topology-group-validation"
          aria-invalid={!selectedGroup.data.group.title.trim()}
          disabled={!canEdit}
          onChange={(event) =>
            actions.updateSelectedGroup("title", event.target.value)
          }
          value={selectedGroup.data.group.title}
        />
      </label>
      {!selectedGroup.data.group.title.trim() ? (
        <small
          className="topologyDiagramGroupValidation"
          id="topology-group-validation"
          role="alert"
        >
          Informe um título para salvar o diagrama.
        </small>
      ) : null}
      <label className="field">
        <span>Descrição</span>
        <textarea
          disabled={!canEdit}
          onChange={(event) =>
            actions.updateSelectedGroup("description", event.target.value)
          }
          rows={3}
          value={selectedGroup.data.group.description || ""}
        />
      </label>
      <div className="topologyDiagramGroupMembers">
        <span>Elementos do grupo</span>
        {groupableNodes.length ? (
          groupableNodes.map((item) => (
            <label key={item.id}>
              <input
                checked={item.parentId === selectedGroup.id}
                disabled={!canEdit}
                onChange={(event) =>
                  actions.toggleNodeInSelectedGroup(
                    item.id,
                    event.target.checked,
                  )
                }
                type="checkbox"
              />
              <span>
                {item.label}
                {item.parentId && item.parentId !== selectedGroup.id ? (
                  <small>Em outro grupo</small>
                ) : null}
              </span>
            </label>
          ))
        ) : (
          <small>Nenhum elemento, servidor ou integração disponível.</small>
        )}
      </div>
      {canEdit ? (
        <button
          className="dangerButton"
          onClick={actions.removeSelectedGroup}
          type="button"
        >
          <Trash2 size={14} /> Remover grupo
        </button>
      ) : null}
    </Panel>
  );
}
