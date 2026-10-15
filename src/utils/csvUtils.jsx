// ── utils/csvUtils.jsx ───────────────────────────────
// Export all requirements of a project to CSV and import back.
//
// CSV columns:
//   ID, Category, Section, Title, Statement, Type, Status, Priority,
//   Subsystem, Verification, Source, Owner, Rationale, Acceptance,
//   Traces, Version, CreatedAt, UpdatedAt
//
// Traces are encoded as  "SYS-001:derives|HW-002:implements"
// Fields with commas/newlines/quotes are RFC-4180 quoted.

import { CATEGORIES, CAT_META, nowIso } from '../store/db';

// ── Column definition ─────────────────────────────────
const COLUMNS = [
  { key: 'id',           header: 'ID'           },
  { key: '_cat',         header: 'Category'     },
  { key: '_section',     header: 'Section'      },  // resolved title at export
  { key: 'title',        header: 'Title'        },
  { key: 'statement',    header: 'Statement'    },
  { key: 'type',         header: 'Type'         },
  { key: 'status',       header: 'Status'       },
  { key: 'priority',     header: 'Priority'     },
  { key: '_subsystem',   header: 'Subsystem'    },  // resolved name at export
  { key: 'verification', header: 'Verification' },
  { key: 'source',       header: 'Source'       },
  { key: 'owner',        header: 'Owner'        },
  { key: 'rationale',    header: 'Rationale'    },
  { key: 'acceptance',   header: 'Acceptance'   },
  { key: 'objectType',   header: 'ObjectType'   },  // requirement | information | test_case
  { key: 'reqType',      header: 'ReqType'      },  // functional | non_functional
  { key: '_traces',      header: 'Traces'       },  // "ID:type|ID:type"
  { key: 'version',      header: 'Version'      },
  { key: 'createdAt',    header: 'CreatedAt'    },
  { key: 'updatedAt',    header: 'UpdatedAt'    },
];

