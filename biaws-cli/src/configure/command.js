import path from "node:path";

import { Args, Flags } from "@oclif/core";

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
  force: Flags.boolean({
    char: "f",
    description: "substitui somente a configuração BIAWS conflitante",
  }),
  json: Flags.boolean({ description: "emite somente JSON em stdout" }),
});

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
