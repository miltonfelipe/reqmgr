// ── hooks/useAuth.js ─────────────────────────────────
import { useState, useCallback } from 'react';
import {
  loadAuthDb, saveAuthDb, loadSession, saveSession, clearSession,
  authenticate, hashPw, ROLES,
} from '../store/auth';
import { nowIso } from '../store/db';

export function useAuth() {
  const [authDb,  setAuthDb]  = useState(() => loadAuthDb());
  const [session, setSession] = useState(() => loadSession());

  // ── Login ─────────────────────────────────────────
  const login = useCallback((username, password) => {
    const user = authenticate(authDb, username, password);
    if (!user) return { ok: false, error: 'Invalid username or password' };
    const sess = {
      userId:      user.id,
      username:    user.username,
      displayName: user.displayName,
      role:        user.role,
      loginAt:     nowIso(),
    };
    saveSession(sess);
    setSession(sess);
    return { ok: true };
  }, [authDb]);

  // ── Logout ────────────────────────────────────────
  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  // ── User management (manager only) ────────────────
  const addUser = useCallback((username, displayName, role, password) => {
    if (authDb.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, error: 'Username already exists' };
    }
    const newUser = {
      id:           'usr-' + Date.now(),
      username,
      displayName,
      role,
      passwordHash: hashPw(password),
      createdAt:    nowIso(),
    };
    const next = { ...authDb, users: [...authDb.users, newUser] };
    saveAuthDb(next);
    setAuthDb(next);
    return { ok: true };
  }, [authDb]);

  const deleteUser = useCallback((userId) => {
    if (userId === session?.userId) return { ok: false, error: 'Cannot delete yourself' };
    const next = { ...authDb, users: authDb.users.filter(u => u.id !== userId) };
    saveAuthDb(next);
    setAuthDb(next);
    return { ok: true };
  }, [authDb, session]);

  const changePassword = useCallback((userId, newPassword) => {
    const next = {
      ...authDb,
      users: authDb.users.map(u =>
        u.id === userId ? { ...u, passwordHash: hashPw(newPassword) } : u
      ),
    };
    saveAuthDb(next);
    setAuthDb(next);
    return { ok: true };
  }, [authDb]);

  return {
    session,
    authDb,
    isLoggedIn: !!session,
    isManager:  session?.role === ROLES.MANAGER,
    isReviewer: session?.role === 'reviewer',
    login,
    logout,
    addUser,
    deleteUser,
    changePassword,
  };
}
