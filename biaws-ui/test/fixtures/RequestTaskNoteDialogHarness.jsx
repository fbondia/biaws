import { useState } from "react";
import { createRoot } from "react-dom/client";

import { RequestTaskNoteDialog } from "../../src/components/requests/details/RequestTaskNoteDialog.jsx";

export function mountRequestTaskNoteDialog(element) {
  const root = createRoot(element);

  function Harness() {
    const [draft, setDraft] = useState({ date: "2026-09-03", content: "" });

    return (
      <RequestTaskNoteDialog
        draft={draft}
        mode="create"
        onChange={setDraft}
        onClose={() => {}}
        onSave={() => {}}
        saving={false}
      />
    );
  }

  root.render(<Harness />);
  return { root };
}
