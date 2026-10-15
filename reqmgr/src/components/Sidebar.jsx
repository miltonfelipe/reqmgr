// ── components/Sidebar.js ────────────────────────────
import React from 'react';
import { CAT_META } from '../store/db';
import styles from './Sidebar.module.css';

const NAV = [
  { section: 'Project', items: [
    { id: 'overview',   label: 'Overview',      icon: OverviewIcon },
  ]},
  { section: 'Requirements', items: [
    { id: 'all-reqs',   label: 'All requirements', icon: AllReqsIcon },
    { id: 'system',     label: 'System',     icon: SystemIcon,   cat: true },
    { id: 'hardware',   label: 'Hardware',   icon: HardwareIcon, cat: true },
    { id: 'software',   label: 'Software',   icon: SoftwareIcon, cat: true },
    { id: 'mechanical', label: 'Mechanical', icon: MechIcon,     cat: true },
  ]},
  { section: 'Analysis', items: [
    { id: 'traceability', label: 'Traceability',  icon: TraceIcon },
    { id: 'diagram',      label: 'Block Diagram', icon: DiagramIcon },
  ]},
];

export function Sidebar({ currentPanel, onNavigate, project, session }) {
  const counts   = {};
  const openCmts = {};
  if (project) {
    Object.keys(CAT_META).forEach(c => {
      const reqs  = project.requirements[c] ?? [];
      counts[c]   = reqs.length;
      openCmts[c] = reqs.reduce((n, r) => n + (r.comments ?? []).filter(cm => !cm.resolved).length, 0);
    });
  }
  const totalReqs = project
    ? Object.values(project.requirements ?? {}).reduce((n, r) => n + r.length, 0)
    : 0;
  const totalTraces = project
    ? Object.values(project.requirements ?? {}).flatMap(r => r).reduce((n, r) => n + (r.traces ?? []).length, 0)
    : 0;

  return (
    <nav className={styles.sidebar}>
      {NAV.map(group => (
        <div key={group.section}>
          <div className={styles.section}>{group.section}</div>
          <div className={styles.list}>
            {group.items.map(item => {
              const Icon = item.icon;
              const n    = item.cat ? (counts[item.id] ?? 0) : null;
              const cmts = item.cat ? (openCmts[item.id] ?? 0) : 0;
              return (
                <div key={item.id}
                  className={`${styles.item} ${currentPanel === item.id ? styles.active : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <Icon className={styles.icon} />
                  {item.label}
                  {item.id === 'all-reqs' && totalReqs > 0 && (
                    <span className={`${styles.badge} ${styles.populated}`}>{totalReqs}</span>
                  )}
                  {item.id === 'traceability' && totalTraces > 0 && (
                    <span className={`${styles.badge} ${styles.populated}`} style={{ background:'rgba(167,139,250,0.15)', color:'#a78bfa' }}>{totalTraces}</span>
                  )}
                  {item.cat && (
                    <span className={`${styles.badge} ${n > 0 ? styles.populated : ''}`}>{n}</span>
                  )}
                  {cmts > 0 && (
                    <span className={styles.cmtDot} title={`${cmts} open comment${cmts !== 1 ? 's' : ''}`}>{cmts}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {session && (
        <div className={styles.roleTag}>
          <div className={`${styles.roleIndicator} ${styles['role-' + session.role]}`} />
          {session.role === 'manager' ? 'Requirements Manager' : 'Reviewer'}
        </div>
      )}
      <div className={styles.footer}>REQMGR v2.0<br />Industrial Edition</div>
    </nav>
  );
}

function Ico({ children, className }) {
  return <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">{children}</svg>;
}
function OverviewIcon(p)  { return <Ico {...p}><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></Ico>; }
function AllReqsIcon(p)   { return <Ico {...p}><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 6h6M5 9h4M5 12h2"/></Ico>; }
function SystemIcon(p)    { return <Ico {...p}><polygon points="8,1 15,5 15,11 8,15 1,11 1,5"/></Ico>; }
function HardwareIcon(p)  { return <Ico {...p}><rect x="1" y="4" width="14" height="9" rx="1.5"/><path d="M4 4V3M7 4V3M10 4V3M13 4V3M5 13v1M11 13v1"/></Ico>; }
function SoftwareIcon(p)  { return <Ico {...p}><polyline points="3,5 1,8 3,11"/><polyline points="13,5 15,8 13,11"/><line x1="9" y1="3" x2="7" y2="13"/></Ico>; }
function MechIcon(p)      { return <Ico {...p}><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></Ico>; }
function TraceIcon(p)     { return <Ico {...p}><circle cx="3" cy="3" r="2"/><circle cx="13" cy="8" r="2"/><circle cx="3" cy="13" r="2"/><path d="M5 3h4l4 5M5 13h4l-4-5"/></Ico>; }
function DiagramIcon(p)   { return <Ico {...p}><rect x="1" y="6" width="4" height="4" rx="1"/><rect x="6" y="1" width="4" height="4" rx="1"/><rect x="11" y="6" width="4" height="4" rx="1"/><rect x="6" y="11" width="4" height="4" rx="1"/><path d="M5 8h1M10 8h1M8 5v1M8 11v-1"/></Ico>; }
