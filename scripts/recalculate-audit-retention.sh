#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_ARGS=(node dist/biaws-api/src/scripts/recalculateAuditRetention.js)
COMPOSE_ARGS=(--project-directory "${ROOT_DIR}")

usage() {
  cat <<'EOF'
Uso:
  ./scripts/recalculate-audit-retention.sh [--apply] [-- <opções Docker Compose>]

Sem --apply, apenas mostra contagens. Com --apply, recalcula expiresAt a partir
de occurredAt usando BIAWS_AUDIT_RETENTION_DAYS da API em execução. Com 0,
remove expiresAt. Datas ausentes ou inválidas são contadas e não são inventadas.
Registros vencidos ficam sujeitos à exclusão automática pelo MongoDB.

Exemplo para uma instância:
  ./scripts/recalculate-audit-retention.sh --apply -- \
    --env-file instances/producao/.env --project-name biaws-producao

A imagem da API deve conter a implementação de retenção de auditoria.
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --apply) MIGRATION_ARGS+=(--apply); shift ;;
    --help|-h) usage; exit 0 ;;
    --) shift; COMPOSE_ARGS+=("$@"); break ;;
    *) echo "Opção desconhecida: $1" >&2; usage >&2; exit 2 ;;
  esac
done

docker compose "${COMPOSE_ARGS[@]}" exec -T api "${MIGRATION_ARGS[@]}"
