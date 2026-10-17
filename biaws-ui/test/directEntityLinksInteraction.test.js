import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, afterEach, before, test } from "node:test";
import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

let dom, outputDirectory, module, harness, previous, previousNodeEnv;
const calls = [];
const workspaces = [
  { id: "workspace-a", name: "Workspace A" },
  { id: "workspace-b", name: "Workspace B" },
];
const actor = (workspaceId = "workspace-a", permissions = ["issues.read", "demands.read", "documents.read"]) => ({
  id: "synthetic",
  workspaceId,
  workspaces,
  permissions,
});

before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  outputDirectory = await mkdtemp(join(tmpdir(), "biaws-direct-links-ui-"));
  dom = new JSDOM("<div id=app></div>", { url: "https://biaws.example.test/" });
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  previous = Object.fromEntries(
    ["document", "navigator", "window", "fetch", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const key of ["document", "navigator", "window"])
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await symlink(join(process.cwd(), "node_modules"), join(outputDirectory, "node_modules"), "dir");
  await build({
    configFile: false,
    logLevel: "silent",
    plugins: [react()],
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env.DEV": "false" },
    build: {
      emptyOutDir: false,
      rollupOptions: { external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"] },
      lib: {
        entry: join(process.cwd(), "test/fixtures/RuntimeOptionListsHarness.jsx"),
        fileName: "route-harness",
        formats: ["cjs"],
      },
      outDir: outputDirectory,
    },
  });
  module = (await import(pathToFileURL(join(outputDirectory, "route-harness.cjs")))).default;
});
afterEach(async () => {
  if (harness) {
    await module.act(async () => harness.root.unmount());
    harness.disconnect();
    await harness.service.dispose();
    harness = null;
  }
  module.clearSessionScopedState();
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
  await rm(outputDirectory, { recursive: true, force: true });
});

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    await module.act(async () => new Promise((resolve) => setImmediate(resolve)));
    if (predicate()) return;
  }
  assert.fail(`Expected UI state not reached: ${document.body.textContent}`);
}
async function mount(path, options = {}) {
  window.history.replaceState(null, "", path);
  globalThis.fetch = async (url, request) => {
    const path = new URL(url).pathname;
    calls.push({ path, method: request.method || "GET", workspaceId: request.headers["X-Biaws-Workspace-Id"] });
    const customResponse = options.respond?.(path);
    if (customResponse) return customResponse;
    if (path === "/api/requests/MEL42")
      return Response.json({
        request: {
          id: "demand-id",
          clientCode: "MEL42",
          title: "Melhoria direta",
          status: "Sugerido",
          tasks: [{ id: "task-id", code: "TASK1", title: "Tarefa direta", status: "Pendente" }],
        },
      });
    if (path === "/api/knowledge/documents/guide")
      return Response.json({
        document: {
          id: "document-id",
          identifier: "guide",
          title: "Documento direto",
          documentType: "procedure",
          markdown: "# Conteúdo direto",
          status: "published",
        },
      });
    if (path === "/api/issues/INC42" || path === "/api/issues/issue-id")
      return Response.json({
        issue: {
          id: "issue-id",
          identifier: "INC42",
          title: "Issue direta",
          text: "Descrição",
          status: "open",
          dates: {},
        },
        comments: [],
      });
    if (path.endsWith("/missing"))
      return Response.json({ error: { message: "Registro não encontrado" } }, { status: 404 });
    return Response.json({ items: [], meta: { total: 0, totalPages: 1 }, byDate: [] });
  };
  await module.act(async () => {
    harness = await module.mountApp(document.getElementById("app"), {
      actor: actor(),
      resolveActor: (workspaceId) => actor(workspaceId),
      messages: true,
      ...options,
    });
  });
}

test("a direct task opens its demand and dialog after switching to the URL workspace", async () => {
  await mount("/requests/MEL42/tasks/TASK1?workspaceId=workspace-b");
  await until(() => document.querySelector('[role="dialog"]')?.textContent.includes("Tarefa direta"));
  assert.ok(document.body.textContent.includes("Melhoria direta"));
  assert.ok(calls.some(({ path }) => path === "/api/requests/MEL42"));
  assert.ok(calls.every(({ workspaceId }) => workspaceId === "workspace-b"));
  assert.equal(window.location.pathname, "/requests/MEL42/tasks/TASK1");
});

