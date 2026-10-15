// ── components/SectionModal.js ───────────────────────
import React, { useState, useEffect } from 'react';
import { makeEmptySection, SECTION_COLORS } from '../store/db';
import { Modal, ModalFooter, Btn, Field, Input, Textarea, FormGrid } from './UI';
import styles from './SectionModal.module.css';

export function SectionModal({ open, onClose, onSave, editing, existingSections }) {
  const [form, setForm] = useState({ title: '', description: '', color: SECTION_COLORS[0] });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({ title: editing.title, description: editing.description || '', color: editing.color });
    } else {
      const blank = makeEmptySection(existingSections);
      setForm({ title: '', description: '', color: blank.color });
    }
  }, [open, editing, existingSections]);

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  function handleSave() {
    if (!form.title.trim()) { alert('Section title is required'); return; }
    const base = editing ?? makeEmptySection(existingSections);
    onSave({ ...base, title: form.title.trim(), description: form.description.trim(), color: form.color });
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Section' : 'New Section'} width={440}>
      <Field label="Section title *">
        <Input value={form.title} onChange={set('title')} placeholder="e.g. Safety Requirements" autoFocus />
      </Field>
      <div style={{ marginTop: 14 }}>
        <Field label="Description">
          <Textarea value={form.description} onChange={set('description')}
            placeholder="What this section covers…" style={{ minHeight: 60 }} />
        </Field>
      </div>
      <div style={{ marginTop: 14 }}>
        <div className={styles.colorLabel}>Accent colour</div>
        <div className={styles.colorRow}>
          {SECTION_COLORS.map(c => (
            <div key={c}
              className={`${styles.colorSwatch} ${form.color === c ? styles.colorSwatchActive : ''}`}
              style={{ background: c }}
              onClick={() => setForm(f => ({ ...f, color: c }))}
            />
          ))}
        </div>
      </div>
      <ModalFooter>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSave}>Save section</Btn>
      </ModalFooter>
    </Modal>
  );
}
