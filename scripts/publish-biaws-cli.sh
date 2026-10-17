#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_DIR="${ROOT_DIR}/biaws-cli"
MODE="dry-run"
NPM_CACHE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/biaws-npm-cache.XXXXXX")"

cleanup() {
  rm -rf "${NPM_CACHE_DIR}"
}
trap cleanup EXIT
export npm_config_cache="${NPM_CACHE_DIR}"

usage() {
  cat <<'EOF'
Uso:
  ./scripts/publish-biaws-cli.sh [--dry-run]
  ./scripts/publish-biaws-cli.sh --publish

O modo padrão valida testes e mostra o conteúdo do pacote sem publicá-lo.
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

PACKAGE_NAME="$(node -p "require('${CLI_DIR}/package.json').name")"
PACKAGE_VERSION="$(node -p "require('${CLI_DIR}/package.json').version")"
if [[ "${PACKAGE_NAME}" != "biaws" ]]; then
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

  MCP_PACKAGE_SPEC="$(node -e '
    const source = require("node:fs").readFileSync(process.argv[1], "utf8");
    const version = source.match(/export const MCP_PACKAGE_VERSION = "(\d+\.\d+\.\d+)";/u)?.[1];
    if (!version) process.exit(1);
    process.stdout.write("biaws-mcp@" + version);
  ' "${CLI_DIR}/src/commands/agent.js")"
  published_mcp_version="$(npm view "${MCP_PACKAGE_SPEC}" version --json)" || {
    echo "Publique e valide ${MCP_PACKAGE_SPEC} antes do CLI." >&2
    exit 1
  }
  if [[ "${published_mcp_version}" != "\"${MCP_PACKAGE_SPEC#*@}\"" ]]; then
    echo "A versão publicada de ${MCP_PACKAGE_SPEC} não foi confirmada; publicação do CLI recusada." >&2
    exit 1
  fi
fi

cd "${CLI_DIR}"
npm run release:check
npm pack --dry-run

if [[ "${MODE}" == "dry-run" ]]; then
  echo "Dry-run concluído; nada foi publicado."
  exit 0
fi

npm publish --access public
