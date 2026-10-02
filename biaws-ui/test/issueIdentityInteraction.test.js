import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, afterEach, before, test } from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

const initialIssue = {
  id: "SYNTHETIC-IDENTITY-001",
  identifier: "INC001",
  title: "Issue de teste",
  text: "Descrição preservada",
  status: "open",
  attachments: [],
};
let dom;
let outputDirectory;
let harnessModule;
let harness;
let previous;
let previousNodeEnv;

before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  outputDirectory = await mkdtemp(join(tmpdir(), "biaws-issue-identity-ui-"));
  dom = new JSDOM("<!doctype html><div id=app></div>", { url: "https://biaws.example.test" });
  previous = Object.fromEntries(
    ["document", "navigator", "window", "fetch", "IS_REACT_ACT_ENVIRONMENT"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  for (const name of ["document", "navigator", "window"]) {
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await symlink(join(process.cwd(), "node_modules"), join(outputDirectory, "node_modules"), "dir");
  await build({
    configFile: false,
    logLevel: "silent",
    plugins: [react()],
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    build: {
      emptyOutDir: false,
      rollupOptions: { external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"] },
      lib: {
        entry: join(process.cwd(), "test/fixtures/IssueDetailsHarness.jsx"),
        fileName: "issue-details-harness",
        formats: ["cjs"],
      },
      outDir: outputDirectory,
    },
  });
  harnessModule = (await import(pathToFileURL(join(outputDirectory, "issue-details-harness.cjs")))).default;
});

afterEach(async () => {
  if (!harness) return;
  await harnessModule.act(async () => harness.root.unmount());
  harness.resetSession();
  harness = null;
});

after(async () => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  for (const [name, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  dom.window.close();
  await rm(outputDirectory, { force: true, recursive: true });
});

async function mount({ onPatch, options } = {}) {
  const requests = [];
  const updates = [];
  let issue = initialIssue;
  globalThis.fetch = async (url, request = {}) => {
    if (url.pathname.endsWith("/taxonomy")) return Response.json({ taxonomy: { taxonomy: [], tagGroups: [] } });
    assert.equal(url.pathname, `/api/issues/${initialIssue.id}`);
    assert.equal(request.method, "PATCH");
    assert.equal(request.headers["X-Biaws-Workspace-Id"], "synthetic-workspace");
    const patch = JSON.parse(request.body);
    requests.push(patch);
    if (onPatch) return onPatch(patch);
    issue = { ...issue, ...patch };
    return Response.json({ issue });
  };
  await harnessModule.act(async () => {
    harness = harnessModule.mountIssueDetails(
      document.getElementById("app"),
      { issue, comments: [] },
      (updated) => updates.push(updated),
      options,
    );
  });
  return { requests, updates };
}

function editor() {
  return document.querySelector(".issueIdentityDialog");
}

function editButton() {
  return document.querySelector('[aria-label="Editar identificador e título"]');
}

function button(label, scope = editor()) {
  const found = [...scope.querySelectorAll("button")].find((item) => item.textContent.trim() === label);
  assert.ok(found, `Button not found: ${label}`);
  return found;
}

async function click(element) {
  assert.ok(element);
  await harnessModule.act(async () => element.click());
}

async function changeField(name, value) {
  const input = editor().querySelector(`input[name="${name}"]`);
  await harnessModule.act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}

test("the header editor saves identifier and title together and refreshes the displayed issue", async () => {
  const { requests, updates } = await mount();
  await click(editButton());
  assert.equal(editor().querySelector('input[name="identifier"]').value, initialIssue.identifier);
  assert.equal(editor().querySelector('input[name="title"]').value, initialIssue.title);
  assert.equal(document.activeElement, editor().querySelector('input[name="identifier"]'));
  assert.equal(button("Salvar alterações").disabled, true);
  await changeField("identifier", " INC002 ");
  await changeField("title", " Novo título ");
  await click(button("Salvar alterações"));
  assert.deepEqual(requests, [{ identifier: "INC002", title: "Novo título" }]);
  assert.equal(editor(), null);
  assert.equal(document.getElementById("issue-dialog-title").textContent, "Novo título");
  assert.match(document.querySelector(".dialogKicker").textContent, /INC002/u);
  assert.match(document.querySelector(".dialogKicker").textContent, /SYNTHETIC-IDENTITY-001/u);
  assert.equal(updates[0].text, initialIssue.text);
  assert.equal(updates[0].status, initialIssue.status);
  await click(editButton());
  assert.equal(editor().querySelector('input[name="identifier"]').value, "INC002");
  assert.equal(editor().querySelector('input[name="title"]').value, "Novo título");
  assert.equal(button("Salvar alterações").disabled, true);
});

test("the editor rejects an empty title or invalid identifier and permits removing the identifier", async () => {
  const { requests } = await mount();
  await click(editButton());
  await changeField("title", "   ");
  assert.equal(button("Salvar alterações").disabled, true);
  await changeField("title", "Título válido");
  for (const invalid of ["INC 2", "INC/2", "INC\\2"]) {
    await changeField("identifier", invalid);
    assert.equal(editor().querySelector('input[name="identifier"]').getAttribute("aria-invalid"), "true");
    assert.match(editor().querySelector('[role="alert"]').textContent, /sem espaços ou barras/u);
    assert.equal(button("Salvar alterações").disabled, true);
  }
  assert.deepEqual(requests, []);
  await changeField("identifier", "");
  await click(button("Salvar alterações"));
  assert.deepEqual(requests, [{ identifier: "", title: "Título válido" }]);
  assert.doesNotMatch(document.querySelector(".dialogKicker").textContent, /INC001/u);
});

test("canceling discards the draft without saving or closing the details dialog", async () => {
  const { requests } = await mount();
  await click(editButton());
  await changeField("title", "Rascunho descartado");
  await click(button("Cancelar"));
  assert.equal(editor(), null);
  assert.ok(document.querySelector(".issueDialog"));
  assert.deepEqual(requests, []);
  await click(editButton());
  assert.equal(editor().querySelector('input[name="title"]').value, initialIssue.title);
});

test("a failed save preserves the draft, reports the API error and permits retry", async () => {
  let fail = true;
  const { requests } = await mount({
    onPatch: (patch) => {
      if (fail) return Response.json({ message: "Identificador já utilizado." }, { status: 409 });
      return Response.json({ issue: { ...initialIssue, ...patch } });
    },
  });
  await click(editButton());
  await changeField("identifier", "INC002");
  await click(button("Salvar alterações"));
  assert.ok(editor());
  assert.match(editor().querySelector('[role="alert"]').textContent, /Identificador já utilizado/u);
  assert.equal(editor().querySelector('input[name="identifier"]').value, "INC002");
  assert.equal(button("Salvar alterações").disabled, false);
  assert.match(document.querySelector(".dialogKicker").textContent, /INC001/u);
  fail = false;
  await click(button("Salvar alterações"));
  assert.equal(editor(), null);
  assert.equal(requests.length, 2);
});

test("the editor blocks duplicate saves and cancellation while saving", async () => {
  let resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });
  const { requests } = await mount({ onPatch: () => pending });
  await click(editButton());
  await changeField("title", "Título pendente");
  await click(button("Salvar alterações"));
  assert.equal(button("Salvando...").disabled, true);
  assert.equal(button("Cancelar").disabled, true);
  assert.equal(editor().querySelector('[aria-label="Fechar edição"]').disabled, true);
  assert.ok([...editor().querySelectorAll("input")].every((input) => input.disabled));
  await harnessModule.act(async () => {
    document
      .querySelector(".issueIdentityDialogBackdrop")
      .dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
  });
  assert.ok(editor());
  assert.equal(requests.length, 1);
  await harnessModule.act(async () => resolve(Response.json({ issue: { ...initialIssue, title: "Título pendente" } })));
  assert.equal(editor(), null);
});

test("the edit action is hidden without update permission and disabled while details load", async () => {
  await mount({ options: { canEditContext: false } });
  assert.equal(editButton(), null);
  assert.equal(editor(), null);
  await harnessModule.act(async () => harness.root.unmount());
  harness.resetSession();
  harness = null;
  await mount({ options: { loading: true } });
  assert.equal(editButton().disabled, true);
  await click(editButton());
  assert.equal(editor(), null);
});
