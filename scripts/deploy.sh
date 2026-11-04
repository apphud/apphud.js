#!/usr/bin/env bash
# Uploads a built SDK file to Azure Blob Storage and purges the Front Door cache.
#
#   dist/apphud.js             -> web/v2/apphud.js           (https://js.apphud.com/web/v2/apphud.js)
#   dist/v3/apphud-checkout.js -> web/v3/apphud-checkout.js  (https://js.apphud.com/web/v3/apphud-checkout.js)
#
# The file currently in Azure is kept as *.previous.js before it is overwritten.
# Requires the Azure CLI (`brew install azure-cli`) and `az login`.

set -euo pipefail

SUBSCRIPTION="f7a0b81d-6684-44fd-bbb4-9b5e7255c06c"
RESOURCE_GROUP="apphud_group"
STORAGE_ACCOUNT="apphud"
CONTAINER="web"
AFD_PROFILE="apphud"
AFD_ENDPOINT="apphud"
AFD_DOMAINS=("js.apphud.com" "apphud.azureedge.net")
PUBLIC_HOST="https://js.apphud.com"
CONTENT_TYPE="text/javascript"

cd "$(dirname "$0")/.."

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
divider() { printf '%*s\n' 64 '' | tr ' ' '-'; }

hash_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# Reads the version from the banner: window.ApphudSDKVersion="2.5.7" / window.ApphudCheckoutVersion="3.0.0"
version_of() {
  head -c 512 "$1" | grep -oE 'Apphud[A-Za-z]*Version *= *["'"'"'][^"'"'"']+' | head -1 | sed -E 's/.*["'"'"']//' || true
}

# --- choose what to deploy -----------------------------------------------------

divider
bold "What do you want to deploy?"
echo "  1) dist/apphud.js             -> ${CONTAINER}/v2/apphud.js"
echo "  2) dist/v3/apphud-checkout.js -> ${CONTAINER}/v3/apphud-checkout.js"
read -r -p "Choose [1/2]: " choice
divider

case "$choice" in
  1) LOCAL_FILE="dist/apphud.js";             BLOB="v2/apphud.js" ;;
  2) LOCAL_FILE="dist/v3/apphud-checkout.js"; BLOB="v3/apphud-checkout.js" ;;
  *) red "Unknown choice: '$choice'"; exit 1 ;;
esac

PREVIOUS_BLOB="${BLOB%.js}.previous.js"
URL_PATH="/${CONTAINER}/${BLOB}"

if [[ ! -f "$LOCAL_FILE" ]]; then
  red "$LOCAL_FILE not found. Build it first (is this the right branch?)."
  exit 1
fi

# --- azure auth ----------------------------------------------------------------

if ! az account show >/dev/null 2>&1; then
  echo "Not logged in to Azure, running az login..."
  az login >/dev/null
fi

# Data-plane access through the account key (the login has no Storage Blob Data role).
AZURE_STORAGE_KEY="$(az storage account keys list \
  --subscription "$SUBSCRIPTION" -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" \
  --query '[0].value' -o tsv)"
export AZURE_STORAGE_ACCOUNT="$STORAGE_ACCOUNT" AZURE_STORAGE_KEY

# --- compare local vs azure ----------------------------------------------------

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
REMOTE_FILE="$TMP_DIR/remote.js"

REMOTE_EXISTS="$(az storage blob exists -c "$CONTAINER" -n "$BLOB" --query exists -o tsv)"
if [[ "$REMOTE_EXISTS" == "true" ]]; then
  az storage blob download -c "$CONTAINER" -n "$BLOB" -f "$REMOTE_FILE" --no-progress -o none
  REMOTE_VERSION="$(version_of "$REMOTE_FILE")"
else
  REMOTE_VERSION=""
fi
LOCAL_VERSION="$(version_of "$LOCAL_FILE")"

echo
divider
bold "Deploy ${LOCAL_FILE} -> ${PUBLIC_HOST}${URL_PATH}"
echo "  Version to upload:   ${LOCAL_VERSION:-unknown} ($(wc -c < "$LOCAL_FILE" | tr -d ' ') bytes)"
if [[ "$REMOTE_EXISTS" == "true" ]]; then
  echo "  Version in Azure:    ${REMOTE_VERSION:-unknown} ($(wc -c < "$REMOTE_FILE" | tr -d ' ') bytes)"
  echo "  The current ${BLOB} (${REMOTE_VERSION:-unknown}) will be renamed to ${PREVIOUS_BLOB}"
  echo "  (the existing ${PREVIOUS_BLOB} will be overwritten)."
else
  echo "  Version in Azure:    none (${BLOB} does not exist yet)"
fi

if [[ -z "$LOCAL_VERSION" ]]; then
  divider
  red "Error: cannot read the version from ${LOCAL_FILE}."
  exit 1
fi
if [[ "$LOCAL_VERSION" == "$REMOTE_VERSION" ]]; then
  divider
  red "Error: version ${LOCAL_VERSION} is already deployed. You forgot to bump the library version in package.json."
  exit 1
fi

echo
read -r -p "Continue? [y/N]: " confirm
divider
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# --- upload --------------------------------------------------------------------

if [[ "$REMOTE_EXISTS" == "true" ]]; then
  echo "Saving current version as ${PREVIOUS_BLOB}..."
  az storage blob upload -c "$CONTAINER" -n "$PREVIOUS_BLOB" -f "$REMOTE_FILE" \
    --overwrite --content-type "$CONTENT_TYPE" --no-progress -o none
fi

echo "Uploading ${LOCAL_FILE} -> ${BLOB}..."
az storage blob upload -c "$CONTAINER" -n "$BLOB" -f "$LOCAL_FILE" \
  --overwrite --content-type "$CONTENT_TYPE" --no-progress -o none

# Verify against storage, not the CDN: the purge below is not awaited.
UPLOADED_FILE="$TMP_DIR/uploaded.js"
az storage blob download -c "$CONTAINER" -n "$BLOB" -f "$UPLOADED_FILE" --no-progress -o none
if [[ "$(hash_of "$UPLOADED_FILE")" != "$(hash_of "$LOCAL_FILE")" ]]; then
  red "Error: ${BLOB} in storage does not match ${LOCAL_FILE}."
  exit 1
fi

# --- purge ---------------------------------------------------------------------

PURGE_PATHS=("$URL_PATH")
[[ "$REMOTE_EXISTS" == "true" ]] && PURGE_PATHS+=("/${CONTAINER}/${PREVIOUS_BLOB}")

echo "Requesting Front Door cache purge for ${PURGE_PATHS[*]}..."
az afd endpoint purge --subscription "$SUBSCRIPTION" -g "$RESOURCE_GROUP" \
  --profile-name "$AFD_PROFILE" --endpoint-name "$AFD_ENDPOINT" \
  --domains "[$(IFS=,; echo "${AFD_DOMAINS[*]}")]" \
  --content-paths "[$(IFS=,; echo "${PURGE_PATHS[*]}")]" --no-wait -o none

green "Done: ${PUBLIC_HOST}${URL_PATH}"
echo "Check in 5-15 minutes that the file itself shows version ${LOCAL_VERSION}."
