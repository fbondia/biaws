import { Boxes, ChevronRight, Layers3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchApplications,
  fetchComponents,
  fetchWorkspaces,
} from "../../api.js";
import { FilterDialogButton } from "../shared/FilterDialogButton.jsx";

export function useCatalogOptions(enabled = true, workspaceId = "") {
  const [workspace, setWorkspace] = useState(null);
  const [applications, setApplications] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    Promise.resolve()
      .then(async () => {
        const workspacePayload = await fetchWorkspaces();
        const operational =
          (workspacePayload.items || []).find(({ id }) => id === workspaceId) ||
          null;
        if (!operational)
          return { operational, applications: [], components: [] };
        const applicationPayload = await fetchApplications(operational.id, {
          limit: 100,
        });
        const applicationItems = applicationPayload.items || [];
        const componentGroups = await Promise.all(
          applicationItems.map(async (application) => ({
            applicationId: application.id,
            items:
              (await fetchComponents(application.id, { limit: 100 })).items ||
              [],
          })),
        );
        return {
          operational,
          applications: applicationItems,
          components: componentGroups.flatMap(({ items }) => items),
        };
      })
      .then((result) => {
        if (!active) return;
        setWorkspace(result.operational);
        setApplications(result.applications);
        setComponents(result.components);
        setError("");
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, workspaceId]);

  return { workspace, applications, components, loading, error };
}

export function CatalogContextFields({
  affectedComponentIds = [],
  applicationId = "",
  applications,
  components,
  disabled = false,
  onChange,
  optional = false,
}) {
  return (
    <div className="catalogContextFields">
      <CatalogColumnSelector
        affectedComponentIds={affectedComponentIds}
        applicationId={applicationId}
        applications={applications}
        components={components}
        disabled={disabled}
        emptyApplicationLabel={
          optional ? "Conhecimento geral do workspace" : ""
        }
        multipleComponents
        onChange={onChange}
        optional={optional}
      />
    </div>
  );
}

export function CatalogContextDialogField({
  affectedComponentIds = [],
  applicationId = "",
  applications,
  components,
  disabled = false,
  onChange,
  optional = false,
}) {
  const [open, setOpen] = useState(false);
  const selectedApplication = applications.find(
    ({ id }) => id === applicationId,
  );
  const selectedComponents = components.filter(
    ({ id, applicationId: componentApplicationId }) =>
      componentApplicationId === applicationId &&
      affectedComponentIds.includes(id),
  );
  const selectionCount =
    Number(Boolean(selectedApplication)) + selectedComponents.length;
  const componentSummary = selectedComponents.length
    ? `${selectedComponents.length} componente(s)`
    : "Nenhum componente";
  const summary = selectedApplication
    ? `${selectedApplication.name} · ${componentSummary}`
    : optional
      ? "Conhecimento geral do workspace"
      : "Selecione uma aplicação";

  return (
    <div className="catalogContextFields catalogContextDialogField">
      <FilterDialogButton
        className="catalogContextDialogTrigger"
        count={selectionCount}
        icon={Layers3}
        label="Aplicação e componentes"
        onClick={() => setOpen(true)}
        summary={summary}
      />

      {open ? (
        <div
          className="tagFilterDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            aria-label="Selecionar aplicação e componentes afetados"
            aria-modal="true"
            className="tagFilterDialog catalogFilterDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Selecionar aplicação e componentes</strong>
                <span>
                  Escolha a aplicação e marque os componentes relacionados.
                </span>
              </div>
              {selectionCount ? (
                <small>{selectionCount} selecionado(s)</small>
              ) : null}
            </header>
            <div className="catalogFilterDialogContent">
              <CatalogColumnSelector
                affectedComponentIds={affectedComponentIds}
                applicationId={applicationId}
                applications={applications}
                components={components}
                disabled={disabled}
                emptyApplicationLabel={
                  optional ? "Conhecimento geral do workspace" : ""
                }
                multipleComponents
                onChange={onChange}
                optional={optional}
              />
            </div>
            <footer>
              <button
                className="primaryButton"
                data-dialog-close
                onClick={() => setOpen(false)}
                type="button"
              >
                Concluir
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function CatalogFilterFields({
  applicationId,
  applications,
  componentId,
  components,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const selectedApplication = applications.find(
    ({ id }) => id === applicationId,
  );
  const selectedComponent = components.find(({ id }) => id === componentId);
  const selectionCount =
    Number(Boolean(applicationId)) + Number(Boolean(componentId));
  const summary =
    selectedComponent?.name ||
    selectedApplication?.name ||
    "Todas as aplicações";

  function changeSelection(nextContext) {
    onChange("applicationId", nextContext.applicationId);
    onChange("componentId", nextContext.affectedComponentIds[0] || "");
  }

  return (
    <>
      <FilterDialogButton
        count={selectionCount}
        icon={Layers3}
        label="Aplicação"
        onClick={() => setOpen(true)}
        summary={summary}
      />

      {open ? (
        <div
          className="tagFilterDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            aria-label="Filtrar por aplicação e componente"
            aria-modal="true"
            className="tagFilterDialog catalogFilterDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Filtrar por aplicação e componente</strong>
                <span>
                  Navegue pelas aplicações e selecione um componente, se
                  necessário.
                </span>
              </div>
              {selectionCount ? (
                <small>{selectionCount} selecionado(s)</small>
              ) : null}
            </header>
            <div className="catalogFilterDialogContent">
              <CatalogColumnSelector
                affectedComponentIds={componentId ? [componentId] : []}
                allowEmptyComponent
                applicationId={applicationId}
                applications={applications}
                components={components}
                emptyApplicationLabel="Todas as aplicações"
                onChange={changeSelection}
                optional
              />
            </div>
            <footer>
              {selectionCount ? (
                <button
                  className="secondaryButton clearDialogSelectionButton"
                  onClick={() =>
                    changeSelection({
                      applicationId: "",
                      affectedComponentIds: [],
                    })
                  }
                  type="button"
                >
                  Limpar seleção
                </button>
              ) : null}
              <button
                className="primaryButton"
                data-dialog-close
                onClick={() => setOpen(false)}
                type="button"
              >
                Concluir
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function CatalogColumnSelector({
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
