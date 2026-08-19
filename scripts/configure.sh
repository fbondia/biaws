#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT=""
PROJECT_DIR="${PWD}"
ENV_FILE=""
WORKSPACE_ID=""
FORCE=0

usage() {
  cat <<'EOF'
Uso:
  ./scripts/configure.sh --client codex|claude --env-file <arquivo> [opções]

Opções:
  --project <diretório>  Projeto consumidor; default: diretório atual
  --workspace <id>       Workspace selecionado para este projeto
  --force                Assume a gestão de uma configuração biaws já existente
  --help                  Exibe esta ajuda
EOF
}

require_value() {
  if [[ "$#" -lt 2 || -z "${2}" ]]; then
    echo "A opção ${1} exige um valor." >&2
    usage >&2
    exit 2
  fi
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --client|--project|--env-file|--workspace)
      require_value "$@"
      case "$1" in
        --client) CLIENT="$2" ;;
        --project) PROJECT_DIR="$2" ;;
        --env-file) ENV_FILE="$2" ;;
        --workspace) WORKSPACE_ID="$2" ;;
      esac
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "${CLIENT}" != "codex" && "${CLIENT}" != "claude" ]]; then
  echo "Informe --client codex ou claude." >&2
  exit 2
fi
if [[ ! -d "${PROJECT_DIR}" ]]; then
  echo "Diretório de projeto inexistente: ${PROJECT_DIR}" >&2
  exit 2
fi
if [[ -z "${ENV_FILE}" || ! -f "${ENV_FILE}" ]]; then
  echo "Arquivo de ambiente inexistente: ${ENV_FILE:-<não informado>}" >&2
  exit 2
fi

PROJECT_DIR="$(cd "${PROJECT_DIR}" && pwd -P)"
ENV_FILE="$(cd "$(dirname "${ENV_FILE}")" && pwd -P)/$(basename "${ENV_FILE}")"
args=(workspace agent configure "${CLIENT}" --project "${PROJECT_DIR}")
doctor=(workspace agent doctor "${CLIENT}" --project "${PROJECT_DIR}")
if [[ -n "${WORKSPACE_ID}" ]]; then
  args+=(--workspace "${WORKSPACE_ID}")
  doctor+=(--workspace "${WORKSPACE_ID}")
fi
if [[ "${FORCE}" == "1" ]]; then
  args+=(--force)
fi

BIAWS_ENV_FILE="${ENV_FILE}" "${ROOT_DIR}/scripts/run-biaws-cli.sh" "${args[@]}"
BIAWS_ENV_FILE="${ENV_FILE}" "${ROOT_DIR}/scripts/run-biaws-cli.sh" "${doctor[@]}"
