import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";

import { ProcessRunner } from "../src/core/processRunner.js";

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.killed = false;
  child.kill = (signal) => {
    child.killed = true;
    child.forwardedSignal = signal;
  };
  return child;
}

test("ProcessRunner uses separated arguments and redacts streams and errors", async () => {
  const child = fakeChild();
  let spawnCall;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let writtenOut = "";
  let writtenError = "";
  stdout.on("data", (chunk) => (writtenOut += chunk));
  stderr.on("data", (chunk) => (writtenError += chunk));
  const runner = new ProcessRunner({
    spawn(command, args, options) {
      spawnCall = { command, args, options };
      return child;
    },
    signalSource: new EventEmitter(),
    stdout,
    stderr,
  });
  const execution = runner.run("tool", ["--token", "private-key"], {
    secrets: ["private-key"],
  });
  child.stdout.write("using private-key");
  child.stderr.write("failed private-key");
  child.emit("close", 3, null);

  await assert.rejects(execution, (error) => {
    assert.equal(error.processExitCode, 3);
    assert.doesNotMatch(error.message, /private-key/u);
    assert.doesNotMatch(error.stderr, /private-key/u);
    return true;
  });
  assert.deepEqual(spawnCall.args, ["--token", "private-key"]);
  assert.equal(spawnCall.options.shell, false);
  assert.equal(writtenOut, "using [REDACTED]");
  assert.equal(writtenError, "failed [REDACTED]");
});

test("ProcessRunner forwards parent signals and reports child signal", async () => {
  const child = fakeChild();
  const signalSource = new EventEmitter();
  const runner = new ProcessRunner({
    spawn: () => child,
    signalSource,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  const execution = runner.run("tool", []);

  signalSource.emit("SIGTERM");
  assert.equal(child.forwardedSignal, "SIGTERM");
  child.emit("close", null, "SIGTERM");
  await assert.rejects(execution, (error) => {
    assert.equal(error.signal, "SIGTERM");
    assert.match(error.message, /SIGTERM/u);
    return true;
  });
  assert.equal(signalSource.listenerCount("SIGTERM"), 0);
});
