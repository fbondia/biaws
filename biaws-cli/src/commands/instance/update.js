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

function versionCheckResult(instance, versionStatus, json) {
  if (json) return versionStatus;
  return [
    `Instância: ${instance.name}`,
    `Versão atual: ${versionStatus.currentVersion}`,
    `Nova versão: ${versionStatus.newVersion}`,
    `Atualização necessária: ${versionStatus.updateRequired ? "sim" : "não"}`,
  ].join("\n");
}

function unchangedResult(instance, versionStatus, json) {
  return json
    ? { ...versionStatus, updated: false, backupCreated: false }
    : `Instância ${instance.name} já está na versão ${versionStatus.newVersion}.`;
}

async function createUpdateBackup(command, instance, context, flags) {
  if (flags["skip-backup"]) return "";

  let password;
  if (!flags["password-file"]) {
    if (!context.isInteractive) {
      command.error(
        "Atualização exige --password-file ou --skip-backup em modo não interativo.",
        { code: "BACKUP_PASSWORD_REQUIRED", exit: 2 },
      );
    }
    password = await command.adapters.prompts.ask({
      name: "password",
      type: "password",
      message: "Senha do backup anterior à atualização",
    });
  }

  return withPasswordFile(
    command.adapters.filesystem,
    password,
    flags["password-file"],
    async (passwordFile) =>
      executeInstanceScript(
        backupArguments(instance, context, {
          output: flags["backup-output"],
          passwordFile,
        }),
        context,
        command.adapters.processRunner,
        { secrets: password ? [password] : [], silent: flags.json },
      ),
  );
}

function updatedResult(instance, versionStatus, flags, backupOutput) {
  if (!flags.json) {
    return `Instância ${instance.name} atualizada de ${versionStatus.currentVersion} para ${versionStatus.newVersion}. UI: ${instance.publicUrl}`;
  }
  return {
    instance: instance.name,
    operation: "update",
    currentVersion: versionStatus.currentVersion,
    newVersion: versionStatus.newVersion,
    updateRequired: versionStatus.updateRequired,
    updated: true,
    backupCreated: !flags["skip-backup"],
    backupOutput,
    ui: instance.publicUrl,
  };
}

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
        versionCheckResult(instance, versionStatus, flags.json),
      );
      return;
    }
    if (!versionStatus.updateRequired && !flags.force) {
      this.output({ json: flags.json }).result(
        unchangedResult(instance, versionStatus, flags.json),
      );
      return;
    }

    await validateInstanceUpdate(
      instance,
      context,
      this.adapters.processRunner,
    );
    const backupOutput = await createUpdateBackup(
      this,
      instance,
      context,
      flags,
    );

    await updateInstance(
      instance,
      context,
      this.adapters.filesystem,
      this.adapters.processRunner,
      versionStatus.newVersion,
      this.adapters.environment,
    );
    this.output({ json: flags.json }).result(
      updatedResult(instance, versionStatus, flags, backupOutput),
    );
  }
}
