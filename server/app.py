# ── server/app.py ────────────────────────────────────
# REQMGR API server. Run with:  uvicorn server.app:app
# Serves the built frontend from build/ when it exists.

import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import auth, ops
from .auth import current_user
from .db import dump_doc, init_db, load_doc, now_iso, reader, transaction

log = logging.getLogger('reqmgr')
BUILD_DIR = Path(__file__).resolve().parent.parent / 'build'
EXPORT_FORMAT = 'reqmgr-v2'
SNAPSHOTS_KEPT = 50
PROJECT_ID_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$')


@asynccontextmanager
async def lifespan(_app):
    init_db()
    auth.ensure_admin_user(log)
    yield


app = FastAPI(title='REQMGR', lifespan=lifespan)


# ── Request bodies ────────────────────────────────────
class LoginBody(BaseModel):
    username: str
    password: str


class NewUserBody(BaseModel):
    username: str
    displayName: str
    password: str
    isAdmin: bool = False


class PasswordBody(BaseModel):
    password: str


class ProjectBody(BaseModel):
    id: str
    fields: dict[str, Any]


class OpBody(BaseModel):
    op: str
    args: dict[str, Any] = {}


class ImportBody(BaseModel):
    projectId: str
    project: dict[str, Any]


class MemberBody(BaseModel):
    role: str


# ── Helpers ───────────────────────────────────────────
def check_project_id(pid):
    if not PROJECT_ID_RE.match(pid):
        raise HTTPException(400, 'Project ID may contain letters, digits, "-", "_" and "." only')


def check_password(pw):
    if len(pw) < 6:
        raise HTTPException(400, 'Password must be at least 6 characters')


def role_in(conn, user, pid):
    """The user's role in a project (admins act as managers), or 404."""
    if not conn.execute('SELECT 1 FROM projects WHERE id = ?', (pid,)).fetchone():
        raise HTTPException(404, 'Project not found')
    if user['is_admin']:
        return 'manager'
    row = conn.execute('SELECT role FROM members WHERE project_id = ? AND user_id = ?',
                       (pid, user['id'])).fetchone()
    if not row:
        raise HTTPException(404, 'Project not found')
    return row['role']


def require_manager(role):
    if role != 'manager':
        raise HTTPException(403, 'Only project managers can do this')


def save_snapshot(conn, pid, reason, user):
    row = conn.execute('SELECT doc, revision FROM projects WHERE id = ?', (pid,)).fetchone()
    cur = conn.execute(
        'INSERT INTO snapshots (project_id, doc, revision, reason, created_by, created_at) '
        'VALUES (?, ?, ?, ?, ?, ?)',
        (pid, row['doc'], row['revision'], reason, user['display_name'], now_iso()))
    conn.execute(
        'DELETE FROM snapshots WHERE project_id = ? AND id NOT IN '
        '(SELECT id FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT ?)',
        (pid, pid, SNAPSHOTS_KEPT))
    return cur.lastrowid


def write_doc(conn, pid, doc):
    conn.execute('UPDATE projects SET doc = ?, revision = revision + 1, updated_at = ? WHERE id = ?',
                 (dump_doc(doc), now_iso(), pid))
    return conn.execute('SELECT revision FROM projects WHERE id = ?', (pid,)).fetchone()['revision']


def insert_project(conn, pid, doc, user):
    conn.execute('INSERT INTO projects (id, doc, revision, updated_at) VALUES (?, ?, 1, ?)',
                 (pid, dump_doc(doc), now_iso()))
    conn.execute("INSERT INTO members (project_id, user_id, role) VALUES (?, ?, 'manager')",
                 (pid, user['id']))


def project_exists(conn, pid):
    return conn.execute('SELECT 1 FROM projects WHERE id = ?', (pid,)).fetchone() is not None


# ── Auth ──────────────────────────────────────────────
@app.post('/api/login')
def login(body: LoginBody, response: Response):
    with reader() as conn:
        row = conn.execute('SELECT * FROM users WHERE username = ?', (body.username.strip(),)).fetchone()
    if not row or not auth.verify_password(body.password, row['password_hash']):
        raise HTTPException(401, 'Invalid username or password')
    token = auth.create_session(row['id'])
    response.set_cookie(auth.SESSION_COOKIE, token, httponly=True, samesite='lax',
                        max_age=auth.SESSION_DAYS * 86400)
    return auth.user_public(row)


@app.post('/api/logout')
def logout(response: Response, reqmgr_session: str | None = Cookie(default=None)):
    if reqmgr_session:
        auth.delete_session(reqmgr_session)
    response.delete_cookie(auth.SESSION_COOKIE)
    return {'ok': True}


@app.get('/api/me')
def me(user=Depends(current_user)):
    return auth.user_public(user)


