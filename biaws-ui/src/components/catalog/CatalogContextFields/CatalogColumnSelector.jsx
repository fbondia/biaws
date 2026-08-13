import { Boxes, ChevronRight, Layers3 } from "lucide-react";
import { useMemo } from "react";

export function CatalogColumnSelector({
  affectedComponentIds,
  allowEmptyComponent = false,
  applicationId,
  applications,
  components,
  disabled = false,
  emptyApplicationLabel = "Todas as aplicações",
  multipleComponents = false,
  onChange,
  optional = false,
}) {
  const availableComponents = useMemo(
    () =>
      components.filter(
        (component) => component.applicationId === applicationId,
      ),
    [applicationId, components],
  );
  const selectedComponentSet = useMemo(
    () => new Set(affectedComponentIds),
    [affectedComponentIds],
  );

  function changeApplication(nextApplicationId) {
    if (disabled) return;
    onChange({ applicationId: nextApplicationId, affectedComponentIds: [] });
  }

  function changeComponent(componentId) {
    if (disabled || !applicationId) return;
    if (!multipleComponents) {
      onChange({
        applicationId,
        affectedComponentIds: selectedComponentSet.has(componentId)
          ? []
          : [componentId],
      });
      return;
    }

    onChange({
      applicationId,
      affectedComponentIds: selectedComponentSet.has(componentId)
        ? affectedComponentIds.filter((id) => id !== componentId)
        : [...affectedComponentIds, componentId],
    });
  }

  return (
    <div
      className="catalogColumns"
      aria-label="Aplicação e componentes"
      role="tree"
    >
      <section className="catalogColumn" role="group">
        <header>
          <Layers3 size={15} />
          <span>Aplicações</span>
        </header>
        <div className="catalogColumnList">
          {optional ? (
            <button
              aria-selected={!applicationId}
              className={
                !applicationId
                  ? "catalogColumnRow activeCatalogColumnRow"
                  : "catalogColumnRow"
              }
              disabled={disabled}
              onClick={() => changeApplication("")}
              role="treeitem"
              type="button"
            >
              <span>{emptyApplicationLabel}</span>
            </button>
          ) : null}
          {applications.map((application) => {
            const active = application.id === applicationId;
            return (
              <button
                aria-selected={active}
                className={
                  active
                    ? "catalogColumnRow activeCatalogColumnRow"
                    : "catalogColumnRow"
                }
                disabled={disabled}
                key={application.id}
                onClick={() => changeApplication(application.id)}
                role="treeitem"
                type="button"
              >
                <span>{application.name}</span>
                <ChevronRight size={15} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="catalogColumn catalogComponentColumn" role="group">
        <header>
          <Boxes size={15} />
          <span>Componentes afetados</span>
        </header>
        <div className="catalogColumnList">
          {!applicationId ? (
            <p className="catalogColumnEmpty">
              Selecione uma aplicação para visualizar seus componentes.
            </p>
          ) : null}
          {applicationId && !availableComponents.length ? (
            <p className="catalogColumnEmpty">
              Nenhum componente cadastrado para esta aplicação.
            </p>
          ) : null}
          {applicationId && allowEmptyComponent ? (
            <button
              aria-selected={!affectedComponentIds.length}
              className={
                !affectedComponentIds.length
                  ? "catalogColumnRow activeCatalogColumnRow"
                  : "catalogColumnRow"
              }
              disabled={disabled}
              onClick={() =>
                onChange({ applicationId, affectedComponentIds: [] })
              }
              role="treeitem"
              type="button"
            >
              <span>Todos os componentes</span>
            </button>
          ) : null}
          {availableComponents.map((component) => {
            const checked = selectedComponentSet.has(component.id);
            return (
              <label
                aria-selected={checked}
                className={
                  checked
                    ? "catalogColumnRow checkedCatalogColumnRow"
                    : "catalogColumnRow"
                }
                key={component.id}
                role="treeitem"
              >
                <input
                  checked={checked}
                  disabled={disabled}
                  name={multipleComponents ? undefined : "catalog-component"}
                  onChange={() => changeComponent(component.id)}
                  type={multipleComponents ? "checkbox" : "radio"}
                />
                <span>{component.name}</span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
