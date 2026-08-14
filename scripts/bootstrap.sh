#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTANCE="${BIAWS_INSTANCE:-}"
INSTANCES_DIR="${BIAWS_INSTANCES_DIR:-${ROOT_DIR}/instances}"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --instance)
      INSTANCE="${2:-}"
      shift 2
      ;;
    --instances-dir)
      INSTANCES_DIR="${2:-}"
      shift 2
      ;;
    --help|-h)
      cat <<'EOF'
Uso:
  ./scripts/bootstrap.sh [--instance <nome>] [--instances-dir <diretório>]

Sem --instance, mantém o modo legado com .env na raiz do repositório.
EOF
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -n "${INSTANCE}" ]]; then
  if [[ ! "${INSTANCE}" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then
    echo "Nome de instância inválido: use letras minúsculas, números e hífens." >&2
    exit 2
  fi
  INSTANCE_DIR="${BIAWS_INSTANCE_DIR:-${INSTANCES_DIR}/${INSTANCE}}"
  ENV_FILE="${BIAWS_ENV_FILE:-${INSTANCE_DIR}/.env}"
  PASSWORD_FILE="${BIAWS_PASSWORD_FILE:-${INSTANCE_DIR}/.bootstrap-admin-password}"
  COMPOSE_PROJECT="biaws-${INSTANCE}"
  mkdir -p "${INSTANCE_DIR}"
else
  INSTANCE_DIR="${ROOT_DIR}"
  ENV_FILE="${BIAWS_ENV_FILE:-${ROOT_DIR}/.env}"
  PASSWORD_FILE="${BIAWS_PASSWORD_FILE:-${ROOT_DIR}/.bootstrap-admin-password}"
  COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-biaws}"
fi

cd "${ROOT_DIR}"

"${ROOT_DIR}/scripts/check-prerequisites.sh" --quiet

compose() {
  docker compose \
    --env-file "${ENV_FILE}" \
    --project-name "${COMPOSE_PROJECT}" \
    "$@"
}

read_env_value() {
  local key="$1"
  awk -F= -v key="${key}" '
    $1 == key { print substr($0, index($0, "=") + 1) }
  ' "${ENV_FILE}" | tail -n 1
}

replace_env_value() {
  local key="$1"
  local value="$2"
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
  ' "${ENV_FILE}" > "${temporary_file}"

  mv "${temporary_file}" "${ENV_FILE}"
}

remove_env_value() {
  local key="$1"
  local temporary_file
  temporary_file="$(mktemp)"
  awk -v key="${key}" 'index($0, key "=") != 1 { print }' "${ENV_FILE}" > "${temporary_file}"
  mv "${temporary_file}" "${ENV_FILE}"
}

if [[ ! -f "${ENV_FILE}" ]]; then
  cp .env.example "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  echo "Arquivo de ambiente criado em ${ENV_FILE}."
fi

current_secret="$(read_env_value "BETTER_AUTH_SECRET")"
if [[ -z "${current_secret}" ]]; then
  replace_env_value "BETTER_AUTH_SECRET" "$(openssl rand -hex 32)"
  echo "BETTER_AUTH_SECRET gerado e gravado no .env local."
fi

secrets_key_path="$(read_env_value "BIAWS_SECRETS_KEY_PATH")"
if [[ -z "${secrets_key_path}" ]]; then
  configured_key_file="$(read_env_value "BIAWS_SECRETS_KEY_FILE")"
  if [[ "${configured_key_file}" == /* ]]; then
    secrets_key_path="${configured_key_file}"
  else
    secrets_key_path="${INSTANCE_DIR}/.secrets-master-key"
  fi
fi
if [[ "${secrets_key_path}" != /* ]]; then
  secrets_key_path="${ROOT_DIR}/${secrets_key_path}"
fi
mkdir -p "$(dirname "${secrets_key_path}")"
if [[ ! -f "${secrets_key_path}" ]]; then
  openssl rand 32 > "${secrets_key_path}"
  chmod 600 "${secrets_key_path}"
  echo "Chave mestra do cofre local gerada fora do volume de segredos."
fi
if [[ "$(wc -c < "${secrets_key_path}" | tr -d ' ')" != "32" ]]; then
  echo "BIAWS_SECRETS_KEY_PATH deve apontar para um arquivo binário de 32 bytes." >&2
  exit 1
fi
chmod 600 "${secrets_key_path}"
replace_env_value "BIAWS_SECRETS_KEY_PATH" "${secrets_key_path}"
replace_env_value "BIAWS_SECRETS_KEY_FILE" "${secrets_key_path}"

secret_files_path="$(read_env_value "BIAWS_SECRET_FILES_PATH")"
if [[ -n "${secret_files_path}" ]]; then
  replace_env_value "BIAWS_SECRETS_DIR" "${secret_files_path}"
fi

admin_email="${BIAWS_BOOTSTRAP_ADMIN_EMAIL:-admin@example.com}"
admin_name="${BIAWS_BOOTSTRAP_ADMIN_NAME:-Administrador}"

if [[ -n "${BIAWS_BOOTSTRAP_ADMIN_PASSWORD:-}" ]]; then
  admin_password="${BIAWS_BOOTSTRAP_ADMIN_PASSWORD}"
elif [[ -f "${PASSWORD_FILE}" ]]; then
  admin_password="$(<"${PASSWORD_FILE}")"
else
  admin_password="$(openssl rand -hex 16)"
  printf '%s' "${admin_password}" > "${PASSWORD_FILE}"
  chmod 600 "${PASSWORD_FILE}"
fi

api_port="${ISSUE_API_PORT:-$(read_env_value "ISSUE_API_PORT")}"
ui_port="${ISSUE_UI_PORT:-$(read_env_value "ISSUE_UI_PORT")}"
api_port="${api_port:-3100}"
ui_port="${ui_port:-4400}"

compose up -d --build

echo "Aguardando a API ficar disponível..."
for attempt in $(seq 1 60); do
  if curl --fail --silent "http://127.0.0.1:${api_port}/api/health" >/dev/null; then
    break
  fi
  if [[ "${attempt}" -eq 60 ]]; then
    echo "A API não ficou disponível dentro do tempo esperado." >&2
    compose logs api
    exit 1
  fi
  sleep 2
done

admin_output="$(
  compose exec -T \
    -e "BIAWS_BOOTSTRAP_ADMIN_EMAIL=${admin_email}" \
    -e "BIAWS_BOOTSTRAP_ADMIN_NAME=${admin_name}" \
    -e "BIAWS_BOOTSTRAP_ADMIN_PASSWORD=${admin_password}" \
    api npm run bootstrap:admin
)"
printf '%s\n' "${admin_output}"
admin_created="$(
  printf '%s\n' "${admin_output}" |
    awk -F= '$1 == "BIAWS_BOOTSTRAP_ADMIN_CREATED" { print $2 }' |
    tail -n 1
)"

agent_api_key="$(read_env_value "ISSUE_API_KEY")"
agent_output="$(
  compose exec -T \
    -e "BIAWS_BOOTSTRAP_AGENT_EMAIL=${BIAWS_BOOTSTRAP_AGENT_EMAIL:-agent@localhost.invalid}" \
    -e "BIAWS_BOOTSTRAP_AGENT_NAME=${BIAWS_BOOTSTRAP_AGENT_NAME:-Bondia Workspaces Agent}" \
    -e "BIAWS_BOOTSTRAP_AGENT_API_KEY=${agent_api_key}" \
    api npm run --silent bootstrap:agent
)"
agent_api_key="$(
  printf '%s\n' "${agent_output}" |
    awk -F= '$1 == "BIAWS_AGENT_API_KEY" { print substr($0, index($0, "=") + 1) }' |
    tail -n 1
)"
agent_workspace_id="$(
  printf '%s\n' "${agent_output}" |
    awk -F= '$1 == "BIAWS_AGENT_WORKSPACE_ID" { print substr($0, index($0, "=") + 1) }' |
    tail -n 1
)"
if [[ -z "${agent_api_key}" || -z "${agent_workspace_id}" ]]; then
  echo "Não foi possível configurar a credencial técnica do agente." >&2
  exit 1
fi
replace_env_value "ISSUE_API_KEY" "${agent_api_key}"
remove_env_value "ISSUE_WORKSPACE_ID"
chmod 600 "${ENV_FILE}"
echo "Identidade técnica e rate limit da chave do agente reconciliados."

monitor_secret_files_path="$(read_env_value "BIAWS_MONITOR_SECRET_FILES_PATH")"
monitor_secret_files_path="${monitor_secret_files_path:-${INSTANCE_DIR}/monitor-secrets}"
if [[ "${monitor_secret_files_path}" != /* ]]; then
  monitor_secret_files_path="${ROOT_DIR}/${monitor_secret_files_path}"
fi
mkdir -p "${monitor_secret_files_path}"
chmod 700 "${monitor_secret_files_path}"
monitor_secret_files_path="$(cd "${monitor_secret_files_path}" && pwd -P)"
monitor_api_key_path="${monitor_secret_files_path}/executor-api-key"
existing_monitor_api_key=""
if [[ -f "${monitor_api_key_path}" ]]; then
  existing_monitor_api_key="$(<"${monitor_api_key_path}")"
fi
monitor_output="$(
  compose exec -T \
    -e "BIAWS_BOOTSTRAP_MONITOR_EXECUTOR_API_KEY=${existing_monitor_api_key}" \
    api npm run --silent bootstrap:monitor-executor
)"
monitor_api_key="$(
  printf '%s\n' "${monitor_output}" |
    awk -F= '$1 == "BIAWS_MONITOR_EXECUTOR_API_KEY" { print substr($0, index($0, "=") + 1) }' |
    tail -n 1
)"
monitor_workspace_id="$(
  printf '%s\n' "${monitor_output}" |
    awk -F= '$1 == "BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID" { print substr($0, index($0, "=") + 1) }' |
    tail -n 1
)"
if [[ -z "${monitor_api_key}" || -z "${monitor_workspace_id}" ]]; then
  echo "Não foi possível configurar a credencial técnica do executor." >&2
  exit 1
fi
printf '%s' "${monitor_api_key}" > "${monitor_api_key_path}"
chmod 600 "${monitor_api_key_path}"
replace_env_value "BIAWS_MONITOR_SECRET_FILES_PATH" "${monitor_secret_files_path}"
replace_env_value "BIAWS_MONITOR_EXECUTOR_UID" "$(id -u)"
replace_env_value "BIAWS_MONITOR_EXECUTOR_GID" "$(id -g)"
remove_env_value "BIAWS_MONITOR_EXECUTOR_API_KEY_PATH"
replace_env_value "BIAWS_MONITOR_EXECUTOR_API_KEY" ""
replace_env_value "BIAWS_MONITOR_EXECUTOR_API_KEY_FILE" "/run/secrets/executor-api-key"
replace_env_value "BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID" "${monitor_workspace_id}"
chmod 600 "${ENV_FILE}"
echo "Identidade técnica exclusiva do executor reconciliada em arquivo protegido."

compose exec -T api npm run seed:skills

if [[ "${BIAWS_SKIP_DEMO_SEED:-0}" != "1" ]]; then
  compose exec -T api npm run seed:demo
fi

if [[ -n "${INSTANCE}" ]]; then
  setup_hint="Execute ./scripts/setup-agent.sh --instance ${INSTANCE} --client codex|claude para configurar outro projeto."
else
  setup_hint="Modo legado ativo. Prefira ./scripts/setup-agent.sh --instance <nome> em novas instalações."
fi

if [[ "${admin_created}" == "true" ]]; then
  admin_summary="Administrador inicial:
  E-mail: ${admin_email}
  Senha:  ${admin_password}

A senha inicial foi preservada em ${PASSWORD_FILE}, fora do Git.
Troque-a pela UI após o primeiro acesso."
else
  admin_summary="Administrador ativo já existente; a senha não foi exibida."
fi

cat <<EOF

Bondia Workspaces está disponível:
  Instância: ${INSTANCE:-legado}
  UI:  http://localhost:${ui_port}
  API: http://localhost:${api_port}

${admin_summary}

A credencial técnica do MCP e do CLI foi gravada somente em ${ENV_FILE}.
Workspace inicial da identidade técnica: ${agent_workspace_id}
O executor possui identidade exclusiva no workspace ${monitor_workspace_id}; a chave está em ${monitor_api_key_path}.
O workspace de cada projeto é gravado na configuração MCP pelo setup-agent.
${setup_hint}
EOF
