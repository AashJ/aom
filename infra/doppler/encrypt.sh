#!/usr/bin/env bash
# Re-encrypts the edited plaintext through SOPS while minimizing diff noise.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if ! command -v sops >/dev/null 2>&1; then
  echo "error: sops is required; see infra/README.md" >&2
  exit 1
fi

if [[ ! -f secrets.decrypted.yaml ]]; then
  echo "error: secrets.decrypted.yaml not found; run ./decrypt.sh first" >&2
  exit 1
fi

if [[ ! -f secrets.sops.yaml ]]; then
  echo "error: secrets.sops.yaml not found; run ./bootstrap-keychain.sh first" >&2
  exit 1
fi

editor_shim="$(mktemp "${TMPDIR:-/tmp}/aom-sops-editor.XXXXXX")"
cleanup() {
  rm -f "${editor_shim}"
}
trap cleanup EXIT

printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  "cp '${SCRIPT_DIR}/secrets.decrypted.yaml' \"\$1\"" >"${editor_shim}"
chmod +x "${editor_shim}"

SOPS_AGE_KEY_CMD="${SCRIPT_DIR}/keychain-age-key.sh" \
  EDITOR="${editor_shim}" \
  SOPS_EDITOR="${editor_shim}" \
  sops secrets.sops.yaml

echo "Updated secrets.sops.yaml. Review the diff, then apply infra/doppler."
