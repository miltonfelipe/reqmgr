// ── hooks/useAuth.js ─────────────────────────────────
import { useState, useCallback, useEffect } from 'react';
import { api } from '../api';

export function useAuth() {
  const [user,     setUser]     = useState(null);
  const [checking, setChecking] = useState(true);
  const [users,    setUsers]    = useState([]);

  // Resume an existing server session, and drop it when the server says it expired
  useEffect(() => {
    api('me').then(setUser, () => setUser(null)).finally(() => setChecking(false));
    const onUnauthorized = () => setUser(null);
    window.addEventListener('reqmgr:unauthorized', onUnauthorized);
    return () => window.removeEventListener('reqmgr:unauthorized', onUnauthorized);
  }, []);

  // ── Login / logout ────────────────────────────────
  const login = useCallback(async (username, password) => {
    try {
      setUser(await api('login', { method: 'POST', body: { username, password } }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api('logout', { method: 'POST' }); } catch { /* already logged out */ }
    setUser(null);
  }, []);

  // ── Users (list for everyone; changes are admin only) ──
  const loadUsers = useCallback(async () => {
    try { setUsers(await api('users')); } catch { /* shown as an empty list */ }
  }, []);

  const withReload = useCallback(fn => async (...args) => {
    try { await fn(...args); await loadUsers(); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  }, [loadUsers]);

  const addUser = withReload((username, displayName, isAdmin, password) =>
    api('users', { method: 'POST', body: { username, displayName, isAdmin, password } }));
  const deleteUser = withReload(userId => api(`users/${userId}`, { method: 'DELETE' }));
  const changePassword = withReload((userId, password) =>
    api(`users/${userId}/password`, { method: 'PUT', body: { password } }));

  return {
    user, checking, users,
    isLoggedIn: !!user,
    isAdmin:    !!user?.isAdmin,
    login, logout,
    loadUsers, addUser, deleteUser, changePassword,
  };
}
