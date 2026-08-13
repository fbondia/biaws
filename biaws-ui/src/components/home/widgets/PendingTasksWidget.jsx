import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchHomePendingTasks } from "../../../api.js";
import { EntityIdentifier } from "../../shared/EntityIdentifier/index.jsx";

function groupTasksByRequest(items) {
  const groups = new Map();

  items.forEach((task) => {
    const groupId = task.requestId || `unlinked:${task.id}`;
    const current = groups.get(groupId);
    if (current) {
      current.tasks.push(task);
      return;
    }
    groups.set(groupId, {
      id: groupId,
      code: task.requestCode || "",
      title: task.requestTitle || "Melhoria",
      tasks: [task],
    });
  });

  return [...groups.values()];
}

export function PendingTasksWidget({ data, onOpenTask }) {
  const [items, setItems] = useState(data.items || []);
  const [page, setPage] = useState(data.page || 1);
  const [total, setTotal] = useState(data.value || 0);
  const [hasMore, setHasMore] = useState(
    data.hasMore ?? (data.items || []).length < (data.value || 0),
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(() => new Set());
  const groups = useMemo(() => groupTasksByRequest(items), [items]);

  useEffect(() => {
    setItems(data.items || []);
    setPage(data.page || 1);
    setTotal(data.value || 0);
    setHasMore(data.hasMore ?? (data.items || []).length < (data.value || 0));
    setLoadingMore(false);
    setLoadMoreError("");
    setCollapsedGroupIds(new Set());
  }, [data]);

  function toggleGroup(groupId) {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

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
          <div className="homeTaskGroups">
            {groups.map((group) => {
              const expanded = !collapsedGroupIds.has(group.id);
              return (
                <section className="homeTaskGroup" key={group.id}>
                  <header className="homeTaskGroupHeader">
                    <div className="homeTaskGroupIdentity">
                      <EntityIdentifier
                        fallback="Sem código"
                        label="Código da melhoria"
                        value={group.code}
                        variant="eyebrow"
                      />
                      <strong>{group.title}</strong>
                    </div>
                    <button
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "Recolher" : "Expandir"} tarefas de ${group.title}`}
                      className="homeTaskGroupToggle"
                      onClick={() => toggleGroup(group.id)}
                      title={
                        expanded ? "Recolher melhoria" : "Expandir melhoria"
                      }
                      type="button"
                    >
                      {expanded ? (
                        <ChevronDown aria-hidden="true" size={17} />
                      ) : (
                        <ChevronRight aria-hidden="true" size={17} />
                      )}
                    </button>
                  </header>
                  {expanded ? (
                    <div className="homeTaskList">
                      {group.tasks.map((task) => (
                        <article key={task.id}>
                          <div className="homeTaskIdentity">
                            {task.code ? (
                              <EntityIdentifier
                                label="Código da tarefa"
                                value={task.code}
                                variant="eyebrow"
                              />
                            ) : null}
                            <strong>{task.title}</strong>
                          </div>
                          <div className="homeTaskActions">
                            <span className="homeTaskStatus">
                              {task.status}
                            </span>
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
                  ) : null}
                </section>
              );
            })}
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
