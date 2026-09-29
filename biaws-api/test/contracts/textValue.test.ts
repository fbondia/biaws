import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";
import { textValue } from "../../src/helpers/text.js";

test("text normalization preserves scalars, dates, lists and Mongo IDs", () => {
  const id = new ObjectId("000000000000000000000001");
  const date = new Date("2026-01-01T00:00:00Z");
  for (const value of ["", "example", 0, false, 42, 12n, null, undefined, date, id, ["a", null, "b"]]) {
    assert.equal(textValue(value), String(value));
  }
});

test("text normalization rejects object labels without exposing input", () => {
  for (const value of [{ token: "synthetic-private-value" }, [{ id: "nested" }], Object.create(null)]) {
    assert.throws(
      () => textValue(value),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.statusCode, 422);
        assert.equal(error.code, "INVALID_TEXT_VALUE");
        assert.equal(error.message, "Expected a scalar text value");
        return true;
      },
    );
  }
});
