import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Icon } from './icons.jsx';
import { IconBtn, ToolbarButton } from './ui.jsx';
import { clamp, MIN_ZOOM, MAX_ZOOM } from './constants.js';
import { buildTargets, snapBox, snapToGrid, GRID_PT, intersects, boundsOf } from './snap.js';

// pdf.js needs a Web Worker, and it must be the same version as this bundle's
// API. We're an IIFE bundle (no import.meta.url at runtime), so the worker is
// published beside us and addressed through assetBase.
//
// Same-origin matters beyond CSP: when the real worker can't load, pdf.js falls
// back to whatever `globalThis.pdfjsWorker` holds — which, on a host page that
// bundles its own pdf.js, is a different version, and every render then dies
// with "API version does not match the Worker version".
const ASSET_BASE    = (typeof window !== 'undefined' && window.__PDF_BUILDER__?.assetBase) || '';
// Same cache-buster the page uses for the bundle, so a republished worker can
// never be served from cache at the previous version.
const ASSET_VERSION = (typeof window !== 'undefined' && window.__PDF_BUILDER__?.assetVersion) || '';

pdfjsLib.GlobalWorkerOptions.workerSrc = ASSET_BASE
  ? `${ASSET_BASE.replace(/\/$/, '')}/pdf.worker.min.js${ASSET_VERSION ? `?v=${encodeURIComponent(ASSET_VERSION)}` : ''}`
  : `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const pdfDocCache = new Map();
function loadPdfDocument(url) {
  if (!pdfDocCache.has(url)) {
    pdfDocCache.set(url, pdfjsLib.getDocument(url).promise);
  }
  return pdfDocCache.get(url);
}

// Renders a single page of a background PDF onto a <canvas>. Works in browsers
// whose built-in PDF viewer refuses to embed (the "preview not available" case).
function PdfBackground({ url, pageNum, width, height, quality = 2 }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    let renderTask = null;

    loadPdfDocument(url)
      .then(async (doc) => {
        if (cancelled) return;
        const safePage = Math.min(Math.max(1, pageNum), doc.numPages);
        const page = await doc.getPage(safePage);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = (Math.max(width, height) * quality) / Math.max(baseViewport.width, baseViewport.height);
        const viewport = page.getViewport({ scale });

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        const ctx = canvas.getContext('2d');
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      })
      .catch((e) => {
        if (cancelled || (e && e.name === 'RenderingCancelledException')) return;
        setError(e && e.message ? e.message : 'Failed to render background');
      });

    return () => {
      cancelled = true;
      if (renderTask) {
        try { renderTask.cancel(); } catch (_) { /* noop */ }
      }
    };
  }, [url, pageNum, width, height, quality]);

  if (error) {
    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        color: '#9ca3af', fontSize: 12, padding: 16, textAlign: 'center', pointerEvents: 'none',
      }}>Background PDF couldn't be rendered: {error}</div>
    );
  }

  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      pointerEvents: 'none', background: '#fff',
    }} />
  );
}

// ── Rulers ─────────────────────────────────────────────────────────────────────
const RULER = 18;

function rulerStep(zoom) {
  return zoom >= 1.5 ? 25 : zoom >= 0.75 ? 50 : 100;
}

function RulerH({ pageW, zoom, cursor }) {
  const step = rulerStep(zoom);
  const marks = [];
  for (let pt = 0; pt <= pageW; pt += step) {
    const px = pt * zoom;
    const major = pt % (step * 2) === 0;
    marks.push(
      <g key={pt}>
        <line x1={px} y1={major ? 5 : 11} x2={px} y2={RULER} stroke="var(--border-strong)" strokeWidth={0.5} />
        {major && <text x={px + 2} y={9} fontSize={7} fill="var(--muted-2)">{pt}</text>}
      </g>
    );
  }
  return (
    <svg style={{ display: 'block', width: pageW * zoom, height: RULER, background: 'var(--surface-2)',
      borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      {marks}
      {cursor != null && <line x1={cursor * zoom} y1={0} x2={cursor * zoom} y2={RULER} stroke="var(--accent)" strokeWidth={1} />}
    </svg>
  );
}

function RulerV({ pageH, zoom, cursor }) {
  const step = rulerStep(zoom);
  const marks = [];
  for (let pt = 0; pt <= pageH; pt += step) {
    const py = pt * zoom;
    const major = pt % (step * 2) === 0;
    marks.push(
      <g key={pt}>
        <line x1={major ? 5 : 11} y1={py} x2={RULER} y2={py} stroke="var(--border-strong)" strokeWidth={0.5} />
        {major && <text fontSize={7} fill="var(--muted-2)" transform={`translate(8,${py - 2}) rotate(-90)`}>{pt}</text>}
      </g>
    );
  }
  return (
    <svg style={{ display: 'block', width: RULER, height: pageH * zoom, background: 'var(--surface-2)',
      borderRight: '1px solid var(--border)', flexShrink: 0 }}>
      {marks}
      {cursor != null && <line x1={0} y1={cursor * zoom} x2={RULER} y2={cursor * zoom} stroke="var(--accent)" strokeWidth={1} />}
    </svg>
  );
}

// ── Page overlays ──────────────────────────────────────────────────────────────
function GridOverlay({ width, height, zoom }) {
  const sp = Math.max(4, GRID_PT * zoom);
  const id = `g${Math.round(zoom * 1000)}`;
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

function MarginGuides({ margins, pageW, pageH, zoom }) {
  const s = {
    position: 'absolute', pointerEvents: 'none',
    left: margins.left * zoom,
    top: margins.top * zoom,
    width: Math.max(0, (pageW - margins.left - margins.right)) * zoom,
    height: Math.max(0, (pageH - margins.top - margins.bottom)) * zoom,
    border: '1px dashed rgba(79,70,229,.28)',
  };
  return <div style={s} aria-hidden="true" />;
}

// ── Field content ──────────────────────────────────────────────────────────────
function FieldContent({ field, zoom }) {
  const { kind, w, h } = field;
  const hPx = h * zoom;
  const fs = Math.max(6, (field.fontSize || 11) * zoom);
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
          <div style={{ flexShrink: 0, width: Math.max(9, 14 * zoom), height: Math.max(9, 14 * zoom),
            borderRadius: 3, background: 'rgba(79,70,229,.12)', color: '#4f46e5',
            display: 'grid', placeItems: 'center' }}>
            <Icon name="hash" size={Math.max(6, 9 * zoom)} />
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
        ? <img src={field.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: field.objectFit || 'contain', display: 'block' }} />
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
            .replace('{{page}}', String(field.page || 1)).replace('{{total}}', '1')}
        </div>
      );

    default:
      return <div style={{ width: '100%', height: '100%', background: '#e5e7eb', borderRadius: 2 }} />;
  }
}

// ── Resize handles ─────────────────────────────────────────────────────────────
const HANDLES = [
  { d: 'nw', style: { top: -4,    left: -4,    cursor: 'nwse-resize' } },
  { d: 'n',  style: { top: -4,    left: '50%', cursor: 'ns-resize',  transform: 'translateX(-50%)' } },
  { d: 'ne', style: { top: -4,    right: -4,   cursor: 'nesw-resize' } },
  { d: 'e',  style: { top: '50%', right: -4,   cursor: 'ew-resize',  transform: 'translateY(-50%)' } },
  { d: 'se', style: { bottom: -4, right: -4,   cursor: 'nwse-resize' } },
  { d: 's',  style: { bottom: -4, left: '50%', cursor: 'ns-resize',  transform: 'translateX(-50%)' } },
  { d: 'sw', style: { bottom: -4, left: -4,    cursor: 'nesw-resize' } },
  { d: 'w',  style: { top: '50%', left: -4,    cursor: 'ew-resize',  transform: 'translateY(-50%)' } },
];

function ResizeHandles({ field, zoom, editor, setHud }) {
  const onHandleDown = (dir, e) => {
    e.stopPropagation();
    e.preventDefault();
    const { id, x, y, w, h } = field;
    const ratio = w / Math.max(1, h);
    const start = { mx: e.clientX, my: e.clientY, x, y, w, h };

    const onMove = (ev) => {
      const dx = (ev.clientX - start.mx) / zoom;
      const dy = (ev.clientY - start.my) / zoom;
      let nx = start.x, ny = start.y, nw = start.w, nh = start.h;

      if (dir.includes('e')) nw = Math.max(4, start.w + dx);
      if (dir.includes('s')) nh = Math.max(2, start.h + dy);
      if (dir.includes('w')) { nw = Math.max(4, start.w - dx); nx = start.x + (start.w - nw); }
      if (dir.includes('n')) { nh = Math.max(2, start.h - dy); ny = start.y + (start.h - nh); }

      // Shift keeps the aspect ratio; Alt resizes around the centre.
      if (ev.shiftKey && dir.length === 2) {
        nh = nw / ratio;
        if (dir.includes('n')) ny = start.y + start.h - nh;
      }
      if (ev.altKey) {
        nw = Math.max(4, start.w + (nw - start.w) * 2);
        nh = Math.max(2, start.h + (nh - start.h) * 2);
        nx = start.x + (start.w - nw) / 2;
        ny = start.y + (start.h - nh) / 2;
      }

      const patch = { x: Math.round(Math.max(0, nx)), y: Math.round(Math.max(0, ny)), w: Math.round(nw), h: Math.round(nh) };
      setHud({ ...patch, mode: 'size' });
      editor.ops.patch([id], patch, { transient: true });
    };

    const onUp = () => {
      setHud(null);
      editor.commit();
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
            background: 'var(--surface)', border: '1.5px solid var(--accent)',
            boxShadow: '0 1px 2px rgba(0,0,0,.2)',
            ...style,
          }} />
      ))}
    </>
  );
}

// ── Field element ──────────────────────────────────────────────────────────────
function FieldEl({ field, zoom, selected, editor, pageFields, pageW, pageH, setGuides, setHud, panning }) {
  const { id, x, y, w, h } = field;

  const onPointerDown = (e) => {
    if (e.button !== 0 || panning) return;
    e.stopPropagation();

    const alreadySelected = editor.selection.includes(id);

    if (e.shiftKey && alreadySelected && editor.selection.length > 1) {
      // Shift-clicking a selected element removes it again.
      editor.setSelection(editor.selection.filter((s) => s !== id));
      return;
    }

    let ids = alreadySelected
      ? editor.selection
      : (e.shiftKey ? [...editor.selection, id] : [id]);

    // Snapshot the starting positions before anything is cloned.
    const sources = editor.doc.fields.filter((f) => ids.includes(f.id));
    const origin = new Map();
    let anchorId = id;

    if (e.altKey) {
      // Alt-drag clones the selection and drags the copies instead.
      const created = editor.ops.duplicate(ids, 0, 0);
      if (!created.length) return;
      sources.forEach((f, i) => origin.set(created[i], { x: f.x, y: f.y }));
      const idx = sources.findIndex((f) => f.id === id);
      anchorId = created[idx >= 0 ? idx : 0];
      ids = created;
    } else {
      editor.setSelection(ids);
      sources.forEach((f) => origin.set(f.id, { x: f.x, y: f.y }));
    }

    const startX = e.clientX, startY = e.clientY;
    const anchor = origin.get(anchorId) || { x, y };
    const others = pageFields.filter((f) => !ids.includes(f.id));
    const targets = buildTargets(others, pageW, pageH, editor.doc.margins);
    let moved = false;

    const onMove = (ev) => {
      let dx = (ev.clientX - startX) / zoom;
      let dy = (ev.clientY - startY) / zoom;
      if (!moved && Math.abs(ev.clientX - startX) < 3 && Math.abs(ev.clientY - startY) < 3) return;
      moved = true;

      let nx = anchor.x + dx;
      let ny = anchor.y + dy;

      // Alt bypasses snapping (matches the Figma muscle memory).
      if (editor.view.snap && !ev.altKey) {
        const snapped = snapBox(nx, ny, w, h, targets, zoom);
        setGuides(snapped.guides);
        nx = snapped.x; ny = snapped.y;
      } else if (editor.view.grid && !ev.altKey) {
        nx = snapToGrid(nx); ny = snapToGrid(ny);
        setGuides({ v: [], h: [] });
      } else {
        setGuides({ v: [], h: [] });
      }

      dx = nx - anchor.x;
      dy = ny - anchor.y;

      setHud({ x: Math.round(nx), y: Math.round(ny), w, h, mode: 'pos' });
      editor.ops.patch(ids, (f) => {
        const o = origin.get(f.id) || { x: f.x, y: f.y };
        return { x: Math.max(0, Math.round(o.x + dx)), y: Math.max(0, Math.round(o.y + dy)) };
      }, { transient: true });
    };

    const onUp = () => {
      setGuides({ v: [], h: [] });
      setHud(null);
      editor.commit();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editor.selection.includes(id)) editor.setSelection([id]);
    editor.openElementMenu(e.clientX, e.clientY);
  };

  return (
    <div onPointerDown={onPointerDown} onContextMenu={onContextMenu}
      data-field-id={id}
      style={{
        position: 'absolute',
        left: x * zoom, top: y * zoom,
        width: w * zoom, height: h * zoom,
        cursor: panning ? 'inherit' : 'move', userSelect: 'none',
        outline: selected ? '1.5px solid var(--accent)' : 'none',
        outlineOffset: 1,
        zIndex: selected ? 10 : 1,
      }}>
      <FieldContent field={field} zoom={zoom} />
      {selected && editor.selection.length === 1 && (
        <ResizeHandles field={field} zoom={zoom} editor={editor} setHud={setHud} />
      )}
    </div>
  );
}

// ── One page ───────────────────────────────────────────────────────────────────
function PageCanvas({ editor, pageNum, fields, registerPage, panning, backgroundUrl }) {
  const { zoom, pageW, pageH, view } = editor;
  const W = pageW * zoom;
  const H = pageH * zoom;
  const [guides, setGuides] = useState({ v: [], h: [] });
  const [hud, setHud]       = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [cursor, setCursor]   = useState(null);
  const pageRef = useRef(null);

  const isCurrent = editor.currentPage === pageNum;

  const toPagePoint = (e) => {
    const r = pageRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 || panning) return;
    if (e.target !== e.currentTarget && !e.target.dataset.pageSurface) return;

    editor.setCurrentPage(pageNum);
    const start = toPagePoint(e);
    const additive = e.shiftKey;
    if (!additive) editor.setSelection([]);

    let active = false;
    const onMove = (ev) => {
      const p = toPagePoint(ev);
      const box = {
        x: Math.min(start.x, p.x), y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y),
      };
      if (!active && box.w < 3 / zoom && box.h < 3 / zoom) return;
      active = true;
      setMarquee(box);
      const hit = fields.filter((f) => intersects(box, f)).map((f) => f.id);
      editor.setSelection(additive ? [...new Set([...editor.selection, ...hit])] : hit);
    };
    const onUp = () => {
      setMarquee(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const selectionBounds = editor.selection.length > 1
    ? boundsOf(fields.filter((f) => editor.selection.includes(f.id)))
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div>
          {view.rulers && <div style={{ marginLeft: RULER }}><RulerH pageW={pageW} zoom={zoom} cursor={cursor?.x} /></div>}
          <div style={{ display: 'flex' }}>
            {view.rulers && <RulerV pageH={pageH} zoom={zoom} cursor={cursor?.y} />}

            <div ref={(el) => { pageRef.current = el; registerPage(pageNum, el); }}
              data-page-num={pageNum}
              onPointerDown={onPointerDown}
              onPointerMove={(e) => view.rulers && setCursor(toPagePoint(e))}
              onPointerLeave={() => setCursor(null)}
              onContextMenu={(e) => { e.preventDefault(); editor.setCurrentPage(pageNum); editor.openPageMenu(e.clientX, e.clientY, pageNum); }}
              style={{
                width: W, height: H, position: 'relative', background: '#fff', flexShrink: 0,
                boxShadow: isCurrent ? '0 0 0 1.5px var(--accent), 0 4px 20px rgba(0,0,0,.14)' : '0 2px 16px rgba(0,0,0,.14)',
                outline: editor.dropHoverPage === pageNum ? '2.5px dashed var(--accent)' : 'none',
                overflow: 'hidden',
              }}>

              {backgroundUrl && <PdfBackground url={backgroundUrl} pageNum={pageNum} width={W} height={H} />}
              {view.grid && <GridOverlay width={W} height={H} zoom={zoom} />}
              {view.margins && <MarginGuides margins={editor.doc.margins} pageW={pageW} pageH={pageH} zoom={zoom} />}

              {/* Transparent surface so clicks on empty space start a marquee. */}
              <div data-page-surface="1" style={{ position: 'absolute', inset: 0 }} />

              {fields.map((f) => (
                <FieldEl key={f.id} field={f} zoom={zoom}
                  selected={editor.selection.includes(f.id)}
                  editor={editor} pageFields={fields}
                  pageW={pageW} pageH={pageH}
                  setGuides={setGuides} setHud={setHud} panning={panning} />
              ))}

              {selectionBounds && (
                <div style={{
                  position: 'absolute', pointerEvents: 'none', zIndex: 9,
                  left: selectionBounds.x * zoom, top: selectionBounds.y * zoom,
                  width: selectionBounds.w * zoom, height: selectionBounds.h * zoom,
                  outline: '1px dashed var(--accent)', outlineOffset: 2,
                }} />
              )}

              {marquee && (
                <div style={{
                  position: 'absolute', pointerEvents: 'none', zIndex: 60,
                  left: marquee.x * zoom, top: marquee.y * zoom,
                  width: marquee.w * zoom, height: marquee.h * zoom,
                  background: 'var(--selection)', border: '1px solid var(--accent)',
                }} />
              )}

              {guides.v.map((gx, i) => (
                <div key={`v${i}`} style={{ position: 'absolute', left: gx * zoom - 0.5, top: 0,
                  width: 1, height: H, background: '#f43f5e', pointerEvents: 'none', zIndex: 50 }} />
              ))}
              {guides.h.map((gy, i) => (
                <div key={`h${i}`} style={{ position: 'absolute', top: gy * zoom - 0.5, left: 0,
                  width: W, height: 1, background: '#f43f5e', pointerEvents: 'none', zIndex: 50 }} />
              ))}

              {hud && (
                <div className="mono" style={{
                  position: 'absolute', zIndex: 70, pointerEvents: 'none',
                  left: clamp(hud.x * zoom, 0, Math.max(0, W - 120)),
                  top: Math.max(0, hud.y * zoom - 22),
                  padding: '2px 6px', borderRadius: 4, fontSize: 10.5,
                  background: 'var(--accent)', color: '#fff', whiteSpace: 'nowrap',
                }}>
                  {hud.mode === 'size' ? `${hud.w} × ${hud.h}` : `${hud.x}, ${hud.y}`}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)',
        paddingLeft: view.rulers ? RULER : 0 }}>
        <span>Page {pageNum} of {editor.doc.pages}</span>
        <IconBtn name="copy" size={12} title="Duplicate page" onClick={() => editor.ops.duplicatePage(pageNum)} />
        <IconBtn name="trash" size={12} title="Delete page" danger
          disabled={editor.doc.pages <= 1}
          onClick={() => editor.ops.deletePage(pageNum)} />
      </div>
    </div>
  );
}

// ── Page rail ──────────────────────────────────────────────────────────────────
function PageRail({ editor, backgroundUrl }) {
  const { doc } = editor;
  const [hover, setHover] = useState(null);
  const TW = 68;
  const TH = Math.round(TW * (editor.pageH / editor.pageW));
  const scale = TW / editor.pageW;

  return (
    <div style={{ width: 108, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface-2)',
      overflow: 'auto', padding: '12px 0 20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {Array.from({ length: doc.pages }, (_, i) => i + 1).map((p) => {
          const sel   = p === editor.currentPage;
          const items = doc.fields.filter((f) => f.page === p);
          return (
            <div key={p} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <button type="button" onClick={() => editor.goToPage(p)}
                onContextMenu={(e) => { e.preventDefault(); editor.setCurrentPage(p); editor.openPageMenu(e.clientX, e.clientY, p); }}
                title={`Go to page ${p}`}
                style={{
                  width: TW, height: TH, background: '#fff', position: 'relative', overflow: 'hidden',
                  border: '1.5px solid ' + (sel ? 'var(--accent)' : 'var(--border)'),
                  borderRadius: 3, boxShadow: sel ? '0 0 0 2px var(--accent-soft)' : 'var(--shadow-sm)',
                  padding: 0,
                }}>
                {backgroundUrl && <PdfBackground url={backgroundUrl} pageNum={p} width={TW} height={TH} quality={1.5} />}
                {items.map((f) => (
                  <div key={f.id} style={{
                    position: 'absolute',
                    left: f.x * scale, top: f.y * scale,
                    width: Math.max(1, f.w * scale), height: Math.max(1, f.h * scale),
                    background: f.kind === 'bound' ? 'rgba(79,70,229,.35)' : 'rgba(107,114,128,.28)',
                    borderRadius: 1,
                  }} />
                ))}
              </button>

              <div style={{ fontSize: 10, color: sel ? 'var(--accent)' : 'var(--muted)', fontWeight: sel ? 600 : 500 }}>
                {p}{items.length > 0 && <span style={{ color: 'var(--muted-2)' }}> · {items.length}</span>}
              </div>

              {hover === p && (
                <div style={{
                  position: 'absolute', top: 2, right: -6, display: 'flex', flexDirection: 'column', gap: 2,
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                  boxShadow: 'var(--shadow-md)', padding: 2,
                }}>
                  <IconBtn name="arrow-up" size={11} title="Move page up" disabled={p === 1}
                    onClick={() => editor.ops.movePage(p, p - 1)} />
                  <IconBtn name="arrow-down" size={11} title="Move page down" disabled={p === doc.pages}
                    onClick={() => editor.ops.movePage(p, p + 1)} />
                  <IconBtn name="copy" size={11} title="Duplicate page" onClick={() => editor.ops.duplicatePage(p)} />
                  <IconBtn name="trash" size={11} title="Delete page" danger disabled={doc.pages <= 1}
                    onClick={() => editor.ops.deletePage(p)} />
                </div>
              )}
            </div>
          );
        })}

        <button type="button" onClick={() => editor.ops.addPage()}
          title="Add page (⌘⇧N)"
          style={{
            width: TW, height: 30, marginTop: 2, borderRadius: 4, fontSize: 11, fontWeight: 500,
            border: '1px dashed var(--border-strong)', color: 'var(--muted)', background: 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
          <Icon name="plus" size={11} /> Page
        </button>
      </div>
    </div>
  );
}

// ── Canvas area ────────────────────────────────────────────────────────────────
function CanvasArea({ editor, viewportApi, status }) {
  const vpRef = useRef(null);
  const pageEls = useRef(new Map());
  const pendingScroll = useRef(null);
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const { zoom, setZoom, pageW, pageH } = editor;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const registerPage = useCallback((num, el) => {
    if (el) pageEls.current.set(num, el);
    else pageEls.current.delete(num);
  }, []);

  // ── Zoom, anchored at a screen point ────────────────────────────────────────
  const zoomTo = useCallback((next, clientX, clientY) => {
    const el = vpRef.current;
    const z0 = zoomRef.current;
    const z1 = clamp(next, MIN_ZOOM, MAX_ZOOM);
    if (!el || Math.abs(z1 - z0) < 0.0001) return;

    const r  = el.getBoundingClientRect();
    const cx = clientX == null ? r.width  / 2 : clientX - r.left;
    const cy = clientY == null ? r.height / 2 : clientY - r.top;
    const px = (el.scrollLeft + cx) / z0;
    const py = (el.scrollTop  + cy) / z0;

    pendingScroll.current = { left: px * z1 - cx, top: py * z1 - cy };
    setZoom(z1);
  }, [setZoom]);

  useLayoutEffect(() => {
    const el = vpRef.current;
    if (!el || !pendingScroll.current) return;
    el.scrollLeft = Math.max(0, pendingScroll.current.left);
    el.scrollTop  = Math.max(0, pendingScroll.current.top);
    pendingScroll.current = null;
  }, [zoom]);

  // A viewport that hasn't been laid out yet would "fit" to a useless zoom.
  const measurable = () => {
    const el = vpRef.current;
    return el && el.clientWidth > 100 && el.clientHeight > 100 ? el : null;
  };

  const fitPage = useCallback(() => {
    const el = measurable();
    if (!el) return;
    const pad = (editor.view.rulers ? RULER : 0) + 72;
    zoomTo(Math.min((el.clientWidth - pad) / pageW, (el.clientHeight - pad) / pageH));
  }, [zoomTo, pageW, pageH, editor.view.rulers]);

  const fitWidth = useCallback(() => {
    const el = measurable();
    if (!el) return;
    const pad = (editor.view.rulers ? RULER : 0) + 72;
    zoomTo((el.clientWidth - pad) / pageW);
  }, [zoomTo, pageW, editor.view.rulers]);

  const goToPage = useCallback((p) => {
    editor.setCurrentPage(p);
    const el = vpRef.current;
    const target = pageEls.current.get(p);
    if (!el || !target) return;
    const r = target.getBoundingClientRect();
    const vr = el.getBoundingClientRect();
    const top = Math.max(0, el.scrollTop + (r.top - vr.top) - 28);
    try {
      el.scrollTo({ top, behavior: 'smooth' });
    } catch (_) {
      el.scrollTop = top;   // older browsers without the options form
    }
  }, [editor]);

  // Publish the viewport controls so shortcuts and the sidebar can drive them.
  useEffect(() => {
    viewportApi.current = {
      zoomIn:  () => zoomTo(zoomRef.current * 1.2),
      zoomOut: () => zoomTo(zoomRef.current / 1.2),
      zoomTo,
      fitPage,
      fitWidth,
      zoom100: () => zoomTo(1),
      goToPage,
    };
  }, [viewportApi, zoomTo, fitPage, fitWidth, goToPage]);

  // Fit once on mount, and whenever the page geometry changes.
  const geomKey = `${pageW}x${pageH}`;
  const didFit = useRef('');
  useEffect(() => {
    if (didFit.current === geomKey) return undefined;
    // The host page sets the builder's height from JS, so wait for a frame
    // where the viewport actually has a size before fitting to it.
    let tries = 0;
    let frame = requestAnimationFrame(function attempt() {
      if (measurable()) {
        didFit.current = geomKey;
        fitPage();
      } else if (tries++ < 30) {
        frame = requestAnimationFrame(attempt);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [geomKey, fitPage]);

  // ── Wheel: ⌘/Ctrl or pinch zooms, ⇧ scrolls sideways ────────────────────────
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomTo(zoomRef.current * Math.exp(-dy * 0.006), e.clientX, e.clientY);
      } else if (e.shiftKey && Math.abs(e.deltaX) < 1) {
        e.preventDefault();
        el.scrollLeft += dy;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  // ── Space to pan ────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      setSpaceHeld(true);
    };
    const up = (e) => { if (e.code === 'Space') setSpaceHeld(false); };
    const blur = () => setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const onViewportPointerDown = (e) => {
    const wantsPan = spaceHeld || e.button === 1;
    if (!wantsPan) {
      if (e.target === e.currentTarget || e.target.dataset.canvasSpace) editor.setSelection([]);
      return;
    }
    e.preventDefault();
    const el = vpRef.current;
    const sx = e.clientX, sy = e.clientY;
    const sl = el.scrollLeft, st = el.scrollTop;
    setPanning(true);

    const onMove = (ev) => {
      el.scrollLeft = sl - (ev.clientX - sx);
      el.scrollTop  = st - (ev.clientY - sy);
    };
    const onUp = () => {
      setPanning(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── Current page follows the scroll position ────────────────────────────────
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return undefined;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const vr = el.getBoundingClientRect();
        const mid = vr.top + vr.height / 2;
        let best = null;
        pageEls.current.forEach((node, num) => {
          if (!node) return;
          const r = node.getBoundingClientRect();
          const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
          if (!best || d < best.d) best = { d, num };
        });
        const ed = editorRef.current;
        if (best && best.num !== ed.currentPage) ed.setCurrentPage(best.num);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, []);

  // ── Drop handling for sidebar drags ─────────────────────────────────────────
  const dragging = !!editor.drag;
  useEffect(() => {
    if (!dragging) return undefined;
    const hitPage = (e) => {
      let hit = null;
      pageEls.current.forEach((node, num) => {
        if (!node) return;
        const r = node.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) hit = { num, r };
      });
      return hit;
    };
    const onMove = (e) => editorRef.current.setDropHoverPage(hitPage(e)?.num ?? null);
    const onUp = (e) => {
      const ed = editorRef.current;
      const hit = hitPage(e);
      if (hit) ed.dropField(e.clientX, e.clientY, hit.r, hit.num);
      else ed.setDrag(null);
      ed.setDropHoverPage(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [dragging]);

  const zoomPct = Math.round(zoom * 100);

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' }}>
      {/* Toolbar */}
      <div style={{ height: 42, flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', whiteSpace: 'nowrap', minWidth: 0, overflowX: 'auto' }}>

        <IconBtn name="undo" title="Undo" kbd="⌘Z" onClick={editor.undo} disabled={!editor.canUndo} />
        <IconBtn name="redo" title="Redo" kbd="⌘⇧Z" onClick={editor.redo} disabled={!editor.canRedo} />

        <div style={{ width: 1, background: 'var(--border)', height: 20, margin: '0 2px' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)',
          borderRadius: 6, background: 'var(--surface-2)', height: 28 }}>
          <IconBtn name="zoom-out" size={13} title="Zoom out" kbd="⌘−" onClick={() => zoomTo(zoom / 1.2)} />
          <button type="button" onClick={fitPage} title="Fit page (⌘0)" className="mono"
            style={{ fontSize: 11, color: 'var(--text-2)', minWidth: 42, textAlign: 'center', fontWeight: 500, height: '100%' }}>
            {zoomPct}%
          </button>
          <IconBtn name="zoom-in" size={13} title="Zoom in" kbd="⌘+" onClick={() => zoomTo(zoom * 1.2)} />
        </div>

        <ToolbarButton onClick={fitPage} title="Fit page" kbd="⌘0"><Icon name="maximize" size={12} /> Fit</ToolbarButton>
        <ToolbarButton onClick={fitWidth} title="Fit width" kbd="⌘2">Width</ToolbarButton>
        <ToolbarButton onClick={() => zoomTo(1)} title="Actual size" kbd="⌘1">100%</ToolbarButton>

        <div style={{ width: 1, background: 'var(--border)', height: 20, margin: '0 2px' }} />

        <IconBtn name="chevron-left" size={13} title="Previous page" kbd="PgUp"
          onClick={() => goToPage(Math.max(1, editor.currentPage - 1))} disabled={editor.currentPage === 1} />
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Page <span className="mono" style={{ color: 'var(--text)', fontWeight: 500 }}>{editor.currentPage}</span>
          {' '}of <span className="mono">{editor.doc.pages}</span>
        </div>
        <IconBtn name="chevron-right" size={13} title="Next page" kbd="PgDn"
          onClick={() => goToPage(Math.min(editor.doc.pages, editor.currentPage + 1))}
          disabled={editor.currentPage === editor.doc.pages} />
        <ToolbarButton onClick={() => editor.ops.addPage()} title="Add page" kbd="⌘⇧N">
          <Icon name="file-plus" size={12} /> Page
        </ToolbarButton>
        <IconBtn name="trash" title="Delete current page" danger disabled={editor.doc.pages <= 1}
          onClick={() => editor.ops.deletePage(editor.currentPage)} />

        <div style={{ width: 1, background: 'var(--border)', height: 20, margin: '0 2px' }} />

        <IconBtn name="ruler"  title="Rulers"  kbd="R" active={editor.view.rulers}  onClick={() => editor.toggleView('rulers')} />
        <IconBtn name="grid"   title="Grid"    kbd="G" active={editor.view.grid}    onClick={() => editor.toggleView('grid')} />
        <IconBtn name="magnet" title="Snapping" kbd="S" active={editor.view.snap}   onClick={() => editor.toggleView('snap')} />
        <IconBtn name="square" title="Margin guides" active={editor.view.margins}   onClick={() => editor.toggleView('margins')} />

        <div style={{ flex: 1, minWidth: 8 }} />

        <IconBtn name="keyboard" title="Keyboard shortcuts" kbd="?" onClick={editor.showShortcuts} />
        {status}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <PageRail editor={{ ...editor, goToPage }} backgroundUrl={editor.backgroundUrl} />

        <div ref={vpRef} onPointerDown={onViewportPointerDown}
          style={{
            flex: 1, minWidth: 0, overflow: 'auto', padding: 32,
            cursor: panning ? 'grabbing' : spaceHeld ? 'grab' : 'default',
            overscrollBehavior: 'contain',
          }}>
          <div data-canvas-space="1"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36, minWidth: 'fit-content' }}>
            {Array.from({ length: editor.doc.pages }, (_, i) => i + 1).map((pnum) => (
              <PageCanvas key={pnum} editor={{ ...editor, goToPage }} pageNum={pnum}
                fields={editor.doc.fields.filter((f) => f.page === pnum)}
                registerPage={registerPage}
                panning={panning || spaceHeld}
                backgroundUrl={editor.backgroundUrl} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { CanvasArea, FieldContent };
