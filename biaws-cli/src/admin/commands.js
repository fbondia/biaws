import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

import { Flags } from "@oclif/core";

import { BaseCommand, LocalInstanceCommand } from "../baseCommands.js";
import { CliError } from "../core/errors.js";

function emit(command, json, value, human) {
  command.output({ json }).result(json ? value : human);
}

export class AdminConfigCommand extends LocalInstanceCommand {
  static description = "exibe os caminhos da instalação administrativa";
  static flags = {
    root: Flags.string({ description: "raiz da instalação" }),
    json: Flags.boolean({ description: "emite somente JSON em stdout" }),
  };

  async run() {
    const { flags } = await this.parse(this.constructor);
    const context = await this.localContext({ root: flags.root });
    const result = {
      instancesDirectory: context.instancesDirectory,
      repositoryRoot: context.repositoryRoot,
      toolDirectory: context.toolDirectory,
    };
    emit(
      this,
      flags.json,
      result,
      [
        `Raiz da instalação: ${result.repositoryRoot}`,
        `Diretório de instâncias: ${result.instancesDirectory}`,
        `Diretório do CLI: ${result.toolDirectory}`,
      ].join("\n"),
    );
  }
}

export class AdminDoctorCommand extends BaseCommand {
  static description = "diagnostica os pré-requisitos administrativos";
  static flags = {
    json: Flags.boolean({ description: "emite somente JSON em stdout" }),
  };

  async run() {
    const { flags } = await this.parse(this.constructor);
    const checks = [
      { name: "Node.js", command: "node", args: ["--version"] },
      { name: "Git", command: "git", args: ["--version"] },
      { name: "Docker", command: "docker", args: ["--version"] },
      {
        name: "Docker Compose",
        command: "docker",
        args: ["compose", "version"],
      },
    ];
    const items = [];
    for (const check of checks) {
      try {
        const result = await this.adapters.processRunner.run(
          check.command,
          check.args,
          { silent: true },
        );
        items.push({
          name: check.name,
          status: "disponível",
          version: result.stdout.trim(),
        });
      } catch (error) {
        items.push({
          name: check.name,
          status: "ausente",
          error: error.message,
        });
      }
    }
    const healthy = items.every((item) => item.status === "disponível");
    if (!healthy) process.exitCode = 1;
    emit(
      this,
      flags.json,
      { healthy, items },
      items
        .map(
          (item) =>
            `${item.name}: ${item.status}${item.version ? ` (${item.version})` : ""}`,
        )
        .join("\n"),
    );
  }
}

function githubArchive(repository, version) {
  const base = String(repository).replace(/\/+$/u, "");
  return `${base}/releases/download/v${version}/biaws-${version}.tar.gz`;
}

async function ensureEmptyDirectory(filesystem, directory) {
  try {
    const entries = await filesystem.readdir(directory);
    if (entries.length) {
      throw new CliError(
        `O diretório de destino não está vazio: ${directory}.`,
        {
          code: "INSTALL_DIRECTORY_NOT_EMPTY",
          exitCode: 2,
        },
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await filesystem.mkdir(directory, { recursive: true });
  }
}

async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new CliError(`Falha ao baixar ${url}: HTTP ${response.status}.`, {
      code: "INSTALL_DOWNLOAD_FAILED",
    });
  }
  return Buffer.from(await response.arrayBuffer());
}

async function expectedChecksum(url, explicit) {
  if (explicit) return explicit.toLocaleLowerCase("en-US");
  const response = await fetch(`${url}.sha256`);
  if (!response.ok) {
    throw new CliError(
      "A release não possui checksum publicado. Informe --checksum somente após verificar a origem do arquivo.",
      { code: "INSTALL_CHECKSUM_REQUIRED" },
    );
  }
  return (await response.text())
    .trim()
    .split(/\s+/u)[0]
    .toLocaleLowerCase("en-US");
}

export class AdminInstallCommand extends BaseCommand {
  static description = "baixa uma release verificada da plataforma BIAWS";
  static flags = {
    version: Flags.string({ description: "versão da release" }),
    repository: Flags.string({
      description: "repositório de origem",
      default: "https://github.com/fbondia/biaws",
    }),
    directory: Flags.string({ char: "d", description: "diretório de destino" }),
    checksum: Flags.string({ description: "SHA-256 verificado da release" }),
    "dry-run": Flags.boolean({
      description: "exibe o plano sem baixar arquivos",
    }),
    json: Flags.boolean({ description: "emite somente JSON em stdout" }),
  };

  async run() {
    const { flags } = await this.parse(this.constructor);
    const version = flags.version || this.config.version;
    const directory = path.resolve(
      flags.directory || path.join(this.adapters.cwd(), `biaws-${version}`),
    );
    const url = githubArchive(flags.repository, version);
    const plan = { directory, source: url, version };
    if (flags["dry-run"]) {
      emit(
        this,
        flags.json,
        { ...plan, dryRun: true },
        `Release v${version}\nOrigem: ${url}\nDestino: ${directory}`,
      );
      return;
    }
    await ensureEmptyDirectory(this.adapters.filesystem, directory);
    const archive = await fetchBuffer(url);
    const checksum = await expectedChecksum(url, flags.checksum);
    const actual = createHash("sha256").update(archive).digest("hex");
    if (actual !== checksum) {
      throw new CliError(
        `Checksum inválido: esperado ${checksum}, obtido ${actual}.`,
        { code: "INSTALL_CHECKSUM_MISMATCH" },
      );
    }
    const temporary = await this.adapters.filesystem.mkdtemp(
      path.join(tmpdir(), "biaws-install-"),
    );
    const archivePath = path.join(temporary, "biaws.tar.gz");
    try {
      await this.adapters.filesystem.writeFile(archivePath, archive);
      await this.adapters.processRunner.run("tar", [
        "-xzf",
        archivePath,
        "--strip-components=1",
        "-C",
        directory,
      ]);
    } finally {
      await this.adapters.filesystem.rm(temporary, {
        recursive: true,
        force: true,
      });
    }
    emit(
      this,
      flags.json,
      { ...plan, checksum, installed: true },
      `BIAWS v${version} instalado em ${directory}.\nPróximo passo: biaws admin instance setup --root ${directory}`,
    );
  }
}
