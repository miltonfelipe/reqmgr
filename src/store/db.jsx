// ── store/db.js ──────────────────────────────────────
const DB_KEY = 'reqmgr_v2';

// Category order reflects the requirements hierarchy:
//   customer (top-level) → system → hardware / software / mechanical
export const CATEGORIES = ['customer', 'system', 'hardware', 'software', 'mechanical'];

// Hierarchy levels (used for visual grouping in the sidebar and overview)
export const CAT_LEVEL = {
  customer:   0,  // top-level — voice of the customer
  system:     1,  // derived from customer
  hardware:   2,  // derived from system
  software:   2,
  mechanical: 2,
};

export const CAT_META = {
  customer:   { prefix: 'CUST', label: 'Customer',   color: 'var(--c-cust)', badgeClass: 'b-cust' },
  system:     { prefix: 'SYS',  label: 'System',     color: 'var(--c-sys)',  badgeClass: 'b-sys'  },
  hardware:   { prefix: 'HW',   label: 'Hardware',   color: 'var(--c-hw)',   badgeClass: 'b-hw'   },
  software:   { prefix: 'SW',   label: 'Software',   color: 'var(--c-sw)',   badgeClass: 'b-sw'   },
  mechanical: { prefix: 'MECH', label: 'Mechanical', color: 'var(--c-mech)', badgeClass: 'b-mech' },
};

export const BLOCK_COLORS = [
  { bg: '#eff6ff', border: '#2563eb', text: '#1d4ed8', name: 'blue'   },
  { bg: '#f0fdf4', border: '#16a34a', text: '#15803d', name: 'green'  },
  { bg: '#fffbeb', border: '#d97706', text: '#b45309', name: 'amber'  },
  { bg: '#f5f3ff', border: '#7c3aed', text: '#6d28d9', name: 'purple' },
  { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c', name: 'red'    },
  { bg: '#ecfeff', border: '#0891b2', text: '#0e7490', name: 'teal'   },
  { bg: '#fdf2f8', border: '#db2777', text: '#be185d', name: 'pink'   },
  { bg: '#fff7ed', border: '#ea580c', text: '#c2410c', name: 'orange' },
];

// Trace relationship types
export const TRACE_TYPES = {
  derives:    { label: 'Derives from',  color: '#60a5fa', short: 'DRV' },
  implements: { label: 'Implements',    color: '#4ade80', short: 'IMP' },
  verifies:   { label: 'Verifies',      color: '#fbbf24', short: 'VER' },
  refines:    { label: 'Refines',       color: '#a78bfa', short: 'REF' },
  conflicts:  { label: 'Conflicts',     color: '#f87171', short: 'CON' },
};

// Object types — what kind of record this requirement represents
export const OBJECT_TYPES = {
  requirement: { label: 'Requirement', short: 'REQ', color: '#60a5fa' },
  information: { label: 'Information', short: 'INF', color: '#94a3b8' },
  test_case:   { label: 'Test Case',   short: 'TST', color: '#4ade80' },
};

// Requirement types — functional vs non-functional
export const REQ_TYPES = {
  functional:     { label: 'Functional',     short: 'F'  },
  non_functional: { label: 'Non-functional', short: 'NF' },
};

// Section accent colors
export const SECTION_COLORS = [
  '#3b8bff','#22c55e','#f59e0b','#a78bfa','#ef4444','#0d9488','#db2777','#ea580c',
];

// ── Persistence ─────────────────────────────────────
export function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { const p = JSON.parse(raw); if (p?.projects) return p; }
  } catch (_) {}
  return { projects: {} };
}

export function saveDb(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (_) {}
}

export function nowIso() { return new Date().toISOString(); }

export function makeEmptyProject(id, name) {
  return {
    name, version: '1.0.0', status: 'Draft', targetDate: '',
    description: '', lead: '', customer: '', standards: [], notes: '',
    createdAt: nowIso(), updatedAt: nowIso(),
    requirements: { customer: [], system: [], hardware: [], software: [], mechanical: [] },
    diagramBlocks: {}, diagramConns: [], blockIdC: 0, connIdC: 0,
    sections: [],   // [{ id, title, description, color, order }]
  };
}

export function makeEmptySection(existingSections = []) {
  const id = `sec-${Date.now()}`;
  return {
    id,
    title: 'New Section',
    description: '',
    color: SECTION_COLORS[existingSections.length % SECTION_COLORS.length],
    order: existingSections.length,
  };
}

export function makeEmptyReq(cat, existingIds = []) {
  const prefix = CAT_META[cat]?.prefix ?? cat.toUpperCase();
  let n = existingIds.length + 1;
  let id = `${prefix}-${String(n).padStart(3,'0')}`;
  while (existingIds.includes(id)) { n++; id = `${prefix}-${String(n).padStart(3,'0')}`; }
  return {
    id, title: '', statement: '', type: 'shall', status: 'open', priority: 'medium',
    subsystem: '', verification: '', source: '', owner: '', rationale: '', acceptance: '',
    objectType: 'requirement', reqType: 'functional',
    createdAt: nowIso(), updatedAt: nowIso(),
    version: 1, history: [], comments: [],
    sectionId: '',   // links to project.sections[].id
    traces: [],      // [{ toId: 'SYS-001', type: 'derives' }]
  };
}

export function makeSnapshot(req, editorName) {
  return {
    snapshotId: `snap-${Date.now()}`,
    version: req.version ?? 1,
    capturedAt: nowIso(), capturedBy: editorName,
    title: req.title, statement: req.statement, type: req.type,
    status: req.status, priority: req.priority, subsystem: req.subsystem,
    verification: req.verification, source: req.source, owner: req.owner,
    rationale: req.rationale, acceptance: req.acceptance,
    objectType: req.objectType ?? 'requirement', reqType: req.reqType ?? 'functional',
    sectionId: req.sectionId,
  };
}

export function makeComment(text, authorId, authorName, authorRole, reqVersion) {
  return {
    commentId: `cmt-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    text, authorId, authorName, authorRole,
    createdAt: nowIso(), editedAt: null,
    resolved: false, resolvedBy: null, resolvedAt: null,
    reqVersion: reqVersion ?? 1,
  };
}

// ── Helpers ───────────────────────────────────────────
// Returns flat array of all requirements across all categories
export function getAllReqs(project) {
  if (!project) return [];
  return CATEGORIES.flatMap(cat =>
    (project.requirements[cat] ?? []).map(r => ({ ...r, _cat: cat }))
  );
}

// Build a lookup map: reqId -> req (with _cat)
export function buildReqMap(project) {
  const map = {};
  getAllReqs(project).forEach(r => { map[r.id] = r; });
  return map;
}
