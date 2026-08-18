import { CalendarDays, CheckCircle2, Circle, Clock3, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { compareRequestTasks } from "../../../../../shared/requestTaskSorting.js";

import { useMessages } from "../../../infrastructure/messages/MessagesProvider.jsx";
import {
  formatDate,
  REQUEST_TASK_STATUS_COLORS,
  REQUEST_TASK_STATUS_OPTIONS,
} from "../requestUtils.js";
import {
  REQUEST_ALL_TASK_STATUS_OPTIONS,
  REQUEST_DEFAULTS,
} from "../../../data/requestConstants.js";
import { RequestTaskDialog } from "./RequestTaskDialog.jsx";
import { EntityIdentifier } from "../../shared/EntityIdentifier/index.jsx";

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

export function RequestTasksTab({
  request,
  saving,
  initialTaskId,
  onCreateTask,
  onChangeStatus,
  onCreateTaskNote,
  onDeleteTask,
  onDeleteTaskNote,
  onInitialTaskHandled,
  onUpdateTask,
  onUpdateTaskNote,
  onRequestUpdated,
}) {
  const { confirm } = useMessages();
  const [dialogTask, setDialogTask] = useState(null);
  const tasks = useMemo(
    () =>
      [...request.tasks].sort((first, second) =>
        compareRequestTasks(first, second, REQUEST_ALL_TASK_STATUS_OPTIONS),
      ),
    [request.tasks],
  );

  useEffect(() => {
    setDialogTask(null);
  }, [request.id]);

  useEffect(() => {
    if (!initialTaskId) return;
    setDialogTask(
      request.tasks.find((task) => task.id === initialTaskId) || null,
    );
    onInitialTaskHandled?.();
  }, [initialTaskId, request.id]);

  function beginCreate() {
    setDialogTask({
      id: "",
      code: "",
      title: "",
      status: REQUEST_DEFAULTS.taskStatus,
      startDate: "",
      endDate: "",
      situation: "",
      description: "",
      specification: "",
    });
  }

  async function saveTask(task) {
    const saved = task.id
      ? await onUpdateTask(task.id, task)
      : await onCreateTask(task);
    if (saved !== false) setDialogTask(null);
  }

  async function deleteTask(task) {
    const confirmed = await confirm({
      message: "Excluir esta tarefa?",
      tone: "danger",
    });
    if (!confirmed) return;

    const deleted = await onDeleteTask(task.id);
    if (deleted !== false) setDialogTask(null);
  }

  return (
    <section className="requestPanel">
      <div className="panelHeader">
        <div>
          <h3>Tarefas</h3>
          <span>Atividades vinculadas à execução da melhoria</span>
        </div>
        <button
          className="primaryButton"
          disabled={saving}
          onClick={beginCreate}
          type="button"
        >
          <Plus size={16} />
          Nova tarefa
        </button>
      </div>

      <div className="requestTaskList">
        {tasks.length ? (
          tasks.map((task) => {
            const StatusIcon = statusIcon(task.status);
            return (
              <article
                className="requestTaskCard"
                key={task.id}
                onClick={() => setDialogTask(task)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setDialogTask(task);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="requestTaskCardHeader">
                  <div className="requestTaskCardTitle">
                    {task.code ? (
                      <EntityIdentifier
                        label="Código da tarefa"
                        value={task.code}
                      />
                    ) : null}
                    <strong>{task.title}</strong>
                  </div>
                  {onChangeStatus ? (
                    <select
                      aria-label={`Status da tarefa ${task.title || "sem título"}`}
                      className="requestTaskStatus requestTaskStatusSelect"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        onChangeStatus(task, event.target.value)
                      }
                      style={statusStyle(task.status)}
                      value={task.status}
                    >
                      {[
                        ...new Set([
                          ...REQUEST_TASK_STATUS_OPTIONS,
                          task.status,
                        ]),
                      ].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="requestTaskStatus"
                      style={statusStyle(task.status)}
                    >
                      <StatusIcon size={14} />
                      {task.status}
                    </span>
                  )}
                </div>
                {task.startDate || task.endDate ? (
                  <div className="requestTaskDates">
                    <CalendarDays size={14} />
                    {task.startDate ? (
                      <span>{formatDate(task.startDate)}</span>
                    ) : null}
                    {task.startDate && task.endDate ? (
                      <span aria-hidden="true">→</span>
                    ) : null}
                    {task.endDate ? (
                      <span>{formatDate(task.endDate)}</span>
                    ) : null}
                  </div>
                ) : null}
                <p>
                  {task.situation.trim() ||
                    task.description ||
                    "Situação não informada."}
                </p>
              </article>
            );
          })
        ) : (
          <div className="emptyState">
            Nenhuma tarefa cadastrada para esta melhoria.
          </div>
        )}
      </div>

      <RequestTaskDialog
        onClose={() => setDialogTask(null)}
        onDelete={deleteTask}
        onCreateNote={onCreateTaskNote}
        onDeleteNote={onDeleteTaskNote}
        onSave={saveTask}
        onUpdateNote={onUpdateTaskNote}
        onRequestUpdated={onRequestUpdated}
        request={request}
        saving={saving}
        task={
          dialogTask?.id
            ? request.tasks.find((task) => task.id === dialogTask.id) ||
              dialogTask
            : dialogTask
        }
      />
    </section>
  );
}
