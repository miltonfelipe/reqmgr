// ── App.jsx ──────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import { useStore }           from './hooks/useStore';
import { useAuth }            from './hooks/useAuth';
import { useToast }           from './hooks/useToast';
import { exportProject, parseImportFile } from './utils/exportImport';
import { exportToCsv, importFromCsv }     from './utils/csvUtils';
import { CATEGORIES }         from './store/db';

import { TopBar }                from './components/TopBar';
import { Sidebar }               from './components/Sidebar';
import { Overview }              from './components/Overview';
import { AllRequirementsPanel }  from './components/AllRequirementsPanel';
import { RequirementsPanel }     from './components/RequirementsPanel';
import { TraceabilityMatrix }    from './components/TraceabilityMatrix';
import { BlockDiagram }          from './components/BlockDiagram';
import { NoProject }             from './components/NoProject';
import { ProjectModal }          from './components/ProjectModal';
import { RequirementModal }      from './components/RequirementModal';
import { LoginScreen }           from './components/LoginScreen';
import { UserManagementModal }   from './components/UserManagementModal';
import { CsvImportResultModal }  from './components/CsvImportResultModal';
import { Toast }                 from './components/UI';

import styles from './App.module.css';

const PROJ_CLOSED = { open: false, editing: null, editingId: null };
const REQ_CLOSED  = { open: false, category: null, editing: null, editingId: null };

