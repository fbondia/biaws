import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchDocuments, fetchResourceCollections } from "../../api.js";
import { buildRuntimeDocumentTree } from "./runtimeProcedureSelectorModel.js";

async function fetchAllDocuments(params) {
  const firstPage = await fetchDocuments({ ...params, limit: 100, page: 1 });
  const items = [...(firstPage.items || [])];
  const totalPages = firstPage.meta?.totalPages || 1;
  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await fetchDocuments({ ...params, limit: 100, page });
    items.push(...(payload.items || []));
  }
  return items;
}

function retainAvailableIds(current, availableIds) {
  return new Set([...current].filter((id) => availableIds.has(id)));
}

function DocumentLeaf({ checked, document, onToggle }) {
  return (
    <label className="runtimeProcedureTreeLeaf">
      <span className="runtimeProcedureTreeGuide" />
      <FileText size={15} />
      <span>{document.title}</span>
      <input
        checked={checked}
        onChange={() => onToggle(document.id)}
        type="checkbox"
      />
    </label>
  );
}

function CollectionNode({
  collection,
  collapsedIds,
  onToggle,
  toggleDocument,
  selectedIds,
}) {
  const collapsed = collapsedIds.has(collection.id);
  const hasContent = collection.children.length || collection.documents.length;
  return (
    <div className="runtimeProcedureTreeBranch">
      <button
        aria-expanded={!collapsed}
        className="runtimeProcedureTreeCollection"
        onClick={() => onToggle(collection.id)}
        type="button"
      >
        {hasContent ? (
          collapsed ? (
            <ChevronRight size={15} />
          ) : (
            <ChevronDown size={15} />
          )
        ) : (
          <span />
        )}
        {collapsed ? <Folder size={16} /> : <FolderOpen size={16} />}
        <span>{collection.name}</span>
      </button>
      {!collapsed ? (
        <div className="runtimeProcedureTreeChildren">
          {collection.children.map((child) => (
            <CollectionNode
              collapsedIds={collapsedIds}
              collection={child}
              key={child.id}
              onToggle={onToggle}
              selectedIds={selectedIds}
              toggleDocument={toggleDocument}
            />
          ))}
          {collection.documents.map((document) => (
            <DocumentLeaf
              checked={selectedIds.has(document.id)}
              document={document}
              key={document.id}
              onToggle={toggleDocument}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RuntimeProcedureSelectorDialog({
  applicationId,
  componentId,
  onClose,
  onConfirm,
  selectedIds: initialSelectedIds = [],
}) {
  const [collections, setCollections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(initialSelectedIds),
  );
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const tree = useMemo(
    () => buildRuntimeDocumentTree(collections, documents),
    [collections, documents],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchAllDocuments({ applicationId, componentId, includeWorkspace: true }),
      fetchResourceCollections("documents"),
    ])
      .then(([documentItems, collectionPayload]) => {
        if (!active) return;
        setDocuments(documentItems);
        setCollections(collectionPayload.items || []);
        const availableIds = new Set(documentItems.map(({ id }) => id));
        setSelectedIds((current) => retainAvailableIds(current, availableIds));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applicationId, componentId]);

  function toggleCollection(collectionId) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  }

  function toggleDocument(documentId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else if (next.size < 100) next.add(documentId);
      return next;
    });
  }

  const empty = !tree.collections.length && !tree.documents.length;

  return (
    <div
      className="dialogBackdrop runtimeProcedureSelectorBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="runtimeProcedureSelectorTitle"
        aria-modal="true"
        className="runtimeProcedureSelectorDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Documentos relacionados</span>
            <h2 id="runtimeProcedureSelectorTitle">Selecionar documentos</h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="runtimeProcedureSelectorBody">
          <p>
            São exibidos documentos do workspace ou da aplicação deste runtime.
          </p>
          {loading ? (
            <div className="catalogColumnEmpty">Carregando…</div>
          ) : null}
          {error ? <div className="errorBox">{error}</div> : null}
          {!loading && !error && empty ? (
            <div className="catalogColumnEmpty">
              Nenhum documento relacionado foi encontrado.
            </div>
          ) : null}
          {!loading && !error && !empty ? (
            <div className="runtimeProcedureTree" role="tree">
              {tree.collections.map((collection) => (
                <CollectionNode
                  collapsedIds={collapsedIds}
                  collection={collection}
                  key={collection.id}
                  onToggle={toggleCollection}
                  selectedIds={selectedIds}
                  toggleDocument={toggleDocument}
                />
              ))}
              {tree.documents.map((document) => (
                <DocumentLeaf
                  checked={selectedIds.has(document.id)}
                  document={document}
                  key={document.id}
                  onToggle={toggleDocument}
                />
              ))}
            </div>
          ) : null}
        </div>
        <footer>
          <span>{selectedIds.size} selecionado(s)</span>
          <div>
            <button className="secondaryButton" onClick={onClose} type="button">
              Cancelar
            </button>
            <button
              className="primaryButton"
              disabled={loading || Boolean(error)}
              onClick={() => onConfirm([...selectedIds])}
              type="button"
            >
              Confirmar seleção
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
