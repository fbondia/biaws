import { Flags } from "@oclif/core";

import { LocalInstanceCommand } from "../../baseCommands.js";
import {
  buildExecutionPlan,
  executeExecutionPlan,
  summarizeExecutionPlan,
  wizardFlags,
} from "../../core/wizard.js";
import {
  contextFlags,
  contextInput,
  writeResult,
} from "../../instance/command.js";
import {
  buildSetupConfiguration,
  executeSetup,
  validateInstanceName,
  validatePort,
  validatePublicUrl,
} from "../../instance/service.js";

const setupFlags = {
  ...contextFlags,
  ...wizardFlags,
  name: Flags.string({ char: "n", description: "nome da instância" }),
  "admin-email": Flags.string({
    description: "e-mail do administrador inicial",
  }),
  "admin-name": Flags.string({ description: "nome do administrador inicial" }),
  "public-url": Flags.string({ description: "origem pública HTTP(S) da UI" }),
  "mongo-port": Flags.integer({ description: "porta externa do MongoDB" }),
  "api-port": Flags.integer({ description: "porta externa da API" }),
  "ui-port": Flags.integer({ description: "porta externa da UI" }),
  storage: Flags.string({
    options: ["volumes", "directories"],
    description: "estratégia de storage",
  }),
  "storage-root": Flags.string({
    description: "raiz dos diretórios persistentes",
  }),
  "mongo-path": Flags.string({
    description: "diretório persistente do MongoDB",
  }),
  "issue-path": Flags.string({
    description: "diretório persistente de issues",
  }),
  "request-path": Flags.string({
    description: "diretório persistente de melhorias",
  }),
  "document-path": Flags.string({
    description: "diretório persistente de documentos",
  }),
  "secret-path": Flags.string({
    description: "diretório persistente do cofre",
  }),
  "demo-seed": Flags.boolean({
    allowNo: true,
    description: "carrega dados de demonstração",
  }),
  "disable-rate-limit": Flags.boolean({
    description: "desabilita todas as camadas de rate limit",
  }),
  "api-rate-limit-max": Flags.integer({
    description: "requisições por janela da API",
  }),
  "api-rate-limit-window": Flags.integer({
    description: "janela da API em segundos",
  }),
  "auth-rate-limit-max": Flags.integer({
    description: "requisições por janela de autenticação",
  }),
  "auth-rate-limit-window": Flags.integer({
    description: "janela de autenticação em segundos",
  }),
  "api-key-rate-limit-max": Flags.integer({
    description: "requisições por janela da chave de API",
  }),
  "api-key-rate-limit-window": Flags.integer({
    description: "janela da chave de API em segundos",
  }),
};

