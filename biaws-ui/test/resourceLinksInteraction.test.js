import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, afterEach, before, test } from "node:test";
import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

let output, dom, module, harness, previous, previousNodeEnv;
const calls = [];
let respond;
const actor = { workspaceId: "workspace-b", permissions: ["applications.read", "components.read"] };

before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  output = await mkdtemp(join(tmpdir(), "biaws-resource-links-"));
  dom = new JSDOM("<div id=app></div>", { url: "https://biaws.example.test", pretendToBeVisual: true });
  previous = Object.fromEntries(
    ["window", "document", "navigator", "fetch", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const key of ["window", "document", "navigator"])
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async (url, options) => {
    calls.push({
      path: url.pathname,
      workspaceId: options.headers["X-Biaws-Workspace-Id"],
      credentials: options.credentials,
    });
    return respond(url.pathname);
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
        entry: join(process.cwd(), "test/fixtures/ResourceLinksHarness.jsx"),
        fileName: "resource-links",
        formats: ["cjs"],
      },
      outDir: output,
    },
  });
  module = (await import(pathToFileURL(join(output, "resource-links.cjs")))).default;
});
afterEach(async () => {
  if (harness) {
    await module.act(async () => harness.root.unmount());
    harness.disconnect();
    harness = null;
  }
  calls.length = 0;
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

function catalogResponse(path) {
  if (/\/components\/(?:alias|component-id)$/u.test(path))
    return Response.json({
      component: { id: "component-id", key: "alias", name: "Componente sintético", applicationId: "app-b" },
    });
  if (path === "/api/catalog/applications/app-b")
    return Response.json({ application: { id: "app-b", name: "Aplicação sintética" } });
  if (path === "/api/catalog/applications/other") return Response.json({ application: { id: "other" } });
  return Response.json({ items: [] });
}
async function mount(path, options = { actor }) {
  window.history.replaceState(null, "", path);
  await module.act(async () => {
    harness = module.mountResourceLinks(document.getElementById("app"), options);
  });
}
const selection = () => JSON.parse(document.querySelector("output").textContent);

test("React preview translates MCP links and leaves unsupported resources inert without fetching data", async () => {
  respond = () => {
    throw new Error("Rendering links must not fetch resources");
  };
  await mount("/documents/source?workspaceId=workspace-a", {
    markdown: [
      "[Documento](biaws://workspaces/workspace-b/documents/doc)",
      "biaws://workspaces/workspace-b/issues/INC42.",
      "<biaws://workspaces/workspace-b/demands/MEL42/tasks/T1>",
      "[Sem tela](biaws://workspaces/workspace-b/documents/doc/revisions/1)",
      "`biaws://workspaces/workspace-b/documents/code`",
    ].join("\n\n"),
  });
  assert.deepEqual(
    [...document.querySelectorAll("a")].map((link) => link.getAttribute("href")),
    [
      "/documents/doc?workspaceId=workspace-b",
      "/issues/INC42?workspaceId=workspace-b",
      "/requests/MEL42/tasks/T1?workspaceId=workspace-b",
    ],
  );
  for (const link of document.querySelectorAll("a")) {
    assert.equal(link.target, "_blank");
    assert.equal(link.rel, "noreferrer");
  }
  assert.ok(document.body.textContent.includes("Sem tela"));
  assert.equal(document.querySelector("code").textContent, "biaws://workspaces/workspace-b/documents/code");
  assert.deepEqual(calls, []);
});

test("short catalog links resolve through the workspace API and replace the address with the canonical entity route", async () => {
  respond = catalogResponse;
  await mount("/components/alias?workspaceId=workspace-b");
  assert.equal(window.location.pathname, "/catalog/app-b/components/component-id");
  assert.equal(window.location.search, "?workspaceId=workspace-b");
  assert.equal(selection().entity.id, "component-id");
  assert.equal(selection().selectedId, "app-b");
  assert.ok(calls.some(({ path }) => path === "/api/catalog/components/alias"));
  for (const call of calls) {
    assert.equal(call.workspaceId, "workspace-b");
    assert.equal(call.credentials, "include");
  }
});

test("denied and out-of-workspace resources retain the address and never resolve another application", async () => {
  for (const status of [403, 404]) {
    respond = (path) =>
      path.startsWith("/api/catalog/components/")
        ? Response.json({ error: { message: "Registro não encontrado ou sem acesso." } }, { status })
        : catalogResponse(path);
    await mount(`/components/blocked-${status}?workspaceId=workspace-b`);
    assert.equal(window.location.pathname, `/components/blocked-${status}`);
    assert.equal(selection().entity, undefined);
    assert.match(selection().error, /Permissão insuficiente|sem acesso/u);
    assert.equal(
      calls.some(({ path }) => path.startsWith("/api/catalog/applications/")),
      false,
    );
    await module.act(async () => harness.root.unmount());
    harness.disconnect();
    harness = null;
    calls.length = 0;
  }
});

test("catalog resources cannot be restored under an unrelated parent application", async () => {
  respond = catalogResponse;
  await mount("/catalog/other/components/alias?workspaceId=workspace-b");
  assert.equal(selection().entity, undefined);
  assert.match(selection().error, /sem acesso/u);
  assert.equal(window.location.pathname, "/catalog/other/components/alias");
});
