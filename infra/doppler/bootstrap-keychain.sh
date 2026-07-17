#!/usr/bin/env bash
# Creates or reuses a Keychain-backed age identity and initializes SOPS files.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

readonly KEYCHAIN_SERVICE="${SOPS_KEYCHAIN_SERVICE:-com.aom.sops.age}"
readonly KEYCHAIN_ACCOUNT="${SOPS_KEYCHAIN_ACCOUNT:-$(id -un)}"

for tool in age-keygen sops security; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "error: ${tool} is required; see infra/README.md" >&2
    exit 1
  fi
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: the Keychain bootstrap is only supported on macOS" >&2
  exit 1
fi

if [[ -e secrets.sops.yaml ]]; then
  echo "error: secrets.sops.yaml already exists; refusing to overwrite" >&2
  exit 1
fi

identity=""
if security find-generic-password \
  -a "${KEYCHAIN_ACCOUNT}" \
  -s "${KEYCHAIN_SERVICE}" \
  -w >/dev/null 2>&1; then
  identity="$(security find-generic-password \
    -a "${KEYCHAIN_ACCOUNT}" \
    -s "${KEYCHAIN_SERVICE}" \
    -w)"
  echo "Using existing ${KEYCHAIN_SERVICE} identity from Keychain."
else
  identity="$(age-keygen 2>/dev/null | awk '/^AGE-SECRET-KEY-/ { print; exit }')"
  if [[ -z "${identity}" ]]; then
    echo "error: age-keygen did not produce an identity" >&2
    exit 1
  fi

  security add-generic-password \
    -U \
    -a "${KEYCHAIN_ACCOUNT}" \
    -s "${KEYCHAIN_SERVICE}" \
    -w "${identity}" >/dev/null
  echo "Stored a new age identity in Keychain service ${KEYCHAIN_SERVICE}."
fi

identity_file="$(mktemp "${TMPDIR:-/tmp}/aom-sops-age.XXXXXX")"
plaintext_file="$(mktemp "${TMPDIR:-/tmp}/aom-secrets.XXXXXX")"
encrypted_file="$(mktemp "${TMPDIR:-/tmp}/aom-secrets-encrypted.XXXXXX")"
config_file="$(mktemp "${TMPDIR:-/tmp}/aom-sops-config.XXXXXX")"
cleanup() {
  rm -f "${identity_file}" "${plaintext_file}" "${encrypted_file}" "${config_file}"
}
trap cleanup EXIT
chmod 600 "${identity_file}" "${plaintext_file}" "${encrypted_file}" "${config_file}"
printf '%s\n' "${identity}" >"${identity_file}"

recipient="$(age-keygen -y "${identity_file}")"
if [[ -z "${recipient}" ]]; then
  echo "error: could not derive the public age recipient" >&2
  exit 1
fi

if [[ -f .sops.yaml ]]; then
  existing_recipient="$(awk '$1 == "age:" { print $2; exit }' .sops.yaml)"
  if [[ "${existing_recipient}" != "${recipient}" ]]; then
    echo "error: .sops.yaml does not match the Keychain identity; refusing to overwrite" >&2
    exit 1
  fi
  echo "Using existing .sops.yaml recipient."
else
  printf '%s\n' \
    "creation_rules:" \
    "  - path_regex: secrets\\.sops\\.yaml$" \
    "    age: ${recipient}" >"${config_file}"
  mv "${config_file}" .sops.yaml
fi

cp secrets.template.yaml "${plaintext_file}"
SOPS_AGE_KEY_CMD="${SCRIPT_DIR}/keychain-age-key.sh" \
  sops --config "${SCRIPT_DIR}/.sops.yaml" \
  encrypt \
  --filename-override "${SCRIPT_DIR}/secrets.sops.yaml" \
  "${plaintext_file}" >"${encrypted_file}"
mv "${encrypted_file}" secrets.sops.yaml

echo "Created .sops.yaml and secrets.sops.yaml."
echo "Run ./decrypt.sh, replace every REPLACE_ME, then run ./encrypt.sh."
