import {
  access,
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  stat,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "@oclif/core";

import { createApiClient } from "./apiClient.js";
import {
  resolveAuthenticatedContext,
  resolveCommandContext,
} from "./core/context.js";
import { ProcessRunner } from "./core/processRunner.js";
import { createPromptAdapter } from "./core/prompts.js";
import {
  CliLogger,
  CliOutput,
  createTerminalAdapter,
} from "./core/terminal.js";

export const TOOL_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function createCommandAdapters(overrides = {}) {
  const environment = overrides.environment || { ...process.env };
  const filesystem = overrides.filesystem || {
    access,
    chmod,
    mkdtemp,
    mkdir,
    readFile,
    readdir,
    stat,
    rm,
    writeFile,
  };
  const terminal = overrides.terminal || createTerminalAdapter({ environment });
  const processRunner =
    overrides.processRunner ||
    new ProcessRunner({
      signalSource: process,
      stdout: terminal.stdout,
      stderr: terminal.stderr,
    });
  const prompts =
    overrides.prompts || createPromptAdapter(terminal, overrides.promptOptions);
  return Object.freeze({
    apiFactory: overrides.apiFactory || createApiClient,
    cwd: overrides.cwd || (() => process.cwd()),
    environment,
    filesystem,
    processRunner,
    prompts,
    terminal,
  });
}

export class BaseCommand extends Command {
  constructor(argv, config, adapterOverrides = {}) {
    super(argv, config);
    this.adapters = createCommandAdapters(adapterOverrides);
  }

  output(options = {}) {
    return new CliOutput(this.adapters.terminal, options);
  }

  logger(options = {}) {
    return new CliLogger(this.adapters.terminal, options);
  }

  contextOptions(input = {}) {
    return {
      cwd: this.adapters.cwd(),
      environment: this.adapters.environment,
      filesystem: this.adapters.filesystem,
      input,
      terminal: this.adapters.terminal,
      toolDirectory: TOOL_DIRECTORY,
    };
  }

  commandContext(input = {}) {
    return resolveCommandContext(this.contextOptions(input));
  }
}

export class LocalInstanceCommand extends BaseCommand {
  localContext(input = {}) {
    return this.commandContext(input);
  }
}

export class AuthenticatedApiCommand extends BaseCommand {
  async authenticatedContext(input = {}, options = {}) {
    const context = await resolveAuthenticatedContext({
      ...this.contextOptions(input),
      requireWorkspace: Boolean(options.requireWorkspace),
    });
    return Object.freeze({
      ...context,
      api: this.adapters.apiFactory(
        context.apiUrl,
        context.apiKey,
        context.workspaceId,
      ),
    });
  }
}

export class ProjectCommand extends AuthenticatedApiCommand {
  async projectContext(input = {}, options = {}) {
    return this.authenticatedContext(input, options);
  }
}
