(function () {
const { useState, useEffect, useRef } = React;
const PAGE_W = 612;
const PAGE_H = 792;
const SNAP_PT = 4; // alignment-guide snap threshold in pts

// ── Alignment guide computation ────────────────────────────────────────────────
function computeGuides(nx, ny, w, h, allFields, selfId) {
  const vSet = new Set(), hSet = new Set();
  const cx = nx + w / 2, cy = ny + h / 2;
  const rx = nx + w,     by = ny + h;
  allFields.forEach((f) => {
    if (f.id === selfId) return;
    [f.x, f.x + f.w / 2, f.x + f.w].forEach((gx) => {
      if (Math.abs(nx - gx) < SNAP_PT || Math.abs(cx - gx) < SNAP_PT || Math.abs(rx - gx) < SNAP_PT) vSet.add(gx);
    });
    [f.y, f.y + f.h / 2, f.y + f.h].forEach((gy) => {
      if (Math.abs(ny - gy) < SNAP_PT || Math.abs(cy - gy) < SNAP_PT || Math.abs(by - gy) < SNAP_PT) hSet.add(gy);
    });
  });
  return { v: [...vSet], h: [...hSet] };
}

// ── Rulers ─────────────────────────────────────────────────────────────────────
function RulerH({ width, zoom }) {
  const step = zoom >= 1.5 ? 25 : zoom >= 0.75 ? 50 : 100;
  const marks = [];
  for (let pt = 0; pt <= PAGE_W; pt += step) {
    const px = pt * zoom;
    const major = pt % (step * 2) === 0;
    marks.push(
      <g key={pt}>
        <line x1={px} y1={major ? 6 : 12} x2={px} y2={20} stroke="#cbd5e1" strokeWidth={0.5} />
        {major && <text x={px + 2} y={10} fontSize={7} fill="#94a3b8">{pt}</text>}
      </g>
    );
  }
  return (
    <svg style={{ display: 'block', width, height: 20, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      {marks}
    </svg>
  );
}

function RulerV({ height, zoom }) {
  const step = zoom >= 1.5 ? 25 : zoom >= 0.75 ? 50 : 100;
  const marks = [];
  for (let pt = 0; pt <= PAGE_H; pt += step) {
    const py = pt * zoom;
    const major = pt % (step * 2) === 0;
    marks.push(
      <g key={pt}>
        <line x1={major ? 6 : 12} y1={py} x2={20} y2={py} stroke="#cbd5e1" strokeWidth={0.5} />
        {major && <text fontSize={7} fill="#94a3b8" transform={`translate(2,${py - 2}) rotate(-90)`}>{pt}</text>}
      </g>
    );
  }
  return (
    <svg style={{ display: 'block', width: 20, height, background: 'var(--surface-2)', borderRight: '1px solid var(--border)', flexShrink: 0 }}>
      {marks}
    </svg>
  );
}

// ── Grid overlay ───────────────────────────────────────────────────────────────
function GridOverlay({ width, height, zoom }) {
  const sp = Math.max(5, 10 * zoom);
  const id = `g${Math.round(zoom * 100)}`;
  return (
    <svg style={{ position: 'absolute', inset: 0, width, height, pointerEvents: 'none', opacity: 0.4 }} aria-hidden="true">
      <defs>
        <pattern id={id} width={sp} height={sp} patternUnits="userSpaceOnUse">
          <path d={`M ${sp} 0 L 0 0 0 ${sp}`} fill="none" stroke="#c4c9d4" strokeWidth={0.5} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#${id})`} />
    </svg>
  );
}

// ── Field content ──────────────────────────────────────────────────────────────
function FieldContent({ field, zoom }) {
  const { kind, w, h } = field;
  const hPx = h * zoom;
  const fs = Math.max(7, (field.fontSize || 11) * zoom);
  const textBase = {
    width: '100%', height: '100%', overflow: 'hidden',
    fontSize: fs, fontWeight: field.bold ? 700 : 400,
    fontStyle: field.italic ? 'italic' : 'normal',
    textDecoration: field.underline ? 'underline' : 'none',
    color: field.color || '#374151',
    display: 'flex', alignItems: 'center',
    justifyContent: field.align === 'center' ? 'center' : field.align === 'right' ? 'flex-end' : 'flex-start',
    lineHeight: 1.25, padding: '1px 2px',
  };

  switch (kind) {
    case 'bound':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', padding: '1px 2px' }}>
          <div style={{ flexShrink: 0, width: Math.max(10, 14 * zoom), height: Math.max(10, 14 * zoom),
            borderRadius: 3, background: 'rgba(79,70,229,.12)', color: '#4f46e5',
            display: 'grid', placeItems: 'center' }}>
            <Icon name="hash" size={Math.max(7, 9 * zoom)} />
          </div>
          <div className="mono" style={{ ...textBase, padding: 0, flex: 1, color: '#4338ca' }}>
            {'{{'}{field.bind}{'}}'}
          </div>
        </div>
      );

    case 'text':
    case 'heading':
      return <div style={textBase}>{field.text || (kind === 'heading' ? 'Heading' : 'Text block')}</div>;

    case 'divider':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
          <hr style={{ width: '100%', margin: 0, border: 'none',
            borderTop: `${Math.max(0.5, (field.thickness || 1) * zoom)}px solid ${field.color || '#d1d5db'}` }} />
        </div>
      );

    case 'rect':
      return (
        <div style={{
          width: '100%', height: '100%', boxSizing: 'border-box',
          background: field.fill || '#f3f4f6',
          border: field.stroke ? `${Math.max(0.5, (field.strokeWidth || 1) * zoom)}px solid ${field.stroke}` : 'none',
          borderRadius: (field.borderRadius || 0) * zoom,
        }} />
      );

    case 'image':
      return field.url
        ? <img src={field.url} alt="" style={{ width: '100%', height: '100%', objectFit: field.objectFit || 'contain', display: 'block' }} />
        : (
          <div style={{ width: '100%', height: '100%', background: '#f8fafc', border: '1px dashed #cbd5e1',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#94a3b8' }}>
            <Icon name="image" size={Math.min(24, hPx * 0.45)} />
            {hPx > 36 && <span style={{ fontSize: Math.max(8, 9 * zoom) }}>Image</span>}
          </div>
        );

    case 'signature':
      return (
        <div style={{ width: '100%', height: '100%', background: '#fafafa', border: '1px dashed #cbd5e1',
          borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 4, color: '#94a3b8' }}>
          <Icon name="pen" size={Math.min(20, hPx * 0.4)} />
          {hPx > 36 && <span style={{ fontSize: Math.max(8, 9 * zoom) }}>{field.label || 'Signature'}</span>}
        </div>
      );

    case 'checkbox': {
      const size = Math.max(8, Math.min(w * zoom, hPx) - 2);
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: size, height: size, border: `${Math.max(1, 1.5 * zoom)}px solid #6b7280`,
            borderRadius: 2, background: field.checked ? '#4f46e5' : '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            {field.checked && <Icon name="check" size={size * 0.65} style={{ color: '#fff' }} />}
          </div>
        </div>
      );
    }

    case 'qr':
      return (
        <div style={{ width: '100%', height: '100%', background: '#f9fafb', border: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', overflow: 'hidden' }}>
          <Icon name="qr" size={Math.min(w * zoom, hPx) * 0.6} />
        </div>
      );

    case 'page-number':
      return (
        <div style={{ ...textBase, color: field.color || '#9ca3af' }}>
          {(field.format || 'Page {{page}} of {{total}}')
            .replace('{{page}}', '1').replace('{{total}}', '1')}
        </div>
      );

    default:
      return <div style={{ width: '100%', height: '100%', background: '#e5e7eb', borderRadius: 2 }} />;
  }
}

// ── Resize handles ─────────────────────────────────────────────────────────────
const HANDLES = [
  { d: 'nw', style: { top: -4,    left: -4,    cursor: 'nw-resize' } },
  { d: 'n',  style: { top: -4,    left: '50%', cursor: 'n-resize',  transform: 'translateX(-50%)' } },
  { d: 'ne', style: { top: -4,    right: -4,   cursor: 'ne-resize' } },
  { d: 'e',  style: { top: '50%', right: -4,   cursor: 'e-resize',  transform: 'translateY(-50%)' } },
  { d: 'se', style: { bottom: -4, right: -4,   cursor: 'se-resize' } },
  { d: 's',  style: { bottom: -4, left: '50%', cursor: 's-resize',  transform: 'translateX(-50%)' } },
  { d: 'sw', style: { bottom: -4, left: -4,    cursor: 'sw-resize' } },
  { d: 'w',  style: { top: '50%', left: -4,    cursor: 'w-resize',  transform: 'translateY(-50%)' } },
];

function ResizeHandles({ field, zoom, onUpdate }) {
  const onHandleDown = (dir, e) => {
    e.stopPropagation();
    e.preventDefault();
    const { id, x, y, w, h } = field;
    const s = { dir, mx: e.clientX, my: e.clientY, x, y, w, h };

    const onMove = (ev) => {
      const dx = (ev.clientX - s.mx) / zoom;
      const dy = (ev.clientY - s.my) / zoom;
      let nx = s.x, ny = s.y, nw = s.w, nh = s.h;
      if (dir.includes('e')) nw = Math.max(10, s.w + dx);
      if (dir.includes('s')) nh = Math.max(4,  s.h + dy);
      if (dir.includes('w')) { nw = Math.max(10, s.w - dx); nx = s.x + (s.w - nw); }
      if (dir.includes('n')) { nh = Math.max(4,  s.h - dy); ny = s.y + (s.h - nh); }
      onUpdate(id, { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <>
      {HANDLES.map(({ d, style }) => (
        <div key={d} onPointerDown={(e) => onHandleDown(d, e)}
          style={{
            position: 'absolute', width: 8, height: 8, borderRadius: 2, zIndex: 20,
            background: '#fff', border: '1.5px solid var(--accent,#4f46e5)',
            ...style,
          }} />
      ))}
    </>
  );
}

// ── Draggable/selectable field element ─────────────────────────────────────────
function FieldEl({ field, zoom, selected, onSelect, onUpdate, setGuides, allFields }) {
  const { id, x, y, w, h } = field;

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();
    const startX = x, startY = y, startMX = e.clientX, startMY = e.clientY;
    let moved = false;

    const onMove = (ev) => {
      const dx = (ev.clientX - startMX) / zoom;
      const dy = (ev.clientY - startMY) / zoom;
      if (!moved && Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) return;
      moved = true;
      const nx = Math.max(0, Math.round(startX + dx));
      const ny = Math.max(0, Math.round(startY + dy));
      onUpdate(id, { x: nx, y: ny });
      setGuides(computeGuides(nx, ny, w, h, allFields, id));
    };
    const onUp = () => {
      setGuides({ v: [], h: [] });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        left: x * zoom, top: y * zoom,
        width: w * zoom, height: h * zoom,
        cursor: 'move', userSelect: 'none',
        outline: selected ? '1.5px solid var(--accent,#4f46e5)' : 'none',
        outlineOffset: 1,
        zIndex: selected ? 10 : 1,
      }}>
      <FieldContent field={field} zoom={zoom} />
      {selected && <ResizeHandles field={field} zoom={zoom} onUpdate={onUpdate} setGuides={setGuides} allFields={allFields} />}
    </div>
  );
}

// ── Individual page canvas ─────────────────────────────────────────────────────
function PageCanvas({ tweaks, pageNum, fields, allFields, setFields, selection, setSelection,
  zoom, updateField, dropHover, backgroundUrl }) {
  const W = PAGE_W * zoom;
  const H = PAGE_H * zoom;
  const [guides, setGuides] = useState({ v: [], h: [] });

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      <div>
        {tweaks.showRulers && <RulerH width={W} zoom={zoom} />}
        <div style={{ display: 'flex' }}>
          {tweaks.showRulers && <RulerV height={H} zoom={zoom} />}

          <div data-page-num={pageNum}
            style={{
              width: W, height: H, position: 'relative', background: '#fff', flexShrink: 0,
              boxShadow: '0 2px 16px rgba(0,0,0,.14)',
              outline: dropHover ? '2.5px dashed var(--accent,#4f46e5)' : 'none',
              overflow: 'hidden',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelection(null); }}>

            {backgroundUrl && (
              <img src={backgroundUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
            )}

            {tweaks.showGrid && <GridOverlay width={W} height={H} zoom={zoom} />}

            <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: Math.max(7, 9 * zoom),
              color: '#d1d5db', pointerEvents: 'none', userSelect: 'none', fontFamily: 'monospace' }}>
              {pageNum}
            </div>

            {fields.map((f) => (
              <FieldEl key={f.id} field={f} zoom={zoom}
                selected={selection === f.id}
                onSelect={() => setSelection(f.id)}
                onUpdate={updateField}
                setGuides={setGuides}
                allFields={allFields}
              />
            ))}

            {guides.v.map((gx, i) => (
              <div key={`v${i}`} style={{ position: 'absolute', left: gx * zoom - 0.5, top: 0,
                width: 1, height: H, background: '#4f46e5', opacity: 0.65, pointerEvents: 'none', zIndex: 50 }} />
            ))}
            {guides.h.map((gy, i) => (
              <div key={`h${i}`} style={{ position: 'absolute', top: gy * zoom - 0.5, left: 0,
                width: W, height: 1, background: '#4f46e5', opacity: 0.65, pointerEvents: 'none', zIndex: 50 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page thumbnail rail ────────────────────────────────────────────────────────
function PageRail({ totalPages, currentPage, onSelect, fields }) {
  return (
    <div style={{ width: 96, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface-2)',
      overflow: 'auto', padding: '16px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
          const sel = p === currentPage;
          const count = fields.filter((f) => f.page === p).length;
          return (
            <button key={p} onClick={() => onSelect(p)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 64, height: 82, background: '#fff',
                border: '1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)'),
                borderRadius: 3, boxShadow: sel ? '0 0 0 2px var(--accent-soft)' : 'var(--shadow-sm)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 6, left: 5, right: 5, height: 2, background: '#d1d5db' }} />
                <div style={{ position: 'absolute', top: 12, left: 5, width: 20, height: 1.5, background: '#9ca3af' }} />
                <div style={{ position: 'absolute', top: 28, left: 5, right: 20, height: 1, background: '#e5e7eb' }} />
                <div style={{ position: 'absolute', top: 32, left: 5, right: 28, height: 1, background: '#e5e7eb' }} />
                <div style={{ position: 'absolute', top: 36, left: 5, right: 10, height: 1, background: '#e5e7eb' }} />
                <div style={{ position: 'absolute', bottom: 8, right: 5, width: 20, height: 5, background: sel ? 'var(--accent)' : '#374151' }} />
              </div>
              <div style={{ fontSize: 10.5, color: sel ? 'var(--accent)' : 'var(--muted)', fontWeight: sel ? 600 : 500 }}>
                Page {p}{count > 0 && <span style={{ color: 'var(--muted-2)' }}> · {count}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Canvas area ────────────────────────────────────────────────────────────────
function CanvasArea({ model, fields, setFields, selection, setSelection,
  currentPage, setCurrentPage, totalPages, setTotalPages, zoom, setZoom,
  drag, setDrag, onDropField, updateField, deleteField, duplicateField, template }) {
  const viewportRef = useRef(null);
  const [hoverPage, setHoverPage] = useState(null);
  const [tweaks, setTweaks] = useState({ showRulers: false, showGrid: false });
  const toggle = (k) => setTweaks((t) => ({ ...t, [k]: !t[k] }));

  useEffect(() => {
    if (!drag) return;
    const onUp = (e) => {
      const els = document.querySelectorAll('[data-page-num]');
      let targetPage = null, targetRect = null;
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          targetPage = Number(el.dataset.pageNum);
          targetRect = r;
        }
      });
      if (targetPage != null && targetRect) onDropField(e.clientX, e.clientY, targetRect, targetPage);
      else setDrag(null);
    };
    const onMove = (e) => {
      const els = document.querySelectorAll('[data-page-num]');
      let hp = null;
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) hp = Number(el.dataset.pageNum);
      });
      setHoverPage(hp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [drag, onDropField, setDrag]);

  const tbBtn = (active) => ({
    ...btnGhost, height: 28, padding: '0 10px', fontSize: 12,
    background: active ? 'var(--accent-soft)' : undefined,
    color: active ? 'var(--accent)' : undefined,
  });

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' }}>
      {/* Toolbar */}
      <div style={{ height: 40, flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', whiteSpace: 'nowrap', minWidth: 0 }}>

        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-2)' }}>
          <button onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)))}
            style={{ width: 28, height: 26, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
            <Icon name="zoom-out" size={13} />
          </button>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-2)', minWidth: 40, textAlign: 'center', fontWeight: 500 }}>
            {Math.round(zoom * 100)}%
          </div>
          <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
            style={{ width: 28, height: 26, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
            <Icon name="zoom-in" size={13} />
          </button>
        </div>

        <button onClick={() => setZoom(0.9)} style={tbBtn(false)}>Fit</button>
        <button onClick={() => setZoom(1)}   style={tbBtn(false)}>100%</button>

        <div style={{ width: 1, background: 'var(--border)', height: 20, margin: '0 2px' }} />

        <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
          style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', color: 'var(--muted)', opacity: currentPage === 1 ? 0.3 : 1 }}>
          <Icon name="chevron-left" size={13} />
        </button>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Page <span className="mono" style={{ color: 'var(--text)', fontWeight: 500 }}>{currentPage}</span> of <span className="mono">{totalPages}</span>
        </div>
        <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
          style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', color: 'var(--muted)', opacity: currentPage === totalPages ? 0.3 : 1 }}>
          <Icon name="chevron-right" size={13} />
        </button>
        <button onClick={() => setTotalPages((p) => p + 1)} style={{ ...tbBtn(false), gap: 4 }}>
          <Icon name="plus" size={12} /> Page
        </button>

        <div style={{ width: 1, background: 'var(--border)', height: 20, margin: '0 2px' }} />

        <button onClick={() => toggle('showRulers')} style={tbBtn(tweaks.showRulers)}>Rulers</button>
        <button onClick={() => toggle('showGrid')}   style={tbBtn(tweaks.showGrid)}>Grid</button>

        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: 'var(--muted-2)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Icon name="file-pdf" size={13} />
          <span className="mono">{(template && template.name ? template.name : 'template').toLowerCase().replace(/\s+/g, '-')}.pdf</span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <PageRail totalPages={totalPages} currentPage={currentPage} onSelect={setCurrentPage} fields={fields} />

        <div ref={viewportRef}
          style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '32px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelection(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, minWidth: 'fit-content' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pnum) => (
              <PageCanvas key={pnum} tweaks={tweaks} pageNum={pnum}
                fields={fields.filter((f) => f.page === pnum)}
                allFields={fields}
                setFields={setFields}
                selection={selection} setSelection={setSelection}
                zoom={zoom} updateField={updateField}
                dropHover={!!(drag && hoverPage === pnum)}
                backgroundUrl={template && template.background_url}
                model={model}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Right properties panel ─────────────────────────────────────────────────────
function RightPropsPanel({ field, model, onUpdate, onDelete, onDuplicate }) {
  if (!field) {
    return (
      <aside style={{ width: 256, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'var(--muted)', gap: 8 }}>
        <Icon name="mouse-pointer" size={22} style={{ opacity: 0.4 }} />
        <div style={{ fontSize: 13 }}>Select an element</div>
      </aside>
    );
  }

  const u = (patch) => onUpdate(field.id, patch);
  const inp = {
    width: '100%', height: 28, padding: '0 8px',
    border: '1px solid var(--border)', background: 'var(--surface-2)',
    borderRadius: 5, fontSize: 12, outline: 'none', color: 'var(--text)',
  };

  const Row = ({ label, children }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase',
        letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );

  const NumInput = ({ label, val, onChange, min = 0 }) => (
    <div>
      <div style={{ fontSize: 9.5, color: 'var(--muted-2)', marginBottom: 2 }}>{label}</div>
      <input type="number" value={Math.round(val)} min={min}
        onChange={(e) => onChange(+e.target.value)}
        style={{ ...inp, fontFamily: 'monospace', fontSize: 11 }} />
    </div>
  );

  const KIND_LABEL = {
    bound: 'Bound Field', text: 'Text', heading: 'Heading', divider: 'Divider',
    rect: 'Rectangle', image: 'Image', signature: 'Signature',
    checkbox: 'Checkbox', qr: 'QR Code', 'page-number': 'Page Number',
  };

  return (
    <aside style={{ width: 256, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {KIND_LABEL[field.kind] || field.kind}
        </div>
        <button onClick={() => onDuplicate(field.id)} title="Duplicate (⌘D)"
          style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 5, color: 'var(--muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <Icon name="copy" size={14} />
        </button>
        <button onClick={() => onDelete(field.id)} title="Delete"
          style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 5, color: 'var(--danger,#dc2626)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220,38,38,.08)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <Icon name="trash" size={14} />
        </button>
      </div>

      {/* Scrollable properties */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>

        <Row label="Position & Size">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <NumInput label="X (pt)" val={field.x} onChange={(v) => u({ x: Math.max(0, v) })} />
            <NumInput label="Y (pt)" val={field.y} onChange={(v) => u({ y: Math.max(0, v) })} />
            <NumInput label="W (pt)" val={field.w} onChange={(v) => u({ w: Math.max(4, v) })} />
            <NumInput label="H (pt)" val={field.h} onChange={(v) => u({ h: Math.max(2, v) })} />
          </div>
        </Row>

        {/* bound */}
        {field.kind === 'bound' && (
          <>
            <Row label="Bound field">
              <div style={{ padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 5,
                border: '1px solid var(--border)', fontSize: 12, fontFamily: 'monospace',
                color: 'var(--accent,#4f46e5)' }}>{field.bind}</div>
            </Row>
            <TextStyleProps field={field} u={u} inp={inp} Row={Row} />
          </>
        )}

        {/* text / heading */}
        {(field.kind === 'text' || field.kind === 'heading') && (
          <>
            <Row label="Content">
              <textarea value={field.text || ''} onChange={(e) => u({ text: e.target.value })}
                style={{ ...inp, height: 60, padding: '6px 8px', resize: 'vertical', lineHeight: 1.4 }} />
            </Row>
            <TextStyleProps field={field} u={u} inp={inp} Row={Row} />
          </>
        )}

        {/* divider */}
        {field.kind === 'divider' && (
          <>
            <Row label="Color"><ColorPicker value={field.color || '#d1d5db'} onChange={(v) => u({ color: v })} /></Row>
            <Row label="Thickness (pt)">
              <input type="number" value={field.thickness || 1} min={0.5} step={0.5}
                onChange={(e) => u({ thickness: Math.max(0.5, +e.target.value) })} style={inp} />
            </Row>
          </>
        )}

        {/* rect */}
        {field.kind === 'rect' && (
          <>
            <Row label="Fill"><ColorPicker value={field.fill || '#f3f4f6'} onChange={(v) => u({ fill: v })} allowEmpty /></Row>
            <Row label="Border color"><ColorPicker value={field.stroke || ''} onChange={(v) => u({ stroke: v })} allowEmpty /></Row>
            {field.stroke && (
              <Row label="Border width (pt)">
                <input type="number" value={field.strokeWidth || 1} min={0.5} step={0.5}
                  onChange={(e) => u({ strokeWidth: Math.max(0.5, +e.target.value) })} style={inp} />
              </Row>
            )}
            <Row label="Corner radius (pt)">
              <input type="number" value={field.borderRadius || 0} min={0}
                onChange={(e) => u({ borderRadius: Math.max(0, +e.target.value) })} style={inp} />
            </Row>
          </>
        )}

        {/* image */}
        {field.kind === 'image' && (
          <>
            <Row label="Image URL">
              <input value={field.url || ''} onChange={(e) => u({ url: e.target.value })}
                placeholder="https://…" style={inp} />
            </Row>
            <Row label="Object fit">
              <select value={field.objectFit || 'contain'} onChange={(e) => u({ objectFit: e.target.value })} style={inp}>
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="fill">Fill</option>
              </select>
            </Row>
          </>
        )}

        {/* signature */}
        {field.kind === 'signature' && (
          <Row label="Label">
            <input value={field.label || ''} onChange={(e) => u({ label: e.target.value })}
              placeholder="Signature" style={inp} />
          </Row>
        )}

        {/* checkbox */}
        {field.kind === 'checkbox' && (
          <>
            <Row label="Default state">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!field.checked} onChange={(e) => u({ checked: e.target.checked })} />
                Checked by default
              </label>
            </Row>
            <Row label="Bind to field">
              <input value={field.bind || ''} onChange={(e) => u({ bind: e.target.value })}
                placeholder="model.field" style={{ ...inp, fontFamily: 'monospace', fontSize: 11 }} />
            </Row>
          </>
        )}

        {/* qr */}
        {field.kind === 'qr' && (
          <Row label="Value / bind">
            <input value={field.value || ''} onChange={(e) => u({ value: e.target.value })}
              placeholder="{{model.field}} or static text" style={{ ...inp, fontFamily: 'monospace', fontSize: 11 }} />
          </Row>
        )}

        {/* page-number */}
        {field.kind === 'page-number' && (
          <>
            <Row label="Format">
              <input value={field.format || 'Page {{page}} of {{total}}'}
                onChange={(e) => u({ format: e.target.value })}
                style={{ ...inp, fontFamily: 'monospace', fontSize: 11 }} />
            </Row>
            <TextStyleProps field={field} u={u} inp={inp} Row={Row} />
          </>
        )}

      </div>
    </aside>
  );
}

// ── Shared text-style controls ─────────────────────────────────────────────────
function TextStyleProps({ field, u, inp, Row }) {
  return (
    <>
      <Row label="Font size (pt)">
        <input type="number" value={field.fontSize || 11} min={6} max={120}
          onChange={(e) => u({ fontSize: Math.max(6, +e.target.value) })} style={inp} />
      </Row>
      <Row label="Style">
        <div style={{ display: 'flex', gap: 5 }}>
          {[
            { k: 'bold',      l: 'B', s: { fontWeight: 700 } },
            { k: 'italic',    l: 'I', s: { fontStyle: 'italic' } },
            { k: 'underline', l: 'U', s: { textDecoration: 'underline' } },
          ].map(({ k, l, s }) => (
            <button key={k} onClick={() => u({ [k]: !field[k] })}
              style={{ width: 34, height: 28, borderRadius: 5, border: '1px solid var(--border)',
                background: field[k] ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: field[k] ? 'var(--accent)' : 'var(--text-2)', fontSize: 13, ...s }}>
              {l}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Alignment">
        <div style={{ display: 'flex', gap: 5 }}>
          {['left', 'center', 'right'].map((a) => (
            <button key={a} onClick={() => u({ align: a })}
              style={{ flex: 1, height: 28, borderRadius: 5, border: '1px solid var(--border)',
                display: 'grid', placeItems: 'center',
                background: (field.align || 'left') === a ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: (field.align || 'left') === a ? 'var(--accent)' : 'var(--text-2)' }}>
              <Icon name={`align-${a}`} size={13} />
            </button>
          ))}
        </div>
      </Row>
      <Row label="Color">
        <ColorPicker value={field.color || '#374151'} onChange={(v) => u({ color: v })} />
      </Row>
    </>
  );
}

// ── Color picker ───────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange, allowEmpty }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="color" value={value || '#374151'} onChange={(e) => onChange(e.target.value)}
        style={{ width: 32, height: 28, padding: 2, border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', flexShrink: 0 }} />
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={allowEmpty ? 'none' : '#374151'}
        style={{ flex: 1, height: 28, padding: '0 8px', border: '1px solid var(--border)', background: 'var(--surface-2)',
          borderRadius: 5, fontSize: 11, fontFamily: 'monospace', outline: 'none', color: 'var(--text)' }} />
      {allowEmpty && value && (
        <button onClick={() => onChange('')}
          style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1, padding: '0 2px' }}>✕</button>
      )}
    </div>
  );
}

// ── Exports ────────────────────────────────────────────────────────────────────
window.CanvasArea      = CanvasArea;
window.RightPropsPanel = RightPropsPanel;
})();
