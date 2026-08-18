import { confirm, input, number, password, select } from "@inquirer/prompts";

import { CliError } from "./errors.js";

export class PromptCancelledError extends CliError {
  constructor(
    message = "Operação cancelada antes de qualquer alteração.",
    options = {},
  ) {
    super(message, {
      ...options,
      code: "PROMPT_CANCELLED",
      exitCode: options.exitCode ?? 130,
    });
    this.name = "PromptCancelledError";
  }
}

function isPromptCancellation(error) {
  return (
    error?.name === "ExitPromptError" ||
    error?.name === "AbortPromptError" ||
    error?.name === "AbortError"
  );
}

export class PromptAdapter {
  constructor(options = {}) {
    this.isInteractive = Boolean(options.isInteractive);
  }

  async ask() {
    throw new CliError("O adapter de prompt não implementa ask().", {
      code: "PROMPT_ADAPTER_INVALID",
    });
  }
}

export class InteractivePromptAdapter extends PromptAdapter {
  constructor(options = {}) {
    super({ isInteractive: true });
    this.prompts = options.prompts || {
      confirm,
      input,
      number,
      password,
      select,
    };
    this.context = options.context || {};
  }

  async ask(question, state = {}) {
    const handler = this.prompts[question.type || "input"];
    if (!handler) {
      throw new CliError(`Tipo de pergunta não suportado: ${question.type}.`, {
        code: "PROMPT_TYPE_UNSUPPORTED",
        exitCode: 2,
      });
    }
    const config = {
      message: question.message || question.name,
      ...(question.choices ? { choices: question.choices } : {}),
      ...(Object.hasOwn(question, "default")
        ? { default: question.default }
        : {}),
    };
    try {
      return await handler(config, {
        ...this.context,
        signal: state.signal || this.context.signal,
      });
    } catch (error) {
      if (isPromptCancellation(error)) throw new PromptCancelledError();
      throw error;
    }
  }
}

export class NonInteractivePromptAdapter extends PromptAdapter {
  constructor() {
    super({ isInteractive: false });
  }

  async ask() {
    throw new CliError(
      "Não é possível solicitar entrada sem terminal interativo.",
      {
        code: "INTERACTIVE_INPUT_UNAVAILABLE",
        exitCode: 2,
      },
    );
  }
}

export class ProgrammedPromptAdapter extends PromptAdapter {
  constructor(responses = {}, options = {}) {
    super({ isInteractive: options.isInteractive ?? true });
    this.responses = Array.isArray(responses)
      ? [...responses]
      : { ...responses };
    this.questions = [];
  }

  async ask(question, state = {}) {
    this.questions.push(question.name);
    let response;
    if (Array.isArray(this.responses)) {
      if (this.responses.length === 0) {
        throw new CliError(
          `Resposta programada ausente para ${question.name}.`,
          {
            code: "PROGRAMMED_RESPONSE_MISSING",
          },
        );
      }
      response = this.responses.shift();
    } else if (Object.hasOwn(this.responses, question.name)) {
      response = this.responses[question.name];
    } else {
      throw new CliError(`Resposta programada ausente para ${question.name}.`, {
        code: "PROGRAMMED_RESPONSE_MISSING",
      });
    }
    if (typeof response === "function")
      response = await response(question, state);
    if (response instanceof Error) throw response;
    return response;
  }
}

export function createPromptAdapter(terminal, options = {}) {
  if (options.adapter) return options.adapter;
  if (!terminal?.isInteractive) return new NonInteractivePromptAdapter();
  return new InteractivePromptAdapter({
    context: { input: terminal.stdin, output: terminal.stdout },
    prompts: options.prompts,
  });
}
