import { Command, Help } from "@oclif/core";

export default class Api extends Command {
  static description =
    "Executa operações autenticadas nos recursos da API do Bondia Workspaces";
  static examples = [
    "<%= config.bin %> api workspaces list --json",
    "<%= config.bin %> api demands get <id-ou-código> --json",
  ];

  async run() {
    await this.parse(Api);
    await new Help(this.config).showHelp(["api"]);
  }
}
