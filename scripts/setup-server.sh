#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTANCES_DIR="${BIAWS_INSTANCES_DIR:-${ROOT_DIR}/instances}"
PUBLIC_URL=""
INSTANCE=""
MONGO_PORT=""
API_PORT=""
UI_PORT=""
API_RATE_LIMIT_MAX=""
API_RATE_LIMIT_WINDOW=""
AUTH_RATE_LIMIT_MAX=""
AUTH_RATE_LIMIT_WINDOW=""
API_KEY_RATE_LIMIT_MAX=""
API_KEY_RATE_LIMIT_WINDOW=""
DISABLE_RATE_LIMIT=0
STORAGE_DIR=""
MONGO_DATA_PATH=""
ISSUE_FILES_PATH=""
REQUEST_FILES_PATH=""
DOCUMENT_FILES_PATH=""
SECRET_FILES_PATH=""
USE_DOCKER_VOLUMES=0
SKIP_BOOTSTRAP=0
LIST_INSTANCES=0

usage() {
  cat <<'EOF'
Uso:
  ./scripts/setup-server.sh --instance <nome> [--public-url <https://host>] [opções]
  ./scripts/setup-server.sh --list-instances

Opções:
  --instance <nome>          Instância a criar ou selecionar
  --public-url <url>         Origem pública da UI; default: http://localhost:<porta-ui>
  --mongo-port <porta>       Porta externa do MongoDB; automática para instância nova
  --api-port <porta>         Porta da API; automática para instância nova
  --ui-port <porta>          Porta da UI; automática para instância nova
  --api-rate-limit-max <n>   Máximo geral por ator na janela
  --api-rate-limit-window-seconds <n> Janela do limite geral
  --auth-rate-limit-max <n>  Máximo por IP/rota do Better Auth
  --auth-rate-limit-window-seconds <n> Janela do Better Auth
  --api-key-rate-limit-max <n> Máximo persistente por API key
  --api-key-rate-limit-window-seconds <n> Janela da API key
  --disable-rate-limit       Desabilita as três camadas de rate limiting
  --storage-dir <diretório>  Raiz para MongoDB e arquivos no host
  --mongo-data-path <dir>    Diretório do MongoDB no host
  --issue-files-path <dir>   Diretório dos anexos de issues no host
  --request-files-path <dir> Diretório dos arquivos de requests no host
  --document-files-path <dir>  Diretório dos arquivos de documentos no host
  --secret-files-path <dir>  Diretório do cofre criptografado no host
  --use-docker-volumes       Usa volumes nomeados gerenciados pelo Docker
  --instances-dir <diretório> Diretório de dados; default: ./instances
  --skip-bootstrap           Atualiza apenas a configuração da instância
  --list-instances           Lista instâncias sem mostrar credenciais
  --help                     Exibe esta ajuda

Sem --instance, um seletor interativo é exibido quando o terminal permitir.
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

replace_env_value() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  local temporary_file
  temporary_file="$(mktemp)"
  awk -v key="${key}" -v value="${value}" '
    BEGIN { replaced = 0 }
    index($0, key "=") == 1 {
      if (!replaced) {
        print key "=" value
        replaced = 1
      }
      next
    }
    { print }
    END {
      if (!replaced) print key "=" value
    }
  ' "${env_file}" > "${temporary_file}"
  mv "${temporary_file}" "${env_file}"
}

remove_env_value() {
  local env_file="$1"
  local key="$2"
  local temporary_file
  temporary_file="$(mktemp)"
  awk -v key="${key}" 'index($0, key "=") != 1 { print }' "${env_file}" > "${temporary_file}"
  mv "${temporary_file}" "${env_file}"
}

write_instance_control_scripts() {
  local start_file="${INSTANCE_DIR}/start.sh"
  local stop_file="${INSTANCE_DIR}/stop.sh"
  local backup_file="${INSTANCE_DIR}/backup-mongo.sh"
  local restore_file="${INSTANCE_DIR}/restore-mongo.sh"
  local quoted_root
  local quoted_env
  local quoted_instance_dir
  local quoted_project
  printf -v quoted_root '%q' "${ROOT_DIR}"
  printf -v quoted_env '%q' "${ENV_FILE}"
  printf -v quoted_instance_dir '%q' "${INSTANCE_DIR}"
  printf -v quoted_project '%q' "biaws-${INSTANCE}"

  cat > "${start_file}" <<EOF
#!/usr/bin/env bash

set -euo pipefail

BIAWS_ROOT=${quoted_root}
BIAWS_ENV_FILE=${quoted_env}
BIAWS_COMPOSE_PROJECT=${quoted_project}

exec docker compose \\
  --project-directory "\${BIAWS_ROOT}" \\
  --file "\${BIAWS_ROOT}/compose.yaml" \\
  --env-file "\${BIAWS_ENV_FILE}" \\
  --project-name "\${BIAWS_COMPOSE_PROJECT}" \\
  up -d --wait "\$@"
EOF

  cat > "${stop_file}" <<EOF
#!/usr/bin/env bash

set -euo pipefail

BIAWS_ROOT=${quoted_root}
BIAWS_ENV_FILE=${quoted_env}
BIAWS_COMPOSE_PROJECT=${quoted_project}

exec docker compose \\
  --project-directory "\${BIAWS_ROOT}" \\
  --file "\${BIAWS_ROOT}/compose.yaml" \\
  --env-file "\${BIAWS_ENV_FILE}" \\
  --project-name "\${BIAWS_COMPOSE_PROJECT}" \\
  stop "\$@"
EOF

  cat > "${backup_file}" <<EOF
#!/usr/bin/env bash

set -euo pipefail

BIAWS_ROOT=${quoted_root}
BIAWS_ENV_FILE=${quoted_env}
BIAWS_INSTANCE_DIR=${quoted_instance_dir}
BIAWS_COMPOSE_PROJECT=${quoted_project}
BIAWS_MONGO_DB="\$(awk -F= '\$1 == "MONGO_DB" { print substr(\$0, index(\$0, "=") + 1) }' "\${BIAWS_ENV_FILE}" | tail -n 1)"
BIAWS_MONGO_DB="\${BIAWS_MONGO_DB:-biaws}"

if [[ "\$#" -gt 1 ]]; then
  echo "Uso: \$0 [diretório de destino]" >&2
  exit 2
fi

backup_dir="\${1:-\${BIAWS_INSTANCE_DIR}/backups}"
mkdir -p "\${backup_dir}"
backup_dir="\$(cd "\${backup_dir}" && pwd -P)"
timestamp="\$(date -u +%Y%m%dT%H%M%SZ)"
archive="\${backup_dir}/\${BIAWS_MONGO_DB}-\${timestamp}.archive.gz"
temporary_archive="\${archive}.tmp"
trap 'rm -f "\${temporary_archive}"' EXIT

docker compose \\
  --project-directory "\${BIAWS_ROOT}" \\
  --file "\${BIAWS_ROOT}/compose.yaml" \\
  --env-file "\${BIAWS_ENV_FILE}" \\
  --project-name "\${BIAWS_COMPOSE_PROJECT}" \\
  exec -T mongo mongodump \\
    --db="\${BIAWS_MONGO_DB}" \\
    --archive \\
    --gzip > "\${temporary_archive}"

mv "\${temporary_archive}" "\${archive}"
trap - EXIT
if command -v sha256sum >/dev/null 2>&1; then
  (cd "\${backup_dir}" && sha256sum "\$(basename "\${archive}")" > "\$(basename "\${archive}").sha256")
elif command -v shasum >/dev/null 2>&1; then
  (cd "\${backup_dir}" && shasum -a 256 "\$(basename "\${archive}")" > "\$(basename "\${archive}").sha256")
else
  echo "Aviso: sha256sum/shasum não encontrado; checksum não gerado." >&2
fi

echo "Backup do MongoDB criado: \${archive}"
EOF

  cat > "${restore_file}" <<EOF
#!/usr/bin/env bash

set -euo pipefail

BIAWS_ROOT=${quoted_root}
BIAWS_ENV_FILE=${quoted_env}
BIAWS_COMPOSE_PROJECT=${quoted_project}
BIAWS_MONGO_DB="\$(awk -F= '\$1 == "MONGO_DB" { print substr(\$0, index(\$0, "=") + 1) }' "\${BIAWS_ENV_FILE}" | tail -n 1)"
BIAWS_MONGO_DB="\${BIAWS_MONGO_DB:-biaws}"

assume_yes=0
archive=""
for argument in "\$@"; do
  case "\${argument}" in
    --yes|-y) assume_yes=1 ;;
    -*)
      echo "Opção desconhecida: \${argument}" >&2
      exit 2
      ;;
    *)
      if [[ -n "\${archive}" ]]; then
        echo "Uso: \$0 <arquivo.archive.gz> [--yes]" >&2
        exit 2
      fi
      archive="\${argument}"
      ;;
  esac
