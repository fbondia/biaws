#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTANCES_DIR="${BIAWS_INSTANCES_DIR:-${ROOT_DIR}/instances}"
INSTANCE=""
DELETE_EXTERNAL_DATA=0
ASSUME_YES=0

usage() {
  cat <<'EOF'
Uso:
  ./scripts/remove-instance.sh --instance <nome> [opções]

Opções:
  --instance <nome>          Instância a remover
  --instances-dir <dir>      Diretório de instâncias; default: ./instances
  --delete-external-data     Apaga também dados configurados fora da instância
  --yes, -y                  Não solicita confirmação interativa
  --help, -h                 Exibe esta ajuda

Por padrão, remove containers, rede, volumes Docker nomeados e o diretório da
instância. Bind mounts e chaves fora desse diretório são preservados, a menos
que --delete-external-data seja informado.
EOF
}

require_value() {
  if [[ "$#" -lt 2 || -z "${2}" ]]; then
    echo "A opção ${1} exige um valor." >&2
    usage >&2
    exit 2
  fi
}

read_env_value() {
  local env_file="$1"
  local key="$2"
  awk -F= -v key="${key}" '
    $1 == key { print substr($0, index($0, "=") + 1) }
  ' "${env_file}" | tail -n 1
}

contains_path() {
  local candidate="$1"
  local existing
  for existing in "${MANAGED_PATHS[@]:-}"; do
    [[ "${existing}" == "${candidate}" ]] && return 0
  done
  return 1
}

add_managed_path() {
  local key="$1"
  local value
  value="$(read_env_value "${ENV_FILE}" "${key}")"
  [[ -n "${value}" ]] || return 0

  if [[ "${value}" != /* ]]; then
    value="${ROOT_DIR}/${value}"
  fi
  if [[ -e "${value}" ]]; then
    if [[ -d "${value}" ]]; then
      value="$(cd "${value}" && pwd -P)"
    else
      value="$(cd "$(dirname "${value}")" && pwd -P)/$(basename "${value}")"
    fi
  fi
  contains_path "${value}" || MANAGED_PATHS+=("${value}")
}

is_within_instance() {
  local value="${1%/}"
  [[ "${value}" == "${INSTANCE_DIR}" || "${value}" == "${INSTANCE_DIR}/"* ]]
}

validate_external_delete_target() {
  local value="${1%/}"
  local protected
  if [[ -z "${value}" || "${value}" != /* || "${value}" == "/" ]]; then
    echo "Destino externo inseguro recusado: ${value:-<vazio>}" >&2
    exit 1
  fi
  for protected in "${ROOT_DIR}" "${INSTANCES_DIR}" "${HOME:-}"; do
    [[ -n "${protected}" ]] || continue
    protected="${protected%/}"
    if [[ "${value}" == "${protected}" ||
      "${ROOT_DIR}" == "${value}/"* ||
      "${INSTANCES_DIR}" == "${value}/"* ]]; then
      echo "Destino externo amplo demais; remoção recusada: ${value}" >&2
      exit 1
    fi
  done
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --instance|--instances-dir)
      require_value "$@"
      ;;
  esac
  case "$1" in
    --instance)
      INSTANCE="${2:-}"
      shift 2
      ;;
    --instances-dir)
      INSTANCES_DIR="${2:-}"
      shift 2
      ;;
    --delete-external-data)
      DELETE_EXTERNAL_DATA=1
      shift
      ;;
    --yes|-y)
      ASSUME_YES=1
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

if [[ -z "${INSTANCE}" ]]; then
  echo "Informe --instance <nome>." >&2
  usage >&2
  exit 2
fi
if [[ ! "${INSTANCE}" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then
  echo "Nome de instância inválido: use letras minúsculas, números e hífens." >&2
  exit 2
fi
if [[ ! -d "${INSTANCES_DIR}" ]]; then
  echo "Diretório de instâncias não encontrado: ${INSTANCES_DIR}" >&2
  exit 1
fi
INSTANCES_DIR="$(cd "${INSTANCES_DIR}" && pwd -P)"
INSTANCE_DIR="${INSTANCES_DIR}/${INSTANCE}"
ENV_FILE="${INSTANCE_DIR}/.env"
if [[ -L "${INSTANCE_DIR}" ]]; then
  echo "Diretórios de instância simbólicos não podem ser removidos: ${INSTANCE_DIR}" >&2
  exit 1
fi
if [[ ! -d "${INSTANCE_DIR}" || ! -f "${ENV_FILE}" ]]; then
  echo "Instância não encontrada: ${INSTANCE}" >&2
  exit 1
fi

MANAGED_PATHS=()
for key in \
  BIAWS_MONGO_DATA_PATH \
  BIAWS_ISSUE_FILES_PATH \
  BIAWS_REQUEST_FILES_PATH \
  BIAWS_DOCUMENT_FILES_PATH \
  BIAWS_PROCEDURE_FILES_PATH \
  BIAWS_SECRET_FILES_PATH \
  BIAWS_MONITOR_SECRET_FILES_PATH \
  BIAWS_SECRETS_KEY_PATH \
  BIAWS_SECRETS_KEY_FILE; do
  add_managed_path "${key}"
done

EXTERNAL_PATHS=()
for path in "${MANAGED_PATHS[@]:-}"; do
  [[ -n "${path}" ]] || continue
  is_within_instance "${path}" || EXTERNAL_PATHS+=("${path}")
done

cat <<EOF
Instância a remover: ${INSTANCE}
Diretório:          ${INSTANCE_DIR}
Projeto Compose:    biaws-${INSTANCE}
EOF
if [[ "${#EXTERNAL_PATHS[@]}" -gt 0 ]]; then
  if [[ "${DELETE_EXTERNAL_DATA}" == "1" ]]; then
    echo "Dados externos que também serão apagados:"
  else
    echo "Dados externos que serão preservados:"
  fi
  printf '  %s\n' "${EXTERNAL_PATHS[@]}"
fi

if [[ "${ASSUME_YES}" != "1" ]]; then
  if [[ ! -t 0 ]]; then
    echo "Remoção recusada sem terminal interativo; use --yes para confirmar." >&2
    exit 2
  fi
  echo
  read -r -p "Digite o nome da instância (${INSTANCE}) para confirmar: " confirmation
  if [[ "${confirmation}" != "${INSTANCE}" ]]; then
    echo "Remoção cancelada." >&2
    exit 2
  fi
fi

if [[ "${DELETE_EXTERNAL_DATA}" == "1" ]]; then
  for path in "${EXTERNAL_PATHS[@]:-}"; do
    [[ -n "${path}" ]] || continue
    validate_external_delete_target "${path}"
  done
fi

docker compose \
  --project-directory "${ROOT_DIR}" \
  --file "${ROOT_DIR}/compose.yaml" \
  --env-file "${ENV_FILE}" \
  --project-name "biaws-${INSTANCE}" \
  down --volumes --remove-orphans

if [[ "${DELETE_EXTERNAL_DATA}" == "1" ]]; then
  for path in "${EXTERNAL_PATHS[@]:-}"; do
    [[ -n "${path}" && -e "${path}" ]] || continue
    rm -rf -- "${path}"
    echo "Dados externos removidos: ${path}"
  done
fi

rm -rf -- "${INSTANCE_DIR}"
if [[ "${#EXTERNAL_PATHS[@]}" -gt 0 && "${DELETE_EXTERNAL_DATA}" != "1" ]]; then
  echo "Instância removida: ${INSTANCE}"
  echo "Os dados externos listados acima foram preservados."
else
  echo "Instância removida completamente: ${INSTANCE}"
fi
