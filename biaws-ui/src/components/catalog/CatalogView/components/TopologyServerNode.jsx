import { Server } from "lucide-react";
import { memo } from "react";

import { TopologyNodeHandles } from "./TopologyNodeHandles.jsx";

export const TopologyServerNode = memo(function TopologyServerNode({ data }) {
  return (
    <article className="topologyServerNode">
      <TopologyNodeHandles />
      <header>
        <Server size={16} />
        <div>
          <strong>{data.server.name}</strong>
          <small>{data.server.hostname || "Host não informado"}</small>
        </div>
      </header>
      <div className="topologyServerComponents">
        {data.components.map((component) => (
          <div key={component.id}>
            <strong>{component.name}</strong>
          </div>
        ))}
      </div>
    </article>
  );
});
