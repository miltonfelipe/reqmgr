# REQMGR — Industrial Requirements Manager

A React-based requirements management tool for electronic development teams working on industrial machinery products.

## Features

### Access Control
- **Server-side accounts** — passwords hashed with scrypt, sessions in httpOnly cookies
- **Administrators** — create and delete user accounts, reset passwords; see and manage every project
- **Project members** — users only see projects they were added to; each member has a role *per project*:
  - **Requirements Manager** — full CRUD on the project, its requirements and diagram; resolves comments; manages members and restores backups
  - **Reviewer** — read-only; can add, edit, and delete their own review comments
- Roles are enforced by the server, not just hidden in the UI

### Projects
- Shared multi-project database on the server (SQLite); changes by other users appear within a few seconds
- Per-project: name, ID, version, lead engineer, customer, applicable standards, status, target date, notes
- **Export / import for every member** — JSON (whole project) and CSV (requirements)
- Importing over an existing project replaces it for everyone, but the server **saves a backup first**;
  backups can be downloaded by any member and restored by managers (Overview → *Members & backups*).
  The last 50 backups per project are kept.
- Any user can create a project (or import a new one) and becomes its manager

### Requirements
- Five categories: **Customer** (CUST), **System** (SYS), **Hardware** (HW), **Software** (SW), **Mechanical** (MECH)
- Fields: ID, title, statement, SHALL/SHOULD/MAY type, priority, status, subsystem link, verification method, source, owner, rationale, acceptance criteria
- Filter by text, status, and priority
- **Version history** — every edit creates a snapshot; view diffs (old → new) for any field
- **Review comments** — threaded comments per requirement with author, role, timestamp, and the requirement version at time of comment; managers can resolve/unresolve

### Block Diagram Editor
- Interactive canvas: Select / Add / Connect / Pan modes
- Color-coded subsystem blocks; resize handles; directed arrows
- Auto-layout; blocks link to requirements

## Running on a server

Needs Node 18+ (to build the frontend) and Python 3.10+.

```bash
npm install && npm run build                 # frontend → build/
python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt
REQMGR_ADMIN_PASSWORD='choose-one' .venv/bin/uvicorn server.app:app --host 0.0.0.0 --port 8000
```

Open **http://<server>:8000** and log in as `admin` with that password. On the very first start an
`admin` account is created; without `REQMGR_ADMIN_PASSWORD` a random password is printed to the log.
Then add users (user menu → *Manage users*) and add them to projects (Overview → *Members & backups*).

| Variable                | Default            | Purpose                                  |
|-------------------------|--------------------|------------------------------------------|
| `REQMGR_DB`             | `data/reqmgr.db`   | SQLite database file — back this up      |
| `REQMGR_ADMIN_PASSWORD` | random, logged     | Password of the first `admin` account    |
| `REQMGR_SECURE_COOKIES` | off                | Set to `1` when served over HTTPS        |

For use beyond a trusted network, put it behind HTTPS. **[DEPLOY.md](DEPLOY.md)** walks through a
production setup on AWS (EC2 + systemd + Caddy + nightly backups) using the files in `deploy/`.

**Moving from the browser-only version:** projects that were stored in a browser's local storage are
offered for upload the first time someone logs in from that browser.

## Development

```bash
.venv/bin/pip install -r server/requirements-dev.txt
.venv/bin/uvicorn server.app:app --reload   # API on :8000
npm start                                    # UI on :3000, proxies /api to :8000
npm run lint
.venv/bin/python -m pytest server/tests
```

## Project Structure

```
deploy/                 ← systemd units, Caddyfile, backup and update scripts
server/                 ← FastAPI app (uvicorn)
├── app.py              ← REST API: auth, users, projects, members, import, backups
├── ops.py              ← project mutations + per-role permissions
├── auth.py             ← password hashing, cookie sessions, first admin
├── db.py               ← SQLite schema and helpers
└── tests/
src/
├── api.js              ← fetch wrapper for the server
├── store/
│   ├── db.js           ← data model constants and helpers
│   └── auth.js         ← project roles
├── hooks/
│   ├── useStore.js     ← open project, server operations, polling
│   ├── useAuth.js      ← login, logout, user administration
│   └── useToast.js     ← notification state
├── utils/
│   ├── exportImport.js ← JSON export/import
│   └── csvUtils.js     ← CSV export/import
└── components/
    ├── LoginScreen       ← login form
    ├── UserMenu          ← avatar dropdown, sign out
    ├── UserManagementModal ← add/delete users, change passwords (administrators)
    ├── ProjectAccessModal  ← project members and backups
    ├── ReviewPanel       ← comment thread + version history diffs
    ├── RequirementsPanel ← filterable table + ReviewPanel
    ├── BlockDiagram      ← SVG canvas editor (role-gated)
    ├── Overview          ← stats + comment counts
    ├── Sidebar           ← nav + open-comment badges
    ├── TopBar            ← project selector, import/export, UserMenu
    ├── ProjectModal      ← create/edit project
    ├── RequirementModal  ← create/edit requirement
    ├── NoProject         ← empty state
    └── UI                ← Badge, Btn, Modal, Toast, Field, …
```

## Standards Reference

Requirements follow the SHALL / SHOULD / MAY convention per IEEE 830 / ISO/IEC/IEEE 29148.
Typical applicable standards for industrial machinery:
IEC 61131-3, ISO 13849, EN 60204-1, IEC 60664-1, IEC 61000-x-x (EMC)
