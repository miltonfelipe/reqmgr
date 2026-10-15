import pytest
from fastapi.testclient import TestClient

from server import app as app_module
from server import db


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, 'DB_PATH', tmp_path / 'test.db')
    monkeypatch.setenv('REQMGR_ADMIN_PASSWORD', 'admin-pass')
    with TestClient(app_module.app) as c:
        yield c


def login(client, username, password):
    r = client.post('/api/login', json={'username': username, 'password': password})
    assert r.status_code == 200, r.text
    return r.json()


def make_user(admin, username):
    r = admin.post('/api/users', json={'username': username, 'displayName': username.title(),
                                       'password': 'secret1'})
    assert r.status_code == 201, r.text
    return r.json()['userId']


def as_user(username):
    c = TestClient(app_module.app)
    login(c, username, 'secret1')
    return c


@pytest.fixture
def team(client):
    """admin creates PROJ-1; mia is manager, rob is reviewer, eve is not a member."""
    login(client, 'admin', 'admin-pass')
    ids = {u: make_user(client, u) for u in ('mia', 'rob', 'eve')}
    assert client.post('/api/projects', json={'id': 'PROJ-1', 'fields': {'name': 'Pump'}}).status_code == 201
    client.put(f'/api/projects/PROJ-1/members/{ids["mia"]}', json={'role': 'manager'})
    client.put(f'/api/projects/PROJ-1/members/{ids["rob"]}', json={'role': 'reviewer'})
    return {u: as_user(u) for u in ids} | {'ids': ids}


def op(c, name, **args):
    return c.post('/api/projects/PROJ-1/ops', json={'op': name, 'args': args})


REQ = {'id': 'SYS-001', 'title': 'Flow', 'statement': 'The pump shall deliver 10 l/min.'}


def test_login_required_and_wrong_password(client):
    assert client.get('/api/projects').status_code == 401
    r = client.post('/api/login', json={'username': 'admin', 'password': 'nope'})
    assert r.status_code == 401


def test_logout_invalidates_session(client):
    login(client, 'admin', 'admin-pass')
    assert client.post('/api/logout').status_code == 200
    assert client.get('/api/me').status_code == 401


def test_only_members_see_project(team):
    assert [p['id'] for p in team['rob'].get('/api/projects').json()] == ['PROJ-1']
    assert team['eve'].get('/api/projects').json() == []
    assert team['eve'].get('/api/projects/PROJ-1').status_code == 404


def test_roles_enforced_on_ops(team):
    assert op(team['rob'], 'upsertReq', category='system', req=REQ).status_code == 403
    r = op(team['mia'], 'upsertReq', category='system', req=REQ)
    assert r.status_code == 200
    assert r.json()['project']['requirements']['system'][0]['version'] == 1

    r = op(team['rob'], 'addComment', category='system', reqId='SYS-001', text='Units?')
    assert r.status_code == 200
    comment = r.json()['project']['requirements']['system'][0]['comments'][0]
    assert comment['authorName'] == 'Rob' and comment['authorRole'] == 'reviewer'

    cid = comment['commentId']
    assert op(team['mia'], 'editComment', category='system', reqId='SYS-001',
              commentId=cid, text='x').status_code == 403
    assert op(team['rob'], 'resolveComment', category='system', reqId='SYS-001',
              commentId=cid).status_code == 403
    assert op(team['mia'], 'resolveComment', category='system', reqId='SYS-001',
              commentId=cid).status_code == 200


def test_edit_keeps_history_with_editor_name(team):
    op(team['mia'], 'upsertReq', category='system', req=REQ)
    r = op(team['mia'], 'upsertReq', category='system', editingId='SYS-001',
           req={**REQ, 'title': 'Flow rate'})
    req = r.json()['project']['requirements']['system'][0]
    assert req['version'] == 2 and req['history'][0]['title'] == 'Flow'
    assert req['history'][0]['capturedBy'] == 'Mia'


