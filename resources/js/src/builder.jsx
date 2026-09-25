// Builder shell: owns the document, the selection and every editing operation,
// then hands a single `editor` object to the canvas and the panels.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { CanvasArea } from './canvas.jsx';
import { RightPropsPanel } from './panel.jsx';
import { ConfirmDialog, ContextMenu, IconBtn, Kbd, inputStyle, focusRing } from './ui.jsx';
import { useShortcuts, ShortcutsOverlay } from './shortcuts.jsx';
import {
  useDocument, normalizeDoc, toPayload, patchFields, removeFields,
  cloneFields, pasteFields, reorder as reorderFields,
  insertPage, duplicatePage as dupPage, deletePage as delPage, movePage as mvPage,
} from './document.js';
import {
  pageDims, PAGE_SIZES, makeField, KIND_ICON, ELEMENT_DEFS, NUDGE, NUDGE_BIG, isTypingTarget,
} from './constants.js';
import { buildTargets, snapBox } from './snap.js';

const ARROW_DELTA = {
  ArrowLeft:  [-1, 0], ArrowRight: [1, 0],
  ArrowUp:    [0, -1], ArrowDown:  [0, 1],
};

// Host-page config — both keys are optional and absent when editing a template.
// allowedKeys  → palette narrowed to a named subset of the model's fields
// mode         → 'placement': move existing boxes only, never edit the template
const CFG = (typeof window !== 'undefined' && window.__PDF_BUILDER__) || {};
const ALLOWED_KEYS = Array.isArray(CFG.allowedKeys) && CFG.allowedKeys.length ? CFG.allowedKeys : null;
const PLACEMENT_MODE = CFG.mode === 'placement';

