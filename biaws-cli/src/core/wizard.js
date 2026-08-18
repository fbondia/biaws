import { Flags } from "@oclif/core";

import { CliError } from "./errors.js";
import {
  NonInteractivePromptAdapter,
  PromptCancelledError,
  createPromptAdapter,
} from "./prompts.js";
import { redactValue } from "./redaction.js";

const REDACTED = "[REDACTED]";

export const wizardFlags = Object.freeze({
  defaults: Flags.boolean({
    description: "aplica somente os defaults declarados pelo comando",
  }),
  interactive: Flags.boolean({
    description: "solicita em um TTY os campos que não foram informados",
    exclusive: ["non-interactive"],
  }),
  json: Flags.boolean({
    description: "emite o resumo estruturado em JSON",
  }),
  "non-interactive": Flags.boolean({
    description: "não solicita entradas e falha se campos estiverem ausentes",
    exclusive: ["interactive"],
  }),
  yes: Flags.boolean({
    char: "y",
    description: "pula somente a confirmação do plano validado",
  }),
});

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)]),
    );
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

export class MissingWizardInputError extends CliError {
  constructor(fields) {
    const names = fields.map((field) => field.name);
    super(`Campos obrigatórios ausentes: ${names.join(", ")}.`, {
      code: "MISSING_REQUIRED_INPUT",
      exitCode: 2,
      details: { fields: names },
    });
    this.name = "MissingWizardInputError";
    this.fields = names;
  }
}

export class ExecutionPlan {
  #values;

  constructor(kind, values, questions) {
    this.#values = deepFreeze(clone(values));
    const secretNames = new Set(
      questions
        .filter((question) => question.secret)
        .map((question) => question.name),
    );
    const secretValues = [...secretNames]
      .map((name) => values[name])
      .filter(hasValue)
      .map(String);
    this.kind = kind;
    this.values = deepFreeze(
      Object.fromEntries(
        Object.entries(values).map(([name, value]) => [
          name,
          secretNames.has(name) && hasValue(value)
            ? REDACTED
            : redactValue(clone(value), secretValues),
        ]),
      ),
    );
    Object.freeze(this);
  }

  get(name) {
    return this.#values[name];
  }

  toJSON() {
    return { kind: this.kind, values: this.values };
  }
}

export function normalizeWizardOptions(options = {}, terminal = {}) {
  const nonInteractive = Boolean(
    options.nonInteractive || options["non-interactive"],
  );
  if (options.interactive && nonInteractive) {
    throw new CliError(
      "--interactive e --non-interactive são mutuamente exclusivos.",
      {
        code: "INTERACTION_MODE_CONFLICT",
        exitCode: 2,
      },
    );
  }
  return Object.freeze({
    defaults: Boolean(options.defaults),
    interactive: Boolean(
      !nonInteractive &&
      terminal.isInteractive &&
      (options.interactive || !nonInteractive),
    ),
    json: Boolean(options.json),
    yes: Boolean(options.yes),
  });
}

function sourceValue(question, flags, environment) {
  const flagName = question.flag || question.name;
  if (hasValue(flags[flagName])) return flags[flagName];
  if (question.environment && hasValue(environment[question.environment])) {
    return environment[question.environment];
  }
  return undefined;
}

async function isApplicable(question, values) {
  return question.when
    ? Boolean(await question.when(Object.freeze({ ...values })))
    : true;
}

async function validateAnswer(question, value, values) {
  if (!question.validate) return;
  const result = await question.validate(value, Object.freeze({ ...values }));
  if (result === true || result === undefined) return;
  const message =
    typeof result === "string"
      ? result
      : `Valor inválido para ${question.name}.`;
  throw new CliError(message, {
    code: "WIZARD_VALIDATION_FAILED",
    exitCode: 2,
    details: { field: question.name },
  });
}

export async function collectWizardValues(definition, input = {}) {
  const terminal = input.terminal || {};
  const options = normalizeWizardOptions(input.options, terminal);
  const adapter =
    input.promptAdapter ||
    (options.interactive
      ? createPromptAdapter(terminal, input.promptOptions)
      : new NonInteractivePromptAdapter());
  const values = {};
  const missing = [];
  const questions = definition.questions || [];

  for (const question of questions) {
    if (!(await isApplicable(question, values))) continue;
    let value = sourceValue(
      question,
      input.flags || {},
      input.environment || {},
    );
    const hasDefault = Object.hasOwn(question, "default");
    const defaultValue = hasDefault
      ? typeof question.default === "function"
        ? await question.default(Object.freeze({ ...values }))
        : question.default
      : undefined;
    if (!hasValue(value) && options.defaults && hasDefault) {
      value = defaultValue;
    }
    if (!hasValue(value) && options.interactive) {
      try {
        value = await adapter.ask(
          hasDefault ? { ...question, default: defaultValue } : question,
          {
            signal: input.signal,
            values: Object.freeze({ ...values }),
          },
        );
      } catch (error) {
        if (error instanceof PromptCancelledError) throw error;
        if (error?.name === "AbortError") throw new PromptCancelledError();
        throw error;
      }
    }
    if (!hasValue(value)) {
      if (question.required !== false) missing.push(question);
      continue;
    }
    await validateAnswer(question, value, values);
    values[question.name] = value;
  }

  if (missing.length > 0) throw new MissingWizardInputError(missing);
  return Object.freeze({ options, questions, values: deepFreeze(values) });
}

export function createExecutionPlan(definition, collected) {
  if (!definition?.kind) {
    throw new CliError("O wizard deve definir um identificador de plano.", {
      code: "WIZARD_DEFINITION_INVALID",
      exitCode: 2,
    });
  }
  return new ExecutionPlan(
    definition.kind,
    collected.values,
    collected.questions,
  );
}

export function summarizeExecutionPlan(plan) {
  return plan.toJSON();
}

export async function confirmExecutionPlan(plan, input = {}) {
  if (input.options?.yes) return true;
  if (!input.terminal?.isInteractive || !input.promptAdapter?.isInteractive) {
    throw new CliError(
      "Confirmação necessária. Use --yes em modo não interativo.",
      {
        code: "CONFIRMATION_REQUIRED",
        exitCode: 2,
      },
    );
  }
  let confirmed;
  try {
    confirmed = await input.promptAdapter.ask(
      {
        name: "confirmation",
        type: "confirm",
        message: input.message || `Executar o plano ${plan.kind}?`,
        default: false,
      },
      { signal: input.signal, values: plan.values },
    );
  } catch (error) {
    if (error instanceof PromptCancelledError) throw error;
    if (error?.name === "AbortError") throw new PromptCancelledError();
    throw error;
  }
  if (!confirmed) throw new PromptCancelledError();
  return true;
}

export async function executeExecutionPlan(plan, executor, input = {}) {
  if (typeof executor !== "function") {
    throw new CliError("Executor do plano não informado.", {
      code: "PLAN_EXECUTOR_INVALID",
    });
  }
  await confirmExecutionPlan(plan, input);
  return executor(plan, { signal: input.signal });
}

export async function buildExecutionPlan(definition, input = {}) {
  return createExecutionPlan(
    definition,
    await collectWizardValues(definition, input),
  );
}
