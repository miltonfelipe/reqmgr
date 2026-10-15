// ── hooks/useStore.js ─────────────────────────────────
import { useState, useCallback } from 'react';
import { loadDb, saveDb, nowIso, makeEmptyProject, makeSnapshot, makeComment } from '../store/db';

export function useStore() {
  const [db, setDb] = useState(() => loadDb());
  const [currentPid, setCurrentPid] = useState(() => {
    const keys = Object.keys(loadDb().projects);
    return keys.length > 0 ? keys[keys.length - 1] : null;
  });

  const persist = useCallback((nextDb) => { setDb(nextDb); saveDb(nextDb); }, []);
  const currentProject = currentPid ? db.projects[currentPid] : null;

  // ── Project CRUD ───────────────────────────────────
  const upsertProject = useCallback((id, fields, editingId = null) => {
    const next = { ...db };
    const existing = editingId ? next.projects[editingId] : null;
    const base = existing ?? makeEmptyProject(id, fields.name);
    const proj = { ...base, ...fields, updatedAt: nowIso(), createdAt: existing ? existing.createdAt : nowIso() };
    if (!proj.sections) proj.sections = [];
    if (editingId && editingId !== id) delete next.projects[editingId];
    next.projects[id] = proj;
    persist(next); setCurrentPid(id); return id;
  }, [db, persist]);

  const deleteProject = useCallback((id) => {
    const next = { ...db, projects: { ...db.projects } };
    delete next.projects[id]; persist(next);
    const remaining = Object.keys(next.projects);
    setCurrentPid(remaining.length > 0 ? remaining[remaining.length - 1] : null);
  }, [db, persist]);

  const switchProject = useCallback((id) => { setCurrentPid(id || null); }, []);

  // ── Section CRUD ───────────────────────────────────
  const upsertSection = useCallback((section, editingId = null) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    const sections = [...(proj.sections ?? [])];
    if (editingId) {
      const idx = sections.findIndex(s => s.id === editingId);
      if (idx >= 0) sections[idx] = section; else sections.push(section);
    } else {
      sections.push(section);
    }
    proj.sections = sections; proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  const deleteSection = useCallback((sectionId) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    proj.sections = (proj.sections ?? []).filter(s => s.id !== sectionId);
    // Unlink reqs from deleted section
    const CATS = ['system','hardware','software','mechanical'];
    const reqs = { ...proj.requirements };
    CATS.forEach(c => {
      reqs[c] = (reqs[c] ?? []).map(r => r.sectionId === sectionId ? { ...r, sectionId: '' } : r);
    });
    proj.requirements = reqs; proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  const reorderSections = useCallback((orderedIds) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    const map = Object.fromEntries((proj.sections ?? []).map(s => [s.id, s]));
    proj.sections = orderedIds.map((id, i) => ({ ...map[id], order: i }));
    proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  // ── Requirement CRUD (with version history) ────────
  const upsertReq = useCallback((cat, reqData, editingId = null, editorName = 'unknown') => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    const reqs = [...(proj.requirements[cat] ?? [])];
    if (editingId) {
      const idx = reqs.findIndex(r => r.id === editingId);
      if (idx >= 0) {
        const old = reqs[idx];
        const snapshot = makeSnapshot(old, editorName);
        reqs[idx] = {
          ...old, ...reqData, updatedAt: nowIso(),
          version: (old.version ?? 1) + 1,
          history: [...(old.history ?? []), snapshot],
          comments: old.comments ?? [],
          traces: reqData.traces ?? old.traces ?? [],
        };
      } else {
        reqs.push({ ...reqData, createdAt: nowIso(), updatedAt: nowIso(), version: 1, history: [], comments: [], traces: reqData.traces ?? [] });
      }
    } else {
      reqs.push({ ...reqData, createdAt: nowIso(), updatedAt: nowIso(), version: 1, history: [], comments: [], traces: reqData.traces ?? [] });
    }
    proj.requirements = { ...proj.requirements, [cat]: reqs };
    proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  const deleteReq = useCallback((cat, reqId) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    // Also remove traces pointing to this req
    const CATS = ['system','hardware','software','mechanical'];
    const reqs = { ...proj.requirements };
    CATS.forEach(c => {
      reqs[c] = (reqs[c] ?? [])
        .filter(r => r.id !== reqId || c !== cat)
        .map(r => ({ ...r, traces: (r.traces ?? []).filter(t => t.toId !== reqId) }));
    });
    proj.requirements = reqs; proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  // ── Trace mutations ────────────────────────────────
  const addTrace = useCallback((cat, reqId, toId, type) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    const reqs = [...(proj.requirements[cat] ?? [])];
    const idx  = reqs.findIndex(r => r.id === reqId);
    if (idx < 0) return;
    const existing = (reqs[idx].traces ?? []).find(t => t.toId === toId);
    if (existing) return;
    reqs[idx] = { ...reqs[idx], traces: [...(reqs[idx].traces ?? []), { toId, type }], updatedAt: nowIso() };
    proj.requirements = { ...proj.requirements, [cat]: reqs };
    proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  const removeTrace = useCallback((cat, reqId, toId) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    const reqs = [...(proj.requirements[cat] ?? [])];
    const idx  = reqs.findIndex(r => r.id === reqId);
    if (idx < 0) return;
    reqs[idx] = { ...reqs[idx], traces: (reqs[idx].traces ?? []).filter(t => t.toId !== toId), updatedAt: nowIso() };
    proj.requirements = { ...proj.requirements, [cat]: reqs };
    proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  // ── Comments ───────────────────────────────────────
  const addComment = useCallback((cat, reqId, text, session) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    const reqs = [...(proj.requirements[cat] ?? [])];
    const idx  = reqs.findIndex(r => r.id === reqId);
    if (idx < 0) return;
    const req     = reqs[idx];
    const comment = makeComment(text, session.userId, session.displayName, session.role, req.version ?? 1);
    reqs[idx] = { ...req, comments: [...(req.comments ?? []), comment] };
    proj.requirements = { ...proj.requirements, [cat]: reqs };
    proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  const editComment = useCallback((cat, reqId, commentId, newText) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    const reqs = [...(proj.requirements[cat] ?? [])];
    const idx  = reqs.findIndex(r => r.id === reqId);
    if (idx < 0) return;
    reqs[idx] = { ...reqs[idx], comments: (reqs[idx].comments ?? []).map(c =>
      c.commentId === commentId ? { ...c, text: newText, editedAt: nowIso() } : c
    )};
    proj.requirements = { ...proj.requirements, [cat]: reqs };
    proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  const resolveComment = useCallback((cat, reqId, commentId, resolverName) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    const reqs = [...(proj.requirements[cat] ?? [])];
    const idx  = reqs.findIndex(r => r.id === reqId);
    if (idx < 0) return;
    reqs[idx] = { ...reqs[idx], comments: (reqs[idx].comments ?? []).map(c =>
      c.commentId === commentId
        ? { ...c, resolved: !c.resolved, resolvedBy: resolverName, resolvedAt: nowIso() }
        : c
    )};
    proj.requirements = { ...proj.requirements, [cat]: reqs };
    proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  const deleteComment = useCallback((cat, reqId, commentId) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    const reqs = [...(proj.requirements[cat] ?? [])];
    const idx  = reqs.findIndex(r => r.id === reqId);
    if (idx < 0) return;
    reqs[idx] = { ...reqs[idx], comments: (reqs[idx].comments ?? []).filter(c => c.commentId !== commentId) };
    proj.requirements = { ...proj.requirements, [cat]: reqs };
    proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  // ── Diagram ────────────────────────────────────────
  const saveDiagramState = useCallback((blocks, conns, blockIdC, connIdC) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    proj.diagramBlocks = blocks; proj.diagramConns = conns;
    proj.blockIdC = blockIdC; proj.connIdC = connIdC;
    proj.updatedAt = nowIso();
    next.projects[currentPid] = proj; persist(next);
  }, [db, currentPid, persist]);

  // ── Import ─────────────────────────────────────────
  const importProject = useCallback((importedPid, importedProj) => {
    const next = { ...db };
    const CATS = ['system','hardware','software','mechanical'];
    if (!importedProj.requirements) importedProj.requirements = {};
    CATS.forEach(c => {
      if (!importedProj.requirements[c]) importedProj.requirements[c] = [];
      importedProj.requirements[c] = importedProj.requirements[c].map(r => ({
        ...r,
        version:   r.version   ?? 1,
        history:   r.history   ?? [],
        comments:  r.comments  ?? [],
        sectionId: r.sectionId ?? '',
        traces:    r.traces    ?? [],
      }));
    });
    if (!importedProj.diagramBlocks) importedProj.diagramBlocks = {};
    if (!importedProj.diagramConns)  importedProj.diagramConns  = [];
    if (!importedProj.blockIdC)      importedProj.blockIdC      = 0;
    if (!importedProj.connIdC)       importedProj.connIdC       = 0;
    if (!importedProj.sections)      importedProj.sections      = [];
    next.projects[importedPid] = importedProj;
    persist(next); setCurrentPid(importedPid);
  }, [db, persist]);

  // ── CSV import ────────────────────────────────────
  const importCsvRequirements = useCallback((parsedRequirements) => {
    const next = { ...db };
    const proj = { ...next.projects[currentPid] };
    const CATS = ['system','hardware','software','mechanical'];
    // Merge: keep existing reqs not in CSV, overwrite/add those in CSV
    const merged = {};
    CATS.forEach(c => {
      const incoming = parsedRequirements[c] ?? [];
      const incomingIds = new Set(incoming.map(r => r.id));
      // Preserve existing reqs that are NOT being overwritten (keep history+comments)
      const kept = (proj.requirements[c] ?? []).filter(r => !incomingIds.has(r.id));
      // For overwritten ones, preserve history and comments from existing
      const merged_c = [
        ...kept,
        ...incoming.map(r => {
          const existing = (proj.requirements[c] ?? []).find(e => e.id === r.id);
          return {
            ...r,
            history:  existing?.history  ?? [],
            comments: existing?.comments ?? [],
          };
        }),
      ];
      merged[c] = merged_c;
    });
    proj.requirements = merged;
    proj.updatedAt = nowIso();
    next.projects[currentPid] = proj;
    persist(next);
  }, [db, currentPid, persist]);

  return {
    db, currentPid, currentProject,
    upsertProject, deleteProject, switchProject,
    upsertSection, deleteSection, reorderSections,
    upsertReq, deleteReq,
    addTrace, removeTrace,
    addComment, editComment, resolveComment, deleteComment,
    saveDiagramState, importProject,
    importCsvRequirements,
  };
}