import { useEffect, useMemo, useState } from "react";

import {
  archiveSecret,
  copySecretValue,
  deleteSecret,
  downloadSecretFile,
  fetchApplications,
  fetchSecrets,
  revealSecretValue,
  restoreSecret,
} from "../../../../api.js";
import { hasEveryPermission, hasPermission } from "../../../../permissions.js";
import { useMessages } from "../../../../infrastructure/messages/MessagesProvider.jsx";
import { canActOnSecret } from "../model.js";

export function useSecretsView(actor) {
  const { confirm } = useMessages();
  const [secrets, setSecrets] = useState([]);
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [versioning, setVersioning] = useState(null);
  const [revealed, setRevealed] = useState(null);
  const [showValue, setShowValue] = useState(false);
  const [copiedSecretId, setCopiedSecretId] = useState(null);
  const permissions = {
    create: hasEveryPermission(actor, "secrets.create", "secrets.value.write"),
    write: hasPermission(actor, "secrets.value.write"),
    update: hasPermission(actor, "secrets.update"),
    reveal: hasPermission(actor, "secrets.value.reveal"),
    archive: hasPermission(actor, "secrets.archive"),
  };
  const applicationNames = useMemo(
    () => Object.fromEntries(applications.map(({ id, name }) => [id, name])),
    [applications],
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [secretsPayload, applicationsPayload] = await Promise.all([
        fetchSecrets({ limit: 100, includeArchived }),
        hasPermission(actor, "applications.read")
          ? fetchApplications(actor.workspaceId, { limit: 100 })
          : Promise.resolve({ items: [] }),
      ]);
      setSecrets(secretsPayload.items || []);
      setApplications(applicationsPayload.items || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [includeArchived]);

  useEffect(() => {
    if (!revealed) return undefined;
    const timer = window.setTimeout(() => {
      setRevealed(null);
      setShowValue(false);
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  useEffect(() => {
    if (!copiedSecretId) return undefined;
    const timer = window.setTimeout(() => setCopiedSecretId(null), 2_500);
    return () => window.clearTimeout(timer);
  }, [copiedSecretId]);

  async function reveal(secret) {
    setError("");
    setRevealed(null);
    try {
      const payload = await revealSecretValue(secret.id);
      setRevealed({ ...payload, secretId: secret.id });
      setShowValue(false);
    } catch (revealError) {
      setError(revealError.message);
    }
  }

  async function copyValue(secret) {
    setError("");
    try {
      const payload = await copySecretValue(secret.id);
      await navigator.clipboard.writeText(payload.value);
      setCopiedSecretId(secret.id);
    } catch (copyError) {
      setError(copyError.message);
    }
  }

  async function download(secret) {
    setError("");
    try {
      const payload = await downloadSecretFile(secret.id);
      const url = window.URL.createObjectURL(payload.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payload.fileName
        ? decodeURIComponent(payload.fileName)
        : secret.file?.name || "secret-file";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  async function archive(secret) {
    if (!(await confirm(`Arquivar o segredo “${secret.name}”?`))) return false;
    setError("");
    try {
      await archiveSecret(secret.id);
      setRevealed(null);
      await load();
      return true;
    } catch (archiveError) {
      setError(archiveError.message);
      return false;
    }
  }

  async function restore(secret) {
    if (!(await confirm(`Desarquivar o segredo “${secret.name}”?`)))
      return false;
    setError("");
    try {
      await restoreSecret(secret.id);
      await load();
      return true;
    } catch (restoreError) {
      setError(restoreError.message);
      return false;
    }
  }

  async function remove(secret) {
    if (
      !(await confirm({
        message: `Excluir definitivamente o segredo “${secret.name}”? Todas as versões cifradas serão removidas e esta ação não poderá ser desfeita.`,
        tone: "danger",
      }))
    ) {
      return false;
    }
    setError("");
    try {
      await deleteSecret(secret.id);
      setRevealed(null);
      await load();
      return true;
    } catch (deleteError) {
      setError(deleteError.message);
      return false;
    }
  }

  function clearRevealed() {
    setRevealed(null);
    setShowValue(false);
  }

  function allowed(permission, secret) {
    return canActOnSecret(actor, permission, secret);
  }

  async function finishCreation() {
    setCreating(false);
    await load();
  }

  async function finishEditing() {
    setEditing(null);
    await load();
  }

  async function finishVersioning() {
    setVersioning(null);
    setRevealed(null);
    await load();
  }

  return {
    allowed,
    applicationNames,
    applications,
    archive,
    clearRevealed,
    copiedSecretId,
    copyValue,
    creating,
    download,
    editing,
    error,
    finishCreation,
    finishEditing,
    finishVersioning,
    includeArchived,
    loading,
    load,
    permissions,
    reveal,
    revealed,
    secrets,
    remove,
    restore,
    setCreating,
    setEditing,
    setError,
    setIncludeArchived,
    setShowValue,
    setVersioning,
    showValue,
    versioning,
  };
}