done

if [[ -z "\${archive}" || ! -f "\${archive}" ]]; then
  echo "Uso: \$0 <arquivo.archive.gz> [--yes]" >&2
  exit 2
fi
archive="\$(cd "\$(dirname "\${archive}")" && pwd -P)/\$(basename "\${archive}")"

checksum_file="\${archive}.sha256"
if [[ -f "\${checksum_file}" ]]; then
  checksum_dir="\$(dirname "\${archive}")"
  checksum_name="\$(basename "\${checksum_file}")"
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "\${checksum_dir}" && sha256sum --check "\${checksum_name}")
  elif command -v shasum >/dev/null 2>&1; then
    (cd "\${checksum_dir}" && shasum -a 256 --check "\${checksum_name}")
  else
    echo "Aviso: sha256sum/shasum não encontrado; checksum não verificado." >&2
  fi
else
  echo "Aviso: checksum não encontrado em \${checksum_file}." >&2
fi

if [[ "\${assume_yes}" != "1" ]]; then
  if [[ ! -t 0 ]]; then
    echo "Restore recusado sem terminal interativo; use --yes para confirmar." >&2
    exit 2
  fi
  echo "Esta operação substituirá os dados do banco \${BIAWS_MONGO_DB} na instância \${BIAWS_COMPOSE_PROJECT}."
  read -r -p "Digite o nome da instância (\${BIAWS_COMPOSE_PROJECT#biaws-}) para continuar: " confirmation
  if [[ "\${confirmation}" != "\${BIAWS_COMPOSE_PROJECT#biaws-}" ]]; then
    echo "Restore cancelado." >&2
    exit 2
  fi
