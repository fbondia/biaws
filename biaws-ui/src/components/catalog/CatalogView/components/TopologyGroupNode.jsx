import { Layers3 } from "lucide-react";
import { memo } from "react";

import { TopologyNodeHandles } from "./TopologyNodeHandles.jsx";

export const TopologyGroupNode = memo(function TopologyGroupNode({ data }) {
  return (
    <section className="topologyGroupNode">
      <TopologyNodeHandles />
      <header>
        <span>
          <Layers3 size={16} />
          Grupo
        </span>
        <strong>{data.group.title}</strong>
      </header>
      {data.group.description ? <p>{data.group.description}</p> : null}
    </section>
  );
});