// ── RFC-4180 cell quoting ─────────────────────────────
function quoteCell(val) {
  const s = val == null ? '' : String(val);
  // Must quote if contains comma, double-quote, or newline
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ── RFC-4180 parser ───────────────────────────────────
// Returns array of row-arrays. Handles quoted fields with embedded commas/newlines.
export function parseCsv(text) {
  const rows  = [];
  let cur     = [];
  let field   = '';
  let inQuote = false;
  let i       = 0;

  // Normalise line endings
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (i < s.length) {
    const ch   = s[i];
    const next = s[i + 1];

    if (inQuote) {
      if (ch === '"' && next === '"') {
        field += '"'; i += 2;        // escaped quote
      } else if (ch === '"') {
        inQuote = false; i++;        // closing quote
      } else {
        field += ch; i++;
      }
    } else {
      if (ch === '"') {
        inQuote = true; i++;
      } else if (ch === ',') {
        cur.push(field); field = ''; i++;
      } else if (ch === '\n') {
        cur.push(field); field = '';
        rows.push(cur); cur = []; i++;
      } else {
        field += ch; i++;
      }
    }
  }

  // Last field / row
  cur.push(field);
  if (cur.some(c => c !== '')) rows.push(cur);

  return rows;
}

// ── EXPORT ────────────────────────────────────────────
export function exportToCsv(project, pid) {
  if (!project) return;

  const sections  = Object.fromEntries((project.sections ?? []).map(s => [s.id, s.title]));
  const blocks    = project.diagramBlocks ?? {};

  const header = COLUMNS.map(c => quoteCell(c.header)).join(',');

  const lines = CATEGORIES.flatMap(cat =>
    (project.requirements[cat] ?? []).map(r => {
      const traceStr = (r.traces ?? []).map(t => `${t.toId}:${t.type}`).join('|');
      const row = {
        id:           r.id,
        _cat:         cat,
        _section:     r.sectionId ? (sections[r.sectionId] ?? '') : '',
        title:        r.title        ?? '',
        statement:    r.statement    ?? '',
        type:         r.type         ?? 'shall',
        status:       r.status       ?? 'open',
        priority:     r.priority     ?? 'medium',
        _subsystem:   r.subsystem ? (blocks[r.subsystem]?.title ?? r.subsystem) : '',
        verification: r.verification ?? '',
        source:       r.source       ?? '',
        owner:        r.owner        ?? '',
        rationale:    r.rationale    ?? '',
        acceptance:   r.acceptance   ?? '',
        objectType:   r.objectType   ?? 'requirement',
        reqType:      r.reqType      ?? 'functional',
        _traces:      traceStr,
        version:      r.version      ?? 1,
        createdAt:    r.createdAt    ?? '',
        updatedAt:    r.updatedAt    ?? '',
      };
      return COLUMNS.map(c => quoteCell(row[c.key])).join(',');
    })
  );

  const csv  = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${pid}_${(project.name || 'requirements').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── IMPORT ────────────────────────────────────────────
// Returns { requirements, warnings[] }
// requirements is { system:[], hardware:[], software:[], mechanical:[] }
//
// Category mapping:  the Category column may contain the category key
// ('system') or the prefix ('SYS') or the label ('System') — all accepted.
// Section: matched by title to existing project sections (case-insensitive);
//          unmatched sections are collected in warnings.
// Traces:  IDs are preserved as-is; caller should validate after import.

const PREFIX_TO_CAT = Object.fromEntries(
  CATEGORIES.map(c => [CAT_META[c].prefix.toLowerCase(), c])
);
const LABEL_TO_CAT = Object.fromEntries(
  CATEGORIES.map(c => [CAT_META[c].label.toLowerCase(), c])
);

function resolveCategory(raw) {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (CATEGORIES.includes(s))    return s;
  if (PREFIX_TO_CAT[s])          return PREFIX_TO_CAT[s];
  if (LABEL_TO_CAT[s])           return LABEL_TO_CAT[s];
  return null;
}

export function importFromCsv(csvText, project) {
  const rows     = parseCsv(csvText);
  if (rows.length < 2) throw new Error('CSV is empty or has no data rows.');

  const headerRow = rows[0].map(h => h.trim().toLowerCase());
  const dataRows  = rows.slice(1);

  // Build column index from header
  const idx = {};
  COLUMNS.forEach(col => {
    const hi = headerRow.indexOf(col.header.toLowerCase());
    if (hi >= 0) idx[col.key] = hi;
  });

  // Must have at minimum: ID, Category, Title, Statement
  const required = ['id', '_cat', 'title', 'statement'];
  const missing  = required.filter(k => idx[k] === undefined);
  if (missing.length) {
    throw new Error(
      `Missing required columns: ${missing.map(k => {
        const col = COLUMNS.find(c => c.key === k);
        return col ? col.header : k;
      }).join(', ')}`
    );
  }

  // Build section title→id map from existing project sections
  const sectionByTitle = {};
  (project?.sections ?? []).forEach(s => {
    sectionByTitle[s.title.trim().toLowerCase()] = s.id;
  });

  // Build subsystem name→id map from existing diagram blocks
  const blockByName = {};
  Object.values(project?.diagramBlocks ?? {}).forEach(b => {
    if (b.title) blockByName[b.title.trim().toLowerCase()] = String(b.id);
  });

  const requirements = Object.fromEntries(CATEGORIES.map(c => [c, []]));
  const warnings     = [];
  const seenIds      = new Set();

  function cell(row, key, fallback = '') {
    return idx[key] !== undefined ? (row[idx[key]] ?? fallback).trim() : fallback;
  }

  dataRows.forEach((row, rowNum) => {
    const lineNum = rowNum + 2; // 1-based + header

    const id  = cell(row, 'id').toUpperCase();
    const cat = resolveCategory(cell(row, '_cat'));

    if (!id) {
      warnings.push(`Row ${lineNum}: skipped — ID is empty.`);
      return;
    }
    if (!cat) {
      warnings.push(`Row ${lineNum}: skipped — unknown category "${cell(row, '_cat')}".`);
      return;
    }
    if (seenIds.has(id)) {
      warnings.push(`Row ${lineNum}: duplicate ID "${id}" — later row overwrites earlier.`);
    }
    seenIds.add(id);

    // Section resolution
    const sectionTitle = cell(row, '_section');
    let sectionId = '';
    if (sectionTitle) {
      sectionId = sectionByTitle[sectionTitle.toLowerCase()] ?? '';
      if (!sectionId) {
        warnings.push(`Row ${lineNum}: section "${sectionTitle}" not found in project — field left blank.`);
      }
    }

    // Subsystem resolution
    const subsystemName = cell(row, '_subsystem');
    let subsystem = '';
    if (subsystemName) {
      subsystem = blockByName[subsystemName.toLowerCase()] ?? '';
      if (!subsystem) {
        warnings.push(`Row ${lineNum}: subsystem "${subsystemName}" not found in diagram — field left blank.`);
      }
    }

    // Traces: "SYS-001:derives|HW-002:implements"
    const tracesRaw = cell(row, '_traces');
    const traces = tracesRaw
      ? tracesRaw.split('|').map(t => {
          const [toId, type] = t.split(':');
          return toId ? { toId: toId.trim().toUpperCase(), type: (type ?? 'derives').trim() } : null;
        }).filter(Boolean)
      : [];

    // Type validation
    const typeVal = cell(row, 'type', 'shall').toLowerCase();
    const type    = ['shall','should','may'].includes(typeVal) ? typeVal : 'shall';

    // Status validation
    const statusVal = cell(row, 'status', 'open').toLowerCase().replace(' ', '-');
    const status    = ['open','in-review','approved','rejected'].includes(statusVal) ? statusVal : 'open';

    // Priority validation
    const priorityVal = cell(row, 'priority', 'medium').toLowerCase();
    const priority    = ['high','medium','low'].includes(priorityVal) ? priorityVal : 'medium';

    const version = parseInt(cell(row, 'version', '1'), 10) || 1;

    const req = {
      id,
      title:        cell(row, 'title'),
      statement:    cell(row, 'statement'),
      type,
      status,
      priority,
      sectionId,
      subsystem,
      verification: cell(row, 'verification'),
      source:       cell(row, 'source'),
      owner:        cell(row, 'owner'),
      rationale:    cell(row, 'rationale'),
      acceptance:   cell(row, 'acceptance'),
      objectType:   (['requirement','information','test_case'].includes(cell(row, 'objectType').toLowerCase())
                      ? cell(row, 'objectType').toLowerCase() : 'requirement'),
      reqType:      (['functional','non_functional'].includes(cell(row, 'reqType').toLowerCase())
                      ? cell(row, 'reqType').toLowerCase() : 'functional'),
      traces,
      version,
      history:  [],
      comments: [],
      createdAt: cell(row, 'createdAt') || nowIso(),
      updatedAt: cell(row, 'updatedAt') || nowIso(),
    };

    // Remove duplicate if ID already exists (overwrite)
    requirements[cat] = requirements[cat].filter(r => r.id !== id);
    requirements[cat].push(req);
  });

  return { requirements, warnings };
}
