import { Panel } from "@xyflow/react";
import { Trash2 } from "lucide-react";

export function ElementEditorPanel({ controller }) {
  const { actions, canEdit, selectedElement, selectedElementType } = controller;
  const element = selectedElement.data.element;

  return (
    <Panel className="topologyDiagramElementEditor" position="bottom-left">
      <strong>Elemento</strong>
      <label className="field">
        <span>Tipo</span>
        <input
          aria-describedby="topology-element-validation"
          aria-invalid={!selectedElementType.trim()}
          disabled={!canEdit}
          onChange={(event) =>
            actions.updateSelectedElement("type", event.target.value)
          }
          placeholder="Ex.: Firewall, serviço externo, domínio"
          value={selectedElementType}
        />
      </label>
      <label className="field">
        <span>Título</span>
        <input
          aria-describedby="topology-element-validation"
          aria-invalid={!element.title.trim()}
          disabled={!canEdit}
          onChange={(event) =>
            actions.updateSelectedElement("title", event.target.value)
          }
          value={element.title}
        />
      </label>
      {!selectedElementType.trim() || !element.title.trim() ? (
        <small
          className="topologyDiagramGroupValidation"
          id="topology-element-validation"
          role="alert"
        >
          Informe o tipo e o título para salvar o diagrama.
        </small>
      ) : null}
      <label className="field">
        <span>Descrição</span>
        <textarea
          disabled={!canEdit}
          onChange={(event) =>
            actions.updateSelectedElement("description", event.target.value)
          }
          rows={4}
          value={element.description || ""}
        />
      </label>
      <label className="field topologyElementColorField">
        <span>Cor do cabeçalho</span>
        <div>
          <input
            aria-label="Cor do cabeçalho"
            disabled={!canEdit}
            onChange={(event) =>
              actions.updateSelectedElement("headerColor", event.target.value)
            }
            type="color"
            value={element.headerColor || "#edf9f5"}
          />
          <code>{element.headerColor || "#edf9f5"}</code>
        </div>
      </label>
      {canEdit ? (
        <button
          className="dangerButton"
          onClick={actions.removeSelectedElement}
          type="button"
        >
          <Trash2 size={14} /> Remover elemento
        </button>
      ) : null}
    </Panel>
  );
}
