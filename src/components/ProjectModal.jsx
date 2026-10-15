// ── components/ProjectModal.js ───────────────────────
import { useState, useEffect } from 'react';
import { Modal, ModalFooter, Btn, Field, Input, Select, Textarea, FormGrid } from './UI';

const EMPTY = {
  name: '', id: '', version: '1.0.0', status: 'Draft',
  targetDate: '', description: '', lead: '', customer: '',
  standards: '', notes: '',
};

export function ProjectModal({ open, onClose, onSave, editing, editingId, nextId }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name:        editing.name ?? '',
          id:          editingId ?? '',
          version:     editing.version ?? '',
          status:      editing.status ?? 'Draft',
          targetDate:  editing.targetDate ?? '',
          description: editing.description ?? '',
          lead:        editing.lead ?? '',
          customer:    editing.customer ?? '',
          standards:   (editing.standards ?? []).join(', '),
          notes:       editing.notes ?? '',
        });
      } else {
        setForm({ ...EMPTY, id: nextId });
      }
    }
  }, [open, editing, editingId, nextId]);

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  function handleSave() {
    const id = form.id.trim().toUpperCase().replace(/\s+/g, '-');
    if (!form.name.trim()) { alert('Project name is required'); return; }
    if (!id)               { alert('Project ID is required'); return; }
    onSave({
      id,
      fields: {
        name:        form.name.trim(),
        version:     form.version.trim(),
        status:      form.status,
        targetDate:  form.targetDate,
        description: form.description.trim(),
        lead:        form.lead.trim(),
        customer:    form.customer.trim(),
        standards:   form.standards.split(',').map(s => s.trim()).filter(Boolean),
        notes:       form.notes.trim(),
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit Project  ${editingId}` : 'New Project'}
    >
      <FormGrid cols={2}>
        <Field label="Project name *">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. CNC Servo Drive MK4" autoFocus />
        </Field>
        <Field label="Project ID *">
          <Input value={form.id} onChange={set('id')} placeholder="e.g. PROJ-001" style={{ fontFamily: 'var(--mono)' }} />
        </Field>
      </FormGrid>

      <FormGrid cols={3} style={{ marginTop: 14 }}>
        <Field label="Version">
          <Input value={form.version} onChange={set('version')} placeholder="1.0.0" />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')}>
            {['Draft','Active','On hold','Completed'].map(s => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Target date">
          <Input type="date" value={form.targetDate} onChange={set('targetDate')} />
        </Field>
      </FormGrid>

      <div style={{ marginTop: 14 }}>
        <Field label="Description">
          <Textarea value={form.description} onChange={set('description')} placeholder="Brief description of the project scope and objectives…" />
        </Field>
      </div>

      <FormGrid cols={2} style={{ marginTop: 14 }}>
        <Field label="Lead engineer">
          <Input value={form.lead} onChange={set('lead')} placeholder="Name" />
        </Field>
        <Field label="Customer / Client">
          <Input value={form.customer} onChange={set('customer')} placeholder="Company or name" />
        </Field>
      </FormGrid>

      <div style={{ marginTop: 14 }}>
        <Field label="Applicable standards (comma-separated)">
          <Input value={form.standards} onChange={set('standards')} placeholder="e.g. IEC 61131-3, ISO 13849, EN 60204-1" />
        </Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} placeholder="Additional context, constraints, or references…" style={{ minHeight: 60 }} />
        </Field>
      </div>

      <ModalFooter>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSave}>Save project</Btn>
      </ModalFooter>
    </Modal>
  );
}
