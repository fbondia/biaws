import { Archive, Save } from "lucide-react";

export function SelectField({
  className = "",
  label,
  name,
  onChange,
  options,
  required,
  value,
}) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      <select
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        required={required}
        value={value || ""}
      >
        {!required ? <option value="">Não informado</option> : null}
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { value: option, label: option }
              : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function TextField({
  className = "",
  disabled,
  label,
  name,
  onChange,
  placeholder,
  readOnly,
  required,
  type = "text",
  value,
}) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      <input
        disabled={disabled}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        type={type}
        value={value ?? ""}
      />
    </label>
  );
}

export function MultiSelectField({
  label,
  name,
  onChange,
  options,
  value = [],
}) {
  return (
    <label className="field catalogWideField">
      <span>{label}</span>
      <select
        aria-describedby={`${name}-help`}
        multiple
        onChange={(event) =>
          onChange(
            name,
            [...event.target.selectedOptions].map(({ value: id }) => id),
          )
        }
        value={value}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <small id={`${name}-help`}>
        Use Ctrl ou Command para selecionar vários itens.
      </small>
    </label>
  );
}

export function HistoryItems({ empty, items, renderItem }) {
  if (!items.length) return <div className="catalogHistoryEmpty">{empty}</div>;
  return (
    <div className="catalogHistoryItems">
      {items.map((item) => (
        <article className="catalogHistoryItem" key={item.id}>
          {renderItem(item)}
        </article>
      ))}
    </div>
  );
}

export function EntityFieldGroup({ active, children }) {
  if (!active) return null;
  return children;
}

export function CatalogEntityFooter({
  archiving,
  editing,
  error,
  onArchive,
  onClose,
  saving,
}) {
  const busy = archiving || saving;
  return (
    <>
      {error ? <div className="errorBox">{error}</div> : null}
      <footer>
        {editing && onArchive ? (
          <button
            className="dangerButton"
            disabled={busy}
            onClick={onArchive}
            type="button"
          >
            <Archive size={16} />
            {archiving ? "Arquivando..." : "Arquivar"}
          </button>
        ) : null}
        <div className="catalogEntityFooterActions">
          <button
            className="secondaryButton"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button className="primaryButton" disabled={busy} type="submit">
            <Save size={16} />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </footer>
    </>
  );
}
