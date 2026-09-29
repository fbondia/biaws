#!/usr/bin/env node

import { randomBytes } from "node:crypto";

import { getAuth } from "../auth/auth.js";
import { bootstrapAgent } from "../auth/bootstrapAgent.js";
import { getServerConfig } from "../config.js";
import { closeMongoClient, getMongoDatabase } from "../helpers/mongoClient.js";
import { errorMessage } from "../helpers/error.js";
import { setUserGroups } from "../repositories/access/index.js";
import { ensureDefaultWorkspace, getWorkspace } from "../repositories/catalog/index.js";

async function run() {
  const serverConfig = getServerConfig();
  const database = await getMongoDatabase();
  const auth = await getAuth();
  const requestedWorkspaceId = String(process.env.BIAWS_BOOTSTRAP_MONITOR_EXECUTOR_WORKSPACE_ID || "").trim();
  const workspace = requestedWorkspaceId ? await getWorkspace(requestedWorkspaceId) : await ensureDefaultWorkspace();
  if (!workspace) {
    throw new Error("Requested monitor executor workspace was not found");
  }
  const result = await bootstrapAgent({
    auth,
    database,
    email: String(
      process.env.BIAWS_BOOTSTRAP_MONITOR_EXECUTOR_EMAIL || "monitor-executor@localhost.invalid",
    ).toLowerCase(),
    name: String(process.env.BIAWS_BOOTSTRAP_MONITOR_EXECUTOR_NAME || "Bondia Workspaces Monitor Executor"),
    password: randomBytes(32).toString("base64url"),
    keyName: "BIAWS monitor executor",
    metadataKind: "bootstrap-monitor-executor",
    existingApiKey: String(process.env.BIAWS_BOOTSTRAP_MONITOR_EXECUTOR_API_KEY || "").trim(),
    rateLimit: serverConfig.rateLimit.apiKey,
    assignAgent: (userId) =>
      setUserGroups(
        userId,
        ["monitor-executor"],
        { userId: "bootstrap-monitor-executor", workspaceId: workspace.id },
        { workspaceId: workspace.id },
      ),
  });

  console.log(`BIAWS_MONITOR_EXECUTOR_API_KEY=${result.apiKey.key}`);
  console.log(`BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID=${workspace.id}`);
}

try {
  await run();
} catch (error: unknown) {
  console.error(errorMessage(error));
  process.exitCode = 1;
} finally {
  await closeMongoClient();
}
