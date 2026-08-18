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
  restoreArguments,
  withPasswordFile,
} from "../../instance/service.js";

export default class InstanceRestore extends LocalInstanceCommand {
  static description =
    "restaura um backup completo preservando a configuração do host de destino";
  static args = { instance: instanceArgument };
  static flags = {
    ...contextFlags,
    archive: Flags.string({
      char: "a",
      required: true,
      description: "backup criptografado",
    }),
    "password-file": Flags.string({
      description: "arquivo privado contendo a senha",
    }),
    yes: Flags.boolean({
      char: "y",
      description: "confirma a substituição dos dados",
    }),
    json: Flags.boolean({ description: "emite resultado JSON" }),
  };

  async run() {
    const { args, flags } = await this.parse(InstanceRestore);
    const context = await this.localContext(contextInput(flags, args.instance));
    const instance = await getInstance(
      context,
      this.adapters.filesystem,
      args.instance,
    );
    if (!flags.yes) {
      if (!context.isInteractive)
        this.error("Restauração exige --yes em modo não interativo.", {
          code: "CONFIRMATION_REQUIRED",
          exit: 2,
        });
      const confirmation = await this.adapters.prompts.ask({
        name: "confirmation",
        type: "input",
        message: `Digite ${instance.name} para confirmar a restauração`,
      });
      if (confirmation !== instance.name)
        this.error("Restauração cancelada.", {
          code: "CONFIRMATION_MISMATCH",
          exit: 2,
        });
    }
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
      (passwordFile) =>
        executeInstanceScript(
          restoreArguments(instance, context, {
            archive: flags.archive,
            passwordFile,
          }),
          context,
          this.adapters.processRunner,
          { secrets: password ? [password] : [], silent: flags.json },
        ),
    );
    this.output({ json: flags.json }).result(
      flags.json
        ? { instance: instance.name, operation: "restore", output }
        : output,
    );
  }
}
