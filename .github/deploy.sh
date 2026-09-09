#!/usr/bin/env bash
set -euo pipefail

# installed as a root-owned forced SSH command on the deployment host
if [[ $# != 1 || ! $1 =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Expected one commit SHA' >&2
  exit 1
fi
revision=$1
root=${DOOR_DEPLOY_ROOT:-/opt}
repository=Ammaar-Alam/doorUnlocker
current="$root/doorunlocker"
exec 9>"$root/.doorunlocker-deploy.lock"
flock -w 300 9

# a slower check run must not roll back a newer main revision
head=$(git ls-remote --exit-code "https://github.com/$repository.git" refs/heads/main | cut -f1)
if [[ $revision != "$head" ]]; then
  echo 'Skipping a superseded revision'
  exit 0
fi
healthy() {
  curl -fsS --max-time 5 http://127.0.0.1:3107/auth-status |
    node -e 'let s=""; process.stdin.on("data", c => s+=c).on("end", () => { const d=JSON.parse(s); if(d.preview!==false || typeof d.authRequired!=="boolean") process.exit(1); });'
}
if [[ -f "$current/REVISION" && $(cat "$current/REVISION") == "$revision" ]] && systemctl is-active --quiet doorunlocker.service && healthy 2>/dev/null; then
  echo "Already running $revision"
  exit 0
fi

work=$(mktemp -d "$root/.doorunlocker-stage-XXXXXX")
rollback=false
cleanup() {
  status=$?
  trap - EXIT
  if $rollback; then
    echo 'Restoring the previous release' >&2
    rm -rf -- "$current"
    mv "$work/previous" "$current"
    systemctl restart doorunlocker.service
  fi
  rm -rf -- "$work"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
mkdir "$work/release"
chmod 755 "$work"
chown doorunlocker:doorunlocker "$work/release"
curl -fsSL --retry 3 --max-time 120 "https://codeload.github.com/$repository/tar.gz/$revision" |
  runuser -u doorunlocker -- tar -xz --strip-components=1 -C "$work/release"
(
  cd "$work/release"
  runuser -u doorunlocker -- npm ci --omit=dev --ignore-scripts --no-audit --no-fund --cache "$work/release/.npm"
  runuser -u doorunlocker -- node --test tests/preview.test.mjs
)
rm -rf -- "$work/release/.npm"
printf '%s\n' "$revision" > "$work/release/REVISION"
chown -hR root:root "$work/release"
chmod 755 "$work/release"
mv "$current" "$work/previous"
rollback=true
mv "$work/release" "$current"
systemctl restart doorunlocker.service
for attempt in {1..15}; do
  if healthy 2>/dev/null; then
    rm -rf -- "$root/doorunlocker-previous"
    mv "$work/previous" "$root/doorunlocker-previous"
    rollback=false
    echo "Deployed $revision"
    exit 0
  fi
  sleep 1
done
echo 'Deployment health check failed' >&2
exit 1
