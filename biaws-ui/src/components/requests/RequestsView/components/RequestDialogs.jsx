import { CatalogContextFields } from "../../../catalog/CatalogContextFields/index.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
} from "../../../shared/ResourceCollections/index.jsx";

export function RequestDialogs({
  addRequest,
  catalog,
  collectionState,
  newContext,
  savingRequestId,
  setNewContext,
}) {
  return (
    <>
      {newContext ? (
        <div
          className="dialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNewContext(null);
          }}
        >
          <section
            aria-labelledby="new-demand-context-title"
            aria-modal="true"
            className="catalogContextDialog"
            role="dialog"
          >
            <header>
              <div>
                <span>Nova melhoria</span>
                <h2 id="new-demand-context-title">Defina o contexto</h2>
              </div>
            </header>
            <p>
              A melhoria precisa pertencer a uma aplicação. Os componentes
              afetados podem ser definidos agora ou depois.
            </p>
            <CatalogContextFields
              affectedComponentIds={newContext.affectedComponentIds}
              applicationId={newContext.applicationId}
              applications={catalog.applications}
              components={catalog.components}
              onChange={setNewContext}
            />
            <footer>
              <button
                className="secondaryButton"
                onClick={() => setNewContext(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primaryButton"
                disabled={
                  !newContext.applicationId || savingRequestId === "new"
                }
                onClick={() => addRequest(newContext)}
                type="button"
              >
                Criar melhoria
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {collectionState.collectionDialog ? (
        <ResourceCollectionDialog
          collection={
            collectionState.collectionDialog.id
              ? collectionState.collectionDialog
              : null
          }
          onClose={() => collectionState.setCollectionDialog(null)}
          onSave={collectionState.saveCollection}
          parentLabel={collectionPathLabel(
            collectionState.collections,
            collectionState.selectedCollectionId,
          )}
          resourceLabel="melhorias"
        />
      ) : null}
    </>
  );
}
