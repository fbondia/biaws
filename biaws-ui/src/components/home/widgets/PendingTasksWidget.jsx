import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchHomePendingTasks } from "../../../api.js";

export function PendingTasksWidget({ data, onOpenTask }) {
  const [items, setItems] = useState(data.items || []);
  const [page, setPage] = useState(data.page || 1);
  const [total, setTotal] = useState(data.value || 0);
  const [hasMore, setHasMore] = useState(
    data.hasMore ?? (data.items || []).length < (data.value || 0),
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");

  useEffect(() => {
    setItems(data.items || []);
    setPage(data.page || 1);
    setTotal(data.value || 0);
    setHasMore(data.hasMore ?? (data.items || []).length < (data.value || 0));
    setLoadingMore(false);
    setLoadMoreError("");
  }, [data]);

  async function loadMore() {
    setLoadingMore(true);
    setLoadMoreError("");
    try {
      const payload = await fetchHomePendingTasks({
        page: page + 1,
        limit: data.limit || 6,
      });
      setItems((current) => {
        const existingIds = new Set(current.map(({ id }) => id));
        return [
          ...current,
          ...(payload.items || []).filter(({ id }) => !existingIds.has(id)),
        ];
      });
      setPage(payload.page);
      setTotal(payload.value);
      setHasMore(payload.hasMore);
    } catch (error) {
      setLoadMoreError(error.message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="homeTasksWidget">
      <strong className="homeTasksTotal">{total} pendentes</strong>
      {!items.length ? (
        <div className="homeWidgetEmpty">Nenhuma tarefa pendente.</div>
      ) : (
        <>
          <div className="homeTaskList">
            {items.map((task) => (
              <article key={task.id}>
                <div className="homeTaskIdentity">
                  <strong>{task.title}</strong>
                  <small>{task.requestTitle}</small>
                </div>
                <div className="homeTaskActions">
                  <span className="homeTaskStatus">{task.status}</span>
                  <button
                    aria-label={`Abrir tarefa ${task.title}`}
                    className="secondaryButton homeTaskOpenButton"
                    disabled={!task.requestId || !onOpenTask}
                    onClick={() => onOpenTask?.(task)}
                    title="Abrir tarefa"
                    type="button"
                  >
                    <ExternalLink aria-hidden="true" size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {loadMoreError ? (
            <div className="homeTasksLoadMoreError" role="alert">
              {loadMoreError}
            </div>
          ) : null}
          {hasMore ? (
            <button
              className="secondaryButton homeTasksLoadMore"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              type="button"
            >
              <span>{loadingMore ? "Carregando…" : "Carregar mais"}</span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
