// ── components/UserMenu.js ───────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import { ROLE_LABELS } from '../store/auth';
import styles from './UserMenu.module.css';

export function UserMenu({ session, onLogout, onManageUsers }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = (session.displayName || session.username)
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={styles.wrap} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(o => !o)}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.info}>
          <div className={styles.name}>{session.displayName || session.username}</div>
          <div className={`${styles.role} ${styles['role-' + session.role]}`}>
            {ROLE_LABELS[session.role] ?? session.role}
          </div>
        </div>
        <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="6">
          <path d="M1 1l4 4 4-4"/>
        </svg>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropHeader}>
            <div className={styles.dropName}>{session.displayName || session.username}</div>
            <div className={`${styles.dropRole} ${styles['role-' + session.role]}`}>
              {ROLE_LABELS[session.role] ?? session.role}
            </div>
          </div>
          <div className={styles.dropDivider} />
          {session.role === 'manager' && (
            <button className={styles.dropItem} onClick={() => { setOpen(false); onManageUsers(); }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
                <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
              </svg>
              Manage users
            </button>
          )}
          <button className={styles.dropItem} onClick={() => { setOpen(false); onLogout(); }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
