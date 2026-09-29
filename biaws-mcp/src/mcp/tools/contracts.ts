import type { FromSchema } from "json-schema-to-ts";
import type { toolDefinitions } from "./toolCatalog.js";

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Schema & {
    readonly type: "object";
    readonly properties: Readonly<Record<string, Schema>>;
  };
}
export type ToolName = (typeof toolDefinitions)[number]["name"];
export type ToolArguments<Name extends ToolName> = FromSchema<
  Extract<(typeof toolDefinitions)[number], { readonly name: Name }>["inputSchema"]
>;
export type ServiceArguments<Name extends ToolName> = Partial<ToolArguments<Name>>;
export type ToolHandler = (args: unknown) => unknown;
export interface Schema {
  readonly type?: string | readonly string[];
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly properties?: Readonly<Record<string, Schema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | Schema;
  readonly items?: Schema;
  readonly oneOf?: readonly Schema[];
  readonly not?: Schema;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly pattern?: string;
  readonly uniqueItems?: boolean;
  readonly default?: unknown;
  readonly format?: string;
  readonly maxProperties?: number;
}
