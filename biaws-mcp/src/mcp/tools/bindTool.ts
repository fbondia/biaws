import type {
  ServiceArguments,
  ToolArguments,
  ToolHandler,
  ToolName,
} from "./contracts.js";
import { toolDefinitions } from "./toolCatalog.js";
import { validateArguments } from "./validation.js";
function assertArguments<N extends ToolName>(
  name: N,
  args: unknown,
): asserts args is ToolArguments<N> {
  const definition = toolDefinitions.find((tool) => tool.name === name);
  if (!definition) throw new Error(`Unknown tool: ${name}`);
  validateArguments(definition, args);
}
export function bindTool<N extends ToolName>(
  name: N,
  handler: (args: ServiceArguments<N>) => unknown,
): ToolHandler {
  return (args) => {
    assertArguments(name, args);
    return handler(args);
  };
}
