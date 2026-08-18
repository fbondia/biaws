import { Args, Flags, Help } from "@oclif/core";

import { AuthenticatedApiCommand, ProjectCommand } from "./baseCommands.js";
import {
  configureContextFlags,
  configureContextInput,
  legacyAgentContext,
} from "./configure/command.js";
import { runAgentCommand } from "./commands/agent.js";
import { runMonitoringCommand } from "./commands/monitoring.js";
import { runSkillsCommand } from "./commands/skills.js";

export const authenticatedFlags = Object.freeze({
  "api-key": Flags.string({
    description: "chave da API (prefira ISSUE_API_KEY ou --env-file)",
  }),
  "api-url": Flags.string({ description: "URL da API do Bondia Workspaces" }),
  "env-file": Flags.string({ description: "arquivo privado com URL e chave" }),
  workspace: Flags.string({ char: "w", description: "workspace da operação" }),
  json: Flags.boolean({ description: "emite somente JSON em stdout" }),
});

function authenticatedInput(flags) {
  return {
    apiKey: flags["api-key"],
    apiUrl: flags["api-url"],
    envFile: flags["env-file"],
    workspace: flags.workspace,
  };
}

export function createSkillsCommand(action, definition = {}) {
  return class SkillsAction extends AuthenticatedApiCommand {
    static description = definition.description;
    static args = definition.args || {};
    static flags = { ...authenticatedFlags, ...(definition.flags || {}) };

    async run() {
      const { args, flags } = await this.parse(this.constructor);
      const context = await this.authenticatedContext(
        authenticatedInput(flags),
      );
      const positional = definition.positional
        ? definition.positional(args)
        : [];
      await runSkillsCommand(context.api, action, positional, flags);
    }
  };
}

export function createMonitoringCommand(action, definition = {}) {
  return class MonitoringAction extends AuthenticatedApiCommand {
    static description = definition.description;
    static args = definition.args || {};
    static flags = { ...authenticatedFlags, ...(definition.flags || {}) };

    async run() {
      const { args, flags } = await this.parse(this.constructor);
      const context = await this.authenticatedContext(
        authenticatedInput(flags),
      );
      const positional = definition.positional
        ? definition.positional(args)
        : [];
      await runMonitoringCommand(context.api, action, positional, flags);
    }
  };
}

export function createAgentCommand(action) {
  return class AgentAction extends ProjectCommand {
    static description = `${action === "configure" ? "configura" : "diagnostica"} Codex ou Claude (alias legado)`;
    static args = {
      client: Args.string({
        description: "cliente de agente",
        options: ["codex", "claude"],
        required: true,
      }),
    };
    static flags = configureContextFlags;

    async run() {
      const { args, flags } = await this.parse(this.constructor);
      const context = await this.projectContext(configureContextInput(flags));
      await runAgentCommand(
        context.api,
        action,
        [args.client],
        { ...flags, project: context.projectDirectory },
        legacyAgentContext(context),
      );
    }
  };
}

export async function showTopic(command, topic) {
  await command.parse(command.constructor);
  await new Help(command.config).showHelp([topic]);
}

export const optionalSkillArgument = Args.string({
  description: "ID da skill",
});
export const runtimeArgument = Args.string({
  description: "UUID ou caminho aplicação.componente.deployment.runtime",
  required: true,
});
