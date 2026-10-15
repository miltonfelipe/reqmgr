// ── components/CsvImportResultModal.jsx ──────────────
import React from 'react';
import { Modal, ModalFooter, Btn } from './UI';
import styles from './CsvImportResultModal.module.css';

export function CsvImportResultModal({ open, onClose, result }) {
  if (!result) return null;

  const { counts, warnings, projectName } = result;
  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <Modal open={open} onClose={onClose} title="CSV Import Complete" width={500}>
      <div className={styles.summary}>
        <div className={styles.summaryIcon}>✓</div>
        <div>
          <div className={styles.summaryTitle}>
            {total} requirement{total !== 1 ? 's' : ''} imported into <strong>{projectName}</strong>
          </div>
          <div className={styles.summaryBreakdown}>
            {Object.entries(counts)
              .filter(([, n]) => n > 0)
              .map(([cat, n]) => (
                <span key={cat} className={styles.catCount}>
                  {cat}: {n}
                </span>
              ))}
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className={styles.warningsWrap}>
          <div className={styles.warningsTitle}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
              <path d="M8 1l7 13H1L8 1zM8 6v4M8 11.5v.5"/>
            </svg>
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </div>
          <div className={styles.warningsList}>
            {warnings.map((w, i) => (
              <div key={i} className={styles.warningRow}>
                <span className={styles.warningBullet}>!</span>
                {w}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.hint}>
        Existing requirements in the same categories were replaced by imported rows with matching IDs.
        History, comments, and diagram blocks are preserved.
      </div>

      <ModalFooter>
        <Btn variant="primary" onClick={onClose}>Done</Btn>
      </ModalFooter>
    </Modal>
  );
}
