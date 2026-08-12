import { RefreshCw, Search, X } from "lucide-react";
import { createPortal } from "react-dom";

import { useResourceCollectionBarActionTargets } from "../ResourceCollectionBar/index.jsx";
import { ArchivedItemsAction } from "./components/ArchivedItemsAction.jsx";

export function ResourceCollectionSearch({
  additionalFilters,
  archivedItemsLabel = "itens arquivados",
  className = "",
  includeArchived,
  loading = false,
  onClearFilters,
  onIncludeArchivedChange,
  onRefresh,
  onSearch,
  onSearchChange,
  placeholder = "Pesquisar...",
  search,
  hasActiveFilters = Boolean(search),
}) {
  const archivedItemsTarget =
    useResourceCollectionBarActionTargets()?.archivedItemsTarget;
  const archivedItemsAction = (
    <ArchivedItemsAction
      archivedItemsLabel={archivedItemsLabel}
      includeArchived={includeArchived}
      loading={loading}
      onIncludeArchivedChange={onIncludeArchivedChange}
    />
  );

  return (
    <>
      <form
        className={["resourceCollectionSearch", className]
          .filter(Boolean)
          .join(" ")}
        onSubmit={(event) => {
          event.preventDefault();
          onSearch?.();
        }}
      >
        {additionalFilters ? (
          <div className="resourceCollectionAdditionalFilters">
            {additionalFilters}
          </div>
        ) : null}

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
          <Search aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Limpar filtros de pesquisa"
          className="iconButton"
          disabled={loading || !hasActiveFilters}
          onClick={() => {
            if (onClearFilters) onClearFilters();
            else onSearchChange("");
          }}
          title="Limpar filtros de pesquisa"
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Atualizar"
          className="iconButton"
          disabled={loading}
          onClick={onRefresh}
          title="Atualizar"
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={loading ? "spinIcon" : undefined}
            size={16}
          />
        </button>
      </form>

      {archivedItemsTarget
        ? createPortal(archivedItemsAction, archivedItemsTarget)
        : archivedItemsAction}
    </>
  );
}
