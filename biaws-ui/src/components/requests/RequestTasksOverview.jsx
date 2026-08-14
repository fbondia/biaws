import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
} from "lucide-react";
import { useMemo, useState } from "react";
import { compareRequestTasks } from "../../../../shared/requestTaskSorting.js";

import {
  formatDate,
  REQUEST_ALL_TASK_STATUS_OPTIONS,
  REQUEST_TASK_STATUS_COLORS,
  REQUEST_TASK_STATUS_OPTIONS,
} from "./requestUtils.js";
import { EntityIdentifier } from "../shared/EntityIdentifier/index.jsx";

const STATUS_ICON = {
  Pendente: Circle,
  Andamento: Clock3,
  Concluído: CheckCircle2,
};

function statusIcon(status) {
  if (status.startsWith("Aguardando ")) return Clock3;
  return STATUS_ICON[status] || Circle;
}

function statusStyle(status) {
  const colors = REQUEST_TASK_STATUS_COLORS[status];
  if (!colors) return undefined;

  return {
    color: colors.foreground,
    backgroundColor: colors.background,
    borderColor: colors.border,
  };
}

function taskDateLabel(task) {
  if (task.startDate && task.endDate) {
    return `${formatDate(task.startDate)} → ${formatDate(task.endDate)}`;
  }
  if (task.endDate) return `Até ${formatDate(task.endDate)}`;
  if (task.startDate) return `Início ${formatDate(task.startDate)}`;
  if (task.createdAt)
    return `Criada em ${formatDate(String(task.createdAt).slice(0, 10))}`;
  return "Sem data";
}

export function RequestTasksOverview({ requests, onSelectRequest }) {
  const [selectedStatuses, setSelectedStatuses] = useState(
    () => new Set(REQUEST_TASK_STATUS_OPTIONS),
  );
  const [collapsedRequestIds, setCollapsedRequestIds] = useState(
    () => new Set(),
  );
  const tasks = useMemo(() => {
    return requests
      .flatMap((request) =>
        (request.tasks || []).map((task) => ({ request, task })),
      )
      .filter(({ task }) => selectedStatuses.has(task.status))
      .sort((first, second) =>
        compareRequestTasks(
          first.task,
          second.task,
          REQUEST_ALL_TASK_STATUS_OPTIONS,
        ),
      );
  }, [requests, selectedStatuses]);
  const taskGroups = useMemo(() => {
    const groups = new Map();

    tasks.forEach(({ request, task }) => {
      const groupId = request.id;
      const current = groups.get(groupId);
      if (current) {
        current.tasks.push(task);
        return;
      }
      groups.set(groupId, { id: groupId, request, tasks: [task] });
    });

    return [...groups.values()];
  }, [tasks]);

  function toggleStatus(status) {
    setSelectedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function toggleRequest(requestId) {
    setCollapsedRequestIds((current) => {
      const next = new Set(current);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
  }

  return (
    <div className="requestScheduleBlock">
      <div className="requestTasksOverviewHeader">
        {/*
        <div className="sectionTitleRow requestTasksOverviewTitle">
          <h3>Tarefas das melhorias</h3>
          <span>{tasks.length} tarefas</span>
        </div>
        */}

        <div
          className="requestTasksStatusFilter"
          role="group"
          aria-label="Filtrar tarefas por status"
        >
          <div className="requestTasksStatusChips">
            {REQUEST_TASK_STATUS_OPTIONS.map((status) => {
              const selected = selectedStatuses.has(status);
              return (
                <button
                  aria-pressed={selected}
                  className={
                    selected
                      ? "requestTasksStatusChip selected"
                      : "requestTasksStatusChip"
                  }
                  key={status}
                  onClick={() => toggleStatus(status)}
                  style={selected ? statusStyle(status) : undefined}
                  type="button"
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {tasks.length ? (
        <div className="requestTasksOverviewGroups">
          {taskGroups.map(({ id, request, tasks: groupTasks }) => {
            const expanded = !collapsedRequestIds.has(id);
            return (
              <section className="requestTasksOverviewGroup" key={id}>
                <header className="requestTasksOverviewGroupHeader">
                  <div className="requestTasksOverviewGroupIdentity">
                    <EntityIdentifier
                      fallback="Sem código"
                      label="Código da melhoria"
                      value={request.clientCode}
                      variant="eyebrow"
                    />
                    <strong>{request.title || "Sem título"}</strong>
                  </div>
                  <button
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Recolher" : "Expandir"} tarefas de ${request.title || "melhoria sem título"}`}
                    className="requestTasksOverviewGroupToggle"
                    onClick={() => toggleRequest(id)}
                    title={expanded ? "Recolher melhoria" : "Expandir melhoria"}
                    type="button"
                  >
                    {expanded ? (
                      <ChevronDown aria-hidden="true" size={18} />
                    ) : (
                      <ChevronRight aria-hidden="true" size={18} />
                    )}
                  </button>
                </header>

                {expanded ? (
                  <div className="requestTasksOverviewList">
                    {groupTasks.map((task) => {
                      const StatusIcon = statusIcon(task.status);
                      return (
                        <article
                          className="requestTasksOverviewItem"
                          key={`${request.id}:${task.id}`}
                          onClick={() => onSelectRequest(request.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSelectRequest(request.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="requestTasksOverviewMain">
                            <div className="requestTasksOverviewIdentity">
                              {task.code ? (
                                <EntityIdentifier
                                  label="Código da tarefa"
                                  value={task.code}
                                  variant="eyebrow"
                                />
                              ) : null}
                              <strong>
                                {task.title || "Tarefa sem título"}
                              </strong>
                            </div>
                            <span
                              className="requestTaskStatus"
                              style={statusStyle(task.status)}
                            >
                              <StatusIcon size={14} />
                              {task.status}
                            </span>
                          </div>

                          <div className="requestTasksOverviewMeta">
                            <span>
                              <CalendarDays size={14} />
                              {taskDateLabel(task)}
                            </span>
                            {task.situation.trim() || task.description ? (
                              <p>{task.situation.trim() || task.description}</p>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="emptyState compactEmpty">
          {selectedStatuses.size === 0
            ? "Selecione ao menos um status para exibir as tarefas."
            : "Nenhuma tarefa encontrada para os status selecionados."}
        </div>
      )}
    </div>
  );
}
