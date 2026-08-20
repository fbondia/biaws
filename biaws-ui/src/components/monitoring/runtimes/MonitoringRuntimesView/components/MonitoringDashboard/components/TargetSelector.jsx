import { CheckSquare2, GripVertical, X } from "lucide-react";
import { useRef, useState } from "react";

import { HOME_WIDGET_SIZES } from "../../../../../../home/HomeView/model.js";
import {
  groupMonitoringTargets,
  moveMonitoringWidget,
  selectedMonitoringWidgets,
} from "../model.js";

export function TargetSelector({
  onClose,
  onSave,
  saving,
  selectedWidgets,
  targets,
}) {
  const [draftWidgets, setDraftWidgets] = useState(() =>
    structuredClone(selectedWidgets),
  );
  const [draggingId, setDraggingId] = useState("");
  const draggingIdRef = useRef("");
  const selectedEntries = selectedMonitoringWidgets(targets, draftWidgets);
  const selectedIds = new Set(draftWidgets.map(({ runtimeId }) => runtimeId));
  const groups = groupMonitoringTargets(
    targets.filter(({ id }) => !selectedIds.has(id)),
  );

  function toggle(runtimeId) {
    setDraftWidgets((current) =>
      current.some((widget) => widget.runtimeId === runtimeId)
        ? current.filter((widget) => widget.runtimeId !== runtimeId)
        : [...current, { runtimeId, size: "medium-2" }],
    );
  }

  function updateSize(runtimeId, size) {
    setDraftWidgets((current) =>
      current.map((widget) =>
        widget.runtimeId === runtimeId ? { ...widget, size } : widget,
      ),
    );
  }

  function dropWidget(targetId) {
    if (draggingIdRef.current) {
      setDraftWidgets((current) =>
        moveMonitoringWidget(current, draggingIdRef.current, targetId),
      );
    }
    draggingIdRef.current = "";
    setDraggingId("");
  }

  function finishDragging() {
    draggingIdRef.current = "";
    setDraggingId("");
  }

  function beginDragging(runtimeId) {
    draggingIdRef.current = runtimeId;
    setDraggingId(runtimeId);
  }

  function targetIdentity(target) {
    return (
      <span>
        <strong>{target.name}</strong>
        <small>
          {target.component?.name} · {target.deployment?.name}
          {target.deployment?.environment
            ? ` · ${target.deployment.environment}`
            : ""}
        </small>
        <small>{target.monitorNames.join(" · ")}</small>
      </span>
    );
  }

  return (
    <div className="dialogBackdrop" role="presentation">
      <section
        aria-labelledby="monitoring-panel-selector-title"
        aria-modal="true"
        className="monitoringPanelSelector"
        role="dialog"
      >
        <header>
          <div>
            <span>Painel de monitoramento</span>
            <h2 id="monitoring-panel-selector-title">Selecionar runtimes</h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="monitoringPanelSelectorBody">
          {!targets.length ? (
            <div className="monitoringPanelEmptySelection">
              Nenhum runtime possui monitor ativo configurado.
            </div>
          ) : (
            <>
              {selectedEntries.length ? (
                <section>
                  <header>
                    <strong>Widgets selecionados</strong>
                    <small>Arraste para definir a ordem no painel</small>
                  </header>
                  <div className="monitoringPanelTargetList">
                    {selectedEntries.map(({ target, widget }) => (
                      <div
                        className={`monitoringPanelTarget monitoringPanelSelectedTarget${draggingId === target.id ? " isDragging" : ""}`}
                        key={target.id}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => dropWidget(target.id)}
                      >
                        <span
                          aria-label={`Reordenar ${target.name}`}
                          className="monitoringPanelDragHandle"
                          draggable
                          onDragEnd={finishDragging}
                          onDragStart={() => beginDragging(target.id)}
                          role="img"
                        >
                          <GripVertical size={17} />
                        </span>
                        <label>
                          <input
                            checked
                            onChange={() => toggle(target.id)}
                            type="checkbox"
                          />
                          {targetIdentity(target)}
                        </label>
                        <div className="monitoringPanelTargetActions">
                          <span className="monitoringPanelMonitorCount">
                            {target.enabledMonitorCount}/{target.monitorCount}{" "}
                            ativos
                          </span>
                          <label className="field monitoringPanelSizeField">
                            <span>Tamanho</span>
                            <select
                              aria-label={`Tamanho de ${target.name}`}
                              onChange={(event) =>
                                updateSize(target.id, event.target.value)
                              }
                              value={widget.size}
                            >
                              {HOME_WIDGET_SIZES.map((size) => (
                                <option key={size.value} value={size.value}>
                                  {size.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {groups.map(({ application, targets: applicationTargets }) => (
                <section key={application.id}>
                  <header>
                    <strong>{application.name}</strong>
                    <small>{applicationTargets.length} disponíveis</small>
                  </header>
                  <div className="monitoringPanelTargetList">
                    {applicationTargets.map((target) => (
                      <div className="monitoringPanelTarget" key={target.id}>
                        <label>
                          <input
                            checked={false}
                            onChange={() => toggle(target.id)}
                            type="checkbox"
                          />
                          {targetIdentity(target)}
                        </label>
                        <span className="monitoringPanelMonitorCount">
                          {target.enabledMonitorCount}/{target.monitorCount}{" "}
                          ativos
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
        <footer>
          <span>{draftWidgets.length} selecionados</span>
          <div>
            <button
              className="secondaryButton"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="primaryButton"
              disabled={saving}
              onClick={() => onSave(draftWidgets)}
              type="button"
            >
              <CheckSquare2 size={16} />
              {saving ? "Salvando…" : "Aplicar seleção"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
