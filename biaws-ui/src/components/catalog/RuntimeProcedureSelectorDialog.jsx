import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchProcedureCollections, fetchProcedures } from "../../api.js";
import { buildRuntimeProcedureTree } from "./runtimeProcedureSelectorModel.js";

async function fetchAllProcedures(params) {
  const firstPage = await fetchProcedures({ ...params, limit: 100, page: 1 });
  const items = [...(firstPage.items || [])];
  const totalPages = firstPage.meta?.totalPages || 1;
  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await fetchProcedures({ ...params, limit: 100, page });
    items.push(...(payload.items || []));
  }
  return items;
}

function retainAvailableIds(current, availableIds) {
  return new Set([...current].filter((id) => availableIds.has(id)));
}

function ProcedureLeaf({ checked, onToggle, procedure }) {
  return (
    <label className="runtimeProcedureTreeLeaf">
      <span className="runtimeProcedureTreeGuide" />
      <FileText size={15} />
      <span>{procedure.title}</span>
      <input
        checked={checked}
        onChange={() => onToggle(procedure.id)}
        type="checkbox"
      />
    </label>
  );
}

function CollectionNode({
  collection,
  collapsedIds,
  onToggle,
  toggleProcedure,
  selectedIds,
}) {
  const collapsed = collapsedIds.has(collection.id);
  const hasContent = collection.children.length || collection.procedures.length;
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
              toggleProcedure={toggleProcedure}
            />
          ))}
          {collection.procedures.map((procedure) => (
            <ProcedureLeaf
              checked={selectedIds.has(procedure.id)}
              key={procedure.id}
              onToggle={toggleProcedure}
              procedure={procedure}
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
  const [procedures, setProcedures] = useState([]);
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(initialSelectedIds),
  );
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const tree = useMemo(
    () => buildRuntimeProcedureTree(collections, procedures),
    [collections, procedures],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchAllProcedures({ applicationId, componentId }),
      fetchProcedureCollections(),
    ])
      .then(([procedureItems, collectionPayload]) => {
        if (!active) return;
        setProcedures(procedureItems);
        setCollections(collectionPayload.items || []);
        const availableIds = new Set(procedureItems.map(({ id }) => id));
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

  function toggleProcedure(procedureId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(procedureId)) next.delete(procedureId);
      else if (next.size < 100) next.add(procedureId);
      return next;
    });
  }

  const empty = !tree.collections.length && !tree.procedures.length;

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
            <span>Procedimentos relacionados</span>
            <h2 id="runtimeProcedureSelectorTitle">Selecionar procedimentos</h2>
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
            São exibidos apenas procedimentos vinculados à aplicação e ao
            componente deste runtime.
          </p>
          {loading ? (
            <div className="catalogColumnEmpty">Carregando…</div>
          ) : null}
          {error ? <div className="errorBox">{error}</div> : null}
          {!loading && !error && empty ? (
            <div className="catalogColumnEmpty">
              Nenhum procedimento relacionado foi encontrado.
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
                  toggleProcedure={toggleProcedure}
                />
              ))}
              {tree.procedures.map((procedure) => (
                <ProcedureLeaf
                  checked={selectedIds.has(procedure.id)}
                  key={procedure.id}
                  onToggle={toggleProcedure}
                  procedure={procedure}
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
