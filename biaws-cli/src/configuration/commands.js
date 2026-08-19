import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../baseCommands.js";
import { CliError } from "../core/errors.js";
import {
  DEFAULT_PROFILE,
  writeCredentials,
  writeGlobalConfiguration,
} from "../core/configuration.js";

const profileFlag = Flags.string({
  char: "p",
  description: "perfil global",
});

const jsonFlag = Flags.boolean({
  description: "emite somente JSON em stdout",
});

function profileName(value) {
  const name = String(value || DEFAULT_PROFILE).trim();
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(name)) {
    throw new CliError(
      "O perfil deve usar letras minúsculas, números, ponto, hífen ou sublinhado.",
      { code: "INVALID_PROFILE", exitCode: 2 },
    );
  }
  return name;
}

function globalWithProfile(configuration, name, values = {}) {
  return {
    ...configuration.global,
    currentProfile: configuration.global.currentProfile || name,
    profiles: {
      ...(configuration.global.profiles || {}),
      [name]: {
        ...(configuration.global.profiles?.[name] || {}),
        ...values,
      },
    },
  };
}

function credentialsWithKey(configuration, name, apiKey) {
  const profiles = { ...(configuration.credentials.profiles || {}) };
  if (apiKey) profiles[name] = { ...(profiles[name] || {}), apiKey };
  else delete profiles[name];
  return { ...configuration.credentials, profiles };
}

async function requiredApiKey(command) {
  const fromEnvironment = String(
    command.adapters.environment.BIAWS_API_KEY ||
      command.adapters.environment.BIAWS_API_KEY ||
      "",
  ).trim();
  if (fromEnvironment) return fromEnvironment;
  if (command.adapters.terminal.isInteractive) {
    return String(
      await command.adapters.prompts.ask({
        name: "apiKey",
        type: "password",
        message: "Chave de API",
      }),
    ).trim();
  }
  throw new CliError(
    "Chave de API ausente. Defina BIAWS_API_KEY ou execute o comando em um terminal interativo.",
    { code: "API_KEY_REQUIRED", exitCode: 2 },
  );
}

function emit(command, json, value, human) {
  command.output({ json }).result(json ? value : human);
}

export class ConfigInitCommand extends BaseCommand {
  static description = "inicializa a configuração global e as credenciais";
  static flags = {
    "api-url": Flags.string({ description: "URL da API" }),
    profile: profileFlag,
    json: jsonFlag,
  };

  async run() {
    const { flags } = await this.parse(this.constructor);
    const name = profileName(flags.profile);
    const context = await this.commandContext({
      apiUrl: flags["api-url"],
      profile: name,
    });
    const apiKey = await requiredApiKey(this);
    const global = globalWithProfile(context.configuration, name, {
      apiUrl: context.apiUrl,
    });
    global.currentProfile = name;
    await Promise.all([
      writeGlobalConfiguration(
        this.adapters.filesystem,
        context.configuration.paths,
        global,
      ),
      writeCredentials(
        this.adapters.filesystem,
        context.configuration.paths,
        credentialsWithKey(context.configuration, name, apiKey),
      ),
    ]);
    emit(
      this,
      flags.json,
      { apiUrl: context.apiUrl, profile: name, credentialsStored: true },
      `Perfil ${name} configurado para ${context.apiUrl}.`,
    );
  }
}

export class ConfigLoginCommand extends BaseCommand {
  static description = "armazena e valida a chave de API de um perfil";
  static flags = {
    "api-url": Flags.string({ description: "URL da API" }),
    profile: profileFlag,
    verify: Flags.boolean({
      allowNo: true,
      default: true,
      description: "valida a credencial antes de armazená-la",
    }),
    json: jsonFlag,
  };

  async run() {
    const { flags } = await this.parse(this.constructor);
    const name = profileName(flags.profile);
    const apiKey = await requiredApiKey(this);
    const context = await this.commandContext({
      apiKey,
      apiUrl: flags["api-url"],
      profile: name,
    });
    if (flags.verify) {
      await this.adapters.apiFactory(context.apiUrl, apiKey).identity();
    }
    await writeCredentials(
      this.adapters.filesystem,
      context.configuration.paths,
      credentialsWithKey(context.configuration, name, apiKey),
    );
    if (flags["api-url"]) {
      await writeGlobalConfiguration(
        this.adapters.filesystem,
        context.configuration.paths,
        globalWithProfile(context.configuration, name, {
          apiUrl: context.apiUrl,
        }),
      );
    }
    emit(
      this,
      flags.json,
      { profile: name, credentialsStored: true, verified: flags.verify },
      `Credencial do perfil ${name} armazenada${flags.verify ? " e validada" : ""}.`,
    );
  }
}

export class ConfigShowCommand extends BaseCommand {
  static description = "exibe a configuração efetiva sem revelar credenciais";
  static flags = { profile: profileFlag, json: jsonFlag };

  async run() {
    const { flags } = await this.parse(this.constructor);
    const context = await this.commandContext({ profile: flags.profile });
    const value = {
      apiUrl: context.apiUrl,
      configDirectory: context.configuration.paths.directory || null,
      credentialsConfigured: Boolean(context.apiKey),
      profile: context.profileName,
      workspaceDirectory: context.configuration.workspace?.directory || null,
      workspaceId: context.workspaceId || null,
    };
    emit(
      this,
      flags.json,
      value,
      [
        `Perfil: ${value.profile}`,
        `API: ${value.apiUrl}`,
        `Credencial: ${value.credentialsConfigured ? "configurada" : "ausente"}`,
        `Workspace: ${value.workspaceId || "não associado"}`,
        `Pasta: ${value.workspaceDirectory || "não associada"}`,
      ].join("\n"),
    );
  }
}

