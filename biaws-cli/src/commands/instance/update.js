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
  getInstanceUpdateStatus,
  updateInstance,
  validateInstanceUpdate,
  withPasswordFile,
} from "../../instance/service.js";

export default class InstanceUpdate extends LocalInstanceCommand {
  static description =
    "reconstrói e atualiza os serviços preservando os dados da instância";
  static args = { instance: instanceArgument };
  static flags = {
    ...contextFlags,
    "backup-output": Flags.string({
      description: "arquivo de destino do backup anterior à atualização",
    }),
    "password-file": Flags.string({
      description: "arquivo privado contendo a senha do backup",
    }),
    "skip-backup": Flags.boolean({
      description: "atualiza sem criar o backup de segurança",
      exclusive: ["backup-output", "password-file"],
    }),
    check: Flags.boolean({
      description: "compara a versão instalada com a versão da release",
      exclusive: ["backup-output", "password-file", "skip-backup", "force"],
    }),
    force: Flags.boolean({
      description: "reconstrói mesmo quando a instância já está na versão nova",
      exclusive: ["check"],
    }),
    json: Flags.boolean({ description: "emite resultado JSON" }),
  };

  async run() {
    const { args, flags } = await this.parse(InstanceUpdate);
    const context = await this.localContext(contextInput(flags, args.instance));
    const instance = await getInstance(
      context,
      this.adapters.filesystem,
      args.instance,
    );
    const versionStatus = await getInstanceUpdateStatus(
      instance,
      context,
      this.adapters.filesystem,
    );
    if (flags.check) {
      this.output({ json: flags.json }).result(
        flags.json
          ? versionStatus
          : [
              `Instância: ${instance.name}`,
              `Versão atual: ${versionStatus.currentVersion}`,
              `Nova versão: ${versionStatus.newVersion}`,
              `Atualização necessária: ${versionStatus.updateRequired ? "sim" : "não"}`,
            ].join("\n"),
      );
      return;
    }
    if (!versionStatus.updateRequired && !flags.force) {
      this.output({ json: flags.json }).result(
        flags.json
          ? { ...versionStatus, updated: false, backupCreated: false }
          : `Instância ${instance.name} já está na versão ${versionStatus.newVersion}.`,
      );
      return;
    }

    await validateInstanceUpdate(
      instance,
      context,
      this.adapters.processRunner,
    );
    let backupOutput = "";

    if (!flags["skip-backup"]) {
      let password;
      if (!flags["password-file"]) {
        if (!context.isInteractive)
          this.error(
            "Atualização exige --password-file ou --skip-backup em modo não interativo.",
            { code: "BACKUP_PASSWORD_REQUIRED", exit: 2 },
          );
        password = await this.adapters.prompts.ask({
          name: "password",
          type: "password",
          message: "Senha do backup anterior à atualização",
        });
      }
      backupOutput = await withPasswordFile(
        this.adapters.filesystem,
        password,
        flags["password-file"],
        async (passwordFile) =>
          executeInstanceScript(
            backupArguments(instance, context, {
              output: flags["backup-output"],
              passwordFile,
            }),
            context,
            this.adapters.processRunner,
            { secrets: password ? [password] : [], silent: flags.json },
          ),
      );
    }

    await updateInstance(
      instance,
      context,
      this.adapters.filesystem,
      this.adapters.processRunner,
      versionStatus.newVersion,
      this.adapters.environment,
    );
    this.output({ json: flags.json }).result(
      flags.json
        ? {
            instance: instance.name,
            operation: "update",
            currentVersion: versionStatus.currentVersion,
            newVersion: versionStatus.newVersion,
            updateRequired: versionStatus.updateRequired,
            updated: true,
            backupCreated: !flags["skip-backup"],
            backupOutput,
            ui: instance.publicUrl,
          }
        : `Instância ${instance.name} atualizada de ${versionStatus.currentVersion} para ${versionStatus.newVersion}. UI: ${instance.publicUrl}`,
    );
  }
}
