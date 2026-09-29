import assert from "node:assert/strict";
import test from "node:test";
import express, { Router } from "express";
import { ObjectId } from "mongodb";
import type { NextFunction, Request, Response } from "express";
import {
  issueCreateBodySchema,
  publicObjectSchema,
  publicSecretSchema,
  secretResponseSchema,
  type IssueCreateInput,
  type IssueCreateOutput,
} from "../../src/contracts/domainSchemas.js";
import { collectRouteContracts, installRouteContracts } from "../../src/contracts/routeContracts.js";
import { contractRouters } from "../../src/contracts/routers.js";
import { publicSecret } from "../../src/repositories/secrets/index.js";
import { availablePort } from "../support/integration.js";

test("every protected route has parameter, query, body and public response schemas", () => {
  const contracts = collectRouteContracts(contractRouters);
  assert.equal(contracts.length, 245);
  assert.equal(new Set(contracts.map(({ method, path }) => `${method} ${path}`)).size, 245);
  for (const contract of contracts) {
    assert.ok(contract.params);
    assert.ok(contract.query);
    assert.ok(contract.body);
    assert.ok(contract.response);
  }
  const issueCreation = contracts.find(({ method, path }) => method === "post" && path === "/api/issues");
  assert.ok(issueCreation);
  assert.equal(issueCreation.body, issueCreateBodySchema);
  assert.deepEqual(issueCreation.query.parse({ page: "invalid", limit: "" }), {
    page: "invalid",
    limit: "",
  });
});

test("issue input/output types follow legacy string coercion and required text", () => {
  const input: IssueCreateInput = { title: 42, text: "  details  " };
  const output: IssueCreateOutput = issueCreateBodySchema.parse(input);
  assert.equal(output.title, "42");
  assert.equal(output.text, "details");
  const missing = issueCreateBodySchema.safeParse({ title: "  ", text: "x" });
  assert.equal(missing.success, false);
  if (!missing.success) {
    assert.equal(missing.error.issues[0]?.message, "Invalid issue payload: title is required");
  }
});

test("the public secret response excludes stored versions and locators", () => {
  const secret = publicSecret({
    id: "secret-a",
    workspaceId: "workspace-a",
    name: "Synthetic secret",
    type: "token",
    provider: "local",
    status: "active",
    currentVersion: 1,
    versions: [{ version: 1, locator: "private/secret.enc" }],
  });
  assert.deepEqual(secretResponseSchema.parse({ secret }).secret, publicSecretSchema.parse(secret));
  assert.equal(publicSecretSchema.safeParse({ ...secret, versions: [] }).success, false);
  assert.equal(publicSecretSchema.safeParse({ ...secret, locator: "private/secret.enc" }).success, false);
});

test("generic responses accept serialized JSON and reject raw Mongo values", () => {
  assert.equal(
    publicObjectSchema.safeParse({
      id: "public",
      updatedAt: "2026-09-29T00:00:00.000Z",
    }).success,
    true,
  );
  assert.equal(publicObjectSchema.safeParse({ _id: new ObjectId() }).success, false);
  assert.equal(publicObjectSchema.safeParse({ updatedAt: new Date() }).success, false);
});

test("HTTP boundary applies Zod after routing and preserves the 422 error shape", async () => {
  const router = Router();
  router.post("/", (req: Request, res: Response) => res.json({ title: req.body.title }));
  installRouteContracts([{ domain: "issuesRouter", prefix: "/api/issues", router }]);
  const app = express();
  app.use(express.json());
  app.use("/api/issues", router);
  app.use(
    (
      error: {
        statusCode?: number;
        code?: string;
        message?: string;
        fields?: unknown[];
      },
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      res.status(error.statusCode || 500).json({
        error: {
          code: error.code,
          message: error.message,
          fields: error.fields,
        },
      });
    },
  );
  const port = await availablePort();
  const server = app.listen(port, "127.0.0.1");
  try {
    const valid = await fetch(`http://127.0.0.1:${port}/api/issues`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: 42, text: "Details" }),
    });
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { title: "42" });
    const invalid = await fetch(`http://127.0.0.1:${port}/api/issues`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "", text: "Details" }),
    });
    assert.equal(invalid.status, 422);
    assert.deepEqual(await invalid.json(), {
      error: {
        code: "BAD_REQUEST",
        message: "Invalid issue payload: title is required",
        fields: [
          {
            path: "body.title",
            code: "custom",
            message: "Invalid issue payload: title is required",
          },
        ],
      },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("issue text objects produce structured validation errors and preserve extra fields", () => {
  const invalid = issueCreateBodySchema.safeParse({ title: { unexpected: true }, text: "Details" });
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.deepEqual(invalid.error.issues[0].path, ["title"]);
  const valid = issueCreateBodySchema.parse({ title: "Example", text: "Details", extension: { active: true } });
  assert.deepEqual(valid.extension, { active: true });
});
