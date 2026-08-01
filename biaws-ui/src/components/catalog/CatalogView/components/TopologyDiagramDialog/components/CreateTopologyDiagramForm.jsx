import { TOPOLOGY_ENVIRONMENTS } from "../../../topologyDiagramModel.js";

export function CreateTopologyDiagramForm({ controller }) {
  const { actions, diagrams, newEnvironment, newName, saving } = controller;

  return (
    <form className="topologyDiagramCreate" onSubmit={actions.createDiagram}>
      <label className="field">
        <span>Nome do novo gráfico</span>
        <input
          autoFocus
          onChange={(event) => actions.setNewName(event.target.value)}
          placeholder="Ex.: Produção principal"
          value={newName}
        />
      </label>
      <label className="field">
        <span>Ambiente inicial</span>
        <select
          onChange={(event) => actions.setNewEnvironment(event.target.value)}
          value={newEnvironment}
        >
          {TOPOLOGY_ENVIRONMENTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="primaryButton"
        disabled={!newName.trim() || saving}
        type="submit"
      >
        Criar
      </button>
      {diagrams.length ? (
        <button
          className="secondaryButton"
          onClick={() => actions.setCreating(false)}
          type="button"
        >
          Cancelar
        </button>
      ) : null}
    </form>
  );
}
