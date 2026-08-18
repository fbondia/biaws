import { Command, Help } from "@oclif/core";
export default class Demands extends Command {
  static description = "Consulta melhorias e suas tarefas pela API";
  async run() {
    await this.parse(Demands);
    await new Help(this.config).showHelp(["demands"]);
  }
}
