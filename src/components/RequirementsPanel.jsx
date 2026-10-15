// ── components/RequirementsPanel.js ──────────────────
import React, { useState } from 'react';
import { CAT_META, OBJECT_TYPES, REQ_TYPES } from '../store/db';
import { Badge, Btn, Empty } from './UI';
import { ReviewPanel } from './ReviewPanel';
import styles from './RequirementsPanel.module.css';

export function RequirementsPanel({
  category, project, session, isManager,
  onAdd, onEdit, onDelete,
  onAddComment, onEditComment, onResolveComment, onDeleteComment,
}) {
  const [filter,    setFilter]    = useState('');
  const [fStatus,   setFStatus]   = useState('');
  const [fPriority, setFPriority] = useState('');
  const [detailId,  setDetailId]  = useState(null);

  const meta    = CAT_META[category];
  const allReqs = project?.requirements[category] ?? [];

  let reqs = allReqs;
  if (filter) {
    const q = filter.toLowerCase();
    reqs = reqs.filter(r =>
      r.id.toLowerCase().includes(q) ||
      (r.title ?? '').toLowerCase().includes(q) ||
      (r.statement ?? '').toLowerCase().includes(q)
    );
  }
  if (fStatus)   reqs = reqs.filter(r => r.status === fStatus);
  if (fPriority) reqs = reqs.filter(r => r.priority === fPriority);

  const detail = detailId ? allReqs.find(r => r.id === detailId) : null;

  function getBlockName(bid) {
    if (!bid || !project) return '';
    const b = (project.diagramBlocks ?? {})[bid];
    return b ? (b.title || 'Block ' + bid) : '';
  }

  const subtitleMap = {
    customer:   'CUST-xxx · Voice of the customer — market & stakeholder needs',
    system:     'SYS-xxx · Top-level functional & performance specifications',
    hardware:   'HW-xxx · Electronic, electrical & physical constraints',
    software:   'SW-xxx · Firmware, embedded & application specifications',
    mechanical: 'MECH-xxx · Housing, mounting & environmental specifications',
  };

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{meta.label} Requirements</div>
          <div className={styles.sub}>{subtitleMap[category]}</div>
        </div>
        {isManager && (
          <Btn variant="primary" size="sm" onClick={() => onAdd(category)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M8 3v10M3 8h10"/></svg>
            Add
          </Btn>
        )}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          className={styles.filterInput}
          placeholder="Search requirements…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <select className={styles.filterSelect} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in-review">In review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className={styles.filterSelect} value={fPriority} onChange={e => setFPriority(e.target.value)}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Content row */}
      <div className={styles.contentRow}>
        <div className={`${styles.tableWrap} ${detail ? styles.tableWrapNarrow : ''}`}>
          {reqs.length === 0 ? (
            <Empty>
              {allReqs.length > 0
                ? 'No results for current filters.'
                : 'No requirements yet.\nClick "Add" to create the first one.'}
            </Empty>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 86 }}>ID</th>
                  <th>Requirement</th>
                  <th style={{ width: 70 }}>Type</th>
                  <th style={{ width: 72 }}>Priority</th>
                  <th style={{ width: 82 }}>Status</th>
                  <th style={{ width: 68 }}>Obj type</th>
                  <th style={{ width: 76 }}>Req type</th>
                  <th style={{ width: 44 }}>Ver</th>
                  <th style={{ width: 50 }}>Cmts</th>
                  {isManager && <th style={{ width: 16 }}></th>}
                </tr>
              </thead>
              <tbody>
                {reqs.map(r => {
                  const sub      = getBlockName(r.subsystem);
                  const openCmts = (r.comments ?? []).filter(c => !c.resolved).length;
                  return (
                    <tr
                      key={r.id}
                      className={detailId === r.id ? styles.rowActive : ''}
                      onClick={() => setDetailId(detailId === r.id ? null : r.id)}
                    >
                      <td><span className={styles.reqId}>{r.id}</span></td>
                      <td>
                        <div className={styles.reqTitle}>{r.title}</div>
                        <div className={styles.reqStmt}>
                          {(r.statement ?? '').substring(0, 120)}{r.statement?.length > 120 ? '…' : ''}
                        </div>
                        {(sub || r.owner) && (
                          <div className={styles.reqMeta}>
                            {sub && <Badge variant="open" style={{ fontSize: '8px' }}>{sub}</Badge>}
                            {r.owner && <span className={styles.owner}>{r.owner}</span>}
                          </div>
                        )}
                      </td>
                      <td><Badge variant={r.type ?? 'shall'}>{(r.type ?? 'shall').toUpperCase()}</Badge></td>
                      <td><Badge variant={r.priority ?? 'medium'}>{r.priority ?? 'medium'}</Badge></td>
                      <td><Badge variant={r.status ?? 'open'}>{r.status ?? 'open'}</Badge></td>
                      <td>
                        {(() => {
                          const ot = OBJECT_TYPES[r.objectType ?? 'requirement'];
                          return <span className={styles.objTypeBadge} style={{ background: ot.color + '20', color: ot.color }}>{ot.short}</span>;
                        })()}
                      </td>
                      <td>
                        {(r.objectType ?? 'requirement') === 'requirement' && (
                          <span className={styles.reqTypeBadge + ' ' + ((r.reqType ?? 'functional') === 'functional' ? styles.reqTypeF : styles.reqTypeNF)}>
                            {REQ_TYPES[r.reqType ?? 'functional']?.short ?? 'F'}
                          </span>
                        )}
                      </td>
                      <td className={styles.verCell}>v{r.version ?? 1}</td>
                      <td>
                        {openCmts > 0
                          ? <span className={styles.cmtBadge}>{openCmts}</span>
                          : <span className={styles.cmtBadgeNone}>—</span>}
                      </td>
                      {isManager && (
                        <td onClick={e => e.stopPropagation()}>
                          <div className={styles.rowActions}>
                            <Btn size="xs" onClick={() => onEdit(category, r.id)}>Edit</Btn>
                            <Btn size="xs" variant="danger" onClick={() => {
                              onDelete(category, r.id);
                              if (detailId === r.id) setDetailId(null);
                            }}>×</Btn>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Review pane */}
        {detail && (
          <ReviewPanel
            req={detail}
            category={category}
            catMeta={meta}
            getBlockName={getBlockName}
            session={session}
            isManager={isManager}
            onClose={() => setDetailId(null)}
            onEdit={() => onEdit(category, detail.id)}
            onDelete={() => { onDelete(category, detail.id); setDetailId(null); }}
            onAddComment={text => onAddComment(category, detail.id, text)}
            onEditComment={(cid, text) => onEditComment(category, detail.id, cid, text)}
            onResolveComment={cid => onResolveComment(category, detail.id, cid)}
            onDeleteComment={cid => onDeleteComment(category, detail.id, cid)}
          />
        )}
      </div>
    </div>
  );
}
