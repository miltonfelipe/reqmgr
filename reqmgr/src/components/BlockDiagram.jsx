// ── components/BlockDiagram.js ───────────────────────
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BLOCK_COLORS } from '../store/db';
import { Btn } from './UI';
import styles from './BlockDiagram.module.css';

const MODES = ['select', 'add', 'connect', 'pan'];
const MODE_HINTS = {
  select:  'Click to select. Drag blocks to reposition. Click arrows to select them.',
  add:     'Click anywhere on the canvas to place a new block.',
  connect: 'Click the source block, then click the target block.',
  pan:     'Drag to pan the canvas view.',
};

export function BlockDiagram({ project, onSave, isManager }) {
  const [blocks,   setBlocks]   = useState(() => project?.diagramBlocks ?? {});
  const [conns,    setConns]    = useState(() => project?.diagramConns  ?? []);
  const [blockIdC, setBic]      = useState(() => project?.blockIdC ?? 0);
  const [connIdC,  setCic]      = useState(() => project?.connIdC  ?? 0);
  const [mode,     setMode]     = useState('select');
  const [selBlock, setSelBlock] = useState(null);
  const [selConn,  setSelConn]  = useState(null);
  const [connSrc,  setConnSrc]  = useState(null);

  const canvasRef  = useRef(null);
  const dragRef    = useRef(null);
  const resizeRef  = useRef(null);
  const panRef     = useRef(null);

  useEffect(() => {
    setBlocks(project?.diagramBlocks ?? {});
    setConns(project?.diagramConns   ?? []);
    setBic(project?.blockIdC ?? 0);
    setCic(project?.connIdC  ?? 0);
  }, [project?.diagramBlocks, project?.diagramConns]); // eslint-disable-line

  const persist = useCallback((b, c, bic, cic) => {
    onSave(b, c, bic, cic);
  }, [onSave]);

  // ── Block add ────────────────────────────────────
  function addBlock(x, y) {
    const id = blockIdC + 1;
    const nb = { id, x, y, w: 160, title: 'Subsystem ' + id, description: '', colorIdx: id % BLOCK_COLORS.length };
    const next = { ...blocks, [id]: nb };
    setBlocks(next); setBic(id); setSelBlock(id); setSelConn(null);
    persist(next, conns, id, connIdC);
  }

  function deleteBlock(id) {
    const next = { ...blocks }; delete next[id];
    const nc = conns.filter(c => c.from !== id && c.to !== id);
    setBlocks(next); setConns(nc);
    if (selBlock === id) setSelBlock(null);
    persist(next, nc, blockIdC, connIdC);
  }

  // ── Connection ───────────────────────────────────
  function handleConnectBlock(id) {
    if (connSrc === null) {
      setConnSrc(id); setSelBlock(id);
    } else if (connSrc === id) {
      setConnSrc(null); setSelBlock(null);
    } else {
      if (!conns.find(c => c.from === connSrc && c.to === id)) {
        const cid = connIdC + 1;
        const nc  = [...conns, { id: cid, from: connSrc, to: id, label: '' }];
        setConns(nc); setCic(cid);
        persist(blocks, nc, blockIdC, cid);
      }
      setConnSrc(null); setSelBlock(null);
    }
  }

  function deleteConn(cid) {
    const nc = conns.filter(c => c.id !== cid);
    setConns(nc); setSelConn(null);
    persist(blocks, nc, blockIdC, connIdC);
  }

  // ── Canvas events ────────────────────────────────
  function onCanvasClick(e) {
    if (mode === 'add' && isManager) {
      const r = canvasRef.current.getBoundingClientRect();
      addBlock(Math.max(0, e.clientX - r.left - 80), Math.max(0, e.clientY - r.top - 50));
    } else if (mode === 'select') {
      if (e.target === canvasRef.current || e.target.tagName === 'svg' || e.target.tagName === 'SVG') {
        setSelBlock(null); setSelConn(null);
      }
    }
  }

  function onCanvasMouseDown(e) {
    if (mode === 'pan') panRef.current = { startX: e.clientX, startY: e.clientY };
  }

  function onCanvasMouseMove(e) {
    if (resizeRef.current) {
      const { id, startW, startX } = resizeRef.current;
      const newW = Math.max(120, startW + e.clientX - startX);
      setBlocks(prev => ({ ...prev, [id]: { ...prev[id], w: newW } }));
      return;
    }
    if (dragRef.current) {
      const { id, ox, oy } = dragRef.current;
      const r = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, e.clientX - r.left - ox);
      const y = Math.max(0, e.clientY - r.top  - oy);
      setBlocks(prev => ({ ...prev, [id]: { ...prev[id], x, y } }));
    }
  }

  function onCanvasMouseUp() {
    if (dragRef.current || resizeRef.current) persist(blocks, conns, blockIdC, connIdC);
    dragRef.current = null; resizeRef.current = null; panRef.current = null;
  }

  function onBlockMouseDown(id, e) {
    if (e.target.dataset.resize)                 { resizeRef.current = { id, startW: blocks[id].w || 160, startX: e.clientX }; return; }
    if (e.target.closest('[data-colorpick]'))    return;
    if (e.target.closest('[data-delete]'))       return;
    if (e.target.contentEditable === 'true')     return;
    if (mode === 'connect' && isManager)         { handleConnectBlock(id); e.stopPropagation(); return; }
    if (mode === 'select' || mode === 'add') {
      setSelBlock(id); setSelConn(null);
      const el = document.getElementById('db-' + id);
      const r  = el.getBoundingClientRect();
      dragRef.current = { id, ox: e.clientX - r.left, oy: e.clientY - r.top };
      e.stopPropagation();
    }
  }

  function updateBlockField(id, field, val) {
    const next = { ...blocks, [id]: { ...blocks[id], [field]: val } };
    setBlocks(next); persist(next, conns, blockIdC, connIdC);
  }

  function autoLayout() {
    const arr  = Object.values(blocks);
    if (!arr.length) return;
    const cols = Math.max(1, Math.ceil(Math.sqrt(arr.length)));
    const next = { ...blocks };
    arr.forEach((b, i) => { next[b.id] = { ...b, x: 40 + (i % cols) * 200, y: 40 + Math.floor(i / cols) * 150 }; });
    setBlocks(next); persist(next, conns, blockIdC, connIdC);
  }

  function clearAll() {
    if (!window.confirm('Clear all blocks and connections?')) return;
    setBlocks({}); setConns([]); setBic(0); setCic(0); setSelBlock(null); setSelConn(null);
    persist({}, [], 0, 0);
  }

  // ── Arrow geometry ───────────────────────────────
  function edgePoint(bid, toId) {
    const b = blocks[bid]; const tb = blocks[toId];
    if (!b || !tb) return { x: 0, y: 0 };
    const el   = document.getElementById('db-' + bid);
    const toEl = document.getElementById('db-' + toId);
    if (!el || !toEl) return { x: 0, y: 0 };
    const cx = b.x + (b.w || 160) / 2, cy = b.y + el.offsetHeight / 2;
    const tx = tb.x + (tb.w || 160) / 2, ty = tb.y + toEl.offsetHeight / 2;
    const dx = tx - cx, dy = ty - cy;
    const hw = (b.w || 160) / 2 + 4, hh = el.offsetHeight / 2 + 4;
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return { x: cx, y: cy };
    const s = Math.min(hw / Math.abs(dx), hh / Math.abs(dy));
    return { x: cx + dx * s, y: cy + dy * s };
  }

  const deleteSelected = useCallback(() => {
    if (selBlock !== null) deleteBlock(selBlock);
    else if (selConn !== null) deleteConn(selConn);
  }, [selBlock, selConn, blocks, conns]); // eslint-disable-line

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Delete' && document.activeElement === document.body) deleteSelected();
      if (e.key === 'Escape') { setSelBlock(null); setSelConn(null); setConnSrc(null); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected]);

  function countReqs(bid) {
    if (!project) return 0;
    return ['system','hardware','software','mechanical'].reduce((n, c) =>
      n + (project.requirements[c] ?? []).filter(r => String(r.subsystem) === String(bid)).length, 0);
  }

  // Restrict editing modes for reviewers
  const editModes   = isManager ? MODES : ['select', 'pan'];
  const cursorClass = { select:'', add: styles.cursorCross, connect: styles.cursorCell, pan: styles.cursorGrab }[mode] || '';

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Block Diagram Editor</div>
          <div className={styles.sub}>Define subsystems and their interconnections</div>
        </div>
        {isManager && (
          <div className={styles.headerActions}>
            <Btn size="sm" onClick={autoLayout}>Auto-layout</Btn>
            <Btn size="sm" variant="danger" onClick={clearAll}>Clear all</Btn>
          </div>
        )}
      </div>

      <div className={styles.toolbar}>
        {editModes.map(m => (
          <button key={m}
            className={`${styles.modeBtn} ${mode === m ? styles.modeBtnActive : ''}`}
            onClick={() => { setMode(m); setConnSrc(null); }}>
            <ModeIcon m={m} />{m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
        <span className={styles.hint}>{MODE_HINTS[mode]}</span>
        {isManager && (
          <Btn size="sm" variant="danger"
            disabled={selBlock === null && selConn === null}
            onClick={deleteSelected}
            style={{ marginLeft: 'auto' }}>
            Delete selected
          </Btn>
        )}
      </div>

      <div
        ref={canvasRef}
        className={`${styles.canvas} ${cursorClass}`}
        onClick={onCanvasClick}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
      >
        <svg className={styles.svg}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1 1.5L8.5 5L1 8.5" fill="none" stroke="#35496a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
            <marker id="arr-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1 1.5L8.5 5L1 8.5" fill="none" stroke="#3b8bff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
          </defs>
          {conns.map(conn => {
            const p1  = edgePoint(conn.from, conn.to);
            const p2  = edgePoint(conn.to,   conn.from);
            const sel = selConn === conn.id;
            return (
              <line key={conn.id}
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={sel ? '#3b8bff' : '#35496a'} strokeWidth="1.5" fill="none"
                markerEnd={sel ? 'url(#arr-sel)' : 'url(#arr)'}
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                onClick={e => { e.stopPropagation(); setSelConn(conn.id); setSelBlock(null); }}
              />
            );
          })}
        </svg>

        {Object.values(blocks).map(b => {
          const col  = BLOCK_COLORS[b.colorIdx ?? 0];
          const isSel = selBlock === b.id;
          const isSrc = connSrc  === b.id;
          const rn    = countReqs(b.id);
          return (
            <div key={b.id} id={'db-' + b.id}
              className={`${styles.block} ${isSel ? styles.blockSelected : ''} ${isSrc ? styles.blockSrc : ''}`}
              style={{ left: b.x, top: b.y, width: b.w || 160, borderColor: col.border, background: col.bg }}
              onMouseDown={e => onBlockMouseDown(b.id, e)}
            >
              <div className={styles.blockHead}>
                <span className={styles.blockId} style={{ color: col.text, opacity: 0.6 }}>BLK-{String(b.id).padStart(3,'0')}</span>
                <span className={styles.blockCat} style={{ color: col.text, opacity: 0.5 }}>{col.name}</span>
              </div>
              <div className={styles.blockBody}>
                <div className={styles.blockName} contentEditable={isManager} suppressContentEditableWarning
                  style={{ color: col.text, cursor: isManager ? 'text' : 'default' }}
                  onBlur={isManager ? e => updateBlockField(b.id, 'title', e.target.innerText.trim()) : undefined}
                  data-ph="Block name">{b.title || ''}</div>
                <div className={styles.blockDesc} contentEditable={isManager} suppressContentEditableWarning
                  style={{ cursor: isManager ? 'text' : 'default' }}
                  onBlur={isManager ? e => updateBlockField(b.id, 'description', e.target.innerText.trim()) : undefined}
                  data-ph="Description">{b.description || ''}</div>
                {rn > 0 && <div className={styles.blockReqCount} style={{ color: col.text, opacity: 0.6 }}>● {rn} req linked</div>}
              </div>
              {isManager && (
                <div className={styles.blockFoot}>
                  {BLOCK_COLORS.map((c, i) => (
                    <div key={i} data-colorpick="true"
                      className={`${styles.colorDot} ${b.colorIdx === i ? styles.colorDotActive : ''}`}
                      style={{ background: c.border }}
                      onClick={e => { e.stopPropagation(); updateBlockField(b.id, 'colorIdx', i); }}
                    />
                  ))}
                  <div data-delete="true" className={styles.delBlock}
                    onClick={e => { e.stopPropagation(); deleteBlock(b.id); }}>✕</div>
                </div>
              )}
              {isManager && <div data-resize="true" className={styles.resizeHandle} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModeIcon({ m }) {
  const p = { width: 12, height: 12 };
  if (m === 'select')  return <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2l10 5.5L9 9l-1.5 5L3 2z"/></svg>;
  if (m === 'add')     return <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>;
  if (m === 'connect') return <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="3" cy="8" r="2"/><circle cx="13" cy="8" r="2"/><path d="M5 8h6"/></svg>;
  if (m === 'pan')     return <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v3M8 11v3M2 8h3M11 8h3"/></svg>;
  return null;
}
