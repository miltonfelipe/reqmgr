// ── components/LoginScreen.js ────────────────────────
import { useState } from 'react';
import styles from './LoginScreen.module.css';

export function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Please enter username and password.'); return; }
    setLoading(true); setError('');
    // Small artificial delay for UX feel
    setTimeout(() => {
      const result = onLogin(username.trim(), password);
      if (!result.ok) { setError(result.error); setLoading(false); }
    }, 320);
  }

  return (
    <div className={styles.root}>
      {/* Background grid */}
      <div className={styles.grid} aria-hidden />

      <div className={styles.card}>
        <div className={styles.logoRow}>
          <div className={styles.logoBox}>R</div>
          <div>
            <div className={styles.logoLabel}>REQMGR</div>
            <div className={styles.logoSub}>Industrial Requirements Manager</div>
          </div>
        </div>

        <div className={styles.divider} />

        <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
          <div className={styles.field}>
            <label className={styles.label}>Username</label>
            <input
              className={styles.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? <span className={styles.spinner} /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={styles.hint}>
          <div className={styles.hintTitle}>Default accounts</div>
          <div className={styles.hintRow}>
            <span className={styles.hintRole}>Requirements Manager</span>
            <code className={styles.hintCred}>manager / manager123</code>
          </div>
          <div className={styles.hintRow}>
            <span className={styles.hintRole}>Reviewer</span>
            <code className={styles.hintCred}>reviewer / reviewer123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
