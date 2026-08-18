#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Esta rota existe para deixar explícito que nenhum serviço é criado na máquina
# cliente. Toda a validação e escrita de configuração fica em configure.sh.
exec "${ROOT_DIR}/scripts/configure.sh" "$@"
