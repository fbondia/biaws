import { useState } from "react";
import { createRoot } from "react-dom/client";

import { configureApiSession } from "../../src/api/client.js";
import { DocumentDetail } from "../../src/components/knowledge/KnowledgeRecordsView/components/DocumentDetail/index.jsx";
import { normalizedDraft } from "../../src/components/knowledge/KnowledgeRecordsView/model.js";
import { MarkdownEditor } from "../../src/components/shared/MarkdownEditor/index.jsx";
import "../../src/styles.css";
import "../../src/styles/features/knowledge/index.css";

export { act } from "react";
export { mountMarkdownPreview } from "./MarkdownPreviewHarness.jsx";

export function mountMarkdownEditor(element, initialValue, props = {}) {
  const root = createRoot(element);
  function Harness() {
    const [value, setValue] = useState(initialValue);
    return <MarkdownEditor {...props} value={value} onChange={setValue} />;
  }
  root.render(<Harness />);
  return { root };
}

export function mountDocumentDetail(element, document, props = {}) {
  const root = createRoot(element);
  const resetSession = configureApiSession({ getWorkspaceId: () => "synthetic-workspace" });
  function Harness() {
    const [draft, setDraft] = useState(() => normalizedDraft(document));
    return (
      <DocumentDetail
        canReadAttachments
        canUpdate
        catalog={{ applications: [], components: [] }}
        currentWorkspaceId="synthetic-workspace"
        draft={draft}
        onChange={setDraft}
        onSave={() => {}}
        taxonomyPackage={{ taxonomy: [], tagGroups: [] }}
        workspaces={[]}
        {...props}
      />
    );
  }
  root.render(<Harness />);
  return { root, resetSession };
}
