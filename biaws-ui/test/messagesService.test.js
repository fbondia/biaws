import assert from "node:assert/strict";
import test from "node:test";

import { dialogKeyboardAction } from "../src/components/shared/AccessibilityProvider/model.js";
import { createMessagesTestService } from "../src/infrastructure/messages/testing.js";
import { selectActiveLoading } from "../src/infrastructure/messages/service.js";

test("loading handles preserve concurrent operations and are idempotent", () => {
  const { service } = createMessagesTestService();
  const first = service.startLoading("Primeira", { priority: 1 });
  const second = service.startLoading("Segunda", { priority: 2 });

  assert.equal(service.getSnapshot().loadings.length, 2);
  assert.equal(
    selectActiveLoading(service.getSnapshot().loadings, true).label,
    "Segunda",
  );
  first.finish();
  first.finish();
  assert.deepEqual(
    service.getSnapshot().loadings.map(({ label }) => label),
    ["Segunda"],
  );
  second.finish();
  assert.equal(service.getSnapshot().loadings.length, 0);
});

test("blocking and background loading remain independent", () => {
  const { service } = createMessagesTestService();
  service.startLoading("Bloqueante");
  service.startLoading("Segundo plano", { blocking: false });

  assert.equal(
    selectActiveLoading(service.getSnapshot().loadings, true).label,
    "Bloqueante",
  );
  assert.equal(
    selectActiveLoading(service.getSnapshot().loadings, false).label,
    "Segundo plano",
  );
});

test("run preserves return values, errors and concurrent loading", async () => {
  const { service } = createMessagesTestService();
  let release;
  const pending = service.run(
    () => new Promise((resolve) => (release = resolve)),
    "Pendente",
  );
  const failure = new Error("falha técnica");

  await assert.rejects(
    service.run(() => Promise.reject(failure), "Falha"),
    (error) => error === failure,
  );
  assert.equal(service.getSnapshot().loadings.length, 1);
  release("resultado");
  assert.equal(await pending, "resultado");
  assert.equal(service.getSnapshot().loadings.length, 0);
});

test("confirm and prompt resolve in order and cancellation is typed", async () => {
  const { service } = createMessagesTestService();
  const confirmation = service.confirm("Confirmar ação?");
  const prompt = service.prompt({ message: "Informe o valor" });

  assert.equal(service.getSnapshot().dialog.type, "confirm");
  service.resolveDialog(true);
  assert.equal(await confirmation, true);
  assert.equal(service.getSnapshot().dialog.type, "prompt");
  service.cancelDialog();
  assert.equal(await prompt, null);
  assert.equal(service.getSnapshot().dialog, null);
});

test("dispose cancels active and queued dialogs without retaining state", async () => {
  const { service } = createMessagesTestService();
  const prompt = service.prompt("Segredo");
  const confirmation = service.confirm("Próximo");
  service.startLoading("Operação");
  service.error("Mensagem", { duration: 0 });

  service.dispose();

  assert.equal(await prompt, null);
  assert.equal(await confirmation, false);
  assert.deepEqual(service.getSnapshot(), {
    dialog: null,
    loadings: [],
    notices: [],
  });
});

test("notices support explicit dismissal and automatic expiry", () => {
  const { flushTimers, service } = createMessagesTestService();
  const persistent = service.success("Persistente", { duration: 0 });
  service.warning("Temporária");
  assert.equal(service.getSnapshot().notices.length, 2);

  persistent.dismiss();
  assert.deepEqual(
    service.getSnapshot().notices.map(({ message }) => message),
    ["Temporária"],
  );
  flushTimers();
  assert.equal(service.getSnapshot().notices.length, 0);
});

test("message dialogs expose the shared keyboard cancellation and focus trap contract", () => {
  assert.equal(dialogKeyboardAction("Escape"), "cancel");
  assert.equal(dialogKeyboardAction("Tab"), "contain-focus");
  assert.equal(dialogKeyboardAction("Enter"), null);
});
