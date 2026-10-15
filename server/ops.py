# ── server/ops.py ────────────────────────────────────
# Project mutations, ported from the frontend's former localStorage store.
# Each op mutates the project document in place. The server fills in
# authorship (editor, comment author) from the session, never the client.

import secrets
import time

from fastapi import HTTPException

from .db import now_iso

CATEGORIES = ['customer', 'system', 'hardware', 'software', 'mechanical']

# Project fields the "edit project" form may change; everything else
# (requirements, sections, diagram) goes through the dedicated ops.
PROJECT_FIELDS = {
    'name', 'version', 'status', 'targetDate', 'description',
    'lead', 'customer', 'standards', 'notes',
}


def bad_request(msg):
    return HTTPException(400, msg)


def make_empty_project(name):
    now = now_iso()
    return {
        'name': name, 'version': '1.0.0', 'status': 'Draft', 'targetDate': '',
        'description': '', 'lead': '', 'customer': '', 'standards': [], 'notes': '',
        'createdAt': now, 'updatedAt': now,
        'requirements': {c: [] for c in CATEGORIES},
        'diagramBlocks': {}, 'diagramConns': [], 'blockIdC': 0, 'connIdC': 0,
        'sections': [],
    }


def normalize_project(doc):
    """Fill in fields older exports may lack (mirrors the old importProject)."""
    if not isinstance(doc, dict) or not isinstance(doc.get('name'), str):
        raise bad_request('Malformed project')
    reqs = doc.get('requirements')
    if not isinstance(reqs, dict):
        reqs = doc['requirements'] = {}
    for c in CATEGORIES:
        reqs[c] = [
            {**r,
             'version':   r.get('version') or 1,
             'history':   r.get('history') or [],
             'comments':  r.get('comments') or [],
             'sectionId': r.get('sectionId') or '',
             'traces':    r.get('traces') or []}
            for r in (reqs.get(c) or [])
        ]
    doc.setdefault('diagramBlocks', {})
    doc.setdefault('diagramConns', [])
    doc['blockIdC'] = doc.get('blockIdC') or 0
    doc['connIdC'] = doc.get('connIdC') or 0
    doc.setdefault('sections', [])
    return doc


def update_project_fields(doc, fields):
    for k, v in fields.items():
        if k in PROJECT_FIELDS:
            doc[k] = v


def _reqs(doc, cat):
    if cat not in CATEGORIES:
        raise bad_request(f'Unknown category: {cat}')
    return doc['requirements'].setdefault(cat, [])


def _find_req(doc, cat, req_id):
    for r in _reqs(doc, cat):
        if r.get('id') == req_id:
            return r
    raise HTTPException(404, f'Requirement {req_id} not found')


def _find_comment(req, comment_id):
    for c in req.get('comments') or []:
        if c.get('commentId') == comment_id:
            return c
    raise HTTPException(404, 'Comment not found')


def _snapshot(req, editor_name):
    return {
        'snapshotId': f'snap-{int(time.time() * 1000)}',
        'version': req.get('version') or 1,
        'capturedAt': now_iso(), 'capturedBy': editor_name,
        **{k: req.get(k) for k in (
            'title', 'statement', 'type', 'status', 'priority', 'subsystem',
            'verification', 'source', 'owner', 'rationale', 'acceptance', 'sectionId')},
        'objectType': req.get('objectType') or 'requirement',
        'reqType': req.get('reqType') or 'functional',
    }


def _new_req(data):
    now = now_iso()
    return {**data, 'createdAt': now, 'updatedAt': now, 'version': 1,
            'history': [], 'comments': [], 'traces': data.get('traces') or []}


# ── Sections ──────────────────────────────────────────
def upsert_section(doc, a, ctx):
    section, editing_id = a['section'], a.get('editingId')
    sections = doc.setdefault('sections', [])
    for i, s in enumerate(sections):
        if editing_id and s.get('id') == editing_id:
            sections[i] = section
            return
    sections.append(section)


def delete_section(doc, a, ctx):
    sid = a['sectionId']
    doc['sections'] = [s for s in doc.get('sections', []) if s.get('id') != sid]
    for c in CATEGORIES:
        for r in _reqs(doc, c):
            if r.get('sectionId') == sid:
                r['sectionId'] = ''


def reorder_sections(doc, a, ctx):
    by_id = {s['id']: s for s in doc.get('sections', [])}
    doc['sections'] = [{**by_id[sid], 'order': i}
                       for i, sid in enumerate(a['orderedIds']) if sid in by_id]


# ── Requirements ──────────────────────────────────────
def upsert_req(doc, a, ctx):
    reqs = _reqs(doc, a['category'])
    data, editing_id = a['req'], a.get('editingId')
    if editing_id:
        for i, old in enumerate(reqs):
            if old.get('id') == editing_id:
                reqs[i] = {
                    **old, **data, 'updatedAt': now_iso(),
                    'version': (old.get('version') or 1) + 1,
                    'history': [*(old.get('history') or []), _snapshot(old, ctx['displayName'])],
                    'comments': old.get('comments') or [],
                    'traces': data.get('traces', old.get('traces') or []),
                }
                return
    reqs.append(_new_req(data))