# ── Users ─────────────────────────────────────────────
@app.get('/api/users')
def list_users(user=Depends(current_user)):
    with reader() as conn:
        rows = conn.execute('SELECT * FROM users ORDER BY display_name COLLATE NOCASE').fetchall()
    return [auth.user_public(r) for r in rows]


@app.post('/api/users', status_code=201)
def create_user(body: NewUserBody, user=Depends(current_user)):
    auth.require_admin(user)
    username, display = body.username.strip(), body.displayName.strip()
    if not username or not display:
        raise HTTPException(400, 'Username and display name are required')
    check_password(body.password)
    with transaction() as conn:
        if conn.execute('SELECT 1 FROM users WHERE username = ?', (username,)).fetchone():
            raise HTTPException(409, 'Username already exists')
        uid = auth.new_user_id()
        conn.execute(
            'INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at) '
            'VALUES (?, ?, ?, ?, ?, ?)',
            (uid, username, display, auth.hash_password(body.password), int(body.isAdmin), now_iso()))
        row = conn.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
    return auth.user_public(row)


@app.delete('/api/users/{user_id}')
def delete_user(user_id: str, user=Depends(current_user)):
    auth.require_admin(user)
    if user_id == user['id']:
        raise HTTPException(400, 'Cannot delete yourself')
    with transaction() as conn:
        conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    return {'ok': True}


@app.put('/api/users/{user_id}/password')
def change_password(user_id: str, body: PasswordBody, user=Depends(current_user)):
    if user_id != user['id']:
        auth.require_admin(user)
    check_password(body.password)
    with transaction() as conn:
        conn.execute('UPDATE users SET password_hash = ? WHERE id = ?',
                     (auth.hash_password(body.password), user_id))
    return {'ok': True}


# ── Projects ──────────────────────────────────────────
@app.get('/api/projects')
def list_projects(user=Depends(current_user)):
    with reader() as conn:
        if user['is_admin']:
            rows = conn.execute("SELECT id, doc, revision, 'manager' AS role FROM projects").fetchall()
        else:
            rows = conn.execute(
                'SELECT p.id, p.doc, p.revision, m.role FROM projects p '
                'JOIN members m ON m.project_id = p.id WHERE m.user_id = ?', (user['id'],)).fetchall()
    return [{'id': r['id'], 'name': load_doc(r)['name'], 'role': r['role'], 'revision': r['revision']}
            for r in sorted(rows, key=lambda r: r['id'])]


@app.post('/api/projects', status_code=201)
def create_project(body: ProjectBody, user=Depends(current_user)):
    check_project_id(body.id)
    doc = ops.make_empty_project(str(body.fields.get('name') or body.id))
    ops.update_project_fields(doc, body.fields)
    with transaction() as conn:
        if project_exists(conn, body.id):
            raise HTTPException(409, 'Project ID already exists')
        insert_project(conn, body.id, doc, user)
    return {'id': body.id}


@app.get('/api/projects/{pid}')
def get_project(pid: str, since: int | None = None, user=Depends(current_user)):
    with reader() as conn:
        role = role_in(conn, user, pid)
        row = conn.execute('SELECT doc, revision FROM projects WHERE id = ?', (pid,)).fetchone()
    if since is not None and since == row['revision']:
        return Response(status_code=204)
    return {'id': pid, 'project': load_doc(row), 'revision': row['revision'], 'role': role}


@app.put('/api/projects/{pid}')
def update_project(pid: str, body: ProjectBody, user=Depends(current_user)):
    """Edit project details; a changed id renames the project."""
    check_project_id(body.id)
    with transaction() as conn:
        require_manager(role_in(conn, user, pid))
        if body.id != pid:
            if project_exists(conn, body.id):
                raise HTTPException(409, 'Project ID already exists')
            conn.execute('UPDATE projects SET id = ? WHERE id = ?', (body.id, pid))
        row = conn.execute('SELECT doc FROM projects WHERE id = ?', (body.id,)).fetchone()
        doc = load_doc(row)
        ops.update_project_fields(doc, body.fields)
        doc['updatedAt'] = now_iso()
        write_doc(conn, body.id, doc)
    return {'id': body.id}


@app.delete('/api/projects/{pid}')
def delete_project(pid: str, user=Depends(current_user)):
    with transaction() as conn:
        require_manager(role_in(conn, user, pid))
        conn.execute('DELETE FROM projects WHERE id = ?', (pid,))
    return {'ok': True}


@app.post('/api/projects/{pid}/ops')
def project_op(pid: str, body: OpBody, user=Depends(current_user)):
    with transaction() as conn:
        role = role_in(conn, user, pid)
        doc = load_doc(conn.execute('SELECT doc FROM projects WHERE id = ?', (pid,)).fetchone())
        ctx = {'userId': user['id'], 'displayName': user['display_name'], 'role': role}
        if body.op == 'importCsv':
            save_snapshot(conn, pid, 'Before CSV import', user)
        ops.apply_op(doc, body.op, body.args, ctx)
        revision = write_doc(conn, pid, doc)
    return {'project': doc, 'revision': revision}


