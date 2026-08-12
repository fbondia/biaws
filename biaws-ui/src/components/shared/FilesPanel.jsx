import {
  Download,
  File,
  Paperclip,
  Plus,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { detailValue, formatBytes, formatDate } from "../../utils/issues.js";
import { canPreviewFile, FilePreview } from "./FilePreview.jsx";
import { useFileDrop } from "./useFileDrop.js";

export function FilesPanel({
  canCreate = true,
  canDelete = true,
  canUpdate = true,
  files = [],
  maxFileSizeMb = 50,
  maxFiles = 10,
  onDownload,
  onDelete,
  onPreview,
  onUpdateTags,
  onUpload,
}) {
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [deletingId, setDeletingId] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [editingTagsId, setEditingTagsId] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [savingTagsId, setSavingTagsId] = useState("");
  const { isDraggingFiles, dropTargetProps } = useFileDrop({
    disabled: uploading || !canCreate,
    onDropFiles: upload,
  });
  const tags = useMemo(() => {
    const counts = new Map();
    for (const file of files) {
      for (const tag of file.tags || []) {
        const normalized = String(tag).trim().toLowerCase();
        if (normalized)
          counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((first, second) => first.tag.localeCompare(second.tag));
  }, [files]);
  const visibleFiles = selectedTags.length
    ? files.filter((file) =>
        (file.tags || []).some((tag) =>
          selectedTags.includes(String(tag).toLowerCase()),
        ),
      )
    : files;

  useEffect(() => {
    const available = new Set(tags.map((item) => item.tag));
    setSelectedTags((current) => current.filter((tag) => available.has(tag)));
  }, [tags]);

  async function upload(fileList) {
    const selected = [...fileList];
    if (!selected.length) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const count = await onUpload(selected);
      setMessage(
        `${count ?? selected.length} arquivo(s) enviado(s) com sucesso.`,
      );
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  }

  async function download(file) {
    const fileId = String(file.id ?? file.index);
    setDownloadingId(fileId);
    setError("");
    try {
      await onDownload(file);
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setDownloadingId("");
    }
  }

  async function openFile(file) {
    if (!canPreviewFile(file)) {
      await download(file);
      return;
    }
    setPreview({ file, blob: null, error: "", loading: true });
    try {
      const blob = await onPreview(file);
      setPreview({ file, blob, error: "", loading: false });
    } catch (previewError) {
      setPreview({
        file,
        blob: null,
        error: previewError.message,
        loading: false,
      });
    }
  }

  async function remove(file) {
    if (
      !window.confirm(
        `Excluir permanentemente o arquivo “${file.filename || "anexo"}”?`,
      )
    )
      return;
    const fileId = String(file.id ?? file.index);
    setDeletingId(fileId);
    setError("");
    setMessage("");
    try {
      const result = await onDelete(file);
      if (preview?.file === file) setPreview(null);
      setMessage(
        result?.fileDeleteError
          ? `Registro excluído, mas o arquivo físico não pôde ser removido: ${result.fileDeleteError}`
          : "Arquivo excluído com sucesso.",
      );
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingId("");
    }
  }

  async function saveTags(file, nextTags) {
    const fileId = String(file.id ?? file.index);
    setSavingTagsId(fileId);
    setError("");
    try {
      await onUpdateTags(file, nextTags);
      setEditingTagsId("");
      setTagDraft("");
    } catch (tagError) {
      setError(tagError.message);
    } finally {
      setSavingTagsId("");
    }
  }

  function addTag(file) {
    const nextTag = tagDraft.trim().toLowerCase();
    if (!nextTag) return;
    void saveTags(file, [...(file.tags || []), nextTag]);
  }

  function toggleFilter(tag) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  }

  function removeTag(file, tag) {
    void saveTags(
      file,
      file.tags.filter((item) => item !== tag),
    );
  }

  return (
    <section className="detailSection filesSection">
      <div className="sectionTitleRow">
        <h3>Arquivos</h3>
        <span>
          <Paperclip size={14} />
          {files.length}
        </span>
      </div>

      {error ? <div className="errorBox dialogError">{error}</div> : null}
      {message ? <div className="infoBox">{message}</div> : null}

      {canCreate ? (
        <label
          {...dropTargetProps}
          className={[
            "fileUploadBox",
            uploading ? "disabledFileUploadBox" : "",
            isDraggingFiles ? "fileDropTargetActive" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Upload size={20} />
          <strong>
            {uploading
              ? "Enviando arquivos..."
              : "Arraste arquivos ou clique para selecionar"}
          </strong>
          <span>
            Até {maxFiles} arquivos por envio, com até {maxFileSizeMb} MB cada.
          </span>
          <input
            disabled={uploading}
            multiple
            onChange={(event) => {
              void upload(event.target.files);
              event.target.value = "";
            }}
            type="file"
          />
        </label>
      ) : null}

      {tags.length ? (
        <div className="fileTagFilters">
          <div>
            <Tag size={15} />
            <strong>Filtrar por tags</strong>
          </div>
          <div className="fileTagFilterList">
            {tags.map(({ tag, count }) => (
              <button
                aria-pressed={selectedTags.includes(tag)}
                className={
                  selectedTags.includes(tag)
                    ? "fileTagChip activeFileTagChip"
                    : "fileTagChip"
                }
                key={tag}
                onClick={() => toggleFilter(tag)}
                style={tagColor(tag)}
                type="button"
              >
                {tag}
                <span>{count}</span>
              </button>
            ))}
            {selectedTags.length ? (
              <button
                className="clearFileTagFilter"
                onClick={() => setSelectedTags([])}
                type="button"
              >
                Limpar filtro
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {visibleFiles.length ? (
        <div className="attachmentList fileAttachmentList">
          {visibleFiles.map((file) => {
            const fileId = String(file.id ?? file.index);
            const downloading = downloadingId === fileId;
            const deleting = deletingId === fileId;
            const savingTags = savingTagsId === fileId;
            return (
              <article
                className="attachmentItem fileAttachmentItem"
                key={`${fileId}-${file.filename}`}
              >
                <div className="fileAttachmentContent">
                  <button
                    className="filePreviewButton"
                    onClick={() => void openFile(file)}
                    type="button"
                  >
                    <File aria-hidden="true" size={20} />
                    <span>
                      <strong>{file.filename || "anexo"}</strong>
                      <small>
                        {detailValue(file.contentType)} ·{" "}
                        {formatBytes(file.size)} ·{" "}
                        {file.uploadedAt
                          ? `Adicionado em ${formatDate(file.uploadedAt)}`
                          : "Data não registrada"}
                      </small>
                    </span>
                  </button>
                  <div className="fileTags">
                    {(file.tags || []).map((tag) => (
                      <span
                        className="fileTagChip"
                        key={tag}
                        style={tagColor(tag)}
                      >
                        {tag}
                        {canUpdate ? (
                          <button
                            aria-label={`Remover tag ${tag}`}
                            disabled={savingTags}
                            onClick={() => removeTag(file, tag)}
                            type="button"
                          >
                            <X size={11} />
                          </button>
                        ) : null}
                      </span>
                    ))}
                    {canUpdate && editingTagsId === fileId ? (
                      <form
                        className="fileTagForm"
                        onSubmit={(event) => {
                          event.preventDefault();
                          addTag(file);
                        }}
                      >
                        <input
                          autoFocus
                          maxLength={40}
                          onChange={(event) => setTagDraft(event.target.value)}
                          placeholder="Nova tag"
                          value={tagDraft}
                        />
                        <button
                          className="secondaryButton"
                          disabled={savingTags || !tagDraft.trim()}
                          type="submit"
                        >
                          Adicionar
                        </button>
                        <button
                          className="iconButton"
                          onClick={() => setEditingTagsId("")}
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </form>
                    ) : canUpdate ? (
                      <button
                        className="addFileTagButton"
                        onClick={() => {
                          setEditingTagsId(fileId);
                          setTagDraft("");
                        }}
                        type="button"
                      >
                        <Plus size={12} /> Tag
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="fileAttachmentActions">
                  <button
                    className="secondaryButton compactFileButton"
                    disabled={downloading || deleting || !file.storage}
                    onClick={() => void download(file)}
                    type="button"
                  >
                    <Download size={15} />
                    {downloading ? "Baixando..." : "Baixar"}
                  </button>
                  {canDelete ? (
                    <button
                      aria-label={`Excluir ${file.filename || "arquivo"}`}
                      className="dangerButton compactFileButton"
                      disabled={deleting || downloading || !file.storage}
                      onClick={() => void remove(file)}
                      type="button"
                    >
                      <Trash2 size={15} />
                      {deleting ? "Excluindo..." : "Excluir"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="emptyState compactEmpty">
          {files.length
            ? "Nenhum arquivo corresponde às tags selecionadas."
            : "Nenhum arquivo registrado."}
        </div>
      )}
      {preview ? (
        <FilePreview
          blob={preview.blob}
          error={preview.error}
          file={preview.file}
          loading={preview.loading}
          onClose={() => setPreview(null)}
          onDownload={() => void download(preview.file)}
        />
      ) : null}
    </section>
  );
}

function tagColor(tag) {
  let hash = 0;
  for (const character of String(tag)) {
    hash = Math.trunc((hash << 5) - hash + character.charCodeAt(0));
  }
  const hue = Math.abs(hash) % 360;
  return {
    "--file-tag-background": `hsl(${hue} 75% 94%)`,
    "--file-tag-border": `hsl(${hue} 55% 72%)`,
    "--file-tag-color": `hsl(${hue} 55% 28%)`,
  };
}
