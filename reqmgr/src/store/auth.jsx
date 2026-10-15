// ── store/auth.js ─────────────────────────────────────
// User accounts, roles, and session persistence.
// Roles: 'manager' | 'reviewer'
//
// Managers  → full CRUD on projects and requirements
// Reviewers → read-only + can add/edit their own review comments
//
// Default seed accounts (created on first load):
//   manager  / manager123
//   reviewer / reviewer123

const AUTH_KEY  = 'reqmgr_auth_v1';
const SESS_KEY  = 'reqmgr_session_v1';

export const ROLES = {
  MANAGER:  'manager',
  REVIEWER: 'reviewer',
};

export const ROLE_LABELS = {
  manager:  'Requirements Manager',
  reviewer: 'Reviewer',
};

// ── Default seed users ────────────────────────────────
const SEED_USERS = [
  { id: 'usr-001', username: 'manager',  displayName: 'Project Manager', role: ROLES.MANAGER,  passwordHash: hashPw('manager123'),  createdAt: new Date().toISOString() },
  { id: 'usr-002', username: 'reviewer', displayName: 'Lead Reviewer',   role: ROLES.REVIEWER, passwordHash: hashPw('reviewer123'), createdAt: new Date().toISOString() },
];

// ── Simple deterministic hash (NOT for production security) ──
export function hashPw(plain) {
  // FNV-1a 32-bit — good enough for a local tool demo
  let h = 0x811c9dc5;
  for (let i = 0; i < plain.length; i++) {
    h ^= plain.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Auth DB ───────────────────────────────────────────
export function loadAuthDb() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.users?.length) return parsed;
    }
  } catch (_) {}
  // First boot — seed defaults
  const fresh = { users: SEED_USERS };
  saveAuthDb(fresh);
  return fresh;
}

export function saveAuthDb(authDb) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(authDb)); } catch (_) {}
}

// ── Session ───────────────────────────────────────────
export function loadSession() {
  try {
    const raw = localStorage.getItem(SESS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

export function saveSession(session) {
  try { localStorage.setItem(SESS_KEY, JSON.stringify(session)); } catch (_) {}
}

export function clearSession() {
  try { localStorage.removeItem(SESS_KEY); } catch (_) {}
}

// ── Helpers ───────────────────────────────────────────
export function authenticate(authDb, username, password) {
  const user = authDb.users.find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );
  if (!user) return null;
  if (user.passwordHash !== hashPw(password)) return null;
  return user;
}

export function canEdit(session) {
  return session?.role === ROLES.MANAGER;
}

export function canReview(session) {
  return !!session; // both roles can review
}
