import { Archive, ArchiveRestore, RefreshCw, Search } from "lucide-react";
import { createPortal } from "react-dom";

import { useResourceCollectionBarActionTargets } from "./ResourceCollectionBarActionsContext.js";

export function ResourceCollectionSearch({
  additionalFilters,
  archivedItemsLabel = "itens arquivados",
  className = "",
  includeArchived,
  loading = false,
  onIncludeArchivedChange,
  onRefresh,
  onSearch,
  onSearchChange,
  placeholder = "Pesquisar...",
  search,
}) {
  const resourceActionsTarget =
    useResourceCollectionBarActionTargets()?.resourceActionsTarget;
  const archivedVisibilityLabel = includeArchived
    ? `Ocultar ${archivedItemsLabel}`
    : `Mostrar ${archivedItemsLabel}`;
  const resourceActions = (
    <>
      {onIncludeArchivedChange ? (
        <button
          aria-label={archivedVisibilityLabel}
          aria-pressed={Boolean(includeArchived)}
          className={
            includeArchived
              ? "iconButton activeCollectionNavigationToggle"
              : "iconButton"
          }
          disabled={loading}
          onClick={() => onIncludeArchivedChange(!includeArchived)}
          title={archivedVisibilityLabel}
          type="button"
        >
          {includeArchived ? (
            <ArchiveRestore aria-hidden="true" size={16} />
          ) : (
            <Archive aria-hidden="true" size={16} />
          )}
        </button>
      ) : null}
      <button
        aria-label="Atualizar"
        className="iconButton"
        disabled={loading}
        onClick={onRefresh}
        title="Atualizar"
        type="button"
      >
        <RefreshCw className={loading ? "spinIcon" : undefined} size={16} />
      </button>
    </>
  );

  return (
    <form
      className={["resourceCollectionSearch", className]
        .filter(Boolean)
        .join(" ")}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch?.();
      }}
    >
      <div className="resourceCollectionTextFilter">
        <label className="resourceCollectionSearchInput">
          <Search aria-hidden="true" size={15} />
          <span className="srOnly">Pesquisar</span>
          <input
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={placeholder}
            type="search"
            value={search}
          />
        </label>
        <button
          aria-label="Pesquisar"
          className="iconButton"
          disabled={loading}
          title="Pesquisar"
          type="submit"
        >
          <Search size={16} />
        </button>
      </div>
      {additionalFilters}
      {resourceActionsTarget ? null : resourceActions}
      {resourceActionsTarget
        ? createPortal(resourceActions, resourceActionsTarget)
        : null}
    </form>
  );
}
