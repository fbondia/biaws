import { AlertTriangle, FolderOpen, Upload, X } from "lucide-react";
import { useState } from "react";

import { publishSkill } from "../../../../api.js";
import { useMessages } from "../../../../infrastructure/messages/MessagesProvider.jsx";
import { useFileDrop } from "../../../shared/useFileDrop.js";
import {
  buildFiles,
  filesFromDataTransfer,
  fileSourcePath,
  parseSkillFrontmatter,
  relativeFilePath,
} from "../utils.js";

export function PublishSkillDialog({ onClose, onPublished }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [directoryName, setDirectoryName] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { run: runWithLoading } = useMessages();

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function readDirectory(selected) {
    setError("");
    setReading(true);
    try {
      await runWithLoading(async () => {
        const files = await buildFiles(selected);
        const skillFile = selected.find(
          (file) => relativeFilePath(file) === "SKILL.md",
        );
        if (!skillFile)
          throw new Error("O diretório selecionado não contém SKILL.md");
        const frontmatter = parseSkillFrontmatter(await skillFile.text());
        const sourceParts = fileSourcePath(skillFile)
          .replaceAll("\\", "/")
          .split("/")
          .filter(Boolean);
        const rootName = sourceParts.length > 1 ? sourceParts[0] : "";
        setDirectoryName(rootName);
        setDraft((current) => ({
          ...current,
          skillId: frontmatter.name || current.skillId || rootName,
          name: current.name || frontmatter.name || rootName,
          description: frontmatter.description || current.description,
          files,
        }));
      }, "Lendo arquivos da skill…");
    } catch (readError) {
      setError(readError.message);
      setDraft((current) => ({ ...current, files: [] }));
    } finally {
      setReading(false);
    }
  }

  function selectDirectory(event) {
    void readDirectory([...(event.target.files || [])]);
    event.target.value = "";
  }

  async function dropDirectory(_files, dataTransfer) {
    try {
      await readDirectory(await filesFromDataTransfer(dataTransfer));
    } catch (readError) {
      setError(readError.message);
      setDraft((current) => ({ ...current, files: [] }));
    }
  }

  const { isDraggingFiles, dropTargetProps } = useFileDrop({
    disabled: reading || saving,
    onDropFiles: dropDirectory,
  });

  async function submit(event) {
    event.preventDefault();
    if (!draft.files.length) {
      setError("Selecione o diretório completo da skill.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await runWithLoading(async () => {
        await publishSkill(draft);
        await onPublished();
        onClose();
      }, "Publicando skill…");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialogBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby="publish-skill-dialog-title"
        aria-modal="true"
        className="skillDialog publishSkillDialog"
        role="dialog"
      >
        <header className="skillDialogHeader">
          <div>
            <span>Catálogo de skills</span>
            <h2 id="publish-skill-dialog-title">Publicar nova versão</h2>
          </div>
          <button
            aria-label="Fechar publicação de skill"
            className="iconButton"
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <form className="skillPublishForm" onSubmit={submit}>
          {error ? (
            <div className="skillInlineError">
              <AlertTriangle size={17} />
              {error}
            </div>
          ) : null}
          <label
            {...dropTargetProps}
            className={`skillDirectoryPicker${isDraggingFiles ? " fileDropTargetActive" : ""}`}
          >
            <FolderOpen size={22} />
            <span>
              <strong>
                {directoryName || "Selecionar diretório da skill"}
              </strong>
              <small>
                {draft.files.length
                  ? `${draft.files.length} arquivo(s) selecionado(s)`
                  : "Arraste a pasta ou clique; inclua SKILL.md e demais arquivos"}
              </small>
            </span>
            <input
              directory=""
              disabled={reading || saving}
              multiple
              onChange={selectDirectory}
              type="file"
              webkitdirectory=""
            />
          </label>
          <div className="skillFormGrid">
            <label>
              <span>Identificador</span>
              <input
                onChange={(event) => update("skillId", event.target.value)}
                required
                value={draft.skillId}
              />
            </label>
            <label>
              <span>Versão</span>
              <input
                onChange={(event) => update("version", event.target.value)}
                placeholder="1.0.0"
                required
                value={draft.version}
              />
            </label>
            <label className="skillFormWide">
              <span>Nome</span>
              <input
                onChange={(event) => update("name", event.target.value)}
                required
                value={draft.name}
              />
            </label>
            <label className="skillFormWide">
              <span>Descrição</span>
              <textarea
                onChange={(event) => update("description", event.target.value)}
                required
                rows={3}
                value={draft.description}
              />
            </label>
            <label className="skillFormWide">
              <span>Changelog</span>
              <textarea
                onChange={(event) => update("changelog", event.target.value)}
                placeholder="Descreva as alterações desta versão."
                rows={3}
                value={draft.changelog}
              />
            </label>
          </div>
          <footer className="skillDialogFooter">
            <button
              className="secondaryButton"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="primaryButton"
              disabled={saving || reading || !draft.files.length}
              type="submit"
            >
              <Upload size={16} />
              {saving ? "Publicando..." : "Publicar versão"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
