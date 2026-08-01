import { Box, Layers3, Plus, Save } from "lucide-react";

import { TOPOLOGY_ENVIRONMENTS } from "../../../topologyDiagramModel.js";
import { TopologyVisibilityMenu } from "./TopologyVisibilityMenu.jsx";

export function TopologyDiagramToolbar({ controller }) {
  const {
    actions,
    canEdit,
    diagram,
    diagrams,
    dirty,
    environment,
    hasUntitledNode,
    hiddenIntegrationIds,
    hiddenServerIds,
    integrationOptions,
    loading,
    saving,
    selectedId,
    serverOptions,
    topologyLoading,
  } = controller;

  function changeVisibility(setter, next) {
    setter(next);
    actions.setSelectedEdgeId("");
    if (canEdit) actions.setDirty(true);
  }

  return (
    <div className="topologyDiagramToolbar">
      <div className="topologyDiagramToolbarPrimary">
        <div className="topologyDiagramSelectors">
          <label className="field topologyDiagramSelector">
            <span>Gráfico</span>
            <select
              disabled={loading || saving}
              onChange={(event) => actions.selectDiagram(event.target.value)}
              value={selectedId}
            >
              {!diagrams.length ? (
                <option value="">Nenhum gráfico criado</option>
              ) : null}
              {diagrams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {canEdit ? (
            <button
              className="secondaryButton topologyDiagramNewButton"
              onClick={actions.startCreating}
              type="button"
            >
              <Plus size={15} /> Novo gráfico
            </button>
          ) : null}
          <label className="field topologyDiagramEnvironment">
            <span>Ambiente</span>
            <select
              disabled={!diagram || topologyLoading || !canEdit}
              onChange={(event) =>
                void actions.changeEnvironment(event.target.value)
              }
              value={environment}
            >
              {TOPOLOGY_ENVIRONMENTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="topologyDiagramToolbarActions">
          {dirty ? <small>Alterações não salvas</small> : null}
          {canEdit ? (
            <button
              className="primaryButton"
              disabled={
                !diagram ||
                saving ||
                topologyLoading ||
                !dirty ||
                hasUntitledNode
              }
              onClick={() => void actions.saveDiagram()}
              type="button"
            >
              <Save size={15} /> {saving ? "Salvando…" : "Salvar"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="topologyDiagramToolbarSecondary">
        <div className="topologyDiagramToolbarGroup">
          <span className="topologyDiagramToolbarLabel">Exibir</span>
          <div className="topologyDiagramVisibility">
            <TopologyVisibilityMenu
              hiddenIds={hiddenIntegrationIds}
              label="Integrações"
              onChange={(next) =>
                changeVisibility(actions.setHiddenIntegrationIds, next)
              }
              options={integrationOptions}
            />
            <TopologyVisibilityMenu
              hiddenIds={hiddenServerIds}
              label="Servidores"
              onChange={(next) =>
                changeVisibility(actions.setHiddenServerIds, next)
              }
              options={serverOptions}
            />
          </div>
        </div>
        {canEdit ? (
          <div className="topologyDiagramToolbarGroup topologyDiagramAddGroup">
            <span className="topologyDiagramToolbarLabel">Adicionar</span>
            <div className="topologyDiagramCreateNodes">
              <button
                className="secondaryButton"
                disabled={!diagram || topologyLoading}
                onClick={actions.createElement}
                type="button"
              >
                <Box size={15} /> Elemento
              </button>
              <button
                className="secondaryButton"
                disabled={!diagram || topologyLoading}
                onClick={actions.createGroup}
                type="button"
              >
                <Layers3 size={15} /> Grupo
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
