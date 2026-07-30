import assert from "node:assert/strict";
import test from "node:test";

import { normalizeIntegrationInput } from "../src/repositories/integrationsRepository.js";

test("integration input normalizes its directional application link", () => {
  assert.deepEqual(
    normalizeIntegrationInput({
      key: " Customer-API ",
      name: " Customer API ",
      description: " Consulta clientes ",
      targetApplicationId: "application-2",
    }),
    {
      key: "customer-api",
      name: "Customer API",
      description: "Consulta clientes",
      targetApplicationId: "application-2",
    },
  );
});

test("integration key and target are immutable", () => {
  const current = {
    key: "customer-api",
    name: "Customer API",
    description: "",
    targetApplicationId: "application-2",
  };
  assert.throws(
    () =>
      normalizeIntegrationInput(
        { name: "Customer API v2", targetApplicationId: "application-3" },
        current,
      ),
    (error) => error.code === "INTEGRATION_TARGET_IMMUTABLE",
  );
  assert.throws(
    () =>
      normalizeIntegrationInput(
        { key: "new-key", targetApplicationId: "application-2" },
        current,
      ),
    (error) => error.code === "CATALOG_KEY_IMMUTABLE",
  );
});
