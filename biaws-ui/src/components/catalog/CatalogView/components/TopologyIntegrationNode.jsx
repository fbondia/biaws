import { Network } from "lucide-react";
import { memo } from "react";

import { Status } from "./CatalogComponents.jsx";
import { TopologyNodeHandles } from "./TopologyNodeHandles.jsx";

export const TopologyIntegrationNode = memo(function TopologyIntegrationNode({
  data,
}) {
  return (
    <article className="topologyIntegrationNode">
      <TopologyNodeHandles />
      <header>
        <span>
          <Network size={16} />
          Integração
        </span>
        <Status value={data.integration.status} />
      </header>
      <div className="topologyIntegrationNodeTitle">
        <strong>{data.application.name}</strong>
        <small>{data.integration.name}</small>
      </div>
      {data.topologyUnavailable ? (
        <small className="topologyIntegrationUnavailable">
          Infraestrutura indisponível para consulta
        </small>
      ) : null}
    </article>
  );
});
