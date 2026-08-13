#!/usr/bin/env bash

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTANCE=""

usage() {
  cat <<'EOF'
Uso:
  ./scripts/manage-monitoring-workspaces.sh --instance <nome> <ação> [workspace ...]

Ações:
  build       constrói uma única imagem do executor para a instância
  validate    valida arquivos, segredos e a configuração Compose
  start       inicia e aguarda os executores selecionados
  stop        interrompe os executores selecionados
  status      mostra o estado dos executores selecionados
  logs        mostra os últimos logs dos executores selecionados
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --instance)
      INSTANCE="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

ACTION="${1:-}"
if [[ -z "${INSTANCE}" || ! "${INSTANCE}" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then
  echo "Informe uma instância válida com --instance." >&2
  usage >&2
  exit 2
fi
if [[ ! "${ACTION}" =~ ^(build|validate|start|stop|status|logs)$ ]]; then
  echo "Ação inválida: ${ACTION:-<vazia>}." >&2
  usage >&2
  exit 2
fi
shift

INSTANCE_DIR="${ROOT_DIR}/instances/${INSTANCE}"
MONITORING_DIR="${INSTANCE_DIR}/monitoring"
WORKSPACES_DIR="${MONITORING_DIR}/workspaces"
COMPOSE_FILE="${ROOT_DIR}/docker/monitoring.compose.yaml"
API_NETWORK="biaws-${INSTANCE}_default"
IMAGE="biaws-monitor-executor:${INSTANCE}"

workspace_directories=()
if [[ "$#" -gt 0 ]]; then
  for workspace in "$@"; do
    if [[ ! "${workspace}" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then
      echo "Identificador de workspace inválido: ${workspace}." >&2
      exit 2
    fi
    workspace_directories+=("${WORKSPACES_DIR}/${workspace}")
  done
else
  for env_file in "${WORKSPACES_DIR}"/*/.env; do
    [[ -f "${env_file}" ]] || continue
    workspace_directories+=("$(dirname "${env_file}")")
  done
fi

if [[ "${ACTION}" == "build" ]]; then
  docker build \
    --file "${ROOT_DIR}/docker/monitor-executor.Dockerfile" \
    --tag "${IMAGE}" \
    "${ROOT_DIR}"
  exit $?
fi

if [[ "${#workspace_directories[@]}" -eq 0 ]]; then
  echo "Nenhum workspace configurado em ${WORKSPACES_DIR}." >&2
  exit 1
fi

if [[ "${ACTION}" == "start" || "${ACTION}" == "validate" ]]; then
  if ! docker network inspect "${API_NETWORK}" >/dev/null 2>&1; then
    echo "A rede ${API_NETWORK} não existe; inicie primeiro a instância ${INSTANCE}." >&2
    exit 1
  fi
fi
if [[ "${ACTION}" == "start" ]] && ! docker image inspect "${IMAGE}" >/dev/null 2>&1; then
  "${BASH_SOURCE[0]}" --instance "${INSTANCE}" build || exit $?
fi

failures=0
for workspace_dir in "${workspace_directories[@]}"; do
  workspace="$(basename "${workspace_dir}")"
  env_file="${workspace_dir}/.env"
  api_key_file="${workspace_dir}/secrets/executor-api-key"
  project_name="biaws-${INSTANCE}-monitor-${workspace}"

  if [[ ! -f "${env_file}" ]]; then
    echo "[${workspace}] arquivo ausente: ${env_file}" >&2
    failures=$((failures + 1))
    continue
  fi
  if [[ ! -s "${api_key_file}" ]]; then
    echo "[${workspace}] credencial ausente: ${api_key_file}" >&2
    failures=$((failures + 1))
    continue
  fi
  mkdir -p "${workspace_dir}/scripts"

  compose=(
    docker compose
    --file "${COMPOSE_FILE}"
    --env-file "${env_file}"
    --project-name "${project_name}"
  )
  exported=(
    "BIAWS_MONITOR_WORKSPACE_DIR=${workspace_dir}"
    "BIAWS_MONITOR_API_NETWORK=${API_NETWORK}"
    "BIAWS_MONITOR_EXECUTOR_IMAGE=${IMAGE}"
  )

  echo "[${workspace}] ${ACTION}"
  case "${ACTION}" in
    validate)
      env "${exported[@]}" "${compose[@]}" config --quiet || failures=$((failures + 1))
      ;;
    start)
      env "${exported[@]}" "${compose[@]}" up -d --wait executor || failures=$((failures + 1))
      ;;
    stop)
      env "${exported[@]}" "${compose[@]}" stop executor || failures=$((failures + 1))
      ;;
    status)
      env "${exported[@]}" "${compose[@]}" ps executor || failures=$((failures + 1))
      ;;
    logs)
      env "${exported[@]}" "${compose[@]}" logs --tail "${BIAWS_MONITOR_LOG_TAIL:-200}" executor || failures=$((failures + 1))
      ;;
  esac
done

if [[ "${failures}" -gt 0 ]]; then
  echo "A operação terminou com falha em ${failures} workspace(s)." >&2
  exit 1
fi