test("document and issue aliases open details outside the current list", async () => {
  await mount("/documents/guide?workspaceId=workspace-a");
  await until(() => document.body.textContent.includes("Conteúdo direto"));
  assert.ok(document.body.textContent.includes("Documento direto"));
  await module.act(async () => module.navigate("/issues/INC42?workspaceId=workspace-a"));
  await until(() => document.querySelector('[role="dialog"]')?.textContent.includes("Issue direta"));
  assert.equal(window.location.pathname, "/issues/INC42");
});

test("unknown workspace and forbidden entity view do not mount business views", async () => {
  await mount("/documents/guide?workspaceId=outside");
  await until(() => document.body.textContent.includes("Workspace não encontrado ou sem acesso"));
  assert.deepEqual(calls, []);
});

test("a forbidden view keeps its URL and displays access denial", async () => {
  await mount("/documents/guide?workspaceId=workspace-a", {
    actor: actor("workspace-a", ["issues.read"]),
    resolveActor: null,
  });
  await until(() => document.body.textContent.includes("Você não tem permissão"));
  assert.equal(window.location.pathname, "/documents/guide");
  assert.ok(!calls.some(({ path }) => path.includes("knowledge")));
});

test("missing direct records keep the URL and show the API error", async () => {
  await mount("/documents/missing?workspaceId=workspace-a");
  await until(() => document.body.textContent.includes("Registro não encontrado"));
  assert.equal(window.location.pathname, "/documents/missing");
});

test("login preserves the direct destination until the authorized workspace is restored", async () => {
  let authenticated = false;
  await mount("/documents/guide?workspaceId=workspace-b", {
    resolveActor: (workspaceId) => (authenticated ? actor(workspaceId) : null),
  });
  await until(() => document.querySelector('input[type="password"]'));
  assert.deepEqual(calls, []);
  authenticated = true;
  await module.act(async () =>
    harness.service.signIn({ email: "synthetic@example.test", password: "synthetic-password" }),
  );
  await until(() => document.body.textContent.includes("Conteúdo direto"));
  assert.equal(window.location.pathname, "/documents/guide");
  assert.ok(calls.every(({ workspaceId }) => workspaceId === "workspace-b"));
});

function catalogResponse(path) {
  if (path === "/api/catalog/workspaces") return Response.json({ items: workspaces });
  if (path === "/api/catalog/applications/app-alias" || path === "/api/catalog/applications/app-id")
    return Response.json({
      application: { id: "app-id", key: "app-alias", name: "Aplicação direta", workspaceId: "workspace-a" },
    });
  if (path === "/api/catalog/applications/other")
    return Response.json({
      application: { id: "other", key: "other", name: "Outra aplicação", workspaceId: "workspace-a" },
    });
  if (path === "/api/catalog/components/comp-alias")
    return Response.json({
      component: {
        id: "comp-id",
        key: "comp-alias",
        name: "Componente direto",
        applicationId: "app-id",
        workspaceId: "workspace-a",
        status: "active",
        type: "api",
      },
    });
}

test("a catalog child opens outside paginated lists with read-only controls", async () => {
  await mount("/catalog/app-alias/components/comp-alias?workspaceId=workspace-a", {
    actor: actor("workspace-a", ["applications.read", "components.read"]),
    resolveActor: null,
    respond: catalogResponse,
  });
  await until(() => document.querySelector('[role="dialog"]')?.textContent.includes("Componente direto"));
  assert.equal(document.querySelector('[role="dialog"] fieldset').disabled, true);
  assert.equal(
    [...document.querySelectorAll('[role="dialog"] button')].some((button) => button.textContent.includes("Salvar")),
    false,
  );
  assert.equal(window.location.pathname, "/catalog/app-alias/components/comp-alias");
});