def test_polling_returns_204_when_unchanged(team):
    rev = team['rob'].get('/api/projects/PROJ-1').json()['revision']
    assert team['rob'].get(f'/api/projects/PROJ-1?since={rev}').status_code == 204
    op(team['mia'], 'upsertReq', category='system', req=REQ)
    assert team['rob'].get(f'/api/projects/PROJ-1?since={rev}').status_code == 200


def test_reviewer_import_replaces_with_backup_and_manager_restores(team):
    op(team['mia'], 'upsertReq', category='system', req=REQ)
    exported = team['rob'].get('/api/projects/PROJ-1').json()['project']

    replacement = {**exported, 'name': 'Pump v2', 'requirements': {}}
    r = team['rob'].post('/api/import', json={'projectId': 'PROJ-1', 'project': replacement})
    assert r.status_code == 200 and r.json()['created'] is False
    after = team['rob'].get('/api/projects/PROJ-1').json()
    assert after['project']['name'] == 'Pump v2' and after['role'] == 'reviewer'
    assert after['project']['requirements']['system'] == []

    backups = team['rob'].get('/api/projects/PROJ-1/snapshots').json()
    assert backups[0]['reason'] == 'Before import'
    sid = backups[0]['id']
    assert team['rob'].get(f'/api/projects/PROJ-1/snapshots/{sid}').json()['project']['name'] == 'Pump'

    assert team['rob'].post(f'/api/projects/PROJ-1/snapshots/{sid}/restore').status_code == 403
    assert team['mia'].post(f'/api/projects/PROJ-1/snapshots/{sid}/restore').status_code == 200
    restored = team['mia'].get('/api/projects/PROJ-1').json()['project']
    assert restored['name'] == 'Pump' and restored['requirements']['system'][0]['id'] == 'SYS-001'


def test_import_new_project_makes_importer_manager(team):
    r = team['eve'].post('/api/import', json={'projectId': 'NEW-1', 'project': {'name': 'New'}})
    assert r.status_code == 200 and r.json()['created'] is True
    assert team['eve'].get('/api/projects').json()[0]['role'] == 'manager'


def test_non_member_cannot_import_over_project(team):
    r = team['eve'].post('/api/import', json={'projectId': 'PROJ-1', 'project': {'name': 'X'}})
    assert r.status_code == 409


def test_cannot_remove_last_manager(team):
    ids = team['ids']
    # admin created the project, so admin and mia are both managers
    team['mia'].delete('/api/projects/PROJ-1/members/' + team['mia'].get('/api/me').json()['userId'])
    members = team['rob'].get('/api/projects/PROJ-1/members').json()
    manager_ids = [m['userId'] for m in members if m['role'] == 'manager']
    assert ids['mia'] not in manager_ids and len(manager_ids) == 1
    r = team['rob'].delete(f'/api/projects/PROJ-1/members/{manager_ids[0]}')
    assert r.status_code == 403


def test_rename_project_keeps_members(team):
    r = team['mia'].put('/api/projects/PROJ-1', json={'id': 'PUMP', 'fields': {'name': 'Pump'}})
    assert r.status_code == 200
    assert [p['id'] for p in team['rob'].get('/api/projects').json()] == ['PUMP']


def test_user_admin_only(team):
    r = team['mia'].post('/api/users', json={'username': 'x', 'displayName': 'X', 'password': 'secret1'})
    assert r.status_code == 403


def test_reviewer_csv_import_is_backed_up(team):
    r = op(team['rob'], 'importCsv', requirements={'system': [{**REQ, 'traces': []}]})
    assert r.status_code == 200
    assert team['rob'].get('/api/projects/PROJ-1/snapshots').json()[0]['reason'] == 'Before CSV import'


def test_secure_cookie_flag(client, monkeypatch):
    r = client.post('/api/login', json={'username': 'admin', 'password': 'admin-pass'})
    assert 'secure' not in r.headers['set-cookie'].lower()
    monkeypatch.setenv('REQMGR_SECURE_COOKIES', '1')
    r = client.post('/api/login', json={'username': 'admin', 'password': 'admin-pass'})
    assert 'secure' in r.headers['set-cookie'].lower()
