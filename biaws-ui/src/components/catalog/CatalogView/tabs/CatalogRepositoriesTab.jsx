import { Plus } from "lucide-react";

import { hasPermission } from "../../../../permissions.js";
import { EntityTable } from "../components/CatalogComponents.jsx";

export function CatalogRepositoriesTab({
  actor,
  context,
  entityActions,
  setDialog,
}) {
  return (
    <section>
      <div className="catalogSectionHeader">
        <div>
          <span>Origens de código e configuração, sem credenciais.</span>
        </div>
        {hasPermission(actor, "repositories.create") ? (
          <button
            className="primaryButton"
            onClick={() => setDialog({ kind: "repository", entity: null })}
            type="button"
          >
            <Plus size={16} /> Novo repositório
          </button>
        ) : null}
      </div>
      <EntityTable
        actions={entityActions(
          "repository",
          "repositories.update",
          "repositories.archive",
        )}
        columns={[
          { key: "name", label: "Nome" },
          { key: "provider", label: "Provedor" },
          {
            key: "url",
            label: "URL",
            render: (item) => (
              <a href={item.url} rel="noreferrer" target="_blank">
                {item.url}
              </a>
            ),
          },
          { key: "defaultBranch", label: "Branch" },
        ]}
        empty="Nenhum repositório cadastrado."
        items={context.repositories}
      />
    </section>
  );
}