# ── Import (any member) and backups ───────────────────
@app.post('/api/import')
def import_project(body: ImportBody, user=Depends(current_user)):
    """Replace a project the user belongs to (backing it up first),
    or create a new one with the importer as manager."""
    check_project_id(body.projectId)
    doc = ops.normalize_project(body.project)
    pid = body.projectId
    with transaction() as conn:
        if project_exists(conn, pid):
            try:
                role_in(conn, user, pid)  # any member may import
            except HTTPException:
                raise HTTPException(409, f'Project {pid} already exists and you are not a member of it')
            backup_id = save_snapshot(conn, pid, 'Before import', user)
            write_doc(conn, pid, doc)
            return {'id': pid, 'created': False, 'backupId': backup_id}
        insert_project(conn, pid, doc, user)
    return {'id': pid, 'created': True, 'backupId': None}


@app.get('/api/projects/{pid}/snapshots')
def list_snapshots(pid: str, user=Depends(current_user)):
    with reader() as conn:
        role_in(conn, user, pid)
        rows = conn.execute(
            'SELECT id, revision, reason, created_by, created_at FROM snapshots '
            'WHERE project_id = ? ORDER BY id DESC', (pid,)).fetchall()
    return [{'id': r['id'], 'revision': r['revision'], 'reason': r['reason'],
             'createdBy': r['created_by'], 'createdAt': r['created_at']} for r in rows]


@app.get('/api/projects/{pid}/snapshots/{sid}')
def export_snapshot(pid: str, sid: int, user=Depends(current_user)):
    """A backup in the same format as a project export file."""
    with reader() as conn:
        role_in(conn, user, pid)
        row = conn.execute('SELECT doc, created_at FROM snapshots WHERE id = ? AND project_id = ?',
                           (sid, pid)).fetchone()
    if not row:
        raise HTTPException(404, 'Backup not found')
    return {'__reqmgr_format': EXPORT_FORMAT, 'exportedAt': row['created_at'],
            'projectId': pid, 'project': load_doc(row)}


@app.post('/api/projects/{pid}/snapshots/{sid}/restore')
def restore_snapshot(pid: str, sid: int, user=Depends(current_user)):
    with transaction() as conn:
        require_manager(role_in(conn, user, pid))
        row = conn.execute('SELECT doc FROM snapshots WHERE id = ? AND project_id = ?',
                           (sid, pid)).fetchone()
        if not row:
            raise HTTPException(404, 'Backup not found')
        save_snapshot(conn, pid, f'Before restoring backup #{sid}', user)
        write_doc(conn, pid, load_doc(row))
    return {'ok': True}


# ── Members ───────────────────────────────────────────
@app.get('/api/projects/{pid}/members')
def list_members(pid: str, user=Depends(current_user)):
    with reader() as conn:
        role_in(conn, user, pid)
        rows = conn.execute(
            'SELECT u.*, m.role FROM members m JOIN users u ON u.id = m.user_id '
            'WHERE m.project_id = ? ORDER BY u.display_name COLLATE NOCASE', (pid,)).fetchall()
    return [{**auth.user_public(r), 'role': r['role']} for r in rows]


def _check_manager_remains(conn, pid):
    if not conn.execute("SELECT 1 FROM members WHERE project_id = ? AND role = 'manager'",
                        (pid,)).fetchone():
        raise HTTPException(400, 'A project needs at least one manager')


@app.put('/api/projects/{pid}/members/{user_id}')
def set_member(pid: str, user_id: str, body: MemberBody, user=Depends(current_user)):
    if body.role not in ('manager', 'reviewer'):
        raise HTTPException(400, 'Role must be manager or reviewer')
    with transaction() as conn:
        require_manager(role_in(conn, user, pid))
        if not conn.execute('SELECT 1 FROM users WHERE id = ?', (user_id,)).fetchone():
            raise HTTPException(404, 'User not found')
        conn.execute('INSERT INTO members (project_id, user_id, role) VALUES (?, ?, ?) '
                     'ON CONFLICT (project_id, user_id) DO UPDATE SET role = excluded.role',
                     (pid, user_id, body.role))
        _check_manager_remains(conn, pid)
    return {'ok': True}


@app.delete('/api/projects/{pid}/members/{user_id}')
def remove_member(pid: str, user_id: str, user=Depends(current_user)):
    with transaction() as conn:
        require_manager(role_in(conn, user, pid))
        conn.execute('DELETE FROM members WHERE project_id = ? AND user_id = ?', (pid, user_id))
        _check_manager_remains(conn, pid)
    return {'ok': True}


# ── Frontend ──────────────────────────────────────────
if BUILD_DIR.is_dir():
    app.mount('/', StaticFiles(directory=BUILD_DIR, html=True), name='frontend')
