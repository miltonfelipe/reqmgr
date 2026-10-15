// ── components/TraceabilityMatrix.js ─────────────────
// Interactive traceability matrix.
// Rows  = source requirements (from any category)
// Cols  = target requirements (from any category)
// Cells = trace relationship type(s)
// Managers can click cells to add/remove traces.
// Color-coded by trace type. Hover shows tooltip.

import React, { useState, useMemo } from 'react';
import { CATEGORIES, CAT_META, TRACE_TYPES, getAllReqs } from '../store/db';
import { Btn } from './UI';
import styles from './TraceabilityMatrix.module.css';

const TYPE_KEYS = Object.keys(TRACE_TYPES);

export function TraceabilityMatrix({ project, isManager, onAddTrace, onRemoveTrace }) {
  const [rowFilter,    setRowFilter]    = useState('');
  const [colFilter,    setColFilter]    = useState('');
  const [rowCats,      setRowCats]      = useState(new Set(CATEGORIES));
  const [colCats,      setColCats]      = useState(new Set(CATEGORIES));
  const [addTraceType, setAddTraceType] = useState('derives');
  const [tooltip,      setTooltip]      = useState(null); // { x, y, content }
  const [highlight,    setHighlight]    = useState(null); // reqId to highlight row+col

  if (!project) return null;

  const allReqs = useMemo(() => getAllReqs(project), [project]);

  // Row set: reqs that have at least one trace OR are selected for rows
  // We show all reqs in selected categories for rows
  const rowReqs = useMemo(() => allReqs
    .filter(r => rowCats.has(r._cat))
    .filter(r => !rowFilter || r.id.toLowerCase().includes(rowFilter.toLowerCase()) || (r.title??'').toLowerCase().includes(rowFilter.toLowerCase()))
  , [allReqs, rowCats, rowFilter]);

  const colReqs = useMemo(() => allReqs
    .filter(r => colCats.has(r._cat))
    .filter(r => !colFilter || r.id.toLowerCase().includes(colFilter.toLowerCase()) || (r.title??'').toLowerCase().includes(colFilter.toLowerCase()))
  , [allReqs, colCats, colFilter]);

  // Build trace lookup: fromId -> { toId -> type }
  const traceMap = useMemo(() => {
    const map = {};
    allReqs.forEach(r => {
      (r.traces ?? []).forEach(t => {
        if (!map[r.id]) map[r.id] = {};
        map[r.id][t.toId] = t.type;
      });
    });
    return map;
  }, [allReqs]);

  // Stats
  const totalTraces = useMemo(() =>
    allReqs.reduce((n, r) => n + (r.traces ?? []).length, 0)
  , [allReqs]);

  const uncoveredRows = useMemo(() =>
    rowReqs.filter(r => !(r.traces ?? []).length && !allReqs.some(x => (x.traces??[]).some(t=>t.toId===r.id)))
  , [rowReqs, allReqs]);

  function handleCellClick(rowReq, colReq) {
    if (!isManager) return;
    if (rowReq.id === colReq.id) return; // no self-trace
    const existing = (traceMap[rowReq.id] ?? {})[colReq.id];
    if (existing) {
      onRemoveTrace(rowReq._cat, rowReq.id, colReq.id);
    } else {
      onAddTrace(rowReq._cat, rowReq.id, colReq.id, addTraceType);
    }
  }

  function toggleCat(set, setFn, cat) {
    const next = new Set(set);
    if (next.has(cat)) { if (next.size > 1) next.delete(cat); }
    else next.add(cat);
    setFn(next);
  }

  // Limit cols to avoid extreme render cost
  const MAX_COLS = 60;
  const visibleCols = colReqs.slice(0, MAX_COLS);
  const truncated   = colReqs.length > MAX_COLS;

  return (
    <div className={styles.panel}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Traceability Matrix</div>
          <div className={styles.sub}>
            {totalTraces} trace link{totalTraces !== 1 ? 's' : ''} · {uncoveredRows.length} row req{uncoveredRows.length !== 1 ? 's' : ''} without traces
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Rows</span>
          <div className={styles.catToggles}>
            {CATEGORIES.map(c => (
              <button key={c}
                className={`${styles.catBtn} ${rowCats.has(c) ? styles.catBtnActive : ''}`}
                style={rowCats.has(c) ? { borderColor: CAT_META[c].color, color: CAT_META[c].color } : {}}
                onClick={() => toggleCat(rowCats, setRowCats, c)}>
                {CAT_META[c].prefix}
              </button>
            ))}
          </div>
          <input className={styles.matFilter} placeholder="Filter rows…"
            value={rowFilter} onChange={e => setRowFilter(e.target.value)} />
        </div>

        <div className={styles.controlDivider} />

        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Columns</span>
          <div className={styles.catToggles}>
            {CATEGORIES.map(c => (
              <button key={c}
                className={`${styles.catBtn} ${colCats.has(c) ? styles.catBtnActive : ''}`}
                style={colCats.has(c) ? { borderColor: CAT_META[c].color, color: CAT_META[c].color } : {}}
                onClick={() => toggleCat(colCats, setColCats, c)}>
                {CAT_META[c].prefix}
              </button>
            ))}
          </div>
          <input className={styles.matFilter} placeholder="Filter columns…"
            value={colFilter} onChange={e => setColFilter(e.target.value)} />
        </div>

        {isManager && (
          <>
            <div className={styles.controlDivider} />
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Add as</span>
              <select className={styles.typeSelect} value={addTraceType} onChange={e => setAddTraceType(e.target.value)}>
                {TYPE_KEYS.map(k => (
                  <option key={k} value={k}>{TRACE_TYPES[k].label}</option>
                ))}
              </select>
              <span className={styles.controlHint}>Click cell to toggle trace</span>
            </div>
          </>
        )}

        <div className={styles.legendGroup}>
          {TYPE_KEYS.map(k => (
            <div key={k} className={styles.legendItem}>
              <div className={styles.legendCell} style={{ background: TRACE_TYPES[k].color + '33', borderColor: TRACE_TYPES[k].color }}>
                {TRACE_TYPES[k].short}
              </div>
              <span className={styles.legendLabel}>{TRACE_TYPES[k].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Matrix ── */}
      <div className={styles.matrixWrap}>
        {rowReqs.length === 0 || visibleCols.length === 0 ? (
          <div className={styles.emptyMatrix}>
            <p>No requirements to display. Select categories and check that requirements exist.</p>
          </div>
        ) : (
          <div className={styles.matrixScroll}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  {/* Corner cell */}
                  <th className={styles.cornerCell}>
                    <span className={styles.cornerRows}>ROWS ↓</span>
                    <span className={styles.cornerCols}>COLS →</span>
                  </th>
                  {visibleCols.map(col => (
                    <th key={col.id}
                      className={`${styles.colHeader} ${highlight === col.id ? styles.highlighted : ''}`}
                      onMouseEnter={() => setHighlight(col.id)}
                      onMouseLeave={() => setHighlight(null)}
                    >
                      <div className={styles.colHeaderInner}>
                        <span className={styles.colCat} style={{ color: CAT_META[col._cat]?.color }}>
                          {CAT_META[col._cat]?.prefix}
                        </span>
                        <span className={styles.colId}>{col.id}</span>
                        <span className={styles.colTitle}>{col.title}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowReqs.map(row => {
                  const rowTraces  = traceMap[row.id] ?? {};
                  const hasAny     = Object.keys(rowTraces).length > 0;
                  const isHlRow    = highlight === row.id;
                  return (
                    <tr key={row.id}
                      onMouseEnter={() => setHighlight(row.id)}
                      onMouseLeave={() => setHighlight(null)}
                    >
                      {/* Row header */}
                      <td className={`${styles.rowHeader} ${isHlRow ? styles.highlighted : ''} ${!hasAny ? styles.rowUncovered : ''}`}>
                        <div className={styles.rowHeaderInner}>
                          <span className={styles.rowCat} style={{ color: CAT_META[row._cat]?.color }}>
                            {CAT_META[row._cat]?.prefix}
                          </span>
                          <span className={styles.rowId}>{row.id}</span>
                          <span className={styles.rowTitle}>{row.title}</span>
                          {!hasAny && <span className={styles.uncoveredTag}>no traces</span>}
                        </div>
                      </td>

                      {/* Cells */}
                      {visibleCols.map(col => {
                        if (row.id === col.id) {
                          // Diagonal
                          return (
                            <td key={col.id}
                              className={`${styles.cell} ${styles.cellDiag} ${highlight === col.id || isHlRow ? styles.cellHl : ''}`}
                            >
                              <div className={styles.cellDiagInner} />
                            </td>
                          );
                        }
                        const traceType = rowTraces[col.id];
                        const meta      = traceType ? TRACE_TYPES[traceType] : null;
                        const isHlCol   = highlight === col.id;
                        return (
                          <td key={col.id}
                            className={`${styles.cell} ${traceType ? styles.cellFilled : ''} ${isHlCol || isHlRow ? styles.cellHl : ''} ${isManager ? styles.cellClickable : ''}`}
                            style={meta ? { background: meta.color + '22', borderColor: meta.color + '66' } : {}}
                            onClick={() => handleCellClick(row, col)}
                            onMouseEnter={e => {
                              if (traceType) setTooltip({ x: e.clientX, y: e.clientY, content: {
                                from: row.id, fromTitle: row.title,
                                to: col.id, toTitle: col.title,
                                type: TRACE_TYPES[traceType].label,
                                color: TRACE_TYPES[traceType].color,
                              }});
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {meta && (
                              <div className={styles.cellChip} style={{ background: meta.color + '33', color: meta.color }}>
                                {meta.short}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {truncated && (
              <div className={styles.truncateNote}>
                Showing first {MAX_COLS} of {colReqs.length} columns. Use category or text filters to narrow the view.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div className={styles.tooltip} style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <div className={styles.ttType} style={{ color: tooltip.content.color }}>
            {tooltip.content.type}
          </div>
          <div className={styles.ttRow}>
            <span className={styles.ttKey}>From</span>
            <span className={styles.ttVal}><strong>{tooltip.content.from}</strong> {tooltip.content.fromTitle}</span>
          </div>
          <div className={styles.ttRow}>
            <span className={styles.ttKey}>To</span>
            <span className={styles.ttVal}><strong>{tooltip.content.to}</strong> {tooltip.content.toTitle}</span>
          </div>
          {isManager && <div className={styles.ttHint}>Click to remove</div>}
        </div>
      )}
    </div>
  );
}
