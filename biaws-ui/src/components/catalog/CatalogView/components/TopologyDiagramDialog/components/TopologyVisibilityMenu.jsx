export function TopologyVisibilityMenu({
  hiddenIds,
  label,
  onChange,
  options,
}) {
  const hidden = new Set(hiddenIds);
  const visibleCount = options.filter(({ id }) => !hidden.has(id)).length;

  function toggle(id, visible) {
    const next = new Set(hiddenIds);
    if (visible) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <details className="topologyDiagramVisibilityMenu">
      <summary>
        <span>{label}</span>
        <small>
          {visibleCount}/{options.length}
        </small>
      </summary>
      <div className="topologyDiagramVisibilityPopover">
        <header>
          <strong>{label}</strong>
          {options.length ? (
            <span>
              <button onClick={() => onChange([])} type="button">
                Todos
              </button>
              <button
                onClick={() => onChange(options.map(({ id }) => id))}
                type="button"
              >
                Nenhum
              </button>
            </span>
          ) : null}
        </header>
        <div className="topologyDiagramVisibilityOptions">
          {options.length ? (
            options.map((option) => (
              <label key={option.id}>
                <input
                  checked={!hidden.has(option.id)}
                  onChange={(event) => toggle(option.id, event.target.checked)}
                  type="checkbox"
                />
                <span title={option.label}>{option.label}</span>
              </label>
            ))
          ) : (
            <small>Nenhum item disponível neste ambiente.</small>
          )}
        </div>
      </div>
    </details>
  );
}
