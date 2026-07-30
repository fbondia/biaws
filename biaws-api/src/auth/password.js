import { Algorithm, hash, verify } from "@node-rs/argon2";

export const ARGON2ID_OPTIONS = Object.freeze({
  algorithm: Algorithm.Argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
});

export async function hashPassword(password) {
  return hash(password, ARGON2ID_OPTIONS);
}

export async function verifyPassword({ hash: passwordHash, password }) {
  return verify(passwordHash, password, ARGON2ID_OPTIONS);
}
