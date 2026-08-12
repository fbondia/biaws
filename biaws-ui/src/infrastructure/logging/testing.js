import { defineLoggingTransport } from "./contract.js";

export function createFakeLoggingTransport({ failure } = {}) {
  const records = [];
  return Object.freeze({
    records,
    transport: defineLoggingTransport({
      write(record) {
        if (failure) throw failure;
        records.push(record);
      },
    }),
  });
}
