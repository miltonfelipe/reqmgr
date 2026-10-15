// ── App.jsx ──────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useStore }           from './hooks/useStore';
import { useAuth }            from './hooks/useAuth';
import { useToast }           from './hooks/useToast';
import { exportProject, parseImportFile } from './utils/exportImport';
import { exportToCsv, importFromCsv }     from './utils/csvUtils';
import { CATEGORIES, loadLegacyProjects, archiveLegacyProjects } from './store/db';

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
import { ProjectAccessModal }    from './components/ProjectAccessModal';
import { Toast }                 from './components/UI';

import styles from './App.module.css';

const PROJ_CLOSED = { open: false, editing: null, editingId: null };
const REQ_CLOSED  = { open: false, category: null, editing: null, editingId: null };

export default function App() {
  const auth  = useAuth();
  const { toast, showToast } = useToast();
  const showError = useCallback(msg => showToast(msg, 'err'), [showToast]);
  const store = useStore({ enabled: auth.isLoggedIn, onError: showError });

  const [panel,       setPanel]       = useState('overview');
  const [projModal,   setProjModal]   = useState(PROJ_CLOSED);
  const [reqModal,    setReqModal]    = useState(REQ_CLOSED);
  const [usersMgmt,   setUsersMgmt]   = useState(false);
  const [csvResult,   setCsvResult]   = useState(null);  // { counts, warnings, projectName }
  const [accessOpen,  setAccessOpen]  = useState(false);

  const { db, currentPid, currentProject } = store;
  const isManager = store.role === 'manager';
  // The logged-in user plus their role in the open project
  const session = useMemo(
    () => auth.user && { ...auth.user, role: store.role ?? 'reviewer' },
    [auth.user, store.role],
  );

  // ── Project ────────────────────────────────────────
  function openNewProject()  { setProjModal({ open: true, editing: null, editingId: null }); }
  function openEditProject() {
    if (!currentProject) return;
    setProjModal({ open: true, editing: currentProject, editingId: currentPid });
  }
  async function handleSaveProject({ id, fields }) {
    if (!projModal.editingId && Object.keys(db.projects).includes(id)) {
      showToast('Project ID already exists', 'err'); return;
    }
    if (!await store.upsertProject(id, fields, projModal.editingId)) return;
    setProjModal(PROJ_CLOSED); setPanel('overview'); showToast('Project saved', 'ok');
  }
  async function handleDeleteProject() {
    if (!currentProject) return;
    if (!window.confirm(`Delete "${currentProject.name}" for all its members? This cannot be undone.`)) return;
    if (await store.deleteProject(currentPid)) { setPanel('overview'); showToast('Project deleted', 'ok'); }
  }

  // ── Requirements ───────────────────────────────────
  function openAddReq(cat)      { setReqModal({ open: true, category: cat, editing: null, editingId: null }); }
  function openEditReq(cat, id) {
    const req = (currentProject?.requirements[cat] ?? []).find(r => r.id === id);
    if (!req) return;
    setReqModal({ open: true, category: cat, editing: req, editingId: id });
  }
  async function handleSaveReq(data) {
    if (!await store.upsertReq(reqModal.category, data, reqModal.editingId)) return;
    setReqModal(REQ_CLOSED); showToast('Requirement saved', 'ok');
  }
  async function handleDeleteReq(cat, id) {
    if (!window.confirm('Delete this requirement?')) return;
    if (await store.deleteReq(cat, id)) showToast('Requirement deleted', 'ok');
  }

  // ── Sections ───────────────────────────────────────
  const handleUpsertSection   = useCallback((sec, editId) => store.upsertSection(sec, editId),    [store]);
  const handleDeleteSection   = useCallback((id)          => store.deleteSection(id),              [store]);
  const handleReorderSections = useCallback((ids)         => store.reorderSections(ids),           [store]);

  // ── Traces ────────────────────────────────────────
  const handleAddTrace    = useCallback((cat, rid, toId, type) => store.addTrace(cat, rid, toId, type), [store]);
  const handleRemoveTrace = useCallback((cat, rid, toId)       => store.removeTrace(cat, rid, toId),    [store]);

  // ── Comments ──────────────────────────────────────
  const handleAddComment     = useCallback((cat, rid, text)      => store.addComment(cat, rid, text),       [store]);
  const handleEditComment    = useCallback((cat, rid, cid, text) => store.editComment(cat, rid, cid, text), [store]);
  const handleResolveComment = useCallback((cat, rid, cid)       => store.resolveComment(cat, rid, cid),     [store]);
  const handleDeleteComment  = useCallback((cat, rid, cid)       => store.deleteComment(cat, rid, cid),     [store]);

  // ── Diagram ───────────────────────────────────────
  const handleSaveDiagram = useCallback((b, c, bi, ci) => store.saveDiagramState(b, c, bi, ci), [store]);

  // ── One-time upload of projects saved in this browser before the server ──
  const legacyChecked = useRef(false);
  useEffect(() => {
    if (!auth.isLoggedIn || legacyChecked.current) return;
    legacyChecked.current = true;
    const legacy = Object.entries(loadLegacyProjects());
    if (!legacy.length) return;
    const names = legacy.map(([pid, p]) => `• ${p.name} [${pid}]`).join('\n');
    if (!window.confirm(`This browser has ${legacy.length} project(s) saved locally from before the server:\n\n${names}\n\nUpload them to the server now?`)) return;
    (async () => {
      let uploaded = 0;
      for (const [pid, project] of legacy) {
        if (await store.importProject(pid, project)) uploaded++;
      }
      if (uploaded === legacy.length) archiveLegacyProjects();
      showToast(`Uploaded ${uploaded} of ${legacy.length} local project(s)`, uploaded === legacy.length ? 'ok' : 'err');
    })();
  }, [auth.isLoggedIn, store, showToast]);

  // ── Auth gate ─────────────────────────────────────
  if (auth.checking) return null;
  if (!auth.isLoggedIn) return <LoginScreen onLogin={auth.login} />;

  // ── JSON Export / Import ──────────────────────────
  function handleExportJson() {
    if (!currentProject) { showToast('No project loaded', 'err'); return; }
    exportProject(currentPid, currentProject);
    showToast('Project exported as JSON', 'ok');
  }
  async function handleImportJson(text) {
    let parsed;
    try { parsed = parseImportFile(text); } catch (e) { showToast('Import failed: ' + e.message, 'err'); return; }
    const { pid, project } = parsed;
    if (db.projects[pid] && !window.confirm(
      `Replace project "${db.projects[pid].name}" [${pid}] for everyone with the contents of this file?\n\n` +
      'A backup of the current state is saved first and can be restored under Members & backups.'
    )) return;
    const res = await store.importProject(pid, project);
    if (!res) return;
    setPanel('overview');
    showToast(res.created ? `"${project.name}" imported` : `"${project.name}" replaced (backup #${res.backupId} saved)`, 'ok');
  }

  // ── CSV Export / Import ───────────────────────────
  function handleExportCsv() {
    if (!currentProject) { showToast('No project loaded', 'err'); return; }
    exportToCsv(currentProject, currentPid);
    showToast('Requirements exported as CSV', 'ok');
  }
  async function handleImportCsv(text) {
    if (!currentProject) { showToast('Select a project first', 'err'); return; }
    try {
      const { requirements, warnings } = importFromCsv(text, currentProject);
      if (!await store.importCsvRequirements(requirements)) return;

      // Build per-category counts for the result modal
      const counts = Object.fromEntries(
        CATEGORIES.map(c => [c, (requirements[c] ?? []).length])
      );
      setCsvResult({ counts, warnings, projectName: currentProject.name });
      showToast('CSV imported (backup saved)', 'ok');
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
        session={session} isAdmin={auth.isAdmin}
        onLogout={auth.logout} onManageUsers={() => { auth.loadUsers(); setUsersMgmt(true); }}
      />

      <div className={styles.body}>
        <Sidebar currentPanel={panel} onNavigate={navigate} project={currentProject} session={session} />

        <main className={styles.content}>
          {!currentProject ? (
            <NoProject onNew={openNewProject} />
          ) : (
            <>
              {panel === 'overview' && (
                <Overview project={currentProject} pid={currentPid}
                  onEdit={openEditProject} onDelete={handleDeleteProject} isManager={isManager}
                  onAccess={() => { auth.loadUsers(); setAccessOpen(true); }} />
              )}
              {panel === 'all-reqs' && (
                <AllRequirementsPanel
                  project={currentProject} isManager={isManager}
                  onEditReq={openEditReq} onDeleteReq={handleDeleteReq}
                  onUpsertSection={handleUpsertSection}
                  onDeleteSection={handleDeleteSection}
                  onReorderSections={handleReorderSections}
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
        users={auth.users} session={session} onAdd={auth.addUser}
        onDelete={auth.deleteUser} onChangePassword={auth.changePassword} />

      {currentPid && (
        <ProjectAccessModal open={accessOpen} onClose={() => setAccessOpen(false)}
          pid={currentPid} isManager={isManager} users={auth.users} userId={session.userId}
          onRestore={store.restoreBackup} onError={showError} />
      )}

      <CsvImportResultModal
        open={!!csvResult} onClose={() => setCsvResult(null)} result={csvResult} />

      <Toast msg={toast.msg} type={toast.type} visible={toast.visible} />
    </div>
  );
}
