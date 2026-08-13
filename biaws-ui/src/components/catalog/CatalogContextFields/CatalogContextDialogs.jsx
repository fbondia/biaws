import { Layers3 } from "lucide-react";
import { useState } from "react";

import { FilterDialogButton } from "../../shared/FilterDialogButton.jsx";
import { CatalogColumnSelector } from "./CatalogColumnSelector.jsx";

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
