import { Flags } from "@oclif/core";
import { BaseCommand } from "../../baseCommands.js";
import { chatgptConnectionInstructions, diagnoseMcp } from "../../instance/mcp.js";

export default class ConfigureChatgpt extends BaseCommand {
  static description = "orienta conexão direta ao ChatGPT usando OAuth, sem capturar senha ou chave";
  static flags = {
    url: Flags.string({ description: "origem pública HTTPS da instância", required: true }),
    diagnose: Flags.boolean({ description: "verifica discovery, saúde e challenge a partir desta máquina" }),
    json: Flags.boolean({ description: "emite JSON" }),
  };
  async run() {
    const { flags } = await this.parse(ConfigureChatgpt);
    const result = flags.diagnose ? await diagnoseMcp(flags.url) : chatgptConnectionInstructions(flags.url);
    this.output({ json: flags.json }).result(flags.json ? result : JSON.stringify(result, null, 2));
  }
}
