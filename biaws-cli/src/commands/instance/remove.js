import { Flags } from "@oclif/core";

import { LocalInstanceCommand } from "../../baseCommands.js";
import {
  contextFlags,
  contextInput,
  instanceArgument,
} from "../../instance/command.js";
import {
  executeInstanceScript,
  getInstance,
  removeArguments,
} from "../../instance/service.js";

export default class InstanceRemove extends LocalInstanceCommand {
  static description =
    "remove uma instância preservando bind mounts externos por padrão";
  static args = { instance: instanceArgument };
  static flags = {
    ...contextFlags,
    "delete-external-data": Flags.boolean({
      description: "apaga também bind mounts externos validados",
    }),
    yes: Flags.boolean({ char: "y", description: "confirma a remoção" }),
    json: Flags.boolean({ description: "emite resultado JSON" }),
  };

  async run() {
    const { args, flags } = await this.parse(InstanceRemove);
    const context = await this.localContext(contextInput(flags, args.instance));
    const instance = await getInstance(
      context,
      this.adapters.filesystem,
      args.instance,
    );
    if (!flags.yes) {
      if (!context.isInteractive)
        this.error("Remoção exige --yes em modo não interativo.", {
          code: "CONFIRMATION_REQUIRED",
          exit: 2,
        });
      const confirmation = await this.adapters.prompts.ask({
        name: "confirmation",
        type: "input",
        message: `Digite ${instance.name} para confirmar a remoção`,
      });
      if (confirmation !== instance.name)
        this.error("Remoção cancelada.", {
          code: "CONFIRMATION_MISMATCH",
          exit: 2,
        });
    }
    const output = await executeInstanceScript(
      removeArguments(instance, context, {
        deleteExternalData: flags["delete-external-data"],
      }),
      context,
      this.adapters.processRunner,
      { silent: flags.json },
    );
    this.output({ json: flags.json }).result(
      flags.json
        ? {
            instance: instance.name,
            operation: "remove",
            externalDataDeleted: flags["delete-external-data"],
            output,
          }
        : output,
    );
  }
}
