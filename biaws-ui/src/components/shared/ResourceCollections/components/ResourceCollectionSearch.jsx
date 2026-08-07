import { RefreshCw, Search } from "lucide-react";

export function ResourceCollectionSearch({
  additionalFilters,
  loading = false,
  onRefresh,
  onSearch,
  onSearchChange,
  placeholder = "Pesquisar...",
  search,
}) {
  return (
    <form
      className="resourceCollectionSearch"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch?.();
      }}
    >
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
      {additionalFilters}
      <button
        aria-label="Pesquisar"
        className="iconButton"
        disabled={loading}
        title="Pesquisar"
        type="submit"
      >
        <Search size={16} />
      </button>
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
    </form>
  );
}
