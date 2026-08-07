import { Plus } from "lucide-react";

export function CollectionAddForm({
  disabled,
  error,
  name,
  onChange,
  onSubmit,
}) {
  return (
    <form className="procedureCollectionAdd" onSubmit={onSubmit}>
      {error ? <small role="alert">{error}</small> : null}
      <div>
        <input
          aria-label="Nome da nova coleção"
          disabled={disabled}
          maxLength={120}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Nova coleção"
          value={name}
        />
        <button
          aria-label="Criar coleção"
          disabled={disabled || !name.trim()}
          title="Criar coleção"
          type="submit"
        >
          <Plus size={13} />
        </button>
      </div>
    </form>
  );
}