export default function App() {
  const auth  = useAuth();
  const store = useStore();
  const { toast, showToast } = useToast();

  const [panel,       setPanel]       = useState('overview');
  const [projModal,   setProjModal]   = useState(PROJ_CLOSED);
  const [reqModal,    setReqModal]    = useState(REQ_CLOSED);
  const [usersMgmt,   setUsersMgmt]   = useState(false);
  const [csvResult,   setCsvResult]   = useState(null);  // { counts, warnings, projectName }

  const { db, currentPid, currentProject } = store;
  const { session, isManager } = auth;

  // ── Auth gate ─────────────────────────────────────
  if (!auth.isLoggedIn) return <LoginScreen onLogin={auth.login} />;

  // ── Project ────────────────────────────────────────
  function openNewProject()  { setProjModal({ open: true, editing: null, editingId: null }); }
  function openEditProject() {
    if (!currentProject) return;
    setProjModal({ open: true, editing: currentProject, editingId: currentPid });
  }
  function handleSaveProject({ id, fields }) {
    if (!projModal.editingId && Object.keys(db.projects).includes(id)) {
      showToast('Project ID already exists', 'err'); return;
    }
    store.upsertProject(id, fields, projModal.editingId);
    setProjModal(PROJ_CLOSED); setPanel('overview'); showToast('Project saved', 'ok');
  }
  function handleDeleteProject() {
    if (!currentProject) return;
    if (!window.confirm(`Delete "${currentProject.name}"? This cannot be undone.`)) return;
    store.deleteProject(currentPid); setPanel('overview'); showToast('Project deleted', 'ok');
  }

  // ── Requirements ───────────────────────────────────
  function openAddReq(cat)      { setReqModal({ open: true, category: cat, editing: null, editingId: null }); }
  function openEditReq(cat, id) {
    const req = (currentProject?.requirements[cat] ?? []).find(r => r.id === id);
    if (!req) return;
    setReqModal({ open: true, category: cat, editing: req, editingId: id });
  }
  function handleSaveReq(data) {
    store.upsertReq(reqModal.category, data, reqModal.editingId, session.displayName);
    setReqModal(REQ_CLOSED); showToast('Requirement saved', 'ok');
  }
  function handleDeleteReq(cat, id) {
    if (!window.confirm('Delete this requirement?')) return;
    store.deleteReq(cat, id); showToast('Requirement deleted', 'ok');
  }

  // ── Sections ───────────────────────────────────────
  const handleUpsertSection   = useCallback((sec, editId) => store.upsertSection(sec, editId),    [store]);
  const handleDeleteSection   = useCallback((id)          => store.deleteSection(id),              [store]);
  const handleReorderSections = useCallback((ids)         => store.reorderSections(ids),           [store]);

  // ── Traces ────────────────────────────────────────
  const handleAddTrace    = useCallback((cat, rid, toId, type) => store.addTrace(cat, rid, toId, type), [store]);
  const handleRemoveTrace = useCallback((cat, rid, toId)       => store.removeTrace(cat, rid, toId),    [store]);

  // ── Comments ──────────────────────────────────────
  const handleAddComment     = useCallback((cat, rid, text)      => store.addComment(cat, rid, text, session),              [store, session]);
  const handleEditComment    = useCallback((cat, rid, cid, text) => store.editComment(cat, rid, cid, text),                 [store]);
  const handleResolveComment = useCallback((cat, rid, cid)       => store.resolveComment(cat, rid, cid, session.displayName),[store, session]);
  const handleDeleteComment  = useCallback((cat, rid, cid)       => store.deleteComment(cat, rid, cid),                     [store]);

  // ── Diagram ───────────────────────────────────────
  const handleSaveDiagram = useCallback((b, c, bi, ci) => store.saveDiagramState(b, c, bi, ci), [store]);

  // ── JSON Export / Import ──────────────────────────
  function handleExportJson() {
    if (!currentProject) { showToast('No project loaded', 'err'); return; }
    exportProject(currentPid, currentProject);
    showToast('Project exported as JSON', 'ok');
  }
  function handleImportJson(text) {
    try {
      const { pid, project } = parseImportFile(text);
      if (db.projects[pid] && !window.confirm(`"${project.name}" exists. Overwrite?`)) return;
      store.importProject(pid, project);
      setPanel('overview');
      showToast(`"${project.name}" imported`, 'ok');
    } catch (e) { showToast('Import failed: ' + e.message, 'err'); }
  }

  // ── CSV Export / Import ───────────────────────────
  function handleExportCsv() {
    if (!currentProject) { showToast('No project loaded', 'err'); return; }
    exportToCsv(currentProject, currentPid);
    showToast('Requirements exported as CSV', 'ok');
  }
  function handleImportCsv(text) {
    if (!currentProject) { showToast('Select a project first', 'err'); return; }
    try {
      const { requirements, warnings } = importFromCsv(text, currentProject);
      store.importCsvRequirements(requirements);

      // Build per-category counts for the result modal
      const counts = Object.fromEntries(
        CATEGORIES.map(c => [c, (requirements[c] ?? []).length])
      );
      setCsvResult({ counts, warnings, projectName: currentProject.name });
      showToast('CSV imported', 'ok');
    } catch (e) { showToast('' + e.message, 'err'); }
  }

  // ── Navigation ────────────────────────────────────
  function navigate(p) {
    if (!currentProject && p !== 'overview') return;
    setPanel(p);
  }

  const nextProjId = 'PROJ-' + String(Object.keys(db.projects).length + 1).padStart(3, '0');

  return (
    <div className={styles.app}>
      <TopBar
        db={db} currentPid={currentPid}
        onSwitch={id => { store.switchProject(id); setPanel('overview'); }}
        onNew={openNewProject}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onExportCsv={handleExportCsv}
        onImportCsv={handleImportCsv}
        session={session} isManager={isManager}
        onLogout={auth.logout} onManageUsers={() => setUsersMgmt(true)}
      />

      <div className={styles.body}>
        <Sidebar currentPanel={panel} onNavigate={navigate} project={currentProject} session={session} />

        <main className={styles.content}>
          {!currentProject ? (
            <NoProject onNew={isManager ? openNewProject : null} />
          ) : (
            <>
              {panel === 'overview' && (
                <Overview project={currentProject} pid={currentPid}
                  onEdit={openEditProject} onDelete={handleDeleteProject} isManager={isManager} />
              )}
              {panel === 'all-reqs' && (
                <AllRequirementsPanel
                  project={currentProject} isManager={isManager} session={session}
                  onEditReq={openEditReq} onDeleteReq={handleDeleteReq}
                  onUpsertSection={handleUpsertSection}
                  onDeleteSection={handleDeleteSection}
                  onReorderSections={handleReorderSections}
                  onAddComment={handleAddComment}
                />
              )}
              {CATEGORIES.map(cat => panel === cat && (
                <RequirementsPanel key={cat} category={cat} project={currentProject}
                  session={session} isManager={isManager}
                  onAdd={openAddReq} onEdit={openEditReq} onDelete={handleDeleteReq}
                  onAddComment={handleAddComment} onEditComment={handleEditComment}
                  onResolveComment={handleResolveComment} onDeleteComment={handleDeleteComment}
                />
              ))}
              {panel === 'traceability' && (
                <TraceabilityMatrix
                  project={currentProject} isManager={isManager}
                  onAddTrace={handleAddTrace} onRemoveTrace={handleRemoveTrace}
                />
              )}
              {panel === 'diagram' && (
                <BlockDiagram project={currentProject} onSave={handleSaveDiagram} isManager={isManager} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <ProjectModal open={projModal.open} onClose={() => setProjModal(PROJ_CLOSED)}
        onSave={handleSaveProject} editing={projModal.editing}
        editingId={projModal.editingId} nextId={nextProjId} />

      <RequirementModal open={reqModal.open} onClose={() => setReqModal(REQ_CLOSED)}
        onSave={handleSaveReq} category={reqModal.category}
        editing={reqModal.editing} editingId={reqModal.editingId} project={currentProject} />

      <UserManagementModal open={usersMgmt} onClose={() => setUsersMgmt(false)}
        authDb={auth.authDb} session={session} onAdd={auth.addUser}
        onDelete={auth.deleteUser} onChangePassword={auth.changePassword} />

      <CsvImportResultModal
        open={!!csvResult} onClose={() => setCsvResult(null)} result={csvResult} />

      <Toast msg={toast.msg} type={toast.type} visible={toast.visible} />
    </div>
  );
}