function BuilderView({ template, models, onSave, onPreview, onReset, bridge, saving, saveError }) {
  const modelKey = template.model_key || 'invoice';
  const rawModel = models[modelKey] || { label: modelKey, fields: [], relations: {} };
  const model = useMemo(() => {
    const keep = (f) => !ALLOWED_KEYS || ALLOWED_KEYS.includes(f.key);

    return {
      name: rawModel.label || modelKey,
      icon: rawModel.icon || 'database',
      fields: (rawModel.fields || []).filter(keep),
      // A narrowed palette stays flat — relations would reintroduce
      // everything the allowlist just took out.
      relations: ALLOWED_KEYS ? {} : (rawModel.relations || {}),
    };
  }, [rawModel, modelKey]);

  const { doc, update, commit, undo, redo, canUndo, canRedo } = useDocument(() => normalizeDoc(template));

  const [selection, setSelection]   = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom]             = useState(0.9);
  const [view, setView]             = useState({ rulers: false, grid: false, snap: true, margins: false });
  const [drag, setDrag]             = useState(null);
  const [dropHoverPage, setDropHoverPage] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('fields');
  const [menu, setMenu]             = useState(null);
  const [confirmReq, setConfirmReq] = useState(null);
  const [helpOpen, setHelpOpen]     = useState(false);

  const clipboard   = useRef([]);
  const viewportApi = useRef({});
  const pendingPage = useRef(null);

  // Every edit produces a new document object, so identity is enough to know
  // whether anything has changed since the last successful save.
  const savedDoc = useRef(null);
  const [, markSaved] = useState(0);
  if (savedDoc.current === null) savedDoc.current = doc;

  const { w: pageW, h: pageH } = pageDims(doc.page_size, doc.orientation);
  const dirty = doc !== savedDoc.current;

  // Keep the selection honest when elements or pages disappear.
  useEffect(() => {
    const live = new Set(doc.fields.map((f) => f.id));
    setSelection((sel) => (sel.every((id) => live.has(id)) ? sel : sel.filter((id) => live.has(id))));
  }, [doc.fields]);

  useEffect(() => {
    if (currentPage > doc.pages) setCurrentPage(doc.pages);
  }, [doc.pages, currentPage]);

  // Page operations select a page that doesn't exist on screen yet, so the
  // scroll has to wait for the render that creates it.
  const goToPageAfterRender = useCallback((p) => {
    pendingPage.current = p;
    setCurrentPage(p);
  }, []);

  useEffect(() => {
    if (pendingPage.current == null) return;
    const p = pendingPage.current;
    pendingPage.current = null;
    const frame = requestAnimationFrame(() => viewportApi.current.goToPage?.(p));
    return () => cancelAnimationFrame(frame);
  }, [doc]);

  const toggleView   = useCallback((k) => setView((v) => ({ ...v, [k]: !v[k] })), []);
  const closeMenu    = useCallback(() => setMenu(null), []);
  const closeConfirm = useCallback(() => setConfirmReq(null), []);

  // ── Editing operations ──────────────────────────────────────────────────────
  const targetIds = useCallback((ids) => (ids && ids.length ? ids : selection), [selection]);

  const ops = useMemo(() => {
    const patch = (ids, p, opts) => update((d) => patchFields(d, ids, p), opts);

    const remove = (ids) => {
      const list = targetIds(ids);
      if (!list.length) return;
      update((d) => removeFields(d, list));
      setSelection([]);
    };

    const duplicate = (ids, dx = 12, dy = 12) => {
      const list = targetIds(ids);
      if (!list.length) return [];
      let created = [];
      update((d) => {
        const [next, newIds] = cloneFields(d, list, dx, dy);
        created = newIds;
        return next;
      });
      setSelection(created);
      return created;
    };

    const copy = (ids) => {
      const list = targetIds(ids);
      clipboard.current = doc.fields.filter((f) => list.includes(f.id)).map((f) => ({ ...f }));
    };

    const cut = (ids) => { copy(ids); remove(ids); };

    const paste = () => {
      if (!clipboard.current.length) return;
      let created = [];
      update((d) => {
        const [next, newIds] = pasteFields(d, clipboard.current, currentPage);
        created = newIds;
        return next;
      });
      setSelection(created);
    };

    const reorder = (mode, ids) => {
      const list = targetIds(ids);
      if (!list.length) return;
      update((d) => reorderFields(d, list, mode));
    };

    const nudge = (dx, dy) => {
      if (!selection.length) return;
      update((d) => patchFields(d, selection, (f) => ({
        x: Math.max(0, f.x + dx), y: Math.max(0, f.y + dy),
      })));
    };

    const selectAllOnPage = () => setSelection(doc.fields.filter((f) => f.page === currentPage).map((f) => f.id));

    const addPage = (after = currentPage) => {
      update((d) => insertPage(d, after + 1));
      goToPageAfterRender(after + 1);
    };

    const duplicatePage = (p) => {
      update((d) => dupPage(d, p));
      goToPageAfterRender(p + 1);
    };

    const deletePage = (p) => {
      if (doc.pages <= 1) return;
      const count = doc.fields.filter((f) => f.page === p).length;
      const run = () => {
        update((d) => delPage(d, p));
        setSelection([]);
        const next = currentPage > p ? currentPage - 1 : currentPage;
        goToPageAfterRender(Math.max(1, Math.min(next, doc.pages - 1)));
      };
      if (count === 0) { run(); return; }
      setConfirmReq({
        title: `Delete page ${p}?`,
        body: `This page has ${count} element${count === 1 ? '' : 's'}. Deleting it removes them and shifts the later pages up. You can undo this with ⌘Z.`,
        confirmLabel: 'Delete page',
        danger: true,
        onConfirm: run,
      });
    };

    const movePage = (from, to) => {
      if (to < 1 || to > doc.pages) return;
      update((d) => mvPage(d, from, to));
      goToPageAfterRender(to);
    };

    const setSetting = (patchObj) => update((d) => ({ ...d, ...patchObj }));
    const setMargin = (side, value) => update((d) => ({ ...d, margins: { ...d.margins, [side]: value } }));

    return {
      patch, remove, duplicate, copy, cut, paste, reorder, nudge, selectAllOnPage,
      addPage, duplicatePage, deletePage, movePage, setSetting, setMargin,
    };
  }, [doc, update, currentPage, selection, targetIds, goToPageAfterRender]);

  // ── Drag & drop from the sidebar ────────────────────────────────────────────
  const dropField = useCallback((clientX, clientY, pageRect, pageNum) => {
    if (!drag) return;
    const def = ELEMENT_DEFS[drag.kind] || ELEMENT_DEFS.text;
    let x = (clientX - pageRect.left) / zoom - def.w / 2;
    let y = (clientY - pageRect.top)  / zoom - def.h / 2;

    if (view.snap) {
      const others = doc.fields.filter((f) => f.page === pageNum);
      const snapped = snapBox(x, y, def.w, def.h, buildTargets(others, pageW, pageH, doc.margins), zoom);
      x = snapped.x; y = snapped.y;
    }

    const field = makeField(drag.kind, {
      x: Math.max(0, x), y: Math.max(0, y), page: pageNum, bind: drag.bind, label: drag.label,
    });
    update((d) => ({ ...d, fields: [...d.fields, field] }));
    setSelection([field.id]);
    setCurrentPage(pageNum);
    setDrag(null);
  }, [drag, zoom, view.snap, doc.fields, doc.margins, pageW, pageH, update]);

  // ── Save / preview ──────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    const snapshot = doc;
    const ok = await onSave(toPayload(snapshot));
    if (ok) {
      savedDoc.current = snapshot;
      markSaved((n) => n + 1);
    }
    return ok;
  }, [doc, onSave]);

  const preview = useCallback(async () => {
    if (dirty) await save();
    onPreview();
  }, [dirty, save, onPreview]);

  // Expose to the Filament header buttons.
  useEffect(() => {
    bridge.current = {
      save, preview, reset: onReset,
      showShortcuts: () => setHelpOpen(true),
      isDirty: () => dirty,
    };
  }, [bridge, save, preview, onReset, dirty]);

  // ── Context menus ───────────────────────────────────────────────────────────
  const openElementMenu = useCallback((x, y) => {
    setMenu({
      x, y,
      items: [
        { label: 'Duplicate',      icon: 'copy',        kbd: '⌘D', onClick: () => ops.duplicate() },
        { label: 'Copy',           icon: 'clipboard',   kbd: '⌘C', onClick: () => ops.copy() },
        { label: 'Cut',            icon: 'scissors',    kbd: '⌘X', onClick: () => ops.cut() },
        { label: 'Paste',          icon: 'clipboard',   kbd: '⌘V', onClick: () => ops.paste(), disabled: !clipboard.current.length },
        { separator: true },
        { label: 'Bring to front', icon: 'bring-front', onClick: () => ops.reorder('front') },
        { label: 'Bring forward',  icon: 'arrow-up',    onClick: () => ops.reorder('forward') },
        { label: 'Send backward',  icon: 'arrow-down',  onClick: () => ops.reorder('backward') },
        { label: 'Send to back',   icon: 'send-back',   onClick: () => ops.reorder('back') },
        { separator: true },
        { label: 'Delete',         icon: 'trash',       kbd: '⌫', danger: true, onClick: () => ops.remove() },
      ],
    });
  }, [ops]);

  const openPageMenu = useCallback((x, y, page) => {
    setMenu({
      x, y,
      items: [
        { label: 'Paste here',        icon: 'clipboard', kbd: '⌘V', onClick: () => ops.paste(), disabled: !clipboard.current.length },
        { label: 'Select all on page', icon: 'layers',   kbd: '⌘A', onClick: () => ops.selectAllOnPage() },
        { separator: true },
        { label: 'Add page after',    icon: 'file-plus', onClick: () => ops.addPage(page) },
        { label: 'Duplicate page',    icon: 'copy',      onClick: () => ops.duplicatePage(page) },
        { label: 'Move page up',      icon: 'arrow-up',  disabled: page === 1,         onClick: () => ops.movePage(page, page - 1) },
        { label: 'Move page down',    icon: 'arrow-down', disabled: page === doc.pages, onClick: () => ops.movePage(page, page + 1) },
        { separator: true },
        { label: 'Delete page',       icon: 'trash', danger: true, disabled: doc.pages <= 1, onClick: () => ops.deletePage(page) },
      ],
    });
  }, [ops, doc.pages]);

  // ── Keyboard ────────────────────────────────────────────────────────────────
  const vp = () => viewportApi.current || {};

  useShortcuts({
    save, preview,
    undo, redo,
    help: () => setHelpOpen((o) => !o),
    copy: () => ops.copy(),
    cut: () => ops.cut(),
    paste: () => ops.paste(),
    duplicate: () => ops.duplicate(),
    remove: () => ops.remove(),
    selectAll: () => ops.selectAllOnPage(),
    deselect: (e) => {
      if (isTypingTarget(e.target)) { e.target.blur(); return; }
      if (helpOpen) { setHelpOpen(false); return; }
      setSelection([]);
      setDrag(null);
    },
    nudge: (e) => { const d = ARROW_DELTA[e.key]; if (d) ops.nudge(d[0] * NUDGE, d[1] * NUDGE); },
    nudgeBig: (e) => { const d = ARROW_DELTA[e.key]; if (d) ops.nudge(d[0] * NUDGE_BIG, d[1] * NUDGE_BIG); },
    forward:  () => ops.reorder('forward'),
    backward: () => ops.reorder('backward'),
    front:    () => ops.reorder('front'),
    back:     () => ops.reorder('back'),
    zoomIn:    () => vp().zoomIn?.(),
    zoomOut:   () => vp().zoomOut?.(),
    zoomFit:   () => vp().fitPage?.(),
    zoom100:   () => vp().zoom100?.(),
    zoomWidth: () => vp().fitWidth?.(),
    toggleRulers: () => toggleView('rulers'),
    toggleGrid:   () => toggleView('grid'),
    toggleSnap:   () => toggleView('snap'),
    prevPage: () => vp().goToPage?.(Math.max(1, currentPage - 1)),
    nextPage: () => vp().goToPage?.(Math.min(doc.pages, currentPage + 1)),
    addPage:  () => ops.addPage(),
    deletePage: () => ops.deletePage(currentPage),
  });

  const editor = {
    doc, update, commit, undo, redo, canUndo, canRedo,
    selection, setSelection,
    currentPage, setCurrentPage,
    zoom, setZoom, pageW, pageH,
    view, toggleView,
    ops,
    drag, setDrag, dropField, dropHoverPage, setDropHoverPage,
    openElementMenu, openPageMenu,
    showShortcuts: () => setHelpOpen(true),
    backgroundUrl: template.background_url,
    goToPage: (p) => (viewportApi.current.goToPage ? viewportApi.current.goToPage(p) : setCurrentPage(p)),
  };

  const status = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)', flexShrink: 0, paddingRight: 2 }}>
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: 3, flexShrink: 0,
        background: saveError ? 'var(--danger)' : saving ? 'var(--warning)' : dirty ? 'var(--warning)' : 'var(--success)',
      }} />
      <span>{saving ? 'Saving…' : saveError ? 'Save failed' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0, position: 'relative' }}>
      <Sidebar editor={editor} model={model} activeTab={sidebarTab} onTab={setSidebarTab} onStartDrag={setDrag} />

      <CanvasArea editor={editor} viewportApi={viewportApi} status={status} />

      <RightPropsPanel editor={editor} />

      {drag && <DragGhost drag={drag} />}
      <ContextMenu menu={menu} onClose={closeMenu} />
      <ConfirmDialog request={confirmReq} onClose={closeConfirm} />
      <ShortcutsOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function DragGhost({ drag }) {
  const [pos, setPos] = useState({ x: drag.clientX, y: drag.clientY });
  useEffect(() => {
    const m = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', m);
    return () => window.removeEventListener('pointermove', m);
  }, []);
  return <div className="drag-ghost" style={{ left: pos.x, top: pos.y }}>{drag.label}</div>;
}

