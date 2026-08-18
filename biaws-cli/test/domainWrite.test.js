import assert from "node:assert/strict";
import test from "node:test";
import {
  asWriteCliError,
  DomainWriteService,
  findTask,
  writeEnvelope,
} from "../src/domain/writeService.js";

test("DomainWriteService envia somente status aos endpoints específicos", async () => {
  const calls = [];
  const service = new DomainWriteService({
    async request(path, options) {
      calls.push({ path, options });
      return {};
    },
  });
  await service.updateTaskStatus("DEM-1", "TASK/1", "Concluído");
  await service.updateIssueStatus("INC-1", "Resolvido");
  assert.deepEqual(calls, [
    {
      path: "/requests/DEM-1/tasks/TASK%2F1",
      options: { method: "PUT", body: '{"status":"Concluído"}' },
    },
    {
      path: "/issues/INC-1",
      options: { method: "PATCH", body: '{"status":"Resolvido"}' },
    },
  ]);
});

test("findTask resolve código ou ID e rejeita referência ausente", () => {
  const payload = { request: { tasks: [{ id: "1", code: "TASK-1" }] } };
  assert.equal(findTask(payload, "TASK-1").task.id, "1");
  assert.throws(() => findTask(payload, "TASK-2"), { code: "TASK_NOT_FOUND" });
});

test("envelope de escrita explicita idempotência e escopo", () => {
  const value = writeEnvelope("issue", "status.transition", {
    workspaceId: "ws",
    applicationId: "app",
    changed: false,
    previousStatus: "Resolvido",
    status: "Resolvido",
    data: { id: "INC-1" },
  });
  assert.equal(value.schemaVersion, "biaws.write.v1");
  assert.equal(value.changed, false);
  assert.equal(value.scope.workspaceId, "ws");
});

test("conflito, validação, autorização e inexistência são distinguíveis", () => {
  const errors = [
    [409, "WRITE_CONFLICT", 2],
    [422, "INVALID_TRANSITION", 2],
    [403, "PERMISSION_DENIED", 3],
    [404, "RESOURCE_NOT_FOUND", 4],
  ];
  for (const [statusCode, code, exitCode] of errors) {
    const result = asWriteCliError(
      Object.assign(new Error("falha"), { statusCode }),
      "issue",
    );
    assert.equal(result.code, code);
    assert.equal(result.exitCode, exitCode);
  }
});
