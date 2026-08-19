#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="${ROOT_DIR}/biaws-mcp"
MODE="dry-run"
NPM_CACHE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/biaws-mcp-npm-cache.XXXXXX")"

cleanup() {
  rm -rf "${NPM_CACHE_DIR}"
}
trap cleanup EXIT
export npm_config_cache="${NPM_CACHE_DIR}"

usage() {
  cat <<'EOF'
Uso:
  ./scripts/publish-biaws-mcp.sh [--dry-run]
  ./scripts/publish-biaws-mcp.sh --publish

O modo padrão valida testes e mostra o pacote sem publicá-lo.
--publish exige autenticação npm, árvore Git limpa e uma versão ainda inédita.
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --dry-run) MODE="dry-run" ;;
    --publish) MODE="publish" ;;
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
  shift
done

command -v node >/dev/null || { echo "Node.js não encontrado." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm não encontrado." >&2; exit 1; }

PACKAGE_NAME="$(node -p "require('${PACKAGE_DIR}/package.json').name")"
PACKAGE_VERSION="$(node -p "require('${PACKAGE_DIR}/package.json').version")"
if [[ "${PACKAGE_NAME}" != "biaws-mcp" ]]; then
  echo "Nome inesperado no package.json: ${PACKAGE_NAME}" >&2
  exit 1
fi

if [[ "${MODE}" == "publish" ]]; then
  if [[ -n "$(git -C "${ROOT_DIR}" status --porcelain --untracked-files=normal)" ]]; then
    echo "A publicação exige uma árvore Git limpa." >&2
    exit 1
  fi
  npm whoami >/dev/null

  registry_result="$(npm view "${PACKAGE_NAME}@${PACKAGE_VERSION}" version --json 2>&1)" && registry_status=0 || registry_status=$?
  if [[ "${registry_status}" == "0" ]]; then
    echo "${PACKAGE_NAME}@${PACKAGE_VERSION} já existe no npm." >&2
    exit 1
  fi
  if [[ "${registry_result}" != *"E404"* ]]; then
    echo "Não foi possível confirmar a disponibilidade da versão no npm:" >&2
    echo "${registry_result}" >&2
    exit 1
  fi
fi

cd "${PACKAGE_DIR}"
npm run release:check
npm pack --dry-run

if [[ "${MODE}" == "dry-run" ]]; then
  echo "Dry-run concluído; nada foi publicado."
  exit 0
fi

npm publish --access public
