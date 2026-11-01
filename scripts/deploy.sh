#!/usr/bin/env bash
# Build the dashboard image on this Mac, ship it to the NAS over SSH and restart it there.
#
#   scripts/deploy.sh              build the current checkout, ship it and start it
#   scripts/deploy.sh --rollback   start the previously deployed build again
#   DRY_RUN=1 scripts/deploy.sh    print every step without running anything
#
# Only the image and docker-compose.yml are transferred. Settings, secrets, data and backups
# live on the NAS and are never touched by this script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT/scripts/deploy.env}"
MODE=deploy

case "${1:-}" in
  "") ;;
  --rollback) MODE=rollback ;;
  *)
    echo "usage: scripts/deploy.sh [--rollback]" >&2
    exit 2
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "deploy.env not found at $ENV_FILE - copy scripts/deploy.env.example to scripts/deploy.env and fill it in" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$ENV_FILE"

: "${NAS_HOST:?NAS_HOST is not set in deploy.env}"
: "${NAS_USER:?NAS_USER is not set in deploy.env}"
: "${NAS_SSH_KEY:?NAS_SSH_KEY is not set in deploy.env}"
: "${NAS_DIR:?NAS_DIR is not set in deploy.env}"
NAS_DOCKER="${NAS_DOCKER:-/usr/local/bin/docker}"
KEEP_TAGS="${KEEP_TAGS:-3}"
NAS_SSH_KEY="${NAS_SSH_KEY/#\~/$HOME}"

SSH_OPTS=(
  -i "$NAS_SSH_KEY"
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes
  -o PasswordAuthentication=no
  -o BatchMode=yes
)
if [[ -n "${NAS_KNOWN_HOSTS:-}" ]]; then
  SSH_OPTS+=(-o "UserKnownHostsFile=${NAS_KNOWN_HOSTS/#\~/$HOME}")
fi
TARGET="$NAS_USER@$NAS_HOST"

dry() { [[ -n "${DRY_RUN:-}" ]]; }

# Run a command on the Mac.
local_run() {
  if dry; then echo "+ $*"; else "$@"; fi
}

# Run a bash script on the NAS; positional arguments reach the script as $1, $2, ...
remote_script() {
  local script="$1"
  shift
  if dry; then
    echo "+ ssh $TARGET bash -s -- $*"
    printf '%s\n' "$script" | sed 's/^/    | /'
  else
    printf '%s\n' "$script" | ssh "${SSH_OPTS[@]}" "$TARGET" bash -s -- "$@"
  fi
}

# Start BUILD ($2) with docker-compose.yml in $1, then wait until the container is healthy.
# $1 = project folder, $2 = build id, $3 = docker binary, $4 = tags to keep
START_SCRIPT='
set -eu
dir=$1; build=$2; docker=$3; keep=$4
cd "$dir"
if [ -f .current-build ] && [ "$(cat .current-build)" != "$build" ]; then
  cp .current-build .previous-build
fi
printf "%s\n" "$build" > .current-build
BUILD_ID="$build" "$docker" compose up -d
i=0
while [ "$i" -lt 24 ]; do
  status=$("$docker" inspect --format "{{.State.Health.Status}}" home-dashboard 2>/dev/null || true)
  if [ "$status" = "healthy" ]; then
    "$docker" images home-dashboard --format "{{.Tag}}" | tail -n +"$((keep + 1))" | xargs -r -I{} "$docker" rmi "home-dashboard:{}" || true
    echo "dashboard $build is healthy"
    exit 0
  fi
  i=$((i + 1))
  sleep 5
done
echo "dashboard $build did not become healthy; run scripts/deploy.sh --rollback" >&2
exit 1
'

# Swap current and previous build and start the previous one again.
ROLLBACK_SCRIPT='
set -eu
dir=$1; docker=$2
cd "$dir"
[ -f .previous-build ] || { echo "no previous build recorded in .previous-build" >&2; exit 1; }
previous=$(cat .previous-build)
current=$(cat .current-build 2>/dev/null || true)
printf "%s\n" "$previous" > .current-build
[ -n "$current" ] && printf "%s\n" "$current" > .previous-build
BUILD_ID="$previous" "$docker" compose up -d
echo "rolled back to $previous"
'

if [[ "$MODE" == "rollback" ]]; then
  remote_script "$ROLLBACK_SCRIPT" "$NAS_DIR" "$NAS_DOCKER"
  exit 0
fi

BUILD_ID="$(git -C "$ROOT" rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
IMAGE="home-dashboard:$BUILD_ID"
echo "deploying $IMAGE to $TARGET"

local_run docker build --platform linux/amd64 \
  -f "$ROOT/infrastructure/Dockerfile" \
  --build-arg "BUILD_ID=$BUILD_ID" \
  -t "$IMAGE" "$ROOT"

if dry; then
  echo "+ docker save $IMAGE | ssh $TARGET $NAS_DOCKER load"
else
  docker save "$IMAGE" | ssh "${SSH_OPTS[@]}" "$TARGET" "$NAS_DOCKER" load
fi

if dry; then
  echo "+ ssh $TARGET cat > $NAS_DIR/docker-compose.yml < infrastructure/docker-compose.yml"
else
  ssh "${SSH_OPTS[@]}" "$TARGET" "cat > '$NAS_DIR/docker-compose.yml.tmp' && mv '$NAS_DIR/docker-compose.yml.tmp' '$NAS_DIR/docker-compose.yml'" \
    < "$ROOT/infrastructure/docker-compose.yml"
fi

remote_script "$START_SCRIPT" "$NAS_DIR" "$BUILD_ID" "$NAS_DOCKER" "$KEEP_TAGS"
