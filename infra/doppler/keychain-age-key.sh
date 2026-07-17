#!/usr/bin/env bash
# Prints the AoM SOPS age identity from macOS Keychain for SOPS_AGE_KEY_CMD.
set -euo pipefail

readonly KEYCHAIN_SERVICE="${SOPS_KEYCHAIN_SERVICE:-com.aom.sops.age}"
readonly KEYCHAIN_ACCOUNT="${SOPS_KEYCHAIN_ACCOUNT:-$(id -un)}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: the Keychain SOPS adapter is only supported on macOS" >&2
  exit 1
fi

exec security find-generic-password \
  -a "${KEYCHAIN_ACCOUNT}" \
  -s "${KEYCHAIN_SERVICE}" \
  -w
