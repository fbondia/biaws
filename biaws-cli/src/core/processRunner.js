import { spawn as nodeSpawn } from "node:child_process";

import { ProcessExecutionError } from "./errors.js";
import { redactText } from "./redaction.js";

function attachOutput(stream, target, chunks, options = {}) {
  if (!stream) return () => {};
  const secrets = options.secrets || [];
  let pending = "";

  const writeSanitizedLines = (value) => {
    pending += value;
    const lastNewline = pending.lastIndexOf("\n");
    if (lastNewline < 0) return;
    target?.write(redactText(pending.slice(0, lastNewline + 1), secrets));
    pending = pending.slice(lastNewline + 1);
  };

  stream.on("data", (chunk) => {
    const value = String(chunk);
    chunks.push(value);
    if (options.silent || !target) return;
    if (secrets.length) writeSanitizedLines(value);
    else target.write(value);
  });

  return () => {
    if (!options.silent && target && pending)
      target.write(redactText(pending, secrets));
    pending = "";
  };
}

export class ProcessRunner {
  constructor(options = {}) {
    this.spawn = options.spawn || nodeSpawn;
    this.signalSource = options.signalSource || process;
    this.stdout = options.stdout || process.stdout;
    this.stderr = options.stderr || process.stderr;
  }

  run(command, args = [], options = {}) {
    if (typeof command !== "string" || !command || !Array.isArray(args)) {
      throw new TypeError("ProcessRunner exige comando e array de argumentos.");
    }
    const secrets = options.secrets || [];
    const stdoutChunks = [];
    const stderrChunks = [];
    let child;
    try {
      child = this.spawn(command, args.map(String), {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        stdio: [
          options.input === undefined ? "ignore" : "pipe",
          "pipe",
          "pipe",
        ],
      });
    } catch (cause) {
      throw new ProcessExecutionError(
        `Falha ao iniciar ${redactText(command, secrets)}.`,
        { cause, command: redactText(command, secrets) },
      );
    }
    const flushStdout = attachOutput(child.stdout, this.stdout, stdoutChunks, {
      secrets,
      silent: Boolean(options.silent),
    });
    const flushStderr = attachOutput(child.stderr, this.stderr, stderrChunks, {
      secrets,
      silent: Boolean(options.silent),
    });
    if (options.input !== undefined) child.stdin.end(options.input);

    return new Promise((resolve, reject) => {
      const forwardedSignals = ["SIGINT", "SIGTERM", "SIGHUP"];
      const handlers = new Map(
        forwardedSignals.map((signal) => [
          signal,
          () => {
            if (!child.killed) child.kill(signal);
          },
        ]),
      );
      for (const [signal, handler] of handlers) {
        this.signalSource.on?.(signal, handler);
      }
      const cleanup = () => {
        for (const [signal, handler] of handlers) {
          this.signalSource.off?.(signal, handler);
        }
      };
      const output = () => ({
        stdout: redactText(stdoutChunks.join(""), secrets),
        stderr: redactText(stderrChunks.join(""), secrets),
      });
      child.once("error", (cause) => {
        cleanup();
        reject(
          new ProcessExecutionError(
            `Falha ao iniciar ${redactText(command, secrets)}.`,
            { cause, command: redactText(command, secrets) },
          ),
        );
      });
      child.once("close", (processExitCode, signal) => {
        cleanup();
        flushStdout();
        flushStderr();
        const result = { ...output(), processExitCode, signal: signal || null };
        if (processExitCode === 0 && !signal) {
          resolve(result);
          return;
        }
        const renderedCommand = redactText(
          [command, ...args].join(" "),
          secrets,
        );
        reject(
          new ProcessExecutionError(
            signal
              ? `Processo interrompido por ${signal}: ${renderedCommand}`
              : `Processo encerrou com código ${processExitCode}: ${renderedCommand}`,
            {
              command: renderedCommand,
              processExitCode,
              signal,
              stderr: result.stderr,
            },
          ),
        );
      });
    });
  }
}
