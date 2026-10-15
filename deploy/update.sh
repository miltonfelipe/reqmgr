#!/usr/bin/env bash
# Update a running REQMGR server to the latest code. Run as root:
#   sudo /opt/reqmgr/app/deploy/update.sh
set -euo pipefail

APP=/opt/reqmgr/app
as_app() { sudo -u reqmgr "$@"; }

echo "== Backing up the database"
systemctl start reqmgr-backup.service

echo "== Pulling the latest code"
as_app git -C "$APP" pull --ff-only

echo "== Building the frontend"
cd "$APP"
as_app npm ci --no-audit --no-fund
as_app npm run build

echo "== Updating Python packages"
as_app "$APP/.venv/bin/pip" install --quiet -r server/requirements.txt

echo "== Restarting"
systemctl restart reqmgr
systemctl --no-pager --lines=5 status reqmgr
