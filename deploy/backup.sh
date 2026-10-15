#!/usr/bin/env bash
# Back up the REQMGR database (run nightly by reqmgr-backup.timer).
# Uses SQLite's online backup, so the server can keep running.
set -euo pipefail

DB=${REQMGR_DB:-/var/lib/reqmgr/reqmgr.db}
DIR=${REQMGR_BACKUP_DIR:-/var/lib/reqmgr/backups}
KEEP=${REQMGR_BACKUP_KEEP:-14}
S3=${REQMGR_BACKUP_S3:-}

mkdir -p "$DIR"
file="$DIR/reqmgr-$(date -u +%Y%m%dT%H%M%SZ)-$$.db"
python3 - "$DB" "$file" <<'PY'
import sqlite3, sys
src, dst = sqlite3.connect(sys.argv[1]), sqlite3.connect(sys.argv[2])
with dst:
    src.backup(dst)
PY
gzip "$file"
echo "Backed up $DB to $file.gz"

# Keep only the newest $KEEP local backups
ls -1t "$DIR"/reqmgr-*.db.gz | tail -n +"$((KEEP + 1))" | xargs -r rm --

if [ -n "$S3" ]; then
  aws s3 cp --only-show-errors "$file.gz" "$S3/"
  echo "Copied to $S3/"
fi
