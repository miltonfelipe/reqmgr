// ── components/NoProject.js ──────────────────────────
import { Btn } from './UI';
import styles from './NoProject.module.css';

export function NoProject({ onNew }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>⬡</div>
      <h3 className={styles.heading}>No project selected</h3>
      <p className={styles.body}>
        {onNew
          ? 'Create a new project or import an existing file to start managing your industrial requirements.'
          : 'Select a project from the top bar to view its requirements and add review comments.'}
      </p>
      {onNew && (
        <Btn variant="primary" onClick={onNew}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          Create project
        </Btn>
      )}
    </div>
  );
}
