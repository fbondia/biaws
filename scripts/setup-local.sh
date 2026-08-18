#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTANCE=""
CLIENT=""
PROJECT="${PWD}"
WORKSPACE=""
INSTANCES_DIR="${BIAWS_INSTANCES_DIR:-${ROOT_DIR}/instances}"
FORCE=0
LIST_INSTANCES=0
server_args=()

usage() {
  cat <<'EOF'
Uso:
  ./scripts/setup-local.sh --instance <nome> --client codex|claude [opções]
  ./scripts/setup-local.sh --list-instances

Opções do cliente:
  --project <diretório>  Projeto consumidor; default: diretório atual
  --workspace <id>       Workspace selecionado para este projeto
  --force                Assume a gestão de uma configuração biaws já existente
  --help                 Exibe esta ajuda

As opções de setup-server.sh (portas, storage, rate limiting e bootstrap) também
são aceitas e encaminhadas para a criação da instância local.
EOF
}

require_value() {
  if [[ "$#" -lt 2 || -z "${2}" ]]; then
    echo "A opção ${1} exige um valor." >&2
    usage >&2
    exit 2
  fi
}

normalized_args=()
for argument in "$@"; do
  case "${argument}" in
    --instance=*|--client=*|--project=*|--workspace=*|--instances-dir=*|--public-url=*|--mongo-port=*|--api-port=*|--ui-port=*|--api-rate-limit-max=*|--api-rate-limit-window-seconds=*|--auth-rate-limit-max=*|--auth-rate-limit-window-seconds=*|--api-key-rate-limit-max=*|--api-key-rate-limit-window-seconds=*|--storage-dir=*|--mongo-data-path=*|--issue-files-path=*|--request-files-path=*|--document-files-path=*|--secret-files-path=*)
      option="${argument%%=*}"
      value="${argument#*=}"
      if [[ -z "${value}" ]]; then
        echo "A opção ${option} exige um valor." >&2
        usage >&2
        exit 2
      fi
      normalized_args+=("${option}" "${value}")
      ;;
    *)
      normalized_args+=("${argument}")
      ;;
  esac
done
set -- "${normalized_args[@]}"
unset normalized_args argument option value

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --instance|--client|--project|--workspace|--instances-dir)
      require_value "$@"
      case "$1" in
        --instance) INSTANCE="$2"; server_args+=("$1" "$2") ;;
        --client) CLIENT="$2" ;;
        --project) PROJECT="$2" ;;
        --workspace) WORKSPACE="$2" ;;
        --instances-dir) INSTANCES_DIR="$2"; server_args+=("$1" "$2") ;;
      esac
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --list-instances)
      LIST_INSTANCES=1
      server_args+=("$1")
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      server_args+=("$1")
      shift
      if [[ "$#" -gt 0 && "$1" != --* ]]; then
        server_args+=("$1")
        shift
      fi
      ;;
  esac
done

if [[ "${LIST_INSTANCES}" == "1" ]]; then
  exec "${ROOT_DIR}/scripts/setup-server.sh" "${server_args[@]}"
fi
if [[ -z "${INSTANCE}" || -z "${CLIENT}" ]]; then
  echo "Informe --instance e --client." >&2
  usage >&2
  exit 2
fi

"${ROOT_DIR}/scripts/setup-server.sh" "${server_args[@]}"

configure_args=(
  --client "${CLIENT}"
  --project "${PROJECT}"
  --env-file "${INSTANCES_DIR}/${INSTANCE}/.env"
)
[[ -z "${WORKSPACE}" ]] || configure_args+=(--workspace "${WORKSPACE}")
[[ "${FORCE}" == "0" ]] || configure_args+=(--force)
exec "${ROOT_DIR}/scripts/configure.sh" "${configure_args[@]}"
