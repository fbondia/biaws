import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuditEvent,
  buildAuditFilter,
  calculateAuditChanges,
  sanitizeAuditValue,
} from "../src/repositories/auditRepository.js";

test("audit differences contain field paths and previous/new values", () => {
  assert.deepEqual(
    calculateAuditChanges(
      { title: "Antes", status: "open", nested: { value: 1 } },
      { title: "Depois", status: "closed", nested: { value: 1 } },
    ),
    [
      { field: "status", before: "open", after: "closed" },
      { field: "title", before: "Antes", after: "Depois" },
    ],
  );
});

test("audit sanitization removes secrets and binary file contents", () => {
  assert.deepEqual(
    sanitizeAuditValue({
      name: "pacote",
      password: "secret",
      token: "token",
      clientSecret: "client-secret",
      privateKey: "private-key",
      connectionString: "mongodb://user:password@example.test/db",
      ciphertext: "encrypted-value",
      files: [{ path: "SKILL.md", contentBase64: "encoded" }],
    }),
    { name: "pacote", files: [{ path: "SKILL.md" }] },
  );
});

test("audit ignores operational timestamps when calculating changes", () => {
  assert.deepEqual(
    calculateAuditChanges(
      { title: "Mesmo", updatedAt: new Date("2026-01-01") },
      { title: "Mesmo", updatedAt: new Date("2026-01-02") },
    ),
    [],
  );
});

test("audit event preserves the responsible user and contextual root", () => {
  const occurredAt = new Date("2026-07-27T12:00:00.000Z");
  const event = buildAuditEvent({
    actor: {
      userId: "user-1",
      displayName: "Maria Gestora",
      email: "maria@example.test",
      authenticationMethod: "session",
    },
    action: "task_updated",
    target: { type: "task", id: "task-1", label: "Validar entrega" },
    root: { type: "demand", id: "demand-1" },
    before: { status: "Pendente" },
    after: { status: "Concluído" },
    occurredAt,
  });

  assert.deepEqual(event.actor, {
    userId: "user-1",
    displayName: "Maria Gestora",
    email: "maria@example.test",
    authenticationMethod: "session",
  });
  assert.equal(event.rootId, "demand-1");
  assert.deepEqual(event.changes, [
    { field: "status", before: "Pendente", after: "Concluído" },
  ]);
});

test("audit filter isolates a root while including its direct target history", () => {
  assert.deepEqual(buildAuditFilter("task", "task-1"), {
    $or: [
      { rootType: "task", rootId: "task-1" },
      { "target.type": "task", "target.id": "task-1" },
    ],
  });
  assert.equal(
    JSON.stringify(buildAuditFilter("task", "task-1")).includes("task-2"),
    false,
  );
});

test("creation differences are expanded into individual fields", () => {
  assert.deepEqual(
    calculateAuditChanges(null, { title: "Nova", status: "open" }),
    [
      { field: "status", before: null, after: "open" },
      { field: "title", before: null, after: "Nova" },
    ],
  );
});
