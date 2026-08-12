import { defineLoggingTransport } from "./contract.js";

export function createConsoleTransport({ consoleRef = console } = {}) {
  return defineLoggingTransport({
    write(record) {
      const method = record.level === "debug" ? "debug" : record.level;
      const write = consoleRef[method] || consoleRef.log;
      write.call(consoleRef, record);
    },
  });
}
