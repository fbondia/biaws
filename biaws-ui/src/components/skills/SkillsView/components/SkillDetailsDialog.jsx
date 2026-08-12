import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Code2,
  CopyPlus,
  Download,
  File,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  deprecateSkill,
  downloadSkillPackage,
  fetchSkillPackage,
} from "../../../../api.js";
import { useLoading } from "../../../shared/LoadingProvider.jsx";
import { decodePreview, formatBytes, formatDate } from "../utils.js";
import { SkillReplicationDialog } from "./SkillReplicationDialog.jsx";

export function SkillDetailsDialog({
  currentWorkspaceId,
  embedded = false,
  skill,
  onClose,
  onChanged,
  workspaces = [],
}) {
  const [selectedVersion, setSelectedVersion] = useState(skill.latestVersion);
  const [skillPackage, setSkillPackage] = useState(null);
  const [selectedFile, setSelectedFile] = useState("SKILL.md");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [replicationOpen, setReplicationOpen] = useState(false);
  const { runWithLoading } = useLoading();
  const version = skill.versions.find(
    (item) => item.version === selectedVersion,
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSkillPackage(null);
    runWithLoading(
      () => fetchSkillPackage(skill.skillId, selectedVersion),
      "Carregando pacote da skill…",
    )
      .then((payload) => {
        if (!active) return;
        setSkillPackage(payload);
        const paths = payload.skill.files?.map((file) => file.path) || [];
        setSelectedFile(
          paths.includes("SKILL.md") ? "SKILL.md" : paths[0] || "",
        );
      })
      .catch((loadError) => active && setError(loadError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [skill.skillId, selectedVersion]);

  const activeFile = skillPackage?.skill?.files?.find(
    (file) => file.path === selectedFile,
  );
  const preview = useMemo(() => decodePreview(activeFile), [activeFile]);

  async function deprecate() {
    if (!window.confirm(`Descontinuar ${skill.skillId}@${selectedVersion}?`))
      return;
    setActionLoading("deprecate");
    setError("");
    try {
      await runWithLoading(async () => {
        await deprecateSkill(skill.skillId, selectedVersion);
        await onChanged();
        onClose();
      }, "Descontinuando versão da skill…");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setActionLoading("");
    }
  }

  const details = (
    <section
      aria-label={embedded ? `Detalhes da skill ${skill.name}` : undefined}
      aria-modal={embedded ? undefined : "true"}
      className={[
        "skillDialog",
        "skillDetailsDialog",
        embedded ? "embeddedCollectionItemDetail" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={embedded ? "region" : "dialog"}
    >
      <header className="skillDialogHeader">
        <div>
          <span>{skill.skillId}</span>
          <h2>{skill.name}</h2>
        </div>
        <button
          className="iconButton"
          onClick={onClose}
          title={embedded ? "Voltar para a coleção" : "Fechar"}
          type="button"
        >
          <X size={18} />
        </button>
      </header>
      <div className="skillDetailsBody">
        <aside className="skillVersionsPanel">
          <strong>Versões</strong>
          {skill.versions.map((item) => (
            <button
              className={
                selectedVersion === item.version
                  ? "skillVersionButton activeSkillVersion"
                  : "skillVersionButton"
              }
              key={item.version}
              onClick={() => setSelectedVersion(item.version)}
              type="button"
            >
              <span>{item.version}</span>
              <small
                className={
                  item.status === "deprecated" ? "skillDeprecatedText" : ""
                }
              >
                {item.status}
              </small>
            </button>
          ))}
        </aside>
        <div className="skillPackagePanel">
          <div className="skillPackageToolbar">
            <div>
              <strong>Versão {selectedVersion}</strong>
              <span>{formatDate(version?.createdAt)}</span>
            </div>
            <div>
              <button
                className="secondaryButton"
                onClick={async () => {
                  setError("");
                  try {
                    await runWithLoading(
                      () =>
                        downloadSkillPackage(skill.skillId, selectedVersion),
                      "Preparando download da skill…",
                    );
                  } catch (downloadError) {
                    setError(downloadError.message);
                  }
                }}
                type="button"
              >
                <Download size={15} /> Baixar
              </button>
              {workspaces.some(({ id }) => id !== currentWorkspaceId) ? (
                <button
                  className="secondaryButton"
                  onClick={() => setReplicationOpen(true)}
                  type="button"
                >
                  <CopyPlus size={15} /> Replicar
                </button>
              ) : null}
              {version?.status !== "deprecated" ? (
                <button
                  className="dangerButton"
                  disabled={actionLoading === "deprecate"}
                  onClick={deprecate}
                  type="button"
                >
                  <Archive size={15} /> Descontinuar
                </button>
              ) : null}
            </div>
          </div>
          {error ? (
            <div className="skillInlineError">
              <AlertTriangle size={17} />
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="emptyState">Carregando pacote...</div>
          ) : skillPackage ? (
            <div className="skillFileBrowser">
              <nav aria-label="Arquivos da skill" className="skillFileList">
                {skillPackage.skill.files.map((file) => (
                  <button
                    className={
                      selectedFile === file.path
                        ? "skillFileButton activeSkillFile"
                        : "skillFileButton"
                    }
                    key={file.path}
                    onClick={() => setSelectedFile(file.path)}
                    type="button"
                  >
                    <File size={14} />
                    <span>{file.path}</span>
                    <small>{formatBytes(file.size)}</small>
                  </button>
                ))}
              </nav>
              <section className="skillFilePreview">
                <header>
                  <Code2 size={15} />
                  <strong>{selectedFile}</strong>
                </header>
                {preview === null ? (
                  <div className="emptyState">
                    Arquivo binário — utilize o download do pacote.
                  </div>
                ) : (
                  <pre>{preview}</pre>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );

  const replicationDialog = (
    <SkillReplicationDialog
      currentWorkspaceId={currentWorkspaceId}
      onClose={() => setReplicationOpen(false)}
      open={replicationOpen}
      skillId={skill.skillId}
      version={selectedVersion}
      workspaces={workspaces}
    />
  );

  if (embedded)
    return (
      <>
        {details}
        {replicationDialog}
      </>
    );

  return (
    <div
      className="dialogBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      {details}
      {replicationDialog}
    </div>
  );
}
