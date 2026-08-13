import { RuntimeProcedureDetailsDialog } from "../../RuntimeProcedureDetailsDialog.jsx";
import { RuntimeProcedureSelectorDialog } from "../../RuntimeProcedureSelectorDialog/index.jsx";

export function CatalogEntityOverlays({
  documentSelectorOpen,
  onConfirmDocuments,
  options,
  runtimeComponent,
  selectedDocument,
  selectedIds,
  setDocumentSelectorOpen,
  setSelectedDocument,
}) {
  return (
    <>
      {documentSelectorOpen ? (
        <RuntimeProcedureSelectorDialog
          applicationId={options.application?.id}
          componentId={runtimeComponent?.id}
          onClose={() => setDocumentSelectorOpen(false)}
          onConfirm={onConfirmDocuments}
          selectedIds={selectedIds}
        />
      ) : null}
      {selectedDocument ? (
        <RuntimeProcedureDetailsDialog
          application={options.application}
          applications={options.applications}
          components={options.components}
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      ) : null}
    </>
  );
}