test("a catalog link cannot attach an accessible child to another application", async () => {
  await mount("/catalog/other/components/comp-alias?workspaceId=workspace-a", {
    actor: actor("workspace-a", ["applications.read", "components.read"]),
    resolveActor: null,
    respond: catalogResponse,
  });
  await until(() => document.body.textContent.includes("Registro não encontrado ou sem acesso"));
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

const syntheticGroup = {
  id: "group-id",
  identifier: "operators",
  name: "Grupo direto",
  permissions: [],
  scope: { type: "workspace", applicationIds: [] },
  active: true,
};
const syntheticSkill = {
  skillId: "skill-id",
  name: "Skill direta",
  description: "Exemplo",
  latestVersion: "1.0.0",
  versions: [{ version: "1.0.0", status: "published" }],
};
const secondaryScenarios = [
  {
    path: "/servers/server-key",
    permissions: ["servers.read"],
    text: "Servidor direto",
    responses: {
      "/api/catalog/workspaces": { items: workspaces },
      "/api/catalog/servers/server-key": {
        server: {
          id: "server-id",
          key: "server-key",
          name: "Servidor direto",
          addresses: [],
          status: "active",
          workspaceId: "workspace-a",
        },
      },
    },
  },
  {
    path: "/skills/skill-id",
    permissions: ["skills.read"],
    text: "Skill direta",
    responses: {
      "/api/skills/skill-id": { skill: { ...syntheticSkill, version: "1.0.0" } },
      "/api/skills": { items: [syntheticSkill] },
      "/api/skills/skill-id/1.0.0/download": { skill: { files: [] } },
    },
  },
  {
    path: "/secrets/service-token",
    permissions: ["secrets.metadata.read"],
    text: "Segredo direto",
    responses: {
      "/api/secrets/service-token": {
        secret: {
          id: "secret-id",
          identifier: "service-token",
          name: "Segredo direto",
          description: "Metadados",
          status: "active",
          environment: "production",
          currentVersion: 1,
          versionCount: 1,
          contentKind: "text",
          type: "token",
          workspaceId: "workspace-a",
          applicationId: null,
        },
      },
    },
  },
  {
    path: "/operation/monitoring/templates/template-id",
    permissions: ["runtimes.read"],
    input: "Template direto",
    responses: {
      "/api/monitoring/templates/template-id": {
        template: { id: "template-id", name: "Template direto", versions: [] },
      },
    },
  },
  {
    path: "/users/user-id",
    permissions: ["users.read"],
    text: "Usuário direto",
    responses: {
      "/api/identity/users/user-id": {
        user: { id: "user-id", name: "Usuário direto", email: "synthetic@example.test", groupIds: [] },
      },
    },
  },
  {
    path: "/groups/operators",
    permissions: ["roles.read"],
    input: "Grupo direto",
    responses: { "/api/access/groups": { groups: [syntheticGroup] }, "/api/access/permissions": { permissions: [] } },
  },
  {
    path: "/option-lists/issue.type",
    permissions: ["option_lists.read"],
    text: "Tipo direto",
    responses: {
      "/api/option-lists": {
        items: [{ key: "issue.type", name: "Tipo direto", items: [], defaultValue: "", description: "Exemplo" }],
      },
    },
  },
  {
    path: "/taxonomy/nodes/subject",
    permissions: ["taxonomy.read"],
    text: "Assunto direto",
    responses: {
      "/api/issues/taxonomy": {
        taxonomy: {
          taxonomy: [{ id: "subject", label: "Assunto direto", description: "Exemplo", children: [] }],
          tagGroups: [],
        },
      },
    },
  },
];
for (const scenario of secondaryScenarios) {
  test(`direct link restores ${scenario.path} without relying on its list selection`, async () => {
    await mount(`${scenario.path}?workspaceId=workspace-a`, {
      actor: actor("workspace-a", scenario.permissions),
      resolveActor: null,
      respond: (path) => (scenario.responses[path] ? Response.json(scenario.responses[path]) : null),
    });
    await until(() =>
      scenario.input
        ? [...document.querySelectorAll("input")].some((input) => input.value === scenario.input)
        : document.body.textContent.includes(scenario.text),
    );
    assert.equal(window.location.pathname, scenario.path);
    assert.ok(
      calls.every(({ method }) => method === "GET"),
      "opening a record never writes or reveals a secret",
    );
  });
}

const directApplication = { id: "app-id", key: "app-key", name: "Aplicação direta", workspaceId: "workspace-a" };
const directComponent = {
  id: "component-id",
  key: "component-key",
  name: "Componente direto",
  applicationId: "app-id",
};
const directDeployment = {
  id: "deployment-id",
  key: "production",
  name: "Deployment direto",
  applicationId: "app-id",
  componentId: "component-id",
  environment: "production",
  status: "active",
  publications: [],
};
function environmentResponse(path) {
  const responses = {
    "/api/catalog/workspaces": { items: workspaces },
    "/api/catalog/applications/app-id": { application: directApplication },
    "/api/catalog/components/component-id": { component: directComponent },
    "/api/catalog/deployments/deployment-id": { deployment: directDeployment },
    "/api/catalog/deployments/production": { deployment: directDeployment },
    "/api/catalog/runtimes/runtime-key": {
      runtime: {
        id: "runtime-id",
        key: "runtime-key",
        name: "Runtime direto",
        applicationId: "app-id",
        deploymentId: "deployment-id",
        status: "healthy",
        metadata: {},
        kind: "container",
      },
    },
  };
  return responses[path] ? Response.json(responses[path]) : null;
}
test("monitoring direct links restore a runtime and its authorized parent context", async () => {
  await mount("/operation/monitoring/runtimes/runtime-key?workspaceId=workspace-a", {
    actor: actor("workspace-a", ["applications.read", "components.read", "deployments.read", "runtimes.read"]),
    resolveActor: null,
    respond: environmentResponse,
  });
  await until(() => document.body.textContent.includes("Runtime direto"));
  assert.equal(window.location.pathname, "/operation/monitoring/runtimes/runtime-key");
});
test("publication direct links select the deployment outside the current application list", async () => {
  await mount("/operation/environment/publications/production?workspaceId=workspace-a", {
    actor: actor("workspace-a", ["applications.read", "components.read", "deployments.read"]),
    resolveActor: null,
    respond: environmentResponse,
  });
  await until(() => document.body.textContent.includes("Deployment direto"));
  assert.equal(window.location.pathname, "/operation/environment/publications/production");
});
test("global workspace details load directly outside the current workspace page", async () => {
  const globalActor = { ...actor("workspace-a", []), platformPermissions: ["platform.workspaces.manage"] };
  await mount("/workspaces/global-key?workspaceId=workspace-a", {
    actor: globalActor,
    resolveActor: null,
    respond: (path) =>
      path === "/api/platform/workspaces/global-key" || path === "/api/platform/workspaces/global-id"
        ? Response.json({
            workspace: { id: "global-id", key: "global-key", name: "Workspace global", status: "active" },
          })
        : null,
  });
  await until(() => [...document.querySelectorAll("input")].some((input) => input.value === "Workspace global"));
  assert.equal(window.location.pathname, "/workspaces/global-key");
});

test("a slower manual demand selection cannot overwrite the next URL and detail", async () => {
  let finishFirst;
  const firstResponse = new Promise((resolve) => {
    finishFirst = resolve;
  });
  const first = { id: "first", clientCode: "FIRST", title: "Melhoria anterior", status: "Sugerido" };
  const second = { id: "second", clientCode: "SECOND", title: "Melhoria seguinte", status: "Sugerido" };
  await mount("/requests?workspaceId=workspace-a", {
    actor: actor("workspace-a", ["demands.read"]),
    resolveActor: null,
    respond: (path) => {
      if (path === "/api/requests/collection-items") return Response.json({ items: [first, second] });
      if (path === "/api/requests/first") return firstResponse;
      if (path === "/api/requests/second") return Response.json({ request: second });
      return null;
    },
  });
  const choice = (title) =>
    [...document.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === `Abrir ${title}`);
  await until(() => choice(first.title) && choice(second.title));
  await module.act(async () => choice(first.title).click());
  await module.act(async () => choice(second.title).click());
  await until(() => window.location.pathname === "/requests/second");
  await module.act(async () => finishFirst(Response.json({ request: first })));
  assert.equal(window.location.pathname, "/requests/second");
  assert.ok(
    document.querySelector(".requestDetails")?.textContent.includes(second.title) ||
      document.body.textContent.includes(second.title),
  );
});
