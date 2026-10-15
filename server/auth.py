# ── server/auth.py ───────────────────────────────────
# Password hashing (scrypt) and cookie sessions.

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Cookie, HTTPException

from .db import now_iso, reader, transaction

SESSION_COOKIE = 'reqmgr_session'
SESSION_DAYS = 14


def secure_cookies():
    """Mark cookies HTTPS-only; set REQMGR_SECURE_COOKIES=1 when served over HTTPS."""
    return os.environ.get('REQMGR_SECURE_COOKIES', '').lower() in ('1', 'true', 'yes')
_SCRYPT = dict(n=2**14, r=8, p=1)


def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f'scrypt${salt.hex()}${digest.hex()}'


def verify_password(password, stored):
    try:
        _, salt_hex, digest_hex = stored.split('$')
    except ValueError:
        return False
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), **_SCRYPT)
    return hmac.compare_digest(digest.hex(), digest_hex)


def _token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def new_user_id():
    return 'usr-' + secrets.token_hex(6)


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    with transaction() as conn:
        conn.execute('DELETE FROM sessions WHERE expires_at < ?', (now_iso(),))
        conn.execute('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
                     (_token_hash(token), user_id, expires.isoformat()))
    return token


def delete_session(token):
    with transaction() as conn:
        conn.execute('DELETE FROM sessions WHERE token_hash = ?', (_token_hash(token),))


def user_public(row):
    return {
        'userId':      row['id'],
        'username':    row['username'],
        'displayName': row['display_name'],
        'isAdmin':     bool(row['is_admin']),
        'createdAt':   row['created_at'],
    }


def current_user(reqmgr_session: str | None = Cookie(default=None)):
    """FastAPI dependency: the logged-in user row, or 401."""
    if not reqmgr_session:
        raise HTTPException(401, 'Not logged in')
    with reader() as conn:
        row = conn.execute(
            'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id '
            'WHERE s.token_hash = ? AND s.expires_at > ?',
            (_token_hash(reqmgr_session), datetime.now(timezone.utc).isoformat()),
        ).fetchone()
    if not row:
        raise HTTPException(401, 'Session expired')
    return row


def require_admin(user):
    if not user['is_admin']:
        raise HTTPException(403, 'Administrator only')


def ensure_admin_user(log):
    """On first start, create an 'admin' account so someone can log in."""
    with transaction() as conn:
        if conn.execute('SELECT 1 FROM users LIMIT 1').fetchone():
            return
        password = os.environ.get('REQMGR_ADMIN_PASSWORD') or secrets.token_urlsafe(9)
        conn.execute(
            'INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at) '
            'VALUES (?, ?, ?, ?, 1, ?)',
            (new_user_id(), 'admin', 'Administrator', hash_password(password), now_iso()),
        )
    if 'REQMGR_ADMIN_PASSWORD' in os.environ:
        log.warning('Created administrator account "admin" with REQMGR_ADMIN_PASSWORD.')
    else:
        log.warning('Created administrator account "admin" with password: %s', password)