// ───────── Sidebar ─────────
function Sidebar({ editor, model, activeTab, onTab, onStartDrag }) {
  // Placement mode repositions existing boxes — adding elements or changing
  // page setup would edit the template, which is not that page's job.
  const tabs = [
    { id: 'fields',   icon: 'database', label: 'Fields'   },
    ...(PLACEMENT_MODE ? [] : [{ id: 'elements', icon: 'type', label: 'Elements' }]),
    { id: 'layers',   icon: 'layers',   label: 'Layers'   },
    ...(PLACEMENT_MODE ? [] : [{ id: 'settings', icon: 'settings', label: 'Settings' }]),
  ];

  return (
    <aside style={{ width: 272, flexShrink: 0, borderRight: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 4px' }}>
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button type="button" key={t.id} onClick={() => onTab(t.id)}
              style={{
                flex: 1, padding: '10px 4px 12px', fontSize: 11.5, fontWeight: 500,
                color: active ? 'var(--accent)' : 'var(--muted)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                marginBottom: -1, transition: 'color .15s ease',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-2)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--muted)'; }}>
              <Icon name={t.icon} size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'fields'   && <FieldsTab model={model} onStartDrag={onStartDrag} />}
        {activeTab === 'elements' && <ElementsTab onStartDrag={onStartDrag} />}
        {activeTab === 'layers'   && <LayersTab editor={editor} />}
        {activeTab === 'settings' && <SettingsTab editor={editor} model={model} />}
      </div>
    </aside>
  );
}

// ───── Fields tab ─────
function FieldsTab({ model, onStartDrag }) {
  const [filter, setFilter] = useState('');
  const lc = filter.toLowerCase();
  const match = (f) => !lc || f.label.toLowerCase().includes(lc) || f.key.toLowerCase().includes(lc);
  const primary   = (model.fields || []).filter(match);
  const relations = Object.entries(model.relations || {}).map(([rk, r]) => ({
    ...r, key: rk, fields: (r.fields || []).filter(match),
  })).filter((r) => r.fields.length);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-2)' }} />
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search fields"
          {...focusRing} style={{ ...inputStyle, paddingLeft: 34 }} />
      </div>
      <FieldGroup title={model.name} fields={primary} onStartDrag={onStartDrag} />
      {relations.map((r) => (
        <FieldGroup key={r.key} title={r.label || r.key} subtitle="relation" fields={r.fields} onStartDrag={onStartDrag} />
      ))}
      {primary.length === 0 && relations.length === 0 && (
        <div style={{ padding: '32px 12px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          No fields match your search.
        </div>
      )}
    </div>
  );
}

function FieldGroup({ title, subtitle, fields, onStartDrag }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 6 }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
          borderRadius: 6, textAlign: 'left', transition: 'background .12s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} style={{ color: 'var(--muted-2)', flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
          {(title || '').toString().replace(/_/g, ' ')}
        </span>
        {subtitle && (
          <span style={{
            fontWeight: 500, fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase',
            letterSpacing: 0.5, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}>{subtitle}</span>
        )}
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2, paddingLeft: 4 }}>
          {fields.map((f) => <FieldChip key={f.key} field={f} onStartDrag={onStartDrag} />)}
        </div>
      )}
    </div>
  );
}

