// ── components/TopBar.jsx ────────────────────────────
import { useRef } from 'react';
import { Btn, VSep } from './UI';
import { UserMenu } from './UserMenu';
import styles from './TopBar.module.css';

export function TopBar({
  db, currentPid, onSwitch, onNew,
  onExportJson, onImportJson,
  onExportCsv,  onImportCsv,
  session, isManager, onLogout, onManageUsers,
}) {
  const jsonFileRef = useRef(null);
  const csvFileRef  = useRef(null);
  const projectKeys = Object.keys(db.projects);

  function handleJsonFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onImportJson(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleCsvFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onImportCsv(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>R</div>
        REQMGR
      </div>

      <VSep />

      {/* Project selector */}
      <div className={styles.projSelector}>
        <span className={styles.projLabel}>PROJECT</span>
        <select
          className={styles.projSelect}
          value={currentPid ?? ''}
          onChange={e => onSwitch(e.target.value || null)}
        >
          <option value="">— select project —</option>
          {projectKeys.map(k => (
            <option key={k} value={k}>
              {db.projects[k].name} [{k}]
            </option>
          ))}
        </select>
      </div>

      {isManager && (
        <Btn variant="primary" onClick={onNew}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          New project
        </Btn>
      )}

      <VSep />

      {/* ── JSON group ── */}
      <div className={styles.fileGroup}>
        <span className={styles.fileGroupLabel}>JSON</span>
        {isManager && (
          <Btn onClick={() => jsonFileRef.current?.click()} title="Import project JSON">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
              <path d="M3 12h10M8 3v7M5 7l3 3 3-3"/>
            </svg>
            Import
          </Btn>
        )}
        <Btn onClick={onExportJson} disabled={!currentPid} title="Export project JSON">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
            <path d="M3 12h10M8 10V3M5 6l3-3 3 3"/>
          </svg>
          Export
        </Btn>
        <input ref={jsonFileRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleJsonFile} />
      </div>

      <VSep />

      {/* ── CSV group ── */}
      <div className={styles.fileGroup}>
        <span className={styles.fileGroupLabel}>CSV</span>
        {isManager && (
          <Btn onClick={() => csvFileRef.current?.click()} disabled={!currentPid} title="Import requirements from CSV">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
              <path d="M3 12h10M8 3v7M5 7l3 3 3-3"/>
            </svg>
            Import
          </Btn>
        )}
        <Btn onClick={onExportCsv} disabled={!currentPid} title="Export requirements to CSV">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
            <path d="M3 12h10M8 10V3M5 6l3-3 3 3"/>
          </svg>
          Export
        </Btn>
        <input ref={csvFileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={handleCsvFile} />
      </div>

      <VSep />

      {session && (
        <UserMenu session={session} onLogout={onLogout} onManageUsers={onManageUsers} />
      )}
    </header>
  );
}
