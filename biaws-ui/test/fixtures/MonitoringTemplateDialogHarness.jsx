import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { TemplateDialog } from "../../src/components/settings/MonitoringTemplatesView/TemplateDialog/index.jsx";
import { monitoringTemplateDraft } from "../../src/components/settings/MonitoringTemplatesView/model.js";

export function mountMonitoringTemplateDialog(element, onPreview) {
  const root = createRoot(element);
  const draft = monitoringTemplateDraft();
  flushSync(() =>
    root.render(
      <TemplateDialog
        draft={draft}
        onChange={() => {}}
        onClose={() => {}}
        onPreview={onPreview}
        onSave={() => {}}
        preview={null}
        previewSample={draft.inputSampleText}
        saving={false}
        setPreviewSample={() => {}}
      />,
    ),
  );
  return root;
}
