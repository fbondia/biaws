export class CliError extends Error {
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = "CliError";
    this.code = options.code || "CLI_ERROR";
    this.exitCode = options.exitCode ?? 1;
    this.oclif = { exit: this.exitCode };
    this.details = options.details;
  }
}

export class ProcessExecutionError extends CliError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || "PROCESS_EXECUTION_FAILED",
      exitCode: options.exitCode ?? 1,
    });
    this.name = "ProcessExecutionError";
    this.command = options.command;
    this.processExitCode = options.processExitCode ?? null;
    this.signal = options.signal ?? null;
    this.stderr = options.stderr || "";
  }
}
