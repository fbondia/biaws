#!/usr/bin/env bash

set -euo pipefail

INCLUDE_GIT=0
QUIET=0

usage() {
  cat <<'EOF'
Uso:
  ./scripts/check-prerequisites.sh [--include-git] [--quiet]

Verifica o ambiente necessário para instalar e executar o Bondia Workspaces.

Opções:
  --include-git  Verifica também o Git, necessário para clonar e atualizar o repositório
  --quiet        Mostra somente erros
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --include-git)
      INCLUDE_GIT=1
      shift
      ;;
    --quiet)
      QUIET=1
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

platform=""
case "$(uname -s 2>/dev/null || true)" in
  Darwin)
    platform="macOS"
    ;;
  Linux)
    if [[ -r /proc/sys/kernel/osrelease ]] &&
      grep -qi microsoft /proc/sys/kernel/osrelease; then
      platform="Windows com WSL2"
    else
      platform="Linux"
    fi
    ;;
  CYGWIN*|MINGW*|MSYS*)
    cat >&2 <<'EOF'
Windows nativo, Git Bash, MSYS2 e Cygwin não são suportados pelo instalador.
Ative o WSL2, instale uma distribuição Linux e execute o setup dentro dela:
https://learn.microsoft.com/windows/wsl/install
EOF
    exit 1
    ;;
  *)
    echo "Sistema não suportado pelo instalador: $(uname -s 2>/dev/null || echo desconhecido)." >&2
    exit 1
    ;;
esac

errors=0

require_command() {
  local command_name="$1"
  local install_hint="$2"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "ERRO  ${command_name} não encontrado. ${install_hint}" >&2
    errors=$((errors + 1))
  fi
}

if [[ "${INCLUDE_GIT}" == "1" ]]; then
  require_command git "Instale o Git antes de clonar ou atualizar o BIAWS."
fi
require_command node "Instale Node.js 20.19 ou superior; Node.js 22 LTS é recomendado."
require_command docker "Instale Docker com o plugin Compose."
require_command curl "Instale curl."
require_command openssl "Instale OpenSSL."
require_command awk "Instale as ferramentas básicas do sistema Unix."
require_command mktemp "Instale as ferramentas básicas do sistema Unix."

if command -v node >/dev/null 2>&1; then
  if ! node -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1);
  '; then
    echo "ERRO  Node.js 20.19 ou superior é necessário; versão atual: $(node --version)." >&2
    errors=$((errors + 1))
  fi
fi

if command -v docker >/dev/null 2>&1; then
  if ! docker compose version >/dev/null 2>&1; then
    echo "ERRO  O plugin Docker Compose não está disponível." >&2
    errors=$((errors + 1))
  elif ! docker info >/dev/null 2>&1; then
    case "${platform}" in
      macOS)
        hint="Abra o Docker Desktop e aguarde o engine iniciar."
        ;;
      "Windows com WSL2")
        hint="Abra o Docker Desktop e habilite a integração com esta distribuição WSL2."
        ;;
      *)
        hint="Inicie o Docker Engine e confirme que seu usuário pode acessá-lo."
        ;;
    esac
    echo "ERRO  O Docker está instalado, mas o engine não está acessível. ${hint}" >&2
    errors=$((errors + 1))
  fi
fi

if [[ "${errors}" -gt 0 ]]; then
  echo "Consulte as instruções específicas do seu sistema em QUICKSTART.md." >&2
  exit 1
fi

if [[ "${QUIET}" != "1" ]]; then
  echo "OK  Sistema: ${platform}"
  [[ "${INCLUDE_GIT}" != "1" ]] || echo "OK  Git: $(git --version)"
  echo "OK  Node.js: $(node --version)"
  echo "OK  Docker: $(docker --version)"
  echo "OK  Compose: $(docker compose version --short 2>/dev/null || docker compose version)"
  echo "OK  curl e OpenSSL"
  echo "Ambiente pronto para instalar o Bondia Workspaces."
fi
