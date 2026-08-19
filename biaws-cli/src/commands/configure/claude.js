import { ProjectCommand } from "../../baseCommands.js";
import {
  configureContextFlags,
  configureContextInput,
  legacyAgentContext,
} from "../../configure/command.js";
import { runAgentCommand } from "../agent.js";

export default class ConfigureClaude extends ProjectCommand {
  static description =
    "configura MCP e skills do Claude sem persistir credenciais no projeto";
  static flags = configureContextFlags;

  async run() {
    const { flags } = await this.parse(ConfigureClaude);
    const context = await this.projectContext(configureContextInput(flags), {
      requireWorkspace: true,
    });
    await runAgentCommand(
      context.api,
      "configure",
      ["claude"],
      { ...flags, project: context.projectDirectory },
      legacyAgentContext(context),
    );
  }
}
