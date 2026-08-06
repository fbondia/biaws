import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_VIEWS,
  buildLocalDevelopmentCommands,
  buildLocalWorkspaceSetupCommand,
  canOpenWorkspaceSwitcher,
  currentWorkspaceName,
  SETTINGS_VIEWS,
} from "../src/App/model.js";

test("applications and servers are grouped under settings", () => {
  assert.equal(
    APP_VIEWS.some(({ key }) => key === "catalog"),
    false,
  );
  assert.equal(
    APP_VIEWS.some(({ key }) => key === "servers"),
    false,
  );
  assert.deepEqual(
    SETTINGS_VIEWS.slice(0, 2).map(({ key }) => key),
    ["catalog", "servers"],
  );
});

test("local setup command scopes the selected workspace and project", () => {
  assert.equal(
    buildLocalWorkspaceSetupCommand({
      client: "claude",
      instance: "cliente-a",
      projectDirectory: "/Users/example/Source/project's app",
      workspaceId: "workspace-a",
    }),
    `./scripts/setup-agent.sh \\
  --instance 'cliente-a' \\
  --client claude \\
  --project '/Users/example/Source/project'"'"'s app' \\
  --workspace 'workspace-a' \\
  --skip-bootstrap`,
  );
});

test("local development commands share instance, client and workspace context", () => {
  const commands = buildLocalDevelopmentCommands({
    client: "codex",
    instance: "cliente-a",
    projectDirectory: "/Users/example/project",
    workspaceId: "workspace-a",
  });

  assert.match(
    commands.configure,
    /BIAWS_ENV_FILE='instances\/cliente-a\/\.env'/u,
  );
  assert.match(commands.configure, /agent configure codex/u);
  assert.match(commands.configure, /--project '\/Users\/example\/project'/u);
  assert.match(commands.installSkills, /skills install-all/u);
  assert.match(
    commands.installSkills,
    /--target '\/Users\/example\/project\/\.agents\/skills'/u,
  );
  assert.match(commands.updateSkills, /skills update/u);
  assert.match(commands.doctor, /agent doctor codex/u);
  for (const command of Object.values(commands)) {
    assert.match(command, /--workspace 'workspace-a'/u);
  }
});

test("workspace context exposes the current name and the allowed switcher", () => {
  const actor = {
    workspaceId: "workspace-b",
    workspaces: [
      { id: "workspace-a", name: "Workspace A" },
      { id: "workspace-b", name: "Workspace B" },
    ],
    platformPermissions: [],
  };
  assert.equal(currentWorkspaceName(actor), "Workspace B");
  assert.equal(canOpenWorkspaceSwitcher(actor), true);
  assert.equal(
    canOpenWorkspaceSwitcher({
      workspaces: [{ id: "workspace-a", name: "Workspace A" }],
      platformPermissions: [],
    }),
    false,
  );
  assert.equal(
    canOpenWorkspaceSwitcher({
      workspaces: [],
      platformPermissions: ["platform.workspaces.manage"],
    }),
    true,
  );
});
