import { useEffect, useRef, useState } from "react";

import {
  fetchEmlSanitizationConfiguration,
  importEml,
  saveEmlSanitizationConfiguration,
} from "../../../../api.js";
import { useFileDrop } from "../../../shared/useFileDrop.js";

export function useEmlSanitizationDialog({
  applicationId,
  onClose,
  onSaved,
  sampleFile,
  workspaceId,
}) {
  const [config, setConfig] = useState(null);
  const [source, setSource] = useState("");
  const [previewFile, setPreviewFile] = useState(sampleFile || null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchEmlSanitizationConfiguration()
      .then((result) => {
        if (!active) return;
        setConfig(result.config);
        setSource(result.source);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function updateConfig(patch) {
    setConfig((current) => ({ ...current, ...patch }));
    setPreview(null);
  }

  function selectPreviewFiles(files) {
    const file = files.find(
      (candidate) =>
        candidate.name.toLowerCase().endsWith(".eml") ||
        candidate.type === "message/rfc822",
    );
    if (!file && files.length) {
      setError("Selecione um arquivo EML válido para gerar a prévia.");
    } else if (file) {
      setError("");
    }
    setPreviewFile(file || null);
    setPreview(null);
  }

  async function calculatePreview() {
    if (!previewFile || !config || !applicationId) return;
    setPreviewing(true);
    setError("");
    try {
      setPreview(
        await importEml(previewFile, {
          dryRun: true,
          workspaceId,
          applicationId,
          sanitizationConfig: config,
        }),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await saveEmlSanitizationConfiguration(config);
      setConfig(result.config);
      setSource(result.source);
      await onSaved?.(result);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving || previewing;
  const { isDraggingFiles, dropTargetProps } = useFileDrop({
    disabled: busy,
    onDropFiles: selectPreviewFiles,
  });

  return {
    busy,
    calculatePreview,
    config,
    dropTargetProps,
    error,
    isDraggingFiles,
    loading,
    preview,
    previewFile,
    previewInputRef,
    previewing,
    save,
    saving,
    selectPreviewFiles,
    source,
    updateConfig,
  };
}
