#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTANCES_DIR="${BIAWS_INSTANCES_DIR:-${ROOT_DIR}/instances}"
INSTANCE=""
OUTPUT=""
PASSWORD_FILE=""
TEMP_PASSWORD_FILE=""
STAGING_DIR=""
PLAIN_ARCHIVE=""
TEMP_OUTPUT=""
SERVICES_STOPPED=0
RUNNING_SERVICES=()
PBKDF2_ITERATIONS=600000
CRYPTO_HELPER="${ROOT_DIR}/scripts/instance-archive-crypto.mjs"

usage() {
  cat <<'EOF'
Uso:
  ./scripts/backup-instance.sh --instance <nome> [opções]

Opções:
  --instance <nome>       Instância a copiar
  --instances-dir <dir>   Diretório de instâncias; default: ./instances
  --output <arquivo>      Destino; default: backups/<instância>-<data>.tar.gz.enc
  --password-file <file>  Lê a senha da primeira linha do arquivo
  --help, -h              Exibe esta ajuda

Sem --password-file, solicita a senha duas vezes em um terminal. A API e os
demais serviços com escrita são pausados durante o snapshot e reiniciados ao
final. O MongoDB permanece ativo para gerar um mongodump lógico.
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
  local key="$1"
  awk -F= -v key="${key}" '
    $1 == key { print substr($0, index($0, "=") + 1) }
  ' "${ENV_FILE}" | tail -n 1
}

