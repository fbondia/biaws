import { useEffect, useRef, useState } from "react";

import { updateIssue } from "../../../../api.js";

export function useIssueIdentityEditor({ issue, onIssueUpdated }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ identifier: "", title: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const identifier = draft.identifier.trim();
  const title = draft.title.trim();
  const identifierError =
    identifier.length > 100 || /[\s/\\]/u.test(identifier) ? "Use até 100 caracteres, sem espaços ou barras." : "";
  const hasChanges = identifier !== (issue.identifier || "") || title !== (issue.title || "");
  const canSave = Boolean(issue.id && title && !identifierError && hasChanges && !saving);

  useEffect(() => {
    setEditing(false);
    setSaving(false);
    return () => {
      requestRef.current += 1;
    };
  }, [issue.id]);

  function openEditor() {
    setDraft({ identifier: issue.identifier || "", title: issue.title || "" });
    setError("");
    setEditing(true);
  }

  function closeEditor() {
    if (!saving) setEditing(false);
  }

  async function saveIdentity(event) {
    event.preventDefault();
    if (!canSave) return;
    const requestId = ++requestRef.current;
    setSaving(true);
    setError("");
    try {
      const payload = await updateIssue(issue.id, { identifier, title });
      if (requestId !== requestRef.current) return;
      await onIssueUpdated?.(payload.issue);
      if (requestId === requestRef.current) setEditing(false);
    } catch (saveError) {
      if (requestId === requestRef.current) setError(saveError.message);
    } finally {
      if (requestId === requestRef.current) setSaving(false);
    }
  }

  return { canSave, closeEditor, draft, editing, error, identifierError, openEditor, saveIdentity, saving, setDraft };
}
