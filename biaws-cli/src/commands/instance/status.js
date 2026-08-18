import { Flags } from "@oclif/core";

import { LocalInstanceCommand } from "../../baseCommands.js";
import {
  contextFlags,
  contextInput,
  instanceArgument,
  writeResult,
} from "../../instance/command.js";
import { getInstance, operateInstance } from "../../instance/service.js";

export default class InstanceStatus extends LocalInstanceCommand {
  static description = "consulta o estado dos containers de uma instância";
  static args = { instance: instanceArgument };
  static flags = {
    ...contextFlags,
    json: Flags.boolean({ description: "emite JSON" }),
  };

  async run() {
    const { args, flags } = await this.parse(InstanceStatus);
    const context = await this.localContext(contextInput(flags, args.instance));
    const instance = await getInstance(
      context,
      this.adapters.filesystem,
      args.instance,
    );
    const result = await operateInstance(
      instance,
      context,
      this.adapters.processRunner,
      "status",
    );
    writeResult(
      this,
      result,
      (value) =>
        value.output || `Nenhum container ativo para ${value.instance}.`,
      flags.json,
    );
  }
}