fi

docker compose \\
  --project-directory "\${BIAWS_ROOT}" \\
  --file "\${BIAWS_ROOT}/compose.yaml" \\
  --env-file "\${BIAWS_ENV_FILE}" \\
  --project-name "\${BIAWS_COMPOSE_PROJECT}" \\
  exec -T mongo mongorestore \\
    --nsInclude="\${BIAWS_MONGO_DB}.*" \\
    --archive \\
    --gzip \\
    --drop < "\${archive}"

echo "Restore do MongoDB concluído a partir de: \${archive}"
EOF

  chmod 755 "${start_file}" "${stop_file}" "${backup_file}" "${restore_file}"
}

list_instances() {
  local found=0
  local directory
  shopt -s nullglob
  for directory in "${INSTANCES_DIR}"/*; do
    [[ -d "${directory}" && -f "${directory}/.env" ]] || continue
    found=1
    printf '%-24s Mongo %-5s API %-5s UI %-5s %s\n' \
      "$(basename "${directory}")" \
      "$(read_env_value "${directory}/.env" "MONGO_PORT")" \
      "$(read_env_value "${directory}/.env" "ISSUE_API_PORT")" \
      "$(read_env_value "${directory}/.env" "ISSUE_UI_PORT")" \
      "${directory}"
  done
  shopt -u nullglob
  if [[ "${found}" != "1" ]]; then
    echo "Nenhuma instância encontrada em ${INSTANCES_DIR}."
  fi
}

validate_instance() {
  if [[ ! "$1" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then
    echo "Nome de instância inválido: use letras minúsculas, números e hífens." >&2
    exit 2
  fi
}

validate_port() {
  local value="$1"
  local label="$2"
  if [[ ! "${value}" =~ ^[0-9]+$ ]] ||
    [[ "${value}" -lt 1 ]] ||
    [[ "${value}" -gt 65535 ]]; then
    echo "${label} inválida: ${value}" >&2
    exit 2
  fi
}

validate_positive_integer() {
  local value="$1"
  local label="$2"
  if [[ ! "${value}" =~ ^[0-9]+$ ]] || [[ "${value}" -lt 1 ]]; then
    echo "${label} deve ser um inteiro positivo: ${value}" >&2
    exit 2
  fi
}

validate_public_url() {
  local value="$1"
  local port=""
  if [[ ! "${value}" =~ ^https?://(\[[0-9A-Fa-f:]+\]|[A-Za-z0-9.-]+)(:([0-9]+))?$ ]]; then
    echo "URL pública inválida: informe apenas a origem HTTP(S), sem caminho, query ou fragmento." >&2
    exit 2
  fi
  port="${BASH_REMATCH[3]:-}"
  [[ -z "${port}" ]] || validate_port "${port}" "Porta da URL pública"
}

normalize_storage_path() {
  local value="$1"
  local label="$2"
  if [[ "${value}" != /* ]]; then
    echo "${label} deve ser um caminho absoluto: ${value}" >&2
    exit 2
  fi
  if [[ "${value}" == "/" ]]; then
    echo "${label} não pode apontar para a raiz do sistema." >&2
    exit 2
  fi
  if [[ "${value}" == *[\#\$:\'\"\\]* ]]; then
    echo "${label} contém caractere incompatível com arquivos Compose: ${value}" >&2
    exit 2
  fi
  mkdir -p "${value}"
  (
    cd "${value}"
    pwd -P
  )
}

validate_distinct_storage_paths() {
  local values=(
    "${MONGO_DATA_PATH}"
    "${ISSUE_FILES_PATH}"
    "${REQUEST_FILES_PATH}"
    "${DOCUMENT_FILES_PATH}"
    "${SECRET_FILES_PATH}"
  )
  local first
  local second
  local left
  local right
  for ((first = 0; first < ${#values[@]}; first++)); do
    [[ -n "${values[${first}]}" ]] || continue
    for ((second = first + 1; second < ${#values[@]}; second++)); do
      [[ -n "${values[${second}]}" ]] || continue
      left="${values[${first}]%/}"
      right="${values[${second}]%/}"
      if [[ "${left}" == "${right}" ||
        "${left}/" == "${right}/"* ||
        "${right}/" == "${left}/"* ]]; then
        echo "Diretórios persistentes não podem ser iguais nem aninhados: ${left}, ${right}" >&2
        exit 2
      fi
    done
  done
}

port_reserved_by_instance() {
  local port="$1"
  local current_env="$2"
  local env_file
  shopt -s nullglob
  for env_file in "${INSTANCES_DIR}"/*/.env; do
    [[ "${env_file}" == "${current_env}" ]] && continue
    if [[ "$(read_env_value "${env_file}" "MONGO_PORT")" == "${port}" ]] ||
      [[ "$(read_env_value "${env_file}" "ISSUE_API_PORT")" == "${port}" ]] ||
      [[ "$(read_env_value "${env_file}" "ISSUE_UI_PORT")" == "${port}" ]]; then
      shopt -u nullglob
      return 0
    fi
  done
  shopt -u nullglob
  return 1
}

