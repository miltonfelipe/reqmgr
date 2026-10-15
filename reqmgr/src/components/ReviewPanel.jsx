// ── components/ReviewPanel.js ────────────────────────
// Shown as the right pane when a requirement row is clicked.
// Contains:
//   • Requirement detail (read-only)
//   • Version history (expandable diffs)
//   • Review comments thread (add / edit / resolve / delete)

import React, { useState } from 'react';
import { Badge, Btn } from './UI';
import { ROLE_LABELS } from '../store/auth';
import styles from './ReviewPanel.module.css';

export function ReviewPanel({ req, category, catMeta, getBlockName, session, isManager,
  onClose, onEdit, onDelete, onAddComment, onEditComment, onResolveComment, onDeleteComment }) {
  const [commentText, setCommentText]   = useState('');
  const [editingCmt,  setEditingCmt]    = useState(null); // { id, text }
  const [showHistory, setShowHistory]   = useState(false);
  const [historyIdx,  setHistoryIdx]    = useState(null); // which snapshot to expand

  if (!req) return null;

  const comments = req.comments ?? [];
  const history  = req.history  ?? [];

  function handleAddComment() {
    const text = commentText.trim();
    if (!text) return;
    onAddComment(text);
    setCommentText('');
  }

  function handleSaveEdit() {
    if (!editingCmt || !editingCmt.text.trim()) return;
    onEditComment(editingCmt.id, editingCmt.text.trim());
    setEditingCmt(null);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  }

  const openComments     = comments.filter(c => !c.resolved).length;
  const resolvedComments = comments.filter(c => c.resolved).length;

  return (
    <div className={styles.pane}>
      {/* ── Header ── */}
      <div className={styles.paneHeader}>
        <div className={styles.paneHeaderLeft}>
          <div className={styles.reqId}>{req.id}</div>
          <div className={styles.reqVersion}>v{req.version ?? 1}</div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>

      <div className={styles.paneBody}>
        {/* ── Requirement detail ── */}
        <div className={styles.reqTitle}>{req.title}</div>
        <div className={styles.reqStmt}>{req.statement}</div>

        <div className={styles.badges}>
          <Badge variant={req.type ?? 'shall'}>{(req.type ?? 'SHALL').toUpperCase()}</Badge>
          <Badge variant={req.status ?? 'open'}>{req.status ?? 'open'}</Badge>
          <Badge variant={req.priority ?? 'medium'}>{req.priority ?? 'medium'}</Badge>
          <Badge variant={catMeta.badgeClass.replace('b-','')}>{catMeta.label}</Badge>
        </div>

        <div className={styles.metaGrid}>
          <MetaRow label="Subsystem"    value={getBlockName(req.subsystem) || '—'} />
          <MetaRow label="Verification" value={req.verification || '—'} />
          <MetaRow label="Source"       value={req.source || '—'} />
          <MetaRow label="Owner"        value={req.owner || '—'} />
          <MetaRow label="Updated"      value={fmtDate(req.updatedAt)} />
        </div>

        {req.rationale && (
          <>
            <div className={styles.sectionLabel}>Rationale</div>
            <p className={styles.textBlock}>{req.rationale}</p>
          </>
        )}
        {req.acceptance && (
          <>
            <div className={styles.sectionLabel}>Acceptance criteria</div>
            <p className={styles.textBlock}>{req.acceptance}</p>
          </>
        )}

        {isManager && (
          <div className={styles.reqActions}>
            <Btn size="sm" onClick={onEdit}>Edit requirement</Btn>
            <Btn size="sm" variant="danger" onClick={onDelete}>Delete</Btn>
          </div>
        )}

        {/* ── Version history ── */}
        {history.length > 0 && (
          <div className={styles.historySection}>
            <button className={styles.historyToggle} onClick={() => setShowHistory(h => !h)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
                <path d="M1 8a7 7 0 1014 0A7 7 0 001 8zM8 5v3l2 2"/>
              </svg>
              Version history
              <span className={styles.historyCount}>{history.length} revision{history.length !== 1 ? 's' : ''}</span>
              <svg className={`${styles.histChevron} ${showHistory ? styles.histChevronOpen : ''}`}
                viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" width="9" height="5">
                <path d="M1 1l4 4 4-4"/>
              </svg>
            </button>

            {showHistory && (
              <div className={styles.historyList}>
                {[...history].reverse().map((snap, i) => (
                  <div key={snap.snapshotId} className={styles.historyItem}>
                    <div className={styles.historyItemHeader}
                      onClick={() => setHistoryIdx(historyIdx === i ? null : i)}>
                      <span className={styles.snapVersion}>v{snap.version}</span>
                      <span className={styles.snapDate}>{fmtDate(snap.capturedAt)}</span>
                      <span className={styles.snapBy}>by {snap.capturedBy}</span>
                      <svg className={`${styles.snapChevron} ${historyIdx === i ? styles.snapChevronOpen : ''}`}
                        viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" width="9" height="5">
                        <path d="M1 1l4 4 4-4"/>
                      </svg>
                    </div>
                    {historyIdx === i && (
                      <div className={styles.snapDetail}>
                        <SnapField label="Title"     cur={req.title}       old={snap.title} />
                        <SnapField label="Statement" cur={req.statement}   old={snap.statement} />
                        <SnapField label="Status"    cur={req.status}      old={snap.status} />
                        <SnapField label="Priority"  cur={req.priority}    old={snap.priority} />
                        <SnapField label="Type"      cur={req.type}        old={snap.type} />
                        {snap.rationale !== req.rationale &&
                          <SnapField label="Rationale" cur={req.rationale} old={snap.rationale} />}
                        {snap.acceptance !== req.acceptance &&
                          <SnapField label="Acceptance" cur={req.acceptance} old={snap.acceptance} />}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Comments ── */}
        <div className={styles.commentsSection}>
          <div className={styles.commentsHeader}>
            <div className={styles.sectionLabel} style={{ margin: 0 }}>Review comments</div>
            <div className={styles.commentsCounts}>
              {openComments > 0 && <span className={styles.countOpen}>{openComments} open</span>}
              {resolvedComments > 0 && <span className={styles.countResolved}>{resolvedComments} resolved</span>}
            </div>
          </div>

          {comments.length === 0 && (
            <div className={styles.noComments}>No comments yet. Be the first to review.</div>
          )}

          {comments.map(c => (
            <div key={c.commentId} className={`${styles.comment} ${c.resolved ? styles.commentResolved : ''}`}>
              <div className={styles.cmtHeader}>
                <div className={`${styles.cmtAvatar} ${styles['role-' + c.authorRole]}`}>
                  {c.authorName.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
                </div>
                <div className={styles.cmtMeta}>
                  <span className={styles.cmtAuthor}>{c.authorName}</span>
                  <span className={`${styles.cmtRole} ${styles['roletag-' + c.authorRole]}`}>
                    {ROLE_LABELS[c.authorRole] ?? c.authorRole}
                  </span>
                  <span className={styles.cmtDate}>{fmtDate(c.createdAt)}</span>
                  {c.editedAt && <span className={styles.cmtEdited}>(edited)</span>}
                </div>
                <div className={styles.cmtReqVer}>req v{c.reqVersion}</div>
              </div>

              {editingCmt?.id === c.commentId ? (
                <div className={styles.cmtEditWrap}>
                  <textarea
                    className={styles.cmtEditInput}
                    value={editingCmt.text}
                    onChange={e => setEditingCmt(ec => ({ ...ec, text: e.target.value }))}
                    autoFocus
                  />
                  <div style={{ display:'flex', gap:5, marginTop:6 }}>
                    <Btn size="xs" onClick={() => setEditingCmt(null)}>Cancel</Btn>
                    <Btn size="xs" variant="primary" onClick={handleSaveEdit}>Save</Btn>
                  </div>
                </div>
              ) : (
                <div className={styles.cmtText}>{c.text}</div>
              )}

              {c.resolved && (
                <div className={styles.resolvedTag}>
                  ✓ Resolved by {c.resolvedBy} · {fmtDate(c.resolvedAt)}
                </div>
              )}

              <div className={styles.cmtActions}>
                {/* Resolve / unresolve — manager only */}
                {isManager && (
                  <button className={styles.cmtActionBtn} onClick={() => onResolveComment(c.commentId)}>
                    {c.resolved ? 'Unresolve' : 'Resolve'}
                  </button>
                )}
                {/* Edit — own comment only */}
                {session?.userId === c.authorId && !c.resolved && (
                  <button className={styles.cmtActionBtn}
                    onClick={() => setEditingCmt({ id: c.commentId, text: c.text })}>
                    Edit
                  </button>
                )}
                {/* Delete — own comment or manager */}
                {(session?.userId === c.authorId || isManager) && (
                  <button className={`${styles.cmtActionBtn} ${styles.cmtActionDanger}`}
                    onClick={() => { if (window.confirm('Delete this comment?')) onDeleteComment(c.commentId); }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add comment */}
          <div className={styles.addComment}>
            <div className={`${styles.cmtAvatar} ${styles['role-' + session?.role]}`} style={{ flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
              {(session?.displayName || session?.username || '?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
            </div>
            <div className={styles.addCommentRight}>
              <textarea
                className={styles.commentInput}
                placeholder="Add a review comment…"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment(); }}
              />
              <div className={styles.addCommentFooter}>
                <span className={styles.addCommentHint}>Ctrl+Enter to submit</span>
                <Btn size="sm" variant="primary" disabled={!commentText.trim()} onClick={handleAddComment}>
                  Comment
                </Btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className={styles.metaRow}>
      <span className={styles.metaKey}>{label}</span>
      <span className={styles.metaVal}>{value}</span>
    </div>
  );
}

function SnapField({ label, cur, old }) {
  const changed = cur !== old;
  return (
    <div className={styles.snapField}>
      <div className={styles.snapFieldLabel}>{label}</div>
      {changed ? (
        <>
          <div className={styles.snapOld}>{old || <em>empty</em>}</div>
          <div className={styles.snapNew}>{cur || <em>empty</em>}</div>
        </>
      ) : (
        <div className={styles.snapUnchanged}>{cur || <em>empty</em>} (unchanged)</div>
      )}
    </div>
  );
}
