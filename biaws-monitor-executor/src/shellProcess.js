import { spawn } from "node:child_process";

import { truncateBuffer } from "./providerSupport.js";

function stopProcess(child, signal = "SIGTERM") {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") child.kill(signal);
  }
}

export function executeShellProcess(
  command,
  args,
  options,
  signal,
  evidenceLimit,
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let aborted = false;
    let forceTimer;
    const collect = (target, counter) => (rawChunk) => {
      const chunk = Buffer.isBuffer(rawChunk)
        ? rawChunk
        : Buffer.from(rawChunk);
      const used = counter === "stdout" ? stdoutBytes : stderrBytes;
      if (used < evidenceLimit)
        target.push(chunk.subarray(0, evidenceLimit - used));
      if (counter === "stdout") stdoutBytes += chunk.length;
      else stderrBytes += chunk.length;
    };
    child.stdout.on("data", collect(stdout, "stdout"));
    child.stderr.on("data", collect(stderr, "stderr"));
    const abort = () => {
      aborted = true;
      stopProcess(child);
      forceTimer = setTimeout(() => stopProcess(child, "SIGKILL"), 1_000);
      forceTimer.unref?.();
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    child.on("error", reject);
    child.on("close", (code, childSignal) => {
      clearTimeout(forceTimer);
      signal?.removeEventListener("abort", abort);
      if (aborted)
        return reject(signal?.reason || new Error("Shell provider aborted"));
      resolve({
        code,
        signal: childSignal,
        stdout: truncateBuffer(stdout, evidenceLimit),
        stderr: truncateBuffer(stderr, evidenceLimit),
        stdoutBytes,
        stderrBytes,
      });
    });
  });
}
