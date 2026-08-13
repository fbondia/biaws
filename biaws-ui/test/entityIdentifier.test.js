import assert from "node:assert/strict";
import test from "node:test";

import { copyIdentifier } from "../src/components/shared/EntityIdentifier/model.js";

test("copyIdentifier writes the provided identifier to the clipboard", async () => {
  const copied = [];
  const previousNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        async writeText(value) {
          copied.push(value);
        },
      },
    },
  });

  try {
    assert.equal(await copyIdentifier("DOC-42"), true);
    assert.deepEqual(copied, ["DOC-42"]);
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: previousNavigator,
    });
  }
});

test("copyIdentifier reports when the clipboard API is unavailable", async () => {
  const previousNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });

  try {
    assert.equal(await copyIdentifier("DOC-42"), false);
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: previousNavigator,
    });
  }
});
