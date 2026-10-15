// ── components/AllRequirementsPanel.js ───────────────
// Shows every requirement grouped under project-defined sections.
// Managers can create, edit, reorder, and delete sections.
// Requirements are assigned to sections in the RequirementModal.

import React, { useState } from 'react';
import { CATEGORIES, CAT_META } from '../store/db';
import { Badge, Btn, Empty } from './UI';
import { SectionModal } from './SectionModal';
import styles from './AllRequirementsPanel.module.css';

export function AllRequirementsPanel({
  project, isManager, session,
  onEditReq, onDeleteReq,
  onUpsertSection, onDeleteSection, onReorderSections,
  onAddComment,
}) {
  const [secModal, setSecModal]     = useState({ open: false, editing: null });
  const [collapsed, setCollapsed]   = useState({});
  const [filter, setFilter]         = useState('');
  const [fStatus, setFStatus]       = useState('');
  const [fCat, setFCat]             = useState('');

  if (!project) return null;

  const sections  = [...(project.sections ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const allReqs   = CATEGORIES.flatMap(cat =>
    (project.requirements[cat] ?? []).map(r => ({ ...r, _cat: cat }))
  );

  // Filter
  let filtered = allReqs;
  if (filter) {
    const q = filter.toLowerCase();
    filtered = filtered.filter(r =>
      r.id.toLowerCase().includes(q) ||
      (r.title ?? '').toLowerCase().includes(q) ||
      (r.statement ?? '').toLowerCase().includes(q)
    );
  }
  if (fStatus) filtered = filtered.filter(r => r.status === fStatus);
  if (fCat)    filtered = filtered.filter(r => r._cat === fCat);

  // Group: bucketed by sectionId, plus an "Unassigned" bucket
  const buckets = {};
  sections.forEach(s => { buckets[s.id] = []; });
  buckets['__none__'] = [];
  filtered.forEach(r => {
    const key = r.sectionId && buckets[r.sectionId] ? r.sectionId : '__none__';
    buckets[key].push(r);
  });

  // Stats per section
  function sectionStats(reqs) {
    const total    = reqs.length;
    const approved = reqs.filter(r => r.status === 'approved').length;
    const inReview = reqs.filter(r => r.status === 'in-review').length;
    const open     = reqs.filter(r => r.status === 'open').length;
    const rejected = reqs.filter(r => r.status === 'rejected').length;
    return { total, approved, inReview, open, rejected };
  }

  function toggleCollapse(id) {
    setCollapsed(c => ({ ...c, [id]: !c[id] }));
  }

  function moveSection(id, dir) {
    const ids = sections.map(s => s.id);
    const idx = ids.indexOf(id);
    const next = [...ids];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onReorderSections(next);
  }

  function getBlockName(bid) {
    if (!bid || !project) return '';
    const b = (project.diagramBlocks ?? {})[bid];
    return b ? (b.title || 'Block ' + bid) : '';
  }

  const openSecModal  = (editing = null) => setSecModal({ open: true, editing });
  const closeSecModal = () => setSecModal({ open: false, editing: null });

  function handleSaveSection(sec) {
    onUpsertSection(sec, secModal.editing ? secModal.editing.id : null);
    closeSecModal();
  }

  // Total counts for header bar
  const totalReqs     = allReqs.length;
  const totalApproved = allReqs.filter(r => r.status === 'approved').length;
  const pct           = totalReqs ? Math.round(totalApproved / totalReqs * 100) : 0;

  return (
    <div className={styles.panel}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Requirements Overview</div>
          <div className={styles.sub}>All requirements · {totalReqs} total · {pct}% approved</div>
        </div>
        <div className={styles.headerActions}>
          {isManager && (
            <Btn size="sm" variant="primary" onClick={() => openSecModal()}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M8 3v10M3 8h10"/></svg>
              Add section
            </Btn>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className={styles.toolbar}>
        <input className={styles.filterInput} placeholder="Search all requirements…"
          value={filter} onChange={e => setFilter(e.target.value)} />
        <select className={styles.filterSelect} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in-review">In review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className={styles.filterSelect} value={fCat} onChange={e => setFCat(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_META[c].label}</option>)}
        </select>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* Global progress bar */}
        <div className={styles.globalBar}>
          {totalReqs > 0 && (
            <>
              <StackedBar reqs={allReqs} />
              <div className={styles.globalLegend}>
                <LegendDot color="#4ade80" label={`${allReqs.filter(r=>r.status==='approved').length} Approved`} />
                <LegendDot color="#fbbf24" label={`${allReqs.filter(r=>r.status==='in-review').length} In review`} />
                <LegendDot color="#60a5fa" label={`${allReqs.filter(r=>r.status==='open').length} Open`} />
                <LegendDot color="#f87171" label={`${allReqs.filter(r=>r.status==='rejected').length} Rejected`} />
              </div>
            </>
          )}
        </div>

        {totalReqs === 0 && (
          <Empty>No requirements yet. Add requirements in the category panels.</Empty>
        )}

        {/* ── Section buckets ── */}
        {sections.map((sec, secIdx) => {
          const reqs = buckets[sec.id] ?? [];
          const isCollapsed = collapsed[sec.id];
          const stats = sectionStats(reqs);
          return (
            <div key={sec.id} className={styles.section}>
              <div className={styles.sectionHeader} style={{ borderLeftColor: sec.color }}>
                <button className={styles.collapseBtn} onClick={() => toggleCollapse(sec.id)}>
                  <svg className={`${styles.chevron} ${isCollapsed ? styles.chevronCollapsed : ''}`}
                    viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="6">
                    <path d="M1 1l4 4 4-4"/>
                  </svg>
                </button>
                <div className={styles.sectionDot} style={{ background: sec.color }} />
                <div className={styles.sectionInfo}>
                  <div className={styles.sectionTitle}>{sec.title}</div>
                  {sec.description && <div className={styles.sectionDesc}>{sec.description}</div>}
                </div>
                <div className={styles.sectionStats}>
                  <span className={styles.sectionCount}>{stats.total}</span>
                  {stats.total > 0 && (
                    <div className={styles.miniBar}>
                      <StackedBar reqs={reqs} height={4} />
                    </div>
                  )}
                </div>
                {isManager && (
                  <div className={styles.sectionActions}>
                    <button className={styles.secActionBtn} onClick={() => moveSection(sec.id, -1)} disabled={secIdx === 0} title="Move up">↑</button>
                    <button className={styles.secActionBtn} onClick={() => moveSection(sec.id, +1)} disabled={secIdx === sections.length - 1} title="Move down">↓</button>
                    <button className={styles.secActionBtn} onClick={() => openSecModal(sec)} title="Edit">✎</button>
                    <button className={`${styles.secActionBtn} ${styles.secActionDanger}`}
                      onClick={() => { if (window.confirm(`Delete section "${sec.title}"? Requirements will be unassigned.`)) onDeleteSection(sec.id); }}
                      title="Delete">✕</button>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <div className={styles.sectionBody}>
                  {reqs.length === 0 ? (
                    <div className={styles.sectionEmpty}>No requirements assigned to this section yet.</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ width: 90 }}>ID</th>
                          <th>Title / Statement</th>
                          <th style={{ width: 60 }}>Cat</th>
                          <th style={{ width: 68 }}>Type</th>
                          <th style={{ width: 68 }}>Priority</th>
                          <th style={{ width: 80 }}>Status</th>
                          <th style={{ width: 60 }}>Traces</th>
                          {isManager && <th style={{ width: 16 }}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {reqs.map(r => (
                          <ReqRow key={r.id} req={r} isManager={isManager}
                            getBlockName={getBlockName}
                            onEdit={() => onEditReq(r._cat, r.id)}
                            onDelete={() => onDeleteReq(r._cat, r.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Unassigned bucket ── */}
        {(() => {
          const reqs = buckets['__none__'] ?? [];
          if (reqs.length === 0 && sections.length > 0) return null;
          const isCollapsed = collapsed['__none__'];
          return (
            <div className={styles.section}>
              <div className={styles.sectionHeader} style={{ borderLeftColor: 'var(--border2)' }}>
                <button className={styles.collapseBtn} onClick={() => toggleCollapse('__none__')}>
                  <svg className={`${styles.chevron} ${isCollapsed ? styles.chevronCollapsed : ''}`}
                    viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="6">
                    <path d="M1 1l4 4 4-4"/>
                  </svg>
                </button>
                <div className={styles.sectionDot} style={{ background: 'var(--border2)' }} />
                <div className={styles.sectionInfo}>
                  <div className={styles.sectionTitle} style={{ color: 'var(--text2)' }}>
                    {sections.length === 0 ? 'All Requirements' : 'Unassigned'}
                  </div>
                  <div className={styles.sectionDesc}>
                    {sections.length === 0
                      ? 'Create sections to organise requirements into groups.'
                      : 'Requirements not assigned to any section.'}
                  </div>
                </div>
                <div className={styles.sectionStats}>
                  <span className={styles.sectionCount}>{reqs.length}</span>
                  {reqs.length > 0 && <div className={styles.miniBar}><StackedBar reqs={reqs} height={4} /></div>}
                </div>
              </div>
              {!isCollapsed && reqs.length > 0 && (
                <div className={styles.sectionBody}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>ID</th>
                        <th>Title / Statement</th>
                        <th style={{ width: 60 }}>Cat</th>
                        <th style={{ width: 68 }}>Type</th>
                        <th style={{ width: 68 }}>Priority</th>
                        <th style={{ width: 80 }}>Status</th>
                        <th style={{ width: 60 }}>Traces</th>
                        {isManager && <th style={{ width: 16 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {reqs.map(r => (
                        <ReqRow key={r.id} req={r} isManager={isManager}
                          getBlockName={getBlockName}
                          onEdit={() => onEditReq(r._cat, r.id)}
                          onDelete={() => onDeleteReq(r._cat, r.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <SectionModal
        open={secModal.open}
        onClose={closeSecModal}
        onSave={handleSaveSection}
        editing={secModal.editing}
        existingSections={sections}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────

function ReqRow({ req, isManager, getBlockName, onEdit, onDelete }) {
  const sub      = getBlockName(req.subsystem);
  const traceN   = (req.traces ?? []).length;
  const openCmts = (req.comments ?? []).filter(c => !c.resolved).length;
  return (
    <tr className={styles.tableRow}>
      <td>
        <div className={styles.reqId}>{req.id}</div>
        {openCmts > 0 && <div className={styles.cmtPin}>{openCmts} cmt</div>}
      </td>
      <td>
        <div className={styles.reqTitle}>{req.title}</div>
        <div className={styles.reqStmt}>
          {(req.statement ?? '').substring(0, 100)}{req.statement?.length > 100 ? '…' : ''}
        </div>
        {sub && <span className={styles.subTag}>{sub}</span>}
      </td>
      <td><Badge variant={CAT_META[req._cat]?.badgeClass?.replace('b-','') ?? req._cat}>{CAT_META[req._cat]?.prefix ?? req._cat}</Badge></td>
      <td><Badge variant={req.type ?? 'shall'}>{(req.type ?? 'shall').toUpperCase()}</Badge></td>
      <td><Badge variant={req.priority ?? 'medium'}>{req.priority ?? 'medium'}</Badge></td>
      <td><Badge variant={req.status ?? 'open'}>{req.status ?? 'open'}</Badge></td>
      <td className={styles.traceCell}>{traceN > 0 ? <span className={styles.traceBadge}>{traceN}</span> : '—'}</td>
      {isManager && (
        <td>
          <div className={styles.rowActions}>
            <Btn size="xs" onClick={onEdit}>Edit</Btn>
            <Btn size="xs" variant="danger" onClick={onDelete}>×</Btn>
          </div>
        </td>
      )}
    </tr>
  );
}

function StackedBar({ reqs, height = 6 }) {
  const total    = reqs.length;
  if (total === 0) return null;
  const approved = reqs.filter(r => r.status === 'approved').length;
  const inReview = reqs.filter(r => r.status === 'in-review').length;
  const rejected = reqs.filter(r => r.status === 'rejected').length;
  const open     = total - approved - inReview - rejected;
  const pct = n => (n / total * 100).toFixed(1) + '%';
  return (
    <div style={{ display:'flex', height, borderRadius: 99, overflow:'hidden', width:'100%' }}>
      {approved > 0 && <div style={{ width: pct(approved), background: '#22c55e' }} />}
      {inReview > 0 && <div style={{ width: pct(inReview), background: '#f59e0b' }} />}
      {open     > 0 && <div style={{ width: pct(open),     background: '#3b8bff' }} />}
      {rejected > 0 && <div style={{ width: pct(rejected), background: '#ef4444' }} />}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'var(--text3)' }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
      {label}
    </div>
  );
}
