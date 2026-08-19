#!/usr/bin/env node

import { execute } from "@oclif/core";

const args = process.argv.slice(2);

await execute({
  args: args.length ? args : ["help"],
  dir: import.meta.url,
});
