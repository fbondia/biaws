export function parseArgs(rawArgs) {
  const positional = [];
  const options = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index];
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const separator = argument.indexOf("=");
    if (separator !== -1) {
      options[argument.slice(2, separator)] = argument.slice(separator + 1);
      continue;
    }
    const key = argument.slice(2);
    const next = rawArgs[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return { positional, options };
}
