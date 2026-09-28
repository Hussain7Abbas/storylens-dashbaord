#!/usr/bin/env bash
set -euo pipefail
# Run as root inside the server checkout (/srv/storylens-dashbaord) on branch main.
# Builds the static dashboard, activates it atomically, and rolls back on failure.
cd "$(dirname "$0")/.."
DOMAIN="storylens-dashbaord.iscoded.com"
WEB_ROOT="/var/www/storylens-dashbaord"
export PATH="/opt/storylens-node/bin:$HOME/.bun/bin:$PATH"
command -v node >/dev/null || { echo "Install a supported Node LTS runtime for Vite; Bun still manages dependencies and scripts."; exit 1; }
command -v bun >/dev/null || { echo "Install Bun."; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Deploy as root to manage nginx and releases."; exit 1; }
exec 9>/var/lock/storylens-dashbaord-deploy.lock
flock -n 9 || { echo "Another dashboard deploy is running."; exit 1; }

bun install --frozen-lockfile
bun run build

release="$WEB_ROOT/releases/$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
mkdir -p "$release" /var/www/certbot
cp -a dist/. "$release/"
chmod -R a+rX "$release"
previous="$(readlink "$WEB_ROOT/current" || true)"
ln -s "$release" "$WEB_ROOT/current.next"
mv -Tf "$WEB_ROOT/current.next" "$WEB_ROOT/current"

config="/etc/nginx/sites-available/$DOMAIN.conf"
if [ -f "$config" ]; then cp "$config" "$config.previous"; fi
rollback() {
  if [ -n "$previous" ]; then ln -sfn "$previous" "$WEB_ROOT/current"; fi
  if [ -f "$config.previous" ]; then cp "$config.previous" "$config"; fi
}
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  cp deploy/nginx/bootstrap.conf "$config"
  ln -sfn "$config" "/etc/nginx/sites-enabled/$DOMAIN.conf"
  nginx -t || { rollback; exit 1; }
  systemctl reload nginx
  certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || { rollback; exit 1; }
fi
cp "deploy/nginx/$DOMAIN.conf" "$config"
ln -sfn "$config" "/etc/nginx/sites-enabled/$DOMAIN.conf"
nginx -t || { rollback; exit 1; }
systemctl reload nginx
curl --noproxy "*" --connect-timeout 5 --max-time 15 --fail --silent --show-error --retry 5 --retry-delay 1 --retry-all-errors \
  --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/login" >/dev/null || { rollback; nginx -t && systemctl reload nginx; exit 1; }

# Keep the five newest releases for rollback.
ls -1dt "$WEB_ROOT"/releases/* | tail -n +6 | xargs -r rm -rf
echo "Deployed $release"
