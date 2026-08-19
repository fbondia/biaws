import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveCommandContext } from "../src/core/context.js";
import {
  findWorkspaceConfiguration,
  resolveConfigurationPaths,
  writeCredentials,
  writeGlobalConfiguration,
  writeWorkspaceConfiguration,
} from "../src/core/configuration.js";

const filesystem = { chmod, mkdir, readFile, rm, writeFile };
const terminal = { isCI: true, isInteractive: false };

test("caminhos globais respeitam BIAWS_CONFIG_HOME, XDG e HOME", () => {
  assert.equal(
    resolveConfigurationPaths({ BIAWS_CONFIG_HOME: "/private/custom" })
      .directory,
    "/private/custom",
  );
  assert.equal(
    resolveConfigurationPaths({ XDG_CONFIG_HOME: "/private/xdg" }).directory,
    "/private/xdg/biaws",
  );
  assert.equal(
    resolveConfigurationPaths({ HOME: "/private/home" }).directory,
    "/private/home/.config/biaws",
  );
});

test("configuração da pasta seleciona perfil, credencial e workspace", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "biaws-context-"));
  const configHome = path.join(root, "global");
  const project = path.join(root, "project");
  const nested = path.join(project, "src", "feature");
  const paths = resolveConfigurationPaths({ BIAWS_CONFIG_HOME: configHome });
  try {
    await mkdir(nested, { recursive: true });
    await writeGlobalConfiguration(filesystem, paths, {
      currentProfile: "default",
      profiles: {
        default: { apiUrl: "https://default.example.test" },
        equipe: { apiUrl: "https://equipe.example.test" },
      },
    });
    await writeCredentials(filesystem, paths, {
      profiles: {
        default: { apiKey: "default-key" },
        equipe: { apiKey: "team-key" },
      },
    });
    await writeWorkspaceConfiguration(filesystem, project, {
      profile: "equipe",
      workspaceId: "workspace-a",
    });
    const context = await resolveCommandContext({
      cwd: nested,
      environment: { BIAWS_CONFIG_HOME: configHome },
      filesystem,
      input: {},
      terminal,
      toolDirectory: path.join(root, "tool"),
    });
    assert.equal(context.apiUrl, "https://equipe.example.test");
    assert.equal(context.apiKey, "team-key");
    assert.equal(context.profileName, "equipe");
    assert.equal(context.projectDirectory, project);
    assert.equal(context.workspaceId, "workspace-a");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("flags e ambiente sobrescrevem pasta e perfil global", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "biaws-precedence-"));
  const configHome = path.join(root, "global");
  const paths = resolveConfigurationPaths({ BIAWS_CONFIG_HOME: configHome });
  try {
    await writeGlobalConfiguration(filesystem, paths, {
      currentProfile: "default",
      profiles: { default: { apiUrl: "https://global.example.test" } },
    });
    await writeCredentials(filesystem, paths, {
      profiles: { default: { apiKey: "global-key" } },
    });
    await writeWorkspaceConfiguration(filesystem, root, {
      workspaceId: "workspace-local",
    });
    const fromEnvironment = await resolveCommandContext({
      cwd: root,
      environment: {
        BIAWS_API_KEY: "environment-key",
        BIAWS_API_URL: "https://environment.example.test",
        BIAWS_CONFIG_HOME: configHome,
        BIAWS_WORKSPACE_ID: "workspace-environment",
      },
      filesystem,
      input: {},
      terminal,
      toolDirectory: path.join(root, "tool"),
    });
    assert.equal(fromEnvironment.apiKey, "environment-key");
    assert.equal(fromEnvironment.apiUrl, "https://environment.example.test");
    assert.equal(fromEnvironment.workspaceId, "workspace-environment");

    const fromFlags = await resolveCommandContext({
      cwd: root,
      environment: {
        BIAWS_API_KEY: "environment-key",
        BIAWS_CONFIG_HOME: configHome,
      },
      filesystem,
      input: {
        apiKey: "flag-key",
        apiUrl: "https://flag.example.test",
        workspace: "workspace-flag",
      },
      terminal,
      toolDirectory: path.join(root, "tool"),
    });
    assert.equal(fromFlags.apiKey, "flag-key");
    assert.equal(fromFlags.apiUrl, "https://flag.example.test");
    assert.equal(fromFlags.workspaceId, "workspace-flag");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("associação do workspace é encontrada nos diretórios-pai", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "biaws-parent-"));
  const nested = path.join(root, "a", "b", "c");
  try {
    await mkdir(nested, { recursive: true });
    const filePath = await writeWorkspaceConfiguration(filesystem, root, {
      workspaceId: "workspace-parent",
    });
    const found = await findWorkspaceConfiguration(filesystem, nested);
    assert.equal(found.filePath, filePath);
    assert.equal(found.directory, root);
    assert.equal(found.config.workspaceId, "workspace-parent");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
