import { Command, Help } from "@oclif/core";
export default class Workspaces extends Command {
  static description = "Consulta workspaces autorizados pela API";
  async run() {
    await this.parse(Workspaces);
    await new Help(this.config).showHelp(["workspaces"]);
  }
}
