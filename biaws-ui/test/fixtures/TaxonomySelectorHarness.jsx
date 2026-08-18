import { useState } from "react";
import { createRoot } from "react-dom/client";

import { appendChild } from "../../src/components/taxonomy/IssueTaxonomyManager/model.js";
import { TaxonomySelector } from "../../src/components/taxonomy/TaxonomySelector/index.jsx";
import { buildUniqueTaxonomyId } from "../../src/components/taxonomy/nodeIds.js";

const INITIAL_NODES = [
  { id: "servico", label: "Serviço" },
  {
    id: "produto",
    label: "Produto",
    children: [
      { id: "produto-zebra", label: "Zebra" },
      { id: "produto-detalhes", label: "Detalhes" },
    ],
  },
];

export function mountTaxonomySelector(container, { rejectAdd = false } = {}) {
  const root = createRoot(container);

  function Harness() {
    const [nodes, setNodes] = useState(INITIAL_NODES);
    const [activeNodeId, setActiveNodeId] = useState("servico");

    function addNode(parentId, label) {
      if (rejectAdd) return null;

      const node = {
        id: buildUniqueTaxonomyId(nodes, parentId, label),
        label,
      };
      setNodes((current) => appendChild(current, parentId, node));
      setActiveNodeId(node.id);
      return node;
    }

    return (
      <TaxonomySelector
        activeValue={activeNodeId}
        nodes={nodes}
        onActiveChange={setActiveNodeId}
        onAddNode={addNode}
        selectable={false}
      />
    );
  }

  root.render(<Harness />);
  return { root };
}