port_reserved() {
  local port="$1"
  local current_env="$2"
  if port_reserved_by_instance "${port}" "${current_env}"; then
    return 0
  fi
  if command -v lsof >/dev/null 2>&1 &&
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

next_port() {
  local candidate="$1"
  local current_env="$2"
  while port_reserved "${candidate}" "${current_env}" ||
    [[ -n "${MONGO_PORT}" && "${candidate}" == "${MONGO_PORT}" ]] ||
    [[ -n "${API_PORT}" && "${candidate}" == "${API_PORT}" ]] ||
    [[ -n "${UI_PORT}" && "${candidate}" == "${UI_PORT}" ]]; do
    candidate=$((candidate + 1))
  done
  printf '%s' "${candidate}"
}

select_instance() {
  local directories=()
  local directory
  local index=1
  local selection
  shopt -s nullglob
  for directory in "${INSTANCES_DIR}"/*; do
    [[ -d "${directory}" && -f "${directory}/.env" ]] || continue
    directories+=("$(basename "${directory}")")
  done
  shopt -u nullglob

  echo "Instâncias disponíveis:"
  for directory in "${directories[@]}"; do
    echo "  ${index}) ${directory}"
    index=$((index + 1))
  done
  echo "  n) criar nova"
  read -r -p "Selecione uma instância: " selection
  if [[ "${selection}" == "n" || "${selection}" == "N" ]]; then
    read -r -p "Nome da nova instância: " INSTANCE
    return
  fi
  if [[ "${selection}" =~ ^[0-9]+$ ]] &&
    [[ "${selection}" -ge 1 ]] &&
    [[ "${selection}" -le "${#directories[@]}" ]]; then
    INSTANCE="${directories[$((selection - 1))]}"
    return
  fi
  echo "Seleção inválida." >&2
  exit 2
}

normalized_args=()
for argument in "$@"; do
  case "${argument}" in
    --instance=*|--public-url=*|--mongo-port=*|--api-port=*|--ui-port=*|--api-rate-limit-max=*|--api-rate-limit-window-seconds=*|--auth-rate-limit-max=*|--auth-rate-limit-window-seconds=*|--api-key-rate-limit-max=*|--api-key-rate-limit-window-seconds=*|--storage-dir=*|--mongo-data-path=*|--issue-files-path=*|--request-files-path=*|--document-files-path=*|--secret-files-path=*|--instances-dir=*)
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
    --instance|--public-url|--mongo-port|--api-port|--ui-port|--api-rate-limit-max|--api-rate-limit-window-seconds|--auth-rate-limit-max|--auth-rate-limit-window-seconds|--api-key-rate-limit-max|--api-key-rate-limit-window-seconds|--storage-dir|--mongo-data-path|--issue-files-path|--request-files-path|--document-files-path|--secret-files-path|--instances-dir)
      require_value "$@"
      ;;
  esac
  case "$1" in
    --instance)
      INSTANCE="${2:-}"
      shift 2
      ;;
    --public-url)
      PUBLIC_URL="${2:-}"
      shift 2
      ;;
    --mongo-port)
      MONGO_PORT="${2:-}"
      shift 2
      ;;
    --api-port)
      API_PORT="${2:-}"
      shift 2
      ;;
    --ui-port)
      UI_PORT="${2:-}"
      shift 2
      ;;
    --api-rate-limit-max)
      API_RATE_LIMIT_MAX="${2:-}"
      shift 2
      ;;
    --api-rate-limit-window-seconds)
      API_RATE_LIMIT_WINDOW="${2:-}"
      shift 2
      ;;
    --auth-rate-limit-max)
      AUTH_RATE_LIMIT_MAX="${2:-}"
      shift 2
      ;;
    --auth-rate-limit-window-seconds)
      AUTH_RATE_LIMIT_WINDOW="${2:-}"
      shift 2
      ;;
    --api-key-rate-limit-max)
      API_KEY_RATE_LIMIT_MAX="${2:-}"
      shift 2
      ;;
    --api-key-rate-limit-window-seconds)
      API_KEY_RATE_LIMIT_WINDOW="${2:-}"
      shift 2
      ;;
    --disable-rate-limit)
      DISABLE_RATE_LIMIT=1
      shift
      ;;
    --storage-dir)
      STORAGE_DIR="${2:-}"
      shift 2
      ;;
    --mongo-data-path)
      MONGO_DATA_PATH="${2:-}"
      shift 2
      ;;
    --issue-files-path)
      ISSUE_FILES_PATH="${2:-}"
      shift 2
      ;;
    --request-files-path)
      REQUEST_FILES_PATH="${2:-}"
      shift 2
      ;;
    --document-files-path)
      DOCUMENT_FILES_PATH="${2:-}"
      shift 2
      ;;
    --secret-files-path)
      SECRET_FILES_PATH="${2:-}"
      shift 2
      ;;
    --use-docker-volumes)
      USE_DOCKER_VOLUMES=1
      shift
      ;;
    --instances-dir)
      INSTANCES_DIR="${2:-}"
      shift 2
      ;;
    --skip-bootstrap)
      SKIP_BOOTSTRAP=1
      shift
      ;;
    --list-instances)
      LIST_INSTANCES=1
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

mkdir -p "$(dirname "${INSTANCES_DIR}")"
INSTANCES_DIR="$(cd "$(dirname "${INSTANCES_DIR}")" && pwd)/$(basename "${INSTANCES_DIR}")"
mkdir -p "${INSTANCES_DIR}"

if [[ "${LIST_INSTANCES}" == "1" ]]; then
  list_instances
  exit 0
fi

if [[ -z "${INSTANCE}" ]]; then
  if [[ -t 0 ]]; then
    select_instance
  else
    echo "Informe --instance <nome> em execuções não interativas." >&2
    exit 2
  fi
fi
validate_instance "${INSTANCE}"

"${ROOT_DIR}/scripts/check-prerequisites.sh" --quiet

INSTANCE_DIR="${INSTANCES_DIR}/${INSTANCE}"
ENV_FILE="${INSTANCE_DIR}/.env"
new_instance=0
if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ "${SKIP_BOOTSTRAP}" == "1" ]]; then
    echo "A instância ${INSTANCE} ainda não existe; remova --skip-bootstrap." >&2
    exit 2
  fi
  mkdir -p "${INSTANCE_DIR}"
  cp "${ROOT_DIR}/.env.example" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  new_instance=1
fi

# Migração: versões anteriores armazenavam o workspace no arquivo da instância.
# Ele agora pertence à configuração MCP de cada projeto consumidor.
remove_env_value "${ENV_FILE}" "ISSUE_WORKSPACE_ID"

existing_mongo_data_path="$(read_env_value "${ENV_FILE}" "BIAWS_MONGO_DATA_PATH")"
existing_issue_files_path="$(read_env_value "${ENV_FILE}" "BIAWS_ISSUE_FILES_PATH")"
existing_request_files_path="$(read_env_value "${ENV_FILE}" "BIAWS_REQUEST_FILES_PATH")"
existing_document_files_path="$(read_env_value "${ENV_FILE}" "BIAWS_DOCUMENT_FILES_PATH")"
if [[ -z "${existing_document_files_path}" ]]; then
  existing_document_files_path="$(read_env_value "${ENV_FILE}" "BIAWS_PROCEDURE_FILES_PATH")"
fi
existing_secret_files_path="$(read_env_value "${ENV_FILE}" "BIAWS_SECRET_FILES_PATH")"
existing_secrets_key_path="$(read_env_value "${ENV_FILE}" "BIAWS_SECRETS_KEY_PATH")"
existing_secrets_key_file="$(read_env_value "${ENV_FILE}" "BIAWS_SECRETS_KEY_FILE")"
existing_public_url="$(read_env_value "${ENV_FILE}" "BIAWS_PUBLIC_URL")"

if [[ "${USE_DOCKER_VOLUMES}" == "1" ]] &&
  [[ -n "${STORAGE_DIR}${MONGO_DATA_PATH}${ISSUE_FILES_PATH}${REQUEST_FILES_PATH}${DOCUMENT_FILES_PATH}${SECRET_FILES_PATH}" ]]; then
  echo "--use-docker-volumes não pode ser combinado com opções de diretório." >&2
  exit 2
fi

if [[ "${USE_DOCKER_VOLUMES}" == "1" ]]; then
  MONGO_DATA_PATH=""
  ISSUE_FILES_PATH=""
  REQUEST_FILES_PATH=""
  DOCUMENT_FILES_PATH=""
  SECRET_FILES_PATH=""
else
  if [[ -n "${STORAGE_DIR}" ]]; then
    STORAGE_DIR="$(normalize_storage_path "${STORAGE_DIR}" "Diretório de armazenamento")"
    MONGO_DATA_PATH="${MONGO_DATA_PATH:-${STORAGE_DIR}/mongo}"
    ISSUE_FILES_PATH="${ISSUE_FILES_PATH:-${STORAGE_DIR}/issues}"
    REQUEST_FILES_PATH="${REQUEST_FILES_PATH:-${STORAGE_DIR}/requests}"
    DOCUMENT_FILES_PATH="${DOCUMENT_FILES_PATH:-${STORAGE_DIR}/documents}"
    SECRET_FILES_PATH="${SECRET_FILES_PATH:-${STORAGE_DIR}/secrets}"
  fi

  MONGO_DATA_PATH="${MONGO_DATA_PATH:-${existing_mongo_data_path}}"
  ISSUE_FILES_PATH="${ISSUE_FILES_PATH:-${existing_issue_files_path}}"
  REQUEST_FILES_PATH="${REQUEST_FILES_PATH:-${existing_request_files_path}}"
  DOCUMENT_FILES_PATH="${DOCUMENT_FILES_PATH:-${existing_document_files_path}}"
  SECRET_FILES_PATH="${SECRET_FILES_PATH:-${existing_secret_files_path}}"

  [[ -z "${MONGO_DATA_PATH}" ]] ||
    MONGO_DATA_PATH="$(normalize_storage_path "${MONGO_DATA_PATH}" "Diretório do MongoDB")"
  [[ -z "${ISSUE_FILES_PATH}" ]] ||
    ISSUE_FILES_PATH="$(normalize_storage_path "${ISSUE_FILES_PATH}" "Diretório de issues")"
  [[ -z "${REQUEST_FILES_PATH}" ]] ||
    REQUEST_FILES_PATH="$(normalize_storage_path "${REQUEST_FILES_PATH}" "Diretório de requests")"
  [[ -z "${DOCUMENT_FILES_PATH}" ]] ||
    DOCUMENT_FILES_PATH="$(normalize_storage_path "${DOCUMENT_FILES_PATH}" "Diretório de documentos")"
  [[ -z "${SECRET_FILES_PATH}" ]] ||
    SECRET_FILES_PATH="$(normalize_storage_path "${SECRET_FILES_PATH}" "Diretório do cofre de segredos")"
fi
validate_distinct_storage_paths

if [[ "${new_instance}" != "1" ]] &&
  [[ "${MONGO_DATA_PATH}" != "${existing_mongo_data_path}" ||
    "${ISSUE_FILES_PATH}" != "${existing_issue_files_path}" ||
    "${REQUEST_FILES_PATH}" != "${existing_request_files_path}" ||
    "${DOCUMENT_FILES_PATH}" != "${existing_document_files_path}" ||
    "${SECRET_FILES_PATH}" != "${existing_secret_files_path}" ]]; then
  echo "Aviso: os destinos de armazenamento mudaram; dados existentes não são movidos automaticamente." >&2
fi

if [[ -z "${MONGO_DATA_PATH}${ISSUE_FILES_PATH}${REQUEST_FILES_PATH}${DOCUMENT_FILES_PATH}${SECRET_FILES_PATH}" ]]; then
  STORAGE_DESCRIPTION="volumes Docker gerenciados"
else
  STORAGE_DESCRIPTION="bind mounts configurados no host"
fi

if [[ -z "${MONGO_PORT}" ]]; then
  MONGO_PORT="$(read_env_value "${ENV_FILE}" "MONGO_PORT")"
  if [[ "${new_instance}" == "1" ]]; then
    MONGO_PORT="$(next_port "${MONGO_PORT:-27017}" "${ENV_FILE}")"
  fi
fi
if [[ -z "${API_PORT}" ]]; then
  API_PORT="$(read_env_value "${ENV_FILE}" "ISSUE_API_PORT")"
  if [[ "${new_instance}" == "1" ]]; then
    API_PORT="$(next_port "${API_PORT:-3100}" "${ENV_FILE}")"
  fi
fi
if [[ -z "${UI_PORT}" ]]; then
  UI_PORT="$(read_env_value "${ENV_FILE}" "ISSUE_UI_PORT")"
  if [[ "${new_instance}" == "1" ]]; then
    UI_PORT="$(next_port "${UI_PORT:-4400}" "${ENV_FILE}")"
  fi
fi
MONGO_PORT="${MONGO_PORT:-27017}"
validate_port "${MONGO_PORT}" "Porta do MongoDB"
validate_port "${API_PORT}" "Porta da API"
validate_port "${UI_PORT}" "Porta da UI"
if [[ -z "${PUBLIC_URL}" ]]; then
  if [[ -n "${existing_public_url}" && "${existing_public_url}" != "http://localhost:"* ]]; then
    PUBLIC_URL="${existing_public_url}"
  else
    PUBLIC_URL="http://localhost:${UI_PORT}"
  fi
fi
PUBLIC_URL="${PUBLIC_URL%/}"
validate_public_url "${PUBLIC_URL}"
for rate_limit_setting in \
  "${API_RATE_LIMIT_MAX}:Máximo geral" \
  "${API_RATE_LIMIT_WINDOW}:Janela geral" \
  "${AUTH_RATE_LIMIT_MAX}:Máximo do Better Auth" \
  "${AUTH_RATE_LIMIT_WINDOW}:Janela do Better Auth" \
  "${API_KEY_RATE_LIMIT_MAX}:Máximo da API key" \
  "${API_KEY_RATE_LIMIT_WINDOW}:Janela da API key"; do
  value="${rate_limit_setting%%:*}"
  label="${rate_limit_setting#*:}"
  [[ -z "${value}" ]] || validate_positive_integer "${value}" "${label}"
done
if [[ "${MONGO_PORT}" == "${API_PORT}" ||
  "${MONGO_PORT}" == "${UI_PORT}" ||
  "${API_PORT}" == "${UI_PORT}" ]]; then
  echo "MongoDB, API e UI não podem usar a mesma porta." >&2
  exit 2
fi
for port in "${MONGO_PORT}" "${API_PORT}" "${UI_PORT}"; do
  if port_reserved_by_instance "${port}" "${ENV_FILE}"; then
    echo "A porta ${port} já pertence a outra instância." >&2
    exit 2
  fi
done

replace_env_value "${ENV_FILE}" "COMPOSE_PROJECT_NAME" "biaws-${INSTANCE}"
replace_env_value "${ENV_FILE}" "MONGO_PORT" "${MONGO_PORT}"
replace_env_value "${ENV_FILE}" "ISSUE_API_PORT" "${API_PORT}"
replace_env_value "${ENV_FILE}" "ISSUE_UI_PORT" "${UI_PORT}"
replace_env_value "${ENV_FILE}" "ISSUE_API_URL" "http://127.0.0.1:${API_PORT}"
replace_env_value "${ENV_FILE}" "BIAWS_MONGO_DATA_PATH" "${MONGO_DATA_PATH}"
replace_env_value "${ENV_FILE}" "BIAWS_ISSUE_FILES_PATH" "${ISSUE_FILES_PATH}"
replace_env_value "${ENV_FILE}" "BIAWS_REQUEST_FILES_PATH" "${REQUEST_FILES_PATH}"
replace_env_value "${ENV_FILE}" "BIAWS_DOCUMENT_FILES_PATH" "${DOCUMENT_FILES_PATH}"
replace_env_value "${ENV_FILE}" "BIAWS_SECRET_FILES_PATH" "${SECRET_FILES_PATH}"
if [[ -n "${SECRET_FILES_PATH}" ]]; then
  replace_env_value "${ENV_FILE}" "BIAWS_SECRETS_DIR" "${SECRET_FILES_PATH}"
fi
if [[ -n "${existing_secrets_key_path}" ]]; then
  secrets_key_path="${existing_secrets_key_path}"
elif [[ "${existing_secrets_key_file}" == /* ]]; then
  secrets_key_path="${existing_secrets_key_file}"
else
  secrets_key_path="${INSTANCE_DIR}/.secrets-master-key"
fi
replace_env_value "${ENV_FILE}" "BIAWS_SECRETS_KEY_PATH" "${secrets_key_path}"
replace_env_value "${ENV_FILE}" "BIAWS_SECRETS_KEY_FILE" "${secrets_key_path}"
replace_env_value "${ENV_FILE}" "BIAWS_PUBLIC_URL" "${PUBLIC_URL}"
replace_env_value \
  "${ENV_FILE}" \
  "BIAWS_TRUSTED_ORIGINS" \
  "${PUBLIC_URL}"
if [[ "${PUBLIC_URL}" == "http://localhost:${UI_PORT}" ]]; then
  replace_env_value \
    "${ENV_FILE}" \
    "BIAWS_TRUSTED_ORIGINS" \
    "http://localhost:${UI_PORT},http://127.0.0.1:${UI_PORT}"
fi
if [[ "${PUBLIC_URL}" == https://* ]]; then
  replace_env_value "${ENV_FILE}" "BETTER_AUTH_SECURE_COOKIES" "true"
else
  replace_env_value "${ENV_FILE}" "BETTER_AUTH_SECURE_COOKIES" "false"
fi
if [[ "${DISABLE_RATE_LIMIT}" == "1" ]]; then
  replace_env_value "${ENV_FILE}" "ISSUE_API_RATE_LIMIT_ENABLED" "false"
  replace_env_value "${ENV_FILE}" "BETTER_AUTH_RATE_LIMIT_ENABLED" "false"
  replace_env_value "${ENV_FILE}" "ISSUE_API_KEY_RATE_LIMIT_ENABLED" "false"
fi
[[ -z "${API_RATE_LIMIT_MAX}" ]] || \
  replace_env_value "${ENV_FILE}" "ISSUE_API_RATE_LIMIT_MAX_REQUESTS" "${API_RATE_LIMIT_MAX}"
[[ -z "${API_RATE_LIMIT_WINDOW}" ]] || \
  replace_env_value "${ENV_FILE}" "ISSUE_API_RATE_LIMIT_WINDOW_SECONDS" "${API_RATE_LIMIT_WINDOW}"
[[ -z "${AUTH_RATE_LIMIT_MAX}" ]] || \
  replace_env_value "${ENV_FILE}" "BETTER_AUTH_RATE_LIMIT_MAX_REQUESTS" "${AUTH_RATE_LIMIT_MAX}"
[[ -z "${AUTH_RATE_LIMIT_WINDOW}" ]] || \
  replace_env_value "${ENV_FILE}" "BETTER_AUTH_RATE_LIMIT_WINDOW_SECONDS" "${AUTH_RATE_LIMIT_WINDOW}"
[[ -z "${API_KEY_RATE_LIMIT_MAX}" ]] || \
  replace_env_value "${ENV_FILE}" "ISSUE_API_KEY_RATE_LIMIT_MAX_REQUESTS" "${API_KEY_RATE_LIMIT_MAX}"
[[ -z "${API_KEY_RATE_LIMIT_WINDOW}" ]] || \
  replace_env_value "${ENV_FILE}" "ISSUE_API_KEY_RATE_LIMIT_WINDOW_SECONDS" "${API_KEY_RATE_LIMIT_WINDOW}"
chmod 600 "${ENV_FILE}"
write_instance_control_scripts

if [[ "${SKIP_BOOTSTRAP}" != "1" ]]; then
  BIAWS_ENV_FILE="${ENV_FILE}" \
    BIAWS_INSTANCE="${INSTANCE}" \
    BIAWS_INSTANCES_DIR="${INSTANCES_DIR}" \
    "${ROOT_DIR}/scripts/bootstrap.sh" \
      --instance "${INSTANCE}" \
      --instances-dir "${INSTANCES_DIR}"
elif [[ "${DISABLE_RATE_LIMIT}" == "1" ||
  -n "${API_RATE_LIMIT_MAX}${API_RATE_LIMIT_WINDOW}${AUTH_RATE_LIMIT_MAX}${AUTH_RATE_LIMIT_WINDOW}${API_KEY_RATE_LIMIT_MAX}${API_KEY_RATE_LIMIT_WINDOW}" ]]; then
  echo "Aviso: rate limiting atualizado no .env; reinicie a API para aplicar a configuração." >&2
fi

cat <<EOF

Configuração concluída:
  Instância: ${INSTANCE}
  Dados:     ${INSTANCE_DIR}
  Storage:   ${STORAGE_DESCRIPTION}
  MongoDB:   mongodb://127.0.0.1:${MONGO_PORT}/biaws
  API:       http://localhost:${API_PORT}
  UI local:  http://localhost:${UI_PORT}
  UI pública: ${PUBLIC_URL}

Rate limiting:
  API protegida: $(read_env_value "${ENV_FILE}" "ISSUE_API_RATE_LIMIT_MAX_REQUESTS") requisições / $(read_env_value "${ENV_FILE}" "ISSUE_API_RATE_LIMIT_WINDOW_SECONDS")s por ator
  Autenticação:   $(read_env_value "${ENV_FILE}" "BETTER_AUTH_RATE_LIMIT_MAX_REQUESTS") requisições / $(read_env_value "${ENV_FILE}" "BETTER_AUTH_RATE_LIMIT_WINDOW_SECONDS")s por IP e rota
  API key:        $(read_env_value "${ENV_FILE}" "ISSUE_API_KEY_RATE_LIMIT_MAX_REQUESTS") requisições / $(read_env_value "${ENV_FILE}" "ISSUE_API_KEY_RATE_LIMIT_WINDOW_SECONDS")s por chave

Configure cada cliente com scripts/setup-client.sh e uma chave própria.
Operação Docker:
  Iniciar: "${INSTANCE_DIR}/start.sh"
  Parar:   "${INSTANCE_DIR}/stop.sh"
  Backup:  "${INSTANCE_DIR}/backup-mongo.sh"
  Restore: "${INSTANCE_DIR}/restore-mongo.sh" <arquivo.archive.gz>
  Backup completo:  "${ROOT_DIR}/scripts/backup-instance.sh" --instance "${INSTANCE}" --instances-dir "${INSTANCES_DIR}"
  Restore completo: "${ROOT_DIR}/scripts/restore-instance.sh" --instance "${INSTANCE}" --instances-dir "${INSTANCES_DIR}" --archive <backup.tar.gz.enc>
  Remover: "${ROOT_DIR}/scripts/remove-instance.sh" --instance "${INSTANCE}" --instances-dir "${INSTANCES_DIR}"
  Status:  docker compose --env-file "${ENV_FILE}" --project-name "biaws-${INSTANCE}" ps
EOF
