import { readSelectedOptions, toggleSelectedOption } from "../model.js";

export function OptionFilterDialog({
  description,
  draftFilters,
  field,
  onChange,
  onClose,
  options,
  title,
}) {
  const selected = readSelectedOptions(draftFilters, field);
  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label={title}
        aria-modal="true"
        className="tagFilterDialog issueOptionFilterDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>{title}</strong>
            <span>{description}</span>
          </div>
          {selected.length ? (
            <small>{selected.length} selecionado(s)</small>
          ) : null}
        </header>
        <div className="tagFilterGroups issueOptionFilterDialogContent">
          <div className="tagFilterOptions">
            {options
              .filter((option) => option.value)
              .map((option) => (
                <label
                  className={
                    selected.includes(option.value)
                      ? "tagFilterOption selectedTagFilterOption"
                      : "tagFilterOption"
                  }
                  key={option.value}
                >
                  <input
                    checked={selected.includes(option.value)}
                    onChange={() =>
                      toggleSelectedOption(
                        draftFilters,
                        field,
                        option.value,
                        onChange,
                      )
                    }
                    type="checkbox"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
          </div>
        </div>
        <footer>
          {selected.length ? (
            <button
              className="secondaryButton clearDialogSelectionButton"
              onClick={() => onChange(field, "")}
              type="button"
            >
              Limpar seleção
            </button>
          ) : null}
          <button
            className="primaryButton"
            data-dialog-close
            onClick={onClose}
            type="button"
          >
            Concluir
          </button>
        </footer>
      </section>
    </div>
  );
}
