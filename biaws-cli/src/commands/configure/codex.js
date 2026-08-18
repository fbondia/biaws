import { ProjectCommand } from "../../baseCommands.js";
import {
  configureContextFlags,
  configureContextInput,
  legacyAgentContext,
} from "../../configure/command.js";
import { runAgentCommand } from "../agent.js";

export default class ConfigureCodex extends ProjectCommand {
  static description =
    "configura MCP e skills do Codex sem persistir credenciais no projeto";
  static flags = configureContextFlags;

  async run() {
    const { flags } = await this.parse(ConfigureCodex);
    const context = await this.projectContext(configureContextInput(flags));
    await runAgentCommand(
      context.api,
      "configure",
      ["codex"],
      { ...flags, project: context.projectDirectory },
      legacyAgentContext(context),
    );
  }
}
