#!/usr/bin/env node

import {
  createCipheriv,
  createDecipheriv,
  pbkdf2,
  randomBytes,
} from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, readFile, unlink } from "node:fs/promises";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("Salted__", "ascii");
const HEADER_BYTES = 16;
const DERIVED_BYTES = 48;
const KEY_BYTES = 32;
const derive = promisify(pbkdf2);

function parseArguments(argv) {
  const [operation, ...rawArgs] = argv;
  if (!["encrypt", "decrypt"].includes(operation)) {
    throw new Error("Use encrypt ou decrypt.");
  }

  const options = {};
  for (let index = 0; index < rawArgs.length; index += 2) {
    const name = rawArgs[index];
    const value = rawArgs[index + 1];
    if (!name?.startsWith("--") || !value) {
      throw new Error(`Argumento inválido: ${name || "<vazio>"}`);
    }
    options[name.slice(2)] = value;
  }

  for (const required of ["input", "output", "password-file", "iterations"]) {
    if (!options[required]) throw new Error(`Opção ausente: --${required}`);
  }
  const iterations = Number(options.iterations);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) {
    throw new Error("--iterations deve ser um inteiro de pelo menos 100000.");
  }
  return { operation, options, iterations };
}

async function readPassword(file) {
  const contents = await readFile(file, "utf8");
  const password = Buffer.from(contents.split(/\r?\n/u, 1)[0], "utf8");
  if (password.length === 0) throw new Error("A senha não pode ser vazia.");
  return password;
}

async function deriveKeyAndIv(password, salt, iterations) {
  const material = await derive(
    password,
    salt,
    iterations,
    DERIVED_BYTES,
    "sha256",
  );
  return {
    iv: material.subarray(KEY_BYTES),
    key: material.subarray(0, KEY_BYTES),
    material,
  };
}

async function writePrefix(stream, prefix) {
  await new Promise((resolve, reject) => {
    stream.write(prefix, (error) => (error ? reject(error) : resolve()));
  });
}

async function encrypt({ input, output, password, iterations }) {
  const salt = randomBytes(8);
  const { key, iv, material } = await deriveKeyAndIv(
    password,
    salt,
    iterations,
  );
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const outputStream = createWriteStream(output, {
    flags: "wx",
    mode: 0o600,
  });
  try {
    await writePrefix(outputStream, Buffer.concat([MAGIC, salt]));
    await pipeline(createReadStream(input), cipher, outputStream);
  } finally {
    material.fill(0);
    salt.fill(0);
  }
}

async function readSalt(input) {
  const handle = await open(input, "r");
  try {
    const header = Buffer.alloc(HEADER_BYTES);
    const { bytesRead } = await handle.read(header, 0, HEADER_BYTES, 0);
    if (bytesRead !== HEADER_BYTES || !header.subarray(0, 8).equals(MAGIC)) {
      throw new Error("Cabeçalho do backup criptografado é inválido.");
    }
    return header.subarray(8);
  } finally {
    await handle.close();
  }
}

async function decrypt({ input, output, password, iterations }) {
  const salt = await readSalt(input);
  const { key, iv, material } = await deriveKeyAndIv(
    password,
    salt,
    iterations,
  );
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  try {
    await pipeline(
      createReadStream(input, { start: HEADER_BYTES }),
      decipher,
      createWriteStream(output, { flags: "wx", mode: 0o600 }),
    );
  } finally {
    material.fill(0);
    salt.fill(0);
  }
}

let output = "";
try {
  const { operation, options, iterations } = parseArguments(
    process.argv.slice(2),
  );
  output = options.output;
  const password = await readPassword(options["password-file"]);
  try {
    const parameters = {
      input: options.input,
      output,
      password,
      iterations,
    };
    if (operation === "encrypt") await encrypt(parameters);
    else await decrypt(parameters);
  } finally {
    password.fill(0);
  }
} catch (error) {
  if (output) await unlink(output).catch(() => {});
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
