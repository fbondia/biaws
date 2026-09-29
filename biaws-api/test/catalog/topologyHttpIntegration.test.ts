import { isolatedDatabaseName, restoreEnvironmentAfter, availablePort } from "../support/integration.js";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { COLLECTION_NAMES } from "../../src/database/collectionNames.js";
import {
  integratedMonitoringTemplateSeeds,
  migrateIntegratedMonitoringProfiles,
} from "../../src/repositories/monitoring/metadataProfiles/templateSeeds.js";

const integrationEnabled =
  Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI) && process.env.BIAWS_HTTP_INTEGRATION === "1";

import { authenticationAndCatalogFixture } from "./http/authenticationAndCatalogFixture.js";
import { passiveSignals } from "./http/passiveSignals.js";
import { templateValidation } from "./http/templateValidation.js";
import { activeMonitorLifecycle } from "./http/activeMonitorLifecycle.js";
import { manualExecutionQueue } from "./http/manualExecutionQueue.js";
import { manualExecutionRetry } from "./http/manualExecutionRetry.js";
import { executionRecovery } from "./http/executionRecovery.js";
import { overview } from "./http/overview.js";
import { legacyShell } from "./http/legacyShell.js";
test(
  "topology HTTP API enforces authentication, permissions, relations and audit",
  { skip: !integrationEnabled },
  async (t) => {
    restoreEnvironmentAfter(t);
    const port = await availablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const issueDirectory = await mkdtemp(path.join(tmpdir(), "biaws-phase2-http-"));
    Object.assign(process.env, {
      MONGO_URI: process.env.BIAWS_INTEGRATION_MONGO_URI,
      MONGO_DB: isolatedDatabaseName(),
      BETTER_AUTH_SECRET: "phase2-integration-secret-with-more-than-32-characters",
      BETTER_AUTH_URL: baseUrl,
      BETTER_AUTH_TRUSTED_ORIGINS: baseUrl,
      BIAWS_API_HOST: "127.0.0.1",
      BIAWS_API_PORT: String(port),
      BIAWS_ISSUE_DIR: issueDirectory,
      ATTACHMENT_STORAGE_LOCAL_DIR: issueDirectory,
    });

    const { createApp } = await import("../../src/app.js");
    const { getAuth } = await import("../../src/auth/auth.js");
    const { bootstrapAdmin } = await import("../../src/auth/bootstrapAdmin.js");
    const { closeMongoClient, getMongoDatabase } = await import("../../src/helpers/mongoClient.js");
    const { setUserGroups } = await import("../../src/repositories/access/index.js");
    const { ensureDefaultWorkspace } = await import("../../src/repositories/catalog/index.js");

    const database = await getMongoDatabase();
    await database.dropDatabase();
    const auth = await getAuth();
    const password = "Phase2-integration-password";
    const admin = await bootstrapAdmin({
      auth,
      database,
      email: "admin.phase2@example.test",
      password,
      name: "Phase 2 administrator",
      log() {},
      assignAdministration: (userId) => setUserGroups(userId, ["administration"], { userId }),
    });
    await ensureDefaultWorkspace({ userId: admin.user.id });
    const reader = await auth.api.createUser({
      body: {
        email: "reader.phase2@example.test",
        password,
        name: "Phase 2 reader",
        role: "user",
      },
    });
    await setUserGroups(reader.user.id, ["support"], { userId: admin.user.id });
    await database
      .collection<{ _id: string; permissions: string[] }>(COLLECTION_NAMES.PERMISSION_GROUPS)
      .updateOne({ _id: "administration" }, { $pull: { permissions: "runtimes.read" } });

    const server = createApp().listen(port, "127.0.0.1");
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    async function login(email: string) {
      const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: baseUrl,
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200);
      return response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    }

    async function request(
      route: string,
      {
        apiKey,
        cookie,
        method = "GET",
        body,
        origin = false,
        workspaceId,
      }: {
        apiKey?: string;
        cookie?: string;
        method?: string;
        body?: unknown;
        origin?: boolean;
        workspaceId?: string;
      } = {},
    ) {
      return fetch(`${baseUrl}${route}`, {
        method,
        headers: {
          "x-forwarded-for": "127.0.0.1",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          ...(cookie ? { cookie } : {}),
          ...(origin ? { origin: baseUrl } : {}),
          ...(workspaceId ? { "x-biaws-workspace-id": workspaceId } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }

    const context = {
      port,
      baseUrl,
      issueDirectory,
      createApp,
      getAuth,
      bootstrapAdmin,
      closeMongoClient,
      getMongoDatabase,
      setUserGroups,
      ensureDefaultWorkspace,
      database,
      auth,
      password,
      admin,
      reader,
      server,
      login,
      request,
    };
    try {
      const fixture = await authenticationAndCatalogFixture(context);
      const passive = await passiveSignals(fixture);
      const template = await templateValidation(passive);
      const active = await activeMonitorLifecycle(template);
      const manualQueue = await manualExecutionQueue(active);
      const manualRetry = await manualExecutionRetry(manualQueue);
      const recovery = await executionRecovery(manualRetry);
      const reviewed = await overview(recovery);
      await legacyShell(reviewed);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await database.dropDatabase();
      await closeMongoClient();
      await rm(issueDirectory, { recursive: true, force: true });
    }
  },
);
