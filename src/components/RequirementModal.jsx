// ── components/RequirementModal.jsx ──────────────────
import { useState, useEffect } from 'react';
import { CAT_META, makeEmptyReq, TRACE_TYPES, OBJECT_TYPES, REQ_TYPES, getAllReqs } from '../store/db';
import { Modal, ModalFooter, Btn, Field, Input, Select, Textarea, FormGrid } from './UI';
import { ReqSearchSelect } from './ReqSearchSelect';
import styles from './RequirementModal.module.css';

const EMPTY_FORM = {
  id: '', title: '', statement: '',
  type: 'shall', status: 'open', priority: 'medium',
  subsystem: '', verification: '', source: '', owner: '',
  rationale: '', acceptance: '', sectionId: '',
  traces: [], objectType: 'requirement', reqType: 'functional',
};

export function RequirementModal({ open, onClose, onSave, category, editing, editingId, project }) {
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [traceType,  setTraceType]  = useState('derives');
  const [traceToId,  setTraceToId]  = useState('');   // selected req ID from dropdown
  const [traceErr,   setTraceErr]   = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        id:           editing.id           ?? '',
        title:        editing.title        ?? '',
        statement:    editing.statement    ?? '',
        type:         editing.type         ?? 'shall',
        status:       editing.status       ?? 'open',
        priority:     editing.priority     ?? 'medium',
        subsystem:    editing.subsystem    ?? '',
        verification: editing.verification ?? '',
        source:       editing.source       ?? '',
        owner:        editing.owner        ?? '',
        rationale:    editing.rationale    ?? '',
        acceptance:   editing.acceptance   ?? '',
        sectionId:    editing.sectionId    ?? '',
        traces:       editing.traces       ?? [],
        objectType:   editing.objectType   ?? 'requirement',
        reqType:      editing.reqType      ?? 'functional',
      });
    } else {
      const existingIds = (project?.requirements[category] ?? []).map(r => r.id);
      const blank = makeEmptyReq(category, existingIds);
      setForm({ ...EMPTY_FORM, id: blank.id });
    }
    setTraceType('derives');
    setTraceToId('');
    setTraceErr('');
  }, [open, editing, category, project]);

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  // ── Add trace ──────────────────────────────────────
  function addTrace() {
    if (!traceToId) { setTraceErr('Please select a requirement from the list.'); return; }
    if ((form.traces ?? []).find(t => t.toId === traceToId)) {
      setTraceErr('A trace to this requirement already exists.'); return;
    }
    setForm(f => ({ ...f, traces: [...(f.traces ?? []), { toId: traceToId, type: traceType }] }));
    setTraceToId('');
    setTraceErr('');
  }

  function removeTrace(toId) {
    setForm(f => ({ ...f, traces: (f.traces ?? []).filter(t => t.toId !== toId) }));
  }

  // ── Save ───────────────────────────────────────────
  function handleSave() {
    const id = form.id.trim().toUpperCase();
    if (!id)                   { alert('Requirement ID is required'); return; }
    if (!form.title.trim())    { alert('Title is required'); return; }
    if (!form.statement.trim()){ alert('Requirement statement is required'); return; }
    if (!editingId) {
      const dup = (project?.requirements[category] ?? []).find(r => r.id === id);
      if (dup) { alert('ID already exists in this category'); return; }
    }
    onSave({ ...form, id, title: form.title.trim(), statement: form.statement.trim() });
  }

  const meta     = CAT_META[category] ?? { label: category };
  const blocks   = project ? Object.values(project.diagramBlocks ?? {}) : [];
  const sections = project
    ? (project.sections ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];
  const allReqs  = project ? getAllReqs(project) : [];

  // The current requirement's own ID to exclude from the dropdown
  const selfId = form.id.trim().toUpperCase();

  return (
    <Modal open={open} onClose={onClose}
      title={`${editingId ? 'Edit' : 'Add'} ${meta.label} Requirement`}>

      {/* ── Identity ── */}
      <FormGrid cols={2}>
        <Field label="Requirement ID *">
          <Input value={form.id} onChange={set('id')} placeholder="e.g. SYS-001"
            style={{ fontFamily: 'var(--mono)' }} autoFocus />
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={set('priority')}>
            <option value="high">⬆ High</option>
            <option value="medium">◆ Medium</option>
            <option value="low">⬇ Low</option>
          </Select>
        </Field>
      </FormGrid>

      {/* ── Content ── */}
      <div style={{ marginTop: 14 }}>
        <Field label="Title *">
          <Input value={form.title} onChange={set('title')} placeholder="Short descriptive title" />
        </Field>
      </div>
      <div style={{ marginTop: 14 }}>
        <Field label="Requirement statement *">
          <Textarea value={form.statement} onChange={set('statement')}
            placeholder="The system SHALL / SHOULD / MAY…" style={{ minHeight: 80 }} />
        </Field>
      </div>

      {/* ── Classification ── */}
      <FormGrid cols={2} style={{ marginTop: 14 }}>
        <Field label="Type">
          <Select value={form.type} onChange={set('type')}>
            <option value="shall">SHALL — mandatory</option>
            <option value="should">SHOULD — recommended</option>
            <option value="may">MAY — optional</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')}>
            <option value="open">Open</option>
            <option value="in-review">In review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </Field>
      </FormGrid>

      {/* ── Assignment ── */}
      {/* ── Object type + Requirement type ── */}
      <FormGrid cols={2} style={{ marginTop: 14 }}>
        <Field label="Object type">
          <Select value={form.objectType} onChange={set('objectType')}>
            {Object.entries(OBJECT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Requirement type">
          <Select value={form.reqType} onChange={set('reqType')}
            disabled={form.objectType !== 'requirement'}>
            {Object.entries(REQ_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </Field>
      </FormGrid>

      <FormGrid cols={2} style={{ marginTop: 14 }}>
        <Field label="Section">
          <Select value={form.sectionId} onChange={set('sectionId')}>
            <option value="">— unassigned —</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </Select>
        </Field>
        <Field label="Subsystem (from diagram)">
          <Select value={form.subsystem} onChange={set('subsystem')}>
            <option value="">— none —</option>
            {blocks.map(b => <option key={b.id} value={b.id}>{b.title || 'Block ' + b.id}</option>)}
          </Select>
        </Field>
      </FormGrid>

      <FormGrid cols={2} style={{ marginTop: 14 }}>
        <Field label="Verification method">
          <Select value={form.verification} onChange={set('verification')}>
            <option value="">— select —</option>
            {['Test', 'Analysis', 'Inspection', 'Demonstration', 'Simulation', 'Review'].map(v =>
              <option key={v}>{v}</option>
            )}
          </Select>
        </Field>
        <Field label="Allocated to (engineer)">
          <Input value={form.owner} onChange={set('owner')} placeholder="Name or team" />
        </Field>
      </FormGrid>

      <div style={{ marginTop: 14 }}>
        <Field label="Source document">
          <Input value={form.source} onChange={set('source')} placeholder="e.g. Customer spec §3.2" />
        </Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <Field label="Rationale / Notes">
          <Textarea value={form.rationale} onChange={set('rationale')}
            placeholder="Why this requirement exists…" style={{ minHeight: 54 }} />
        </Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <Field label="Acceptance criteria">
          <Textarea value={form.acceptance} onChange={set('acceptance')}
            placeholder="Pass/fail criteria…" style={{ minHeight: 54 }} />
        </Field>
      </div>

      {/* ══ Traceability links ══════════════════════════ */}
      <div className={styles.traceSection}>
        <div className={styles.traceSectionTitle}>
          Traceability links
          {(form.traces ?? []).length > 0 && (
            <span className={styles.traceCount}>{(form.traces ?? []).length}</span>
          )}
        </div>

        {/* Existing traces */}
        {(form.traces ?? []).length > 0 && (
          <div className={styles.traceList}>
            {(form.traces ?? []).map(t => {
              const target = allReqs.find(r => r.id === t.toId);
              const tm     = TRACE_TYPES[t.type];
              const targetCat = target?._cat;
              const catMeta   = targetCat ? CAT_META[targetCat] : null;
              return (
                <div key={t.toId} className={styles.traceItem}>
                  {/* Type chip */}
                  <span className={styles.traceChip}
                    style={{ background: tm?.color + '22', color: tm?.color, borderColor: tm?.color + '44' }}>
                    {tm?.short ?? t.type}
                  </span>
                  {/* Category prefix */}
                  {catMeta && (
                    <span className={styles.traceCatPrefix} style={{ color: catMeta.color }}>
                      {catMeta.prefix}
                    </span>
                  )}
                  {/* ID */}
                  <span className={styles.traceId}>{t.toId}</span>
                  {/* Title */}
                  <span className={styles.traceTitle}>
                    {target?.title
                      ? target.title
                      : <em className={styles.traceUnknown}>requirement not found</em>}
                  </span>
                  {/* Remove */}
                  <button className={styles.traceRemove} onClick={() => removeTrace(t.toId)}
                    title="Remove trace">×</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new trace row */}
        <div className={styles.traceAddSection}>
          <div className={styles.traceAddLabel}>Add trace</div>
          <div className={styles.traceAddRow}>
            {/* Relationship type */}
            <Select
              value={traceType}
              onChange={e => setTraceType(e.target.value)}
              style={{ width: 150, flexShrink: 0 }}
            >
              {Object.entries(TRACE_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>

            {/* Requirement picker dropdown */}
            <ReqSearchSelect
              project={project}
              excludeId={selfId}
              value={traceToId}
              onChange={setTraceToId}
              placeholder="— pick a requirement —"
            />

            {/* Add button */}
            <Btn
              size="sm"
              variant="primary"
              disabled={!traceToId}
              onClick={addTrace}
              style={{ flexShrink: 0 }}
            >
              Add
            </Btn>
          </div>
          {traceErr && <div className={styles.traceErr}>{traceErr}</div>}
        </div>
      </div>

      <ModalFooter>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSave}>Save requirement</Btn>
      </ModalFooter>
    </Modal>
  );
}
