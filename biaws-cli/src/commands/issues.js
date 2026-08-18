import { Command, Help } from "@oclif/core";
export default class Issues extends Command {
  static description = "Consulta incidentes e issues pela API";
  async run() {
    await this.parse(Issues);
    await new Help(this.config).showHelp(["issues"]);
  }
}
