#!/usr/bin/env bash
# Decrypts secrets.sops.yaml into a gitignored, owner-readable editing file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if ! command -v sops >/dev/null 2>&1; then
  echo "error: sops is required; see infra/README.md" >&2
  exit 1
fi

if [[ ! -f secrets.sops.yaml ]]; then
  echo "error: secrets.sops.yaml not found; run ./bootstrap-keychain.sh first" >&2
  exit 1
fi

umask 077
SOPS_AGE_KEY_CMD="${SCRIPT_DIR}/keychain-age-key.sh" \
  sops decrypt secrets.sops.yaml >secrets.decrypted.yaml
chmod 600 secrets.decrypted.yaml

echo "Wrote secrets.decrypted.yaml. Edit it, then run ./encrypt.sh."
