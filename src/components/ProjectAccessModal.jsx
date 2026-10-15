// ── components/ProjectAccessModal.js ─────────────────
// Project members (who can see the project, and their role) and the
// automatic backups the server keeps before imports and restores.
// Every member can view both and download backups; managers can
// change members and restore backups.
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { ROLES, ROLE_LABELS } from '../store/auth';
import { exportProject } from '../utils/exportImport';
import { Modal, ModalFooter, Btn, Select } from './UI';
import styles from './ProjectAccessModal.module.css';

export function ProjectAccessModal({ open, onClose, pid, isManager, users, userId, onRestore, onError }) {
  const [tab,     setTab]     = useState('members');
  const [members, setMembers] = useState([]);
  const [backups, setBackups] = useState([]);
  const [addId,   setAddId]   = useState('');
  const [addRole, setAddRole] = useState(ROLES.REVIEWER);

  const base = `projects/${encodeURIComponent(pid)}`;

  const reload = useCallback(async () => {
    try {
      const [m, b] = await Promise.all([api(`${base}/members`), api(`${base}/snapshots`)]);
      setMembers(m); setBackups(b);
    } catch (e) { onError(e.message); }
  }, [base, onError]);

  useEffect(() => { if (open && pid) reload(); }, [open, pid, reload]);

  async function call(path, opts) {
    try { await api(path, opts); } catch (e) { onError(e.message); }
    reload();
  }

  async function download(b) {
    try {
      const data = await api(`${base}/snapshots/${b.id}`);
      exportProject(pid, data.project, `backup-${b.id}`);
    } catch (e) { onError(e.message); }
  }

  async function restore(b) {
    if (!window.confirm(`Restore backup #${b.id} from ${fmt(b.createdAt)}? The current state is backed up first.`)) return;
    if (await onRestore(b.id)) reload();
  }

  const memberIds = new Set(members.map(m => m.userId));
  const candidates = users.filter(u => !memberIds.has(u.userId));

  return (
    <Modal open={open} onClose={onClose} title={`Project ${pid}`} width={560}>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'members' ? styles.tabActive : ''}`} onClick={() => setTab('members')}>
          Members ({members.length})
        </button>
        <button className={`${styles.tab} ${tab === 'backups' ? styles.tabActive : ''}`} onClick={() => setTab('backups')}>
          Backups ({backups.length})
        </button>
      </div>

      {tab === 'members' && (
        <>
          <div className={styles.list}>
            {members.map(m => (
              <div key={m.userId} className={styles.row}>
                <div className={styles.main}>
                  <div className={styles.name}>{m.displayName}{m.userId === userId && ' (you)'}</div>
                  <code className={styles.meta}>{m.username}</code>
                </div>
                {isManager ? (
                  <>
                    <Select value={m.role} style={{ width: 190 }}
                      onChange={e => call(`${base}/members/${m.userId}`, { method: 'PUT', body: { role: e.target.value } })}>
                      <option value={ROLES.MANAGER}>{ROLE_LABELS.manager}</option>
                      <option value={ROLES.REVIEWER}>{ROLE_LABELS.reviewer}</option>
                    </Select>
                    <Btn size="xs" variant="danger" title="Remove from project" onClick={() => {
                      if (window.confirm(`Remove ${m.displayName} from this project?`)) call(`${base}/members/${m.userId}`, { method: 'DELETE' });
                    }}>×</Btn>
                  </>
                ) : (
                  <span className={`${styles.role} ${styles['role-' + m.role]}`}>{ROLE_LABELS[m.role]}</span>
                )}
              </div>
            ))}
          </div>

          {isManager && candidates.length > 0 && (
            <div className={styles.addRow}>
              <Select value={addId} onChange={e => setAddId(e.target.value)}>
                <option value="">— add a user —</option>
                {candidates.map(u => <option key={u.userId} value={u.userId}>{u.displayName} ({u.username})</option>)}
              </Select>
              <Select value={addRole} onChange={e => setAddRole(e.target.value)} style={{ width: 190 }}>
                <option value={ROLES.REVIEWER}>{ROLE_LABELS.reviewer}</option>
                <option value={ROLES.MANAGER}>{ROLE_LABELS.manager}</option>
              </Select>
              <Btn variant="primary" disabled={!addId} onClick={() => {
                call(`${base}/members/${addId}`, { method: 'PUT', body: { role: addRole } }); setAddId('');
              }}>Add</Btn>
            </div>
          )}
        </>
      )}

      {tab === 'backups' && (
        <div className={styles.list}>
          {backups.length === 0 && (
            <div className={styles.empty}>No backups yet. One is saved automatically before every import or restore.</div>
          )}
          {backups.map(b => (
            <div key={b.id} className={styles.row}>
              <div className={styles.main}>
                <div className={styles.name}>#{b.id} · {b.reason}</div>
                <div className={styles.meta}>{fmt(b.createdAt)} · by {b.createdBy}</div>
              </div>
              <Btn size="xs" onClick={() => download(b)}>Download</Btn>
              {isManager && <Btn size="xs" onClick={() => restore(b)}>Restore</Btn>}
            </div>
          ))}
        </div>
      )}

      <ModalFooter>
        <Btn onClick={onClose}>Close</Btn>
      </ModalFooter>
    </Modal>
  );
}

function fmt(iso) {
  return new Date(iso).toLocaleString();
}