resolve_host_path() {
  local value="$1"
  if [[ "${value}" == /* ]]; then
    printf '%s' "${value}"
  else
    printf '%s' "${ROOT_DIR}/${value}"
  fi
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
    echo "Reiniciando serviços pausados..."
    compose start "${RUNNING_SERVICES[@]}" >/dev/null
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
  [[ -z "${STAGING_DIR}" ]] || rm -rf -- "${STAGING_DIR}"
  [[ -z "${PLAIN_ARCHIVE}" ]] || rm -f -- "${PLAIN_ARCHIVE}"
  [[ -z "${TEMP_OUTPUT}" ]] || rm -f -- "${TEMP_OUTPUT}"
  [[ -z "${TEMP_PASSWORD_FILE}" ]] || rm -f -- "${TEMP_PASSWORD_FILE}"
  exit "${status}"
}
trap cleanup EXIT INT TERM

prepare_password() {
  local password=""
  local confirmation=""
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
    read -r -s -p "Confirme a senha: " confirmation
    echo
    if [[ "${password}" != "${confirmation}" ]]; then
      echo "As senhas não coincidem." >&2
      exit 2
    fi
    TEMP_PASSWORD_FILE="$(mktemp)"
    chmod 600 "${TEMP_PASSWORD_FILE}"
    printf '%s\n' "${password}" > "${TEMP_PASSWORD_FILE}"
    PASSWORD_FILE="${TEMP_PASSWORD_FILE}"
  fi
  if [[ "${#password}" -lt 12 ]]; then
    echo "A senha do backup deve ter pelo menos 12 caracteres." >&2
    exit 2
  fi
  unset password confirmation
}

create_sha256() {
  local file="$1"
  local directory
  local name
  directory="$(cd "$(dirname "${file}")" && pwd -P)"
  name="$(basename "${file}")"
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "${directory}" && sha256sum "${name}" > "${name}.sha256")
  else
    (cd "${directory}" && shasum -a 256 "${name}" > "${name}.sha256")
  fi
}

copy_optional_file() {
  local source="$1"
  local destination="$2"
  [[ -f "${source}" ]] || return 0
  cp -p "${source}" "${destination}"
}

archive_optional_directory() {
  local source="$1"
  local destination="$2"
  [[ -d "${source}" ]] || return 0
  tar -C "${source}" -cf "${destination}" .
}

normalized_args=()
for argument in "$@"; do
  case "${argument}" in
    --instance=*|--instances-dir=*|--output=*|--password-file=*)
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
    --instance|--instances-dir|--output|--password-file) require_value "$@" ;;
  esac
  case "$1" in
    --instance) INSTANCE="$2"; shift 2 ;;
    --instances-dir) INSTANCES_DIR="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --password-file) PASSWORD_FILE="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "${INSTANCE}" || ! "${INSTANCE}" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then
  echo "Informe --instance com um nome válido." >&2
  exit 2
fi
if [[ ! -d "${INSTANCES_DIR}" ]]; then
  echo "Diretório de instâncias não encontrado: ${INSTANCES_DIR}" >&2
  exit 1
fi
INSTANCES_DIR="$(cd "${INSTANCES_DIR}" && pwd -P)"
INSTANCE_DIR="${INSTANCES_DIR}/${INSTANCE}"
ENV_FILE="${INSTANCE_DIR}/.env"
if [[ ! -d "${INSTANCE_DIR}" || ! -f "${ENV_FILE}" ]]; then
  echo "Instância não encontrada: ${INSTANCE}" >&2
  exit 1
fi
for command in docker node tar; do
  command -v "${command}" >/dev/null 2>&1 || { echo "Comando obrigatório ausente: ${command}" >&2; exit 1; }
done
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || {
  echo "sha256sum ou shasum é obrigatório." >&2
  exit 1
}

prepare_password

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -z "${OUTPUT}" ]]; then
  OUTPUT="${INSTANCE_DIR}/backups/${INSTANCE}-${timestamp}.tar.gz.enc"
elif [[ "${OUTPUT}" != /* ]]; then
  OUTPUT="${PWD}/${OUTPUT}"
fi
mkdir -p "$(dirname "${OUTPUT}")"
output_directory="$(cd "$(dirname "${OUTPUT}")" && pwd -P)"
OUTPUT="${output_directory}/$(basename "${OUTPUT}")"
if [[ -e "${OUTPUT}" || -e "${OUTPUT}.sha256" ]]; then
  echo "O destino já existe: ${OUTPUT}" >&2
  exit 1
fi

STAGING_DIR="$(mktemp -d)"
PAYLOAD_DIR="${STAGING_DIR}/biaws-instance-backup"
mkdir -p "${PAYLOAD_DIR}/files" "${PAYLOAD_DIR}/instance"
PLAIN_ARCHIVE="${STAGING_DIR}/payload.tar.gz"

while IFS= read -r service; do
  [[ -n "${service}" && "${service}" != "mongo" ]] || continue
  RUNNING_SERVICES+=("${service}")
done < <(compose ps --services --filter status=running)
if [[ "${#RUNNING_SERVICES[@]}" -gt 0 ]]; then
  echo "Pausando serviços com escrita..."
  SERVICES_STOPPED=1
  compose stop "${RUNNING_SERVICES[@]}" >/dev/null
fi

mongo_db="$(read_env_value MONGO_DB)"
mongo_db="${mongo_db:-biaws}"
echo "Gerando dump lógico do MongoDB..."
compose exec -T mongo mongodump \
  --db="${mongo_db}" \
  --archive \
  --gzip > "${PAYLOAD_DIR}/mongo.archive.gz"

echo "Copiando volumes persistentes..."
for mapping in \
  "issues:/data/issues" \
  "requests:/data/requests" \
  "documents:/data/documents" \
  "secrets:/data/secrets"; do
  name="${mapping%%:*}"
  container_path="${mapping#*:}"
  compose run --rm -T --no-deps --entrypoint tar api \
    -C "${container_path}" -cf - . > "${PAYLOAD_DIR}/files/${name}.tar"
done

cp -p "${ENV_FILE}" "${PAYLOAD_DIR}/instance/environment.env"
copy_optional_file \
  "${INSTANCE_DIR}/.bootstrap-admin-password" \
  "${PAYLOAD_DIR}/instance/bootstrap-admin-password"

secrets_key_path="$(read_env_value BIAWS_SECRETS_KEY_PATH)"
secrets_key_path="${secrets_key_path:-$(read_env_value BIAWS_SECRETS_KEY_FILE)}"
secrets_key_path="${secrets_key_path:-${INSTANCE_DIR}/.secrets-master-key}"
secrets_key_path="$(resolve_host_path "${secrets_key_path}")"
if [[ ! -f "${secrets_key_path}" ]]; then
  echo "Chave mestra não encontrada: ${secrets_key_path}" >&2
  exit 1
fi
cp -p "${secrets_key_path}" "${PAYLOAD_DIR}/instance/secrets-master-key"

monitor_secrets_path="$(read_env_value BIAWS_MONITOR_SECRET_FILES_PATH)"
monitor_secrets_path="${monitor_secrets_path:-${INSTANCE_DIR}/monitor-secrets}"
monitor_secrets_path="$(resolve_host_path "${monitor_secrets_path}")"
archive_optional_directory \
  "${monitor_secrets_path}" \
  "${PAYLOAD_DIR}/instance/monitor-secrets.tar"

monitor_scripts_path="$(read_env_value BIAWS_MONITOR_SHELL_FILES_PATH)"
if [[ -n "${monitor_scripts_path}" ]]; then
  monitor_scripts_path="$(resolve_host_path "${monitor_scripts_path}")"
  archive_optional_directory \
    "${monitor_scripts_path}" \
    "${PAYLOAD_DIR}/instance/monitor-scripts.tar"
fi

cat > "${PAYLOAD_DIR}/manifest" <<EOF
format_version=1
source_instance=${INSTANCE}
created_at=${timestamp}
mongo_database=${mongo_db}
application_revision=$(git -C "${ROOT_DIR}" rev-parse HEAD 2>/dev/null || printf 'unknown')
encryption=openssl-aes-256-cbc-pbkdf2-sha256
pbkdf2_iterations=${PBKDF2_ITERATIONS}
EOF

restart_services

echo "Compactando e criptografando o backup..."
tar -C "${STAGING_DIR}" -czf "${PLAIN_ARCHIVE}" biaws-instance-backup
TEMP_OUTPUT="${OUTPUT}.tmp"
node "${CRYPTO_HELPER}" encrypt \
  --input "${PLAIN_ARCHIVE}" \
  --output "${TEMP_OUTPUT}" \
  --password-file "${PASSWORD_FILE}" \
  --iterations "${PBKDF2_ITERATIONS}"
chmod 600 "${TEMP_OUTPUT}"
mv "${TEMP_OUTPUT}" "${OUTPUT}"
TEMP_OUTPUT=""
create_sha256 "${OUTPUT}"

echo "Backup completo criado: ${OUTPUT}"
echo "Checksum: ${OUTPUT}.sha256"
