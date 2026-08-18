import { Flags } from "@oclif/core";

import { LocalInstanceCommand } from "../../baseCommands.js";
import {
  contextFlags,
  contextInput,
  writeResult,
} from "../../instance/command.js";
import { listInstances } from "../../instance/service.js";

export default class InstanceList extends LocalInstanceCommand {
  static description = "lista instâncias locais sem revelar credenciais";
  static flags = {
    ...contextFlags,
    json: Flags.boolean({ description: "emite JSON" }),
  };

  async run() {
    const { flags } = await this.parse(InstanceList);
    const context = await this.localContext(contextInput(flags));
    const instances = (
      await listInstances(context, this.adapters.filesystem)
    ).map(({ env, ...item }) => item);
    writeResult(
      this,
      instances,
      (items) =>
        items.length
          ? items
              .map(
                (item) =>
                  `${item.name}\tMongo ${item.mongoPort}\tAPI ${item.apiPort}\tUI ${item.uiPort}\t${item.directory}`,
              )
              .join("\n")
          : `Nenhuma instância encontrada em ${context.instancesDirectory}.`,
      flags.json,
    );
  }
}
