import { ChevronDown, ChevronUp, MessageSquare, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { createIssueComment, deleteIssueComment, saveIssueComment } from "../../../../api.js";
import { useMessages } from "../../../../infrastructure/messages/MessagesProvider.jsx";
import { formatDate } from "../../../../utils/issues.js";
import { MarkdownPreview } from "../../../shared/MarkdownEditor/index.jsx";
import { IssueCommentDialog } from "../../IssueCommentDialog.jsx";

function normalizedSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function commentPreview(value) {
  const text = String(value || "")
    .replace(/^\s*>\s?/gmu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return text || "Comentário sem conteúdo.";
}

function IssueCommentMeta({ comment }) {
  if (!comment.to && !comment.cc && !comment.rawDate) return null;
  return (
    <div className="commentMeta">
      {comment.to ? <span>Para: {comment.to}</span> : null}
      {comment.cc ? <span>Cc: {comment.cc}</span> : null}
      {comment.rawDate ? <span>Data original: {comment.rawDate}</span> : null}
    </div>
  );
}

function IssueCommentItem({
  attachments,
  canDeleteComment,
  canUpdateComment,
  comment,
  commentId,
  deleting,
  expanded,
  onDelete,
  onEdit,
  onLoadAttachment,
  onToggle,
}) {
  return (
    <article className={expanded ? "commentItem" : "commentItem collapsedCommentItem"}>
      <header>
        <div>
          <strong>{comment.from || "Origem não identificada"}</strong>
          <span>{formatDate(comment.date || comment.createdAt)}</span>
        </div>
        <div className="issueCommentItemActions">
          {canUpdateComment && comment._id ? (
            <button
              className="secondaryButton issueCommentEditButton"
              onClick={() => onEdit(comment)}
              title="Editar comentário"
              type="button"
            >
              <Pencil size={15} /> Editar
            </button>
          ) : null}
          {canDeleteComment && comment._id ? (
            <button
              className="dangerButton issueCommentDeleteButton"
              disabled={deleting}
              onClick={() => onDelete(comment)}
              title="Excluir comentário"
              type="button"
            >
              <Trash2 size={15} /> Excluir
            </button>
          ) : null}
          <button
            aria-expanded={expanded}
            className="secondaryButton issueCommentToggleButton"
            onClick={() => onToggle(commentId)}
            title={expanded ? "Contrair comentário" : "Expandir comentário"}
            type="button"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </header>
      {expanded ? (
        <>
          <IssueCommentMeta comment={comment} />
          <MarkdownPreview attachments={attachments} onLoadAttachment={onLoadAttachment} value={comment.text || ""} />
        </>
      ) : (
        <p className="commentCollapsedPreview">{commentPreview(comment.text)}</p>
      )}
    </article>
  );
}

export function IssueCommentsTab({
  attachments,
  canCreateComment,
  canDeleteComment,
  canUpdateComment,
  comments,
  issue,
  loading,
  onIssueDetailsUpdated,
  onLoadAttachment,
}) {
  const { confirm } = useMessages();
  const [dialogMode, setDialogMode] = useState("");
  const [selectedCommentId, setSelectedCommentId] = useState("");
  const [draft, setDraft] = useState({ date: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState("");
  const [commentError, setCommentError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCommentIds, setExpandedCommentIds] = useState(new Set());
  const mostRecentCommentId = String(comments[0]?._id || comments[0]?.hash || "");
  const filteredComments = useMemo(() => {
    const query = normalizedSearchText(searchTerm);
    if (!query) return comments;
    return comments.filter((comment) =>
      normalizedSearchText([comment.text, comment.from, comment.to, comment.cc, comment.rawDate].join(" ")).includes(
        query,
      ),
    );
  }, [comments, searchTerm]);

  useEffect(() => {
    setExpandedCommentIds(mostRecentCommentId ? new Set([mostRecentCommentId]) : new Set());
  }, [issue.id, mostRecentCommentId]);

  function dateInputValue(value) {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
  }

  function openCreate() {
    setSelectedCommentId("");
    setDraft({ date: dateInputValue(), text: "" });
    setCommentError("");
    setDialogMode("create");
  }

  function openEdit(comment) {
    setSelectedCommentId(String(comment._id || ""));
    setDraft({
      date: dateInputValue(comment.date || comment.createdAt),
      text: comment.text || "",
    });
    setCommentError("");
    setDialogMode("edit");
  }

  async function saveComment() {
    setSaving(true);
    setCommentError("");
    try {
      const payload =
        dialogMode === "edit"
          ? await saveIssueComment(issue.id, selectedCommentId, draft)
          : await createIssueComment(issue.id, draft);
      await onIssueDetailsUpdated?.(payload);
      setDialogMode("");
    } catch (saveError) {
      setCommentError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeComment(comment) {
    const commentId = String(comment._id || "");
    if (!commentId) return;
    const confirmed = await confirm({
      message: "Excluir este comentário? Esta ação não pode ser desfeita.",
      tone: "danger",
    });
    if (!confirmed) return;

    setDeletingCommentId(commentId);
    setCommentError("");
    try {
      const payload = await deleteIssueComment(issue.id, commentId);
      await onIssueDetailsUpdated?.(payload);
    } catch (deleteError) {
      setCommentError(deleteError.message);
    } finally {
      setDeletingCommentId("");
    }
  }

  function toggleComment(commentId) {
    setExpandedCommentIds((current) => {
      const next = new Set(current);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }

  return (
    <section className="detailSection">
      <div className="sectionTitleRow issueCommentSectionTitleRow">
        <h3>Comentários</h3>
        <div className="issueCommentTitleActions">
          <span>
            <MessageSquare size={14} />
            {searchTerm ? `${filteredComments.length} de ${comments.length}` : comments.length}
          </span>
          <label className="issueCommentSearch">
            <Search aria-hidden="true" size={15} />
            <span className="srOnly">Pesquisar comentários</span>
            <input
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar comentários"
              type="search"
              value={searchTerm}
            />
          </label>
          {canCreateComment ? (
            <button className="primaryButton" onClick={openCreate} type="button">
              <Plus size={16} /> Incluir comentário
            </button>
          ) : null}
        </div>
      </div>
      {commentError ? <div className="errorBox dialogError">{commentError}</div> : null}
      {filteredComments.length ? (
        <div className="commentList">
          {filteredComments.map((comment, index) => {
            const commentId = String(comment._id || comment.hash || `comment-${index}`);
            return (
              <IssueCommentItem
                attachments={attachments}
                canDeleteComment={canDeleteComment}
                canUpdateComment={canUpdateComment}
                comment={comment}
                commentId={commentId}
                deleting={deletingCommentId === commentId}
                expanded={expandedCommentIds.has(commentId)}
                key={commentId}
                onDelete={removeComment}
                onEdit={openEdit}
                onLoadAttachment={onLoadAttachment}
                onToggle={toggleComment}
              />
            );
          })}
        </div>
      ) : (
        <div className="emptyState compactEmpty">
          {loading
            ? "Carregando comentários..."
            : searchTerm
              ? "Nenhum comentário encontrado."
              : "Nenhum comentário registrado."}
        </div>
      )}
      <IssueCommentDialog
        attachments={attachments}
        draft={draft}
        mode={dialogMode}
        onChange={setDraft}
        onClose={() => setDialogMode("")}
        onLoadAttachment={onLoadAttachment}
        onSave={saveComment}
        saving={saving}
      />
    </section>
  );
}
