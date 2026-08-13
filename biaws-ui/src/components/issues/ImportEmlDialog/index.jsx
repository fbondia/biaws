import { EmlSanitizationDialog } from "../EmlSanitizationDialog/index.jsx";
import { ImportEmlClassificationDialog } from "./components/ImportEmlClassificationDialog.jsx";
import { ImportEmlContextDialog } from "./components/ImportEmlContextDialog.jsx";
import { ImportEmlMainDialog } from "./components/ImportEmlMainDialog.jsx";
import { useImportEmlDialog } from "./hooks/useImportEmlDialog.js";

export function ImportEmlDialog({
  applications = [],
  canClassify = false,
  canConfigureSanitization = false,
  classificationScope = null,
  components = [],
  onClose,
  onImported,
  taxonomyPackage,
  workspace,
}) {
  const dialog = useImportEmlDialog({
    applications,
    classificationScope,
    onImported,
    workspace,
  });

  return (
    <div
      className="dialogBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !dialog.busy) onClose();
      }}
    >
      <ImportEmlMainDialog
        {...dialog}
        applications={applications}
        canClassify={canClassify}
        canConfigureSanitization={canConfigureSanitization}
        classificationScope={classificationScope}
        components={components}
        onClose={onClose}
      />
      <ImportEmlContextDialog
        {...dialog}
        applications={applications}
        components={components}
      />
      <ImportEmlClassificationDialog
        {...dialog}
        taxonomyPackage={taxonomyPackage}
      />
      {dialog.sanitizationOpen ? (
        <EmlSanitizationDialog
          applicationId={dialog.sanitizationApplicationId}
          onClose={() => dialog.setSanitizationOpen(false)}
          onSaved={dialog.handleSanitizationSaved}
          sampleFile={
            dialog.entries.find((entry) => entry.status !== "done")?.file
          }
          workspaceId={workspace?.id}
        />
      ) : null}
    </div>
  );
}
