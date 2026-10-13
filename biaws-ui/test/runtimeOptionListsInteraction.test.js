import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, afterEach, before, test } from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

let dom;
let outputDirectory;
let harnessModule;
let harness;
let previous;
let previousNodeEnv;

before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  outputDirectory = await mkdtemp(join(tmpdir(), "biaws-runtime-options-ui-"));
  dom = new JSDOM("<!doctype html><div id=app></div>", { url: "https://biaws.example.test/issues" });
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
    define: { "process.env.NODE_ENV": JSON.stringify("development"), "import.meta.env.DEV": "false" },
    build: {
      emptyOutDir: false,
      rollupOptions: { external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"] },
      lib: {
        entry: join(process.cwd(), "test/fixtures/RuntimeOptionListsHarness.jsx"),
        fileName: "runtime-options-harness",
        formats: ["cjs"],
      },
      outDir: outputDirectory,
    },
  });
  harnessModule = (await import(pathToFileURL(join(outputDirectory, "runtime-options-harness.cjs")))).default;
});

afterEach(async () => {
  if (!harness) return;
  await harnessModule.act(async () => harness.root.unmount());
  harness.disconnect();
  harnessModule.clearSessionScopedState();
  await harness.service.dispose();
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

function catalog(type = "additional") {
  return Response.json({
    items: [
      {
        key: "issue.type",
        items: [
          { value: "incident", label: "Incidente" },
          { value: "request", label: "Requisição" },
          { value: type, label: type === "additional" ? "Additional" : "Outro workspace" },
        ],
      },
    ],
  });
}

async function mount(onCatalog = () => catalog()) {
  const requests = [];
  window.history.replaceState(null, "", "/issues");
  globalThis.fetch = async (url, request) => {
    if (url.pathname === "/api/option-lists/runtime") {
      requests.push(request.headers["X-Biaws-Workspace-Id"]);
      return onCatalog(requests.length);
    }
    if (url.pathname === "/api/issues") return Response.json({ items: [], meta: { total: 0, totalPages: 1 } });
    if (url.pathname === "/api/issues/summary") return Response.json({});
    assert.fail(`Unexpected request: ${url.pathname}`);
  };
  await harnessModule.act(async () => {
    harness = await harnessModule.mountApp(document.getElementById("app"));
  });
  return requests;
}

function button(text) {
  const result = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === text);
  assert.ok(result, `Button not found: ${text}`);
  return result;
}

async function click(element) {
  await harnessModule.act(async () => element.click());
}

async function openTypes() {
  if (!document.getElementById("issue-filters")) await click(button("Mostrar filtros"));
  await click(button("TiposTodos os tipos"));
}

function typeLabels() {
  return [...document.querySelectorAll(".issueOptionFilterDialog label span")].map((item) => item.textContent);
}

test("reauthentication in the same workspace reloads additional types without remounting App", async () => {
  const requests = await mount();
  const header = document.querySelector(".appShell > header");
  assert.ok(header);
  await openTypes();
  assert.deepEqual(typeLabels(), ["Incidente", "Requisição", "Additional"]);
  await click(button("Concluir"));
  await harnessModule.act(async () => harness.fake.expire());
  assert.ok(document.querySelector(".sessionExpiredDialog"));
  assert.equal(requests.length, 1);
  await harnessModule.act(async () => {
    for (const [autocomplete, value] of [
      ["username", "synthetic@example.test"],
      ["current-password", "synthetic-password"],
    ]) {
      const input = document.querySelector(`.sessionExpiredDialog input[autocomplete="${autocomplete}"]`);
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    }
  });
  await click(button("Entrar novamente"));
  assert.equal(document.querySelector(".sessionExpiredDialog"), null);
  assert.equal(document.querySelector(".appShell > header"), header);
  assert.deepEqual(requests, ["synthetic-workspace", "synthetic-workspace"]);
  await openTypes();
  assert.deepEqual(typeLabels(), ["Incidente", "Requisição", "Additional"]);
});

test("an initial catalog outage recovers automatically and updates the type filter", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const requests = await mount((attempt) =>
    attempt === 1 ? Response.json({ message: "Synthetic outage" }, { status: 503 }) : catalog(),
  );
  assert.match(document.querySelector('[role="alert"]').textContent, /opções do workspace/u);
  await openTypes();
  assert.deepEqual(typeLabels(), ["Incidente", "Requisição"]);
  await harnessModule.act(async () => t.mock.timers.tick(1000));
  assert.equal(requests.length, 2);
  assert.equal(document.querySelector('[role="alert"]'), null);
  await openTypes();
  assert.deepEqual(typeLabels(), ["Incidente", "Requisição", "Additional"]);
});

test("manual retry recovers the catalog and clears its error", async () => {
  const requests = await mount((attempt) =>
    attempt === 1 ? Response.json({ message: "Synthetic denial" }, { status: 403 }) : catalog(),
  );
  await click(button("Tentar carregar opções novamente"));
  assert.equal(requests.length, 2);
  assert.equal(document.querySelector('[role="alert"]'), null);
  await openTypes();
  assert.deepEqual(typeLabels(), ["Incidente", "Requisição", "Additional"]);
});

for (const event of ["online", "focus"]) {
  test(`a ${event} event recovers a failed catalog without extra requests after success`, async () => {
    const requests = await mount((attempt) =>
      attempt === 1 ? Promise.reject(new Error("Synthetic network failure")) : catalog(),
    );
    await harnessModule.act(async () => window.dispatchEvent(new window.Event(event)));
    assert.equal(requests.length, 2);
    assert.equal(document.querySelector('[role="alert"]'), null);
    await openTypes();
    assert.deepEqual(typeLabels(), ["Incidente", "Requisição", "Additional"]);
    await harnessModule.act(async () => window.dispatchEvent(new window.Event(event)));
    assert.equal(requests.length, 2);
  });
}

test("switching workspace discards the old catalog response", async () => {
  let resolveOld;
  const requests = await mount((attempt) =>
    attempt === 1
      ? new Promise((resolve) => {
          resolveOld = resolve;
        })
      : catalog("other"),
  );
  await harnessModule.act(async () => {
    harness.fake.setActor({ id: "synthetic-actor", workspaceId: "other-workspace", permissions: ["issues.read"] });
    await harness.service.switchWorkspace("other-workspace");
  });
  await harnessModule.act(async () => resolveOld(catalog()));
  assert.deepEqual(requests, ["synthetic-workspace", "other-workspace"]);
  await openTypes();
  assert.deepEqual(typeLabels(), ["Incidente", "Requisição", "Outro workspace"]);
});
