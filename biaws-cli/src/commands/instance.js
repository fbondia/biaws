import { Command, Help } from "@oclif/core";

export default class Instance extends Command {
  static description =
    "Instala, configura e opera instâncias locais do Bondia Workspaces";
  static examples = [
    "<%= config.bin %> instance setup",
    "<%= config.bin %> instance status",
    "<%= config.bin %> instance backup",
  ];

  async run() {
    await this.parse(Instance);
    await new Help(this.config).showHelp(["instance"]);
  }
}
