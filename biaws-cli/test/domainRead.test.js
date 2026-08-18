import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient } from "../src/apiClient.js";
import {
  asCliError,
  DomainReadService,
  readEnvelope,
  table,
} from "../src/domain/readService.js";

test("DomainReadService repassa filtros, paginação e escopo sem ampliá-los", async () => {
  const calls = [];
  const service = new DomainReadService({
    async request(path) {
      calls.push(path);
      return { items: [] };
    },
  });
  await service.applications("workspace-a", {
    q: "billing",
    page: 2,
    limit: 10,
    ignored: undefined,
  });
  await service.issues({
    workspaceId: "workspace-a",
    applicationId: "app-a",
    status: "open",
  });
  assert.deepEqual(calls, [
    "/catalog/workspaces/workspace-a/applications?q=billing&page=2&limit=10",
    "/issues?workspaceId=workspace-a&applicationId=app-a&status=open",
  ]);
});

test("DomainReadService resolve código exato de melhoria sem ampliar escopo", async () => {
  const calls = [];
  const service = new DomainReadService({
    async request(path) {
      calls.push(path);
      if (path.startsWith("/requests/")) {
        throw Object.assign(new Error("não encontrado"), { statusCode: 404 });
      }
      return {
        items: [{ id: "request-1", clientCode: "DEMO-001" }],
      };
    },
  });
  const result = await service.demand("DEMO-001", {
    workspaceId: "workspace-a",
  });
  assert.equal(result.request.id, "request-1");
  assert.deepEqual(calls, [
    "/requests/DEMO-001?workspaceId=workspace-a",
    "/requests?workspaceId=workspace-a&code=DEMO-001&limit=2",
  ]);
});

test("envelope JSON v1 explicita escopo, paginação e truncamento", () => {
  const envelope = readEnvelope(
    "issues",
    "list",
    {
      meta: { page: 3, limit: 20, total: 61, truncated: true },
      items: [{ id: "INC-1" }],
    },
    { workspaceId: "workspace-a", applicationId: "app-a" },
  );
  assert.equal(envelope.schemaVersion, "biaws.read.v1");
  assert.deepEqual(envelope.scope, {
    workspaceId: "workspace-a",
    applicationId: "app-a",
    requestId: null,
  });
  assert.deepEqual(envelope.pagination, {
    page: 3,
    limit: 20,
    total: 61,
    returned: 1,
    truncated: true,
  });
  assert.deepEqual(envelope.data, [{ id: "INC-1" }]);
});

test("tabela humana é determinística e não oculta resultado vazio", () => {
  assert.equal(table([], [["ID", (item) => item.id]]), "Nenhum resultado.");
  assert.equal(
    table(
      [{ id: "a", name: "Alpha" }],
      [
        ["ID", (item) => item.id],
        ["NOME", (item) => item.name],
      ],
    ),
    "ID  NOME\na   Alpha",
  );
});

test("erros de autorização e inexistência possuem códigos de saída distintos", () => {
  const forbidden = Object.assign(new Error("sem permissão"), {
    statusCode: 403,
  });
  const missing = Object.assign(new Error("não encontrado"), {
    statusCode: 404,
  });
  assert.deepEqual(
    [
      asCliError(forbidden, "issue").code,
      asCliError(forbidden, "issue").exitCode,
    ],
    ["PERMISSION_DENIED", 3],
  );
  assert.deepEqual(
    [asCliError(missing, "issue").code, asCliError(missing, "issue").exitCode],
    ["RESOURCE_NOT_FOUND", 4],
  );
});

test("cliente HTTP preserva o código de erro específico da API", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    async json() {
      return { error: { code: "ISSUE_NOT_FOUND", message: "Issue not found" } };
    },
  });
  await assert.rejects(
    createApiClient("http://api.test", "secret", "workspace-a").request(
      "/issues/INC-404",
    ),
    { code: "ISSUE_NOT_FOUND", statusCode: 404 },
  );
});
