// ── components/Overview.js ───────────────────────────
import { CAT_META, CATEGORIES } from '../store/db';
import { Badge, Btn } from './UI';
import styles from './Overview.module.css';

export function Overview({ project, pid, onEdit, onDelete, onAccess, isManager }) {
  if (!project) return null;

  const counts = {};
  let total = 0, approved = 0;
  CATEGORIES.forEach(c => {
    const reqs = project.requirements[c] ?? [];
    counts[c] = reqs.length;
    total    += reqs.length;
    approved += reqs.filter(r => r.status === 'approved').length;
  });

  // Comment stats
  let totalComments = 0, openComments = 0;
  CATEGORIES.forEach(c => {
    (project.requirements[c] ?? []).forEach(r => {
      totalComments += (r.comments ?? []).length;
      openComments  += (r.comments ?? []).filter(cm => !cm.resolved).length;
    });
  });

  const blocks = Object.keys(project.diagramBlocks ?? {}).length;
  const pct    = total ? Math.round(approved / total * 100) : 0;
  const standards = project.standards ?? [];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{project.name}</div>
          <div className={styles.sub}>{pid} · v{project.version || '—'}</div>
        </div>
        <div className={styles.actions}>
          <Btn size="sm" onClick={onAccess}>Members &amp; backups</Btn>
          {isManager && (
            <>
              <Btn size="sm" onClick={onEdit}>Edit</Btn>
              <Btn size="sm" variant="danger" onClick={onDelete}>Delete</Btn>
            </>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.statsGrid}>
          {/* Total */}
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total req</div>
            <div className={styles.statValue} style={{ color: 'var(--accent)' }}>{total}</div>
            <div className={styles.statSub}>{approved} approved ({pct}%)</div>
            <div className={styles.progBar}>
              <div className={styles.progFill} style={{ width: pct + '%' }} />
            </div>
          </div>
          {/* Per category — ordered by hierarchy level */}
          {CATEGORIES.map(c => (
            <div key={c} className={`${styles.statCard} ${c === 'customer' ? styles.statCardTop : ''}`}>
              <div className={styles.statLabel} style={{ color: CAT_META[c].color }}>
                {CAT_META[c].prefix}
              </div>
              <div className={styles.statValue} style={{ color: CAT_META[c].color }}>{counts[c]}</div>
              <div className={styles.statSub}>{CAT_META[c].label}</div>
            </div>
          ))}
          {/* Subsystems */}
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Subsystems</div>
            <div className={styles.statValue} style={{ color: '#60a5fa' }}>{blocks}</div>
            <div className={styles.statSub}>diagram blocks</div>
          </div>
          {/* Comments */}
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Comments</div>
            <div className={styles.statValue} style={{ color: openComments > 0 ? '#fbbf24' : '#4ade80' }}>
              {openComments}
            </div>
            <div className={styles.statSub}>{openComments} open · {totalComments - openComments} resolved</div>
          </div>
        </div>

        <div className={styles.infoSection}>
          <div className={styles.infoSectionTitle}>Project details</div>
          {project.description && (
            <>
              <p className={styles.desc}>{project.description}</p>
              <div className={styles.divider} />
            </>
          )}
          <InfoRow label="Lead engineer" value={project.lead     || '—'} />
          <InfoRow label="Customer"      value={project.customer || '—'} />
          <InfoRow label="Status">
            <Badge variant={project.status || 'Draft'}>{project.status || 'Draft'}</Badge>
          </InfoRow>
          <InfoRow label="Target date"  value={project.targetDate || '—'} />
          <InfoRow label="Created"      value={project.createdAt ? new Date(project.createdAt).toLocaleDateString('en-GB') : '—'} />
          <InfoRow label="Last updated" value={project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('en-GB') : '—'} />
          <InfoRow label="Standards">
            {standards.length > 0
              ? <div className={styles.tagRow}>{standards.map(s => <span key={s} className={styles.tag}>{s}</span>)}</div>
              : '—'}
          </InfoRow>
          {project.notes && (
            <>
              <div className={styles.divider} />
              <p className={styles.notes}>{project.notes}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, children }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoKey}>{label}</span>
      <span className={styles.infoVal}>{children ?? value}</span>
    </div>
  );
}
