import { LocalInstanceCommand } from "../../baseCommands.js";
import {
  contextFlags,
  contextInput,
  instanceArgument,
} from "../../instance/command.js";
import { getInstance, operateInstance } from "../../instance/service.js";

export default class InstanceStart extends LocalInstanceCommand {
  static description = "inicia os serviços de uma instância e aguarda saúde";
  static args = { instance: instanceArgument };
  static flags = contextFlags;

  async run() {
    const { args, flags } = await this.parse(InstanceStart);
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
      "start",
    );
    this.output().result(
      `Instância ${instance.name} iniciada. UI: ${instance.publicUrl}`,
    );
  }
}
