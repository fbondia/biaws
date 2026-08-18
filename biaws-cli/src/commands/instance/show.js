import { Flags } from "@oclif/core";

import { LocalInstanceCommand } from "../../baseCommands.js";
import {
  contextFlags,
  contextInput,
  instanceArgument,
  instanceSummary,
  writeResult,
} from "../../instance/command.js";
import { getInstance } from "../../instance/service.js";

export default class InstanceShow extends LocalInstanceCommand {
  static description = "exibe a configuração não sensível de uma instância";
  static args = { instance: instanceArgument };
  static flags = {
    ...contextFlags,
    json: Flags.boolean({ description: "emite JSON" }),
  };

  async run() {
    const { args, flags } = await this.parse(InstanceShow);
    const context = await this.localContext(contextInput(flags, args.instance));
    const { env, ...instance } = await getInstance(
      context,
      this.adapters.filesystem,
      args.instance,
    );
    writeResult(this, instance, instanceSummary, flags.json);
  }
}