export class ConfigSetCommand extends BaseCommand {
  static description = "altera uma opção da configuração global";
  static args = {
    key: Args.string({ options: ["api-url"], required: true }),
    value: Args.string({ required: true }),
  };
  static flags = { profile: profileFlag, json: jsonFlag };

  async run() {
    const { args, flags } = await this.parse(this.constructor);
    const name = profileName(flags.profile);
    const context = await this.commandContext({
      apiUrl: args.key === "api-url" ? args.value : undefined,
      profile: name,
    });
    const global = globalWithProfile(context.configuration, name, {
      apiUrl: context.apiUrl,
    });
    await writeGlobalConfiguration(
      this.adapters.filesystem,
      context.configuration.paths,
      global,
    );
    emit(
      this,
      flags.json,
      { key: args.key, profile: name, value: context.apiUrl },
      `${args.key} atualizado no perfil ${name}.`,
    );
  }
}

export class ConfigUnsetCommand extends BaseCommand {
  static description = "remove uma opção ou credencial global";
  static args = {
    key: Args.string({ options: ["api-url", "api-key"], required: true }),
  };
  static flags = { profile: profileFlag, json: jsonFlag };

  async run() {
    const { args, flags } = await this.parse(this.constructor);
    const name = profileName(flags.profile);
    const context = await this.commandContext({ profile: name });
    if (args.key === "api-key") {
      await writeCredentials(
        this.adapters.filesystem,
        context.configuration.paths,
        credentialsWithKey(context.configuration, name, ""),
      );
    } else {
      const profiles = { ...(context.configuration.global.profiles || {}) };
      profiles[name] = { ...(profiles[name] || {}) };
      delete profiles[name].apiUrl;
      await writeGlobalConfiguration(
        this.adapters.filesystem,
        context.configuration.paths,
        { ...context.configuration.global, profiles },
      );
    }
    emit(
      this,
      flags.json,
      { key: args.key, profile: name, removed: true },
      `${args.key} removido do perfil ${name}.`,
    );
  }
}

export class ConfigDoctorCommand extends BaseCommand {
  static description = "diagnostica configuração, autenticação e conectividade";
  static flags = { profile: profileFlag, json: jsonFlag };

  async run() {
    const { flags } = await this.parse(this.constructor);
    const context = await this.commandContext({ profile: flags.profile });
    let authentication = "ausente";
    let identity = null;
    let error = null;
    if (context.apiKey) {
      try {
        identity = await this.adapters
          .apiFactory(context.apiUrl, context.apiKey)
          .identity();
        authentication = "válida";
      } catch (cause) {
        authentication = "inválida";
        error = cause.message;
        process.exitCode = 1;
      }
    } else {
      process.exitCode = 1;
    }
    const result = {
      apiUrl: context.apiUrl,
      authentication,
      configDirectory: context.configuration.paths.directory || null,
      error,
      identity,
      profile: context.profileName,
    };
    emit(
      this,
      flags.json,
      result,
      [
        `Perfil: ${result.profile}`,
        `API: ${result.apiUrl}`,
        `Autenticação: ${result.authentication}`,
        ...(error ? [`Diagnóstico: ${error}`] : []),
      ].join("\n"),
    );
  }
}

export class ConfigProfilesListCommand extends BaseCommand {
  static description = "lista os perfis globais";
  static flags = { json: jsonFlag };

  async run() {
    const { flags } = await this.parse(this.constructor);
    const context = await this.commandContext();
    const current =
      context.configuration.global.currentProfile || DEFAULT_PROFILE;
    const items = Object.entries(
      context.configuration.global.profiles || {},
    ).map(([name, config]) => ({
      apiUrl: config.apiUrl || null,
      current: name === current,
      credentialsConfigured: Boolean(
        context.configuration.credentials.profiles?.[name]?.apiKey,
      ),
      name,
    }));
    emit(
      this,
      flags.json,
      { items },
      items.length
        ? items
            .map(
              (item) =>
                `${item.current ? "*" : " "} ${item.name}  ${item.apiUrl || "URL não configurada"}`,
            )
            .join("\n")
        : "Nenhum perfil configurado.",
    );
  }
}

export class ConfigProfilesUseCommand extends BaseCommand {
  static description = "seleciona o perfil global padrão";
  static args = { profile: Args.string({ required: true }) };
  static flags = { json: jsonFlag };

  async run() {
    const { args, flags } = await this.parse(this.constructor);
    const name = profileName(args.profile);
    const context = await this.commandContext({ profile: name });
    if (!context.configuration.global.profiles?.[name]) {
      throw new CliError(`Perfil não encontrado: ${name}.`, {
        code: "PROFILE_NOT_FOUND",
        exitCode: 2,
      });
    }
    await writeGlobalConfiguration(
      this.adapters.filesystem,
      context.configuration.paths,
      { ...context.configuration.global, currentProfile: name },
    );
    emit(
      this,
      flags.json,
      { currentProfile: name },
      `Perfil global selecionado: ${name}.`,
    );
  }
}
