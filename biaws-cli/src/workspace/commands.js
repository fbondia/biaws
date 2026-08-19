import path from "node:path";

import { Args, Flags } from "@oclif/core";

import { AuthenticatedApiCommand, BaseCommand } from "../baseCommands.js";
import { CliError } from "../core/errors.js";
import { writeWorkspaceConfiguration } from "../core/configuration.js";
import { DomainReadService } from "../domain/readService.js";

const workspaceFlags = {
  "api-url": Flags.string({ description: "URL da API" }),
  profile: Flags.string({ char: "p", description: "perfil global da API" }),
  project: Flags.string({ description: "pasta que será associada" }),
  json: Flags.boolean({ description: "emite somente JSON em stdout" }),
};

function contextInput(flags) {
  return {
    apiUrl: flags["api-url"],
    profile: flags.profile,
    project: flags.project,
  };
}

function emit(command, json, value, human) {
  command.output({ json }).result(json ? value : human);
}

function identifyWorkspace(items, reference) {
  const normalized = String(reference || "").trim();
  const matches = items.filter(
    (item) =>
      String(item.id) === normalized ||
      String(item.name || "").toLocaleLowerCase("pt-BR") ===
        normalized.toLocaleLowerCase("pt-BR"),
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new CliError(`Nome de workspace ambíguo: ${normalized}.`, {
      code: "AMBIGUOUS_WORKSPACE",
      exitCode: 2,
    });
  }
  throw new CliError(`Workspace não encontrado: ${normalized}.`, {
    code: "WORKSPACE_NOT_FOUND",
    exitCode: 4,
  });
}

async function chooseWorkspace(command, context, reference) {
  const payload = await new DomainReadService(context.api).workspaces();
  const items = payload.items || [];
  if (reference) return identifyWorkspace(items, reference);
  if (!context.isInteractive) {
    throw new CliError(
      "Informe o ID ou o nome do workspace em modo não interativo.",
      { code: "WORKSPACE_SELECTION_REQUIRED", exitCode: 2 },
    );
  }
  if (!items.length) {
    throw new CliError("A chave de API não autoriza nenhum workspace.", {
      code: "NO_AUTHORIZED_WORKSPACES",
      exitCode: 3,
    });
  }
  const selected = await command.adapters.prompts.ask({
    name: "workspace",
    type: "select",
    message: "Workspace a associar",
    choices: items.map((item) => ({
      name: `${item.name || item.id} (${item.id})`,
      value: item.id,
    })),
  });
  return identifyWorkspace(items, selected);
}

async function associate(command, flags, reference) {
  const context = await command.authenticatedContext(contextInput(flags));
  const workspace = await chooseWorkspace(command, context, reference);
  const projectDirectory = path.resolve(
    flags.project || command.adapters.cwd(),
  );
  const filePath = await writeWorkspaceConfiguration(
    command.adapters.filesystem,
    projectDirectory,
    { profile: context.profileName, workspaceId: workspace.id },
  );
  const result = {
    file: filePath,
    profile: context.profileName,
    projectDirectory,
    workspaceId: workspace.id,
    workspaceName: workspace.name || null,
  };
  emit(
    command,
    flags.json,
    result,
    `Pasta ${projectDirectory} associada ao workspace ${workspace.name || workspace.id} (${workspace.id}).`,
  );
}

export class WorkspaceInitCommand extends AuthenticatedApiCommand {
  static description = "associa a pasta atual a um workspace autorizado";
  static args = {
    workspace: Args.string({ description: "ID ou nome do workspace" }),
  };
  static flags = workspaceFlags;

  async run() {
    const { args, flags } = await this.parse(this.constructor);
    await associate(this, flags, args.workspace);
  }
}

export class WorkspaceUseCommand extends AuthenticatedApiCommand {
  static description = "seleciona o workspace associado à pasta";
  static args = {
    workspace: Args.string({
      description: "ID ou nome do workspace",
      required: true,
    }),
  };
  static flags = workspaceFlags;

  async run() {
    const { args, flags } = await this.parse(this.constructor);
    await associate(this, flags, args.workspace);
  }
}

export class WorkspaceCurrentCommand extends BaseCommand {
  static description = "exibe o workspace associado à pasta atual";
  static flags = {
    project: Flags.string({ description: "pasta a consultar" }),
    json: workspaceFlags.json,
  };

  async run() {
    const { flags } = await this.parse(this.constructor);
    const context = await this.commandContext({ project: flags.project });
    const workspace = context.configuration.workspace;
    if (!workspace?.config?.workspaceId) {
      throw new CliError(
        "A pasta não está associada a um workspace. Execute `biaws workspace init`.",
        { code: "WORKSPACE_NOT_INITIALIZED", exitCode: 2 },
      );
    }
    const result = {
      directory: workspace.directory,
      file: workspace.filePath,
      profile: context.profileName,
      workspaceId: workspace.config.workspaceId,
    };
    emit(
      this,
      flags.json,
      result,
      `Workspace ${result.workspaceId} associado a ${result.directory} pelo perfil ${result.profile}.`,
    );
  }
}

export class WorkspaceUnlinkCommand extends BaseCommand {
  static description = "remove a associação da pasta com o workspace";
  static flags = {
    project: Flags.string({ description: "pasta a desassociar" }),
    json: workspaceFlags.json,
  };

  async run() {
    const { flags } = await this.parse(this.constructor);
    const context = await this.commandContext({ project: flags.project });
    const workspace = context.configuration.workspace;
    if (!workspace) {
      throw new CliError("A pasta não possui associação com um workspace.", {
        code: "WORKSPACE_NOT_INITIALIZED",
        exitCode: 2,
      });
    }
    await this.adapters.filesystem.rm(workspace.filePath);
    const result = { directory: workspace.directory, removed: true };
    emit(
      this,
      flags.json,
      result,
      `Associação removida de ${workspace.directory}.`,
    );
  }
}
