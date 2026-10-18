import { Plus, Trash2 } from "lucide-react";

import { MarkdownEditor, MarkdownPreview } from "../../../../shared/MarkdownEditor/index.jsx";

export function CatalogItems({ items = [], attachments, onLoadAttachment }) {
  if (!items.length) return <p className="muted">Nenhum elemento no catálogo.</p>;
  return (
    <div className="knowledgeCatalogItems">
      {items.map((item) => (
        <details className="knowledgeCatalogItem" key={item.id}>
          <summary>{item.title}</summary>
          <div className="knowledgeCatalogItemBody">
            <MarkdownPreview attachments={attachments} onLoadAttachment={onLoadAttachment} value={item.description} />
          </div>
        </details>
      ))}
    </div>
  );
}

export function CatalogEditor({ draft, onChange, onLoadAttachment }) {
  const items = draft.details.items || [];
  function changeItems(nextItems) {
    onChange({ ...draft, details: { ...draft.details, items: nextItems } });
  }
  function updateItem(id, changes) {
    changeItems(items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }
  return (
    <section className="knowledgeCatalogEditor" aria-label="Elementos do catálogo">
      <div className="knowledgeCatalogToolbar">
        <h3>Elementos do catálogo ({items.length})</h3>
        <button
          className="secondaryButton"
          disabled={items.length >= 500}
          onClick={() => changeItems([...items, { id: crypto.randomUUID(), title: "", description: "" }])}
          type="button"
        >
          <Plus size={16} /> Adicionar elemento
        </button>
      </div>
      {!items.length ? <p className="muted">Adicione o primeiro elemento do catálogo.</p> : null}
      <div className="knowledgeCatalogItems">
        {items.map((item, index) => (
          <details className="knowledgeCatalogItem" key={item.id} open>
            <summary>{item.title || `Novo elemento ${index + 1}`}</summary>
            <div className="knowledgeCatalogItemBody">
              <label className="field">
                <span>Título / nome</span>
                <input
                  aria-label={`Título do elemento ${index + 1}`}
                  maxLength={240}
                  onChange={(event) => updateItem(item.id, { title: event.target.value })}
                  required
                  value={item.title}
                />
              </label>
              <div className="field">
                <span>Descrição em Markdown</span>
                <MarkdownEditor
                  ariaLabel={`Descrição do elemento ${index + 1}`}
                  attachments={draft.attachments}
                  initialMode="text"
                  onChange={(description) => updateItem(item.id, { description })}
                  onLoadAttachment={onLoadAttachment}
                  value={item.description}
                />
              </div>
              <button
                aria-label={`Remover elemento ${index + 1}`}
                className="dangerButton"
                onClick={() => changeItems(items.filter(({ id }) => id !== item.id))}
                type="button"
              >
                <Trash2 size={16} /> Remover elemento
              </button>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
