// ── components/RequirementModal.js ───────────────────
import React, { useState, useEffect } from 'react';
import { CAT_META, CATEGORIES, makeEmptyReq, TRACE_TYPES, getAllReqs } from '../store/db';
import { Modal, ModalFooter, Btn, Field, Input, Select, Textarea, FormGrid } from './UI';
import styles from './RequirementModal.module.css';

const EMPTY_FORM = {
  id: '', title: '', statement: '',
  type: 'shall', status: 'open', priority: 'medium',
  subsystem: '', verification: '', source: '', owner: '',
  rationale: '', acceptance: '', sectionId: '',
  traces: [],
};

export function RequirementModal({ open, onClose, onSave, category, editing, editingId, project }) {
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [traceForm, setTraceForm] = useState({ toId: '', type: 'derives' });
  const [traceErr,  setTraceErr]  = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        id:           editing.id ?? '',
        title:        editing.title ?? '',
        statement:    editing.statement ?? '',
        type:         editing.type ?? 'shall',
        status:       editing.status ?? 'open',
        priority:     editing.priority ?? 'medium',
        subsystem:    editing.subsystem ?? '',
        verification: editing.verification ?? '',
        source:       editing.source ?? '',
        owner:        editing.owner ?? '',
        rationale:    editing.rationale ?? '',
        acceptance:   editing.acceptance ?? '',
        sectionId:    editing.sectionId ?? '',
        traces:       editing.traces ?? [],
      });
    } else {
      const existingIds = (project?.requirements[category] ?? []).map(r => r.id);
      const blank = makeEmptyReq(category, existingIds);
      setForm({ ...EMPTY_FORM, id: blank.id });
    }
    setTraceForm({ toId: '', type: 'derives' });
    setTraceErr('');
  }, [open, editing, category, project]); // eslint-disable-line

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  function addTrace() {
    const toId = traceForm.toId.trim().toUpperCase();
    if (!toId) { setTraceErr('Target ID is required'); return; }
    if (toId === form.id.trim().toUpperCase()) { setTraceErr('Cannot trace to self'); return; }
    if ((form.traces ?? []).find(t => t.toId === toId)) { setTraceErr('Trace to this ID already exists'); return; }
    // Verify target exists
    const allIds = CATEGORIES.flatMap(c => (project?.requirements[c]??[]).map(r=>r.id));
    if (!allIds.includes(toId)) { setTraceErr(`Requirement "${toId}" not found`); return; }
    setForm(f => ({ ...f, traces: [...(f.traces??[]), { toId, type: traceForm.type }] }));
    setTraceForm(t => ({ ...t, toId: '' }));
    setTraceErr('');
  }

  function removeTrace(toId) {
    setForm(f => ({ ...f, traces: (f.traces??[]).filter(t => t.toId !== toId) }));
  }

  function handleSave() {
    const id = form.id.trim().toUpperCase();
    if (!id)             { alert('Requirement ID is required'); return; }
    if (!form.title.trim())     { alert('Title is required'); return; }
    if (!form.statement.trim()) { alert('Requirement statement is required'); return; }
    if (!editingId) {
      const existing = (project?.requirements[category] ?? []).find(r => r.id === id);
      if (existing) { alert('ID already exists in this category'); return; }
    }
    onSave({ ...form, id, title: form.title.trim(), statement: form.statement.trim() });
  }

  const meta    = CAT_META[category] ?? { label: category };
  const blocks  = project ? Object.values(project.diagramBlocks ?? {}) : [];
  const sections = project ? (project.sections ?? []).sort((a,b) => (a.order??0)-(b.order??0)) : [];
  const allReqs = project ? getAllReqs(project) : [];

  return (
    <Modal open={open} onClose={onClose}
      title={`${editingId ? 'Edit' : 'Add'} ${meta.label} Requirement`}>
      <FormGrid cols={2}>
        <Field label="Requirement ID *">
          <Input value={form.id} onChange={set('id')} placeholder="e.g. SYS-001"
            style={{ fontFamily:'var(--mono)' }} autoFocus />
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={set('priority')}>
            <option value="high">⬆ High</option>
            <option value="medium">◆ Medium</option>
            <option value="low">⬇ Low</option>
          </Select>
        </Field>
      </FormGrid>

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
            {['Test','Analysis','Inspection','Demonstration','Simulation','Review'].map(v =>
              <option key={v}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Allocated to (engineer)">
          <Input value={form.owner} onChange={set('owner')} placeholder="Name or team" />
        </Field>
      </FormGrid>

      <FormGrid cols={1} style={{ marginTop: 14 }}>
        <Field label="Source document">
          <Input value={form.source} onChange={set('source')} placeholder="e.g. Customer spec §3.2" />
        </Field>
      </FormGrid>

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

      {/* ── Traces ── */}
      <div className={styles.traceSection}>
        <div className={styles.traceSectionTitle}>Traceability links</div>
        {(form.traces ?? []).length > 0 && (
          <div className={styles.traceList}>
            {(form.traces ?? []).map(t => {
              const target = allReqs.find(r => r.id === t.toId);
              const tm = TRACE_TYPES[t.type];
              return (
                <div key={t.toId} className={styles.traceItem}>
                  <span className={styles.traceChip} style={{ background: tm?.color+'22', color: tm?.color }}>
                    {tm?.short ?? t.type}
                  </span>
                  <span className={styles.traceId}>{t.toId}</span>
                  {target && <span className={styles.traceTitle}>{target.title}</span>}
                  <button className={styles.traceRemove} onClick={() => removeTrace(t.toId)}>×</button>
                </div>
              );
            })}
          </div>
        )}
        <div className={styles.traceAdd}>
          <Select value={traceForm.type} onChange={e => setTraceForm(f => ({ ...f, type: e.target.value }))}
            style={{ width: 140 }}>
            {Object.entries(TRACE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Input value={traceForm.toId} onChange={e => setTraceForm(f => ({ ...f, toId: e.target.value }))}
            placeholder="Target ID (e.g. SYS-001)"
            style={{ fontFamily:'var(--mono)', flex:1 }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTrace(); } }}
          />
          <Btn size="sm" onClick={addTrace}>Add</Btn>
        </div>
        {traceErr && <div className={styles.traceErr}>{traceErr}</div>}
      </div>

      <ModalFooter>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSave}>Save requirement</Btn>
      </ModalFooter>
    </Modal>
  );
}
