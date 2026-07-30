import { Plus } from "lucide-react";

import { hasPermission } from "../../../../permissions.js";
import { EntityTable } from "../components/CatalogComponents.jsx";

export function CatalogIntegrationsTab({
  actor,
  context,
  entityActions,
  setDialog,
}) {
  const applicationsById = new Map(
    (context.availableApplications || []).map((application) => [
      application.id,
      application,
    ]),
  );

  return (
    <section>
      <div className="catalogSectionHeader">
        <div>
          <span>
            Aplicações deste workspace que participam da topologia desta
            aplicação.
          </span>
        </div>
        {hasPermission(actor, "integrations.create") ? (
          <button
            className="primaryButton"
            onClick={() => setDialog({ kind: "integration", entity: null })}
            type="button"
          >
            <Plus size={16} /> Nova integração
          </button>
        ) : null}
      </div>
      <EntityTable
        actions={entityActions(
          "integration",
          "integrations.update",
          "integrations.archive",
        )}
        columns={[
          { key: "name", label: "Nome" },
          {
            key: "targetApplicationId",
            label: "Aplicação integrada",
            render: (item) =>
              applicationsById.get(item.targetApplicationId)?.name ||
              item.targetApplicationId,
          },
        ]}
        empty="Nenhuma integração cadastrada."
        items={context.integrations || []}
      />
    </section>
  );
}
