#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_DIR="${ROOT_DIR}/biaws-cli"
ENTRYPOINT="${CLI_DIR}/bin/biaws.js"

if [[ ! -x "${ENTRYPOINT}" ]]; then
  echo "Binário local do BIAWS CLI ausente ou sem permissão de execução: ${ENTRYPOINT}" >&2
  exit 1
fi

if [[ ! -d "${CLI_DIR}/node_modules/@oclif/core" || ! -d "${CLI_DIR}/node_modules/@inquirer/prompts" ]]; then
  command -v npm >/dev/null || {
    echo "npm não encontrado; instale Node.js 20.19 ou superior." >&2
    exit 1
  }
  echo "Instalando dependências de produção do BIAWS CLI..." >&2
  npm --prefix "${CLI_DIR}" ci --omit=dev
fi

BIAWS_ROOT="${ROOT_DIR}" exec "${ENTRYPOINT}" "$@"
