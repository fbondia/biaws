import path from "node:path";

import { Args, Flags } from "@oclif/core";

import { CliError } from "../core/errors.js";

export const configureContextFlags = Object.freeze({
  project: Flags.string({
    char: "p",
    description: "diretório do projeto a configurar",
  }),
  profile: Flags.string({ description: "perfil global da API" }),
  workspace: Flags.string({
    char: "w",
    description: "workspace associado ao projeto",
  }),
  "api-url": Flags.string({ description: "URL da API do Bondia Workspaces" }),
  "env-file": Flags.string({
    description: "arquivo privado com URL e chave de API",
  }),
  interactive: Flags.boolean({
    char: "i",
    allowNo: true,
    description:
      "usa o modo assistente (padrão em terminais; use --no-interactive para desativar)",
  }),
  force: Flags.boolean({
    char: "f",
    description: "substitui somente a configuração BIAWS conflitante",
  }),
  json: Flags.boolean({ description: "emite somente JSON em stdout" }),
});

export async function interactiveConfigureInput(command, flags) {
  const interactive =
    flags.interactive === true ||
    (flags.interactive !== false && command.adapters.terminal.isInteractive);
  if (!interactive) {
    return { ...configureContextInput(flags), interactive: false };
  }
  if (!command.adapters.prompts.isInteractive) {
    throw new CliError("O modo assistente exige um terminal interativo.", {
      code: "INTERACTIVE_INPUT_UNAVAILABLE",
      exitCode: 2,
    });
  }
  const project = String(
    await command.adapters.prompts.ask({
      name: "project",
      message: "Diretório do projeto",
      default: flags.project || command.adapters.cwd(),
    }),
  ).trim();
  const envFile = String(
    await command.adapters.prompts.ask({
      name: "envFile",
      message: "Arquivo privado da instância (BIAWS_ENV_FILE)",
      default:
        flags["env-file"] || command.adapters.environment.BIAWS_ENV_FILE || "",
    }),
  ).trim();
  if (!envFile) {
    throw new CliError("Informe o arquivo privado da instância.", {
      code: "ENV_FILE_REQUIRED",
      exitCode: 2,
    });
  }
  return {
    ...configureContextInput({ ...flags, project, "env-file": envFile }),
    interactive: true,
  };
}

export const clientArgument = Args.string({
  description: "cliente a diagnosticar",
  options: ["codex", "claude"],
  required: false,
});

export function configureContextInput(flags) {
  return {
    apiUrl: flags["api-url"],
    envFile: flags["env-file"],
    project: flags.project,
    profile: flags.profile,
    workspace: flags.workspace,
  };
}

export function legacyAgentContext(context) {
  return {
    apiKey: context.apiKey,
    apiUrl: context.apiUrl,
    envFile: context.envFile,
    toolDirectory: context.repositoryRoot
      ? path.join(context.repositoryRoot, "biaws-cli")
      : context.toolDirectory,
    workspaceId: context.workspaceId,
  };
}
