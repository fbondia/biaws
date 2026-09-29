#!/usr/bin/env bash
set -u

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
result=0
for module in biaws-api biaws-ui biaws-cli biaws-mcp; do
  echo "== ${module}: tests =="
  if [[ "${module}" == "biaws-api" ]]; then
    (cd "${root}/${module}" && npm run test:coverage)
  else
    (cd "${root}/${module}" && npm test)
  fi
  tests_status=$?
  if [[ "${tests_status}" -ne 0 ]]; then
    echo "${module}: tests failed (${tests_status})" >&2
    result=1
  fi

  echo "== ${module}: scanner =="
  module_token="${SONAR_TOKEN:-}"
  local_settings="${root}/${module}/sonar-project.properties"
  if [[ -r "${local_settings}" ]]; then
    local_token="$(sed -n 's/^sonar.token=//p' "${local_settings}")"
    if [[ -n "${local_token}" ]]; then
      module_token="${local_token}"
    fi
  fi
  if [[ -z "${module_token}" ]]; then
    echo "${module}: scanner credential unavailable" >&2
    result=1
    continue
  fi
  if [[ "${module}" == "biaws-api" ]]; then
    (cd "${root}/${module}" && SONAR_TOKEN="${module_token}" sonar-scanner -Dproject.settings=sonar-project.properties.example)
  else
    (cd "${root}/${module}" && SONAR_TOKEN="${module_token}" sonar-scanner)
  fi
  scanner_status=$?
  if [[ "${scanner_status}" -ne 0 ]]; then
    echo "${module}: scanner failed (${scanner_status})" >&2
    result=1
  fi
done
exit "${result}"
