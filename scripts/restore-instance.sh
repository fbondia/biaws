#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTANCES_DIR="${BIAWS_INSTANCES_DIR:-${ROOT_DIR}/instances}"
INSTANCE=""
ARCHIVE=""
PASSWORD_FILE=""
TEMP_PASSWORD_FILE=""
WORK_DIR=""
SERVICES_STOPPED=0
RUNNING_SERVICES=()
ASSUME_YES=0
PBKDF2_ITERATIONS=600000
CRYPTO_HELPER="${ROOT_DIR}/scripts/instance-archive-crypto.mjs"

usage() {
  cat <<'EOF'
Uso:
  ./scripts/restore-instance.sh --instance <destino> --archive <backup> [opções]

Opções:
  --instance <nome>       Instância de destino, previamente criada
  --archive <arquivo>     Backup produzido por backup-instance.sh
  --instances-dir <dir>   Diretório de instâncias; default: ./instances
  --password-file <file>  Lê a senha da primeira linha do arquivo
  --yes, -y               Não solicita confirmação pelo nome da instância
  --help, -h              Exibe esta ajuda

A restauração substitui MongoDB, anexos, documentos, monitoramentos, cofre e
segredos da instância de destino. Portas, URLs e caminhos de armazenamento do
novo host são preservados. Crie primeiro a instância de destino com
setup-server.sh.
EOF
}

require_value() {
  if [[ "$#" -lt 2 || -z "${2}" ]]; then
    echo "A opção ${1} exige um valor." >&2
    usage >&2
    exit 2
  fi
}

read_env_value_from() {
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
    END { if (!replaced) print key "=" value }
  ' "${env_file}" > "${temporary_file}"
  mv "${temporary_file}" "${env_file}"
}

