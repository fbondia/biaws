import { Command } from "@oclif/core";
export default class Demands extends Command {
  static description = "Consulta melhorias e suas tarefas pela API";
  async run() {
    await this.config.runCommand("help", ["demands"]);
  }
}
