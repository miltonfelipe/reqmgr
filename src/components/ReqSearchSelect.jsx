// ── components/ReqSearchSelect.jsx ───────────────────
// Searchable dropdown that lists all requirements (ID + title),
// grouped by category. Used in the traceability section of
// RequirementModal to pick a target requirement.

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CATEGORIES, CAT_META } from '../store/db';
import styles from './ReqSearchSelect.module.css';

export function ReqSearchSelect({ project, excludeId, value, onChange, placeholder }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Open → focus the search input
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else      setSearch('');
  }, [open]);

  // Build grouped options: { category -> req[] }, filtered by search
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATEGORIES.map(cat => {
      const reqs = (project?.requirements[cat] ?? [])
        .filter(r => r.id !== excludeId)
        .filter(r => {
          if (!q) return true;
          return (
            r.id.toLowerCase().includes(q) ||
            (r.title ?? '').toLowerCase().includes(q) ||
            (r.statement ?? '').toLowerCase().includes(q)
          );
        });
      return { cat, reqs };
    }).filter(g => g.reqs.length > 0);
  }, [project, excludeId, search]);

  // Total visible options
  const totalVisible = grouped.reduce((n, g) => n + g.reqs.length, 0);

  // Resolve current selection for the trigger label
  const selectedReq = useMemo(() => {
    if (!value) return null;
    for (const cat of CATEGORIES) {
      const r = (project?.requirements[cat] ?? []).find(r => r.id === value);
      if (r) return r;
    }
    return null;
  }, [value, project]);

  function select(req) {
    onChange(req.id);
    setOpen(false);
    setSearch('');
  }

  function clear(e) {
    e.stopPropagation();
    onChange('');
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {/* Trigger */}
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {selectedReq ? (
          <span className={styles.triggerSelected}>
            <span className={styles.triggerCat}
              style={{ color: CAT_META[
                CATEGORIES.find(c =>
                  (project?.requirements[c] ?? []).some(r => r.id === selectedReq.id)
                )
              ]?.color }}>
              {CATEGORIES.find(c =>
                (project?.requirements[c] ?? []).some(r => r.id === selectedReq.id)
              ) && CAT_META[
                CATEGORIES.find(c =>
                  (project?.requirements[c] ?? []).some(r => r.id === selectedReq.id)
                )
              ].prefix}
            </span>
            <span className={styles.triggerId}>{selectedReq.id}</span>
            <span className={styles.triggerTitle}>{selectedReq.title}</span>
          </span>
        ) : (
          <span className={styles.triggerPlaceholder}>
            {placeholder ?? '— select requirement —'}
          </span>
        )}
        <span className={styles.triggerIcons}>
          {selectedReq && (
            <span className={styles.clearBtn} onClick={clear} title="Clear">×</span>
          )}
          <svg
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.8"
            width="10" height="6"
          >
            <path d="M1 1l4 4 4-4"/>
          </svg>
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className={styles.dropdown}>
          {/* Search box */}
          <div className={styles.searchWrap}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
              width="13" height="13" className={styles.searchIcon}>
              <circle cx="6.5" cy="6.5" r="4.5"/>
              <path d="M10 10l3.5 3.5"/>
            </svg>
            <input
              ref={inputRef}
              className={styles.searchInput}
              placeholder="Search by ID or title…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>
            )}
          </div>

          {/* Options */}
          <div className={styles.options}>
            {totalVisible === 0 ? (
              <div className={styles.noResults}>
                {search ? `No requirements match "${search}"` : 'No requirements available'}
              </div>
            ) : (
              grouped.map(({ cat, reqs }) => {
                const meta = CAT_META[cat];
                return (
                  <div key={cat}>
                    {/* Category header */}
                    <div className={styles.groupHeader}>
                      <span className={styles.groupDot} style={{ background: meta.color }} />
                      <span className={styles.groupLabel} style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className={styles.groupCount}>{reqs.length}</span>
                    </div>

                    {/* Requirements in this group */}
                    {reqs.map(req => {
                      const isSelected = req.id === value;
                      return (
                        <div
                          key={req.id}
                          className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                          onClick={() => select(req)}
                        >
                          <span className={styles.optionId}>{req.id}</span>
                          <span className={styles.optionTitle}>
                            {req.title || <em className={styles.optionNoTitle}>No title</em>}
                          </span>
                          {req.status && (
                            <span className={`${styles.optionStatus} ${styles['s-' + req.status]}`}>
                              {req.status}
                            </span>
                          )}
                          {isSelected && (
                            <svg viewBox="0 0 12 10" fill="none" stroke="currentColor"
                              strokeWidth="2" width="12" height="10" className={styles.checkIcon}>
                              <path d="M1 5l3.5 3.5L11 1"/>
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer hint */}
          <div className={styles.dropFooter}>
            {totalVisible} requirement{totalVisible !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ' available'}
          </div>
        </div>
      )}
    </div>
  );
}