function FieldChip({ field, onStartDrag }) {
  const typeIcon = { text: 'type', longtext: 'type', number: 'hash', currency: 'hash', date: 'hash',
    image: 'image', signature: 'pen', table: 'layers' }[field.type] || 'type';
  const [hov, setHov] = useState(false);
  return (
    <div
      onPointerDown={(e) => onStartDrag({ kind: 'bound', bind: field.key, label: field.label, clientX: e.clientX, clientY: e.clientY })}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
        borderRadius: 6, cursor: 'grab', userSelect: 'none',
        background: hov ? 'var(--accent-soft)' : 'transparent',
        transition: 'background .12s ease',
      }}>
      <div style={{
        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
        background: hov ? 'var(--accent)' : 'var(--accent-soft)',
        color: hov ? '#fff' : 'var(--accent)',
        display: 'grid', placeItems: 'center', transition: 'all .12s ease',
      }}>
        <Icon name={typeIcon} size={12} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label}</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{field.key}</div>
      </div>
      <Icon name="move" size={12} style={{ color: 'var(--muted-2)', opacity: hov ? 0.7 : 0, flexShrink: 0, transition: 'opacity .12s ease' }} />
    </div>
  );
}

// ───── Elements tab ─────
const STATIC_ELEMENTS = ['text', 'heading', 'divider', 'rect', 'image', 'signature', 'checkbox', 'qr', 'page-number'];

