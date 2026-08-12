import { DOCUMENT_TYPES } from "../model.js";

export function DocumentTypeSelection({ onContinue, onSelect, selectedType }) {
  return (
    <section className="documentTypeCreationStep">
      <header>
        <span className="documentTypeCreationEyebrow">Novo documento</span>
        <h2>Qual tipo de documento você quer criar?</h2>
        <p>
          Escolha o tipo que melhor representa o conhecimento que será
          registrado.
        </p>
      </header>
      <div
        aria-label="Tipos de documento disponíveis"
        className="documentTypeCreationGrid"
        role="group"
      >
        {Object.entries(DOCUMENT_TYPES).map(([value, config]) => {
          const TypeIcon = config.icon;
          const selected = selectedType === value;
          return (
            <button
              aria-pressed={selected}
              className={
                selected
                  ? "documentTypeCreationCard selected"
                  : "documentTypeCreationCard"
              }
              key={value}
              onClick={() => onSelect(value)}
              type="button"
            >
              <span className="documentTypeCreationIcon">
                <TypeIcon aria-hidden="true" size={24} />
              </span>
              <span className="documentTypeCreationCopy">
                <strong>{config.label}</strong>
                <small>{config.description}</small>
              </span>
            </button>
          );
        })}
      </div>
      <footer>
        <button
          className="primaryButton"
          disabled={!selectedType}
          onClick={() => onContinue(selectedType)}
          type="button"
        >
          Continuar
        </button>
      </footer>
    </section>
  );
}
