import assert from "node:assert/strict";
import test from "node:test";

import { createPinnedLookup } from "../src/restTransport.js";

test("REST transport pins the scalar and all-address lookup contracts", () => {
  const destination = { address: "192.0.2.10", family: 4 };
  const lookup = createPinnedLookup(destination);

  lookup("monitor.invalid", { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [destination]);
  });
  lookup("monitor.invalid", {}, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, destination.address);
    assert.equal(family, destination.family);
  });
});
