import { Command, Help } from "@oclif/core";

export default class Configure extends Command {
  static description =
    "Configura projetos, clientes de agentes e skills de desenvolvimento";
  static examples = [
    "<%= config.bin %> configure codex",
    "<%= config.bin %> configure claude",
    "<%= config.bin %> configure doctor",
  ];

  async run() {
    await this.parse(Configure);
    await new Help(this.config).showHelp(["configure"]);
  }
}