def delete_req(doc, a, ctx):
    cat, rid = a['category'], a['reqId']
    for c in CATEGORIES:
        doc['requirements'][c] = [
            {**r, 'traces': [t for t in (r.get('traces') or []) if t.get('toId') != rid]}
            for r in _reqs(doc, c) if not (c == cat and r.get('id') == rid)
        ]


def import_csv(doc, a, ctx):
    """Merge: keep reqs not in the CSV; overwrite the rest, keeping their history and comments."""
    incoming_all = a['requirements']
    for c in CATEGORIES:
        incoming = incoming_all.get(c) or []
        existing = {r.get('id'): r for r in _reqs(doc, c)}
        incoming_ids = {r.get('id') for r in incoming}
        doc['requirements'][c] = [
            *(r for r in _reqs(doc, c) if r.get('id') not in incoming_ids),
            *({**r,
               'history': (existing.get(r.get('id')) or {}).get('history') or [],
               'comments': (existing.get(r.get('id')) or {}).get('comments') or []}
              for r in incoming),
        ]


# ── Traces ────────────────────────────────────────────
def add_trace(doc, a, ctx):
    req = _find_req(doc, a['category'], a['reqId'])
    traces = req.setdefault('traces', [])
    if any(t.get('toId') == a['toId'] for t in traces):
        return
    traces.append({'toId': a['toId'], 'type': a['type']})
    req['updatedAt'] = now_iso()


def remove_trace(doc, a, ctx):
    req = _find_req(doc, a['category'], a['reqId'])
    req['traces'] = [t for t in (req.get('traces') or []) if t.get('toId') != a['toId']]
    req['updatedAt'] = now_iso()


# ── Comments ──────────────────────────────────────────
def add_comment(doc, a, ctx):
    text = (a.get('text') or '').strip()
    if not text:
        raise bad_request('Comment is empty')
    req = _find_req(doc, a['category'], a['reqId'])
    req.setdefault('comments', []).append({
        'commentId': f'cmt-{int(time.time() * 1000)}-{secrets.token_hex(3)}',
        'text': text, 'authorId': ctx['userId'], 'authorName': ctx['displayName'],
        'authorRole': ctx['role'],
        'createdAt': now_iso(), 'editedAt': None,
        'resolved': False, 'resolvedBy': None, 'resolvedAt': None,
        'reqVersion': req.get('version') or 1,
    })


def edit_comment(doc, a, ctx):
    c = _find_comment(_find_req(doc, a['category'], a['reqId']), a['commentId'])
    if c.get('authorId') != ctx['userId']:
        raise HTTPException(403, 'You can only edit your own comments')
    c['text'], c['editedAt'] = a['text'], now_iso()


def resolve_comment(doc, a, ctx):
    c = _find_comment(_find_req(doc, a['category'], a['reqId']), a['commentId'])
    c['resolved'] = not c.get('resolved')
    c['resolvedBy'], c['resolvedAt'] = ctx['displayName'], now_iso()


def delete_comment(doc, a, ctx):
    req = _find_req(doc, a['category'], a['reqId'])
    c = _find_comment(req, a['commentId'])
    if ctx['role'] != 'manager' and c.get('authorId') != ctx['userId']:
        raise HTTPException(403, 'You can only delete your own comments')
    req['comments'] = [x for x in req['comments'] if x is not c]


# ── Diagram ───────────────────────────────────────────
def save_diagram(doc, a, ctx):
    doc['diagramBlocks'] = a['blocks']
    doc['diagramConns'] = a['conns']
    doc['blockIdC'] = a['blockIdC']
    doc['connIdC'] = a['connIdC']


# op name -> (handler, roles allowed)
MANAGER = {'manager'}
ANY_MEMBER = {'manager', 'reviewer'}
OPS = {
    'upsertSection':   (upsert_section,   MANAGER),
    'deleteSection':   (delete_section,   MANAGER),
    'reorderSections': (reorder_sections, MANAGER),
    'upsertReq':       (upsert_req,       MANAGER),
    'deleteReq':       (delete_req,       MANAGER),
    'importCsv':       (import_csv,       ANY_MEMBER),  # like JSON import; backed up first
    'addTrace':        (add_trace,        MANAGER),
    'removeTrace':     (remove_trace,     MANAGER),
    'addComment':      (add_comment,      ANY_MEMBER),
    'editComment':     (edit_comment,     ANY_MEMBER),
    'resolveComment':  (resolve_comment,  MANAGER),
    'deleteComment':   (delete_comment,   ANY_MEMBER),
    'saveDiagram':     (save_diagram,     MANAGER),
}


def apply_op(doc, op, args, ctx):
    if op not in OPS:
        raise bad_request(f'Unknown operation: {op}')
    handler, roles = OPS[op]
    if ctx['role'] not in roles:
        raise HTTPException(403, 'Your role in this project does not allow this')
    try:
        handler(doc, args, ctx)
    except (KeyError, TypeError, AttributeError) as e:
        raise bad_request(f'Invalid arguments for {op}: {e}') from e
    doc['updatedAt'] = now_iso()
