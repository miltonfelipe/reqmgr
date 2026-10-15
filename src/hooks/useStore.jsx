// ── hooks/useStore.js ─────────────────────────────────
// Project state backed by the REQMGR server. Every change is sent as an
// operation; the server applies it, checks the user's role, and returns
// the updated project. The open project is polled for others' changes.
import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../api';

const POLL_MS  = 5000;
const LAST_KEY = 'reqmgr_last_project';

function rememberPid(pid) {
  try { pid ? localStorage.setItem(LAST_KEY, pid) : localStorage.removeItem(LAST_KEY); } catch { /* optional */ }
}
function recallPid() {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

// Mutations resolve to true on success, false after reporting the error via onError.
export function useStore({ enabled, onError }) {
  const [projects,   setProjects]   = useState([]);   // [{ id, name, role, revision }]
  const [currentPid, setCurrentPid] = useState(null);
  const [current,    setCurrent]    = useState(null); // { project, revision, role }
  const revisionRef = useRef(null);
  const pidRef      = useRef(null);
  const onErrorRef  = useRef(onError);
  onErrorRef.current = onError;

  const report = useCallback(e => { onErrorRef.current?.(e.message); return false; }, []);

  const applyProject = useCallback((pid, data) => {
    if (pid !== pidRef.current) return;                     // user switched project meanwhile
    if (data.revision < (revisionRef.current ?? 0)) return; // stale poll response
    revisionRef.current = data.revision;
    setCurrent(prev => ({ role: prev?.role, ...data }));
    setProjects(ps => ps.map(p => p.id === pid ? { ...p, name: data.project.name } : p));
  }, []);

  // ── Loading ────────────────────────────────────────
  const openProject = useCallback(async (pid) => {
    pidRef.current = pid; setCurrentPid(pid); rememberPid(pid);
    revisionRef.current = null; setCurrent(null);
    if (!pid) return;
    try {
      const data = await api(`projects/${encodeURIComponent(pid)}`);
      if (pid !== pidRef.current) return;
      revisionRef.current = data.revision;
      setCurrent(data);
    } catch (e) { report(e); }
  }, [report]);

  const refreshProjects = useCallback(async (preferPid) => {
    try {
      const list = await api('projects');
      setProjects(list);
      const ids = list.map(p => p.id);
      const pid = [preferPid, recallPid()].find(id => id && ids.includes(id)) ?? ids[ids.length - 1] ?? null;
      await openProject(pid);
    } catch (e) { report(e); }
  }, [openProject, report]);

  useEffect(() => {
    if (enabled) refreshProjects();
    else { setProjects([]); pidRef.current = null; setCurrentPid(null); setCurrent(null); }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps -- reload only on login/logout

  // ── Polling for other users' changes ───────────────
  useEffect(() => {
    if (!enabled || !currentPid) return;
    async function poll() {
      if (document.hidden || revisionRef.current == null) return;
      try {
        const data = await api(`projects/${encodeURIComponent(currentPid)}?since=${revisionRef.current}`);
        if (data) applyProject(currentPid, data);
      } catch (e) {
        if (e.status === 404) { report(new Error('This project is no longer available to you')); refreshProjects(); }
      }
    }
    const timer = setInterval(poll, POLL_MS);
    window.addEventListener('focus', poll);
    return () => { clearInterval(timer); window.removeEventListener('focus', poll); };
  }, [enabled, currentPid, applyProject, refreshProjects, report]);

  // ── Operations on the open project ─────────────────
  const op = useCallback(async (name, args) => {
    try {
      const data = await api(`projects/${encodeURIComponent(currentPid)}/ops`, { method: 'POST', body: { op: name, args } });
      applyProject(currentPid, data);
      return true;
    } catch (e) { return report(e); }
  }, [currentPid, applyProject, report]);

  // ── Project CRUD ───────────────────────────────────
  const upsertProject = useCallback(async (id, fields, editingId = null) => {
    try {
      if (editingId) await api(`projects/${encodeURIComponent(editingId)}`, { method: 'PUT', body: { id, fields } });
      else           await api('projects', { method: 'POST', body: { id, fields } });
      await refreshProjects(id);
      return true;
    } catch (e) { return report(e); }
  }, [refreshProjects, report]);

  const deleteProject = useCallback(async (id) => {
    try {
      await api(`projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
      rememberPid(null);
      await refreshProjects();
      return true;
    } catch (e) { return report(e); }
  }, [refreshProjects, report]);

  const switchProject = useCallback(id => openProject(id || null), [openProject]);

  // Replaces the project (server backs it up first) or creates it
  const importProject = useCallback(async (pid, project) => {
    try {
      const res = await api('import', { method: 'POST', body: { projectId: pid, project } });
      await refreshProjects(pid);
      return res;
    } catch (e) { return report(e); }
  }, [refreshProjects, report]);

  const restoreBackup = useCallback(async (snapshotId) => {
    try {
      await api(`projects/${encodeURIComponent(currentPid)}/snapshots/${snapshotId}/restore`, { method: 'POST' });
      await openProject(currentPid);
      return true;
    } catch (e) { return report(e); }
  }, [currentPid, openProject, report]);

  return {
    db: { projects: Object.fromEntries(projects.map(p => [p.id, p])) },
    currentPid,
    currentProject: current?.project ?? null,
    role:           current?.role ?? null,
    refreshProjects,
    upsertProject, deleteProject, switchProject, importProject, restoreBackup,
    upsertSection:   (section, editingId = null)  => op('upsertSection',   { section, editingId }),
    deleteSection:   (sectionId)                   => op('deleteSection',   { sectionId }),
    reorderSections: (orderedIds)                  => op('reorderSections', { orderedIds }),
    upsertReq:       (category, req, editingId = null) => op('upsertReq',   { category, req, editingId }),
    deleteReq:       (category, reqId)             => op('deleteReq',       { category, reqId }),
    addTrace:        (category, reqId, toId, type) => op('addTrace',        { category, reqId, toId, type }),
    removeTrace:     (category, reqId, toId)       => op('removeTrace',     { category, reqId, toId }),
    addComment:      (category, reqId, text)       => op('addComment',      { category, reqId, text }),
    editComment:     (category, reqId, commentId, text) => op('editComment', { category, reqId, commentId, text }),
    resolveComment:  (category, reqId, commentId)  => op('resolveComment',  { category, reqId, commentId }),
    deleteComment:   (category, reqId, commentId)  => op('deleteComment',   { category, reqId, commentId }),
    saveDiagramState: (blocks, conns, blockIdC, connIdC) => op('saveDiagram', { blocks, conns, blockIdC, connIdC }),
    importCsvRequirements: (requirements)          => op('importCsv',       { requirements }),
  };
}
