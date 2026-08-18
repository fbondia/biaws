import { spawn as nodeSpawn } from "node:child_process";

import { ProcessExecutionError } from "./errors.js";
import { redactText } from "./redaction.js";

function attachOutput(stream, target, chunks, shouldBuffer) {
  if (!stream) return;
  stream.on("data", (chunk) => {
    const value = String(chunk);
    chunks.push(value);
    if (!shouldBuffer && target) target.write(value);
  });
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
    const shouldBuffer =
      Boolean(options.silent) || secrets.some((secret) => String(secret || ""));
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
    attachOutput(child.stdout, this.stdout, stdoutChunks, shouldBuffer);
    attachOutput(child.stderr, this.stderr, stderrChunks, shouldBuffer);
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
      const flush = (result) => {
        if (!shouldBuffer || options.silent) return;
        if (result.stdout && this.stdout) this.stdout.write(result.stdout);
        if (result.stderr && this.stderr) this.stderr.write(result.stderr);
      };

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
        const result = { ...output(), processExitCode, signal: signal || null };
        flush(result);
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
