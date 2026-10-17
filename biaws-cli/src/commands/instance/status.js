import { Flags } from "@oclif/core";

import { LocalInstanceCommand } from "../../baseCommands.js";
import { contextFlags, contextInput, instanceArgument, writeResult } from "../../instance/command.js";
import { getInstance, operateInstance } from "../../instance/service.js";
import { diagnoseMcp, mcpInstanceSummary } from "../../instance/mcp.js";

export default class InstanceStatus extends LocalInstanceCommand {
  static description = "consulta o estado dos containers de uma instância";
  static args = { instance: instanceArgument };
  static flags = {
    ...contextFlags,
    "diagnose-mcp": Flags.boolean({ description: "valida discovery e saúde da integração OAuth/MCP" }),
    json: Flags.boolean({ description: "emite JSON" }),
  };

  async run() {
    const { args, flags } = await this.parse(InstanceStatus);
    const context = await this.localContext(contextInput(flags, args.instance));
    const instance = await getInstance(context, this.adapters.filesystem, args.instance);
    const result = await operateInstance(instance, context, this.adapters.processRunner, "status");
    result.mcp = mcpInstanceSummary(instance);
    if (flags["diagnose-mcp"]) result.mcp.diagnostics = await diagnoseMcp(instance.publicUrl);
    writeResult(
      this,
      result,
      (value) =>
        (value.output || `Nenhum container ativo para ${value.instance}.`) + "\n" + JSON.stringify(value.mcp, null, 2),
      flags.json,
    );
  }
}
