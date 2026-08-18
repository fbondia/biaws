import { Flags } from "@oclif/core";

import { LocalInstanceCommand } from "../../baseCommands.js";
import {
  contextFlags,
  contextInput,
  instanceArgument,
} from "../../instance/command.js";
import {
  backupArguments,
  executeInstanceScript,
  getInstance,
  withPasswordFile,
} from "../../instance/service.js";

export default class InstanceBackup extends LocalInstanceCommand {
  static description =
    "cria backup completo, criptografado e verificável de uma instância";
  static args = { instance: instanceArgument };
  static flags = {
    ...contextFlags,
    output: Flags.string({
      char: "o",
      description: "arquivo de backup de destino",
    }),
    "password-file": Flags.string({
      description: "arquivo privado contendo a senha",
    }),
    json: Flags.boolean({ description: "emite resultado JSON" }),
  };

  async run() {
    const { args, flags } = await this.parse(InstanceBackup);
    const context = await this.localContext(contextInput(flags, args.instance));
    const instance = await getInstance(
      context,
      this.adapters.filesystem,
      args.instance,
    );
    let password;
    if (!flags["password-file"]) {
      if (!context.isInteractive)
        this.error("Informe --password-file em modo não interativo.", {
          code: "BACKUP_PASSWORD_REQUIRED",
          exit: 2,
        });
      password = await this.adapters.prompts.ask({
        name: "password",
        type: "password",
        message: "Senha do backup",
      });
    }
    const output = await withPasswordFile(
      this.adapters.filesystem,
      password,
      flags["password-file"],
      async (passwordFile) =>
        executeInstanceScript(
          backupArguments(instance, context, {
            output: flags.output,
            passwordFile,
          }),
          context,
          this.adapters.processRunner,
          { secrets: password ? [password] : [], silent: flags.json },
        ),
    );
    this.output({ json: flags.json }).result(
      flags.json
        ? { instance: instance.name, operation: "backup", output }
        : output,
    );
  }
}
