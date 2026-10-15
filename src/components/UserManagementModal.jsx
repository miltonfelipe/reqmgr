// ── components/UserManagementModal.js ────────────────
// Administrators create accounts here. What each user may do in a
// project is set per project, under Members & backups.
import { useState } from 'react';
import { Modal, ModalFooter, Btn, Field, Input, Select, FormGrid } from './UI';
import styles from './UserManagementModal.module.css';

const EMPTY_FORM = { username: '', displayName: '', isAdmin: 'no', password: '', confirm: '' };

export function UserManagementModal({ open, onClose, users, onAdd, onDelete, onChangePassword, session }) {
  const [tab, setTab]         = useState('list');
  const [form, setForm]       = useState(EMPTY_FORM);
  const [cpwdTarget, setCpwdTarget] = useState(null);
  const [newPwd, setNewPwd]   = useState('');
  const [err, setErr]         = useState('');

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  async function handleAdd() {
    setErr('');
    if (!form.username.trim())     { setErr('Username required'); return; }
    if (!form.displayName.trim())  { setErr('Display name required'); return; }
    if (form.password.length < 6)  { setErr('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirm) { setErr('Passwords do not match'); return; }
    const res = await onAdd(form.username.trim(), form.displayName.trim(), form.isAdmin === 'yes', form.password);
    if (!res.ok) { setErr(res.error); return; }
    setForm(EMPTY_FORM);
    setTab('list');
  }

  async function handleChangePwd() {
    setErr('');
    if (newPwd.length < 6) { setErr('Password must be at least 6 characters'); return; }
    const res = await onChangePassword(cpwdTarget, newPwd);
    if (!res.ok) { setErr(res.error); return; }
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
          {users.map(u => (
            <div key={u.userId} className={styles.userRow}>
              <div className={styles.userAvatar}>
                {(u.displayName || u.username).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{u.displayName}</div>
                <div className={styles.userMeta}>
                  <code className={styles.userUn}>{u.username}</code>
                  {u.isAdmin && <span className={`${styles.userRole} ${styles['role-manager']}`}>ADMINISTRATOR</span>}
                </div>
              </div>
              <div className={styles.userActions}>
                <Btn size="xs" onClick={() => { setCpwdTarget(u.userId); setNewPwd(''); setErr(''); }}>
                  Change pwd
                </Btn>
                {u.userId !== session?.userId && (
                  <Btn size="xs" variant="danger" onClick={async () => {
                    if (window.confirm(`Delete user "${u.username}"?`)) { const r = await onDelete(u.userId); if (!r.ok) setErr(r.error); }
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
            <Field label="Account type">
              <Select value={form.isAdmin} onChange={set('isAdmin')}>
                <option value="no">User — sees the projects they are added to</option>
                <option value="yes">Administrator — manages users and all projects</option>
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
            Change password for <strong>{users.find(u=>u.userId===cpwdTarget)?.username}</strong>
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
