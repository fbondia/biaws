import { LocalInstanceCommand } from "../../baseCommands.js";
import {
  contextFlags,
  contextInput,
  instanceArgument,
} from "../../instance/command.js";
import { getInstance, operateInstance } from "../../instance/service.js";

export default class InstanceStop extends LocalInstanceCommand {
  static description = "para os serviços de uma instância sem remover dados";
  static args = { instance: instanceArgument };
  static flags = contextFlags;

  async run() {
    const { args, flags } = await this.parse(InstanceStop);
    const context = await this.localContext(contextInput(flags, args.instance));
    const instance = await getInstance(
      context,
      this.adapters.filesystem,
      args.instance,
    );
    await operateInstance(
      instance,
      context,
      this.adapters.processRunner,
      "stop",
    );
    this.output().result(`Instância ${instance.name} parada.`);
  }
}