const definition = {
  kind: "instance.setup",
  questions: [
    {
      name: "name",
      type: "input",
      message: "Nome da instância",
      environment: "BIAWS_INSTANCE",
      validate: (value) => {
        validateInstanceName(value);
        return true;
      },
    },
    {
      name: "adminEmail",
      flag: "admin-email",
      type: "input",
      message: "E-mail do administrador",
      default: "admin@example.com",
      validate: (value) =>
        /^\S+@\S+\.\S+$/u.test(value) || "E-mail administrativo inválido.",
    },
    {
      name: "adminName",
      flag: "admin-name",
      type: "input",
      message: "Nome do administrador",
      default: "Administrador",
    },
    {
      name: "adminPassword",
      type: "password",
      message: "Senha inicial do administrador",
      environment: "BIAWS_BOOTSTRAP_ADMIN_PASSWORD",
      secret: true,
    },
    {
      name: "uiPort",
      flag: "ui-port",
      type: "number",
      message: "Porta da UI",
      default: 4400,
      validate: (value) => {
        validatePort(value, "Porta UI");
        return true;
      },
    },
    {
      name: "apiPort",
      flag: "api-port",
      type: "number",
      message: "Porta da API",
      default: 3100,
      validate: (value) => {
        validatePort(value, "Porta API");
        return true;
      },
    },
    {
      name: "mongoPort",
      flag: "mongo-port",
      type: "number",
      message: "Porta do MongoDB",
      default: 27017,
      validate: (value) => {
        validatePort(value, "Porta MongoDB");
        return true;
      },
    },
    {
      name: "publicUrl",
      flag: "public-url",
      type: "input",
      message: "URL pública",
      default: (values) => `http://localhost:${values.uiPort}`,
      validate: (value) => {
        validatePublicUrl(value);
        return true;
      },
    },
    {
      name: "storage",
      type: "select",
      message: "Estratégia de storage",
      choices: [
        { name: "Volumes Docker", value: "volumes" },
        { name: "Diretórios no host", value: "directories" },
      ],
      default: "volumes",
    },
    {
      name: "storageRoot",
      flag: "storage-root",
      type: "input",
      message: "Raiz de storage",
      required: false,
      when: (values) => values.storage === "directories",
    },
    {
      name: "mongoPath",
      flag: "mongo-path",
      type: "input",
      message: "Diretório MongoDB",
      required: false,
      when: (values) => values.storage === "directories",
    },
    {
      name: "issuePath",
      flag: "issue-path",
      type: "input",
      message: "Diretório de issues",
      required: false,
      when: (values) => values.storage === "directories",
    },
    {
      name: "requestPath",
      flag: "request-path",
      type: "input",
      message: "Diretório de melhorias",
      required: false,
      when: (values) => values.storage === "directories",
    },
    {
      name: "documentPath",
      flag: "document-path",
      type: "input",
      message: "Diretório de documentos",
      required: false,
      when: (values) => values.storage === "directories",
    },
    {
      name: "secretPath",
      flag: "secret-path",
      type: "input",
      message: "Diretório do cofre",
      required: false,
      when: (values) => values.storage === "directories",
    },
    {
      name: "apiRateLimitMax",
      flag: "api-rate-limit-max",
      type: "number",
      message: "Rate limit da API",
      default: 300,
    },
    {
      name: "apiRateLimitWindow",
      flag: "api-rate-limit-window",
      type: "number",
      message: "Janela da API (s)",
      default: 60,
    },
    {
      name: "authRateLimitMax",
      flag: "auth-rate-limit-max",
      type: "number",
      message: "Rate limit de autenticação",
      default: 100,
    },
    {
      name: "authRateLimitWindow",
      flag: "auth-rate-limit-window",
      type: "number",
      message: "Janela de autenticação (s)",
      default: 10,
    },
    {
      name: "apiKeyRateLimitMax",
      flag: "api-key-rate-limit-max",
      type: "number",
      message: "Rate limit da chave de API",
      default: 1000,
    },
    {
      name: "apiKeyRateLimitWindow",
      flag: "api-key-rate-limit-window",
      type: "number",
      message: "Janela da chave de API (s)",
      default: 3600,
    },
    {
      name: "disableRateLimit",
      flag: "disable-rate-limit",
      type: "confirm",
      message: "Desabilitar rate limiting?",
      default: false,
    },
    {
      name: "demoSeed",
      flag: "demo-seed",
      type: "confirm",
      message: "Carregar dados de demonstração?",
      default: false,
    },
  ],
};

export default class InstanceSetup extends LocalInstanceCommand {
  static description =
    "cria ou reconcilia uma instância local por plano idempotente";
  static examples = [
    "<%= config.bin %> instance setup --interactive",
    "BIAWS_BOOTSTRAP_ADMIN_PASSWORD=... <%= config.bin %> instance setup --name local --defaults --yes --non-interactive",
  ];
  static flags = setupFlags;

  async run() {
    const { flags } = await this.parse(InstanceSetup);
    const context = await this.localContext(contextInput(flags, flags.name));
    const plan = await buildExecutionPlan(definition, {
      environment: this.adapters.environment,
      flags,
      options: flags,
      promptAdapter: this.adapters.prompts,
      terminal: this.adapters.terminal,
    });
    const configuration = await buildSetupConfiguration(
      Object.fromEntries(
        definition.questions.map((question) => [
          question.name,
          plan.get(question.name),
        ]),
      ),
      context,
      this.adapters.filesystem,
    );
    if (configuration.storageChanged) {
      this.output().diagnostic(
        "Aviso: o storage mudou; dados existentes não serão movidos automaticamente.",
      );
    }
    this.output().diagnostic(
      `Plano validado: ${JSON.stringify(summarizeExecutionPlan(plan))}`,
    );
    const result = await executeExecutionPlan(
      plan,
      () =>
        executeSetup(
          configuration,
          context,
          this.adapters.processRunner,
          this.adapters.environment,
          { silent: flags.json },
        ),
      {
        options: flags,
        promptAdapter: this.adapters.prompts,
        terminal: this.adapters.terminal,
      },
    );
    writeResult(
      this,
      result,
      (value) =>
        [
          "Configuração concluída.",
          `Instância: ${value.name}`,
          `UI: ${value.ui}`,
          `API: ${value.api}`,
          `MongoDB: ${value.mongo}`,
          `Status: ${value.commands.status}`,
        ].join("\n"),
      flags.json,
    );
  }
}
