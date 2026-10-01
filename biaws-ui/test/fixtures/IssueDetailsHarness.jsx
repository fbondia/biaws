import { useState } from "react";
import { createRoot } from "react-dom/client";

import { IssueDetailsDialog } from "../../src/components/issues/IssueDetailsDialog/index.jsx";
import { MessagesProvider } from "../../src/infrastructure/messages/MessagesProvider.jsx";
import { configureApiSession } from "../../src/api/client.js";
import "../../src/styles.css";
import "../../src/styles/features/issues/index.css";

export { act } from "react";
export { mountMarkdownPreview } from "./MarkdownPreviewHarness.jsx";

export function mountIssueDetails(element, initialDetails, onIssueUpdated = () => {}) {
  const root = createRoot(element);
  const resetSession = configureApiSession({ getWorkspaceId: () => "synthetic-workspace" });
  function Harness() {
    const [details, setDetails] = useState(initialDetails);
    return (
      <MessagesProvider>
        <IssueDetailsDialog
          canEditContext
          canCreateComment
          canUpdateComment
          details={details}
          onClose={() => {}}
          onIssueDetailsUpdated={setDetails}
          onIssueUpdated={(issue) => {
            onIssueUpdated(issue);
            setDetails((current) => ({ ...current, issue }));
          }}
        />
      </MessagesProvider>
    );
  }
  root.render(<Harness />);
  return { root, resetSession };
}
