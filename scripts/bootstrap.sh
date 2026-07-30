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

compose exec -T \
  -e "BIAWS_BOOTSTRAP_ADMIN_EMAIL=${admin_email}" \
  -e "BIAWS_BOOTSTRAP_ADMIN_NAME=${admin_name}" \
  -e "BIAWS_BOOTSTRAP_ADMIN_PASSWORD=${admin_password}" \
  api npm run bootstrap:admin

agent_api_key="$(read_env_value "ISSUE_API_KEY")"
agent_workspace_id="$(read_env_value "ISSUE_WORKSPACE_ID")"
agent_key_valid=0
if [[ -n "${agent_api_key}" ]]; then
  auth_headers=(-H "Authorization: Bearer ${agent_api_key}")
  if [[ -n "${agent_workspace_id}" ]]; then
    auth_headers+=(-H "X-Biaws-Workspace-Id: ${agent_workspace_id}")
  fi
  if curl --fail --silent "${auth_headers[@]}" \
    "http://127.0.0.1:${api_port}/api/auth/me" >/dev/null; then
    agent_key_valid=1
  fi
fi

if [[ "${agent_key_valid}" != "1" ]]; then
  agent_output="$(
    compose exec -T \
      -e "BIAWS_BOOTSTRAP_AGENT_EMAIL=${BIAWS_BOOTSTRAP_AGENT_EMAIL:-agent@localhost.invalid}" \
      -e "BIAWS_BOOTSTRAP_AGENT_NAME=${BIAWS_BOOTSTRAP_AGENT_NAME:-Bondia Workspaces Agent}" \
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
    echo "Não foi possível criar a credencial técnica do agente." >&2
    exit 1
  fi
  replace_env_value "ISSUE_API_KEY" "${agent_api_key}"
  replace_env_value "ISSUE_WORKSPACE_ID" "${agent_workspace_id}"
  chmod 600 "${ENV_FILE}"
  echo "Identidade técnica e chave do agente configuradas no .env local."
fi

compose exec -T api npm run seed:skills

if [[ "${BIAWS_SKIP_DEMO_SEED:-0}" != "1" ]]; then
  compose exec -T api npm run seed:demo
fi

if [[ -n "${INSTANCE}" ]]; then
  setup_hint="Execute ./scripts/setup-agent.sh --instance ${INSTANCE} --client codex|claude para configurar outro projeto."
else
  setup_hint="Modo legado ativo. Prefira ./scripts/setup-agent.sh --instance <nome> em novas instalações."
fi

cat <<EOF

Bondia Workspaces está disponível:
  Instância: ${INSTANCE:-legado}
  UI:  http://localhost:${ui_port}
  API: http://localhost:${api_port}

Administrador inicial:
  E-mail: ${admin_email}
  Senha:  ${admin_password}

A senha inicial foi preservada em ${PASSWORD_FILE}, fora do Git.
Troque-a pela UI após o primeiro acesso.

A credencial técnica do MCP e do CLI foi gravada somente em ${ENV_FILE}.
${setup_hint}
EOF
