// ── utils/exportImport.js ────────────────────────────

export function exportProject(pid, project, tag = '') {
  const payload = {
    __reqmgr_format: 'reqmgr-v2',
    exportedAt: new Date().toISOString(),
    projectId: pid,
    project,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${pid}_${(project.name || 'project').replace(/\s+/g, '_')}_${tag || new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseImportFile(text) {
  const data = JSON.parse(text);
  if (!data.__reqmgr_format) throw new Error('Invalid file format');
  if (!data.projectId || !data.project) throw new Error('Malformed file');
  return { pid: data.projectId, project: data.project };
}
