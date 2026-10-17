import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, afterEach, before, test } from "node:test";
import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

let dom, output, module, previous, previousNodeEnv, harness;
const calls = [];
let respond;
const waiters = [];
const actor = (workspaceId = "workspace-a", permissions = ["documents.read"]) => ({
  id: "synthetic",
  workspaceId,
  permissions,
});
const documentItem = { id: "document-id", identifier: "guide", title: "Guia [API]", workspaceId: "workspace-a" };
function nextRequest(predicate) {
  return new Promise((resolve) => waiters.push({ predicate, resolve }));
}

before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  output = await mkdtemp(join(tmpdir(), "biaws-document-links-"));
  dom = new JSDOM("<div id=app></div>", { url: "https://biaws.example.test/documents/source?workspaceId=workspace-a" });
  previous = Object.fromEntries(
    ["document", "navigator", "window", "fetch", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const key of ["document", "navigator", "window"])
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async (url, request) => {
    assert.equal(url.pathname, "/api/knowledge/documents");
    const call = {
      search: url.searchParams.get("search") || "",
      page: Number(url.searchParams.get("page")),
      limit: Number(url.searchParams.get("limit")),
      workspaceId: request.headers["X-Biaws-Workspace-Id"],
    };
    calls.push(call);
    for (const waiter of [...waiters])
      if (waiter.predicate(call)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(call);
      }
    return respond(call);
  };
  await symlink(join(process.cwd(), "node_modules"), join(output, "node_modules"), "dir");
  await build({
    configFile: false,
    logLevel: "silent",
    plugins: [react()],
    define: { "process.env.NODE_ENV": '"development"' },
    build: {
      emptyOutDir: false,
      rollupOptions: { external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"] },
      lib: {
        entry: join(process.cwd(), "test/fixtures/MarkdownDocumentLinksHarness.jsx"),
        fileName: "document-links",
        formats: ["cjs"],
      },
      outDir: output,
    },
  });
  module = (await import(pathToFileURL(join(output, "document-links.cjs")))).default;
});
afterEach(async () => {
  if (harness) {
    await module.act(async () => harness.root.unmount());
    harness.disconnect();
    harness = null;
  }
  calls.length = 0;
  waiters.length = 0;
});
after(async () => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  dom.window.close();
  await rm(output, { recursive: true, force: true });
});
async function mount(currentActor = actor(), props = {}, value = "Antes substituir depois") {
  respond = () => Response.json({ items: [documentItem], meta: { totalPages: 1 } });
  await module.act(async () => {
    harness = module.mountDocumentLinkEditor(document.getElementById("app"), value, currentActor, props);
  });
}
async function click(element) {
  assert.ok(element);
  await module.act(async () => element.click());
}
const button = (label, scope = document) =>
  [...scope.querySelectorAll("button")].find(
    (button) => button.getAttribute("aria-label") === label || button.textContent.trim() === label,
  );
async function openPicker(scope = document) {
  const received = nextRequest(() => true);
  await click(button("Inserir link de documento", scope));
  await module.act(async () => received);
}
async function search(term) {
  const received = nextRequest((call) => call.search === term);
  const input = document.querySelector('input[type="search"]');
  await module.act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, term);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await module.act(async () => received);
}

test("document picker inserts at the selection with workspace and restores the caret", async () => {
  await mount();
  assert.equal(calls.length, 0);
  const textarea = document.querySelector("textarea");
  textarea.focus();
  textarea.setSelectionRange(6, 16);
  await openPicker();
  assert.equal(document.activeElement.type, "search");
  assert.equal(button("Inserir link").disabled, true);
  await click(document.querySelector('input[type="radio"]'));
  await click(button("Inserir link"));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(textarea.value, "Antes [Guia \\[API\\]](/documents/document-id?workspaceId=workspace-a) depois");
  assert.equal(document.activeElement, textarea);
  assert.equal(textarea.selectionStart, textarea.value.indexOf(" depois"));
  assert.deepEqual(calls, [{ search: "", page: 1, limit: 20, workspaceId: "workspace-a" }]);
});

test("search and pagination use the authorized API and clear old selections", async () => {
  await mount();
  respond = ({ page, search }) =>
    Response.json({
      items: page === 1 ? [documentItem] : [{ ...documentItem, id: "second", title: `${search} segunda página` }],
      meta: { totalPages: 2 },
    });
  await openPicker();
  await click(document.querySelector('input[type="radio"]'));
  await search("busca");
  assert.equal(button("Inserir link").disabled, true);
  const next = nextRequest((call) => call.page === 2);
  await click(button("Próxima"));
  await module.act(async () => next);
  assert.ok(document.body.textContent.includes("busca segunda página"));
  assert.deepEqual(
    calls.map(({ search, page }) => [search, page]),
    [
      ["", 1],
      ["busca", 1],
      ["busca", 2],
    ],
  );
});

test("document search reports denials, allows retry and supports empty results", async () => {
  await mount();
  respond = () => Response.json({ error: { message: "Sem acesso" } }, { status: 403 });
  await openPicker();
  assert.ok(document.querySelector('[role="alert"]'));
  assert.equal(button("Inserir link").disabled, true);
  respond = () => Response.json({ items: [], meta: { totalPages: 1 } });
  const retry = nextRequest(() => true);
  await click(button("Tentar novamente"));
  await module.act(async () => retry);
  assert.ok(document.body.textContent.includes("Nenhum documento encontrado"));
});

test("editors without document permission do not offer or fetch document links", async () => {
  await mount(actor("workspace-a", []));
  assert.equal(button("Inserir link de documento"), undefined);
  assert.deepEqual(calls, []);
});

test("Escape closes only the document picker in fullscreen and Tab stays within the picker", async () => {
  await mount();
  await click(button("Editar em tela cheia"));
  const fullscreen = document.querySelector(".markdownFullscreenDialog");
  await openPicker(fullscreen);
  const dialog = document.querySelector(".markdownDocumentLinkDialog");
  const first = button("Fechar seleção de documento", dialog);
  // Disabled confirmation is excluded from the tab order; Cancelar is the last control.
  const cancel = button("Cancelar", dialog);
  cancel.focus();
  await module.act(async () =>
    cancel.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true })),
  );
  assert.equal(document.activeElement, first);
  await module.act(async () =>
    first.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  assert.equal(document.querySelector(".markdownDocumentLinkDialog"), null);
  assert.ok(document.querySelector(".markdownFullscreenDialog"));
});

test("switching workspace resets selection and discards old document responses", async () => {
  await mount();
  let resolveOld;
  const old = new Promise((resolve) => {
    resolveOld = resolve;
  });
  respond = ({ workspaceId }) =>
    workspaceId === "workspace-a"
      ? old
      : Response.json({
          items: [{ id: "document-b", title: "Guia B", workspaceId: "workspace-b" }],
          meta: { totalPages: 1 },
        });
  await openPicker();
  const received = nextRequest((call) => call.workspaceId === "workspace-b");
  await module.act(async () => harness.setActor(actor("workspace-b")));
  await module.act(async () => received);
  await module.act(async () => resolveOld(Response.json({ items: [documentItem], meta: { totalPages: 1 } })));
  assert.equal(document.querySelector('input[type="radio"]').value, "document-b");
  await click(document.querySelector('input[type="radio"]'));
  await click(button("Inserir link"));
  assert.match(document.querySelector("textarea").value, /documents\/document-b\?workspaceId=workspace-b/u);
});
