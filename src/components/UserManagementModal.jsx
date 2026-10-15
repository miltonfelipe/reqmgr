// ── components/UserManagementModal.js ────────────────
import React, { useState } from 'react';
import { ROLE_LABELS, ROLES } from '../store/auth';
import { Modal, ModalFooter, Btn, Field, Input, Select, FormGrid } from './UI';
import styles from './UserManagementModal.module.css';

export function UserManagementModal({ open, onClose, authDb, onAdd, onDelete, onChangePassword, session }) {
  const [tab, setTab]         = useState('list');
  const [form, setForm]       = useState({ username: '', displayName: '', role: ROLES.REVIEWER, password: '', confirm: '' });
  const [cpwdTarget, setCpwdTarget] = useState(null);
  const [newPwd, setNewPwd]   = useState('');
  const [err, setErr]         = useState('');

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  function handleAdd() {
    setErr('');
    if (!form.username.trim())     { setErr('Username required'); return; }
    if (!form.displayName.trim())  { setErr('Display name required'); return; }
    if (form.password.length < 6)  { setErr('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirm) { setErr('Passwords do not match'); return; }
    const res = onAdd(form.username.trim(), form.displayName.trim(), form.role, form.password);
    if (!res.ok) { setErr(res.error); return; }
    setForm({ username: '', displayName: '', role: ROLES.REVIEWER, password: '', confirm: '' });
    setTab('list');
  }

  function handleChangePwd() {
    setErr('');
    if (newPwd.length < 6) { setErr('Password must be at least 6 characters'); return; }
    onChangePassword(cpwdTarget, newPwd);
    setCpwdTarget(null); setNewPwd('');
  }

  return (
    <Modal open={open} onClose={onClose} title="User Management" width={520}>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'list' ? styles.tabActive : ''}`} onClick={() => setTab('list')}>Users</button>
        <button className={`${styles.tab} ${tab === 'add'  ? styles.tabActive : ''}`} onClick={() => { setTab('add'); setErr(''); }}>Add user</button>
      </div>

      {tab === 'list' && (
        <div className={styles.userList}>
          {authDb.users.map(u => (
            <div key={u.id} className={styles.userRow}>
              <div className={styles.userAvatar}>
                {(u.displayName || u.username).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{u.displayName}</div>
                <div className={styles.userMeta}>
                  <code className={styles.userUn}>{u.username}</code>
                  <span className={`${styles.userRole} ${styles['role-'+u.role]}`}>{ROLE_LABELS[u.role]}</span>
                </div>
              </div>
              <div className={styles.userActions}>
                <Btn size="xs" onClick={() => { setCpwdTarget(u.id); setNewPwd(''); setErr(''); }}>
                  Change pwd
                </Btn>
                {u.id !== session?.userId && (
                  <Btn size="xs" variant="danger" onClick={() => {
                    if (window.confirm(`Delete user "${u.username}"?`)) { const r = onDelete(u.id); if (!r.ok) setErr(r.error); }
                  }}>×</Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'add' && (
        <div style={{ marginTop: 4 }}>
          <FormGrid cols={2}>
            <Field label="Username *"><Input value={form.username} onChange={set('username')} placeholder="login_name" autoFocus /></Field>
            <Field label="Display name *"><Input value={form.displayName} onChange={set('displayName')} placeholder="Full Name" /></Field>
          </FormGrid>
          <div style={{ marginTop: 14 }}>
            <Field label="Role">
              <Select value={form.role} onChange={set('role')}>
                <option value={ROLES.MANAGER}>Requirements Manager</option>
                <option value={ROLES.REVIEWER}>Reviewer</option>
              </Select>
            </Field>
          </div>
          <FormGrid cols={2} style={{ marginTop: 14 }}>
            <Field label="Password *"><Input type="password" value={form.password} onChange={set('password')} placeholder="min. 6 chars" /></Field>
            <Field label="Confirm *"><Input type="password" value={form.confirm} onChange={set('confirm')} placeholder="repeat password" /></Field>
          </FormGrid>
          {err && <div className={styles.err}>{err}</div>}
          <ModalFooter>
            <Btn onClick={() => setTab('list')}>Cancel</Btn>
            <Btn variant="primary" onClick={handleAdd}>Create user</Btn>
          </ModalFooter>
        </div>
      )}

      {/* Change password inline dialog */}
      {cpwdTarget && (
        <div className={styles.cpwdWrap}>
          <div className={styles.cpwdTitle}>
            Change password for <strong>{authDb.users.find(u=>u.id===cpwdTarget)?.username}</strong>
          </div>
          <Input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="New password (min. 6 chars)" autoFocus />
          {err && <div className={styles.err} style={{marginTop:8}}>{err}</div>}
          <div style={{ display:'flex', gap:6, marginTop:10 }}>
            <Btn size="sm" onClick={() => { setCpwdTarget(null); setErr(''); }}>Cancel</Btn>
            <Btn size="sm" variant="primary" onClick={handleChangePwd}>Save</Btn>
          </div>
        </div>
      )}

      {tab === 'list' && !cpwdTarget && (
        <ModalFooter>
          <Btn onClick={onClose}>Close</Btn>
        </ModalFooter>
      )}
    </Modal>
  );
}
