import { redactText, redactValue } from "./redaction.js";

function writeLine(stream, value) {
  stream.write(`${value}\n`);
}

export function createTerminalAdapter(options = {}) {
  const stdin = options.stdin || process.stdin;
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const environment = options.environment || process.env;
  return Object.freeze({
    stdin,
    stdout,
    stderr,
    isInteractive: Boolean(stdin.isTTY && stdout.isTTY),
    isCI: Boolean(environment.CI),
  });
}

export class CliOutput {
  constructor(terminal, options = {}) {
    this.terminal = terminal;
    this.json = Boolean(options.json);
    this.secrets = options.secrets || [];
  }

  result(value) {
    if (this.json) {
      writeLine(
        this.terminal.stdout,
        JSON.stringify(redactValue(value, this.secrets), null, 2),
      );
      return;
    }
    writeLine(this.terminal.stdout, redactText(value, this.secrets));
  }

  diagnostic(value) {
    writeLine(this.terminal.stderr, redactText(value, this.secrets));
  }
}

export class CliLogger {
  constructor(terminal, options = {}) {
    this.terminal = terminal;
    this.secrets = options.secrets || [];
    this.verbose = Boolean(options.verbose);
  }

  event(level, event, fields = {}) {
    if (level === "debug" && !this.verbose) return;
    const entry = redactValue({ ...fields, level, event }, this.secrets);
    writeLine(this.terminal.stderr, JSON.stringify(entry));
  }

  debug(event, fields) {
    this.event("debug", event, fields);
  }

  info(event, fields) {
    this.event("info", event, fields);
  }

  warn(event, fields) {
    this.event("warn", event, fields);
  }

  error(event, fields) {
    this.event("error", event, fields);
  }
}
