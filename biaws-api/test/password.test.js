import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword, verifyPassword } from "../src/auth/password.js";

test("Argon2id hashes and verifies a password without storing plaintext", async () => {
  const password = "uma senha de teste longa";
  const passwordHash = await hashPassword(password);

  assert.match(passwordHash, /^\$argon2id\$/u);
  assert.equal(passwordHash.includes(password), false);
  assert.equal(await verifyPassword({ hash: passwordHash, password }), true);
  assert.equal(
    await verifyPassword({ hash: passwordHash, password: "senha incorreta" }),
    false,
  );
});
