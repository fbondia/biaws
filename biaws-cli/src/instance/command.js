import { Args, Flags } from "@oclif/core";

export const instanceArgument = Args.string({
  description:
    "nome da instância; usa BIAWS_INSTANCE ou a única disponível quando omitido",
  required: false,
});

export const contextFlags = Object.freeze({
  "instances-dir": Flags.string({
    description: "diretório que contém as instâncias",
  }),
  root: Flags.string({ description: "raiz do checkout BIAWS" }),
});

export function contextInput(flags, instance) {
  return {
    instance,
    instancesDirectory: flags["instances-dir"],
    root: flags.root,
  };
}

export function writeResult(command, value, human, json = false) {
  command.output({ json }).result(json ? value : human(value));
}

export function instanceSummary(instance) {
  return [
    `Instância: ${instance.name}`,
    `Diretório: ${instance.directory}`,
    `MongoDB: mongodb://127.0.0.1:${instance.mongoPort}/biaws`,
    `API: http://127.0.0.1:${instance.apiPort}`,
    `UI: ${instance.publicUrl}`,
    `Storage: ${instance.storage}`,
  ].join("\n");
}
