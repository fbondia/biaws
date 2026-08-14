import assert from "node:assert/strict";
import test from "node:test";

import { compareRequestTasks } from "../../shared/requestTaskSorting.js";

const statusOptions = ["Pendente", "Andamento", "Concluído"];

test("request tasks sort by configured status, natural identifier and newest creation", () => {
  const tasks = [
    {
      id: "4",
      code: "TASK-2",
      status: "Pendente",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "3",
      code: "TASK-10",
      status: "Pendente",
      createdAt: "2026-01-03T00:00:00.000Z",
    },
    {
      id: "2",
      code: "TASK-2",
      status: "Pendente",
      createdAt: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "1",
      code: "TASK-1",
      status: "Andamento",
      createdAt: "2026-01-04T00:00:00.000Z",
    },
  ];

  tasks.sort((first, second) =>
    compareRequestTasks(first, second, statusOptions),
  );

  assert.deepEqual(
    tasks.map(({ id }) => id),
    ["2", "4", "3", "1"],
  );
});
