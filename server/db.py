# ── server/db.py ─────────────────────────────────────
# SQLite storage. Each project is kept as the same JSON document the
# frontend works with (and exports), plus a revision counter used by
# clients to poll for changes.

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.environ.get('REQMGR_DB', Path(__file__).resolve().parent.parent / 'data' / 'reqmgr.db'))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  doc        TEXT NOT NULL,
  revision   INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('manager', 'reviewer')),
  PRIMARY KEY (project_id, user_id)
);
CREATE TABLE IF NOT EXISTS snapshots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
  doc        TEXT NOT NULL,
  revision   INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
"""


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def connect():
    conn = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA journal_mode = WAL')
    return conn


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def transaction():
    """Write transaction; BEGIN IMMEDIATE serialises concurrent writers."""
    conn = connect()
    try:
        conn.execute('BEGIN IMMEDIATE')
        yield conn
        conn.execute('COMMIT')
    except BaseException:
        conn.execute('ROLLBACK')
        raise
    finally:
        conn.close()


@contextmanager
def reader():
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def load_doc(row):
    return json.loads(row['doc'])


def dump_doc(doc):
    return json.dumps(doc, separators=(',', ':'), ensure_ascii=False)