function ElementsTab({ onStartDrag }) {
  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {STATIC_ELEMENTS.map((kind) => {
          const el = ELEMENT_DEFS[kind];
          return (
            <button type="button" key={kind}
              onPointerDown={(e) => onStartDrag({ kind, label: el.label, clientX: e.clientX, clientY: e.clientY })}
              style={{
                padding: '16px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text-2)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'grab',
                transition: 'all .12s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-soft)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-2)'; }}>
              <Icon name={el.icon} size={18} />
              <div style={{ fontSize: 12, fontWeight: 500 }}>{el.label}</div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Drag an element onto a page. Hold <Kbd>Alt</Kbd> while dragging on the canvas to clone,
        or to ignore snapping.
      </div>
    </div>
  );
}

// ───── Layers tab ─────
function LayersTab({ editor }) {
  const fields = editor.doc.fields.filter((f) => f.page === editor.currentPage);
  const labelFor = (f) => f.kind === 'bound' ? f.bind
    : f.kind === 'text' || f.kind === 'heading' ? (f.text || 'Text')
    : f.kind.charAt(0).toUpperCase() + f.kind.slice(1);

  return (
    <div style={{ padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px 8px' }}>
        <div style={{ flex: 1, fontSize: 11, color: 'var(--muted)' }}>Page {editor.currentPage} · top first</div>
        <IconBtn name="bring-front" size={13} title="Bring to front" onClick={() => editor.ops.reorder('front')} />
        <IconBtn name="send-back"   size={13} title="Send to back"   onClick={() => editor.ops.reorder('back')} />
      </div>

      {fields.length === 0 && (
        <div style={{ padding: '32px 12px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          No elements yet
          <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--muted-2)' }}>Drag fields or elements onto the canvas.</div>
        </div>
      )}

      {fields.slice().reverse().map((f) => {
        const sel = editor.selection.includes(f.id);
        return (
          <button type="button" key={f.id}
            onClick={(e) => editor.setSelection(
              e.shiftKey || e.metaKey || e.ctrlKey
                ? (sel ? editor.selection.filter((id) => id !== f.id) : [...editor.selection, f.id])
                : [f.id]
            )}
            onContextMenu={(e) => { e.preventDefault(); if (!sel) editor.setSelection([f.id]); editor.openElementMenu(e.clientX, e.clientY); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              borderRadius: 6, textAlign: 'left', marginBottom: 1,
              background: sel ? 'var(--accent-soft)' : 'transparent',
              color: sel ? 'var(--accent)' : 'var(--text-2)',
              transition: 'background .12s ease',
            }}
            onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
            <Icon name={KIND_ICON[f.kind] || 'square'} size={13} style={{ color: sel ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              className={f.kind === 'bound' ? 'mono' : ''}>{labelFor(f)}</span>
            <span className="mono" style={{ fontSize: 10.5, color: sel ? 'var(--accent)' : 'var(--muted-2)' }}>
              {Math.round(f.w)}×{Math.round(f.h)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ───── Settings tab ─────
function SettingsTab({ editor, model }) {
  const { doc, ops } = editor;
  const Row = ({ label, hint, children }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ padding: 14 }}>
      <Row label="Template name">
        <input style={inputStyle} value={doc.name} {...focusRing}
          onChange={(e) => ops.setSetting({ name: e.target.value })} />
      </Row>

      <Row label="Bound model">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px',
          border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: 8 }}>
          <Icon name={model.icon} size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>{model.name}</span>
        </div>
      </Row>

      <Row label="Page size">
        <select style={inputStyle} value={doc.page_size} {...focusRing}
          onChange={(e) => ops.setSetting({ page_size: e.target.value })}>
          {Object.entries(PAGE_SIZES).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
        </select>
      </Row>

      <Row label="Orientation">
        <div style={{ display: 'flex', gap: 6 }}>
          {['portrait', 'landscape'].map((o) => (
            <button type="button" key={o} onClick={() => ops.setSetting({ orientation: o })}
              style={{
                flex: 1, height: 34, borderRadius: 8, fontSize: 12.5, textTransform: 'capitalize',
                border: '1px solid ' + (doc.orientation === o ? 'transparent' : 'var(--border)'),
                background: doc.orientation === o ? 'var(--accent-soft)' : 'var(--surface)',
                color: doc.orientation === o ? 'var(--accent)' : 'var(--text-2)',
              }}>{o}</button>
          ))}
        </div>
      </Row>

      <Row label="Margins (pt)" hint="Shown as guides on the canvas and used for snapping.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[['T', 'top'], ['R', 'right'], ['B', 'bottom'], ['L', 'left']].map(([abbr, side]) => (
            <div key={side} style={{ position: 'relative' }}>
              <input type="number" min={0} style={{ ...inputStyle, paddingLeft: 24, fontSize: 12 }} {...focusRing}
                value={doc.margins[side]}
                onChange={(e) => ops.setMargin(side, Math.max(0, +e.target.value || 0))} />
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                fontSize: 10, color: 'var(--muted-2)', fontWeight: 700, pointerEvents: 'none' }}>{abbr}</span>
            </div>
          ))}
        </div>
      </Row>

      <Row label="Filename pattern" hint="Use {{token}} placeholders for dynamic values.">
        <input className="mono" style={{ ...inputStyle, fontSize: 12 }} {...focusRing}
          value={doc.filename_pattern}
          onChange={(e) => ops.setSetting({ filename_pattern: e.target.value })} />
      </Row>

      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)',
        fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.7 }}>
        <div>Pages: <span className="mono" style={{ color: 'var(--text-2)' }}>{doc.pages}</span></div>
        <div>Elements: <span className="mono" style={{ color: 'var(--text-2)' }}>{doc.fields.length}</span></div>
      </div>
    </div>
  );
}

export { BuilderView };
