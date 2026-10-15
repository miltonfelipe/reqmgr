// ── components/UI.js ─────────────────────────────────
// Shared low-level UI primitives.
import styles from './UI.module.css';

// ── Badge ─────────────────────────────────────────────
export function Badge({ variant = 'open', children }) {
  return <span className={`${styles.badge} ${styles['b-' + variant]}`}>{children}</span>;
}

// ── Button ────────────────────────────────────────────
export function Btn({ variant = 'default', size = 'md', disabled, onClick, children, title, type = 'button', style }) {
  const cls = [
    styles.btn,
    styles['btn-' + variant],
    styles['btn-' + size],
  ].join(' ');
  return (
    <button className={cls} disabled={disabled} onClick={onClick} title={title} type={type} style={style}>
      {children}
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 600 }) {
  if (!open) return null;
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} style={{ maxWidth: width }}>
        <div className={styles.modalTitle}>{title}</div>
        {children}
      </div>
    </div>
  );
}

export function ModalFooter({ children }) {
  return <div className={styles.modalFooter}>{children}</div>;
}

// ── Form primitives ───────────────────────────────────
export function Field({ label, children, span }) {
  return (
    <div className={styles.field} style={span ? { gridColumn: `span ${span}` } : {}}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

export function Input({ ...props }) {
  return <input className={styles.input} {...props} />;
}

export function Select({ children, ...props }) {
  return <select className={styles.select} {...props}>{children}</select>;
}

export function Textarea({ ...props }) {
  return <textarea className={styles.textarea} {...props} />;
}

export function FormGrid({ cols = 1, children }) {
  return (
    <div className={styles.formGrid} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {children}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────
export function Toast({ msg, type, visible }) {
  return (
    <div className={`${styles.toast} ${styles['t-' + type]} ${visible ? styles.toastVisible : ''}`}>
      {msg}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────
export function Empty({ children }) {
  return (
    <div className={styles.empty}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" opacity="0.25">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M9 9h6M9 12h4M9 15h3"/>
      </svg>
      <p>{children}</p>
    </div>
  );
}

// ── VSep ──────────────────────────────────────────────
export function VSep() {
  return <div className={styles.vsep} />;
}
