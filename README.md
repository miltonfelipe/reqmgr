# REQMGR — Industrial Requirements Manager

A React-based requirements management tool for electronic development teams working on industrial machinery products.

## Features

### Access Control
- **Login screen** with role-based access
- **Requirements Manager** — full CRUD on projects, requirements, and diagrams; can resolve comments and manage users
- **Reviewer** — read-only access to projects and requirements; can add, edit, and delete their own review comments
- **User Management** — managers can add, delete users and change passwords (Settings → Manage Users)

### Projects
- Multi-project database stored in browser `localStorage`
- Per-project: name, ID, version, lead engineer, customer, applicable standards, status, target date, notes
- Full import / export as structured JSON

### Requirements
- Four categories: **System** (SYS), **Hardware** (HW), **Software** (SW), **Mechanical** (MECH)
- Fields: ID, title, statement, SHALL/SHOULD/MAY type, priority, status, subsystem link, verification method, source, owner, rationale, acceptance criteria
- Filter by text, status, and priority
- **Version history** — every edit creates a snapshot; view diffs (old → new) for any field
- **Review comments** — threaded comments per requirement with author, role, timestamp, and the requirement version at time of comment; managers can resolve/unresolve

### Block Diagram Editor
- Interactive canvas: Select / Add / Connect / Pan modes
- Color-coded subsystem blocks; resize handles; directed arrows
- Auto-layout; blocks link to requirements

## Quick Start

```bash
npm install
npm start
```

Opens at **http://localhost:3000**

## Default Accounts

| Username   | Password      | Role                   |
|------------|---------------|------------------------|
| `manager`  | `manager123`  | Requirements Manager   |
| `reviewer` | `reviewer123` | Reviewer               |

> Change passwords immediately in production. The password hashing used here (FNV-1a) is suitable for a local/intranet tool only — not for internet-facing deployments without a proper backend.

## Project Structure

```
src/
├── store/
│   ├── db.js           ← data model, requirement version/comment helpers
│   └── auth.js         ← user accounts, roles, session, password hashing
├── hooks/
│   ├── useStore.js     ← central state + comment/history mutations
│   ├── useAuth.js      ← login, logout, user CRUD
│   └── useToast.js     ← notification state
├── utils/
│   └── exportImport.js ← JSON export/import
└── components/
    ├── LoginScreen       ← animated login form
    ├── UserMenu          ← avatar dropdown, sign out
    ├── UserManagementModal ← add/delete users, change passwords
    ├── ReviewPanel       ← comment thread + version history diffs
    ├── RequirementsPanel ← filterable table + ReviewPanel
    ├── BlockDiagram      ← SVG canvas editor (role-gated)
    ├── Overview          ← stats + comment counts
    ├── Sidebar           ← nav + open-comment badges
    ├── TopBar            ← project selector + UserMenu
    ├── ProjectModal      ← create/edit project
    ├── RequirementModal  ← create/edit requirement
    ├── NoProject         ← empty state
    └── UI                ← Badge, Btn, Modal, Toast, Field, …
```

## Build

```bash
npm run build   # → build/ folder, ready to serve statically
```

## Standards Reference

Requirements follow the SHALL / SHOULD / MAY convention per IEEE 830 / ISO/IEC/IEEE 29148.
Typical applicable standards for industrial machinery:
IEC 61131-3, ISO 13849, EN 60204-1, IEC 60664-1, IEC 61000-x-x (EMC)