resolve_host_path() {
  local value="$1"
  if [[ "${value}" == /* ]]; then
    printf '%s' "${value}"
  else
    printf '%s' "${ROOT_DIR}/${value}"
  fi
}

validate_restore_target() {
  local value="${1%/}"
  local protected
  if [[ -z "${value}" || "${value}" != /* || "${value}" == "/" ]]; then
    echo "Destino de restauração inseguro: ${value:-<vazio>}" >&2
    exit 1
  fi
  for protected in "${ROOT_DIR}" "${INSTANCES_DIR}" "${HOME:-}"; do
    [[ -n "${protected}" ]] || continue
    protected="${protected%/}"
    if [[ "${value}" == "${protected}" ||
      "${ROOT_DIR}" == "${value}/"* ||
      "${INSTANCES_DIR}" == "${value}/"* ]]; then
      echo "Destino de restauração amplo demais: ${value}" >&2
      exit 1
    fi
  done
}

compose() {
  docker compose \
    --project-directory "${ROOT_DIR}" \
    --file "${ROOT_DIR}/compose.yaml" \
    --env-file "${ENV_FILE}" \
    --project-name "biaws-${INSTANCE}" \
    "$@"
}

restart_services() {
  if [[ "${SERVICES_STOPPED}" == "1" && "${#RUNNING_SERVICES[@]}" -gt 0 ]]; then
    echo "Recriando serviços que estavam ativos..."
    compose up -d "${RUNNING_SERVICES[@]}" >/dev/null
    SERVICES_STOPPED=0
  fi
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if ! restart_services; then
    echo "Aviso: não foi possível reiniciar todos os serviços pausados." >&2
    [[ "${status}" -ne 0 ]] || status=1
  fi
  [[ -z "${WORK_DIR}" ]] || rm -rf -- "${WORK_DIR}"
  [[ -z "${TEMP_PASSWORD_FILE}" ]] || rm -f -- "${TEMP_PASSWORD_FILE}"
  exit "${status}"
}
trap cleanup EXIT INT TERM

prepare_password() {
  local password=""
  if [[ -n "${PASSWORD_FILE}" ]]; then
    if [[ ! -f "${PASSWORD_FILE}" || ! -r "${PASSWORD_FILE}" ]]; then
      echo "Arquivo de senha não pode ser lido: ${PASSWORD_FILE}" >&2
      exit 1
    fi
    IFS= read -r password < "${PASSWORD_FILE}" || true
  else
    if [[ ! -t 0 ]]; then
      echo "Sem terminal interativo; informe --password-file." >&2
      exit 2
    fi
    read -r -s -p "Senha do backup: " password
    echo
    TEMP_PASSWORD_FILE="$(mktemp)"
    chmod 600 "${TEMP_PASSWORD_FILE}"
    printf '%s\n' "${password}" > "${TEMP_PASSWORD_FILE}"
    PASSWORD_FILE="${TEMP_PASSWORD_FILE}"
  fi
  [[ -n "${password}" ]] || { echo "A senha não pode ser vazia." >&2; exit 2; }
  unset password
}

verify_sha256() {
  local file="$1"
  local checksum_file="${file}.sha256"
  local directory
  local checksum_name
  if [[ ! -f "${checksum_file}" ]]; then
    echo "Aviso: checksum não encontrado; prosseguindo sem essa validação de integridade." >&2
    return 0
  fi
  directory="$(cd "$(dirname "${file}")" && pwd -P)"
  checksum_name="$(basename "${checksum_file}")"
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${directory}" && sha256sum --check "${checksum_name}")
  else
    (cd "${directory}" && shasum -a 256 --check "${checksum_name}")
  fi
}

is_deployment_key() {
  case "$1" in
    COMPOSE_PROJECT_NAME|MONGO_PORT|BIAWS_API_PORT|BIAWS_UI_PORT|BIAWS_API_URL|MONGO_URI|BIAWS_ISSUE_DIR|BIAWS_REQUEST_DIR|BIAWS_DOCUMENT_DIR|ATTACHMENT_STORAGE_LOCAL_DIR|BIAWS_MONGO_DATA_PATH|BIAWS_ISSUE_FILES_PATH|BIAWS_REQUEST_FILES_PATH|BIAWS_DOCUMENT_FILES_PATH|BIAWS_PROCEDURE_FILES_PATH|BIAWS_SECRET_FILES_PATH|BIAWS_SECRETS_DIR|BIAWS_SECRETS_KEY_PATH|BIAWS_SECRETS_KEY_FILE|BIAWS_MONITOR_SECRET_FILES_PATH|BIAWS_MONITOR_SHELL_FILES_PATH|BIAWS_MONITOR_EXECUTOR_UID|BIAWS_MONITOR_EXECUTOR_GID|BIAWS_PUBLIC_URL|BIAWS_TRUSTED_ORIGINS|BETTER_AUTH_URL|BETTER_AUTH_TRUSTED_ORIGINS|BETTER_AUTH_TRUSTED_PROXIES|BETTER_AUTH_SECURE_COOKIES)
      return 0
      ;;
    *) return 1 ;;
  esac
}

merge_environment() {
  local source_env="$1"
  local destination_env="$2"
  local line
  local key
  local value
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    key="${line%%=*}"
    is_deployment_key "${key}" && continue
    value="${line#*=}"
    replace_env_value "${destination_env}" "${key}" "${value}"
  done < "${source_env}"
  replace_env_value "${destination_env}" "BIAWS_MONITOR_EXECUTOR_UID" "$(id -u)"
  replace_env_value "${destination_env}" "BIAWS_MONITOR_EXECUTOR_GID" "$(id -g)"
  chmod 600 "${destination_env}"
}

replace_host_directory() {
  local archive="$1"
  local destination="$2"
  [[ -f "${archive}" ]] || return 0
  if [[ -L "${destination}" ]]; then
    echo "Destino simbólico de restauração recusado: ${destination}" >&2
    exit 1
  fi
  validate_restore_target "${destination}"
  mkdir -p "${destination}"
  find "${destination}" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} \;
  COPYFILE_DISABLE=1 tar "${tar_warning_args[@]}" --no-xattrs --exclude="._*" \
    -C "${destination}" -xf "${archive}"
}

restore_volume() {
  local archive="$1"
  local container_path="$2"
  if [[ ! -f "${archive}" ]]; then
    echo "Volume ausente no backup: ${archive}" >&2
    exit 1
  fi
  compose run --rm -T --no-deps --entrypoint sh api \
    -c 'target="$1"; find "$target" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} \;; tar -C "$target" -xf -' \
    sh "${container_path}" < "${archive}"
}

normalized_args=()
for argument in "$@"; do
  case "${argument}" in
    --instance=*|--archive=*|--instances-dir=*|--password-file=*)
      option="${argument%%=*}"
      value="${argument#*=}"
      [[ -n "${value}" ]] || { echo "A opção ${option} exige um valor." >&2; exit 2; }
      normalized_args+=("${option}" "${value}")
      ;;
    *) normalized_args+=("${argument}") ;;
  esac
done
set -- "${normalized_args[@]}"
unset normalized_args argument option value

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --instance|--archive|--instances-dir|--password-file) require_value "$@" ;;
  esac
  case "$1" in
    --instance) INSTANCE="$2"; shift 2 ;;
    --archive) ARCHIVE="$2"; shift 2 ;;
    --instances-dir) INSTANCES_DIR="$2"; shift 2 ;;
    --password-file) PASSWORD_FILE="$2"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "${INSTANCE}" || ! "${INSTANCE}" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then
  echo "Informe --instance com um nome válido." >&2
  exit 2
fi
if [[ -z "${ARCHIVE}" ]]; then
  echo "Informe --archive <arquivo>." >&2
  exit 2
fi
[[ "${ARCHIVE}" == /* ]] || ARCHIVE="${PWD}/${ARCHIVE}"
if [[ ! -f "${ARCHIVE}" ]]; then
  echo "Backup não encontrado: ${ARCHIVE}" >&2
  exit 1
fi
ARCHIVE="$(cd "$(dirname "${ARCHIVE}")" && pwd -P)/$(basename "${ARCHIVE}")"
if [[ ! -d "${INSTANCES_DIR}" ]]; then
  echo "Diretório de instâncias não encontrado: ${INSTANCES_DIR}" >&2
  exit 1
fi
INSTANCES_DIR="$(cd "${INSTANCES_DIR}" && pwd -P)"
INSTANCE_DIR="${INSTANCES_DIR}/${INSTANCE}"
ENV_FILE="${INSTANCE_DIR}/.env"
if [[ -L "${INSTANCE_DIR}" ]]; then
  echo "Diretórios de instância simbólicos não podem ser restaurados: ${INSTANCE_DIR}" >&2
  exit 1
fi
if [[ ! -d "${INSTANCE_DIR}" || ! -f "${ENV_FILE}" ]]; then
  echo "A instância de destino não existe: ${INSTANCE}" >&2
  echo "Crie-a primeiro com scripts/setup-server.sh." >&2
  exit 1
fi
for command in docker node tar; do
  command -v "${command}" >/dev/null 2>&1 || { echo "Comando obrigatório ausente: ${command}" >&2; exit 1; }
done
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || {
  echo "sha256sum ou shasum é obrigatório." >&2
  exit 1
}

if [[ "${ASSUME_YES}" != "1" ]]; then
  if [[ ! -t 0 ]]; then
    echo "Restauração recusada sem terminal interativo; use --yes." >&2
    exit 2
  fi
  echo "Esta operação substituirá banco, arquivos e segredos da instância ${INSTANCE}."
  read -r -p "Digite o nome da instância (${INSTANCE}) para continuar: " confirmation
  [[ "${confirmation}" == "${INSTANCE}" ]] || { echo "Restauração cancelada." >&2; exit 2; }
fi

prepare_password
verify_sha256 "${ARCHIVE}"

WORK_DIR="$(mktemp -d)"
PLAIN_ARCHIVE="${WORK_DIR}/payload.tar.gz"
chmod 700 "${WORK_DIR}"
echo "Descriptografando e validando o backup..."
if ! node "${CRYPTO_HELPER}" decrypt \
  --input "${ARCHIVE}" \
  --output "${PLAIN_ARCHIVE}" \
  --password-file "${PASSWORD_FILE}" \
  --iterations "${PBKDF2_ITERATIONS}"; then
  echo "Não foi possível descriptografar o backup; confira a senha e o arquivo." >&2
  exit 1
fi
chmod 600 "${PLAIN_ARCHIVE}"

tar_warning_args=()
if tar --version 2>/dev/null | grep -q "GNU tar"; then
  tar_warning_args+=(--warning=no-unknown-keyword)
fi
archive_entries="${WORK_DIR}/archive-entries.txt"
if ! tar "${tar_warning_args[@]}" -tzf "${PLAIN_ARCHIVE}" > "${archive_entries}"; then
  echo "O conteúdo descriptografado não é um arquivo tar válido." >&2
  exit 1
fi
while IFS= read -r entry; do
  if [[ "${entry}" == "._biaws-instance-backup" ]]; then
    continue
  fi
  if [[ "${entry}" == /* || "${entry}" == ".." || "${entry}" == ../* ||
    "${entry}" == *"/../"* ||
    ( "${entry}" != "biaws-instance-backup" &&
      "${entry}" != biaws-instance-backup/* ) ]]; then
    echo "Entrada insegura ou inesperada no backup: ${entry}" >&2
    exit 1
  fi
done < "${archive_entries}"
tar "${tar_warning_args[@]}" --exclude="._*" \
  -C "${WORK_DIR}" -xzf "${PLAIN_ARCHIVE}"
PAYLOAD_DIR="${WORK_DIR}/biaws-instance-backup"
MANIFEST="${PAYLOAD_DIR}/manifest"
SOURCE_ENV="${PAYLOAD_DIR}/instance/environment.env"
if [[ ! -f "${MANIFEST}" || ! -f "${SOURCE_ENV}" ||
  ! -f "${PAYLOAD_DIR}/mongo.archive.gz" ||
  ! -f "${PAYLOAD_DIR}/instance/secrets-master-key" ]]; then
  echo "Backup incompleto ou em formato desconhecido." >&2
  exit 1
fi
format_version="$(read_env_value_from "${MANIFEST}" format_version)"
if [[ "${format_version}" != "1" ]]; then
  echo "Versão de backup não suportada: ${format_version:-desconhecida}" >&2
  exit 1
fi
source_instance="$(read_env_value_from "${MANIFEST}" source_instance)"
source_revision="$(read_env_value_from "${MANIFEST}" application_revision)"
echo "Origem do backup: ${source_instance:-desconhecida}"
echo "Revisão da aplicação: ${source_revision:-desconhecida}"

while IFS= read -r service; do
  [[ -n "${service}" && "${service}" != "mongo" ]] || continue
  RUNNING_SERVICES+=("${service}")
done < <(compose ps --services --filter status=running)
if [[ "${#RUNNING_SERVICES[@]}" -gt 0 ]]; then
  echo "Pausando serviços com escrita..."
  SERVICES_STOPPED=1
  compose stop "${RUNNING_SERVICES[@]}" >/dev/null
fi

destination_env_snapshot="${WORK_DIR}/destination.env"
cp -p "${ENV_FILE}" "${destination_env_snapshot}"
merge_environment "${SOURCE_ENV}" "${ENV_FILE}"

secrets_key_target="$(read_env_value_from "${destination_env_snapshot}" BIAWS_SECRETS_KEY_PATH)"
secrets_key_target="${secrets_key_target:-$(read_env_value_from "${destination_env_snapshot}" BIAWS_SECRETS_KEY_FILE)}"
secrets_key_target="${secrets_key_target:-${INSTANCE_DIR}/.secrets-master-key}"
secrets_key_target="$(resolve_host_path "${secrets_key_target}")"
validate_restore_target "${secrets_key_target}"
if [[ -L "${secrets_key_target}" ]]; then
  echo "Chave mestra de destino não pode ser um link simbólico: ${secrets_key_target}" >&2
  exit 1
fi
mkdir -p "$(dirname "${secrets_key_target}")"
cp -p "${PAYLOAD_DIR}/instance/secrets-master-key" "${secrets_key_target}"
chmod 600 "${secrets_key_target}"

if [[ -f "${PAYLOAD_DIR}/instance/bootstrap-admin-password" ]]; then
  cp -p \
    "${PAYLOAD_DIR}/instance/bootstrap-admin-password" \
    "${INSTANCE_DIR}/.bootstrap-admin-password"
  chmod 600 "${INSTANCE_DIR}/.bootstrap-admin-password"
else
  rm -f -- "${INSTANCE_DIR}/.bootstrap-admin-password"
fi

replace_host_directory \
  "${PAYLOAD_DIR}/instance/monitoring.tar" \
  "${INSTANCE_DIR}/monitoring"
replace_host_directory \
  "${PAYLOAD_DIR}/instance/data-monitoring.tar" \
  "${INSTANCE_DIR}/data/monitoring"

monitor_secrets_target="$(read_env_value_from "${destination_env_snapshot}" BIAWS_MONITOR_SECRET_FILES_PATH)"
monitor_secrets_target="${monitor_secrets_target:-${INSTANCE_DIR}/monitor-secrets}"
monitor_secrets_target="$(resolve_host_path "${monitor_secrets_target}")"
replace_host_directory \
  "${PAYLOAD_DIR}/instance/monitor-secrets.tar" \
  "${monitor_secrets_target}"
if [[ -f "${PAYLOAD_DIR}/instance/monitor-secrets.tar" ]]; then
  replace_env_value \
    "${ENV_FILE}" \
    "BIAWS_MONITOR_SECRET_FILES_PATH" \
    "${monitor_secrets_target}"
fi

monitor_scripts_target="$(read_env_value_from "${destination_env_snapshot}" BIAWS_MONITOR_SHELL_FILES_PATH)"
if [[ -f "${PAYLOAD_DIR}/instance/monitor-scripts.tar" ]]; then
  monitor_scripts_target="${monitor_scripts_target:-${INSTANCE_DIR}/monitoring/scripts}"
  monitor_scripts_target="$(resolve_host_path "${monitor_scripts_target}")"
  replace_host_directory \
    "${PAYLOAD_DIR}/instance/monitor-scripts.tar" \
    "${monitor_scripts_target}"
  replace_env_value "${ENV_FILE}" "BIAWS_MONITOR_SHELL_FILES_PATH" "${monitor_scripts_target}"
fi

echo "Restaurando volumes persistentes..."
restore_volume "${PAYLOAD_DIR}/files/issues.tar" /data/issues
restore_volume "${PAYLOAD_DIR}/files/requests.tar" /data/requests
restore_volume "${PAYLOAD_DIR}/files/documents.tar" /data/documents
restore_volume "${PAYLOAD_DIR}/files/secrets.tar" /data/secrets

mongo_db="$(read_env_value_from "${MANIFEST}" mongo_database)"
mongo_db="${mongo_db:-biaws}"
echo "Restaurando MongoDB..."
compose exec -T mongo mongorestore \
  --nsInclude="${mongo_db}.*" \
  --archive \
  --gzip \
  --drop < "${PAYLOAD_DIR}/mongo.archive.gz"

restart_services
echo "Restauração completa concluída na instância: ${INSTANCE}"
