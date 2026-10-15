// ── store/auth.js ─────────────────────────────────────
// Project roles. Accounts, passwords and sessions live on the server;
// a user's role is set per project by that project's managers.
//
// Managers  → full CRUD on the project, its members and backups
// Reviewers → read-only + review comments; can export and import

export const ROLES = {
  MANAGER:  'manager',
  REVIEWER: 'reviewer',
};

export const ROLE_LABELS = {
  manager:  'Requirements Manager',
  reviewer: 'Reviewer',
};
